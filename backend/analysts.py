"""Analyst personality definitions + mock NHL data for The Ticker Phase 1."""

ANALYSTS = {
    "doyle": {
        "id": "doyle",
        "name": "Liam \"Lucky\" Doyle",
        "short_name": "Doyle",
        "role": "Lead / Anchor",
        "accent_color": "#F5A623",
        "tagline": "Runs the desk. Not impressed.",
        "loading_lines": [
            "Doyle is straightening his jacket…",
            "Doyle is checking the prompter…",
            "Doyle is queuing up the tape…",
        ],
        "system_prompt": (
            "You are Liam 'Lucky' Doyle. Mid-40s Irish-American from Boston. "
            "Retired journeyman middle-six NHL forward who worked his way into media "
            "through beat reporting, not because anyone handed you a mic. You run the "
            "hockey desk on The Ticker. \n\n"
            "VOICE: Direct, dry, impatient with nonsense. You are the panel's straight man — "
            "jokes land because you don't force them. Confident, not loud. Old-guard "
            "instinct but not out of touch. Occasionally needle Erik 'Numbers' Lindqvist "
            "(the analytics kid who never played) if the moment calls for it — but only in "
            "passing, don't make it the whole answer.\n\n"
            "RULES: Keep answers 2-4 sentences unless the user explicitly asks for depth. "
            "Reference a specific stat when one is provided. Never say 'as an AI'. Never use "
            "emoji. Never start with 'Great question'. If the data can't support a real "
            "answer, say so in character — offer a related angle instead."
        ),
    },
    "lindqvist": {
        "id": "lindqvist",
        "name": "Erik \"Numbers\" Lindqvist",
        "short_name": "Numbers",
        "role": "Analytics",
        "accent_color": "#00E5FF",
        "tagline": "The numbers already told him.",
        "loading_lines": [
            "Numbers is pulling the xG chart…",
            "Numbers is checking the model…",
            "Numbers is filtering by 5-on-5…",
        ],
        "system_prompt": (
            "You are Erik 'Numbers' Lindqvist. Late 20s Minnesota analytics guy. "
            "Never played pro — came up through college hockey-ops and analytics "
            "departments. Youngest on the panel.\n\n"
            "VOICE: Confident, slightly smug, self-aware enough to joke about yourself "
            "before Doyle does. Deadpan — you deliver the joke with total sincerity, that's "
            "why it works. Fluent in xG, Corsi, PDO, high-danger chances, zone starts. Use "
            "the terms without over-explaining them; the audience knows.\n\n"
            "RULES: Lead with the number when there is one. 2-4 sentences unless depth is "
            "asked for. If Doyle would call you a nerd for the answer, you're on the right "
            "track. Never say 'as an AI'. Never use emoji. If the data doesn't support the "
            "question, say what data would answer it, and offer the closest available angle."
        ),
    },
    "kovalenko": {
        "id": "kovalenko",
        "name": "Danylo \"Dozer\" Kovalenko",
        "short_name": "Dozer",
        "role": "Enforcer / Heart",
        "accent_color": "#E53935",
        "tagline": "Says less. Means it.",
        "loading_lines": [
            "Dozer is lacing up his skates…",
            "Dozer is thinking about it…",
            "Dozer is cracking his neck…",
        ],
        "system_prompt": (
            "You are Danylo 'Dozer' Kovalenko. Late-40s to 50s Ukrainian-American from "
            "Cleveland. 14 NHL seasons as a two-way grinder. High career penalty minutes. "
            "One 20-goal season you bring up unprompted if it fits.\n\n"
            "VOICE: Plain, sincere, short sentences. No jargon. Self-deprecating and warm — "
            "'I had two moves: forward, and regret.' You are the one who says the true thing "
            "when the moment calls for it. Never mean. Land the biggest lines because you "
            "usually say the least.\n\n"
            "RULES: 2-3 short sentences. No analytics vocabulary. Talk about players like "
            "teammates, not assets. Never say 'as an AI'. Never use emoji. If the data can't "
            "answer it, say what you'd trust your eyes on instead."
        ),
    },
    "marchetti": {
        "id": "marchetti",
        "name": "Anthony \"Ace\" Marchetti",
        "short_name": "Ace",
        "role": "Wildcard / Chaos",
        "accent_color": "#39FF14",
        "tagline": "The hockey 'what if' guy — at peace with it.",
        "loading_lines": [
            "Ace is workshopping a hot take…",
            "Ace is pulling up a clip…",
            "Ace is dunking on his own career…",
        ],
        "system_prompt": (
            "You are Anthony 'Ace' Marchetti. Early-to-mid 30s Italian-American from "
            "Providence, RI. Career hockey 'what if' guy — never stuck in the NHL longer "
            "than 41 games in a season. Fully at peace with it, made it your whole shtick.\n\n"
            "VOICE: Rapid-fire, pop-culture-literate, willing to say the slightly-too-honest "
            "take. Loud and fast, but occasionally drop a surprisingly sharp hockey-smart "
            "line so you don't read as pure comic relief. Reference pop culture sparingly.\n\n"
            "RULES: 2-4 sentences, high energy. Don't be corny. Don't force catchphrases. "
            "Never say 'as an AI'. Never use emoji. If the data can't answer it, throw out "
            "the closest hot take you'd defend on air."
        ),
    },
}


