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
// Wikipedia's Special:FilePath endpoint — hotlink-friendly host for public
// logo SVGs. Used across CHL/NCAA/AHL until we license better assets.
const WP = "https://en.wikipedia.org/wiki/Special:FilePath";

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

// ----------------------------- AHL affiliates -------------------------------
// Every NHL franchise has an AHL farm team where their prospects actually
// develop. The Ticker folds that into the parent-team fan experience: your
// NHL team's AHL club shows up automatically in the favorites rail with an
// "AHL" badge, and taps into a dedicated affiliate page.
//
// Data source: hand-seeded from public AHL affiliation records. Logo URLs
// point at Wikipedia's Special:FilePath (same nominative-fair-use posture
// as CHL/NCAA — swap to licensed assets before public launch).
export const AHL_AFFILIATES = {
  ANA: { code: "SD",   name: "San Diego Gulls",         city: "San Diego, CA",     primary: "#F47A38", logoUrl: `${WP}/San_Diego_Gulls_logo.svg` },
  BOS: { code: "PROV_AHL", name: "Providence Bruins",   city: "Providence, RI",    primary: "#FFB81C", logoUrl: `${WP}/Providence_Bruins_logo.svg` },
  BUF: { code: "ROC",  name: "Rochester Americans",     city: "Rochester, NY",     primary: "#C8102E", logoUrl: `${WP}/Rochester_Americans_logo.svg` },
  CGY: { code: "CWF",  name: "Calgary Wranglers",       city: "Calgary, AB",       primary: "#C8102E", logoUrl: `${WP}/Calgary_Wranglers_logo.svg` },
  CAR: { code: "CHI_AHL", name: "Chicago Wolves",       city: "Rosemont, IL",      primary: "#22282F", logoUrl: `${WP}/Chicago_Wolves_logo.svg` },
  CHI: { code: "RFD",  name: "Rockford IceHogs",        city: "Rockford, IL",      primary: "#CF0A2C", logoUrl: `${WP}/Rockford_IceHogs_logo.svg` },
  COL: { code: "COLE", name: "Colorado Eagles",         city: "Loveland, CO",      primary: "#183478", logoUrl: `${WP}/Colorado_Eagles_logo.svg` },
  CBJ: { code: "CLE",  name: "Cleveland Monsters",      city: "Cleveland, OH",     primary: "#002F86", logoUrl: `${WP}/Cleveland_Monsters_logo.svg` },
  DAL: { code: "TEX",  name: "Texas Stars",             city: "Cedar Park, TX",    primary: "#006847", logoUrl: `${WP}/Texas_Stars_logo.svg` },
  DET: { code: "GR",   name: "Grand Rapids Griffins",   city: "Grand Rapids, MI",  primary: "#8B2131", logoUrl: `${WP}/Grand_Rapids_Griffins_logo.svg` },
  EDM: { code: "BAK",  name: "Bakersfield Condors",     city: "Bakersfield, CA",   primary: "#000000", logoUrl: `${WP}/Bakersfield_Condors_logo.svg` },
  FLA: { code: "CHA",  name: "Charlotte Checkers",      city: "Charlotte, NC",     primary: "#C8102E", logoUrl: `${WP}/Charlotte_Checkers_logo.svg` },
  LAK: { code: "ONT",  name: "Ontario Reign",           city: "Ontario, CA",       primary: "#111111", logoUrl: `${WP}/Ontario_Reign_logo.svg` },
  MIN: { code: "IA",   name: "Iowa Wild",               city: "Des Moines, IA",    primary: "#154734", logoUrl: `${WP}/Iowa_Wild_logo.svg` },
  MTL: { code: "LAV",  name: "Laval Rocket",            city: "Laval, QC",         primary: "#0060A9", logoUrl: `${WP}/Laval_Rocket_logo.svg` },
  NSH: { code: "MIL",  name: "Milwaukee Admirals",      city: "Milwaukee, WI",     primary: "#0033A0", logoUrl: `${WP}/Milwaukee_Admirals_logo.svg` },
  NJD: { code: "UTC",  name: "Utica Comets",            city: "Utica, NY",         primary: "#B02531", logoUrl: `${WP}/Utica_Comets_logo.svg` },
  NYI: { code: "BRI",  name: "Bridgeport Islanders",    city: "Bridgeport, CT",    primary: "#00539B", logoUrl: `${WP}/Bridgeport_Islanders_logo.svg` },
  NYR: { code: "HFD",  name: "Hartford Wolf Pack",      city: "Hartford, CT",      primary: "#0038A8", logoUrl: `${WP}/Hartford_Wolf_Pack_logo.svg` },
  OTT: { code: "BEL",  name: "Belleville Senators",     city: "Belleville, ON",    primary: "#C52032", logoUrl: `${WP}/Belleville_Senators_logo.svg` },
  PHI: { code: "LV",   name: "Lehigh Valley Phantoms",  city: "Allentown, PA",     primary: "#F74902", logoUrl: `${WP}/Lehigh_Valley_Phantoms_logo.svg` },
  PIT: { code: "WBS",  name: "Wilkes-Barre/Scranton Penguins", city: "Wilkes-Barre, PA", primary: "#FCB514", logoUrl: `${WP}/Wilkes-Barre_Scranton_Penguins_logo.svg` },
  SEA: { code: "CBD",  name: "Coachella Valley Firebirds", city: "Palm Desert, CA",primary: "#E4622A", logoUrl: `${WP}/Coachella_Valley_Firebirds_logo.svg` },
  SJS: { code: "SJ_AHL", name: "San Jose Barracuda",    city: "San Jose, CA",      primary: "#006D75", logoUrl: `${WP}/San_Jose_Barracuda_logo.svg` },
  STL: { code: "SPR",  name: "Springfield Thunderbirds",city: "Springfield, MA",   primary: "#002F87", logoUrl: `${WP}/Springfield_Thunderbirds_logo.svg` },
  TBL: { code: "SYR",  name: "Syracuse Crunch",         city: "Syracuse, NY",      primary: "#004587", logoUrl: `${WP}/Syracuse_Crunch_logo.svg` },
  TOR: { code: "MRL",  name: "Toronto Marlies",         city: "Toronto, ON",       primary: "#00205B", logoUrl: `${WP}/Toronto_Marlies_logo.svg` },
  UTA: { code: "TUC",  name: "Tucson Roadrunners",      city: "Tucson, AZ",        primary: "#71AFE5", logoUrl: `${WP}/Tucson_Roadrunners_logo.svg` },
  VAN: { code: "ABB",  name: "Abbotsford Canucks",      city: "Abbotsford, BC",    primary: "#00205B", logoUrl: `${WP}/Abbotsford_Canucks_logo.svg` },
  VGK: { code: "HEN",  name: "Henderson Silver Knights",city: "Henderson, NV",     primary: "#B4975A", logoUrl: `${WP}/Henderson_Silver_Knights_logo.svg` },
  WSH: { code: "HER",  name: "Hershey Bears",           city: "Hershey, PA",       primary: "#8B2131", logoUrl: `${WP}/Hershey_Bears_logo.svg` },
  WPG: { code: "MB",   name: "Manitoba Moose",          city: "Winnipeg, MB",      primary: "#041E42", logoUrl: `${WP}/Manitoba_Moose_logo.svg` },
};

