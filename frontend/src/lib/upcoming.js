// Metadata for every "not-yet-built" destination the app links to (deep-dive
// analytics tabs + game tabs on the Presser page, etc.). One source of truth so
// tab labels, descriptions, and placeholder pages stay in sync.
export const UPCOMING = {
  "fantasy-insights": {
    slug: "fantasy-insights",
    title: "Fantasy Insights",
    kicker: "Deep Dive",
    accent: "#1e5dff",
    blurb:
      "Start-sit calls, waiver-wire fits, anomaly flags — all read from your saved roster and updated the moment the numbers move.",
    trigger: "launch analytics North Star",
    kind: "analytics",
  },
  "matchup-sheet": {
    slug: "matchup-sheet",
    title: "Matchup Sheet",
    kicker: "Deep Dive",
    accent: "#00e5ff",
    blurb:
      "Tonight's edge — side-by-side team analytics with edge-magnitude bars, crossover matchups, and a Fact / Reported / Rumor confidence trail.",
    trigger: "launch analytics North Star",
    kind: "analytics",
  },
  "trade-analyzer": {
    slug: "trade-analyzer",
    title: "Trade Analyzer",
    kicker: "Deep Dive",
    accent: "#a4c1ff",
    blurb:
      "Propose Player A for Player B — the desk breaks down sustainability vs. inflation, deployment, regression, and injury risk into a clear verdict.",
    trigger: "launch analytics North Star",
    kind: "analytics",
  },
  "anomaly-flags": {
    slug: "anomaly-flags",
    title: "Anomaly Flags",
    kicker: "Deep Dive",
    accent: "#ff8f3b",
    blurb:
      "What changed — hot goalies, cold shooters, line-shuffle alerts, regression watches. Story Opportunity Score decides what the panel actually talks about tonight.",
    trigger: "launch analytics North Star",
    kind: "analytics",
  },
  "game-picks": {
    slug: "game-picks",
    title: "Game Picks",
    kicker: "The Game",
    accent: "#1e5dff",
    blurb:
      "Reggie makes the on-air call for every game tonight. You pick after hearing his case. Track your running win % — badge unlocks at 60%.",
    trigger: "launch daily picks",
    kind: "game",
    stats: [
      { label: "Your accuracy", value: "—", sub: "No picks yet" },
      { label: "Current streak", value: "0", sub: "Play tonight" },
    ],
  },
  "pick-10": {
    slug: "pick-10",
    title: "10 / 10",
    kicker: "Daily Ritual",
    accent: "#7de9ff",
    blurb:
      "Ten trending prop picks. Locks at puck drop, grades overnight. Come back to a score card on your wall — Wordle-for-props.",
    trigger: "launch Pick 10",
    kind: "game",
    stats: [
      { label: "Lifetime hit-rate", value: "—", sub: "No picks yet" },
      { label: "Best day", value: "—", sub: "First game shows here" },
    ],
  },
};

export const DEEP_DIVE_TABS = ["fantasy-insights", "matchup-sheet", "trade-analyzer", "anomaly-flags"];
export const GAME_TABS = ["game-picks", "pick-10"];
