"""Ticker canonical identity — ULID-based, prefixed, permanent."""
import re
from ulid import ULID

_TEAM_RE   = re.compile(r"^tt_[0-9A-HJKMNP-TV-Z]{26}$")
_PLAYER_RE = re.compile(r"^tp_[0-9A-HJKMNP-TV-Z]{26}$")
_GAME_RE   = re.compile(r"^tg_[0-9A-HJKMNP-TV-Z]{26}$")


def mint_team_id() -> str:   return f"tt_{ULID()}"
def mint_player_id() -> str: return f"tp_{ULID()}"
def mint_game_id() -> str:   return f"tg_{ULID()}"


def is_valid_team_id(x: str) -> bool:   return isinstance(x, str) and bool(_TEAM_RE.match(x))
def is_valid_player_id(x: str) -> bool: return isinstance(x, str) and bool(_PLAYER_RE.match(x))
def is_valid_game_id(x: str) -> bool:   return isinstance(x, str) and bool(_GAME_RE.match(x))
