/**
 * TeamRoomAudition — off-app prototype of the "Team Room" concept.
 *
 * Flips through 6 seed teams via a top-of-page switcher so we can feel how
 * the same layout re-themes with each franchise's colours. Placeholder
 * silhouettes stand in for the Reggie & Marc character illustrations
 * until we generate the real art with Nano Banana.
 *
 * Route: /audition/team-room  (+ /audition/team-room/:code for direct link)
 */
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Flame, Snowflake, ChevronRight, Trophy, Send } from "lucide-react";
import { TeamLogo } from "@/lib/teamLogos";
import { TMark, C } from "@/lib/brand";

/* -----------------------------------------------------------
 * SEED — per-team theme + content bundle.
 * All static so the audition renders instantly.
 * When we promote to /team-room, backend hydrates these from NHL/Highlightly.
 * ----------------------------------------------------------- */
const TEAMS = {
  BOS: {
    code: "BOS", name: "BRUINS", city: "Boston",
    primary: "#FFB81C", accent: "#FCB514", bg: "#1a1408", panel: "#211a0a",
    neonText: "GO BRUINS GO",
    record: "44-17-5", points: 93, division: "1ST ATLANTIC", streak: "WON 4 STRAIGHT",
    tonight: { opp: "EDM", oppName: "OILERS", time: "7:00 PM ET", venue: "TD Garden", odds: "BOS -130 · EDM +110", pred: "BOS WINS 3-2", injuries: ["Z. McAvoy (DTD)", "C. Coyle (OUT)"] },
    topPerformers: [
      { name: "D. PASTRNAK", pos: "RW", pts: 82 },
      { name: "B. MARCHAND", pos: "LW", pts: 67 },
      { name: "C. McAVOY",   pos: "D",  pts: 46 },
    ],
    heatingUp: [
      { name: "P. ZACHA",   line: "4 G · 3 A · +5" },
      { name: "M. GEEKIE",  line: "3 G · 2 A · +4" },
      { name: "J. DEBRUSK", line: "3 G · 1 A · +3" },
    ],
    iceCold: [
      { name: "T. FREDERIC", line: "0 G · 0 A · -5" },
      { name: "J. BRAZEAU",  line: "0 G · 1 A · -4" },
      { name: "M. LOREI",    line: "0 G · 0 A · -4" },
    ],
    prospect: { name: "M. POITRAS", pos: "C", note: "Strong two-way game · big impact coming soon", eta: "NHL ETA: 2025" },
    history: { year: 1972, story: "Phil Esposito scores his 68th goal of the season, setting a Bruins record." },
    reggieKeys: ["Control the Pace", "Win the Walls", "Capitalize on Power Play"],
    marcKeys:  ["Stay Out of the Box", "Strong Second Period", "Protect the Net"],
    poll: { q: "Should the Bruins start Swayman tonight?", yes: 8420, no: 4422 },
    prediction: { record: "52-28", roi: "+14.2%", badge: "BRUINS SPECIALIST" },
    chat: [
      { u: "Bruins4Life",     msg: "Let's go B's!" },
      { u: "PastaLova88",     msg: "Big game tonight 🔥" },
      { u: "BlackAndGold",    msg: "Believe in this team." },
    ],
    retiredNumbers: [ {n:"4"}, {n:"7"}, {n:"77"} ],
    reggieQuote: "Bruins have won 4 straight. Marchand looks pissed off in the good way. I love it.",
    marcQuote: "Pastrnak's shot rate is up 18%, Swayman's .928 since March. Edmonton's D has a real problem tonight.",
    superfan: { level: "SEASON TICKET HOLDER", xp: 2450, next: "SUPERFAN", cap: 5000 },
  },
  MTL: {
    code: "MTL", name: "CANADIENS", city: "Montréal",
    primary: "#AF1E2D", accent: "#FF3040", bg: "#1a0808", panel: "#210b0b",
    neonText: "GO HABS GO",
    record: "35-16-6", points: 76, division: "2ND ATLANTIC", streak: "WON 5 STRAIGHT",
    tonight: { opp: "TOR", oppName: "MAPLE LEAFS", time: "7:00 PM ET", venue: "Bell Centre", odds: "MTL -150 · TOR +125", pred: "HABS WIN 4-2", injuries: ["J. Slafkovsky (DTD)", "J. Anderson (OUT)"] },
    topPerformers: [
      { name: "C. CAUFIELD",  pos: "RW", pts: 84 },
      { name: "N. SUZUKI",    pos: "C",  pts: 72 },
      { name: "J. SLAFKOVSKY", pos: "LW", pts: 55 },
    ],
    heatingUp: [
      { name: "C. CAUFIELD", line: "5 G · 3 A · +6" },
      { name: "N. SUZUKI",   line: "2 G · 5 A · +5" },
      { name: "K. DACH",     line: "3 G · 2 A · +4" },
    ],
    iceCold: [
      { name: "J. ANDERSON", line: "0 G · 0 A · -5" },
      { name: "J. GALLAGHER", line: "0 G · 1 A · -4" },
      { name: "D. SAVARD",   line: "0 G · 0 A · -3" },
    ],
    prospect: { name: "I. DEMIDOV", pos: "RW", note: "Offensive dynamo with elite skill and vision · Habs future is bright", eta: "NHL ETA: 2025" },
    history: { year: 1976, story: "Guy Lafleur records his 100th career goal in Montréal." },
    reggieKeys: ["Control the Tempo", "Win the Faceoff Battle", "Attack From the Wings"],
    marcKeys:  ["Physical Play", "Protect the Puck", "Discipline · Fewer Penalties"],
    poll: { q: "Will the Habs win tonight?", yes: 6840, no: 3002 },
    prediction: { record: "48-22", roi: "+16.8%", badge: "HABS SPECIALIST" },
    chat: [
      { u: "HabsFan92",       msg: "Go Habs Go! ⚪🔵🔴" },
      { u: "BleuBlancRouge",  msg: "On est en feu! 🔥" },
      { u: "LeRocket",        msg: "Demidov va changer le jeu." },
    ],
    retiredNumbers: [ {n:"9"}, {n:"4"}, {n:"29"} ],
    reggieQuote: "5 straight for the Habs. Bell Centre is going to be electric tonight. Book it.",
    marcQuote: "Caufield's shooting 17.4%, Suzuki plus-eleven in the last ten. This isn't a hot streak — they're building.",
    superfan: { level: "SEASON TICKET HOLDER", xp: 2750, next: "LEGEND", cap: 5000 },
  },
  TOR: {
    code: "TOR", name: "MAPLE LEAFS", city: "Toronto",
    primary: "#00205B", accent: "#003E7E", bg: "#08101f", panel: "#0b1428",
    neonText: "GO LEAFS GO",
    record: "38-19-4", points: 80, division: "2ND ATLANTIC", streak: "WON 3 STRAIGHT",
    tonight: { opp: "MTL", oppName: "CANADIENS", time: "7:00 PM ET", venue: "Scotiabank Arena", odds: "TOR -125 · MTL +105", pred: "TOR WINS 3-2", injuries: ["W. Nylander (DTD)"] },
    topPerformers: [
      { name: "A. MATTHEWS", pos: "C",  pts: 88 },
      { name: "M. MARNER",   pos: "RW", pts: 74 },
      { name: "W. NYLANDER", pos: "RW", pts: 68 },
    ],
    heatingUp: [
      { name: "A. MATTHEWS", line: "6 G · 4 A · +8" },
      { name: "M. MARNER",   line: "2 G · 6 A · +5" },
      { name: "M. KNIES",    line: "3 G · 2 A · +4" },
    ],
    iceCold: [
      { name: "J. TAVARES",  line: "0 G · 1 A · -3" },
      { name: "T. BERTUZZI", line: "0 G · 0 A · -4" },
      { name: "D. KAMPF",    line: "0 G · 0 A · -3" },
    ],
    prospect: { name: "F. HELLBERG", pos: "G", note: "Elite technique · Leafs future between the pipes", eta: "NHL ETA: 2026" },
    history: { year: 1993, story: "Wendel Clark drops the gloves with Marty McSorley in Game 6 of the Cup semifinals." },
    reggieKeys: ["Ride the Core", "Own the Middle", "Special Teams"],
    marcKeys:  ["Cut Down Turnovers", "Stronger D-Zone Exits", "Save % Over .910"],
    poll: { q: "Will Matthews hit 60 this year?", yes: 9220, no: 1188 },
    prediction: { record: "44-26", roi: "+9.8%", badge: "LEAFS SPECIALIST" },
    chat: [
      { u: "LeafsForever", msg: "This is our year." },
      { u: "MapleMafia",   msg: "Auston is unreal 🔥" },
      { u: "Sheldon4Life", msg: "Believe." },
    ],
    retiredNumbers: [ {n:"1"}, {n:"4"}, {n:"13"} ],
    reggieQuote: "Matthews is on pace for 60. Ridiculous. This might be the year. I said IT MIGHT.",
    marcQuote: "You said 'might', Reg — because their PK is 26th. Fix that or the parade waits another year.",
    superfan: { level: "SEASON TICKET HOLDER", xp: 3150, next: "LEGEND", cap: 5000 },
  },
  EDM: {
    code: "EDM", name: "OILERS", city: "Edmonton",
    primary: "#FF4C00", accent: "#041E42", bg: "#1a0d05", panel: "#211208",
    neonText: "LET'S GO OILERS",
    record: "41-15-6", points: 88, division: "1ST PACIFIC", streak: "WON 7 STRAIGHT",
    tonight: { opp: "CGY", oppName: "FLAMES", time: "9:00 PM ET", venue: "Rogers Place", odds: "EDM -180 · CGY +150", pred: "OILERS WIN 5-3", injuries: [] },
    topPerformers: [
      { name: "C. McDAVID", pos: "C",  pts: 112 },
      { name: "L. DRAISAITL", pos: "C", pts: 95 },
      { name: "E. BOUCHARD", pos: "D", pts: 62 },
    ],
    heatingUp: [
      { name: "C. McDAVID",   line: "7 G · 8 A · +11" },
      { name: "L. DRAISAITL", line: "5 G · 6 A · +7" },
      { name: "Z. HYMAN",     line: "6 G · 2 A · +5" },
    ],
    iceCold: [
      { name: "J. KULAK", line: "0 G · 0 A · -3" },
      { name: "M. FOEGELE", line: "0 G · 1 A · -4" },
      { name: "V. DESHARNAIS", line: "0 G · 0 A · -3" },
    ],
    prospect: { name: "M. SAVOIE", pos: "C", note: "Two-way center with high hockey IQ", eta: "NHL ETA: 2025" },
    history: { year: 1988, story: "Wayne Gretzky records his 4th assist of the night, becoming NHL's all-time playoff scoring leader." },
    reggieKeys: ["Feed McDavid", "Power Play Domination", "Ride the Momentum"],
    marcKeys:  ["Skoinen or Pickard Steadies", "Cut the Odd-Man Rushes", "Own the Neutral Zone"],
    poll: { q: "McDavid MVP again this year?", yes: 12210, no: 1450 },
    prediction: { record: "56-14", roi: "+21.4%", badge: "OILERS SPECIALIST" },
    chat: [
      { u: "OilCountry",  msg: "Let's go boys! 🛢️" },
      { u: "McJesus97",   msg: "Connor is on another planet." },
      { u: "DraiForMVP",  msg: "Best duo in the league." },
    ],
    retiredNumbers: [ {n:"99"}, {n:"11"}, {n:"31"} ],
    reggieQuote: "7 in a row. McJesus doing McJesus things. This is a Cup team. Say it with me.",
    marcQuote: "The five-on-five numbers say the same thing. Goals-for percentage 61%. Even the process is Cup-level.",
    superfan: { level: "SEASON TICKET HOLDER", xp: 4200, next: "LEGEND", cap: 5000 },
  },
  NYR: {
    code: "NYR", name: "RANGERS", city: "New York",
    primary: "#0038A8", accent: "#CE1126", bg: "#050e1e", panel: "#0a1428",
    neonText: "LET'S GO RANGERS",
    record: "40-16-5", points: 85, division: "1ST METRO", streak: "WON 2 STRAIGHT",
    tonight: { opp: "NJD", oppName: "DEVILS", time: "7:30 PM ET", venue: "Madison Square Garden", odds: "NYR -140 · NJD +120", pred: "NYR WINS 4-2", injuries: ["I. Shesterkin (DTD)"] },
    topPerformers: [
      { name: "A. PANARIN",   pos: "LW", pts: 92 },
      { name: "M. ZIBANEJAD", pos: "C",  pts: 68 },
      { name: "A. FOX",       pos: "D",  pts: 61 },
    ],
    heatingUp: [
      { name: "A. PANARIN",     line: "4 G · 5 A · +6" },
      { name: "V. TROCHECK",    line: "3 G · 3 A · +4" },
      { name: "C. KREIDER",     line: "4 G · 1 A · +3" },
    ],
    iceCold: [
      { name: "K. KAKKO",   line: "0 G · 0 A · -4" },
      { name: "J. LAFRENIÈRE", line: "0 G · 1 A · -3" },
      { name: "B. GOODROW", line: "0 G · 0 A · -3" },
    ],
    prospect: { name: "G. PEROTTI", pos: "RW", note: "Two-way winger with real bite", eta: "NHL ETA: 2026" },
    history: { year: 1994, story: "Mark Messier's guarantee — Rangers force Game 7 vs the Devils." },
    reggieKeys: ["Ride Panarin", "Own the Blue Line", "Fox On Every Shift"],
    marcKeys:  ["Discipline On PK", "Neutral-Zone Reads", "Rebounds"],
    poll: { q: "Fox wins the Norris again?", yes: 5420, no: 3910 },
    prediction: { record: "42-28", roi: "+8.4%", badge: "RANGERS SPECIALIST" },
    chat: [
      { u: "BlueshirtNation", msg: "This team is BUILT for the playoffs." },
      { u: "MSGForever",      msg: "Panarin is money." },
      { u: "BroadwayHat",     msg: "Playoffs start now." },
    ],
    retiredNumbers: [ {n:"1"}, {n:"11"}, {n:"35"} ],
    reggieQuote: "Panarin is money. Fox is a magician. Broadway is buzzing. Playoffs start now.",
    marcQuote: "Shesterkin's save percentage is back over .920. If he's this Shesty in April, everyone else is playing for silver.",
    superfan: { level: "SEASON TICKET HOLDER", xp: 2950, next: "SUPERFAN", cap: 5000 },
  },
  COL: {
    code: "COL", name: "AVALANCHE", city: "Colorado",
    primary: "#6F263D", accent: "#236192", bg: "#150a11", panel: "#1c0c17",
    neonText: "GO AVS GO",
    record: "42-17-4", points: 88, division: "1ST CENTRAL", streak: "WON 4 STRAIGHT",
    tonight: { opp: "DAL", oppName: "STARS", time: "8:00 PM ET", venue: "Ball Arena", odds: "COL -125 · DAL +105", pred: "AVS WIN 4-3", injuries: ["V. Landeskog (LTIR)"] },
    topPerformers: [
      { name: "N. MacKINNON", pos: "C", pts: 106 },
      { name: "M. RANTANEN",  pos: "RW", pts: 91 },
      { name: "C. MAKAR",     pos: "D", pts: 78 },
    ],
    heatingUp: [
      { name: "N. MacKINNON", line: "6 G · 7 A · +9" },
      { name: "M. RANTANEN",  line: "5 G · 4 A · +6" },
      { name: "C. MAKAR",     line: "2 G · 6 A · +8" },
    ],
    iceCold: [
      { name: "R. ANDREWS", line: "0 G · 0 A · -3" },
      { name: "M. OLOFSSON", line: "0 G · 0 A · -3" },
      { name: "L. IAFALLO", line: "0 G · 1 A · -2" },
    ],
    prospect: { name: "C. MALINSKI", pos: "D", note: "Puck-mover with elite hockey sense", eta: "NHL ETA: 2025" },
    history: { year: 2001, story: "Ray Bourque hoists the Cup after 22 years — a moment burned into hockey history." },
    reggieKeys: ["Get MacKinnon 25 Shifts", "Power Play Structure", "Ride the Rush"],
    marcKeys:  ["Georgiev Stays Steady", "Neutral-Zone Regroup", "Cut the Odd-Man Rushes"],
    poll: { q: "Cup or Bust this year?", yes: 8130, no: 1240 },
    prediction: { record: "50-20", roi: "+18.6%", badge: "AVS SPECIALIST" },
    chat: [
      { u: "AvsNation",   msg: "Cup year." },
      { u: "MakarMagic",  msg: "Best D-man in the world." },
      { u: "8622Forever", msg: "Nate is unreal." },
    ],
    retiredNumbers: [ {n:"21"}, {n:"33"}, {n:"77"} ],
    reggieQuote: "MacKinnon's in an MVP fight. Makar reminds me of Bobby Orr. Cup or bust in Denver.",
    marcQuote: "Careful, Reg — 'reminds me of Bobby Orr' is a heavy sentence. But 78 points from a D-man? Fine, I'll allow it.",
    superfan: { level: "SEASON TICKET HOLDER", xp: 3520, next: "LEGEND", cap: 5000 },
  },
};