// Convenience getter: NHL code → { code, name, city, primary, logoUrl, nhl_parent }.
export function ahlAffiliateFor(nhlCode) {
  if (!nhlCode) return null;
  const affiliate = AHL_AFFILIATES[nhlCode.toUpperCase()];
  return affiliate ? { ...affiliate, nhl_parent: nhlCode.toUpperCase() } : null;
}


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
  // ----- QMJHL — Quebec Major Junior Hockey League -----
  {
    league: "QMJHL", code: "QMJHL-E", name: "QMJHL · Eastern",
    teams: [
      { code: "HFX", name: "Halifax Mooseheads",     city: "Halifax, NS",       primary: "#046A38", nhlAffinity: ["MTL"],        logoUrl: `${WP}/Halifax_Mooseheads_logo.svg` },
      { code: "MCT", name: "Moncton Wildcats",       city: "Moncton, NB",       primary: "#C8102E", nhlAffinity: ["MTL"],        logoUrl: `${WP}/Moncton_Wildcats_logo.svg` },
      { code: "CHI-Q", name: "Charlottetown Islanders", city: "Charlottetown, PEI", primary: "#1B3966", nhlAffinity: ["MTL"],     logoUrl: `${WP}/Charlottetown_Islanders_logo.svg` },
      { code: "SNB", name: "Saint John Sea Dogs",    city: "Saint John, NB",    primary: "#004F9F", nhlAffinity: ["MTL"],        logoUrl: `${WP}/Saint_John_Sea_Dogs_logo.svg` },
      { code: "CBB", name: "Cape Breton Eagles",     city: "Sydney, NS",        primary: "#001F5C", nhlAffinity: ["MTL"],        logoUrl: `${WP}/Cape_Breton_Eagles_logo.svg` },
    ],
  },
  {
    league: "QMJHL", code: "QMJHL-W", name: "QMJHL · Western",
    teams: [
      { code: "RIM", name: "Rimouski Océanic",        city: "Rimouski, QC",      primary: "#0060A9", nhlAffinity: ["MTL"],        logoUrl: `${WP}/Rimouski_Oc%C3%A9anic_logo.svg` },
      { code: "QUE", name: "Québec Remparts",         city: "Québec City, QC",   primary: "#C8102E", nhlAffinity: ["MTL"],        logoUrl: `${WP}/Qu%C3%A9bec_Remparts_logo.svg` },
      { code: "SHE", name: "Sherbrooke Phoenix",      city: "Sherbrooke, QC",    primary: "#231F20", nhlAffinity: ["MTL"],        logoUrl: `${WP}/Sherbrooke_Phoenix_logo.svg` },
      { code: "RN",  name: "Rouyn-Noranda Huskies",   city: "Rouyn-Noranda, QC", primary: "#231F20", nhlAffinity: ["MTL", "OTT"], logoUrl: `${WP}/Rouyn-Noranda_Huskies_logo.svg` },
      { code: "DRU", name: "Drummondville Voltigeurs",city: "Drummondville, QC", primary: "#B02531", nhlAffinity: ["MTL"],        logoUrl: `${WP}/Drummondville_Voltigeurs_logo.svg` },
      { code: "GAT", name: "Gatineau Olympiques",     city: "Gatineau, QC",      primary: "#C8102E", nhlAffinity: ["OTT", "MTL"], logoUrl: `${WP}/Gatineau_Olympiques_logo.svg` },
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
      { code: "UNH",  name: "New Hampshire Wildcats",     city: "Durham, NH",   primary: "#002855", nhlAffinity: ["BOS"] },
      { code: "UVM",  name: "Vermont Catamounts",         city: "Burlington, VT",primary: "#154734", nhlAffinity: ["BOS", "MTL"] },
      { code: "UMASS",name: "UMass Minutemen",            city: "Amherst, MA",  primary: "#881C1C", nhlAffinity: ["BOS"] },
      { code: "NU",   name: "Northeastern Huskies",       city: "Boston, MA",   primary: "#000000", nhlAffinity: ["BOS"] },
    ],
  },
  // ----- NCHC — National Collegiate Hockey Conference -----
  {
    code: "NCHC",
    name: "NCHC",
    teams: [
      { code: "DEN",  name: "Denver Pioneers",             city: "Denver, CO",       primary: "#8B2131", nhlAffinity: ["COL"] },
      { code: "UND",  name: "North Dakota Fighting Hawks", city: "Grand Forks, ND",  primary: "#009A44", nhlAffinity: ["MIN", "WPG"] },
      { code: "SCS",  name: "St. Cloud State Huskies",     city: "St. Cloud, MN",    primary: "#8B0A1B", nhlAffinity: ["MIN"] },
      { code: "UMD",  name: "Minnesota Duluth Bulldogs",   city: "Duluth, MN",       primary: "#7A0019", nhlAffinity: ["MIN"] },
      { code: "OMHA", name: "Omaha Mavericks",             city: "Omaha, NE",        primary: "#000000", nhlAffinity: ["STL"] },
      { code: "WMU",  name: "Western Michigan Broncos",    city: "Kalamazoo, MI",    primary: "#6C4023", nhlAffinity: ["DET"] },
      { code: "MIA",  name: "Miami RedHawks",              city: "Oxford, OH",       primary: "#B61E2E", nhlAffinity: ["CBJ"] },
      { code: "CC",   name: "Colorado College Tigers",     city: "Colorado Springs, CO", primary: "#000000", nhlAffinity: ["COL"] },
    ],
  },
  // ----- ECAC Hockey -----
  {
    code: "ECAC",
    name: "ECAC",
    teams: [
      { code: "CORN", name: "Cornell Big Red",             city: "Ithaca, NY",       primary: "#B31B1B", nhlAffinity: ["NYR", "BUF"] },
      { code: "HARV", name: "Harvard Crimson",             city: "Cambridge, MA",    primary: "#A51C30", nhlAffinity: ["BOS"] },
      { code: "QU",   name: "Quinnipiac Bobcats",          city: "Hamden, CT",       primary: "#00205B", nhlAffinity: ["NYR"] },
      { code: "YALE", name: "Yale Bulldogs",               city: "New Haven, CT",    primary: "#0F4D92", nhlAffinity: ["NYR"] },
      { code: "CLK",  name: "Clarkson Golden Knights",     city: "Potsdam, NY",      primary: "#046A38", nhlAffinity: ["MTL", "OTT"] },
      { code: "SLU",  name: "St. Lawrence Saints",         city: "Canton, NY",       primary: "#8B2131", nhlAffinity: ["OTT"] },
      { code: "DART", name: "Dartmouth Big Green",         city: "Hanover, NH",      primary: "#00693E", nhlAffinity: ["BOS"] },
      { code: "COLG", name: "Colgate Raiders",             city: "Hamilton, NY",     primary: "#8B0A1B", nhlAffinity: ["NYR"] },
    ],
  },
  // ----- CCHA — Central Collegiate Hockey Association -----
  {
    code: "CCHA",
    name: "CCHA",
    teams: [
      { code: "MTU",  name: "Michigan Tech Huskies",       city: "Houghton, MI",     primary: "#000000", nhlAffinity: ["DET"] },
      { code: "BGSU", name: "Bowling Green Falcons",       city: "Bowling Green, OH",primary: "#4F2C1D", nhlAffinity: ["CBJ", "DET"] },
      { code: "FSU",  name: "Ferris State Bulldogs",       city: "Big Rapids, MI",   primary: "#C8102E", nhlAffinity: ["DET"] },
      { code: "LSSU", name: "Lake Superior State Lakers",  city: "Sault Ste. Marie, MI", primary: "#00539F", nhlAffinity: ["DET"] },
      { code: "MSUM", name: "Minnesota State Mavericks",   city: "Mankato, MN",      primary: "#6D2077", nhlAffinity: ["MIN"] },
      { code: "NMU",  name: "Northern Michigan Wildcats",  city: "Marquette, MI",    primary: "#046A38", nhlAffinity: ["DET"] },
    ],
  },
  // ----- Atlantic Hockey America -----
  {
    code: "AHA",
    name: "Atlantic Hockey",
    teams: [
      { code: "RIT",  name: "RIT Tigers",                  city: "Rochester, NY",    primary: "#F76902", nhlAffinity: ["BUF"] },
      { code: "AIC",  name: "American International Yellow Jackets", city: "Springfield, MA", primary: "#B31B1B", nhlAffinity: ["BOS"] },
      { code: "BENT", name: "Bentley Falcons",             city: "Waltham, MA",      primary: "#003058", nhlAffinity: ["BOS"] },
      { code: "HC",   name: "Holy Cross Crusaders",        city: "Worcester, MA",    primary: "#5F0F40", nhlAffinity: ["BOS"] },
      { code: "AFA",  name: "Air Force Falcons",           city: "Colorado Springs, CO", primary: "#1B365D", nhlAffinity: ["COL"] },
      { code: "MERC", name: "Mercyhurst Lakers",           city: "Erie, PA",         primary: "#0057B7", nhlAffinity: ["PIT"] },
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
    // Roots connections — cross-referenced against the user's followed teams.
    // Ribbons only light up when there's an actual overlap; nothing pings
    // for fans of unrelated teams. See ROOTS_SEGMENT_SPEC.md for shape.
    connections: [
      { type: "trained_at", team: "VAN", league: "NHL", note: "Trained at the same Delta power-skating program that shaped four Canucks draft picks" },
      { type: "family", relation: "father", team: "EDM", league: "NHL", era: "1990s", note: "Oilers bloodlines · Father played 62 games in Edmonton in the mid-90s" },
    ],
  },
  {
    id: "boumedienne-owen", first: "Owen", last: "Boumedienne", pos: "D", age: 18,
    juniorTeam: "KAM", ncaaTeam: null, draftYear: 2026, draftRank: 22,
    nhlOrbit: ["VAN", "MTL", "NYR"],
    tagline: "Six-foot-four D with a 91-mph release. Skates like a forward.",
    developmentStory: "Grew three inches between draft years and kept his edges. Runs the Blazers' PP1 and eats big minutes 5v5. Scouts describe the shot as 'punishing.'",
    connections: [
      { type: "family", relation: "father", team: "MTL", league: "NHL", era: "1990s", note: "Habs bloodlines · Dad wore the jersey in '94" },
      { type: "hometown", team: "VAN", note: "Grew up thirty minutes from Rogers Arena" },
    ],
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
    connections: [
      { type: "played_for", team: "TOR", league: "OHL", years: "2022-23", note: "Former Toronto Marlboros minor-midget · same GTHL program as three current Leafs" },
      { type: "family", relation: "uncle", team: "PHI", league: "NHL", era: "2000s", note: "Flyers bloodlines · Uncle skated 214 NHL games in orange and black" },
    ],
  },
  {
    id: "trudeau-jack", first: "Jack", last: "Trudeau", pos: "RW", age: 18,
    juniorTeam: "LDN", ncaaTeam: null, draftYear: 2026, draftRank: 25,
    nhlOrbit: ["MTL", "OTT"],
    tagline: "London Knights' finisher. Twenty-plus already.",
    developmentStory: "The Knights breed goal-scorers and Trudeau is the next one. Two-plus goals a week when the team plays fast.",
    connections: [
      { type: "family", relation: "father", team: "MTL", league: "NHL", era: "1990s", note: "Habs bloodlines · Dad suited up for Montreal in '95" },
    ],
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
