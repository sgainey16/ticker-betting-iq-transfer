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
    portrait: "/api/hosts/reggie_portrait.png",
    hero: "/api/hosts/reggie_stage.png",
    heroCopy: {
      kicker: "1-on-1 Press Conference",
      headline: "Ask Reggie any stat.",
      sub: "Straight from a guy who played it.",
    },
  },
  marc: {
    id: "marc",
    name: "Marc Collins",
    short: "Marc",
    role: "Analytics Co-Host",
    accent: "#00E5FF",
    tagline: "Show me the numbers or show me the door.",
    portrait: "/api/hosts/marc_portrait.png",
    hero: "/api/hosts/marc_stage.png",
    heroCopy: {
      kicker: "1-on-1 Press Conference",
      headline: "Ask Marc about your favourite team.",
      sub: "The numbers know more than the headlines.",
    },
  },
};

export const ANALYST_ORDER = ["reggie", "marc"];

export const TEST_IDS = {
  nav: {
    home: "nav-home",
    broadcast: "nav-broadcast",
    ask: "nav-ask",
    presser: "nav-presser",
    fantasy: "nav-fantasy",
    stats: "nav-stats",
    login: "nav-login",
    predictions: "nav-predictions",
  },
  home: {
    tickerBanner: "ticker-banner",
    panelHeading: "panel-heading",
    askCta: "home-ask-cta",
    analystCard: (id) => `analyst-card-${id}`,
    analystAskBtn: (id) => `analyst-ask-btn-${id}`,
    tickerTopic: (id) => `ticker-topic-${id}`,
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
    upgradeModal: "presser-upgrade-modal",
    upgradeConfirm: "presser-upgrade-confirm",
    questionCounter: "presser-question-counter",
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
  stats: {
    pageRoot: "stats-page",
    tabSkaters: "stats-tab-skaters",
    tabGoalies: "stats-tab-goalies",
    tabTeams: "stats-tab-teams",
    tabSchedule: "stats-tab-schedule",
  },
  fantasy: {
    pageRoot: "fantasy-page",
    upgradeBtn: "fantasy-upgrade-btn",
    saveRoster: "fantasy-save-roster",
    playerRow: (i) => `fantasy-player-${i}`,
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
