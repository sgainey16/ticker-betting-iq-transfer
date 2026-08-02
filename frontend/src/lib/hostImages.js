// Host image library — Reggie Banks & Marc Doyle. Five expressions each,
// paired so any two images can share the same broadcast desk backdrop.
//
// Adding new images: drop into /app/frontend/public/hosts/<persona>/ and
// register the file below with a semantic mood key. The `pickForRoute`
// helper picks a deterministic mood per pathname so the SAME page always
// shows the SAME face (no jarring reshuffles on re-visit).

const BASE = "/hosts";

export const REGGIE = {
  warm:       `${BASE}/reggie/reggie_warm.png`,       // default idle, side-glance
  celebrate:  `${BASE}/reggie/reggie_celebrate.png`,  // fist-pump / goal call
  laughing:   `${BASE}/reggie/reggie_laughing.png`,   // banter / punchline
  skeptical:  `${BASE}/reggie/reggie_skeptical.png`,  // hand on chin, "coach not casino"
  surprised:  `${BASE}/reggie/reggie_surprised.png`,  // wide eyes, hot take
};

export const MARC = {
  warm:       `${BASE}/marc/marc_warm.png`,           // warm contented smile
  smile:      `${BASE}/marc/marc_smile.png`,          // subtle amused
  explaining: `${BASE}/marc/marc_explaining.png`,     // hand out, teaching
  excited:    `${BASE}/marc/marc_excited.png`,        // rare hype moment
  neutral:    `${BASE}/marc/marc_neutral.png`,        // analytical / notes
};

export const HOSTS = { reggie: REGGIE, marc: MARC };

export const HOST_NAMES = {
  reggie: "Reggie Banks",
  marc:   "Marc Doyle",
};

export const HOST_ROLES = {
  reggie: "Hockey Analyst",
  marc:   "Numbers Guy",
};

// Route → mood mapping. Keeps a page's portrait consistent per visit while
// letting each page show a different face — the whole point of the rotation.
// Add new routes here as we add pages. `default` catches everything else.
const ROUTE_MOOD = {
  "/home-v2":         { reggie: "warm",       marc: "warm" },       // welcoming home vibe
  "/show":            { reggie: "surprised",  marc: "excited" },    // pregame energy
  "/scoreboard":      { reggie: "celebrate",  marc: "explaining" }, // live action
  "/":                { reggie: "skeptical",  marc: "neutral" },    // recap = analysis mode
  "/uncut":           { reggie: "laughing",   marc: "smile" },      // banter podcast
  "/press-conference":{ reggie: "surprised",  marc: "explaining" }, // 1-on-1 press
  "/lineup":          { reggie: "skeptical",  marc: "neutral" },    // roster analysis
  "/player":          { reggie: "skeptical",  marc: "explaining" }, // player deep-dive
  default:            { reggie: "warm",       marc: "warm" },
};

export function pickForRoute(pathname, persona) {
  if (!pathname) return HOSTS[persona].warm || HOSTS[persona].neutral;
  // Longest-prefix match — "/uncut/canucks" resolves to "/uncut" rule.
  const routes = Object.keys(ROUTE_MOOD).filter((r) => r !== "default");
  const match  = routes
    .filter((r) => pathname === r || pathname.startsWith(r + "/") || (r === "/" && pathname === "/"))
    .sort((a, b) => b.length - a.length)[0] || "default";
  const mood = ROUTE_MOOD[match]?.[persona] || "warm";
  return HOSTS[persona][mood] || HOSTS[persona].warm || HOSTS[persona].neutral;
}
