// Ticker+ Catalog
// -----------------------------------------------------------------------------
// One curated data file for the "Ticker+" cascade (CHL + NCAA + prospects).
// Kept intentionally as a hand-authored fixture so the whole experience can be
// designed and demoed without any live API dependency. When the season starts
// and the ingestion pipeline (YouTube Data API v3 + Highlightly/Sportradar)
// comes online, each of these arrays gets replaced by a live query — nothing
// downstream cares about the source.
//
// Everything here is:
//   • deliberately small (only what a first-run demo needs)
//   • strongly typed by convention (see shape blocks below)
//   • organized so the Ranker can read it and score packages with the
//     simple heuristic we discussed:
//       score =  2·prospect_stock + 2·storyline + 1·importance
//              + 2·follows_this_team + 1·recency
//
// Naming: keep team codes 3-letter, prospect ids kebab-slug lastname-first.

// ----------------------------- NHL teams ------------------------------------
// Curated to a handful of anchor teams so the NHL step of onboarding doesn't
// require asset work for all 32. In production this becomes a full list.
export const NHL_TEAMS = [
  { code: "BOS", name: "Boston Bruins",       primary: "#FFB81C", region: "Northeast" },
  { code: "NYR", name: "New York Rangers",    primary: "#0038A8", region: "Metro" },
  { code: "PHI", name: "Philadelphia Flyers", primary: "#F74902", region: "Metro" },
  { code: "PIT", name: "Pittsburgh Penguins", primary: "#FCB514", region: "Metro" },
  { code: "TOR", name: "Toronto Maple Leafs", primary: "#00205B", region: "Central-CA" },
  { code: "MTL", name: "Montreal Canadiens",  primary: "#AF1E2D", region: "Quebec" },
  { code: "OTT", name: "Ottawa Senators",     primary: "#C52032", region: "Central-CA" },
  { code: "DET", name: "Detroit Red Wings",   primary: "#CE1126", region: "Central-US" },
  { code: "CHI", name: "Chicago Blackhawks",  primary: "#CF0A2C", region: "Central-US" },
  { code: "COL", name: "Colorado Avalanche",  primary: "#6F263D", region: "Mountain" },
  { code: "EDM", name: "Edmonton Oilers",     primary: "#FF4C00", region: "West-CA" },
  { code: "CGY", name: "Calgary Flames",      primary: "#C8102E", region: "West-CA" },
  { code: "VAN", name: "Vancouver Canucks",   primary: "#00205B", region: "West-CA" },
  { code: "SEA", name: "Seattle Kraken",      primary: "#001628", region: "Pacific-US" },
  { code: "SJS", name: "San Jose Sharks",     primary: "#006D75", region: "Pacific-US" },
  { code: "LAK", name: "Los Angeles Kings",   primary: "#111111", region: "Pacific-US" },
];