# Mock NHL 2025-26 season data (illustrative — realistic-looking numbers).
PLAYERS = [
    {"id": "mcdavid", "name": "Connor McDavid", "team": "EDM", "pos": "C", "gp": 48, "g": 32, "a": 58, "pts": 90, "plus_minus": 18, "toi": "22:14"},
    {"id": "draisaitl", "name": "Leon Draisaitl", "team": "EDM", "pos": "C", "gp": 47, "g": 28, "a": 47, "pts": 75, "plus_minus": 14, "toi": "21:02"},
    {"id": "matthews", "name": "Auston Matthews", "team": "TOR", "pos": "C", "gp": 46, "g": 34, "a": 29, "pts": 63, "plus_minus": 9, "toi": "20:38"},
    {"id": "mackinnon", "name": "Nathan MacKinnon", "team": "COL", "pos": "C", "gp": 48, "g": 26, "a": 55, "pts": 81, "plus_minus": 21, "toi": "22:41"},
    {"id": "kucherov", "name": "Nikita Kucherov", "team": "TBL", "pos": "RW", "gp": 47, "g": 24, "a": 51, "pts": 75, "plus_minus": 12, "toi": "20:11"},
    {"id": "hughes-j", "name": "Jack Hughes", "team": "NJD", "pos": "C", "gp": 44, "g": 22, "a": 39, "pts": 61, "plus_minus": 6, "toi": "20:52"},
    {"id": "makar", "name": "Cale Makar", "team": "COL", "pos": "D", "gp": 48, "g": 14, "a": 44, "pts": 58, "plus_minus": 19, "toi": "25:33"},
    {"id": "kaprizov", "name": "Kirill Kaprizov", "team": "MIN", "pos": "LW", "gp": 45, "g": 27, "a": 34, "pts": 61, "plus_minus": 8, "toi": "20:07"},
    {"id": "hellebuyck", "name": "Connor Hellebuyck", "team": "WPG", "pos": "G", "gp": 38, "w": 27, "l": 8, "sv_pct": 0.928, "gaa": 2.11},
    {"id": "shesterkin", "name": "Igor Shesterkin", "team": "NYR", "pos": "G", "gp": 36, "w": 22, "l": 11, "sv_pct": 0.918, "gaa": 2.44},
]

TEAMS = [
    {"code": "EDM", "name": "Edmonton Oilers", "gp": 50, "w": 31, "l": 15, "otl": 4, "pts": 66, "gf": 172, "ga": 143},
    {"code": "COL", "name": "Colorado Avalanche", "gp": 50, "w": 33, "l": 13, "otl": 4, "pts": 70, "gf": 181, "ga": 138},
    {"code": "TOR", "name": "Toronto Maple Leafs", "gp": 49, "w": 28, "l": 17, "otl": 4, "pts": 60, "gf": 159, "ga": 148},
    {"code": "TBL", "name": "Tampa Bay Lightning", "gp": 50, "w": 29, "l": 16, "otl": 5, "pts": 63, "gf": 168, "ga": 149},
    {"code": "MIN", "name": "Minnesota Wild", "gp": 49, "w": 26, "l": 18, "otl": 5, "pts": 57, "gf": 148, "ga": 145},
    {"code": "NJD", "name": "New Jersey Devils", "gp": 49, "w": 27, "l": 18, "otl": 4, "pts": 58, "gf": 154, "ga": 141},
    {"code": "WPG", "name": "Winnipeg Jets", "gp": 50, "w": 32, "l": 14, "otl": 4, "pts": 68, "gf": 165, "ga": 128},
    {"code": "NYR", "name": "New York Rangers", "gp": 50, "w": 28, "l": 18, "otl": 4, "pts": 60, "gf": 157, "ga": 146},
]

TICKER_ITEMS = [
    "MCDAVID hits 90 pts in 48 GP — on pace for another Art Ross",
    "HELLEBUYCK sv% .928 leads all starters",
    "AVS have won 6 of 7 — MacKinnon on a 5-game point streak",
    "LEAFS drop 3 straight at home, Matthews still leads the league in G",
    "KAPRIZOV back from IR — Wild power play up to 24.1%",
    "HUGHES brothers combined for 5 points last night",
    "OILERS PK jumps to 82.4% since December",
    "KUCHEROV: 11 multi-point games in his last 15",
    "MAKAR passes 300 career assists at age 26",
    "SHESTERKIN pulled after 2 periods — 5 GA on 22 shots",
    "TRADE WATCH: three East contenders calling on a top-4 D",
    "JETS lead the league in goals against (128) — regression coming?",
]

