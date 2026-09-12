"""Foundation 1A Pydantic models.

Discipline:
  - Every write path validates via these models. Never bypass to raw dicts.
  - Reserved-slot fields on GameContextSnapshot must be literal None, not
    missing — enforced by model validators.
  - The two-field terminal state on the UserCall side lives in iq_core.py;
    this file only owns the four new collections.
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Any, Literal, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from intelligence.identity import is_valid_team_id, is_valid_player_id, is_valid_game_id

# --------------------------------------------------------------------------
# Frozen enums for Foundation 1A. Adding a value later needs an explicit
# migration; that discipline stops "NHL" from silently becoming "nhl" etc.
# --------------------------------------------------------------------------
Competition   = Literal["NHL"]
SeasonType    = Literal["PRE", "REG", "POST"]
GameStatus    = Literal["scheduled", "postponed", "cancelled",
                        "in_progress", "final", "final_ot", "final_so"]
SnapshotKind  = Literal["schedule_release", "t_minus_24h", "t_minus_60"]
ProviderName  = Literal["sportradar", "highlightly", "nhl_public", "sportsdata_io"]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


# --------------------------------------------------------------------------
# Provenance
# --------------------------------------------------------------------------
class SourceRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: ProviderName
    endpoint: str = Field(min_length=1, max_length=200)
    fetched_at: str
    http_status: int = Field(ge=100, le=599)
    cache_hit: bool
    fields_populated: list[str] = Field(default_factory=list, max_length=64)


class Provenance(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sources_consulted: list[SourceRecord] = Field(default_factory=list)
    written_at: str = Field(default_factory=now_iso)
    engine_version: str = Field(pattern=r"^\d+\.\d+\.\d+$")


# --------------------------------------------------------------------------
# Venue
# --------------------------------------------------------------------------
class Venue(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=120)
    city: str = Field(min_length=1, max_length=80)
    timezone: str = Field(min_length=1, max_length=64)


# --------------------------------------------------------------------------
# Team
# --------------------------------------------------------------------------
class ProviderIdsTeam(BaseModel):
    model_config = ConfigDict(extra="forbid")
    class _SR(BaseModel):
        model_config = ConfigDict(extra="forbid")
        id: Optional[str] = None
        alias: Optional[str] = None
    class _HL(BaseModel):
        model_config = ConfigDict(extra="forbid")
        id: Optional[int] = None
        abbreviation: Optional[str] = None
    class _NHL(BaseModel):
        model_config = ConfigDict(extra="forbid")
        tri_code: Optional[str] = None
    class _SDIO(BaseModel):
        model_config = ConfigDict(extra="forbid")
        key: Optional[str] = None
        team_id: Optional[int] = None
    class _EP(BaseModel):
        model_config = ConfigDict(extra="forbid")
        id: Optional[str] = None
    class _HT(BaseModel):
        model_config = ConfigDict(extra="forbid")
        id: Optional[str] = None
    sportradar:      _SR   = Field(default_factory=lambda: ProviderIdsTeam._SR())
    highlightly:     _HL   = Field(default_factory=lambda: ProviderIdsTeam._HL())
    nhl_public:      _NHL  = Field(default_factory=lambda: ProviderIdsTeam._NHL())
    sportsdata_io:   _SDIO = Field(default_factory=lambda: ProviderIdsTeam._SDIO())
    elite_prospects: _EP   = Field(default_factory=lambda: ProviderIdsTeam._EP())
    hockeytech:      _HT   = Field(default_factory=lambda: ProviderIdsTeam._HT())


class CanonicalTeam(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ticker_team_id: str
    competition: Competition
    canonical_code: str = Field(min_length=2, max_length=5)
    display_name: str = Field(min_length=1, max_length=60)
    market: str = Field(min_length=1, max_length=60)
    provider_ids: ProviderIdsTeam = Field(default_factory=ProviderIdsTeam)
    active: bool = True
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)
    provenance: Provenance

    @field_validator("ticker_team_id")
    @classmethod
    def _v_id(cls, v): assert is_valid_team_id(v), f"bad ticker_team_id: {v}"; return v

    @field_validator("canonical_code")
    @classmethod
    def _v_code(cls, v): return v.upper()


# --------------------------------------------------------------------------
# Player (empty collection in 1A, model still defined so indexes/tests pass)
# --------------------------------------------------------------------------
class ProviderIdsPlayer(BaseModel):
    model_config = ConfigDict(extra="forbid")
    class _SR(BaseModel):
        model_config = ConfigDict(extra="forbid")
        id: Optional[str] = None
    class _NHL(BaseModel):
        model_config = ConfigDict(extra="forbid")
        player_id: Optional[int] = None
    class _SDIO(BaseModel):
        model_config = ConfigDict(extra="forbid")
        player_id: Optional[int] = None
    class _HL(BaseModel):
        model_config = ConfigDict(extra="forbid")
        id: Optional[int] = None
    class _EP(BaseModel):
        model_config = ConfigDict(extra="forbid")
        id: Optional[str] = None
    sportradar:      _SR   = Field(default_factory=lambda: ProviderIdsPlayer._SR())
    nhl_public:      _NHL  = Field(default_factory=lambda: ProviderIdsPlayer._NHL())
    sportsdata_io:   _SDIO = Field(default_factory=lambda: ProviderIdsPlayer._SDIO())
    highlightly:     _HL   = Field(default_factory=lambda: ProviderIdsPlayer._HL())
    elite_prospects: _EP   = Field(default_factory=lambda: ProviderIdsPlayer._EP())


class CanonicalPlayer(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ticker_player_id: str
    canonical_name: str = Field(min_length=1, max_length=80)
    dob: Optional[str] = None
    handedness: Optional[Literal["L", "R"]] = None
    primary_position: Optional[Literal["F", "D", "G"]] = None
    current_team_id: Optional[str] = None
    provider_ids: ProviderIdsPlayer = Field(default_factory=ProviderIdsPlayer)
    active: bool = True
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)
    provenance: Provenance

    @field_validator("ticker_player_id")
    @classmethod
    def _v_id(cls, v): assert is_valid_player_id(v); return v

    @field_validator("current_team_id")
    @classmethod
    def _v_team(cls, v): assert v is None or is_valid_team_id(v); return v


# --------------------------------------------------------------------------
# Canonical Game + current cache
# --------------------------------------------------------------------------
class ProviderIdSlot(BaseModel):
    """Uniform slot for a single provider's current ID + first/last seen."""
    model_config = ConfigDict(extra="forbid")
    id: Optional[Any] = None            # str or int depending on provider
    first_seen_at: Optional[str] = None
    last_seen_at: Optional[str] = None


