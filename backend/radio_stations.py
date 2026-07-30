"""NHL team radio station lookup.

Each NHL team has a flagship AM/FM sports radio station that carries every
game live. Those stations publicly stream their over-the-air signal on
the web — TuneIn, iHeart, or the station's own site. We point users at
those public streams; we do not rebroadcast, cache, or transcode audio.

For each seed team we store:
- `name`     — the station's brand name (e.g. "98.5 The Sports Hub")
- `callsign` — call letters (e.g. "WBZ-FM")
- `city`     — city the station broadcasts from
- `stream_url` — a direct MP3/HLS URL if publicly hotlinkable. May be None.
- `tunein_id`  — TuneIn station ID for the iframe fallback (`s#####`).
                 TuneIn handles licensing and geo-restrictions for us.
- `notes`      — anything the frontend should surface (geo, off-season, etc.)

`stream_url` is preferred (direct, native <audio>). `tunein_id` is the
graceful fallback so obscure or hotlink-protected stations still play.
Adding a team = paste a new entry below. No code changes needed elsewhere.
"""

RADIO_STATIONS: dict[str, dict] = {
    "BOS": {
        "name": "98.5 The Sports Hub",
        "callsign": "WBZ-FM",
        "city": "Boston, MA",
        "stream_url": "https://playerservices.streamtheworld.com/api/livestream-redirect/WBZFMAAC.aac",
        "tunein_id": "s28589",
        "notes": "Bruins flagship. Live game calls during season.",
    },
    "TOR": {
        "name": "Sportsnet 590 The Fan",
        "callsign": "CJCL",
        "city": "Toronto, ON",
        "stream_url": None,  # Sportsnet feeds require their SDK
        "tunein_id": "s17692",
        "notes": "Leafs flagship. Canada-only stream may apply.",
    },
    "EDM": {
        "name": "630 CHED",
        "callsign": "CHED",
        "city": "Edmonton, AB",
        "stream_url": "https://rogers-cbs.leanstream.co/rogers/ched.stream/playlist.m3u8",
        "tunein_id": "s21042",
        "notes": "Oilers flagship. Canada-only stream may apply.",
    },
    "NYR": {
        "name": "WFAN Sports Radio",
        "callsign": "WFAN-FM",
        "city": "New York, NY",
        "stream_url": "https://playerservices.streamtheworld.com/api/livestream-redirect/WFAN_FMAAC.aac",
        "tunein_id": "s28169",
        "notes": "Rangers flagship. Simulcast on 660 AM / 101.9 FM.",
    },
    "COL": {
        "name": "Altitude Sports Radio",
        "callsign": "KKSE-FM",
        "city": "Denver, CO",
        "stream_url": "https://playerservices.streamtheworld.com/api/livestream-redirect/KKSEFMAAC.aac",
        "tunein_id": "s31099",
        "notes": "Avalanche flagship. Kroenke-owned; carries all Avs games.",
    },
    "CGY": {
        "name": "Sportsnet 960 The Fan",
        "callsign": "CFAC",
        "city": "Calgary, AB",
        "stream_url": None,
        "tunein_id": "s17693",
        "notes": "Flames flagship. Canada-only stream may apply.",
    },
}


def lookup(team_code: str) -> dict | None:
    """Return the station dict for a team, or None if not seeded yet."""
    if not team_code:
        return None
    return RADIO_STATIONS.get(team_code.upper())


def list_all() -> dict[str, dict]:
    """All seeded teams — used by the frontend to know which cards can
    show the radio picker."""
    return RADIO_STATIONS