// ----------------------------- CHL divisions --------------------------------
// Focused on WHL for the first vertical. Each team carries the metadata the
// team-page and cascade pages need. `nhlAffinity` powers the onboarding
// nudge — Canucks fan → suggest Kamloops/Vancouver/Victoria etc.
// `stats` gives us enough for the team page to *look* like the NHL HomeV2
// layout without being the exact same component. Only populated for the
// launch-pilot teams so far — others render a lighter card until we have
// real data.
//
// LOGOS — NOT LICENSED FOR LAUNCH. See /app/memory/LEGAL_TODO.md.
// URLs point at Wikipedia's Special:FilePath which resolves to a stable
// image asset. Editorial / nominative-fair-use is generally defensible for
// this identification purpose, but before public launch we need to swap in
// either (a) team-supplied brand kit assets from a formal partnership, or
// (b) a licensed data-provider CDN (Highlightly Pro / Sportradar). The
// <TeamLogo> component gracefully falls back to a coloured initial badge
// if any image fails to load.
const WP = "https://en.wikipedia.org/wiki/Special:FilePath";
export const CHL_DIVISIONS = [
  {
    league: "WHL",
    code: "BC",
    name: "BC Division",
    teams: [
      {
        code: "KAM", name: "Kamloops Blazers", city: "Kamloops, BC", primary: "#F58220", nhlAffinity: ["VAN", "SEA"],
        logoUrl: `${WP}/Kamloops_Blazers_logo.svg`,
        stats: {
          record: { w: 34, l: 16, ot: 4, points: 72, standing: "2nd BC" },
          form: "7-2-1 last 10",
          identity: [
            { label: "Elite Power Play",   detail: "4th WHL · 26.8%", tone: "good" },
            { label: "Prospect Pipeline",  detail: "3 NHL-orbit picks", tone: "good" },
            { label: "Even-Strength Push", detail: "51.4% CF at 5v5", tone: "good" },
            { label: "Discipline",         detail: "9.2 PIM/g · 18th", tone: "bad" },
          ],
          reggieNote: "The PP is a real weapon and three of these kids are gonna hear their name at the draft. Just gotta stay out of the box.",
        },
      },
      {
        code: "KEL", name: "Kelowna Rockets", city: "Kelowna, BC", primary: "#902A29", nhlAffinity: ["VAN", "SEA"],
        logoUrl: `${WP}/Kelowna_Rockets_logo.svg`,
        stats: {
          record: { w: 38, l: 12, ot: 5, points: 81, standing: "1st BC" },
          form: "9-1-0 last 10",
          identity: [
            { label: "Best PP in WHL",   detail: "1st · 29.4%",     tone: "good" },
            { label: "Top PK in WHL",    detail: "4th · 84.1%",     tone: "good" },
            { label: "Goals Per Game",   detail: "4.11 · 2nd",      tone: "good" },
            { label: "Late-Game Fatigue",detail: "3rd-period GA up",tone: "bad" },
          ],
          reggieNote: "Nobody in the WHL is playing better right now. Systems team. PP and PK both top-five — that's a championship recipe.",
        },
      },
      {
        code: "VIC", name: "Victoria Royals", city: "Victoria, BC", primary: "#052A6A", nhlAffinity: ["VAN", "SEA"],
        logoUrl: `${WP}/Victoria_Royals_logo.svg`,
        stats: {
          record: { w: 22, l: 26, ot: 6, points: 50, standing: "5th BC" },
          form: "4-6-0 last 10",
          identity: [
            { label: "Cristall Show",    detail: "62 pts in 48 GP",  tone: "good" },
            { label: "Improving Under 20s",detail: "4 draft-eligible",tone: "good" },
            { label: "Struggling PK",    detail: "76.1% · 19th",     tone: "bad" },
            { label: "Road Trouble",     detail: "8-14 away",        tone: "bad" },
          ],
          reggieNote: "Andrew Cristall is putting up numbers most NHL forwards can't touch. The team around him is finding its identity — patience pays off.",
        },
      },
      { code: "VAN", name: "Vancouver Giants",     city: "Langley, BC",       primary: "#B02531", nhlAffinity: ["VAN"],       logoUrl: `${WP}/Vancouver_Giants_logo.svg` },
      { code: "PG",  name: "Prince George Cougars",city: "Prince George, BC", primary: "#2C3E82", nhlAffinity: ["VAN", "EDM"], logoUrl: `${WP}/Prince_George_Cougars_logo.svg` },
    ],
  },
  {
    league: "WHL", code: "US", name: "U.S. Division",
    teams: [
      { code: "PDX", name: "Portland Winterhawks", city: "Portland, OR",  primary: "#000000", nhlAffinity: ["SEA"], logoUrl: `${WP}/Portland_Winterhawks_logo.svg` },
      { code: "SPO", name: "Spokane Chiefs",       city: "Spokane, WA",   primary: "#C41230", nhlAffinity: ["SEA"], logoUrl: `${WP}/Spokane_Chiefs_logo.svg` },
      { code: "SEA", name: "Seattle Thunderbirds", city: "Kent, WA",      primary: "#003F87", nhlAffinity: ["SEA"], logoUrl: `${WP}/Seattle_Thunderbirds_logo.svg` },
      { code: "TRI", name: "Tri-City Americans",   city: "Kennewick, WA", primary: "#C8102E", nhlAffinity: ["SEA"], logoUrl: `${WP}/Tri-City_Americans_logo.svg` },
      { code: "EVE", name: "Everett Silvertips",   city: "Everett, WA",   primary: "#0C2340", nhlAffinity: ["SEA"], logoUrl: `${WP}/Everett_Silvertips_logo.svg` },
    ],
  },
  {
    league: "OHL", code: "MID", name: "Midwest Division",
    teams: [
      {
        code: "KIT", name: "Kitchener Rangers", city: "Kitchener, ON", primary: "#C41230", nhlAffinity: ["TOR"],
        logoUrl: `${WP}/Kitchener_Rangers_logo.svg`,
        stats: {
          record: { w: 30, l: 20, ot: 4, points: 64, standing: "3rd Mid" },
          form: "6-3-1 last 10",
          identity: [
            { label: "Petrov Effect",   detail: "Leads OHL in shifts noticed", tone: "good" },
            { label: "Youth Movement",  detail: "5 rookies playing top 6",     tone: "good" },
            { label: "Even-Strength D", detail: "2.51 xGA/60 · 8th",           tone: "good" },
            { label: "PP Cold Streak",  detail: "1-for-19 last two weeks",     tone: "bad" },
          ],
          reggieNote: "Petrov's captaincy is the story. NHL rooms are already watching the tape. Fix the PP and this team goes deep.",
        },
      },
      { code: "LDN", name: "London Knights",    city: "London, ON",  primary: "#0D6B37", nhlAffinity: ["TOR", "DET"], logoUrl: `${WP}/London_Knights_logo.svg` },
      { code: "WSR", name: "Windsor Spitfires", city: "Windsor, ON", primary: "#F58220", nhlAffinity: ["DET"],        logoUrl: `${WP}/Windsor_Spitfires_logo.svg` },
      { code: "SAG", name: "Saginaw Spirit",    city: "Saginaw, MI", primary: "#0F2A5A", nhlAffinity: ["DET"],        logoUrl: `${WP}/Saginaw_Spirit_logo.svg` },
    ],
  },
];

