"""Dynamic NHL season resolver.

The current NHL season depends on real-world date, never on a hard-coded
literal. Regular-season starts early October; the season string
(e.g. "2026-2027") flips at July 1 UTC — before that we are still in the
prior season's playoffs / offseason.

Foundation 1B uses this to know:
  - what "current" means when NHL Public API redirects /now → /{season}
  - what season/season_type to stamp on a completed game
  - when a walk-back has crossed a season boundary (allowed, per the
    minimum-history Last-10 rule)

We do NOT store or return a "current_season = 2025-26" constant anywhere.
As of Sep 2026, 2025-26 is the most recently completed season.
"""
from __future__ import annotations
from datetime import date, datetime, timezone
from typing import Literal

SeasonType = Literal["PRE", "REG", "POST"]

# NHL Public API gameType codes.
_GAME_TYPE_MAP: dict[int, SeasonType] = {1: "PRE", 2: "REG", 3: "POST"}


def season_type_from_game_type(game_type: int) -> SeasonType:
    """Map NHL Public API gameType (1/2/3) → Ticker canonical PRE/REG/POST."""
    return _GAME_TYPE_MAP.get(int(game_type), "REG")


def season_int_to_str(season_int: int | str) -> str:
    """20262027 → '2026-2027'. Passthrough if already 'YYYY-YYYY'."""
    s = str(season_int)
    if "-" in s:
        return s
    if len(s) == 8:
        return f"{s[:4]}-{s[4:]}"
    return s


def current_nhl_season(now_utc: datetime | None = None) -> str:
    """The NHL season string that includes 'now'.

    Convention: seasons flip on July 1 UTC. That's a coarse boundary but
    matches how NHL Public API's `/now` redirects behave (Sep 2026 → 2026-2027).
    Anything from July of year Y onward belongs to season Y-(Y+1).
    Anything before July belongs to season (Y-1)-Y.
    """
    now_utc = now_utc or datetime.now(timezone.utc)
    y = now_utc.year
    if now_utc.month >= 7:
        return f"{y}-{y + 1}"
    return f"{y - 1}-{y}"


def previous_nhl_season(season: str) -> str:
    """'2026-2027' → '2025-2026'. Used when walk-back crosses a boundary."""
    a, b = season.split("-")
    return f"{int(a) - 1}-{int(b) - 1}"


def season_int_from_str(season: str) -> int:
    """'2026-2027' → 20262027. Matches NHL Public API's numeric season."""
    return int(season.replace("-", ""))
