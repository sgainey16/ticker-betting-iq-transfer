"""Backend regression tests for stats/ticker endpoints (Sportradar fallback path)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sports-broadcast-21.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    return s


def test_stats_players(client):
    r = client.get(f"{BASE_URL}/api/stats/players", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "players" in data and isinstance(data["players"], list)
    assert len(data["players"]) >= 5
    assert "source" in data
    ids = {p["id"] for p in data["players"]}
    assert "mcdavid" in ids and "hellebuyck" in ids


def test_stats_teams(client):
    r = client.get(f"{BASE_URL}/api/stats/teams", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "teams" in data and isinstance(data["teams"], list)
    assert len(data["teams"]) >= 5
    assert "source" in data


def test_nhl_games(client):
    r = client.get(f"{BASE_URL}/api/nhl/games", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "games" in data
    assert "source" in data


def test_nhl_standings(client):
    r = client.get(f"{BASE_URL}/api/nhl/standings", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "teams" in data
    assert "source" in data


def test_ticker(client):
    r = client.get(f"{BASE_URL}/api/ticker", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    assert "source" in data


def test_roster_post(client):
    payload = {
        "device_id": "TEST_pytest_device",
        "league_name": "TEST_League",
        "scoring": "Points",
        "roster": [{"name": "Connor McDavid", "team": "EDM", "pos": "C"}],
        "favorite_teams": ["EDM"],
        "notes": "",
    }
    r = client.post(f"{BASE_URL}/api/subscription/roster", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    # GET to verify persistence
    r2 = client.get(f"{BASE_URL}/api/subscription/roster?device_id=TEST_pytest_device", timeout=15)
    assert r2.status_code == 200
    body = r2.json()
    assert body.get("league_name") == "TEST_League"
    assert body.get("roster") and body["roster"][0]["name"] == "Connor McDavid"