// ----------------------------- NCAA conferences -----------------------------
export const NCAA_CONFERENCES = [
  {
    code: "B1G",
    name: "Big Ten Hockey",
    teams: [
      {
        code: "MICH", name: "Michigan Wolverines", city: "Ann Arbor, MI", primary: "#00274C", nhlAffinity: ["DET"],
        stats: {
          record: { w: 22, l: 10, ot: 2, points: 46, standing: "1st B1G" },
          form: "8-2-0 last 10",
          identity: [
            { label: "Howard's Freshman Year", detail: "Leads B1G rookies · 28 pts", tone: "good" },
            { label: "Yost Ice Advantage",     detail: "13-2 at home",              tone: "good" },
            { label: "Elite PP",               detail: "24.1% · 2nd B1G",           tone: "good" },
            { label: "Underclassmen D",        detail: "Growing pains vs top lines", tone: "bad" },
          ],
          reggieNote: "Howard is playing older than his class. Michigan owns Yost. This roster has the ceiling of a Frozen Four team.",
        },
      },
      { code: "MSU",  name: "Michigan State Spartans", city: "East Lansing, MI", primary: "#18453B", nhlAffinity: ["DET"] },
      { code: "OSU",  name: "Ohio State Buckeyes",     city: "Columbus, OH",     primary: "#BB0000", nhlAffinity: ["DET", "PIT"] },
      { code: "WISC", name: "Wisconsin Badgers",       city: "Madison, WI",      primary: "#C5050C", nhlAffinity: ["CHI"] },
      { code: "MINN", name: "Minnesota Golden Gophers",city: "Minneapolis, MN",  primary: "#7A0019", nhlAffinity: ["CHI"] },
      { code: "PSU",  name: "Penn State Nittany Lions",city: "State College, PA",primary: "#001E44", nhlAffinity: ["PIT", "PHI"] },
      { code: "ND",   name: "Notre Dame Fighting Irish",city: "South Bend, IN",  primary: "#0C2340", nhlAffinity: ["CHI", "DET"] },
    ],
  },
  {
    code: "HE",
    name: "Hockey East",
    teams: [
      {
        code: "BU", name: "Boston University Terriers", city: "Boston, MA", primary: "#CC0000", nhlAffinity: ["BOS"],
        stats: {
          record: { w: 18, l: 12, ot: 3, points: 39, standing: "2nd Hockey East" },
          form: "6-3-1 last 10",
          identity: [
            { label: "Kelso's Emergence",    detail: "Freshman top-pair D",       tone: "good" },
            { label: "USNTDP Pipeline",      detail: "6 draft-orbit players",     tone: "good" },
            { label: "Agganis Home Ice",     detail: "11-3-1 in Boston",          tone: "good" },
            { label: "Third-Period Leaks",   detail: ".891 save in P3",           tone: "bad" },
          ],
          reggieNote: "BU has draft-eligible kids on every line. Kelso is playing like a senior as a freshman. Beanpot night should be electric.",
        },
      },
      { code: "BC",   name: "Boston College Eagles",      city: "Chestnut Hill, MA", primary: "#8B0A1B", nhlAffinity: ["BOS"] },
      { code: "PROV", name: "Providence Friars",          city: "Providence, RI",primary: "#000000", nhlAffinity: ["BOS"] },
      { code: "UML",  name: "UMass Lowell River Hawks",   city: "Lowell, MA",   primary: "#003DA5", nhlAffinity: ["BOS"] },
    ],
  },
];