const TEAM_ORDER = ["BOS", "MTL", "TOR", "EDM", "NYR", "COL"];

/* ------------------- helper components ------------------- */

function Panel({ children, className = "", style }) {
  return (
    <div className={`rounded-md border border-white/10 bg-black/40 p-4 md:p-5 ${className}`} style={style}>
      {children}
    </div>
  );
}

function SectionLabel({ text, right, color }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "14px", letterSpacing: "0.28em", color: color || C.silver }}>
        {text}
      </div>
      {right && (
        <div style={{ fontFamily: "Oswald", fontWeight: 600, fontSize: "12px", letterSpacing: "0.25em", color: "#888" }}>
          {right}
        </div>
      )}
    </div>
  );
}

// Banter strip — Reggie & Marc greet the fan the moment they land, one
// team-specific take each. Uses the two-tone bubble treatment so it feels
// like a real broadcast exchange rather than a marketing pull-quote.
function TeamBanter({ team }) {
  const t = team;
  return (
    <div className="max-w-6xl mx-auto px-6 pb-6" data-testid="team-banter">
      <SectionLabel text="REGGIE & MARC ON THE" right={t.name} color={t.primary} />
      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-md border border-white/10 bg-black/40 p-4 flex gap-3">
          <div className="h-11 w-11 rounded-full flex-shrink-0 flex items-center justify-center"
               style={{ background: t.primary + "33", border: `1px solid ${t.primary}55` }}>
            <span style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "16px", color: t.primary }}>RH</span>
          </div>
          <div>
            <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "12px", letterSpacing: "0.28em", color: t.primary }}>
              REGGIE HARLOW
            </div>
            <div className="mt-1.5 text-[18px] text-white/95" style={{ fontFamily: "Rajdhani", fontWeight: 600, lineHeight: 1.35 }}>
              "{t.reggieQuote}"
            </div>
          </div>
        </div>
        <div className="rounded-md border border-white/10 bg-black/40 p-4 flex gap-3">
          <div className="h-11 w-11 rounded-full flex-shrink-0 flex items-center justify-center bg-white/8"
               style={{ border: "1px solid rgba(255,255,255,0.18)" }}>
            <span style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "16px", color: "#c9d4ff" }}>MC</span>
          </div>
          <div>
            <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "12px", letterSpacing: "0.28em", color: "#c9d4ff" }}>
              MARC COLLINS
            </div>
            <div className="mt-1.5 text-[18px] text-white/90" style={{ fontFamily: "Rajdhani", fontWeight: 600, lineHeight: 1.35 }}>
              "{t.marcQuote}"
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// (Reggie silhouette + retired-jersey banners removed — user asked us to
// dial the room decor back and let one big team logo carry the identity
// with a splash of team color. Stats panels below do the rest of the work.)

