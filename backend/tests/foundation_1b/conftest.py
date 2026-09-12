"""Shared fixtures for Foundation 1B tests.

Every test gets an isolated MongoDB database + freshly-created indexes
for both 1A and 1B collections. Team resolution is done up front so
tests can focus on final-record semantics.

All test data is deterministic — no live HTTP anywhere. Captured NHL
Public API JSON lives in ./fixtures/.
"""
from __future__ import annotations
import asyncio
import json
import os
import uuid
from pathlib import Path

import pytest
from motor.motor_asyncio import AsyncIOMotorClient

from intelligence.indexes import ensure_indexes
from intelligence.indexes_1b import ensure_indexes_1b
from intelligence.resolver_teams import resolve_team, TeamHint

FIXTURES = Path(__file__).parent / "fixtures"


def load_fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


@pytest.fixture
async def db():
    client = AsyncIOMotorClient(
        os.environ.get("MONGO_URL", "mongodb://localhost:27017"),
        maxPoolSize=5,
        serverSelectionTimeoutMS=20000,
        connectTimeoutMS=20000,
        socketTimeoutMS=20000,
    )
    dbname = f"iq1b_test_{uuid.uuid4().hex[:8]}"
    d = client[dbname]
    # Retry index creation once if a transient auto-reconnect fires.
    from pymongo.errors import AutoReconnect
    for attempt in range(3):
        try:
            await ensure_indexes(d)
            await ensure_indexes_1b(d)
            break
        except AutoReconnect:
            if attempt == 2:
                raise
            await asyncio.sleep(0.5)
    yield d
    try:
        await client.drop_database(dbname)
    except Exception:
        pass
    client.close()


async def _resolve_tri(d, tri: str, name: str = "") -> str:
    return await resolve_team(d, TeamHint(
        provider="nhl_public",
        provider_ids={"tri_code": tri},
        display_name=name or tri,
        market=tri,
        canonical_code_fallback=tri,
    ))


@pytest.fixture
async def team_map(db):
    """Resolve the tri codes that appear across the captured fixtures once,
    so tests can call team_map['EDM'] to get a ticker_team_id."""
    tris = ["EDM", "FLA", "PHI", "DET"]
    m: dict[str, str] = {}
    for t in tris:
        m[t] = await _resolve_tri(db, t)
    return m