// ----------------------------- Prospects ------------------------------------
// The bait for onboarding. Each prospect ties to teams they play for and the
// NHL orbit they're on. Fields are aggressive but honest — no puffery.
export const PROSPECTS = [
  {
    id: "oliver-kaid", first: "Kaid", last: "Oliver", pos: "C", age: 17,
    juniorTeam: "KAM", ncaaTeam: null, draftYear: 2026, draftRank: 14,
    nhlOrbit: ["VAN", "SEA", "EDM"],
    tagline: "Two-way center with a first-round release. Scores in traffic.",
    developmentStory: "First WHL season as a 16-year-old was quiet. Second season he added ten pounds and a shot the goalie can't read — 22 goals through Christmas. Scouts love his shift-to-shift compete.",
  },
  {
    id: "boumedienne-owen", first: "Owen", last: "Boumedienne", pos: "D", age: 18,
    juniorTeam: "KAM", ncaaTeam: null, draftYear: 2026, draftRank: 22,
    nhlOrbit: ["VAN", "MTL", "NYR"],
    tagline: "Six-foot-four D with a 91-mph release. Skates like a forward.",
    developmentStory: "Grew three inches between draft years and kept his edges. Runs the Blazers' PP1 and eats big minutes 5v5. Scouts describe the shot as 'punishing.'",
  },
  {
    id: "sop-jaden", first: "Jaden", last: "Sop", pos: "RW", age: 18,
    juniorTeam: "KAM", ncaaTeam: null, draftYear: 2026, draftRank: 31,
    nhlOrbit: ["VAN", "CGY"],
    tagline: "Power-play sniper. Reads the D and holds his release.",
    developmentStory: "Fifteen power-play goals by New Year on a team that runs a 1-3-1 with real puck movement. The one-timer is scouts' favorite tape.",
  },
  {
    id: "cristall-andrew", first: "Andrew", last: "Cristall", pos: "LW", age: 19,
    juniorTeam: "VIC", ncaaTeam: null, draftYear: 2025, draftRank: 40,
    nhlOrbit: ["WSH"],
    tagline: "Elite creator. Sees the ice a second before everyone else.",
    developmentStory: "Post-draft season is where the good ones separate. Cristall is running Victoria's offense and has real dynasty stock.",
  },
  {
    id: "howard-gabe", first: "Gabe", last: "Howard", pos: "C", age: 17,
    juniorTeam: null, ncaaTeam: "MICH", draftYear: 2026, draftRank: 8,
    nhlOrbit: ["DET", "CHI"],
    tagline: "NCAA freshman with the fastest hands in the Big Ten.",
    developmentStory: "Skipped the OHL to play with Michigan. Adjusting to the grown-man college game faster than anyone predicted — leading Wolverines rookies in points.",
  },
  {
    id: "kelso-riley", first: "Riley", last: "Kelso", pos: "D", age: 18,
    juniorTeam: null, ncaaTeam: "BU", draftYear: 2026, draftRank: 19,
    nhlOrbit: ["BOS", "NYR"],
    tagline: "Two-way defenseman running BU's back end as a freshman.",
    developmentStory: "USNTDP grad. Boston University handed him top-pair minutes on night one. He's played every situation and hasn't blinked.",
  },
  {
    id: "petrov-max", first: "Max", last: "Petrov", pos: "C", age: 17,
    juniorTeam: "KIT", ncaaTeam: null, draftYear: 2026, draftRank: 11,
    nhlOrbit: ["TOR", "PHI"],
    tagline: "Kitchener's engine. Every shift matters to him.",
    developmentStory: "Doesn't lead the OHL in points, but leads the OHL in shifts-you-notice. Elite compete, elite hockey IQ, jumps in NHL video rooms.",
  },
  {
    id: "trudeau-jack", first: "Jack", last: "Trudeau", pos: "RW", age: 18,
    juniorTeam: "LDN", ncaaTeam: null, draftYear: 2026, draftRank: 25,
    nhlOrbit: ["MTL", "OTT"],
    tagline: "London Knights' finisher. Twenty-plus already.",
    developmentStory: "The Knights breed goal-scorers and Trudeau is the next one. Two-plus goals a week when the team plays fast.",
  },
];

