// Two-host panel — mirrors backend/analysts.py
export const ANALYSTS = {
  reggie: {
    id: "reggie",
    name: "Reggie Banks",
    short: "Reggie",
    role: "Lead Anchor · Ex-NHL",
    accent: "#1E5DFF",
    tagline: "Do the right things. Then execute.",
    // Portrait (used for avatars in nav / meet-the-desk cards)
    portrait: "/api/sprites/reggie_neutral.png",
  },
  marc: {
    id: "marc",
    name: "Marc",
    short: "Marc",
    role: "Analytics Co-Host",
    accent: "#00E5FF",
    tagline: "Let's look at the numbers.",
    portrait: "/api/sprites/marc_explaining.png",
  },
};

export const ANALYST_ORDER = ["reggie", "marc"];

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
  desk: {
    shotFrame: "desk-shot-frame",
    lowerThird: "desk-lower-third",
    muteBtn: "mute-btn",
    topicInput: "desk-topic-input",
    topicSubmit: "desk-topic-submit",
    quickReply: "desk-quick-reply",
  },
};
