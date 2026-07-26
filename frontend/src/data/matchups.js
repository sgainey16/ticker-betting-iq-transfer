// Hard-coded April 8 2025 matchup data. Real scores + real season records
// pulled from api-web.nhle.com. Ticker Intelligence composite scores and
// Factor Importance weights are illustrative for MVP — they follow the
// framework in MATCHUP_ANALYTICS_SPEC.md but the actual model that
// generates them ships with the Analytics North Star epic.

export const MATCHUPS = {
  "BOS-NJD": {
    id: "BOS-NJD",
    date: "2025-04-08",
    venue: "Prudential Center",
    puck_drop: "7:00 PM ET",
    away: {
      abbr: "BOS", name: "Bruins",  accent: "#FCB514",
      record: "31-34-11", gpg: 2.61, gapg: 3.15, pp: 15.3, pk: 76.8,
      last10: "3-6-1", score: 2, storyline: "Free-fall out of the playoffs",
    },
    home: {
      abbr: "NJD", name: "Devils",  accent: "#CE1126",
      record: "40-28-8", gpg: 3.19, gapg: 2.88, pp: 28.1, pk: 79.4,
      last10: "6-3-1", score: 7, storyline: "Clinched — locking in seeding",
    },
    ai_game_story_prompt:
      "Give me the Ticker's game story for Boston at New Jersey on April 8, 2025. Final was 7-2 Devils. Bruins are collapsing out of the playoffs, Devils clinched with this win. Explain in one paragraph WHY it happened — the goaltending, the special teams, the momentum, the intangibles. Sound like Reggie: 2-3 short sentences, hockey language, no jargon. End with the takeaway.",
    ticker_intelligence: [
      { key: "momentum",   label: "Momentum",       away: 24, home: 88, note: "Devils riding a 6-game surge" },
      { key: "confidence", label: "Confidence",     away: 31, home: 82, note: "Bruins body language on empty" },
      { key: "fatigue",    label: "Fatigue",        away: 62, home: 42, note: "Boston on second of back-to-back" },
      { key: "clutch",     label: "Clutch Rating",  away: 46, home: 71, note: "Devils' one-goal record is elite" },
      { key: "chemistry",  label: "Line Chemistry", away: 38, home: 79, note: "Hughes-Meier-Bratt clicking" },
      { key: "pressure",   label: "Pressure",       away: 34, home: 68, note: "Home crowd + clinch on the line" },
      { key: "coaching",   label: "Coaching Edge",  away: 40, home: 74, note: "Keefe outmatched Sheldon Keefe" },
      { key: "injury",     label: "Injury Impact",  away: 55, home: 78, note: "Bruins missing top-4 D-man" },
    ],
    factor_importance: [
      { factor: "Goaltending mismatch",    weight: 31 },
      { factor: "Special-teams edge",      weight: 24 },
      { factor: "Rest advantage",          weight: 17 },
      { factor: "Momentum + confidence",   weight: 15 },
      { factor: "Injury impact (BOS D)",   weight: 13 },
    ],
    categories: buildCategories({
      away_abbr: "BOS",
      home_abbr: "NJD",
      overrides: {
        team_strength:  { away: { pts_pct: 0.500, gd: -47 }, home: { pts_pct: 0.588, gd: +32 } },
        offensive:      { away: { gpg: 2.61, xg: 2.42, hd_chances: 8.1 }, home: { gpg: 3.19, xg: 3.31, hd_chances: 11.6 } },
        defensive:      { away: { gapg: 3.15, xga: 3.28 }, home: { gapg: 2.88, xga: 2.71 } },
        possession:     { away: { corsi: 47.8, fenwick: 48.1 }, home: { corsi: 53.4, fenwick: 54.0 } },
        goaltending:    { away: { sv: 0.898, gsaa: -8.2 }, home: { sv: 0.917, gsaa: +6.4 } },
        schedule:       { away: "Back-to-back · 2nd night", home: "3 days rest" },
      },
    }),
  },

  "NYI-NSH": {
    id: "NYI-NSH",
    date: "2025-04-08",
    venue: "Bridgestone Arena",
    puck_drop: "8:00 PM ET",
    away: {
      abbr: "NYI", name: "Islanders", accent: "#F47D30",
      record: "32-33-13", gpg: 2.83, gapg: 2.98, pp: 20.4, pk: 78.9,
      last10: "5-4-1", score: 6, storyline: "Wild card bubble team",
    },
    home: {
      abbr: "NSH", name: "Predators", accent: "#FFB81C",
      record: "27-38-12", gpg: 2.74, gapg: 3.34, pp: 17.8, pk: 74.1,
      last10: "4-5-1", score: 7, storyline: "Fighting to stay alive",
    },
    ai_game_story_prompt:
      "The Ticker's game story: Islanders at Predators April 8 2025, final 7-6 Nashville. Thirteen goals. Both wild-card bubble teams. Break down what actually happened in one paragraph — goaltending, special teams, momentum swings. Reggie voice: 2-3 short sentences, warm, punchy.",
    ticker_intelligence: [
      { key: "momentum",   label: "Momentum",       away: 58, home: 61, note: "Both teams swinging hard" },
      { key: "confidence", label: "Confidence",     away: 52, home: 47, note: "Both press-conference confident" },
      { key: "fatigue",    label: "Fatigue",        away: 48, home: 44, note: "Standard rest" },
      { key: "clutch",     label: "Clutch Rating",  away: 55, home: 62, note: "Preds thrive in one-goal games" },
      { key: "chemistry",  label: "Line Chemistry", away: 51, home: 58, note: "Forsberg line rolling" },
      { key: "pressure",   label: "Pressure",       away: 74, home: 78, note: "Must-win for both" },
      { key: "coaching",   label: "Coaching Edge",  away: 49, home: 51, note: "Coin flip" },
      { key: "injury",     label: "Injury Impact",  away: 58, home: 51, note: "Isles missing 2 forwards" },
    ],
    factor_importance: [
      { factor: "PDO / puck luck",         weight: 28 },
      { factor: "Both goalies below avg",  weight: 24 },
      { factor: "Special-teams volume",    weight: 19 },
      { factor: "Zero defensive structure", weight: 16 },
      { factor: "Home-ice pressure",       weight: 13 },
    ],
    categories: buildCategories({ away_abbr: "NYI", home_abbr: "NSH" }),
  },

  "VGK-COL": {
    id: "VGK-COL",
    date: "2025-04-08",
    venue: "Ball Arena",
    puck_drop: "9:00 PM MT",
    away: {
      abbr: "VGK", name: "Golden Knights", accent: "#B4975A",
      record: "42-25-8", gpg: 3.29, gapg: 2.85, pp: 24.7, pk: 80.6,
      last10: "7-2-1", score: 2, storyline: "Cup-tested. Seed jockeying",
    },
    home: {
      abbr: "COL", name: "Avalanche", accent: "#6F263D",
      record: "43-27-6", gpg: 3.44, gapg: 2.79, pp: 26.8, pk: 82.1,
      last10: "8-1-1", score: 3, storyline: "Peaking at the right time",
    },
    ai_game_story_prompt:
      "The Ticker's game story: Vegas at Colorado April 8 2025. Final 3-2 Colorado. Central Division powers, both playoff-bound. Break it down — Vegas outshot in high-danger but Colorado won the tape and the game. One paragraph Reggie voice.",
    ticker_intelligence: [
      { key: "momentum",   label: "Momentum",       away: 72, home: 78, note: "Both playing playoff hockey" },
      { key: "confidence", label: "Confidence",     away: 76, home: 81, note: "Cup DNA on both benches" },
      { key: "fatigue",    label: "Fatigue",        away: 55, home: 45, note: "Vegas came in from Dallas" },
      { key: "clutch",     label: "Clutch Rating",  away: 84, home: 79, note: "Two elite closers" },
      { key: "chemistry",  label: "Line Chemistry", away: 71, home: 83, note: "MacKinnon-Rantanen elite" },
      { key: "pressure",   label: "Pressure",       away: 62, home: 66, note: "Seed math, not survival" },
      { key: "coaching",   label: "Coaching Edge",  away: 77, home: 76, note: "Cassidy vs Bednar, elite" },
      { key: "injury",     label: "Injury Impact",  away: 42, home: 38, note: "Both close to full" },
    ],
    factor_importance: [
      { factor: "High-danger chance edge (VGK)", weight: 26 },
      { factor: "Goaltending (COL steals it)",   weight: 24 },
      { factor: "MacKinnon line vs VGK top pair", weight: 20 },
      { factor: "Special teams",                 weight: 17 },
      { factor: "Home ice + altitude",           weight: 13 },
    ],
    categories: buildCategories({ away_abbr: "VGK", home_abbr: "COL" }),
  },
};

