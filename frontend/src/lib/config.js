// Analyst config for The Ticker (mirrors backend/analysts.py)
export const ANALYSTS = {
  doyle: {
    id: "doyle",
    name: 'Liam "Lucky" Doyle',
    short: "Doyle",
    role: "Lead / Anchor",
    accent: "#F5A623",
    tagline: "Runs the desk. Not impressed.",
    image:
      "https://images.unsplash.com/photo-1606920669741-c8ba74262a94?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
  },
  lindqvist: {
    id: "lindqvist",
    name: 'Erik "Numbers" Lindqvist',
    short: "Numbers",
    role: "Analytics",
    accent: "#00E5FF",
    tagline: "The numbers already told him.",
    image:
      "https://images.unsplash.com/photo-1752738372136-2602aaafdcb7?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
  },
  kovalenko: {
    id: "kovalenko",
    name: 'Danylo "Dozer" Kovalenko',
    short: "Dozer",
    role: "Enforcer / Heart",
    accent: "#E53935",
    tagline: "Says less. Means it.",
    image:
      "https://images.pexels.com/photos/6075675/pexels-photo-6075675.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  marchetti: {
    id: "marchetti",
    name: 'Anthony "Ace" Marchetti',
    short: "Ace",
    role: "Wildcard / Chaos",
    accent: "#39FF14",
    tagline: "The hockey 'what if' guy — at peace with it.",
    image:
      "https://images.unsplash.com/photo-1566327011423-029eb055efb3?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
  },
};

export const ANALYST_ORDER = ["doyle", "lindqvist", "kovalenko", "marchetti"];

export const TEST_IDS = {
  nav: {
    home: "nav-home",
    ask: "nav-ask",
    predictions: "nav-predictions",
  },
  home: {
    tickerBanner: "ticker-banner",
    panelHeading: "panel-heading",
    askCta: "home-ask-cta",
    analystCard: (id) => `analyst-card-${id}`,
    analystAskBtn: (id) => `analyst-ask-btn-${id}`,
  },
  ask: {
    analystStrip: "analyst-strip",
    analystPick: (id) => `analyst-pick-${id}`,
    input: "ask-input",
    submit: "ask-submit",
    answerBlock: "ask-answer-block",
    statCard: "ask-stat-card",
    loadingLine: "ask-loading-line",
    suggested: (i) => `ask-suggested-${i}`,
  },
  pred: {
    userInput: "pred-user-input",
    gameCard: (id) => `pred-game-${id}`,
    pickHome: (id) => `pred-pick-home-${id}`,
    pickAway: (id) => `pred-pick-away-${id}`,
    reasoning: (id) => `pred-reasoning-${id}`,
    submit: (id) => `pred-submit-${id}`,
    leaderboard: "pred-leaderboard",
    mine: "pred-mine",
    simulate: "pred-simulate",
  },
};