# Upcoming games for predictions.
GAMES = [
    {"id": "g1", "home": "EDM", "away": "COL", "start_iso": "2026-02-18T00:30:00Z", "home_ml": -110, "away_ml": -105, "total": 6.5},
    {"id": "g2", "home": "TOR", "away": "TBL", "start_iso": "2026-02-18T00:00:00Z", "home_ml": -125, "away_ml": +115, "total": 6.5},
    {"id": "g3", "home": "MIN", "away": "WPG", "start_iso": "2026-02-18T01:00:00Z", "home_ml": +130, "away_ml": -140, "total": 5.5},
    {"id": "g4", "home": "NJD", "away": "NYR", "start_iso": "2026-02-18T00:00:00Z", "home_ml": +105, "away_ml": -115, "total": 6.0},
]


def get_analyst(analyst_id: str):
    return ANALYSTS.get(analyst_id)


def build_stat_context(question: str) -> str:
    """Return a compact stat block string built from mock data, biased by the question text."""
    q = question.lower()
    matched_players = [p for p in PLAYERS if p["name"].split()[-1].lower() in q or p["team"].lower() in q]
    matched_teams = [t for t in TEAMS if t["code"].lower() in q or t["name"].lower() in q]

    if not matched_players and not matched_teams:
        # Default: give top-of-mind context.
        matched_players = PLAYERS[:3]

    lines = ["Available stats (2025-26 season, current through GP 48-50):"]
    for p in matched_players[:4]:
        if p["pos"] == "G":
            lines.append(f"- {p['name']} ({p['team']}, G): {p['w']}W-{p['l']}L, .{int(p['sv_pct']*1000):03d} SV%, {p['gaa']} GAA")
        else:
            lines.append(f"- {p['name']} ({p['team']}, {p['pos']}): {p['g']}G {p['a']}A {p['pts']}P in {p['gp']} GP, {p['plus_minus']:+d}, {p['toi']} TOI")
    for t in matched_teams[:3]:
        lines.append(f"- {t['name']}: {t['w']}-{t['l']}-{t['otl']}, {t['pts']} pts, {t['gf']} GF / {t['ga']} GA")
    return "\n".join(lines)


def build_stat_card(question: str):
    """Return a small structured stat card the frontend renders next to the answer."""
    q = question.lower()
    for p in PLAYERS:
        if p["name"].split()[-1].lower() in q or p["id"] in q:
            if p["pos"] == "G":
                return {
                    "title": p["name"],
                    "subtitle": f"{p['team']} · Goaltender",
                    "stats": [
                        {"label": "RECORD", "value": f"{p['w']}-{p['l']}"},
                        {"label": "SV%", "value": f".{int(p['sv_pct']*1000):03d}"},
                        {"label": "GAA", "value": f"{p['gaa']}"},
                        {"label": "GP", "value": f"{p['gp']}"},
                    ],
                }
            return {
                "title": p["name"],
                "subtitle": f"{p['team']} · {p['pos']}",
                "stats": [
                    {"label": "GOALS", "value": str(p["g"])},
                    {"label": "ASSISTS", "value": str(p["a"])},
                    {"label": "POINTS", "value": str(p["pts"])},
                    {"label": "+/-", "value": f"{p['plus_minus']:+d}"},
                ],
            }
    for t in TEAMS:
        if t["code"].lower() in q or t["name"].lower() in q:
            return {
                "title": t["name"],
                "subtitle": f"{t['code']} · Team",
                "stats": [
                    {"label": "RECORD", "value": f"{t['w']}-{t['l']}-{t['otl']}"},
                    {"label": "PTS", "value": str(t["pts"])},
                    {"label": "GF", "value": str(t["gf"])},
                    {"label": "GA", "value": str(t["ga"])},
                ],
            }
    # Default: league leader card.
    top = PLAYERS[0]
    return {
        "title": top["name"],
        "subtitle": f"{top['team']} · {top['pos']} · League Leader",
        "stats": [
            {"label": "GOALS", "value": str(top["g"])},
            {"label": "ASSISTS", "value": str(top["a"])},
            {"label": "POINTS", "value": str(top["pts"])},
            {"label": "+/-", "value": f"{top['plus_minus']:+d}"},
        ],
    }


SUGGESTED_QUESTIONS = [
    "Is McDavid on pace to win another Art Ross?",
    "Who's the best value goalie for fantasy right now?",
    "What's wrong with the Leafs at home?",
    "Are the Avs the real Cup favorite?",
    "Should I trade Matthews for MacKinnon straight up?",
    "Which team's goal differential is a mirage?",
]
