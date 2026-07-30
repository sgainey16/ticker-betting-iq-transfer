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
import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Play, Flame, Snowflake, ChevronRight, Trophy, MessageCircle, Send } from "lucide-react";
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
    superfan: { level: "SEASON TICKET HOLDER", xp: 3520, next: "LEGEND", cap: 5000 },
  },
};

const TEAM_ORDER = ["BOS", "MTL", "TOR", "EDM", "NYR", "COL"];

/* ------------------- helper components ------------------- */

function Panel({ children, className = "", style }) {
  return (
    <div className={`rounded-md border border-white/10 bg-black/40 p-3 ${className}`} style={style}>
      {children}
    </div>
  );
}

function SectionLabel({ text, right, color }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div style={{ fontFamily: "Oswald", fontWeight: 600, fontSize: "11px", letterSpacing: "0.28em", color: color || C.silver }}>
        {text}
      </div>
      {right && (
        <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "10px", letterSpacing: "0.25em", color: "#666" }}>
          {right}
        </div>
      )}
    </div>
  );
}

// Reggie's "on-stage" placeholder — solo host presence for the Team Room.
// Marc doesn't appear in this concept per user direction. This is a scene
// element, not just a nametag: pointing pose silhouette + speech bubble
// so the block has personality even before the illustrated art lands.
function ReggieOnStage({ color, quote }) {
  return (
    <div className="relative flex flex-col items-center">
      {/* Speech bubble above Reggie */}
      {quote && (
        <div className="mb-3 max-w-[280px] rounded-2xl px-4 py-2 relative"
             style={{ background: "rgba(255,255,255,0.95)", color: "#0b0b10" }}>
          <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "13px", letterSpacing: "0.02em", lineHeight: 1.35 }}>
            {quote}
          </div>
          {/* Bubble tail */}
          <div className="absolute left-1/2 -bottom-2 w-4 h-4 -translate-x-1/2 rotate-45"
               style={{ background: "rgba(255,255,255,0.95)" }} />
        </div>
      )}
      {/* Reggie placeholder — bigger, pointer-pose vibe (dashed to signal WIP) */}
      <div className="relative h-56 w-44 rounded-t-full flex items-end justify-center overflow-hidden"
           style={{ background: `linear-gradient(180deg, ${color}33 0%, ${color}11 60%, transparent 100%)`,
                    border: `2px dashed ${color}66` }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <TMark size={56} variant="light" />
        </div>
        <div className="mb-2 text-[9px] uppercase tracking-widest text-white/40" style={{ fontFamily: "Oswald" }}>
          Reggie art
        </div>
      </div>
      <div className="mt-2" style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "13px", letterSpacing: "0.15em", color }}>
        REGGIE HARLOW · YOUR GUY
      </div>
    </div>
  );
}

