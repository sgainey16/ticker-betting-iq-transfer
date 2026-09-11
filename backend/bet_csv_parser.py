"""DEV CSV parser for bulk bet import — Betting IQ experiment ingestion.

Not a general sportsbook parser. Explicitly the 8-column schema Spot Check
needs, nothing more. See /app/memory/BETTING_IQ_INPUT_AUDIT.md §6.

Schema (header row required, case-insensitive):
    date, matchup, bet_type, home_or_away, fav_or_dog, result, stake, profit_loss

Contract of parse_csv():
    {
      "valid_rows": [normalized_bet_dict, ...],
      "rejected_rows": [{"line_no": int, "raw": str, "errors": [str,...]}, ...],
      "summary": {
        "total_data_lines": int,
        "valid_count": int,
        "rejected_count": int,
        "total_stake": float,           # valid rows only
        "total_profit_loss": float,     # valid rows only
        "by_bet_type": {bet_type: count, ...},   # valid rows only
      }
    }

Pure function. No DB, no logging, no side-effects — commit is a separate step.

Design rules (from user directive):
  - No auto-derivation of home/away or fav/dog. Blank required-fields = reject
    with a clear error message. Wrong classification is worse than none.
  - No partial silent imports. This layer just decides valid/rejected; the
    commit endpoint is what writes, and it re-parses the same csv_text so
    preview and commit can never diverge.
  - Every rejection carries the original line so the tester can find + fix.
"""

from __future__ import annotations

import csv
import io
import re
from typing import Any

# Canonical schema (order matters for header validation)
REQUIRED_COLUMNS = [
    "date", "matchup", "bet_type", "home_or_away",
    "fav_or_dog", "result", "stake", "profit_loss",
]

# --- Normalization tables ---------------------------------------------------
_BET_TYPE_SYNONYMS = {
    "moneyline": "moneyline", "ml": "moneyline", "money line": "moneyline",
    "spread": "spread", "puckline": "spread", "puck-line": "spread",
    "puck line": "spread", "pl": "spread",
    "total": "total", "totals": "total", "ou": "total",
    "over/under": "total", "over-under": "total", "over under": "total",
    "prop": "prop", "player prop": "prop", "player-prop": "prop",
    "playerprop": "prop",
}

_HOME_AWAY_SYNONYMS = {
    "home": "home", "h": "home",
    "away": "away", "road": "away", "a": "away", "r": "away",
}

# Note: 'fav'/'dog' apply to moneyline+spread. 'over'/'under' apply to totals.
_FAV_DOG_SYNONYMS = {
    "fav": "fav", "favourite": "fav", "favorite": "fav", "f": "fav",
    "dog": "dog", "underdog": "dog", "ud": "dog", "d": "dog",
    "over": "over", "o": "over",
    "under": "under", "u": "under",
}

_RESULT_SYNONYMS = {
    "win": "win", "w": "win", "won": "win",
    "loss": "loss", "lose": "loss", "l": "loss", "lost": "loss",
    "push": "push", "p": "push", "tie": "push",
    "pending": "pending", "open": "pending", "pend": "pending",
}

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _norm_bet_type(raw: str) -> str | None:
    if raw is None:
        return None
    return _BET_TYPE_SYNONYMS.get(raw.strip().lower())


def _norm_home_away(raw: str) -> str | None:
    if raw is None or raw.strip() == "":
        return None
    return _HOME_AWAY_SYNONYMS.get(raw.strip().lower(), "__INVALID__")


def _norm_fav_dog(raw: str) -> str | None:
    if raw is None or raw.strip() == "":
        return None
    return _FAV_DOG_SYNONYMS.get(raw.strip().lower(), "__INVALID__")


def _norm_result(raw: str) -> str | None:
    if raw is None:
        return None
    return _RESULT_SYNONYMS.get(raw.strip().lower())


def _parse_number(raw: str) -> tuple[float | None, str | None]:
    """Return (value, error_msg). Empty/whitespace → (None, None)."""
    if raw is None or str(raw).strip() == "":
        return None, None
    s = str(raw).strip().replace("$", "").replace(",", "")
    try:
        return float(s), None
    except ValueError:
        return None, f"could not parse number: {raw!r}"


