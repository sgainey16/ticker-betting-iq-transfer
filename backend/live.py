"""Live scoreboard + demo mode engine.

Real NHL play-by-play isn't in scope for the offseason — we don't have a
live feed key yet. But investors need to *see* the pipeline moving, so
we run a deterministic in-memory demo ticker that fires realistic-looking
game events every ~10-15 seconds:

- Goal (team scores, jumps to 1-0 / 2-1 / etc.)
- Power play start / end
- Period advance
- Clock tick (silent — just keeps time moving)

Frontend polls `/api/live/state` every 5s, diffs the `events` list against
what it's already shown, and fires goal-horn alerts on each new goal.

When we get a real live feed later, the shape of `state()` stays the
same — only the tick function is replaced with a poller against the real
API. Frontend needs zero changes.
"""
from __future__ import annotations

import asyncio
import logging
import random
import time
import uuid
from datetime import datetime, timezone
from typing import Any

log = logging.getLogger(__name__)


# =========================================================================
# Mock teams — we reuse team codes the frontend already knows so logos
# render. Season colors don't matter here; the frontend pulls logos from
# the Highlightly team map by code.
# =========================================================================
_MOCK_MATCHUPS = [
    ("EDM", "COL", "Edmonton Oilers",       "Colorado Avalanche"),
    ("TOR", "BOS", "Toronto Maple Leafs",   "Boston Bruins"),
    ("NYR", "CAR", "New York Rangers",      "Carolina Hurricanes"),
    ("VGK", "DAL", "Vegas Golden Knights",  "Dallas Stars"),
]


def _fresh_games() -> list[dict[str, Any]]:
    """Kick off a fresh set of games at 20:00 of the first period."""
    games = []
    for away_code, home_code, away_name, home_name in _MOCK_MATCHUPS:
        games.append({
            "game_id": f"demo-{away_code}-{home_code}",
            "away": {"code": away_code, "name": away_name, "score": 0, "shots": 0},
            "home": {"code": home_code, "name": home_name, "score": 0, "shots": 0},
            "period": 1,
            "clock": "20:00",
            "period_seconds_remaining": 20 * 60,
            "situation": "5v5",        # or "PP-AWAY", "PP-HOME", "PK-AWAY"
            "situation_until_sec": None,
            "state": "LIVE",           # LIVE | FINAL | PREGAME
        })
    return games


