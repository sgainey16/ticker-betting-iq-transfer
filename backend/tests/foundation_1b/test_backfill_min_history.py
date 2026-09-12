"""Backfill walk-back tests — minimum-history rule.

Runs the walk-back logic against captured schedule JSON (no HTTP), and
verifies that:
  - The walk-back stops at exactly N completed games.
  - Season boundaries are crossed when needed.
  - League-wide dedup by NHL game id.
  - After the seed, coverage_state remains 'partial'.
"""
import json
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from intelligence.backfill_1b import (
    _team_last_n_game_ids, run_minimum_history_backfill,
)
from tests.foundation_1b.conftest import load_fixture

FIXTURES = Path(__file__).parent / "fixtures"


class _FakeResp:
    def __init__(self, status_code: int, body):
        self.status_code = status_code
        self._body = body
    def json(self):
        return self._body


class _FakeClient:
    """Fake httpx.AsyncClient that returns captured JSON per URL suffix."""
    def __init__(self, responses: dict[str, dict]):
        self._resp = responses
    async def __aenter__(self): return self
    async def __aexit__(self, *a): return False
    async def get(self, url, headers=None, timeout=None, follow_redirects=None):
        for suffix, body in self._resp.items():
            if url.endswith(suffix):
                return _FakeResp(200, body)
        return _FakeResp(404, {})


@pytest.mark.asyncio
async def test_walkback_stops_at_n_within_single_season():
    schedule = load_fixture("club_schedule_EDM_20242025.json")
    fake = _FakeClient({
        "club-schedule-season/EDM/20262027": {"games": []},
        "club-schedule-season/EDM/20252026": {"games": []},
        "club-schedule-season/EDM/20242025": schedule,
    })
    now = datetime(2026, 9, 12, tzinfo=timezone.utc)
    async with fake as http:
        metas = await _team_last_n_game_ids(http, "EDM", 10, now_utc=now)
    assert len(metas) == 10, "walk-back must stop when exactly N found"
    # Descending by played_at_iso
    played = [m["played_at_iso"] for m in metas]
    assert played == sorted(played, reverse=True)


@pytest.mark.asyncio
async def test_walkback_crosses_season_boundary_when_current_is_empty():
    schedule_prev = load_fixture("club_schedule_EDM_20242025.json")
    fake = _FakeClient({
        # Current season (2026-2027) empty — mid-Sep 2026 no games yet
        "club-schedule-season/EDM/20262027": {"games": []},
        "club-schedule-season/EDM/20252026": {"games": []},
        # Fall through to 2024-25 for real data
        "club-schedule-season/EDM/20242025": schedule_prev,
    })
    now = datetime(2026, 9, 12, tzinfo=timezone.utc)
    async with fake as http:
        metas = await _team_last_n_game_ids(http, "EDM", 5, now_utc=now)
    assert len(metas) == 5
    # All came from the 2024-2025 season because current is empty
    assert all(m["season"] == "2024-2025" for m in metas)


@pytest.mark.asyncio
async def test_walkback_never_includes_future_or_non_final_games():
    """Games with startTimeUTC in the future or gameState not in
    {OFF, FINAL} must be excluded."""
    now = datetime(2026, 9, 12, tzinfo=timezone.utc)
    # Take a real fixture and inject: (a) a future FUT game, (b) a LIVE game
    real = load_fixture("club_schedule_EDM_20242025.json")
    fake_games = list(real.get("games", []))
    fake_games.append({
        "id": 9999999999, "season": 20262027, "gameType": 2,
        "gameDate": "2026-12-01", "startTimeUTC": "2026-12-01T00:00:00Z",
        "gameState": "FUT",
        "homeTeam": {"abbrev": "EDM"}, "awayTeam": {"abbrev": "TBD"},
    })
    fake_games.append({
        "id": 9999999998, "season": 20252026, "gameType": 2,
        "gameDate": "2026-04-01", "startTimeUTC": "2026-04-01T00:00:00Z",
        "gameState": "LIVE",
        "homeTeam": {"abbrev": "EDM"}, "awayTeam": {"abbrev": "VAN"},
    })
    fake = _FakeClient({
        "club-schedule-season/EDM/20262027": {"games": fake_games},
        "club-schedule-season/EDM/20252026": {"games": []},
        "club-schedule-season/EDM/20242025": real,
    })
    async with fake as http:
        metas = await _team_last_n_game_ids(http, "EDM", 12, now_utc=now)
    for m in metas:
        assert m["nhl_game_id"] not in (9999999999, 9999999998)