# --- Header validation -----------------------------------------------------
def _validate_header(fieldnames: list[str]) -> list[str]:
    """Return list of header errors. Empty list means header is OK."""
    errors: list[str] = []
    if not fieldnames:
        return ["missing header row — first line must be the column headers"]
    seen = [f.strip().lower() for f in fieldnames]
    if seen != REQUIRED_COLUMNS:
        errors.append(
            "header must be exactly (in order): "
            + ", ".join(REQUIRED_COLUMNS)
            + f". Got: {', '.join(seen)}"
        )
    return errors


# --- Row validation --------------------------------------------------------
def _validate_row(row: dict[str, str], line_no: int) -> tuple[dict | None, list[str]]:
    """Validate one CSV row. Returns (normalized_bet_or_None, errors)."""
    errors: list[str] = []

    # -- date (optional) --
    date_raw = (row.get("date") or "").strip()
    if date_raw and not _DATE_RE.match(date_raw):
        errors.append(f"date must be YYYY-MM-DD (got {date_raw!r})")

    # -- matchup (required, free text) --
    matchup = (row.get("matchup") or "").strip()
    if not matchup:
        errors.append("matchup is required (e.g. 'BOS @ NJD')")

    # -- bet_type (required, must normalize) --
    bet_type_raw = (row.get("bet_type") or "").strip()
    bet_type = _norm_bet_type(bet_type_raw)
    if not bet_type:
        errors.append(
            f"bet_type invalid ({bet_type_raw!r}). Must be one of: moneyline, spread, total, prop"
        )

    # -- home_or_away — validity depends on bet_type --
    ha_raw = (row.get("home_or_away") or "").strip()
    home_or_away = _norm_home_away(ha_raw)
    if home_or_away == "__INVALID__":
        errors.append(f"home_or_away invalid ({ha_raw!r}). Must be home/away or blank.")
        home_or_away = None

    # -- fav_or_dog — validity depends on bet_type --
    fd_raw = (row.get("fav_or_dog") or "").strip()
    fav_or_dog = _norm_fav_dog(fd_raw)
    if fav_or_dog == "__INVALID__":
        errors.append(f"fav_or_dog invalid ({fd_raw!r}). Must be fav/dog/over/under or blank.")
        fav_or_dog = None

    # Cross-field consistency (only if bet_type is valid)
    if bet_type == "moneyline" or bet_type == "spread":
        if home_or_away is None:
            errors.append(f"home_or_away is required for {bet_type} bets (home or away).")
        if fav_or_dog is None:
            errors.append(f"fav_or_dog is required for {bet_type} bets (fav or dog).")
        elif fav_or_dog in ("over", "under"):
            errors.append(
                f"fav_or_dog must be fav or dog for {bet_type} bets (got {fav_or_dog!r})."
            )
    elif bet_type == "total":
        if fav_or_dog is None:
            errors.append("fav_or_dog is required for total bets (over or under).")
        elif fav_or_dog in ("fav", "dog"):
            errors.append(
                f"fav_or_dog must be over or under for total bets (got {fav_or_dog!r})."
            )
        if home_or_away is not None:
            errors.append(
                "home_or_away must be blank for total bets — totals aren't a home/road spot."
            )
    elif bet_type == "prop":
        # Spot Check doesn't bucket props by home/away or fav/dog. Blanks required
        # so the tester doesn't accidentally classify a prop as a moneyline spot.
        if home_or_away is not None:
            errors.append("home_or_away must be blank for prop bets.")
        if fav_or_dog is not None:
            errors.append("fav_or_dog must be blank for prop bets.")

    # -- result (required) --
    result_raw = (row.get("result") or "").strip()
    result = _norm_result(result_raw)
    if not result:
        errors.append(
            f"result invalid ({result_raw!r}). Must be win, loss, push, or pending."
        )

    # -- stake (required, ≥ 0) --
    stake_val, stake_err = _parse_number(row.get("stake") or "")
    if stake_err:
        errors.append(f"stake: {stake_err}")
    elif stake_val is None:
        errors.append("stake is required (use 0 for prediction-only bets).")
    elif stake_val < 0:
        errors.append(f"stake must be ≥ 0 (got {stake_val}).")

    # -- profit_loss (required if stake > 0 and result is not pending) --
    pl_val, pl_err = _parse_number(row.get("profit_loss") or "")
    if pl_err:
        errors.append(f"profit_loss: {pl_err}")
    elif pl_val is None:
        # Missing P/L is fine if pending or prediction-only (stake == 0)
        if result and result in ("win", "loss", "push") and stake_val and stake_val > 0:
            errors.append(
                "profit_loss is required for resolved money bets "
                "(win/loss/push with stake > 0). Use signed value — negative for losses."
            )
        pl_val = 0.0
    else:
        # Sanity check sign vs. result — warn but don't reject.
        # (This is a "did you mean it" nudge, not enforcement.)
        if result == "loss" and pl_val > 0:
            errors.append(
                f"profit_loss is positive ({pl_val}) but result is 'loss' — did you forget the minus sign?"
            )
        if result == "win" and pl_val < 0:
            errors.append(
                f"profit_loss is negative ({pl_val}) but result is 'win' — sign looks wrong."
            )
        if result == "push" and pl_val != 0:
            errors.append(
                f"profit_loss should be 0 for a push (got {pl_val})."
            )

    if errors:
        return None, errors

    # prediction_only = stake was explicitly 0
    prediction_only = (stake_val == 0)

    return {
        "bet_date": date_raw or None,     # commit-time backfill if None
        "matchup": matchup,
        "bet_type": bet_type,
        "selection": "",                   # not captured in CSV; UI-only field
        "odds": "",                        # not captured in CSV; UI-only field
        "stake": float(stake_val or 0.0),
        "prediction_only": prediction_only,
        "result": result,
        "profit_loss": float(pl_val or 0.0),
        "notes": "",
        "home_or_away": home_or_away,
        "fav_or_dog": fav_or_dog,
    }, []