// ----------------------------- Packages -------------------------------------
// A "package" is a Ranker-scoreable content unit. Real ones will be produced
// by the Auto-Producer from live event data + YouTube. Here they are
// hand-authored so the cascade can be *felt* end-to-end.
//
// Fields explained:
//   • kind      "goal" | "recap" | "prospect_night" | "feature"
//   • teams     team codes touched by this package (used by Ranker)
//   • prospects prospect ids featured (used by Ranker)
//   • storyline "milestone" | "rivalry" | "comeback" | "debut" | "seal" | null
//   • importance 1-5, package-level (playoff race > mid-season)
//   • baseScore  the Ranker's fixed portion, before per-user weights
//   • video      { kind: "youtube" | "poster", ytId?: string }
//   • hosts      inline Reggie/Marc micro-script for the tile preview
export const PACKAGES = [
  // ---- Kamloops-heavy content ----
  {
    id: "kam-vs-vic-mar6",
    kind: "recap",
    league: "WHL",
    division: "BC",
    teams: ["KAM", "VIC"],
    prospects: ["oliver-kaid", "boumedienne-owen", "sop-jaden", "cristall-andrew"],
    title: "Blazers grind out Victoria, 3-2",
    subtitle: "Sandman Centre · Fri Mar 6",
    storyline: "seal",
    importance: 4,
    baseScore: 8.2,
    video: { kind: "desk-show", route: "/whl/desk-show" },
    hosts: [
      { speaker: "reggie", text: "Blazers hold serve at home." },
      { speaker: "marc",   text: "Three goals from three future NHL picks — that's the story." },
    ],
    thumbTag: "DESK SHOW",
  },
  {
    id: "kam-oliver-highlight-reel",
    kind: "prospect_night",
    league: "WHL",
    division: "BC",
    teams: ["KAM"],
    prospects: ["oliver-kaid"],
    title: "Kaid Oliver · Fourteen straight",
    subtitle: "Twelfth top-shelf goal of the month",
    storyline: "milestone",
    importance: 3,
    baseScore: 7.5,
    video: { kind: "poster" },
    hosts: [
      { speaker: "reggie", text: "He picks the same corner every night and it still goes in." },
      { speaker: "marc",   text: "Two ninety xG shot on this one. That's not luck, that's craft." },
    ],
    thumbTag: "PROSPECT",
  },
  {
    id: "kam-boumedienne-cannon",
    kind: "goal",
    league: "WHL",
    division: "BC",
    teams: ["KAM"],
    prospects: ["boumedienne-owen"],
    title: "Boumedienne · 91-mph seal",
    subtitle: "Third-period slap shot from the point",
    storyline: "seal",
    importance: 3,
    baseScore: 7.1,
    video: { kind: "poster" },
    hosts: [
      { speaker: "reggie", text: "Frenchman winds it up — still rising when it hit twine." },
      { speaker: "marc",   text: "That is a first-round-caliber release from the blue line." },
    ],
    thumbTag: "GOAL",
  },
  {
    id: "kam-vs-kel-rivalry-preview",
    kind: "matchup",
    league: "WHL",
    division: "BC",
    teams: ["KAM", "KEL"],
    prospects: ["oliver-kaid"],
    title: "Highway 97: Blazers @ Rockets, Saturday",
    subtitle: "Second-place BC vs first-place BC · 8:00 PT",
    storyline: "rivalry",
    importance: 5,
    baseScore: 8.0,
    video: { kind: "poster" },
    hosts: [
      { speaker: "reggie", text: "Highway 97, biggest night on the BC calendar." },
      { speaker: "marc",   text: "Rockets sit first in the division. Blazers get to punch up." },
    ],
    thumbTag: "PREVIEW",
    matchup: {
      away: { code: "KAM", label: "Blazers" },
      home: { code: "KEL", label: "Rockets" },
      when: "Sat · 8:00 PT",
      where: "Prospera Place · Kelowna",
    },
    watchLinks: {
      paid: { label: "Watch on CHL TV", provider: "CHL TV", url: "https://watch.chl.ca/", utm: "kam_kel_matchup_paid" },
      free: { label: "Free preview clips", provider: "WHL YouTube", url: "https://www.youtube.com/@WHL/videos", utm: "kam_kel_matchup_free" },
    },
  },
  // ---- Rest of BC Division ----
  {
    id: "vic-cristall-triple",
    kind: "prospect_night",
    league: "WHL",
    division: "BC",
    teams: ["VIC"],
    prospects: ["cristall-andrew"],
    title: "Cristall · Three-point night in Victoria",
    subtitle: "Royals top Everett 5-2",
    storyline: "milestone",
    importance: 3,
    baseScore: 6.8,
    video: { kind: "poster" },
    hosts: [
      { speaker: "reggie", text: "Cristall is running Victoria's offense like a chef." },
      { speaker: "marc",   text: "Post-draft season is where the good ones separate. He's separating." },
    ],
    thumbTag: "PROSPECT",
  },
  {
    id: "kel-first-place",
    kind: "feature",
    league: "WHL",
    division: "BC",
    teams: ["KEL"],
    prospects: [],
    title: "Rockets take over first in BC",
    subtitle: "Nine straight and counting",
    storyline: "milestone",
    importance: 4,
    baseScore: 6.5,
    video: { kind: "poster" },
    hosts: [
      { speaker: "reggie", text: "Nobody in the WHL is playing better hockey than Kelowna right now." },
      { speaker: "marc",   text: "PP is second in the league. PK is fourth. Systems team." },
    ],
    thumbTag: "STANDINGS",
  },
  {
    id: "pg-goalie-shutout",
    kind: "recap",
    league: "WHL",
    division: "BC",
    teams: ["PG"],
    prospects: [],
    title: "Cougars stone Portland, 4-0",
    subtitle: "First shutout for the rookie tender",
    storyline: "debut",
    importance: 3,
    baseScore: 6.1,
    video: { kind: "poster" },
    hosts: [
      { speaker: "reggie", text: "Prince George's kid tender turned twenty-eight shots away." },
      { speaker: "marc",   text: "Big frame, quiet hands. Watch the family name — you'll be typing it a lot." },
    ],
    thumbTag: "RECAP",
  },
  {
    id: "van-giants-return",
    kind: "recap",
    league: "WHL",
    division: "BC",
    teams: ["VAN"],
    prospects: [],
    title: "Giants back in the win column",
    subtitle: "Snap a five-game skid vs Everett",
    storyline: "comeback",
    importance: 2,
    baseScore: 5.4,
    video: { kind: "poster" },
    hosts: [
      { speaker: "reggie", text: "Langley's been quiet — good to hear the Giants' barn loud again." },
      { speaker: "marc",   text: "Structure was there tonight. That's what young teams need to feel." },
    ],
    thumbTag: "RECAP",
  },

  // ---- NCAA / Big Ten ----
  {
    id: "mich-howard-debut",
    kind: "prospect_night",
    league: "NCAA",
    conference: "B1G",
    teams: ["MICH"],
    prospects: ["howard-gabe"],
    title: "Gabe Howard · Two-point Big Ten night",
    subtitle: "Michigan tops Wisconsin 4-2",
    storyline: "milestone",
    importance: 4,
    baseScore: 7.4,
    video: { kind: "poster" },
    hosts: [
      { speaker: "reggie", text: "Freshman phenom answered the bell against a top-five program." },
      { speaker: "marc",   text: "He's playing the grown-man game already. Fastest hands in the conference." },
    ],
    thumbTag: "PROSPECT",
  },
  {
    id: "bu-kelso-first-goal",
    kind: "prospect_night",
    league: "NCAA",
    conference: "HE",
    teams: ["BU"],
    prospects: ["kelso-riley"],
    title: "Riley Kelso · First NCAA goal",
    subtitle: "BU tops Providence 3-2 OT",
    storyline: "debut",
    importance: 3,
    baseScore: 6.9,
    video: { kind: "poster" },
    hosts: [
      { speaker: "reggie", text: "Freshman D-man buries his first — and it's the OT winner." },
      { speaker: "marc",   text: "USNTDP grad running BU's top pair already. Watch him." },
    ],
    thumbTag: "PROSPECT",
  },
  {
    id: "b1g-mich-vs-osu",
    kind: "matchup",
    league: "NCAA",
    conference: "B1G",
    teams: ["MICH", "OSU"],
    prospects: ["howard-gabe"],
    title: "Michigan @ Ohio State · Saturday",
    subtitle: "Top of the Big Ten on the line · 7:30 ET",
    storyline: "rivalry",
    importance: 5,
    baseScore: 7.8,
    video: { kind: "poster" },
    hosts: [
      { speaker: "reggie", text: "Big Ten hockey doesn't get bigger than this weekend." },
      { speaker: "marc",   text: "Two top-fifteen programs, one weekend, three future NHL picks on the ice." },
    ],
    thumbTag: "PREVIEW",
    matchup: {
      away: { code: "MICH", label: "Wolverines" },
      home: { code: "OSU",  label: "Buckeyes" },
      when: "Sat · 7:30 ET",
      where: "Value City Arena · Columbus",
    },
    watchLinks: {
      paid: { label: "Watch on Big Ten+", provider: "Big Ten Plus", url: "https://bigtenplus.com/", utm: "b1g_mich_osu_paid" },
      free: { label: "Free game preview", provider: "Big Ten YouTube", url: "https://www.youtube.com/@B1GHockey", utm: "b1g_mich_osu_free" },
    },
  },
  // ---- Marquee prospect-vs-prospect matchup — the exact "collision course"
  // ---- story we want driving traffic to CHL TV / FloHockey watch links.
  {
    id: "matchup-petrov-vs-howard",
    kind: "matchup",
    league: "MIX",
    teams: ["KIT", "MICH"],
    prospects: ["petrov-max", "howard-gabe"],
    title: "Petrov vs Howard · Draft-eligible showcase",
    subtitle: "Top-15 vs top-10 draft prospects, one week apart",
    storyline: "rivalry",
    importance: 5,
    baseScore: 8.6,
    video: { kind: "poster" },
    hosts: [
      { speaker: "reggie", text: "Two of the top ten kids in the class, playing on back-to-back nights." },
      { speaker: "marc",   text: "Petrov works the shifts. Howard's got the hands. Bring popcorn." },
    ],
    thumbTag: "PREVIEW",
    matchup: {
      away: { code: "KIT",  label: "Petrov · Kitchener (OHL)" },
      home: { code: "MICH", label: "Howard · Michigan (NCAA)" },
      when: "Fri OHL · Sat NCAA",
      where: "Both on national TV",
    },
    watchLinks: {
      paid: { label: "Watch OHL on CHL TV", provider: "CHL TV",     url: "https://watch.chl.ca/",           utm: "matchup_petrov_ohl_paid" },
      free: { label: "Michigan free clip",  provider: "B1G YouTube", url: "https://www.youtube.com/@B1GHockey", utm: "matchup_howard_ncaa_free" },
    },
  },
  {
    id: "he-hockey-east-standings",
    kind: "feature",
    league: "NCAA",
    conference: "HE",
    teams: ["BU", "BC", "PROV", "UML"],
    prospects: [],
    title: "Hockey East: Four teams within three points",
    subtitle: "The tightest race in college hockey",
    storyline: "rivalry",
    importance: 4,
    baseScore: 6.5,
    video: { kind: "poster" },
    hosts: [
      { speaker: "reggie", text: "Nobody's separating in Hockey East — best race in college hockey." },
      { speaker: "marc",   text: "Every weekend matters now. Playoff pace in January." },
    ],
    thumbTag: "STANDINGS",
  },

  // ---- OHL feature ----
  {
    id: "kit-petrov-shift",
    kind: "prospect_night",
    league: "OHL",
    division: "MID",
    teams: ["KIT"],
    prospects: ["petrov-max"],
    title: "Max Petrov · Every shift matters",
    subtitle: "Two goals, one fight, one buzzer",
    storyline: "milestone",
    importance: 4,
    baseScore: 7.0,
    video: { kind: "poster" },
    hosts: [
      { speaker: "reggie", text: "Kitchener's kid captain does something you notice every shift." },
      { speaker: "marc",   text: "Compete score off the charts. NHL rooms are already tracking him." },
    ],
    thumbTag: "PROSPECT",
  },
  {
    id: "ldn-trudeau-hat",
    kind: "prospect_night",
    league: "OHL",
    division: "MID",
    teams: ["LDN"],
    prospects: ["trudeau-jack"],
    title: "Jack Trudeau · First OHL hat trick",
    subtitle: "Knights roll Windsor 6-1",
    storyline: "milestone",
    importance: 3,
    baseScore: 6.8,
    video: { kind: "poster" },
    hosts: [
      { speaker: "reggie", text: "The Knights breed finishers. Trudeau's the next one." },
      { speaker: "marc",   text: "Three goals on eight shots. All from within the dots. That's a NHL skill." },
    ],
    thumbTag: "PROSPECT",
  },
];

