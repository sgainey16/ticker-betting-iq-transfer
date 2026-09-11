"""Unit tests for the DEV bulk CSV parser.

Fast, no I/O. Run with: cd /app/backend && python -m pytest tests/test_bet_csv_parser.py -v
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from bet_csv_parser import parse_csv, REQUIRED_COLUMNS


HEADER = ",".join(REQUIRED_COLUMNS)


def _paste(*rows: str) -> str:
    return HEADER + "\n" + "\n".join(rows)


def test_empty_paste():
    r = parse_csv("")
    assert r["summary"]["header_error"] == "empty paste — nothing to import"
    assert r["valid_rows"] == []


def test_missing_header():
    r = parse_csv("2025-01-14,BOS @ NJD,moneyline,away,fav,win,100,74\n")
    assert "header must be exactly" in r["summary"]["header_error"]


def test_wrong_header_order():
    r = parse_csv("matchup,date,bet_type,home_or_away,fav_or_dog,result,stake,profit_loss\nBOS @ NJD,2025-01-14,moneyline,away,fav,win,100,74\n")
    assert "header must be exactly" in r["summary"]["header_error"]


def test_happy_path_moneyline():
    csv = _paste("2025-01-14,BOS @ NJD,moneyline,away,fav,win,100,74")
    r = parse_csv(csv)
    assert r["summary"]["header_error"] is None
    assert r["summary"]["valid_count"] == 1
    assert r["summary"]["rejected_count"] == 0
    bet = r["valid_rows"][0]
    assert bet["bet_type"] == "moneyline"
    assert bet["home_or_away"] == "away"
    assert bet["fav_or_dog"] == "fav"
    assert bet["result"] == "win"
    assert bet["stake"] == 100.0
    assert bet["profit_loss"] == 74.0
    assert bet["prediction_only"] is False


def test_synonyms_normalized():
    csv = _paste(
        "2025-01-14,BOS @ NJD,ML,Road,favourite,W,$100.00,+74",
        "2025-01-15,TOR @ OTT,puck-line,Home,dog,lost,50,-50",
        "2025-01-16,EDM @ CGY,OU,,over,push,25,0",
        "2025-01-17,MTL vs BOS,player prop,,,pending,20,0",
    )
    r = parse_csv(csv)
    assert r["summary"]["rejected_count"] == 0, r["rejected_rows"]
    b1, b2, b3, b4 = r["valid_rows"]
    assert b1["bet_type"] == "moneyline"
    assert b1["home_or_away"] == "away"
    assert b1["fav_or_dog"] == "fav"
    assert b1["result"] == "win"
    assert b1["stake"] == 100.0
    assert b2["bet_type"] == "spread" and b2["fav_or_dog"] == "dog"
    assert b3["bet_type"] == "total" and b3["fav_or_dog"] == "over" and b3["home_or_away"] is None
    assert b4["bet_type"] == "prop" and b4["home_or_away"] is None and b4["fav_or_dog"] is None


def test_reject_missing_home_away_for_moneyline():
    r = parse_csv(_paste("2025-01-14,BOS @ NJD,moneyline,,fav,win,100,74"))
    assert r["summary"]["rejected_count"] == 1
    assert any("home_or_away is required" in e for e in r["rejected_rows"][0]["errors"])


def test_reject_missing_fav_dog_for_moneyline():
    r = parse_csv(_paste("2025-01-14,BOS @ NJD,moneyline,away,,win,100,74"))
    assert r["summary"]["rejected_count"] == 1
    assert any("fav_or_dog is required" in e for e in r["rejected_rows"][0]["errors"])


def test_reject_wrong_fav_dog_for_bet_type():
    # over on a moneyline
    r = parse_csv(_paste("2025-01-14,BOS @ NJD,moneyline,away,over,win,100,74"))
    assert r["summary"]["rejected_count"] == 1
    # fav on a total
    r2 = parse_csv(_paste("2025-01-14,BOS @ NJD,total,,fav,win,100,74"))
    assert r2["summary"]["rejected_count"] == 1


def test_reject_home_away_on_total():
    r = parse_csv(_paste("2025-01-14,BOS @ NJD,total,home,over,win,100,74"))
    assert r["summary"]["rejected_count"] == 1
    assert any("home_or_away must be blank for total bets" in e for e in r["rejected_rows"][0]["errors"])


def test_reject_home_away_on_prop():
    r = parse_csv(_paste("2025-01-14,BOS @ NJD,prop,home,,win,50,45"))
    assert r["summary"]["rejected_count"] == 1


def test_reject_sign_mismatch_win_negative():
    r = parse_csv(_paste("2025-01-14,BOS @ NJD,moneyline,away,fav,win,100,-100"))
    assert r["summary"]["rejected_count"] == 1
    assert any("sign looks wrong" in e for e in r["rejected_rows"][0]["errors"])


def test_reject_sign_mismatch_loss_positive():
    r = parse_csv(_paste("2025-01-14,BOS @ NJD,moneyline,away,fav,loss,100,100"))
    assert r["summary"]["rejected_count"] == 1


def test_reject_push_nonzero_pl():
    r = parse_csv(_paste("2025-01-14,BOS @ NJD,moneyline,away,fav,push,100,50"))
    assert r["summary"]["rejected_count"] == 1
    assert any("profit_loss should be 0 for a push" in e for e in r["rejected_rows"][0]["errors"])


def test_reject_negative_stake():
    r = parse_csv(_paste("2025-01-14,BOS @ NJD,moneyline,away,fav,win,-100,74"))
    assert r["summary"]["rejected_count"] == 1


def test_reject_invalid_result():
    r = parse_csv(_paste("2025-01-14,BOS @ NJD,moneyline,away,fav,maybe,100,74"))
    assert r["summary"]["rejected_count"] == 1


def test_reject_bad_date_format():
    r = parse_csv(_paste("01/14/2025,BOS @ NJD,moneyline,away,fav,win,100,74"))
    assert r["summary"]["rejected_count"] == 1
    assert any("YYYY-MM-DD" in e for e in r["rejected_rows"][0]["errors"])


def test_missing_date_ok_and_backfilled_at_commit():
    # Parser allows missing date; commit endpoint is responsible for backfill.
    r = parse_csv(_paste(",BOS @ NJD,moneyline,away,fav,win,100,74"))
    assert r["summary"]["rejected_count"] == 0
    assert r["valid_rows"][0]["bet_date"] is None


def test_prediction_only_when_stake_zero():
    r = parse_csv(_paste("2025-01-14,BOS @ NJD,moneyline,away,fav,win,0,0"))
    assert r["summary"]["rejected_count"] == 0
    assert r["valid_rows"][0]["prediction_only"] is True


def test_pending_bet_pl_optional():
    r = parse_csv(_paste("2025-01-14,BOS @ NJD,moneyline,away,fav,pending,100,"))
    assert r["summary"]["rejected_count"] == 0
    assert r["valid_rows"][0]["result"] == "pending"
    assert r["valid_rows"][0]["profit_loss"] == 0.0


def test_resolved_money_bet_missing_pl_rejected():
    r = parse_csv(_paste("2025-01-14,BOS @ NJD,moneyline,away,fav,win,100,"))
    assert r["summary"]["rejected_count"] == 1
    assert any("profit_loss is required" in e for e in r["rejected_rows"][0]["errors"])


def test_summary_totals():
    r = parse_csv(_paste(
        "2025-01-14,BOS @ NJD,moneyline,away,fav,win,100,74",
        "2025-01-15,TOR @ OTT,moneyline,home,dog,loss,100,-100",
        "2025-01-16,EDM @ CGY,total,,over,win,50,45",
    ))
    assert r["summary"]["valid_count"] == 3
    assert r["summary"]["total_stake"] == 250.0
    assert r["summary"]["total_profit_loss"] == 19.0
    assert r["summary"]["by_bet_type"] == {"moneyline": 2, "total": 1}


def test_mixed_valid_and_rejected_no_partial_write_at_parser_level():
    """Parser reports both; commit endpoint decides what to write."""
    csv = _paste(
        "2025-01-14,BOS @ NJD,moneyline,away,fav,win,100,74",   # valid
        "2025-01-15,TOR @ OTT,moneyline,,fav,loss,100,-100",    # invalid — missing home_or_away
        "2025-01-16,EDM @ CGY,total,,over,win,50,45",           # valid
    )
    r = parse_csv(csv)
    assert r["summary"]["valid_count"] == 2
    assert r["summary"]["rejected_count"] == 1
    # Rejected row surfaces the original line + line_no
    rej = r["rejected_rows"][0]
    assert rej["line_no"] == 3  # header is line 1, first data row line 2
    assert "TOR @ OTT" in rej["raw"]
    # Summary only reflects valid rows
    assert r["summary"]["total_stake"] == 150.0
    assert r["summary"]["total_profit_loss"] == 119.0


def test_blank_lines_ignored():
    csv = _paste(
        "2025-01-14,BOS @ NJD,moneyline,away,fav,win,100,74",
        "",
        "2025-01-16,EDM @ CGY,total,,over,win,50,45",
    )
    r = parse_csv(csv)
    assert r["summary"]["valid_count"] == 2
    assert r["summary"]["rejected_count"] == 0