@pytest.mark.asyncio
async def test_full_backfill_dedup_and_partial_coverage(db, monkeypatch):
    """End-to-end: 2 teams, walkback + dedup + finals writing.
    Verifies dedup means each unique nhl_game_id gets ingested once."""
    # Two teams share games in 2024-2025 (SCF series). We fabricate FLA's
    # schedule by taking the SCF games out of EDM's — that guarantees overlap
    # so we can prove dedup collapses shared game IDs.
    edm_sched = load_fixture("club_schedule_EDM_20242025.json")
    fla_sched = {
        "games": [g for g in edm_sched.get("games", [])
                   if "FLA" in {(g.get("homeTeam") or {}).get("abbrev"),
                                (g.get("awayTeam") or {}).get("abbrev")}]
    }
    scf_bx = load_fixture("boxscore_2024030411_FLA_at_EDM.json")
    reg_bx = load_fixture("boxscore_2024020001_regular.json")
    ot_bx = load_fixture("boxscore_2024020056_overtime.json")
    so_bx = load_fixture("boxscore_2024020819_shootout.json")

    # Seed teams (Foundation 1A minimally) — EDM and FLA
    from tests.foundation_1b.conftest import _resolve_tri
    edm_id = await _resolve_tri(db, "EDM")
    fla_id = await _resolve_tri(db, "FLA")

    # Build the response set: club-schedule + boxscores.
    box_map = {}
    # Provide boxscores for every SCF game that appears in EDM's top-3 by
    # cloning the SCF Game 4 fixture (identical structure). We keep the
    # team blocks (EDM home in games 415, 412; FLA home in 416, 414, 413)
    # so ingestion still works; per-game score details will match the
    # cloned fixture, which is fine for a dedup+coverage test.
    import copy as _copy
    for g in edm_sched.get("games", []):
        gid = g["id"]
        if gid in {2024030416, 2024030415, 2024030414}:
            c = _copy.deepcopy(scf_bx)
            c["id"] = gid
            # Preserve real home/away per game so team resolution matches
            c["homeTeam"]["abbrev"] = g["homeTeam"]["abbrev"]
            c["awayTeam"]["abbrev"] = g["awayTeam"]["abbrev"]
            c["startTimeUTC"] = g["startTimeUTC"]
            box_map[gid] = c
        elif gid == 2024030411: box_map[gid] = scf_bx
        elif gid == 2024020001: box_map[gid] = reg_bx
        elif gid == 2024020056: box_map[gid] = ot_bx
        elif gid == 2024020819: box_map[gid] = so_bx

    responses = {
        "club-schedule-season/EDM/20262027": {"games": []},
        "club-schedule-season/EDM/20252026": {"games": []},
        "club-schedule-season/EDM/20242025": edm_sched,
        "club-schedule-season/FLA/20262027": {"games": []},
        "club-schedule-season/FLA/20252026": {"games": []},
        "club-schedule-season/FLA/20242025": fla_sched,
    }
    for gid, bx in box_map.items():
        responses[f"gamecenter/{gid}/boxscore"] = bx

    class _Cli(_FakeClient):
        pass

    # Patch httpx.AsyncClient inside backfill_1b to return our fake.
    import intelligence.backfill_1b as bf
    monkeypatch.setattr(bf.httpx, "AsyncClient", lambda: _Cli(responses))
    # Point the backfill at THIS test's db by patching AsyncIOMotorClient.
    class _FakeMotor:
        def __init__(self, url): pass
        def __getitem__(self, name): return db
        def close(self): pass
    monkeypatch.setattr(bf, "AsyncIOMotorClient", _FakeMotor)

    now = datetime(2026, 9, 12, tzinfo=timezone.utc)
    stats = await bf.run_minimum_history_backfill(per_team_n=3, now_utc=now)

    # Dedup effect: with per_team_n=3, EDM's top-3 and FLA's top-3 fully
    # overlap (both series' latest games). Unique count MUST be exactly 3.
    assert stats["teams_seen"] == 2
    assert stats["unique_nhl_game_ids"] == 3, \
        "3 shared SCF games must collapse to 3 unique ids after dedup"
    assert stats["finals_written_v1"] == 3
    # 1B owns only iq_game_finals — no coverage collection is created.
    assert await db["iq_team_season_coverage"].count_documents({}) == 0
    # And also assert no coverage anywhere for the two teams under any name.
    for tid in (edm_id, fla_id):
        rows = [r async for r in db["iq_team_season_coverage"].find(
            {"ticker_team_id": tid})]
        assert rows == []