/* ---------------------------- PAGE ---------------------------- */

const TEAM_STORAGE_KEY = "ticker.homeTeam";

export default function TeamRoomAudition() {
  const { code } = useParams();

  // Two-layer state:
  //   • homeTeam — the fan's DEFAULT team (persisted). Set on first pick or
  //     via the "Set as my home" button. Never overwritten by casual peeking.
  //   • teamCode — the team CURRENTLY being viewed. May be a "peek" at
  //     another franchise for a scouting deep-dive.
  const [homeTeam, setHomeTeam] = useState(() => {
    try {
      const stored = window.localStorage.getItem(TEAM_STORAGE_KEY);
      if (stored && TEAMS[stored]) return stored;
    } catch {}
    return "BOS";
  });
  const [teamCode, setTeamCode] = useState(() => {
    const fromRoute = code && TEAMS[code.toUpperCase()] ? code.toUpperCase() : null;
    if (fromRoute) return fromRoute;
    try {
      const stored = window.localStorage.getItem(TEAM_STORAGE_KEY);
      if (stored && TEAMS[stored]) return stored;
    } catch {}
    return "BOS";
  });

  // Route param wins — deep links to /audition/team-room/MTL peek at MTL
  // without touching the fan's home team.
  useEffect(() => {
    if (code && TEAMS[code.toUpperCase()]) setTeamCode(code.toUpperCase());
  }, [code]);

  const makeHome = (c) => {
    setHomeTeam(c);
    try { window.localStorage.setItem(TEAM_STORAGE_KEY, c); } catch {}
  };

  const isPeeking = teamCode !== homeTeam;
  const t = TEAMS[teamCode];
  const xpPct = Math.min(100, Math.round((t.superfan.xp / t.superfan.cap) * 100));

  return (
    <div className="min-h-screen text-white pb-24 bg-[#0b0b10]">
      {/* Team switcher bar */}
      <div className="border-b border-white/10 px-4 py-3 flex items-center justify-between" style={{ background: "rgba(0,0,0,0.5)" }}>
        <div className="flex items-center gap-3">
          <TMark size={30} variant="light" />
          <div>
            <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "14px", letterSpacing: "0.05em" }}>
              THE TICKER · {isPeeking ? "SCOUTING" : "MY TEAM"}
            </div>
            <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", color: t.primary, letterSpacing: "0.3em" }}>
              {isPeeking ? `PEEKING AT ${t.name} · YOUR HOME IS ${TEAMS[homeTeam].name}` : "YOUR DEFAULT DEEP DIVE"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {TEAM_ORDER.map((c) => {
            const isActive = c === teamCode;
            const isHome = c === homeTeam;
            return (
              <button key={c} onClick={() => setTeamCode(c)}
                className={`relative h-9 w-9 rounded-md flex items-center justify-center border transition-all ${
                  isActive ? "border-white shadow-lg scale-105" : "border-white/15 hover:border-white/50"
                }`}
                style={{ background: isActive ? TEAMS[c].primary + "22" : "transparent" }}
                title={isHome ? `${TEAMS[c].name} · your home team` : `Peek at ${TEAMS[c].name}`}
                data-testid={`team-switch-${c}`}
              >
                <TeamLogo code={c} className="h-7 w-7 object-contain" />
                {isHome && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full border border-black"
                        style={{ background: TEAMS[c].primary }}
                        title="Home team"
                        data-testid={`team-home-dot-${c}`} />
                )}
              </button>
            );
          })}
        </div>
        {/* Peek-mode affordances: snap back to home OR make this team home */}
        <div className="flex items-center gap-2">
          {isPeeking && (
            <>
              <button
                onClick={() => setTeamCode(homeTeam)}
                className="px-3 py-1.5 rounded-md border border-white/20 hover:border-white text-xs text-white/85 hover:text-white transition-colors"
                style={{ fontFamily: "Oswald", fontWeight: 600, letterSpacing: "0.15em" }}
                data-testid="team-back-to-home"
              >
                ← BACK TO {TEAMS[homeTeam].name}
              </button>
              <button
                onClick={() => makeHome(teamCode)}
                className="px-3 py-1.5 rounded-md text-xs text-black font-semibold hover:opacity-90 transition-opacity"
                style={{ background: t.primary, fontFamily: "Oswald", letterSpacing: "0.15em" }}
                data-testid="team-set-home"
              >
                SET AS MY HOME
              </button>
            </>
          )}
        </div>
      </div>

      {/* HERO — network-brand dark shell. Team color only as a soft glow
       * behind the one power logo, plus small accents (streak pill, section
       * labels, Reggie's call). We'll build team energy incrementally. */}
      <div className="relative overflow-hidden border-b border-white/5"
           style={{
             background: `
               radial-gradient(circle at 50% 30%, ${t.primary}14, transparent 60%),
               #0b0b10
             `,
           }}>
        <div className="px-6 py-10 max-w-6xl mx-auto grid md:grid-cols-2 items-start gap-8">
          {/* Left: welcome + POWER LOGO (replaces the team-name text) + record */}
          <div className="min-w-[240px]">
            <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "16px", letterSpacing: "0.3em", color: t.primary }}>
              {isPeeking ? `SCOUTING · ${t.name}` : "WELCOME BACK, STEVE"}
            </div>
            <div className="relative mt-3 flex items-center justify-start" style={{ height: 260 }}>
              <div className="absolute inset-0 rounded-full blur-3xl opacity-70 pointer-events-none"
                   style={{ background: `radial-gradient(circle at 40% 50%, ${t.primary}55 0%, transparent 60%)` }} />
              <TeamLogo code={t.code} size={260} className="relative drop-shadow-2xl"
                        data-testid="team-hero-logo" />
            </div>
            <div className="mt-5 rounded-md border border-white/10 bg-black/40 px-5 py-4 inline-block">
              <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "12px", letterSpacing: "0.3em", color: "#888" }}>
                CURRENT RECORD
              </div>
              <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "44px", color: C.white, lineHeight: 1, letterSpacing: "0.01em" }}>
                {t.record}
              </div>
              <div className="mt-1.5" style={{ fontFamily: "Oswald", fontWeight: 600, fontSize: "13px", color: "#a0a0a5", letterSpacing: "0.2em" }}>
                {t.division} · {t.points} PTS
              </div>
              <div className="mt-2.5 inline-block px-2.5 py-1 rounded-sm text-[13px]"
                   style={{ background: "#0f7c3722", color: "#26cd66", border: "1px solid #26cd6644", fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.15em" }}>
                {t.streak}
              </div>
            </div>
          </div>

          {/* Right: Tonight card */}
          <Panel className="min-w-[240px] md:justify-self-end w-full md:w-[340px]" style={{ background: "rgba(0,0,0,0.55)" }}>
            <SectionLabel text="TONIGHT" color={t.primary} />
            <div className="flex items-center justify-center gap-4 py-2">
              <TeamLogo code={t.code} className="h-11 w-11 object-contain" />
              <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "16px", color: "#888", letterSpacing: "0.1em" }}>VS</span>
              <TeamLogo code={t.tonight.opp} className="h-11 w-11 object-contain" />
            </div>
            <div className="text-center" style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "22px", color: C.white, letterSpacing: "0.02em" }}>
              {t.tonight.time}
            </div>
            <div className="text-center" style={{ fontFamily: "Oswald", fontWeight: 600, fontSize: "13px", color: "#a0a0a5", letterSpacing: "0.15em" }}>
              {t.tonight.venue}
            </div>
            <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
              <div>
                <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "11px", letterSpacing: "0.28em", color: "#888" }}>ODDS</div>
                <div className="text-[15px] text-white/90 mt-0.5" style={{ fontFamily: "Rajdhani", fontWeight: 600 }}>{t.tonight.odds}</div>
              </div>
              <div>
                <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "11px", letterSpacing: "0.28em", color: "#888" }}>REGGIE'S CALL</div>
                <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "22px", color: t.primary, lineHeight: 1.1 }}>{t.tonight.pred}</div>
              </div>
              {t.tonight.injuries.length > 0 && (
                <div>
                  <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "11px", letterSpacing: "0.28em", color: "#888" }}>INJURIES</div>
                  <div className="text-[14px] text-white/80 mt-0.5" style={{ fontFamily: "Rajdhani", fontWeight: 600 }}>{t.tonight.injuries.join(" · ")}</div>
                </div>
              )}
            </div>
          </Panel>
        </div>

        {/* 4 Room icons */}
        <div className="px-6 pb-8 max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { title: "LOCKER ROOM", sub: "News & Updates" },
            { title: "COACH'S OFFICE", sub: "Analytics & Stats" },
            { title: "WAR ROOM", sub: "Trade Rumors" },
            { title: "FILM ROOM", sub: "Video Breakdown" },
          ].map((r) => (
            <button key={r.title} className="flex items-center gap-3 rounded-md border border-white/10 bg-black/40 hover:border-white/40 p-4 text-left transition-colors">
              <div className="h-10 w-10 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: t.primary + "33" }}>
                <ChevronRight className="w-5 h-5" style={{ color: t.primary }} />
              </div>
              <div>
                <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "17px", color: C.white, letterSpacing: "0.03em" }}>{r.title}</div>
                <div style={{ fontFamily: "Oswald", fontWeight: 600, fontSize: "12px", color: "#a0a0a5", letterSpacing: "0.15em" }}>{r.sub}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Reggie & Marc banter — team-specific greeting the moment fans land */}
      <TeamBanter team={t} />

      {/* YOUR INSIGHTS & HISTORY — only surfaces on the fan's home team.
       * Peek mode ("scouting" another team) is base stats only: no
       * personal Q&A / saved-take history is exposed. Once auth ships,
       * this panel hydrates from the user's Reggie & Marc conversation log. */}
      {!isPeeking && (
        <div className="max-w-6xl mx-auto px-6 pb-4" data-testid="insights-history-panel">
          <SectionLabel text="YOUR INSIGHTS & HISTORY · WITH REGGIE" color={t.primary} />
          <div className="rounded-md border border-white/10 bg-black/40 p-5 flex items-start gap-4">
            <div className="h-12 w-12 rounded-full flex-shrink-0 flex items-center justify-center"
                 style={{ background: t.primary + "22", border: `1px solid ${t.primary}55` }}>
              <span style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "16px", color: t.primary }}>RH</span>
            </div>
            <div className="flex-1 min-w-0">
              <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "20px", color: C.white, letterSpacing: "0.01em" }}>
                No deep-dives yet, Steve.
              </div>
              <div className="mt-2 text-[16px] text-white/75" style={{ fontFamily: "Inter", lineHeight: 1.5 }}>
                Ask Reggie & Marc a question about the {t.name.charAt(0) + t.name.slice(1).toLowerCase()} and your saved takes, matchup breakdowns and answers pile up here — your private library, for your team only.
              </div>
            </div>
            <Link
              to="/press-conference/classic"
              className="flex-shrink-0 px-4 py-2.5 rounded-md text-black font-bold hover:opacity-90 transition-opacity"
              style={{ background: t.primary, fontFamily: "Oswald", fontSize: "14px", letterSpacing: "0.15em" }}
              data-testid="ask-reggie-cta"
            >
              ASK REGGIE →
            </Link>
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="px-4 md:px-6 py-4 max-w-6xl mx-auto grid md:grid-cols-3 gap-3">
        {/* Top Performers */}
        <Panel>
          <SectionLabel text="TOP PERFORMERS" right="VIEW ALL" color={t.primary} />
          <div className="space-y-2 pt-1">
            {t.topPerformers.map((p, i) => (
              <div key={i} className="flex items-center gap-3 py-1">
                <div className="w-6 text-white/40 text-sm">{i + 1}</div>
                <div className="flex-1" style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "20px", letterSpacing: "0.01em" }}>{p.name}</div>
                <div className="text-white/60 text-sm w-8" style={{ fontFamily: "Oswald", fontWeight: 600, letterSpacing: "0.1em" }}>{p.pos}</div>
                <div style={{ fontFamily: "Rajdhani", fontWeight: 700, color: t.primary, fontSize: "24px", lineHeight: 1 }}>{p.pts}</div>
                <div className="text-[11px] text-white/50 uppercase tracking-widest" style={{ fontFamily: "Oswald", fontWeight: 600 }}>PTS</div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Heating Up */}
        <Panel>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-400" />
              <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "14px", letterSpacing: "0.28em", color: "#ff9a3c" }}>WHO'S HEATING UP</span>
            </div>
            <span className="text-[12px] text-white/60" style={{ fontFamily: "Oswald", fontWeight: 600, letterSpacing: "0.2em" }}>LAST 5 GAMES</span>
          </div>
          <div className="space-y-2 pt-1">
            {t.heatingUp.map((p, i) => (
              <div key={i} className="flex items-center gap-3 py-1">
                <div className="flex-1" style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "19px", letterSpacing: "0.01em" }}>{p.name}</div>
                <div className="text-white/90 text-sm" style={{ fontFamily: "Rajdhani", fontWeight: 600 }}>{p.line}</div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Ice Cold */}
        <Panel>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Snowflake className="w-4 h-4 text-cyan-300" />
              <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "14px", letterSpacing: "0.28em", color: "#7dd3fc" }}>WHO'S ICE COLD</span>
            </div>
            <span className="text-[12px] text-white/60" style={{ fontFamily: "Oswald", fontWeight: 600, letterSpacing: "0.2em" }}>LAST 5 GAMES</span>
          </div>
          <div className="space-y-2 pt-1">
            {t.iceCold.map((p, i) => (
              <div key={i} className="flex items-center gap-3 py-1">
                <div className="flex-1" style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "19px", letterSpacing: "0.01em" }}>{p.name}</div>
                <div className="text-white/90 text-sm" style={{ fontFamily: "Rajdhani", fontWeight: 600 }}>{p.line}</div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Prospect Watch */}
        <Panel>
          <SectionLabel text="PROSPECT WATCH" right="VIEW ALL" color={t.primary} />
          <div className="flex items-start gap-3 pt-1">
            <div className="h-16 w-16 rounded-md flex items-center justify-center" style={{ background: t.primary + "22", border: `1px solid ${t.primary}44` }}>
              <TMark size={26} variant="light" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "22px", letterSpacing: "0.01em" }}>{t.prospect.name}</span>
                <span className="text-[12px] text-white/60 uppercase tracking-widest" style={{ fontFamily: "Oswald", fontWeight: 600 }}>{t.prospect.pos}</span>
              </div>
              <div className="mt-2 text-[15px] text-white/80" style={{ fontFamily: "Inter", lineHeight: 1.45 }}>
                {t.prospect.note}
              </div>
              <div className="mt-2 inline-block px-2.5 py-1 rounded-sm text-[12px]"
                   style={{ background: t.primary + "33", color: t.primary, border: `1px solid ${t.primary}55`, fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.15em" }}>
                {t.prospect.eta}
              </div>
            </div>
          </div>
        </Panel>

        {/* Today in History */}
        <Panel>
          <SectionLabel text={`TODAY IN ${t.name} HISTORY`} color={t.primary} />
          <div className="flex items-start gap-4 pt-1">
            <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "52px", color: t.primary, lineHeight: 1 }}>
              {t.history.year}
            </div>
            <div className="flex-1 text-[15px] text-white/85" style={{ fontFamily: "Inter", lineHeight: 1.5 }}>
              {t.history.story}
            </div>
          </div>
        </Panel>

        {/* Tonight's Keys — Reggie solo */}
        <Panel>
          <SectionLabel text="REGGIE'S TAKE ON TONIGHT" color={t.primary} />
          <ol className="mt-2 space-y-2 text-[16px] text-white/90" style={{ fontFamily: "Rajdhani", fontWeight: 600, lineHeight: 1.35 }}>
            {[...t.reggieKeys, ...t.marcKeys].slice(0, 5).map((k, i) => (
              <li key={i} className="flex gap-2.5">
                <span style={{ color: t.primary, fontFamily: "Rajdhani", fontWeight: 700, fontSize: "18px" }}>{i + 1}.</span>
                <span>{k}</span>
              </li>
            ))}
          </ol>
        </Panel>

        {/* Fan Poll */}
        <Panel>
          <SectionLabel text="FAN POLL" color={t.primary} />
          <div className="text-[16px] text-white/90 mt-1 mb-3" style={{ fontFamily: "Rajdhani", fontWeight: 600, lineHeight: 1.35 }}>{t.poll.q}</div>
          <div className="flex gap-2">
            <button className="flex-1 py-2.5 rounded-md text-white font-bold" style={{ background: t.primary, fontFamily: "Oswald", fontSize: "14px", letterSpacing: "0.15em" }}>YES</button>
            <button className="flex-1 py-2.5 rounded-md text-white/80 font-bold border border-white/15 hover:border-white/40" style={{ fontFamily: "Oswald", fontSize: "14px", letterSpacing: "0.15em" }}>NO</button>
          </div>
          <div className="mt-3 text-[12px] text-white/55 text-center" style={{ fontFamily: "Oswald", fontWeight: 600, letterSpacing: "0.2em" }}>
            {(t.poll.yes + t.poll.no).toLocaleString()} VOTES
          </div>
        </Panel>

        {/* Prediction Center */}
        <Panel>
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "14px", letterSpacing: "0.28em", color: t.primary }}>PREDICTION CENTER</span>
            <span className="text-[12px] text-white/55" style={{ fontFamily: "Oswald", fontWeight: 600, letterSpacing: "0.2em" }}>YOUR RECORD</span>
          </div>
          <div className="text-[12px] text-white/60 uppercase mb-2 tracking-widest" style={{ fontFamily: "Oswald", fontWeight: 600 }}>Place your prediction · Tonight</div>
          <div className="flex items-center justify-around py-2">
            <TeamLogo code={t.code} className="h-11 w-11 object-contain" />
            <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "16px", color: "#888" }}>VS</div>
            <TeamLogo code={t.tonight.opp} className="h-11 w-11 object-contain" />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <button className="py-2 rounded-sm text-white font-bold" style={{ background: t.primary, fontFamily: "Oswald", fontSize: "12px", letterSpacing: "0.15em" }}>{t.code} WINS</button>
            <button className="py-2 rounded-sm text-white/80 font-bold border border-white/15" style={{ fontFamily: "Oswald", fontSize: "12px", letterSpacing: "0.15em" }}>TIE</button>
            <button className="py-2 rounded-sm text-white/80 font-bold border border-white/15" style={{ fontFamily: "Oswald", fontSize: "12px", letterSpacing: "0.15em" }}>{t.tonight.opp} WINS</button>
          </div>
          <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
            <div>
              <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "26px", lineHeight: 1 }}>{t.prediction.record}</div>
              <div className="text-[12px] text-emerald-400 mt-0.5" style={{ fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.2em" }}>{t.prediction.roi} ROI</div>
            </div>
            <div className="text-right">
              <Trophy className="w-4 h-4 inline mr-1" style={{ color: t.primary }} />
              <span className="text-[12px]" style={{ fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.2em", color: t.primary }}>{t.prediction.badge}</span>
            </div>
          </div>
        </Panel>

        {/* Fan Chat */}
        <Panel>
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "14px", letterSpacing: "0.28em", color: t.primary }}>FAN CHAT</span>
            <span className="text-[12px] text-emerald-400" style={{ fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.2em" }}>1.2K ONLINE</span>
          </div>
          <div className="space-y-2.5 max-h-[160px] overflow-y-auto no-scrollbar">
            {t.chat.map((m, i) => (
              <div key={i}>
                <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "14px", color: t.primary, letterSpacing: "0.02em" }}>{m.u}</div>
                <div className="text-white/85 text-[15px]" style={{ fontFamily: "Inter" }}>{m.msg}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
            <input className="flex-1 bg-black/60 rounded-sm px-3 py-2 text-sm border border-white/10 focus:border-white/40 outline-none" placeholder="Say something..." />
            <button className="h-9 w-9 rounded-sm flex items-center justify-center" style={{ background: t.primary }}>
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        </Panel>
      </div>

      {/* Superfan XP bar — personal layer. Only shown when the fan is on
       * their own home team. Peek mode is base stats only, no personal data. */}
      {!isPeeking && (
      <div className="fixed left-0 right-0 bottom-0 border-t border-white/10 px-4 py-4" style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)" }}>
        <div className="max-w-6xl mx-auto flex items-center gap-5">
          <div className="min-w-[210px]">
            <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "11px", letterSpacing: "0.28em", color: "#888" }}>SUPERFAN LEVEL</div>
            <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "18px", color: t.primary, letterSpacing: "0.03em" }}>{t.superfan.level}</div>
          </div>
          <div className="flex-1 h-3 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${xpPct}%`, background: `linear-gradient(90deg, ${t.primary}, ${t.accent})` }} />
          </div>
          <div className="text-right">
            <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "17px", letterSpacing: "0.01em" }}>{t.superfan.xp.toLocaleString()} / {t.superfan.cap.toLocaleString()} XP</div>
            <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "11px", color: "#a0a0a5", letterSpacing: "0.2em" }}>NEXT: {t.superfan.next}</div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