// ----------------------------- Ranker ---------------------------------------
// The exact heuristic we discussed. Pure function — no side effects — so it's
// trivial to unit-test and swap for a learned model later without touching
// any consumer.
//
// profile shape: { nhl_team, chl_teams[], ncaa_teams[], prospects[] }
export function scorePackage(pkg, profile) {
  let s = pkg.baseScore ?? 5.0;

  // Local-team bonus — the biggest lever
  const following = new Set([
    ...(profile?.chl_teams  || []),
    ...(profile?.ncaa_teams || []),
    ...(profile?.nhl_team ? [profile.nhl_team] : []),
  ]);
  const overlaps = (pkg.teams || []).some(t => following.has(t));
  if (overlaps) s += 2.0;

  // Prospect bonus
  const followingProspects = new Set(profile?.prospects || []);
  const prospectOverlap = (pkg.prospects || []).some(p => followingProspects.has(p));
  if (prospectOverlap) s += 2.0;

  // NHL affinity — if any team in this package has draft-orbit ties to the
  // user's NHL team, gentle bonus (Canucks fan → Boumedienne heading their way)
  const nhlOrbitHit = (pkg.prospects || []).some(pid => {
    const pr = PROSPECTS.find(p => p.id === pid);
    return pr && pr.nhlOrbit?.includes(profile?.nhl_team);
  });
  if (nhlOrbitHit) s += 1.5;

  // Importance / storyline nudge — small, always-on
  if (pkg.storyline) s += 0.4;

  return Number(s.toFixed(2));
}

