"""Regression tests for Tonight's 10 board loop.

Covers:
  - GET /api/iq/board?device_id=... creates today's board with N ≤ 10 questions
  - Past-date boards do NOT auto-create (404)
  - POST /api/iq/board/{id}/lock creates a pick10_entry call + locked event
  - Locking is idempotent per question (double-tap does not create a
    second call)
  - POST /api/iq/board/{id}/resolve grades locked picks (dev mode only)
  - Grading produces correct/incorrect resolutions and updates progress
  - PATCH /api/iq/user/prefs saves default_visibility
"""
import os
import time
import pytest
import httpx

BASE = os.environ.get("TICKER_API_BASE", "http://localhost:8001/api")


def _did(suffix: str = "") -> str:
    return f"pytest_boards_{int(time.time()*1000)}_{suffix}"


@pytest.mark.asyncio
async def test_get_board_today_creates_up_to_10():
    async with httpx.AsyncClient(base_url=BASE, timeout=15) as c:
        device = _did("today")
        r = await c.get(f"/iq/board?device_id={device}")
        assert r.status_code == 200
        board = r.json()
        assert "id" in board
        assert "questions" in board
        assert len(board["questions"]) <= 10
        # Each question must be honestly resolvable-shaped
        for q in board["questions"]:
            assert q["template"] == "who_wins"
            assert q["subject"]["game_id"]
            assert q["subject"]["home"]
            assert q["subject"]["away"]
            assert q["locked_pick"] is None
            assert q["locked_call_id"] is None


@pytest.mark.asyncio
async def test_get_board_past_date_404():
    async with httpx.AsyncClient(base_url=BASE, timeout=15) as c:
        device = _did("past")
        r = await c.get(f"/iq/board?device_id={device}&board_date=2020-01-01")
        assert r.status_code == 404


@pytest.mark.asyncio
async def test_lock_creates_call_and_is_idempotent():
    async with httpx.AsyncClient(base_url=BASE, timeout=15) as c:
        device = _did("lock")
        board = (await c.get(f"/iq/board?device_id={device}")).json()
        q = board["questions"][0]

        # First lock
        r1 = await c.post(
            f"/iq/board/{board['id']}/lock",
            json={"device_id": device, "q_id": q["q_id"], "pick": "home"},
        )
        assert r1.status_code == 200
        b1 = r1.json()
        assert b1["progress"]["locked"] == 1
        first_q = next(x for x in b1["questions"] if x["q_id"] == q["q_id"])
        assert first_q["locked_pick"] == "home"
        assert first_q["locked_call_id"] is not None
        first_call_id = first_q["locked_call_id"]

        # Second lock — same question, different pick — must NOT create new call
        r2 = await c.post(
            f"/iq/board/{board['id']}/lock",
            json={"device_id": device, "q_id": q["q_id"], "pick": "away"},
        )
        assert r2.status_code == 200
        b2 = r2.json()
        assert b2["progress"]["locked"] == 1
        again_q = next(x for x in b2["questions"] if x["q_id"] == q["q_id"])
        assert again_q["locked_call_id"] == first_call_id
        # Original pick preserved — locks are immutable
        assert again_q["locked_pick"] == "home"


@pytest.mark.asyncio
async def test_lock_rejects_bad_pick():
    async with httpx.AsyncClient(base_url=BASE, timeout=15) as c:
        device = _did("bad")
        board = (await c.get(f"/iq/board?device_id={device}")).json()
        q = board["questions"][0]
        r = await c.post(
            f"/iq/board/{board['id']}/lock",
            json={"device_id": device, "q_id": q["q_id"], "pick": "draw"},
        )
        assert r.status_code == 400


@pytest.mark.asyncio
async def test_resolve_grades_locked_picks():
    if os.environ.get("IQ_DEV_MODE", "0") != "1":
        pytest.skip("resolve endpoint requires IQ_DEV_MODE=1")

    async with httpx.AsyncClient(base_url=BASE, timeout=15) as c:
        device = _did("resolve")
        board = (await c.get(f"/iq/board?device_id={device}")).json()
        # Lock every question home
        for q in board["questions"]:
            await c.post(
                f"/iq/board/{board['id']}/lock",
                json={"device_id": device, "q_id": q["q_id"], "pick": "home"},
            )
        r = await c.post(f"/iq/board/{board['id']}/resolve?device_id={device}")
        assert r.status_code == 200
        data = r.json()
        assert data["resolved"] == len(board["questions"])
        b = data["board"]
        assert b["progress"]["graded"] == len(board["questions"])
        # Every question must now have an outcome
        for q in b["questions"]:
            assert q["outcome"] is not None
            assert q["outcome"]["status"] in ("correct", "incorrect")
            assert isinstance(q["outcome"]["correct"], bool)


@pytest.mark.asyncio
async def test_user_prefs_default_visibility():
    async with httpx.AsyncClient(base_url=BASE, timeout=15) as c:
        device = _did("prefs")
        r = await c.patch(
            "/iq/user/prefs",
            json={"device_id": device, "default_visibility": "public"},
        )
        assert r.status_code == 200
        user = r.json()
        assert user["prefs"]["default_visibility"] == "public"

        # Bad value rejected
        r2 = await c.patch(
            "/iq/user/prefs",
            json={"device_id": device, "default_visibility": "everyone"},
        )
        assert r2.status_code == 400