// Retired jersey banner hanging from the wall — decorative warmth.
function RetiredBanner({ number, color }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-14 h-20 flex items-center justify-center relative"
           style={{
             background: `linear-gradient(180deg, ${color}, ${color}88)`,
             clipPath: "polygon(0 0, 100% 0, 100% 88%, 50% 100%, 0 88%)",
             boxShadow: `0 6px 18px -6px ${color}aa`,
           }}>
        <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "26px", color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
          {number}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- PAGE ---------------------------- */

export default function TeamRoomAudition() {
  const { code } = useParams();
  const [teamCode, setTeamCode] = useState(code && TEAMS[code.toUpperCase()] ? code.toUpperCase() : "BOS");
  const t = TEAMS[teamCode];
  const xpPct = Math.min(100, Math.round((t.superfan.xp / t.superfan.cap) * 100));

  return (
    <div className="min-h-screen text-white pb-24" style={{ background: t.bg }}>
      {/* Team switcher bar */}
      <div className="border-b border-white/10 px-4 py-3 flex items-center justify-between" style={{ background: "rgba(0,0,0,0.5)" }}>
        <div className="flex items-center gap-3">
          <TMark size={30} variant="light" />
          <div>
            <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "14px", letterSpacing: "0.05em" }}>
              THE TICKER · TEAM ROOM AUDITION
            </div>
            <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", color: t.primary, letterSpacing: "0.3em" }}>
              FLIP TEAMS TO SEE THE THEME CHANGE
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {TEAM_ORDER.map((c) => (
            <button key={c} onClick={() => setTeamCode(c)}
              className={`h-9 w-9 rounded-md flex items-center justify-center border transition-all ${
                c === teamCode ? "border-white shadow-lg scale-105" : "border-white/15 hover:border-white/50"
              }`}
              style={{ background: c === teamCode ? TEAMS[c].primary + "22" : "transparent" }}
              data-testid={`team-switch-${c}`}
            >
              <TeamLogo code={c} className="h-7 w-7 object-contain" />
            </button>
          ))}
        </div>
        <Link to="/" className="text-white/50 hover:text-white text-xs"
              style={{ fontFamily: "Oswald", fontWeight: 500, letterSpacing: "0.28em" }}>
          ← BACK
        </Link>
      </div>

      {/* HERO — locker-room scene backdrop */}
      <div className="relative overflow-hidden"
           style={{
             background: `
               radial-gradient(ellipse at 20% 0%, ${t.primary}22, transparent 55%),
               radial-gradient(ellipse at 80% 100%, ${t.primary}18, transparent 55%),
               linear-gradient(180deg, ${t.bg} 0%, ${t.panel} 100%)
             `,
           }}>
        {/* Faux wood-plank strip along the top for locker-room warmth */}
        <div className="absolute inset-x-0 top-0 h-3 opacity-40"
             style={{ background: `repeating-linear-gradient(90deg, ${t.accent}22 0 24px, ${t.accent}11 24px 48px)` }} />

        {/* Retired-number banners on the left wall (portrait-hidden to save space) */}
        <div className="absolute top-8 left-4 hidden lg:flex flex-col gap-2 z-10 opacity-90">
          {(t.retiredNumbers || []).map((r, i) => (
            <RetiredBanner key={i} number={r.n} color={t.primary} />
          ))}
        </div>
        {/* Retired-number banners on the right wall as well — jerseys in the rafters,
             not a Cup. Not every franchise has hoisted one, so we lean on retired
             numbers as the universal shrine element. */}
        <div className="absolute top-8 right-4 hidden lg:flex flex-col gap-2 z-10 opacity-90">
          {(t.retiredNumbers || []).slice().reverse().map((r, i) => (
            <RetiredBanner key={`r-${i}`} number={r.n} color={t.accent || t.primary} />
          ))}
        </div>

        <div className="px-6 py-8 max-w-6xl mx-auto flex items-start gap-6 flex-wrap relative z-20">
          {/* Left: welcome + record card */}
          <div className="flex-1 min-w-[280px]">
            <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "13px", letterSpacing: "0.25em", color: t.primary }}>
              WELCOME BACK, STEVE
            </div>
            <div className="mt-1" style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "44px", color: C.white, lineHeight: 0.95 }}>
              {t.name}
            </div>
            <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "22px", color: t.primary, letterSpacing: "0.03em", marginTop: 2 }}>
              HEADQUARTERS
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-16 w-16 rounded-md flex items-center justify-center bg-black/40 border border-white/10">
                <TeamLogo code={t.code} className="h-14 w-14 object-contain" />
              </div>
              <div className="rounded-md border border-white/10 bg-black/60 px-4 py-2">
                <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.3em", color: "#888" }}>
                  CURRENT RECORD
                </div>
                <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "32px", color: C.white, lineHeight: 1 }}>
                  {t.record}
                </div>
                <div className="mt-1 text-xs" style={{ fontFamily: "Oswald", fontWeight: 500, color: "#888", letterSpacing: "0.2em" }}>
                  {t.division} · {t.points} PTS
                </div>
                <div className="mt-2 inline-block px-2 py-0.5 rounded-sm text-[10px]"
                     style={{ background: "#0f7c3722", color: "#26cd66", border: "1px solid #26cd6644", fontFamily: "Oswald", fontWeight: 600, letterSpacing: "0.15em" }}>
                  {t.streak}
                </div>
              </div>
            </div>
          </div>

          {/* Center: SOLO Reggie with speech bubble + team neon */}
          <div className="flex flex-col items-center self-center">
            <ReggieOnStage color={t.primary} quote={t.reggieQuote} />
            <div className="mt-4" style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "26px", color: t.primary, letterSpacing: "0.03em", textShadow: `0 0 24px ${t.primary}88` }}>
              {t.neonText}
            </div>
          </div>

          {/* Right: Tonight card */}
          <Panel className="min-w-[240px]" style={{ background: "rgba(0,0,0,0.55)" }}>
            <SectionLabel text="TONIGHT" color={t.primary} />
            <div className="flex items-center justify-center gap-3 py-2">
              <TeamLogo code={t.code} className="h-9 w-9 object-contain" />
              <span className="text-white/50" style={{ fontFamily: "Oswald", fontWeight: 500 }}>VS</span>
              <TeamLogo code={t.tonight.opp} className="h-9 w-9 object-contain" />
            </div>
            <div className="text-center" style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "16px", color: C.white }}>
              {t.tonight.time}
            </div>
            <div className="text-center text-xs text-white/60" style={{ fontFamily: "Oswald", letterSpacing: "0.15em" }}>
              {t.tonight.venue}
            </div>
            <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
              <div>
                <div style={{ fontFamily: "Oswald", fontWeight: 600, fontSize: "9px", letterSpacing: "0.25em", color: "#888" }}>ODDS</div>
                <div className="text-xs text-white/85" style={{ fontFamily: "Inter" }}>{t.tonight.odds}</div>
              </div>
              <div>
                <div style={{ fontFamily: "Oswald", fontWeight: 600, fontSize: "9px", letterSpacing: "0.25em", color: "#888" }}>REGGIE'S CALL</div>
                <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "16px", color: t.primary }}>{t.tonight.pred}</div>
              </div>
              {t.tonight.injuries.length > 0 && (
                <div>
                  <div style={{ fontFamily: "Oswald", fontWeight: 600, fontSize: "9px", letterSpacing: "0.25em", color: "#888" }}>INJURIES</div>
                  <div className="text-[11px] text-white/70">{t.tonight.injuries.join(" · ")}</div>
                </div>
              )}
            </div>
          </Panel>
        </div>

        {/* 4 Room icons */}
        <div className="px-6 pb-6 max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { title: "LOCKER ROOM", sub: "News & Updates" },
            { title: "COACH'S OFFICE", sub: "Analytics & Stats" },
            { title: "WAR ROOM", sub: "Trade Rumors" },
            { title: "FILM ROOM", sub: "Video Breakdown" },
          ].map((r) => (
            <button key={r.title} className="flex items-center gap-3 rounded-md border border-white/10 bg-black/40 hover:border-white/40 p-3 text-left transition-colors">
              <div className="h-8 w-8 rounded-md flex items-center justify-center" style={{ background: t.primary + "33" }}>
                <ChevronRight className="w-4 h-4" style={{ color: t.primary }} />
              </div>
              <div>
                <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "13px", color: C.white, letterSpacing: "0.05em" }}>{r.title}</div>
                <div className="text-[10px] text-white/50" style={{ fontFamily: "Oswald", letterSpacing: "0.15em" }}>{r.sub}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main grid */}
      <div className="px-4 md:px-6 py-4 max-w-6xl mx-auto grid md:grid-cols-3 gap-3">
        {/* Top Performers */}
        <Panel>
          <SectionLabel text="TOP PERFORMERS" right="VIEW ALL" color={t.primary} />
          <div className="space-y-2 pt-1">
            {t.topPerformers.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-5 text-white/40 text-xs">{i + 1}</div>
                <div className="flex-1" style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "15px" }}>{p.name}</div>
                <div className="text-white/50 text-xs w-6">{p.pos}</div>
                <div style={{ fontFamily: "Rajdhani", fontWeight: 700, color: t.primary, fontSize: "16px" }}>{p.pts}</div>
                <div className="text-[9px] text-white/40 uppercase tracking-widest">PTS</div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Heating Up */}
        <Panel>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span style={{ fontFamily: "Oswald", fontWeight: 600, fontSize: "11px", letterSpacing: "0.28em", color: "#ff9a3c" }}>WHO'S HEATING UP</span>
            </div>
            <span className="text-[10px] text-white/40" style={{ fontFamily: "Oswald", letterSpacing: "0.2em" }}>LAST 5 GAMES</span>
          </div>
          <div className="space-y-2 pt-1">
            {t.heatingUp.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1" style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "14px" }}>{p.name}</div>
                <div className="text-white/80 text-xs" style={{ fontFamily: "Inter" }}>{p.line}</div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Ice Cold */}
        <Panel>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Snowflake className="w-3.5 h-3.5 text-cyan-300" />
              <span style={{ fontFamily: "Oswald", fontWeight: 600, fontSize: "11px", letterSpacing: "0.28em", color: "#7dd3fc" }}>WHO'S ICE COLD</span>
            </div>
            <span className="text-[10px] text-white/40" style={{ fontFamily: "Oswald", letterSpacing: "0.2em" }}>LAST 5 GAMES</span>
          </div>
          <div className="space-y-2 pt-1">
            {t.iceCold.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1" style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "14px" }}>{p.name}</div>
                <div className="text-white/80 text-xs" style={{ fontFamily: "Inter" }}>{p.line}</div>
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
                <span style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "16px" }}>{t.prospect.name}</span>
                <span className="text-[10px] text-white/40 uppercase tracking-widest">{t.prospect.pos}</span>
              </div>
              <div className="mt-1 text-[12px] text-white/70" style={{ fontFamily: "Inter" }}>
                {t.prospect.note}
              </div>
              <div className="mt-2 inline-block px-2 py-0.5 rounded-sm text-[10px]"
                   style={{ background: t.primary + "33", color: t.primary, border: `1px solid ${t.primary}55`, fontFamily: "Oswald", fontWeight: 600, letterSpacing: "0.15em" }}>
                {t.prospect.eta}
              </div>
            </div>
          </div>
        </Panel>

        {/* Today in History */}
        <Panel>
          <SectionLabel text={`TODAY IN ${t.name} HISTORY`} color={t.primary} />
          <div className="flex items-start gap-3 pt-1">
            <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "40px", color: t.primary, lineHeight: 1 }}>
              {t.history.year}
            </div>
            <div className="flex-1 text-[12px] text-white/75" style={{ fontFamily: "Inter", lineHeight: 1.4 }}>
              {t.history.story}
            </div>
          </div>
        </Panel>

        {/* Tonight's Keys — Reggie solo */}
        <Panel>
          <SectionLabel text="REGGIE'S TAKE ON TONIGHT" color={t.primary} />
          <ol className="mt-2 space-y-1.5 text-[13px] text-white/85" style={{ fontFamily: "Inter" }}>
            {[...t.reggieKeys, ...t.marcKeys].slice(0, 5).map((k, i) => (
              <li key={i} className="flex gap-2">
                <span style={{ color: t.primary, fontFamily: "Rajdhani", fontWeight: 700 }}>{i + 1}.</span>
                <span>{k}</span>
              </li>
            ))}
          </ol>
        </Panel>

        {/* Fan Poll */}
        <Panel>
          <SectionLabel text="FAN POLL" color={t.primary} />
          <div className="text-[13px] text-white/85 mt-1 mb-3">{t.poll.q}</div>
          <div className="flex gap-2">
            <button className="flex-1 py-2 rounded-md text-white text-sm font-semibold" style={{ background: t.primary }}>YES</button>
            <button className="flex-1 py-2 rounded-md text-white/70 text-sm font-semibold border border-white/15 hover:border-white/40">NO</button>
          </div>
          <div className="mt-2 text-[10px] text-white/45 text-center" style={{ fontFamily: "Oswald", letterSpacing: "0.2em" }}>
            {(t.poll.yes + t.poll.no).toLocaleString()} VOTES
          </div>
        </Panel>

        {/* Prediction Center */}
        <Panel>
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontFamily: "Oswald", fontWeight: 600, fontSize: "11px", letterSpacing: "0.28em", color: t.primary }}>PREDICTION CENTER</span>
            <span className="text-[10px] text-white/40" style={{ fontFamily: "Oswald", letterSpacing: "0.2em" }}>YOUR RECORD</span>
          </div>
          <div className="text-[10px] text-white/50 uppercase mb-2 tracking-widest">Place your prediction · Tonight</div>
          <div className="flex items-center justify-around py-2">
            <TeamLogo code={t.code} className="h-10 w-10 object-contain" />
            <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "14px", color: "#888" }}>VS</div>
            <TeamLogo code={t.tonight.opp} className="h-10 w-10 object-contain" />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <button className="text-[10px] py-1.5 rounded-sm text-white" style={{ background: t.primary, fontFamily: "Oswald", letterSpacing: "0.15em" }}>{t.code} WINS</button>
            <button className="text-[10px] py-1.5 rounded-sm text-white/70 border border-white/15" style={{ fontFamily: "Oswald", letterSpacing: "0.15em" }}>TIE</button>
            <button className="text-[10px] py-1.5 rounded-sm text-white/70 border border-white/15" style={{ fontFamily: "Oswald", letterSpacing: "0.15em" }}>{t.tonight.opp} WINS</button>
          </div>
          <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between">
            <div>
              <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "20px" }}>{t.prediction.record}</div>
              <div className="text-[10px] text-emerald-400" style={{ fontFamily: "Oswald", letterSpacing: "0.2em" }}>{t.prediction.roi} ROI</div>
            </div>
            <div className="text-right">
              <Trophy className="w-4 h-4 inline mr-1" style={{ color: t.primary }} />
              <span className="text-[10px]" style={{ fontFamily: "Oswald", fontWeight: 600, letterSpacing: "0.2em", color: t.primary }}>{t.prediction.badge}</span>
            </div>
          </div>
        </Panel>

        {/* Fan Chat */}
        <Panel>
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontFamily: "Oswald", fontWeight: 600, fontSize: "11px", letterSpacing: "0.28em", color: t.primary }}>FAN CHAT</span>
            <span className="text-[10px] text-emerald-400" style={{ fontFamily: "Oswald", letterSpacing: "0.2em" }}>1.2K ONLINE</span>
          </div>
          <div className="space-y-2 max-h-[130px] overflow-y-auto no-scrollbar">
            {t.chat.map((m, i) => (
              <div key={i} className="text-[12px]">
                <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "12px", color: t.primary }}>{m.u}</div>
                <div className="text-white/80" style={{ fontFamily: "Inter" }}>{m.msg}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-2">
            <input className="flex-1 bg-black/60 rounded-sm px-2 py-1 text-xs border border-white/10 focus:border-white/40 outline-none" placeholder="Say something..." />
            <button className="h-7 w-7 rounded-sm flex items-center justify-center" style={{ background: t.primary }}>
              <Send className="w-3 h-3 text-white" />
            </button>
          </div>
        </Panel>
      </div>

      {/* Superfan XP bar */}
      <div className="fixed left-0 right-0 bottom-0 border-t border-white/10 px-4 py-3" style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)" }}>
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <div className="min-w-[180px]">
            <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.25em", color: "#888" }}>SUPERFAN LEVEL</div>
            <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "14px", color: t.primary, letterSpacing: "0.05em" }}>{t.superfan.level}</div>
          </div>
          <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${xpPct}%`, background: `linear-gradient(90deg, ${t.primary}, ${t.accent})` }} />
          </div>
          <div className="text-right">
            <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "13px" }}>{t.superfan.xp.toLocaleString()} / {t.superfan.cap.toLocaleString()} XP</div>
            <div className="text-[10px] text-white/50" style={{ fontFamily: "Oswald", letterSpacing: "0.2em" }}>NEXT: {t.superfan.next}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
