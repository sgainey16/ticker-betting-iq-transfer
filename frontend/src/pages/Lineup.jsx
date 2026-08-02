// Lineup & Roster — full team roster page.
//
// Sections (top → bottom):
//   1. Header — team name/logo, cap summary, injury count
//   2. Active Lines — 4 forward lines + 3 D pairs + 2 goalies (LW-C-RW)
//   3. Extras / Scratches
//   4. Injured Reserve
//   5. Farm System (AHL affiliate roster snapshot)
//   6. Top Prospects (drafted, not yet in the league)
//
// Route: /lineup/:team    (seed: mtl, bos)

import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ChevronRight, DollarSign, AlertTriangle } from "lucide-react";
import { TeamLogo } from "@/lib/teamLogos";

/* ================================================================
   SEED — Montreal & Boston. Real Highlightly PRO /lineups feed
   hydrates these once we wire the endpoint.
   ================================================================ */

const LINEUPS = {
  mtl: {
    team: "MTL",
    teamName: "Montreal Canadiens",
    teamColor: "#AF1E2D",
    cap: { used: "$88.4M", ceiling: "$95.5M", space: "$7.1M", ltir: "None" },
    coach: "Martin St. Louis",
    forwards: [
      { line: "1st Line", players: [
        { pos: "LW", name: "Cole Caufield",  jersey: 22, aav: "$7.85M", slug: "caufield-mtl" },
        { pos: "C",  name: "Nick Suzuki",    jersey: 14, aav: "$7.88M", slug: "suzuki-mtl", captain: true },
        { pos: "RW", name: "Juraj Slafkovsky",jersey: 20,aav: "$0.95M", slug: "slafkovsky-mtl" },
      ]},
      { line: "2nd Line", players: [
        { pos: "LW", name: "Josh Anderson",  jersey: 17, aav: "$5.50M" },
        { pos: "C",  name: "Alex Newhook",   jersey: 15, aav: "$2.90M" },
        { pos: "RW", name: "Brendan Gallagher",jersey: 11,aav: "$6.50M", altCaptain: true },
      ]},
      { line: "3rd Line", players: [
        { pos: "LW", name: "Emil Heineman",  jersey: 51, aav: "$0.88M" },
        { pos: "C",  name: "Kirby Dach",     jersey: 77, aav: "$3.36M" },
        { pos: "RW", name: "Joel Armia",     jersey: 40, aav: "$3.40M" },
      ]},
      { line: "4th Line", players: [
        { pos: "LW", name: "Michael Pezzetta",jersey: 55,aav: "$0.81M" },
        { pos: "C",  name: "Jake Evans",     jersey: 71, aav: "$1.70M" },
        { pos: "RW", name: "Christian Dvorak",jersey: 28, aav: "$4.45M" },
      ]},
    ],
    defense: [
      { pair: "Top Pair", players: [
        { pos: "LD", name: "Mike Matheson",   jersey: 8,  aav: "$4.88M", altCaptain: true },
        { pos: "RD", name: "Lane Hutson",     jersey: 48, aav: "$0.95M" },
      ]},
      { pair: "Second Pair", players: [
        { pos: "LD", name: "Kaiden Guhle",    jersey: 21, aav: "$5.55M" },
        { pos: "RD", name: "Justin Barron",   jersey: 52, aav: "$1.20M" },
      ]},
      { pair: "Third Pair", players: [
        { pos: "LD", name: "Arber Xhekaj",    jersey: 72, aav: "$0.83M" },
        { pos: "RD", name: "David Savard",    jersey: 58, aav: "$3.50M" },
      ]},
    ],
    goalies: [
      { name: "Sam Montembeault", jersey: 35, aav: "$3.15M", role: "Starter" },
      { name: "Cayden Primeau",   jersey: 30, aav: "$0.89M", role: "Backup" },
    ],
    scratches: [
      { name: "Jayden Struble",   pos: "D", jersey: 47, reason: "Healthy scratch" },
      { name: "Owen Beck",        pos: "C", jersey: 41, reason: "Healthy scratch (rookie rotation)" },
    ],
    ir: [
      { name: "David Reinbacher", pos: "D",  status: "IR",         eta: "Unknown",   tag: "Shoulder" },
      { name: "Carey Price",      pos: "G",  status: "LTIR",       eta: "Retired-in-place", tag: "Knee" },
    ],
    farm: {
      affiliate: "Laval Rocket · AHL",
      top: [
        { name: "Joshua Roy",       pos: "RW", stats: "48 GP · 19-24-43" },
        { name: "Owen Beck",        pos: "C",  stats: "45 GP · 16-22-38 (2-way)" },
        { name: "Filip Mesar",      pos: "RW", stats: "42 GP · 12-19-31" },
        { name: "Logan Mailloux",   pos: "D",  stats: "50 GP · 10-31-41" },
        { name: "Jakub Dobes",      pos: "G",  stats: "34 GP · .914 SV%" },
      ],
    },
    prospects: [
      { name: "Ivan Demidov",    pos: "RW", drafted: "2024 · #5 OA", loc: "SKA (KHL)",      note: "Franchise-altering RW" },
      { name: "David Reinbacher",pos: "D",  drafted: "2023 · #5 OA", loc: "Laval (AHL)",    note: "Top-pair upside" },
      { name: "Michael Hage",    pos: "C",  drafted: "2024 · #21 OA", loc: "U. Michigan",   note: "Two-way center" },
      { name: "Lane Hutson",     pos: "D",  drafted: "2022 · #62 OA", loc: "NHL — grad'd",  note: "Calder favorite" },
    ],
  },
  bos: {
    team: "BOS",
    teamName: "Boston Bruins",
    teamColor: "#FFB81C",
    cap: { used: "$94.1M", ceiling: "$95.5M", space: "$1.4M", ltir: "None" },
    coach: "Jim Montgomery",
    forwards: [
      { line: "1st Line", players: [
        { pos: "LW", name: "Brad Marchand",   jersey: 63, aav: "$6.13M", slug: "marchand-bos", captain: true },
        { pos: "C",  name: "Elias Lindholm",  jersey: 28, aav: "$7.75M" },
        { pos: "RW", name: "David Pastrnak",  jersey: 88, aav: "$11.25M", slug: "pastrnak-bos" },
      ]},
      { line: "2nd Line", players: [
        { pos: "LW", name: "Pavel Zacha",     jersey: 18, aav: "$4.75M" },
        { pos: "C",  name: "Charlie Coyle",   jersey: 13, aav: "$5.25M", altCaptain: true },
        { pos: "RW", name: "Morgan Geekie",   jersey: 39, aav: "$2.00M" },
      ]},
      { line: "3rd Line", players: [
        { pos: "LW", name: "Trent Frederic",  jersey: 11, aav: "$2.30M" },
        { pos: "C",  name: "Matt Poitras",    jersey: 51, aav: "$0.87M" },
        { pos: "RW", name: "Justin Brazeau",  jersey: 55, aav: "$0.78M" },
      ]},
      { line: "4th Line", players: [
        { pos: "LW", name: "Cole Koepke",     jersey: 45, aav: "$0.78M" },
        { pos: "C",  name: "John Beecher",    jersey: 19, aav: "$0.83M" },
        { pos: "RW", name: "Mark Kastelic",   jersey: 47, aav: "$0.85M" },
      ]},
    ],
    defense: [
      { pair: "Top Pair", players: [
        { pos: "LD", name: "Hampus Lindholm", jersey: 27, aav: "$6.50M", altCaptain: true },
        { pos: "RD", name: "Charlie McAvoy",  jersey: 73, aav: "$7.30M" },
      ]},
      { pair: "Second Pair", players: [
        { pos: "LD", name: "Mason Lohrei",    jersey: 6,  aav: "$0.93M" },
        { pos: "RD", name: "Brandon Carlo",   jersey: 25, aav: "$4.10M" },
      ]},
      { pair: "Third Pair", players: [
        { pos: "LD", name: "Nikita Zadorov",  jersey: 91, aav: "$5.00M" },
        { pos: "RD", name: "Andrew Peeke",    jersey: 52, aav: "$2.75M" },
      ]},
    ],
    goalies: [
      { name: "Jeremy Swayman",     jersey: 1,  aav: "$8.25M", role: "Starter" },
      { name: "Joonas Korpisalo",   jersey: 70, aav: "$3.00M", role: "Backup" },
    ],
    scratches: [
      { name: "Parker Wotherspoon", pos: "D", jersey: 29, reason: "Healthy scratch" },
    ],
    ir: [
      { name: "Matt Poitras",   pos: "C", status: "IR",         eta: "May 15",    tag: "Shoulder" },
      { name: "Charlie McAvoy", pos: "D", status: "DAY-TO-DAY", eta: "Game-time", tag: "Lower Body" },
    ],
    farm: {
      affiliate: "Providence Bruins · AHL",
      top: [
        { name: "Fabian Lysell",  pos: "RW", stats: "52 GP · 18-25-43" },
        { name: "Georgii Merkulov",pos: "C", stats: "50 GP · 22-19-41" },
        { name: "Michael DiPietro",pos:"G",  stats: "27 GP · .921 SV%" },
        { name: "Riley Duran",     pos: "LW", stats: "48 GP · 12-16-28" },
        { name: "Trevor Kuntar",   pos: "C",  stats: "45 GP · 10-14-24" },
      ],
    },
    prospects: [
      { name: "Dean Letourneau",  pos: "C",  drafted: "2024 · #25 OA", loc: "Boston College", note: "6'7\" pivot with hands" },
      { name: "Fraser Minten",    pos: "C",  drafted: "2022 · #38 OA (TOR)", loc: "Providence (AHL)", note: "Acquired at 2025 deadline" },
      { name: "Fabian Lysell",    pos: "RW", drafted: "2021 · #21 OA", loc: "Providence (AHL)", note: "Speed + skill winger" },
      { name: "Matthew Poitras",  pos: "C",  drafted: "2022 · #54 OA", loc: "NHL",              note: "Shoulder, injured" },
    ],
  },
};

