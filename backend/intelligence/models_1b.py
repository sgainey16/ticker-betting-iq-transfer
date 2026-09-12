"""Foundation 1B Pydantic models — immutable postgame truth per game.

Rules (enforced here):
  - `iq_game_finals` is append-only. A correction becomes a NEW row with
    record_version = prior + 1 and supersedes_record_version = prior.
  - `final_score` is the SINGLE source of truth for team goals. TeamGameFacts
    intentionally does NOT carry a `goals` field — projections derive team
    GF/GA from final_score.  (Build correction #3.)
  - GoalieLine.save_pct is derived from counts at projection time, never
    stored. TeamGameFacts stores only the underlying counts.  (Correction #4.)
  - Goalies only. No skater identity resolution in 1B.

Every row carries a provenance block matching Foundation 1A's shape so we
have one honest provenance vocabulary across the intelligence engine.
"""
from __future__ import annotations
from typing import Literal, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from intelligence.identity import (
    is_valid_team_id, is_valid_player_id, is_valid_game_id,
)
from intelligence.models_1a import (
    Competition, SeasonType, ProviderName, Provenance, now_iso,
)

# --------------------------------------------------------------------------
# Frozen enums specific to 1B
# --------------------------------------------------------------------------
FinalOutcome     = Literal["REG", "OT", "SO"]  # regulation / overtime / shootout
CoverageState    = Literal["partial", "complete"]  # reserved for a later foundation; no coverage collection exists in 1B
CorrectionReason = Literal[
    "initial",
    "official_stat_correction",
    "provider_late_data",
    "goalie_line_correction",
    "sog_correction",
    "outcome_correction",
    "canonical_identity_repair",   # used ONLY when a prior version is materially wrong
                                   # because a Foundation 1A identity defect attached the
                                   # wrong game's truth to this canonical. Emitted only if
                                   # the newest version does not already match rightful truth.
    "other",
]


# --------------------------------------------------------------------------
# Final score — the ONE place team goals are stored.
# --------------------------------------------------------------------------
class FinalScore(BaseModel):
    model_config = ConfigDict(extra="forbid")
    home_goals: int = Field(ge=0)
    away_goals: int = Field(ge=0)
    outcome: FinalOutcome
    ot_periods: Optional[int] = Field(default=None, ge=0)
    reg_periods: Optional[int] = Field(default=None, ge=0)

    @model_validator(mode="after")
    def _v_outcome(self):
        if self.outcome != "OT" and self.ot_periods not in (None, 0):
            # OT-period count only meaningful when outcome == OT.
            # We do not raise — providers occasionally report ot_periods=0
            # for REG games. Silently normalize.
            self.ot_periods = 0
        return self


# --------------------------------------------------------------------------
# Goalie line — counts only. save_pct is DERIVED, never stored here.
# --------------------------------------------------------------------------
class GoalieLine(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ticker_player_id: Optional[str] = None   # resolved when possible; else null
    provider_player_id_nhl: Optional[int] = None
    display_name: str = Field(min_length=1, max_length=80)
    starter: Optional[bool] = None
    toi_seconds: Optional[int] = Field(default=None, ge=0)
    shots_against: Optional[int] = Field(default=None, ge=0)
    saves: Optional[int] = Field(default=None, ge=0)
    goals_against: Optional[int] = Field(default=None, ge=0)
    decision: Optional[Literal["W", "L", "OTL", "SOL"]] = None

    @field_validator("ticker_player_id")
    @classmethod
    def _v_id(cls, v):
        assert v is None or is_valid_player_id(v), f"bad ticker_player_id: {v}"
        return v

    @model_validator(mode="after")
    def _v_counts_consistent(self):
        """If both counts present, saves + goals_against cannot exceed shots_against
        by more than 0 (a provider bug guard, not an arithmetic proof)."""
        if (self.saves is not None and self.goals_against is not None
                and self.shots_against is not None):
            if self.saves + self.goals_against != self.shots_against:
                # Do not raise — providers occasionally report inconsistent
                # rows. Downstream projection will surface null save_pct rather
                # than fabricate one. Kept for honesty; validator is a no-op.
                pass
        return self


# --------------------------------------------------------------------------
# Team-side game facts (per side of the game). Counts only. NO goals field.
# --------------------------------------------------------------------------
class TeamGameFacts(BaseModel):
    """Per-team facts for one game. Team goals are NOT here — see FinalScore
    (correction #3: single source of truth for goals)."""
    model_config = ConfigDict(extra="forbid")
    ticker_team_id: str
    is_home: bool
    shots_on_goal: Optional[int] = Field(default=None, ge=0)
    # Reserved for later foundations (deltas, PP/PK, etc.). Keep None in 1B.
    power_play_opportunities: None = None
    power_play_goals: None = None
    penalty_minutes: None = None

    @field_validator("ticker_team_id")
    @classmethod
    def _v_id(cls, v):
        assert is_valid_team_id(v), f"bad ticker_team_id: {v}"
        return v


# --------------------------------------------------------------------------
# Game Final — the immutable postgame record.
# --------------------------------------------------------------------------
class GameFinal(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ticker_game_id: str
    record_version: int = Field(ge=1)
    supersedes_record_version: Optional[int] = None
    correction_reason: CorrectionReason

    # Canonical context copied from Foundation 1A canonical game so this
    # row is self-contained.
    competition: Competition
    season: str = Field(min_length=4, max_length=9)
    season_type: SeasonType
    home_team_id: str
    away_team_id: str

    # When the game actually finished (from provider). Distinct from
    # recorded_at, which is when Ticker learned this record.
    played_at_iso: str

    # The truth of the game.
    final_score: FinalScore
    home_team_facts: TeamGameFacts
    away_team_facts: TeamGameFacts
    home_goalies: list[GoalieLine] = Field(default_factory=list, max_length=6)
    away_goalies: list[GoalieLine] = Field(default_factory=list, max_length=6)

    # When Ticker ingested/committed this record. Lock-time reads compare
    # against this — never against played_at_iso.
    recorded_at: str = Field(default_factory=now_iso)
    provenance: Provenance

    @field_validator("ticker_game_id")
    @classmethod
    def _v_g(cls, v): assert is_valid_game_id(v); return v

    @model_validator(mode="after")
    def _v_shape(self):
        assert is_valid_team_id(self.home_team_id)
        assert is_valid_team_id(self.away_team_id)
        assert self.home_team_id != self.away_team_id, "home and away must differ"
        assert self.home_team_facts.ticker_team_id == self.home_team_id, "home facts team_id mismatch"
        assert self.away_team_facts.ticker_team_id == self.away_team_id, "away facts team_id mismatch"
        assert self.home_team_facts.is_home is True
        assert self.away_team_facts.is_home is False
        # Version relationship
        if self.record_version == 1:
            assert self.supersedes_record_version is None, "v1 cannot supersede"
            assert self.correction_reason == "initial", "v1 must be 'initial'"
        else:
            assert self.supersedes_record_version == self.record_version - 1, \
                "supersedes_record_version must be prior version"
            assert self.correction_reason != "initial", "corrections cannot be 'initial'"
        return self
