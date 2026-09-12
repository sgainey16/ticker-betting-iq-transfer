"""Indexes for Foundation 1B — iq_game_finals only.

REV2 discipline: no operational bookkeeping collection alongside
iq_game_finals. Season completeness is not stored anywhere; it's a
future explicit decision when Betting IQ actually needs it.

Design rules:
  - Uniqueness on (ticker_game_id, record_version) so no two rows share a
    version number for the same game. That is what makes 'append-only
    correction' auditable.
  - Lock-time selection index: (ticker_game_id, recorded_at DESC) mirrors
    the pattern used by iq_game_context_snapshots for consistency.
  - Team-perspective indexes: (ticker_team_id, played_at_iso DESC) and
    (ticker_team_id, recorded_at DESC) so both "chronology of the game"
    and "chronology of Ticker's knowledge" are fast.
"""
from pymongo import ASCENDING, DESCENDING

GAME_FINALS_INDEXES = [
    ({"id": ASCENDING}, {"unique": True, "name": "ux_id"}),
    ({"ticker_game_id": ASCENDING, "record_version": ASCENDING},
     {"unique": True, "name": "ux_game_version"}),
    ({"ticker_game_id": ASCENDING, "recorded_at": DESCENDING},
     {"name": "ix_game_recorded_desc"}),
    ({"ticker_game_id": ASCENDING, "recorded_at": ASCENDING},
     {"name": "ix_game_recorded_asc"}),
    ({"home_team_id": ASCENDING, "played_at_iso": DESCENDING},
     {"name": "ix_home_played"}),
    ({"away_team_id": ASCENDING, "played_at_iso": DESCENDING},
     {"name": "ix_away_played"}),
    ({"home_team_id": ASCENDING, "recorded_at": DESCENDING},
     {"name": "ix_home_recorded"}),
    ({"away_team_id": ASCENDING, "recorded_at": DESCENDING},
     {"name": "ix_away_recorded"}),
    ({"season": ASCENDING, "season_type": ASCENDING, "played_at_iso": DESCENDING},
     {"name": "ix_season_played"}),
]

INDEX_MAP_1B = {
    "iq_game_finals": GAME_FINALS_INDEXES,
}


async def ensure_indexes_1b(db):
    """Idempotent bootstrap for Foundation 1B collections."""
    for coll_name, specs in INDEX_MAP_1B.items():
        coll = db[coll_name]
        existing = {ix["name"] async for ix in coll.list_indexes()}
        for keys, opts in specs:
            name = opts.get("name")
            if name in existing:
                continue
            await coll.create_index(list(keys.items()), **opts)