/* ---------------------------- HELPERS ---------------------------- */

function PlayerCell({ player }) {
  const inner = (
    <div className="rounded-md border border-white/10 hover:border-white/40 bg-black/40 hover:bg-black/60 px-3 py-3 h-full transition-all">
      <div className="flex items-start gap-2">
        <div className="h-9 w-9 rounded-full flex-shrink-0 flex items-center justify-center"
             style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)" }}>
          <span style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "13px", color: "#fff" }}>
            {player.jersey}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1">
            <span style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "15px", color: "#fff", lineHeight: 1.15 }}>
              {player.name}
            </span>
            {player.captain && (
              <span className="ml-1 text-[10px] text-yellow-300" style={{ fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.15em" }}>C</span>
            )}
            {player.altCaptain && (
              <span className="ml-1 text-[10px] text-white/60" style={{ fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.15em" }}>A</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5" style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.15em", color: "#a0a0a5" }}>
            <span>{player.pos}</span>
            <span>·</span>
            <span>{player.aav}</span>
          </div>
        </div>
      </div>
    </div>
  );
  return player.slug ? (
    <Link to={`/player/${player.slug}`} data-testid={`lineup-player-${player.slug}`}>
      {inner}
    </Link>
  ) : (
    <div>{inner}</div>
  );
}

function LineRow({ label, players }) {
  return (
    <div>
      <div className="mb-1.5" style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.28em", color: "#a0a0a5" }}>
        {label}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {players.map((p, i) => <PlayerCell key={i} player={p} />)}
      </div>
    </div>
  );
}

/* ---------------------------- PAGE ---------------------------- */

export default function Lineup() {
  const { team: teamParam = "mtl" } = useParams();
  const team = LINEUPS[teamParam.toLowerCase()] || LINEUPS.mtl;

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white pb-24" data-testid="lineup-page">
      {/* Header band */}
      <div className="relative overflow-hidden border-b border-white/10"
           style={{ background: `radial-gradient(circle at 20% 40%, ${team.teamColor}22, transparent 60%), #0b0b10` }}>
        <div className="max-w-6xl mx-auto px-6 pt-6 pb-3 flex items-center gap-3">
          <Link to="/home-v2" className="text-white/50 hover:text-white flex items-center gap-1 text-sm"
                style={{ fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.2em" }}>
            <ArrowLeft className="w-4 h-4" /> BACK
          </Link>
        </div>
        <div className="max-w-6xl mx-auto px-6 pb-6 flex items-center gap-4">
          <TeamLogo code={team.team} size={68} />
          <div className="flex-1">
            <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "34px", color: "#fff", lineHeight: 1 }}>
              {team.teamName}
            </div>
            <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "11px", letterSpacing: "0.3em", color: team.teamColor }}>
              LINEUP & ROSTER · HEAD COACH {team.coach.toUpperCase()}
            </div>
          </div>
          {/* Cap summary */}
          <div className="hidden md:flex items-center gap-4 pl-4 border-l border-white/10">
            <div>
              <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.25em", color: "#a0a0a5" }}>CAP HIT</div>
              <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "18px", color: "#fff" }}>{team.cap.used}</div>
            </div>
            <div>
              <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.25em", color: "#a0a0a5" }}>SPACE</div>
              <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "18px", color: "#22c55e" }}>{team.cap.space}</div>
            </div>
            <div>
              <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.25em", color: "#a0a0a5" }}>CEILING</div>
              <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "18px", color: "#a0a0a5" }}>{team.cap.ceiling}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Forwards */}
        <div className="rounded-lg border border-white/10 bg-black/40 p-5">
          <div className="flex items-center justify-between mb-4">
            <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "14px", letterSpacing: "0.3em", color: "#fff" }}>
              FORWARDS
            </span>
            <span className="text-[11px] text-white/40" style={{ fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.2em" }}>
              LW · C · RW
            </span>
          </div>
          <div className="space-y-4">
            {team.forwards.map((line, i) => (
              <LineRow key={i} label={line.line} players={line.players} />
            ))}
          </div>
        </div>

        {/* Defense */}
        <div className="rounded-lg border border-white/10 bg-black/40 p-5">
          <div className="flex items-center justify-between mb-4">
            <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "14px", letterSpacing: "0.3em", color: "#fff" }}>
              DEFENSE
            </span>
            <span className="text-[11px] text-white/40" style={{ fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.2em" }}>
              LD · RD
            </span>
          </div>
          <div className="space-y-4">
            {team.defense.map((pair, i) => (
              <div key={i}>
                <div className="mb-1.5" style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.28em", color: "#a0a0a5" }}>
                  {pair.pair}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {pair.players.map((p, j) => <PlayerCell key={j} player={p} />)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Goalies */}
        <div className="rounded-lg border border-white/10 bg-black/40 p-5">
          <div className="mb-3">
            <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "14px", letterSpacing: "0.3em", color: "#fff" }}>
              GOALTENDERS
            </span>
          </div>
          <div className="grid md:grid-cols-2 gap-2">
            {team.goalies.map((g, i) => (
              <div key={i} className="rounded-md border border-white/10 bg-black/40 px-4 py-3 flex items-center gap-3">
                <div className="h-11 w-11 rounded-full flex items-center justify-center"
                     style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)" }}>
                  <span style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "15px", color: "#fff" }}>{g.jersey}</span>
                </div>
                <div className="flex-1">
                  <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "17px", color: "#fff" }}>{g.name}</div>
                  <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.2em", color: "#a0a0a5" }}>
                    G · {g.aav}
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded"
                      style={{ background: g.role === "Starter" ? "#1E5BFF33" : "rgba(255,255,255,0.06)",
                               border: `1px solid ${g.role === "Starter" ? "#1E5BFF" : "rgba(255,255,255,0.15)"}`,
                               fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.2em",
                               color: g.role === "Starter" ? "#1E5BFF" : "#a0a0a5" }}>
                  {g.role.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Scratches + IR */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-white/10 bg-black/40 p-5">
            <div className="flex items-center justify-between mb-3">
              <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "13px", letterSpacing: "0.28em", color: "#fff" }}>
                HEALTHY SCRATCHES
              </span>
              <span className="text-[11px] text-white/40" style={{ fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.2em" }}>
                {team.scratches.length}
              </span>
            </div>
            <div className="space-y-2">
              {team.scratches.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-8 text-white/60 text-center" style={{ fontFamily: "Rajdhani", fontWeight: 700 }}>{s.jersey}</span>
                  <div className="flex-1">
                    <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "14px", color: "#fff" }}>{s.name}</div>
                    <div style={{ fontFamily: "Oswald", fontWeight: 600, fontSize: "10px", letterSpacing: "0.15em", color: "#a0a0a5" }}>
                      {s.pos} · {s.reason}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/40 p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "13px", letterSpacing: "0.28em", color: "#fff" }}>
                INJURED RESERVE
              </span>
            </div>
            <div className="space-y-2">
              {team.ir.map((ir, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "14px", color: "#fff" }}>{ir.name}</div>
                    <div style={{ fontFamily: "Oswald", fontWeight: 600, fontSize: "10px", letterSpacing: "0.15em", color: "#a0a0a5" }}>
                      {ir.pos} · {ir.tag} · Est. return {ir.eta}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px]"
                        style={{ background: "#dc262622", border: "1px solid #dc262666", color: "#f87171",
                                 fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.15em" }}>
                    {ir.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Farm system */}
        <div className="rounded-lg border border-white/10 bg-black/40 p-5">
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "13px", letterSpacing: "0.28em", color: "#fff" }}>
              FARM SYSTEM · {team.farm.affiliate.toUpperCase()}
            </span>
            <button className="text-[12px] text-sky-400 hover:text-sky-300 flex items-center gap-1"
                    style={{ fontFamily: "Rajdhani", fontWeight: 600 }}>
              Full AHL roster <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-1.5">
            {team.farm.top.map((p, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                <div className="flex items-baseline gap-3">
                  <span className="w-8 text-white/40 text-center text-sm" style={{ fontFamily: "Oswald", fontWeight: 700 }}>{p.pos}</span>
                  <span style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "15px", color: "#fff" }}>{p.name}</span>
                </div>
                <span className="text-[13px] text-white/70" style={{ fontFamily: "Rajdhani", fontWeight: 600 }}>{p.stats}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Prospects (not yet in the league) */}
        <div className="rounded-lg border border-white/10 bg-black/40 p-5">
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "13px", letterSpacing: "0.28em", color: "#fff" }}>
              TOP PROSPECTS
            </span>
            <span className="text-[11px] text-white/40" style={{ fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.2em" }}>
              DRAFTED · NOT YET GRADUATED
            </span>
          </div>
          <div className="grid md:grid-cols-2 gap-2">
            {team.prospects.map((p, i) => (
              <div key={i} className="rounded-md border border-white/10 bg-black/40 p-3">
                <div className="flex items-center justify-between">
                  <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "16px", color: "#fff" }}>{p.name}</div>
                  <span className="text-[11px] text-white/50" style={{ fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.2em" }}>{p.pos}</span>
                </div>
                <div className="mt-0.5 text-[12px] text-white/60" style={{ fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.15em" }}>
                  {p.drafted} · {p.loc}
                </div>
                <div className="mt-1.5 text-[13px] text-white/80" style={{ fontFamily: "Rajdhani", fontWeight: 600, lineHeight: 1.35 }}>
                  {p.note}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
