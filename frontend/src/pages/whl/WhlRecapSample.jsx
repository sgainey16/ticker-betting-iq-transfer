// WHL Recap Sample — Kamloops @ Portland, Apr 5 (mock)
// Route: /whl/recap-sample
// Concept: what a full "game highlight recap package" looks like when
// The Ticker treats every scoring event + penalty + turning point with
// its own AI-generated analysis card. This is the video-overlay engine's
// UI-side companion — how the recap is presented on the page.

import { useState, useRef } from "react";
import { Play, Pause, Loader2, Zap, Shield, AlertOctagon, Target } from "lucide-react";
import { api } from "@/lib/api";

const GAME = {
  date: "Sat · Apr 5, 2026",
  arena: "Sandman Centre · Kamloops, BC",
  attendance: "5,204",
  away: { code: "POR", name: "Portland Winterhawks", logo: "https://upload.wikimedia.org/wikipedia/en/thumb/0/0e/Portland_Winterhawks_2015.png/1200px-Portland_Winterhawks_2015.png", primary: "#8B0000", score: 3 },
  home: { code: "KAM", name: "Kamloops Blazers",  logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Kamloops_Blazers_logo.svg/1200px-Kamloops_Blazers_logo.svg.png", primary: "#F58220", score: 5 },
  gcs: { home: 63, away: 37 },   // Game Control Score
  lead: "Blazers ran this from the drop of the puck. Portland's PK cracked, Kaid Oliver put on a masterclass, and Vasa slammed the door in the third.",
  bullets: [
    "Blazers won the high-danger battle 14–7",
    "Portland went 0-for-4 on the power play",
    "Kamloops PP cashed twice in five chances",
    "Vasa .938 SV% · third-period shutout stretch",
    "Blazers won 61% of faceoffs (35–22)",
  ],
  events: [
    {
      t: "P1 · 03:42", kind: "goal", team: "KAM",
      title: "OLIVER · 22ND OF THE SEASON",
      detail: "Kaid Oliver (22) · A: Boumedienne, Kolt",
      situation: "5v5",
      reggie: "Oliver walks into the zone like he owns it — and tonight he does. Snapped it clean over the glove side, textbook.",
      marc: "That's a 78% xG shot in Corsi terms — he picked the exact spot most goalies bleed. Not luck.",
      score: "1–0",
      pace: "OPENING PUNCH",
    },
    {
      t: "P1 · 08:15", kind: "penalty", team: "POR",
      title: "PORTLAND · 2 MIN",
      detail: "Diego Buttazzoni · Interference",
      situation: "PIM",
      reggie: "Lazy stick, terrible read. This is what happens when a fourth-liner tries to save face on a lost race.",
      marc: "Buttazzoni's fourth minor of the month. Portland's PK is #22 in the league — this is a bad time to test it.",
      score: "1–0",
      pace: "MOMENTUM STAYS BLAZERS",
    },
    {
      t: "P1 · 09:41", kind: "goal", team: "KAM",
      title: "SOP · PP · 15TH OF SEASON",
      detail: "Matthew Sop (15) · A: Oliver, Brzustewicz",
      situation: "PP · 1:26 elapsed",
      reggie: "Boom. One-timer off the flank, that thing is IN before Cossa moves. Sop's a first-round pick for a reason.",
      marc: "Blazers PP running the 1-3-1 with Brzustewicz at the point — that's a $2M contract look at the CHL level.",
      score: "2–0",
      pace: "PP CASHES · +1.5 GCS",
    },
    {
      t: "P2 · 04:18", kind: "goal", team: "POR",
      title: "SILLINGER RESPONDS",
      detail: "Aidan Sillinger (18) · A: Konar",
      situation: "5v5",
      reggie: "Sillinger's the real deal — knifes through the slot and roofs it. Vasa never had a chance.",
      marc: "That was a broken coverage — Kolt lost his mark on the weak-side. Watch that on tape tomorrow.",
      score: "2–1",
      pace: "PORTLAND FIGHTS BACK",
    },
    {
      t: "P2 · 11:32", kind: "goal", team: "KAM",
      title: "BOUMEDIENNE · SLAP-SHOT SEAL",
      detail: "Elouann Boumedienne (7) · A: Sop",
      situation: "5v5",
      reggie: "The Frenchman winds it up from the point — that thing was still rising when it hit twine. Beauty.",
      marc: "6-foot-4 defenseman with a 91-mph release. NHL scouts are taking notes. This kid moves up boards.",
      score: "3–1",
      pace: "TWO-GOAL CUSHION",
    },
    {
      t: "P2 · 17:04", kind: "penalty", team: "KAM",
      title: "KAMLOOPS · 4 MIN",
      detail: "Hunter Brzustewicz · High-Sticking (Double Minor)",
      situation: "PIM · Blood",
      reggie: "Ugh. Reckless — Hunter knows better than that. Now you're killing four straight with the crowd going quiet.",
      marc: "Blazers PK is #9 in the league so they'll probably survive, but this is exactly the kind of self-inflicted damage that costs playoff games.",
      score: "3–1",
      pace: "PORTLAND SNIFFING BLOOD",
    },
    {
      t: "P3 · 06:59", kind: "goal", team: "POR",
      title: "PORTLAND CLIMBS BACK",
      detail: "Ryder Thompson (14) · A: Sillinger",
      situation: "5v5",
      reggie: "Kamloops fell asleep at the switch — Thompson walks in unmarked and picks the corner. That's a wake-up call.",
      marc: "Blazers' shift lines got scrambled after an icing. Cossa waved for the change, coach didn't hear. Small margins.",
      score: "3–2",
      pace: "ONE-GOAL GAME",
    },
    {
      t: "P3 · 13:47", kind: "goal", team: "KAM",
      title: "OLIVER AGAIN · 23RD",
      detail: "Kaid Oliver (23) · A: Sop, Kolt",
      situation: "5v5",
      reggie: "Portland's on their heels and Oliver drives the net like a truck — puts it home off his own rebound. Killer instinct.",
      marc: "That's his 3rd multi-goal game in April. Draft rankings just moved him inside the top-15 conversation.",
      score: "4–2",
      pace: "OLIVER SEALS IT",
    },
    {
      t: "P3 · 19:12", kind: "goal", team: "KAM",
      title: "EMPTY-NETTER",
      detail: "Matthew Sop (16) · Unassisted",
      situation: "EN",
      reggie: "Sop from center ice — put a bow on it. Blazers get the two points, and the building loses its mind.",
      marc: "16 goals in 60 games for Sop. Steady scorer, good in transition. Draft-eligible in June.",
      score: "5–2",
      pace: "GAME OVER",
    },
    {
      t: "P3 · 19:58", kind: "goal", team: "POR",
      title: "PORTLAND · CONSOLATION",
      detail: "Jesse Konar (11) · A: Sillinger",
      situation: "6v5 EA",
      reggie: "Late garbage — but hey, Konar buries it clean. Doesn't change anything.",
      marc: "Final xG: KAM 4.1, POR 2.6. Blazers earned this. No debate.",
      score: "5–3",
      pace: "FINAL",
    },
  ],
};

const KIND_STYLE = {
  goal:    { color: "#22c55e", label: "GOAL",    Icon: Zap },
  penalty: { color: "#eab308", label: "PENALTY", Icon: AlertOctagon },
  save:    { color: "#3b82f6", label: "KEY SAVE", Icon: Shield },
};

export default function WhlRecapSample() {
  return (
    <div className="min-h-screen bg-[#0b0b10] text-white">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-5">
        {/* Concept banner */}
        <div className="rounded-lg border border-[#F58220]/40 bg-gradient-to-r from-[#F58220]/15 to-transparent px-4 py-2.5">
          <div className="font-accent text-[10px] uppercase tracking-[0.3em] text-[#F58220]">
            The Ticker · WHL Desk · Recap Package Concept
          </div>
          <div className="font-headline text-white text-sm mt-0.5">
            Kamloops Blazers 5 — 3 Portland Winterhawks · Apr 5, 2026
          </div>
        </div>

        {/* Score header — big broadcast look */}
        <div className="rounded-xl border border-white/10 bg-black/50 p-5">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className="flex items-center gap-3 justify-start">
              <img src={GAME.away.logo} alt={GAME.away.code} className="w-20 h-20 object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]" />
              <div>
                <div className="font-headline text-white text-2xl leading-none">{GAME.away.score}</div>
                <div className="font-accent text-[10px] uppercase tracking-[0.25em] text-white/50 mt-1">{GAME.away.code}</div>
              </div>
            </div>
            <div className="text-center font-accent text-[10px] uppercase tracking-[0.3em] text-white/40">
              FINAL
            </div>
            <div className="flex items-center gap-3 justify-end">
              <div className="text-right">
                <div className="font-headline text-white text-2xl leading-none">{GAME.home.score}</div>
                <div className="font-accent text-[10px] uppercase tracking-[0.25em] text-white/50 mt-1">{GAME.home.code}</div>
              </div>
              <img src={GAME.home.logo} alt={GAME.home.code} className="w-20 h-20 object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]" />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-white/10 text-center font-accent text-[10px] uppercase tracking-[0.28em] text-white/50">
            {GAME.date} · {GAME.arena} · {GAME.attendance} attendance
          </div>
        </div>

        {/* Game Story — signature translate-data-into-meaning panel */}
        <div className="rounded-xl border border-white/10 bg-gradient-to-br from-[#0b0b10] via-[#0b0b10] to-[#111426] overflow-hidden">
          <div className="grid md:grid-cols-[200px_1fr] gap-0">
            <div className="p-4 border-b md:border-b-0 md:border-r border-white/10 flex flex-col items-center justify-center gap-2 bg-black/30">
              <ControlGauge value={GAME.gcs.home} />
              <div className="text-center leading-tight">
                <div className="font-accent text-[9px] uppercase tracking-[0.3em] text-[#F58220]">GAME CONTROL</div>
                <div className="font-headline text-base text-white mt-1">{GAME.home.code}</div>
                <div className="font-accent text-[9px] tracking-[0.25em] text-white/40">vs {GAME.away.code} · {GAME.gcs.away}</div>
              </div>
            </div>
            <div className="p-4 sm:p-5 flex flex-col gap-3">
              <div>
                <div className="font-accent text-[10px] uppercase tracking-[0.3em] text-white/40 mb-1.5">Why Portland Lost</div>
                <p className="font-headline text-lg text-white leading-snug">{GAME.lead}</p>
              </div>
              <ul className="space-y-1.5">
                {GAME.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-white/85 text-sm">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-[#F58220] flex-shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Event timeline — every goal + penalty with paired analysis */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-[#F58220]">Every Turning Point</div>
            <div className="font-accent text-[9px] uppercase tracking-[0.25em] text-white/40">{GAME.events.length} events</div>
          </div>
          {GAME.events.map((e, i) => <EventCard key={i} event={e} />)}
        </div>
      </div>
    </div>
  );
}

function EventCard({ event }) {
  const style = KIND_STYLE[event.kind];
  const Icon = style.Icon;
  const teamColor = event.team === "KAM" ? "#F58220" : "#8B0000";
  // Each card owns its own audio state so tapping one plays THAT event's
  // unique Reggie+Marc take (not the shared LiveDesk audio). Generated on
  // demand via /api/recap-show/line-audio → ElevenLabs.
  const [state, setState] = useState("idle"); // idle | loading | playing | error
  const audioRef = useRef(null);
  const urlsRef = useRef({ reggie: null, marc: null }); // cache generated URLs
  const backend = process.env.REACT_APP_BACKEND_URL;

  const stopPlayback = () => {
    const a = audioRef.current;
    if (a) { try { a.pause(); a.currentTime = 0; } catch {} }
    setState("idle");
  };

  const fetchLine = async (speaker, text) => {
    if (urlsRef.current[speaker]) return urlsRef.current[speaker];
    const r = await api.get(`/recap-show/line-audio?speaker=${speaker}&text=${encodeURIComponent(text)}`);
    const url = r.data?.audio_url;
    if (!url) throw new Error("no audio url");
    const full = url.startsWith("http") ? url : `${backend}${url}`;
    urlsRef.current[speaker] = full;
    return full;
  };

  const play = async () => {
    if (state === "playing") { stopPlayback(); return; }
    if (state === "loading") return;
    setState("loading");
    try {
      // Generate Reggie first, then Marc — play them back-to-back.
      const reggieUrl = await fetchLine("reggie", event.reggie);
      const marcUrl   = await fetchLine("marc",   event.marc);
      const a = audioRef.current || new Audio();
      audioRef.current = a;
      a.src = reggieUrl;
      setState("playing");
      a.onended = () => {
        // Chain into Marc's take
        a.onended = () => setState("idle");
        a.src = marcUrl;
        a.play().catch(() => setState("idle"));
      };
      await a.play();
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 1500);
    }
  };

  return (
    <div className="rounded-lg border border-white/10 bg-black/40 overflow-hidden" data-testid={`whl-event-${event.t.replace(/[^a-z0-9]/gi,'-')}`}>
      <div className="flex items-center gap-3 p-3 border-b border-white/5" style={{ background: `linear-gradient(90deg, ${teamColor}20, transparent 60%)` }}>
        <div className="flex-shrink-0 h-10 w-10 rounded-md flex items-center justify-center" style={{ background: `${style.color}25`, border: `1px solid ${style.color}55` }}>
          <Icon className="w-5 h-5" style={{ color: style.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-accent text-[9px] uppercase tracking-[0.3em]" style={{ color: style.color }}>{style.label}</span>
            <span className="font-accent text-[9px] uppercase tracking-[0.25em] text-white/40">·</span>
            <span className="font-accent text-[9px] uppercase tracking-[0.25em] text-white/40">{event.t}</span>
            <span className="font-accent text-[9px] uppercase tracking-[0.25em] text-white/40">·</span>
            <span className="font-accent text-[9px] uppercase tracking-[0.25em] text-white/60">{event.situation}</span>
          </div>
          <div className="font-headline text-white text-base leading-tight mt-0.5">{event.title}</div>
          <div className="text-white/70 text-[13px] mt-0.5">{event.detail}</div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-headline text-white text-lg leading-none">{event.score}</div>
          <div className="font-accent text-[8px] uppercase tracking-[0.28em] mt-1" style={{ color: teamColor }}>{event.pace}</div>
        </div>
      </div>

      <div className="grid md:grid-cols-[240px_1fr] gap-0">
        <button
          onClick={play}
          disabled={state === "loading"}
          data-testid={`whl-event-play-${event.t.replace(/[^a-z0-9]/gi,'-')}`}
          className="relative aspect-video md:aspect-square bg-gradient-to-br from-[#1a1a2e] via-[#0f0f1a] to-[#1a0f1f] flex items-center justify-center group border-b md:border-b-0 md:border-r border-white/5 focus:outline-none focus:ring-2 focus:ring-[#F58220]"
        >
          <div className="absolute inset-2 border border-white/5 rounded-md pointer-events-none" />
          <div className="text-center">
            <span className={`mx-auto h-12 w-12 rounded-full flex items-center justify-center shadow-[0_0_20px_-2px_rgba(245,130,32,0.85)] transition-colors ${
              state === "playing" ? "bg-red-600 hover:bg-red-500" : "bg-[#F58220] group-hover:bg-[#ff9042]"
            }`}>
              {state === "loading" ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : state === "playing" ? (
                <Pause className="w-5 h-5 text-white" fill="currentColor" />
              ) : (
                <Play className="w-5 h-5 text-white translate-x-[1px]" fill="currentColor" />
              )}
            </span>
            <div className="font-accent text-[9px] uppercase tracking-[0.3em] text-white/50 mt-2">
              {state === "playing" ? "Playing Take" : state === "loading" ? "Generating…" : state === "error" ? "Try Again" : "Play Take"}
            </div>
            <div className="font-accent text-[8px] tracking-[0.25em] text-white/30 mt-0.5">Reggie → Marc · unique per event</div>
          </div>
        </button>

        <div className="p-3 sm:p-4 space-y-3">
          <TakeBlock host="reggie" accent="#F58220" role="Reggie · Anchor" text={event.reggie} />
          <TakeBlock host="marc" accent="#22d3ee" role="Marc · Numbers" text={event.marc} />
        </div>
      </div>
    </div>
  );
}

function TakeBlock({ host, accent, role, text }) {
  return (
    <div className="flex gap-2.5 items-start">
      <div className="flex-shrink-0 w-1 h-full rounded-full self-stretch" style={{ background: accent, minHeight: 24 }} />
      <div className="flex-1 min-w-0">
        <div className="font-accent text-[9px] uppercase tracking-[0.28em]" style={{ color: accent }}>{role}</div>
        <div className="text-white/90 text-[13px] leading-snug mt-0.5">"{text}"</div>
      </div>
    </div>
  );
}

function ControlGauge({ value }) {
  const size = 92, stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * c;
  const color = pct >= 62 ? "#F58220" : pct >= 55 ? "#ff9042" : "#ffffff";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} stroke="#2d2d35" strokeWidth={stroke} fill="transparent" />
        <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={stroke} fill="transparent" strokeLinecap="round" strokeDasharray={`${dash} ${c-dash}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-headline text-2xl text-white leading-none">{pct}</div>
        <div className="font-accent text-[8px] uppercase tracking-[0.3em] text-white/40 mt-0.5">/ 100</div>
      </div>
    </div>
  );
}
