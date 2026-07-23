"""The Ticker — Phase 1 MVP Two-Host Panel.

Reggie Banks (retired NHL player, emotional core) + Marc (60, seasoned
analytics co-host). Every banter turn carries a `shot` cue that drives the
frontend camera state machine (two_neutral_open, reggie_speaks, marc_speaks,
two_laughing, marc_analyzing_stats, etc.) and a per-host `expression` where
useful.
"""

ANALYSTS = {
    "reggie": {
        "id": "reggie",
        "name": "Reggie Banks",
        "short_name": "Reggie",
        "role": "Lead Anchor · Ex-NHL",
        "accent_color": "#1E5DFF",
        "tagline": "Do the right things. Then execute.",
        "loading_lines": [
            "Reggie is checking the tape…",
            "Reggie is pulling up the notes…",
        ],
        "system_prompt": (
            "You are Reggie Banks — a retired NHL player, now lead anchor on The "
            "Ticker. Emotional core of the desk. You teach hockey in plain "
            "language rather than lecturing. Short sentences. Confident, warm, "
            "occasional dry chirp — never mean.\n\n"
            "Core beliefs: 'Do the right things. Then execute.' 'The puck moves "
            "faster than any player.' 'Support wins hockey games.' 'Simple beats "
            "fancy.' 'Hockey keeps receipts.' You value effort, criticize habits "
            "rather than people, and never say you regret anything about your "
            "career. Kids who never get to play — that's what gets you.\n\n"
            "Working with Marc (60, analytics co-host): respect his research, "
            "challenge analytics when they ignore hockey context, let him finish, "
            "friendly rivalry. Audience should feel you enjoy this.\n\n"
            "RULES: 2-4 sentences unless depth asked. Never 'as an AI'. Never "
            "emoji. Use hockey knowledge like a player, not a stats sheet. If "
            "the data can't answer it, say so and give the angle you'd defend "
            "on air."
        ),
    },
    "marc": {
        "id": "marc",
        "name": "Marc",
        "short_name": "Marc",
        "role": "Analytics Co-Host",
        "accent_color": "#00E5FF",
        "tagline": "Let's look at the numbers.",
        "loading_lines": [
            "Marc is pulling the model…",
            "Marc is checking the trend line…",
            "Marc is adjusting his glasses…",
        ],
        "system_prompt": (
            "You are Marc — 60 years old, seasoned analytics co-host on The "
            "Ticker. The analytical counterweight to Reggie. Calm, measured, "
            "never shout, rarely interrupt. Prepared obsessively. You explain "
            "advanced stats in plain language and are comfortable saying 'I "
            "don't know yet.'\n\n"
            "Core beliefs: 'Good data improves good hockey instincts.' 'Context "
            "matters as much as statistics.' 'Question assumptions respectfully.' "
            "'The process is stronger than the result.' 'Small sample size.' "
            "'That's a headline, not a conclusion.' 'Probability isn't "
            "certainty.'\n\n"
            "Working with Reggie: respect his playing experience, challenge "
            "him without disrespect, often begin with 'I agree… but…', let him "
            "own the emotional moments. Dry humour. Happy to be teased for "
            "loving spreadsheets. Smile when he calls you 'Professor.'\n\n"
            "RULES: 2-4 sentences unless depth asked. Never 'as an AI'. Never "
            "emoji. Lead with a specific number or pattern when relevant. If "
            "the numbers don't support the question, say what data would answer "
            "it and offer the closest available angle."
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

GAMES = [
    {"id": "g1", "home": "EDM", "away": "COL", "start_iso": "2026-02-18T00:30:00Z"},
    {"id": "g2", "home": "TOR", "away": "TBL", "start_iso": "2026-02-18T00:00:00Z"},
    {"id": "g3", "home": "MIN", "away": "WPG", "start_iso": "2026-02-18T01:00:00Z"},
    {"id": "g4", "home": "NJD", "away": "NYR", "start_iso": "2026-02-18T00:00:00Z"},
]


# ---------- Two-host banter ----------
#
# Every turn: {speaker, text, shot?, expression?, interrupt?}
#
# `shot` is the camera state the frontend renders BEFORE playing this line.
# Available shot IDs (see /app/backend/static/sprites/manifest.json):
#   two_neutral_open, two_reggie_speaks, two_marc_speaks,
#   two_friendly_debate, two_laughing, two_both_monitor, two_reviewing_notes,
#   two_serious, two_excited, two_closing,
#   reggie_neutral, reggie_explaining, reggie_leaning, reggie_pointing,
#   reggie_hands_open, reggie_counting, reggie_looking_notes,
#   reggie_looking_monitor, reggie_listening_off, reggie_skeptical,
#   reggie_smirking, reggie_laughing, reggie_yelling, reggie_disappointed,
#   reggie_serious,
#   marc_explaining, marc_analyzing_stats, marc_looking_notes,
#   marc_adjusting_glasses, marc_looking_monitor, marc_listening,
#   marc_smiling, marc_skeptical, marc_serious, marc_chuckle,
#   ots_reggie, ots_marc, side_two_shot, telestrator, end_of_show_wave

BANTER_BY_TOPIC = {
    "league_wide": [
        [
            {"speaker": "reggie", "shot": "side_two_shot", "text": "Puck drops in three, two, one — welcome to The Ticker, kid. Marc, we got a lot to get through tonight."},
            {"speaker": "marc", "shot": "marc_explaining", "text": "We do. And I want to start with something that's been quietly building for three weeks: Winnipeg's goals-against."},
            {"speaker": "reggie", "shot": "reggie_leaning", "interrupt": True, "text": "Boring hockey. And boring hockey wins in April. You know how I feel about that."},
            {"speaker": "marc", "shot": "marc_analyzing_stats", "text": "One-twenty-eight goals against in fifty games — league best. But the interesting number is Hellebuyck. Nine-two-eight save percentage."},
            {"speaker": "reggie", "shot": "reggie_smirking", "text": "Nine-two-eight isn't a save percentage, Professor — that's a typo."},
            {"speaker": "marc", "shot": "marc_chuckle", "text": "It is remarkable. But — and this is where I'd push back on the eye test — Winnipeg's expected goals against is much higher than their actual. There's some regression coming."},
            {"speaker": "reggie", "shot": "reggie_pointing", "text": "That's what everybody said about them last year, and the year before. Some teams just play a system that suppresses chances. Coaches notice, kid."},
            {"speaker": "marc", "shot": "two_friendly_debate", "text": "I agree… but the underlying numbers usually catch up. That's the pattern."},
            {"speaker": "reggie", "shot": "two_friendly_debate", "text": "Sometimes the pattern is: this coach knows what he's doing."},
            {"speaker": "marc", "shot": "marc_smiling", "text": "Fair. Let's move on — Leafs. Three straight losses at home, and Matthews still leads the league in goals."},
            {"speaker": "reggie", "shot": "reggie_disappointed", "text": "One guy can't do it. Not in this league. I've said that my whole career and it's never been wrong."},
            {"speaker": "marc", "shot": "marc_looking_monitor", "text": "Their five-on-five expected-goals share at home dropped ten points in December. Nobody's talking about it."},
            {"speaker": "reggie", "shot": "reggie_serious", "text": "That's not talent. That's a room. Or a system. Somebody in that building has stopped listening — and hockey keeps receipts."},
            {"speaker": "marc", "shot": "two_serious", "text": "The data agrees. That's a rare sentence for me."},
            {"speaker": "reggie", "shot": "two_laughing", "text": "Write it down, kid — Marc said the data agreed with me. That's my highlight of the night."},
            {"speaker": "marc", "shot": "two_laughing", "text": "Enjoy it. It won't happen again this segment."},
            {"speaker": "reggie", "shot": "reggie_hands_open", "text": "Alright — real quick before we go to break. McDavid. Ninety points in forty-eight games."},
            {"speaker": "marc", "shot": "marc_explaining", "text": "On pace for one-fifty-four. And you know what's wild? We stopped being surprised."},
            {"speaker": "reggie", "shot": "reggie_closing_smile" if False else "reggie_smirking", "text": "That's the story every night. The story is nobody talks about it anymore."},
            {"speaker": "marc", "shot": "two_closing", "text": "Stick around — Trade Deadline setup next."},
        ],
    ],
    "trade_deadline": [
        [
            {"speaker": "reggie", "shot": "side_two_shot", "text": "Trade deadline in three weeks. Somebody's about to blink."},
            {"speaker": "marc", "shot": "marc_adjusting_glasses", "text": "Three teams have called on a top-four defenseman. That's what my sources tell me. The cap math is uglier than usual this year."},
            {"speaker": "reggie", "shot": "reggie_leaning", "text": "Rangers. Every February, every year."},
            {"speaker": "marc", "shot": "marc_skeptical", "text": "They don't have the cap. They never do."},
            {"speaker": "reggie", "shot": "reggie_smirking", "interrupt": True, "text": "And yet."},
            {"speaker": "marc", "shot": "marc_chuckle", "text": "And yet. History says a contender gives up a first for two months of a rental. And history says by June, my crowd lines up to explain why it was a bad deal."},
            {"speaker": "reggie", "shot": "reggie_pointing", "text": "You're the analytics crowd, Professor."},
            {"speaker": "marc", "shot": "two_friendly_debate", "text": "I said what I said."},
            {"speaker": "reggie", "shot": "two_laughing", "text": "Cold-blooded! I love it."},
            {"speaker": "marc", "shot": "two_closing", "text": "The process is stronger than the result. Coming up — playoff race."},
        ],
    ],
    "playoff_race": [
        [
            {"speaker": "reggie", "shot": "side_two_shot", "text": "Wild-card race is a bloodbath, Marc. Six teams inside four points."},
            {"speaker": "marc", "shot": "marc_analyzing_stats", "text": "And by expected-goals share, half of them shouldn't be there. The underlying numbers are ugly."},
            {"speaker": "reggie", "shot": "reggie_hands_open", "text": "Ugly numbers, pretty standings. That's hockey."},
            {"speaker": "marc", "shot": "marc_smiling", "text": "That's a sentence I wish more of my analytics friends would just accept."},
            {"speaker": "reggie", "shot": "reggie_serious", "text": "March is when you find out who wants it. Doesn't matter what your Corsi is."},
            {"speaker": "marc", "shot": "marc_looking_notes", "text": "The Wild are one bad week from being sellers. Kaprizov just came back though — that changes the math."},
            {"speaker": "reggie", "shot": "reggie_smirking", "text": "They should be sellers. But they never are. Fanbases don't let it happen."},
            {"speaker": "marc", "shot": "two_serious", "text": "And that's why some GMs sleep worse than others in February."},
        ],
    ],
    "leafs": [
        [
            {"speaker": "reggie", "shot": "side_two_shot", "text": "Leafs, Marc. My favourite four letters."},
            {"speaker": "marc", "shot": "marc_adjusting_glasses", "text": "Three home losses in a row. Matthews still leads the league in goals. That's a headline that hides a real problem."},
            {"speaker": "reggie", "shot": "reggie_disappointed", "text": "One guy can't do it. Not in this league. Ever."},
            {"speaker": "marc", "shot": "marc_analyzing_stats", "text": "Their five-on-five expected-goals share at home dropped ten points in December. Ten. Nobody's talking about it."},
            {"speaker": "reggie", "shot": "reggie_leaning", "text": "That's not talent. That's a coaching problem. Or a room problem."},
            {"speaker": "marc", "shot": "two_friendly_debate", "text": "The numbers support you. That's rare on this show."},
            {"speaker": "reggie", "shot": "two_laughing", "text": "Twice in one night. Somebody clip that."},
        ],
    ],
    "oilers": [
        [
            {"speaker": "reggie", "shot": "side_two_shot", "text": "Oilers PK jumped to eighty-two-point-four percent since December."},
            {"speaker": "marc", "shot": "marc_analyzing_stats", "text": "That's not McDavid and Draisaitl. That's system stuff. The clears are getting out cleanly."},
            {"speaker": "reggie", "shot": "reggie_smirking", "text": "Good coaching. Boring hockey. Now you're speaking my language, Marc."},
            {"speaker": "marc", "shot": "marc_smiling", "text": "McDavid's on pace for one-fifty-four points, by the way. Nobody blinks."},
            {"speaker": "reggie", "shot": "reggie_hands_open", "text": "We stopped being surprised by him three years ago. That's the crime."},
            {"speaker": "marc", "shot": "two_closing", "text": "The story is that nobody talks about it anymore."},
        ],
    ],
    "hot_takes": [
        [
            {"speaker": "reggie", "shot": "side_two_shot", "text": "Hot take time. Kaprizov's a better player than Kucherov."},
            {"speaker": "marc", "shot": "marc_skeptical", "text": "That's not a hot take. That's a cold take that hasn't warmed up yet."},
            {"speaker": "reggie", "shot": "reggie_pointing", "text": "The numbers, Professor. Let's hear it."},
            {"speaker": "marc", "shot": "marc_analyzing_stats", "text": "Kucherov, and it's not close. Points-per-sixty, high-danger involvement, playoff resume."},
            {"speaker": "reggie", "shot": "reggie_serious", "text": "Cups aren't stats. They're the only stat."},
            {"speaker": "marc", "shot": "two_friendly_debate", "text": "That's not a data-friendly sentence, but I'll give it to you."},
            {"speaker": "reggie", "shot": "two_laughing", "text": "Ha! Chalk one up for the ex-player."},
        ],
    ],
}

TOPIC_META = [
    {"id": "league_wide", "label": "League Wide"},
    {"id": "trade_deadline", "label": "Trade Deadline"},
    {"id": "playoff_race", "label": "Playoff Race"},
    {"id": "hot_takes", "label": "Hot Takes"},
    {"id": "leafs", "label": "Leafs"},
    {"id": "oilers", "label": "Oilers"},
]


# Legacy alias — kept for anything still importing BANTER_SCRIPTS.
BANTER_SCRIPTS = BANTER_BY_TOPIC["league_wide"]


# Quick fallback replies (used when the LLM key has $0 budget).
QUICK_FALLBACK = {
    "reggie": [
        "{topic}. Fine — do the right things, then execute. That's the whole story.",
        "{topic}? Simple hockey beats fancy hockey. Ask me how I know.",
        "{topic} — hockey keeps receipts. We'll see who's telling the truth in April.",
    ],
    "marc": [
        "{topic} — let's look at the numbers. Small sample size right now, but the trend is real.",
        "{topic}? The eye test and the data don't agree here. That's usually the tell.",
        "{topic}. Context matters. One game doesn't change everything.",
    ],
}

import random


def pick_banter(topic: str = "league_wide"):
    scripts = BANTER_BY_TOPIC.get(topic) or BANTER_BY_TOPIC["league_wide"]
    return random.choice(scripts)


def quick_fallback_line(analyst_id: str, topic: str):
    lines = QUICK_FALLBACK.get(analyst_id) or QUICK_FALLBACK["reggie"]
    return random.choice(lines).format(topic=topic.strip() or "That")


def get_analyst(analyst_id: str):
    return ANALYSTS.get(analyst_id)


def build_stat_context(question: str) -> str:
    q = question.lower()
    matched_players = [p for p in PLAYERS if p["name"].split()[-1].lower() in q or p["team"].lower() in q]
    matched_teams = [t for t in TEAMS if t["code"].lower() in q or t["name"].lower() in q]

    if not matched_players and not matched_teams:
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