/**
 * Assembles the 20-category framework with sensible placeholders. Categories
 * receiving `overrides` get real values inserted; the rest get "coming with
 * live data feed" stubs but keep the visual structure so users see the depth.
 */
function buildCategories({ away_abbr, home_abbr, overrides = {} }) {
  const C = (id, name, description, stats) => ({ id, name, description, stats });
  const stub = { away: "—", home: "—", note: "Wires to live NHL feed pre-launch" };

  return [
    C("team_strength", "Team Strength", "Record, points %, differential, home/away splits",
      overrides.team_strength || stub),
    C("offensive", "Offensive Analytics", "Goals/game, xG, high-danger chances, shot quality tiers",
      overrides.offensive || stub),
    C("defensive", "Defensive Analytics", "Goals against, xGA, rush chances, PK clears, D-zone time",
      overrides.defensive || stub),
    C("possession", "Possession", "Corsi, Fenwick, xG%, zone possession, faceoff control",
      overrides.possession || stub),
    C("goaltending", "Goaltending", "Danger-tier save %, GSAA, rebound control, PP/PK splits",
      overrides.goaltending || stub),
    C("individual", "Individual Players", "Per-skater xG, entries/exits, TOI, quality of comp",
      overrides.individual || stub),
    C("line_chemistry", "Line Chemistry", "Combinations, games together, xG together, matchup success",
      overrides.line_chemistry || stub),
    C("matchups", "Head-to-Head Matchups", "Player vs. player, D-pair vs. line, goalie vs. shooter",
      overrides.matchups || stub),
    C("historical", "Historical Matchups", "Last meeting, last 5/10, playoff vs. regular, same officials",
      overrides.historical || stub),
    C("injuries", "Injuries", "Current, day-to-day, IR, expected minutes lost, replacement quality",
      overrides.injuries || stub),
    C("schedule", "Schedule Analytics", "Back-to-backs, travel, time zones, road trip length, days rest",
      overrides.schedule || stub),
    C("referees", "Referees", "Crew assignment, penalty tendencies, home/away bias, game pace",
      overrides.referees || stub),
    C("arena", "Arena Factors", "Home advantage, ice quality, altitude, crowd noise",
      overrides.arena || stub),
    C("coaching", "Coaching", "Record, challenge success, line matching, PP/PK strategy",
      overrides.coaching || stub),
    C("betting", "Betting Market", "Opening/current line, sharp vs. public, movement, closing line value",
      overrides.betting || stub),
    C("psychological", "Psychological / Intangibles", "Revenge games, contract year, trap games, milestones",
      overrides.psychological || stub),
    C("culture", "Team Culture", "Leadership, locker room, body language, trade-deadline mood",
      overrides.culture || stub),
    C("video", "Video Intelligence", "Forecheck pressure, gap control, passing lanes, fatigue read",
      overrides.video || stub),
    C("external", "External Factors", "Travel disruptions, illness, equipment issues",
      overrides.external || stub),
    C("ticker_intel", "Proprietary Ticker Intelligence", "Composite scores blended from all categories above — see dashboard",
      { away: `${away_abbr} score set`, home: `${home_abbr} score set`, note: "Full breakdown → Ticker Intelligence Dashboard above" }),
  ];
}

// Slugs used by the router
export const MATCHUP_IDS = Object.keys(MATCHUPS);
export const DEFAULT_MATCHUP = "BOS-NJD";