class LiveEngine:
    """In-memory live-state singleton. Thread-safe enough for our async single-worker uvicorn."""

    def __init__(self) -> None:
        self.games: list[dict[str, Any]] = _fresh_games()
        self.events: list[dict[str, Any]] = []   # newest last
        self.last_tick_at: float = 0.0
        self.demo_mode: bool = True
        self._task: asyncio.Task | None = None

    # ------------- lifecycle -------------
    def start(self) -> None:
        """Kick off the background ticker if not already running."""
        if self._task and not self._task.done():
            return
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            return
        self._task = loop.create_task(self._run_loop())
        log.info("LiveEngine demo ticker started")

    async def _run_loop(self) -> None:
        # 10-14s between ticks so the alert bar feels alive but not spammy.
        while True:
            try:
                await asyncio.sleep(random.uniform(10, 14))
                if self.demo_mode:
                    self._tick_demo()
            except asyncio.CancelledError:
                break
            except Exception as e:  # noqa: BLE001
                log.warning("live engine tick failed: %s", e)

    def reset(self) -> None:
        """Rewind everything to fresh 0-0 games (used by the demo toggle)."""
        self.games = _fresh_games()
        self.events = []

    # ------------- demo mechanics -------------
    def _tick_demo(self) -> None:
        self.last_tick_at = time.time()
        # Pick an action weighted so goals feel frequent but not silly.
        action = random.choices(
            ["goal", "period_advance", "pp_start", "pp_end", "clock_only"],
            weights=[45, 8, 12, 12, 23],
            k=1,
        )[0]
        # Pick a game that's still live (or reset if all are FINAL).
        live_games = [g for g in self.games if g["state"] == "LIVE"]
        if not live_games:
            self.reset()
            live_games = self.games
        g = random.choice(live_games)

        if action == "goal":
            self._record_goal(g)
        elif action == "period_advance":
            self._advance_period(g)
        elif action == "pp_start":
            self._start_pp(g)
        elif action == "pp_end":
            self._end_pp(g)
        # clock_only: just tick the clock (silent event, no alert)
        self._tick_clock(g)

    def _record_goal(self, g: dict) -> None:
        side = random.choice(["home", "away"])
        g[side]["score"] += 1
        g[side]["shots"] += random.randint(1, 3)
        # Opposite team also gets some shots to feel realistic
        other = "home" if side == "away" else "away"
        g[other]["shots"] += random.randint(0, 2)
        # PP goal 25% of the time when a PP is active
        pp_active = g["situation"].startswith("PP-")
        pp_side = g["situation"].split("-", 1)[1].lower() if pp_active else None
        is_pp = pp_active and pp_side == side
        if is_pp:
            g["situation"] = "5v5"
            g["situation_until_sec"] = None
        self._push_event({
            "kind": "goal",
            "game_id": g["game_id"],
            "team_side": side,
            "team_code": g[side]["code"],
            "team_name": g[side]["name"],
            "score_after": {"home": g["home"]["score"], "away": g["away"]["score"]},
            "period": g["period"],
            "clock": g["clock"],
            "is_pp_goal": is_pp,
        })

    def _advance_period(self, g: dict) -> None:
        if g["period"] >= 3:
            g["state"] = "FINAL"
            g["clock"] = "FINAL"
            g["period_seconds_remaining"] = 0
            self._push_event({
                "kind": "game_final",
                "game_id": g["game_id"],
                "score": {"home": g["home"]["score"], "away": g["away"]["score"]},
            })
        else:
            g["period"] += 1
            g["clock"] = "20:00"
            g["period_seconds_remaining"] = 20 * 60
            self._push_event({
                "kind": "period_start",
                "game_id": g["game_id"],
                "period": g["period"],
            })

    def _start_pp(self, g: dict) -> None:
        if g["situation"] != "5v5":
            return
        side = random.choice(["home", "away"])
        g["situation"] = f"PP-{side.upper()}"
        g["situation_until_sec"] = 120
        self._push_event({
            "kind": "pp_start",
            "game_id": g["game_id"],
            "team_side": side,
            "team_code": g[side]["code"],
        })

    def _end_pp(self, g: dict) -> None:
        if g["situation"] == "5v5":
            return
        g["situation"] = "5v5"
        g["situation_until_sec"] = None
        self._push_event({"kind": "pp_end", "game_id": g["game_id"]})

    def _tick_clock(self, g: dict) -> None:
        # Burn ~90s of period time per tick.
        remaining = max(0, g["period_seconds_remaining"] - 90)
        g["period_seconds_remaining"] = remaining
        mins, secs = divmod(remaining, 60)
        g["clock"] = f"{mins}:{secs:02d}" if remaining > 0 else "0:00"
        if remaining == 0 and g["state"] == "LIVE":
            # Auto-advance at end of period on next tick — we don't push
            # an event here because the next explicit period_advance will.
            pass
        if g["situation_until_sec"] is not None:
            g["situation_until_sec"] = max(0, g["situation_until_sec"] - 90)
            if g["situation_until_sec"] == 0:
                self._end_pp(g)

    def _push_event(self, evt: dict) -> None:
        evt["id"] = uuid.uuid4().hex
        evt["at"] = datetime.now(timezone.utc).isoformat()
        self.events.append(evt)
        # Keep the tail bounded so we don't leak memory over long demos.
        if len(self.events) > 500:
            self.events = self.events[-500:]

    # ------------- public read -------------
    def state(self, since: str | None = None) -> dict[str, Any]:
        events = self.events
        if since:
            # Return only events strictly newer than the given ISO string.
            events = [e for e in self.events if e["at"] > since]
        return {
            "demo_mode": self.demo_mode,
            "games": self.games,
            "events": events,
            "server_time": datetime.now(timezone.utc).isoformat(),
        }

    def force_goal(self, game_id: str | None = None) -> dict:
        """Manual trigger for testing / investor demos — fire a goal now."""
        candidates = [g for g in self.games if g["state"] == "LIVE"]
        if game_id:
            candidates = [g for g in candidates if g["game_id"] == game_id]
        if not candidates:
            self.reset()
            candidates = self.games
        g = random.choice(candidates)
        self._record_goal(g)
        return {"ok": True, "game_id": g["game_id"]}


live_engine = LiveEngine()