# --- Public parser ---------------------------------------------------------
def parse_csv(csv_text: str) -> dict[str, Any]:
    """Parse and validate a paste. See module docstring for contract."""
    if not csv_text or not csv_text.strip():
        return {
            "valid_rows": [],
            "rejected_rows": [],
            "summary": {
                "total_data_lines": 0,
                "valid_count": 0,
                "rejected_count": 0,
                "total_stake": 0.0,
                "total_profit_loss": 0.0,
                "by_bet_type": {},
                "header_error": "empty paste — nothing to import",
            },
        }

    # Split into raw lines up-front so we can echo them back in errors.
    raw_lines = csv_text.splitlines()

    reader = csv.DictReader(io.StringIO(csv_text))
    header_errors = _validate_header(reader.fieldnames or [])
    if header_errors:
        return {
            "valid_rows": [],
            "rejected_rows": [],
            "summary": {
                "total_data_lines": 0,
                "valid_count": 0,
                "rejected_count": 0,
                "total_stake": 0.0,
                "total_profit_loss": 0.0,
                "by_bet_type": {},
                "header_error": "; ".join(header_errors),
            },
        }

    valid_rows: list[dict] = []
    rejected_rows: list[dict] = []
    total_data_lines = 0

    for i, row in enumerate(reader):
        line_no = i + 2  # +1 for header, +1 to be human-1-indexed
        # Ignore fully-empty rows (someone left a blank line in the CSV)
        if not any((v or "").strip() for v in row.values()):
            continue
        total_data_lines += 1

        normalized, errors = _validate_row(row, line_no)
        raw_line = raw_lines[line_no - 1] if line_no - 1 < len(raw_lines) else ""

        if normalized is None:
            rejected_rows.append({
                "line_no": line_no,
                "raw": raw_line,
                "errors": errors,
            })
        else:
            valid_rows.append(normalized)

    total_stake = round(sum(r["stake"] for r in valid_rows), 2)
    total_pl = round(sum(r["profit_loss"] for r in valid_rows), 2)
    by_bet_type: dict[str, int] = {}
    for r in valid_rows:
        by_bet_type[r["bet_type"]] = by_bet_type.get(r["bet_type"], 0) + 1

    return {
        "valid_rows": valid_rows,
        "rejected_rows": rejected_rows,
        "summary": {
            "total_data_lines": total_data_lines,
            "valid_count": len(valid_rows),
            "rejected_count": len(rejected_rows),
            "total_stake": total_stake,
            "total_profit_loss": total_pl,
            "by_bet_type": by_bet_type,
            "header_error": None,
        },
    }