export function rankPackages(packages, profile, { limit } = {}) {
  const scored = packages.map(p => ({ pkg: p, score: scorePackage(p, profile) }));
  scored.sort((a, b) => b.score - a.score);
  return limit ? scored.slice(0, limit) : scored;
}

// Helpers used by pages
export function teamByCode(code) {
  for (const div of CHL_DIVISIONS) {
    const t = div.teams.find(x => x.code === code);
    if (t) return { ...t, league: div.league, division: div.code };
  }
  for (const conf of NCAA_CONFERENCES) {
    const t = conf.teams.find(x => x.code === code);
    if (t) return { ...t, league: "NCAA", conference: conf.code };
  }
  const nhl = NHL_TEAMS.find(x => x.code === code);
  if (nhl) return { ...nhl, league: "NHL" };
  return null;
}

export function prospectsForTeam(code) {
  return PROSPECTS.filter(p => p.juniorTeam === code || p.ncaaTeam === code);
}

export function suggestJuniorTeamsForNhl(nhlCode) {
  const all = CHL_DIVISIONS.flatMap(d => d.teams.map(t => ({ ...t, league: d.league, division: d.code })));
  return all.filter(t => (t.nhlAffinity || []).includes(nhlCode));
}

export function suggestNcaaTeamsForNhl(nhlCode) {
  const all = NCAA_CONFERENCES.flatMap(c => c.teams.map(t => ({ ...t, league: "NCAA", conference: c.code })));
  return all.filter(t => (t.nhlAffinity || []).includes(nhlCode));
}

export function suggestProspectsForProfile(profile) {
  // Prospects on the user's teams first, then prospects in their NHL team's orbit,
  // then top-ranked overall.
  const scored = PROSPECTS.map(p => {
    let s = 100 - (p.draftRank ?? 100);
    if (profile?.chl_teams?.includes(p.juniorTeam)) s += 40;
    if (profile?.ncaa_teams?.includes(p.ncaaTeam)) s += 40;
    if (profile?.nhl_team && p.nhlOrbit?.includes(profile.nhl_team)) s += 20;
    return { p, s };
  });
  scored.sort((a, b) => b.s - a.s);
  return scored.map(x => x.p);
}
