"""Idempotent index bootstrap for Foundation 1A collections.

Uses partialFilterExpression (not sparse) so uniqueness applies only when
the provider ID field is genuinely non-null. Sparse indexes still index
null values, which is not what we want.
"""
from pymongo import ASCENDING, DESCENDING, TEXT

# Each index is (keys, options). We compare against list_indexes() at
# startup and only CREATE missing ones. We never DROP automatically.

TEAM_INDEXES = [
    ({"ticker_team_id": ASCENDING}, {"unique": True, "name": "ux_ticker_team_id"}),
    ({"competition": ASCENDING, "canonical_code": ASCENDING},
     {"unique": True, "name": "ux_comp_code"}),
    ({"provider_ids.sportradar.id": ASCENDING},
     {"unique": True, "name": "ux_pid_sportradar",
      "partialFilterExpression": {"provider_ids.sportradar.id": {"$type": "string"}}}),
    ({"provider_ids.highlightly.id": ASCENDING},
     {"unique": True, "name": "ux_pid_highlightly",
      "partialFilterExpression": {"provider_ids.highlightly.id": {"$type": "number"}}}),
    ({"provider_ids.nhl_public.tri_code": ASCENDING, "competition": ASCENDING},
     {"unique": True, "name": "ux_pid_nhl_tri",
      "partialFilterExpression": {"provider_ids.nhl_public.tri_code": {"$type": "string"}}}),
    ({"provider_ids.sportsdata_io.team_id": ASCENDING},
     {"unique": True, "name": "ux_pid_sdio",
      "partialFilterExpression": {"provider_ids.sportsdata_io.team_id": {"$type": "number"}}}),
    ({"active": ASCENDING, "competition": ASCENDING}, {"name": "ix_active_comp"}),
]

PLAYER_INDEXES = [
    ({"ticker_player_id": ASCENDING}, {"unique": True, "name": "ux_ticker_player_id"}),
    ({"provider_ids.sportradar.id": ASCENDING},
     {"unique": True, "name": "ux_pid_sportradar",
      "partialFilterExpression": {"provider_ids.sportradar.id": {"$type": "string"}}}),
    ({"provider_ids.nhl_public.player_id": ASCENDING},
     {"unique": True, "name": "ux_pid_nhl",
      "partialFilterExpression": {"provider_ids.nhl_public.player_id": {"$type": "number"}}}),
    ({"provider_ids.sportsdata_io.player_id": ASCENDING},
     {"unique": True, "name": "ux_pid_sdio",
      "partialFilterExpression": {"provider_ids.sportsdata_io.player_id": {"$type": "number"}}}),
    ({"current_team_id": ASCENDING, "active": ASCENDING}, {"name": "ix_team_active"}),
    ({"canonical_name": TEXT}, {"name": "tx_name"}),
]

GAME_INDEXES = [
    ({"ticker_game_id": ASCENDING}, {"unique": True, "name": "ux_ticker_game_id"}),
    ({"competition": ASCENDING, "current.scheduled_iso": ASCENDING}, {"name": "ix_comp_sched"}),
    ({"home_team_id": ASCENDING, "current.scheduled_iso": DESCENDING}, {"name": "ix_home_sched"}),
    ({"away_team_id": ASCENDING, "current.scheduled_iso": DESCENDING}, {"name": "ix_away_sched"}),
    ({"current.status": ASCENDING, "current.scheduled_iso": ASCENDING}, {"name": "ix_status_sched"}),
    ({"provider_ids.sportradar.id": ASCENDING},
     {"unique": True, "name": "ux_pid_sportradar",
      "partialFilterExpression": {"provider_ids.sportradar.id": {"$type": "string"}}}),
    ({"provider_ids.highlightly.id": ASCENDING},
     {"unique": True, "name": "ux_pid_highlightly",
      "partialFilterExpression": {"provider_ids.highlightly.id": {"$type": "number"}}}),
    ({"provider_ids.nhl_public.id": ASCENDING},
     {"unique": True, "name": "ux_pid_nhl",
      "partialFilterExpression": {"provider_ids.nhl_public.id": {"$type": "number"}}}),
    ({"provider_ids.sportsdata_io.id": ASCENDING},
     {"unique": True, "name": "ux_pid_sdio",
      "partialFilterExpression": {"provider_ids.sportsdata_io.id": {"$type": "number"}}}),
]

REVISION_INDEXES = [
    ({"id": ASCENDING}, {"unique": True, "name": "ux_id"}),
    ({"ticker_game_id": ASCENDING, "revision_number": ASCENDING},
     {"unique": True, "name": "ux_game_rev"}),
    ({"ticker_game_id": ASCENDING, "locked_at": DESCENDING}, {"name": "ix_game_locked"}),
    ({"locked_at": ASCENDING}, {"name": "ix_locked"}),
]

SNAPSHOT_INDEXES = [
    ({"id": ASCENDING}, {"unique": True, "name": "ux_id"}),
    ({"ticker_game_id": ASCENDING, "snapshot_kind": ASCENDING, "snapshot_version": DESCENDING},
     {"unique": True, "name": "ux_game_kind_ver"}),
    # THE lock-time selection index (critical for Betting IQ).
    ({"ticker_game_id": ASCENDING, "locked_at": DESCENDING}, {"name": "ix_game_locked_desc"}),
    ({"ticker_game_id": ASCENDING, "locked_at": ASCENDING}, {"name": "ix_game_locked_asc"}),
    ({"snapshot_kind": ASCENDING, "locked_at": DESCENDING}, {"name": "ix_kind_locked"}),
    ({"locked_at": ASCENDING}, {"name": "ix_locked"}),
]

INDEX_MAP = {
    "iq_canonical_teams":            TEAM_INDEXES,
    "iq_canonical_players":          PLAYER_INDEXES,
    "iq_canonical_games":            GAME_INDEXES,
    "iq_game_schedule_revisions":    REVISION_INDEXES,
    "iq_game_context_snapshots":     SNAPSHOT_INDEXES,
}


async def ensure_indexes(db):
    """Create any missing indexes on the five 1A collections. Idempotent."""
    for coll_name, specs in INDEX_MAP.items():
        coll = db[coll_name]
        existing = {ix["name"] async for ix in coll.list_indexes()}
        for keys, opts in specs:
            name = opts.get("name")
            if name in existing:
                continue
            await coll.create_index(list(keys.items()), **opts)
