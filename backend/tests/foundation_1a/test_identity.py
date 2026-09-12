import pytest
from concurrent.futures import ThreadPoolExecutor
from intelligence.identity import (
    mint_team_id, mint_player_id, mint_game_id,
    is_valid_team_id, is_valid_player_id, is_valid_game_id,
)


def test_ticker_ids_are_ulid_prefixed():
    for _ in range(20):
        assert is_valid_team_id(mint_team_id())
        assert is_valid_player_id(mint_player_id())
        assert is_valid_game_id(mint_game_id())


def test_rejects_bad_shapes():
    assert not is_valid_team_id("tt_short")
    assert not is_valid_team_id("tp_" + "A" * 26)   # wrong prefix
    assert not is_valid_game_id(None)
    assert not is_valid_player_id("tp_" + "I" * 26)  # I not in Crockford


def test_ulid_uniqueness_under_concurrency():
    with ThreadPoolExecutor(max_workers=16) as ex:
        ids = list(ex.map(lambda _: mint_game_id(), range(1000)))
    assert len(set(ids)) == 1000