class ProviderIdsGame(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sportradar:    ProviderIdSlot = Field(default_factory=ProviderIdSlot)
    highlightly:   ProviderIdSlot = Field(default_factory=ProviderIdSlot)
    nhl_public:    ProviderIdSlot = Field(default_factory=ProviderIdSlot)
    sportsdata_io: ProviderIdSlot = Field(default_factory=ProviderIdSlot)


class GameCurrent(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scheduled_iso: str
    status: GameStatus
    venue: Optional[Venue] = None
    schedule_revision: int = Field(ge=1)
    as_of: str


class CanonicalGame(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ticker_game_id: str
    competition: Competition
    season: str = Field(min_length=4, max_length=9)
    season_type: SeasonType
    home_team_id: str
    away_team_id: str
    current: GameCurrent
    provider_ids: ProviderIdsGame = Field(default_factory=ProviderIdsGame)
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)
    provenance: Provenance

    @field_validator("ticker_game_id")
    @classmethod
    def _v_id(cls, v): assert is_valid_game_id(v); return v

    @model_validator(mode="after")
    def _v_teams(self):
        assert is_valid_team_id(self.home_team_id)
        assert is_valid_team_id(self.away_team_id)
        assert self.home_team_id != self.away_team_id, "home and away must differ"
        return self


# --------------------------------------------------------------------------
# Schedule Revision (append-only, source of truth for scheduling)
# --------------------------------------------------------------------------
class ScheduleRevision(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ticker_game_id: str
    revision_number: int = Field(ge=1)
    supersedes_revision: Optional[int] = None
    scheduled_iso: str
    status: GameStatus
    venue: Optional[Venue] = None
    reason: Optional[str] = Field(default=None, min_length=1, max_length=200)
    provider_ids_at_revision: ProviderIdsGame = Field(default_factory=ProviderIdsGame)
    locked_at: str = Field(default_factory=now_iso)
    provenance: Provenance

    @field_validator("ticker_game_id")
    @classmethod
    def _v_id(cls, v): assert is_valid_game_id(v); return v

    @model_validator(mode="after")
    def _v_super(self):
        if self.revision_number == 1:
            assert self.supersedes_revision is None
        else:
            assert self.supersedes_revision == self.revision_number - 1
        return self


# --------------------------------------------------------------------------
# Game Context Snapshot (immutable pregame checkpoint)
# --------------------------------------------------------------------------
class TeamRecordEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")
    w: int = Field(ge=0)
    l: int = Field(ge=0)
    otl: int = Field(ge=0)
    pct: float = Field(ge=0.0, le=1.0)
    gf: Optional[int] = None
    ga: Optional[int] = None
    conf_rank: Optional[int] = None
    div_rank: Optional[int] = None
    source_name: ProviderName
    source_fetched_at: str


class TeamRecordsEntering(BaseModel):
    model_config = ConfigDict(extra="forbid")
    home: Optional[TeamRecordEntry] = None
    away: Optional[TeamRecordEntry] = None


class RestAndTravel(BaseModel):
    model_config = ConfigDict(extra="forbid")
    home_days_rest: Optional[int] = None
    away_days_rest: Optional[int] = None
    home_back_to_back: Optional[bool] = None
    away_back_to_back: Optional[bool] = None
    home_prior_consecutive_road_games: Optional[int] = None
    away_prior_consecutive_road_games: Optional[int] = None
    home_road_trip_game_number: None = None   # RESERVED — must stay null in 1A
    away_road_trip_game_number: None = None


class PlayoffContext(BaseModel):
    model_config = ConfigDict(extra="forbid")
    round: Optional[str] = None
    series_state: Optional[dict[str, int]] = None


class ReservedWorkload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    home_top6_avg_toi_last3: None = None
    away_top6_avg_toi_last3: None = None


class ReservedStarters(BaseModel):
    model_config = ConfigDict(extra="forbid")
    home_goalie: None = None
    away_goalie: None = None
    home_skater_lineup: None = None
    away_skater_lineup: None = None


class ReservedScratches(BaseModel):
    model_config = ConfigDict(extra="forbid")
    home: None = None
    away: None = None


class GameContextSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ticker_game_id: str
    snapshot_kind: SnapshotKind
    snapshot_version: int = Field(ge=1)
    supersedes_snapshot_id: Optional[str] = None
    scheduled_iso_at_snapshot: str
    schedule_revision_at_snapshot: int = Field(ge=1)
    status_at_snapshot: GameStatus
    competition: Competition
    season: str
    season_type: SeasonType
    home_team_id: str
    away_team_id: str
    venue: Optional[Venue] = None
    playoff_context: Optional[PlayoffContext] = None
    team_records_entering: TeamRecordsEntering = Field(default_factory=TeamRecordsEntering)
    rest_and_travel: RestAndTravel = Field(default_factory=RestAndTravel)
    recent_workload: ReservedWorkload = Field(default_factory=ReservedWorkload)
    starters: ReservedStarters = Field(default_factory=ReservedStarters)
    scratches: ReservedScratches = Field(default_factory=ReservedScratches)
    injuries_reported: None = None       # RESERVED — must stay null in 1A
    locked_at: str = Field(default_factory=now_iso)
    provenance: Provenance

    @field_validator("ticker_game_id")
    @classmethod
    def _v_id(cls, v): assert is_valid_game_id(v); return v
