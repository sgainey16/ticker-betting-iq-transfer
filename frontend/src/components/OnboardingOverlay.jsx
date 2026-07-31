// OnboardingOverlay — first-run experience for The Ticker.
//
// Runs on the very first visit (localStorage-gated). Reggie greets the user,
// asks for their name, then asks for their team. Both inputs support VOICE
// (Web Speech API) as the primary interaction — the "verbal is our thing"
// promise — with a typed fallback for browsers that don't support STT.
//
// After onboarding we:
//   • Persist `ticker.userName` and `ticker.homeTeam` (uppercase 3-letter code)
//   • Flip `ticker.onboarded = "1"` so we never show this again
//   • Navigate to /press-conference (Home) — the picked team's Team Room
//
// To re-run for testing/demos, append ?onboarding=1 to any URL.

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Mic, MicOff, ArrowRight, X } from "lucide-react";
import { useTeamLogos, TeamLogo } from "@/lib/teamLogos";
import { TMark } from "@/lib/brand";
import { API, BACKEND_URL } from "@/lib/api";

const API_BASE = API;
const HOST_BASE = BACKEND_URL;

const STORAGE = {
  onboarded: "ticker.onboarded",
  userName: "ticker.userName",
  homeTeam: "ticker.homeTeam",
};

// NHL city → 3-letter code lookup. We build the display list from the live
// Highlightly response (all 32 logos), but voice-matching needs a stable
// dictionary of common names and nicknames so "the Hawks" or "Chicago" both
// resolve to CHI.
const TEAM_ALIASES = {
  ANA: ["anaheim", "ducks"],
  BOS: ["boston", "bruins", "b's", "bees"],
  BUF: ["buffalo", "sabres"],
  CGY: ["calgary", "flames"],
  CAR: ["carolina", "hurricanes", "canes"],
  CHI: ["chicago", "blackhawks", "hawks"],
  COL: ["colorado", "avalanche", "avs"],
  CBJ: ["columbus", "blue jackets", "jackets"],
  DAL: ["dallas", "stars"],
  DET: ["detroit", "red wings", "wings"],
  EDM: ["edmonton", "oilers"],
  FLA: ["florida", "panthers"],
  LA:  ["los angeles", "la kings", "kings"],
  MIN: ["minnesota", "wild"],
  MTL: ["montreal", "canadiens", "habs"],
  NSH: ["nashville", "predators", "preds"],
  NJ:  ["new jersey", "devils"],
  NYI: ["new york islanders", "islanders", "isles"],
  NYR: ["new york rangers", "rangers"],
  OTT: ["ottawa", "senators", "sens"],
  PHI: ["philadelphia", "flyers"],
  PIT: ["pittsburgh", "penguins", "pens"],
  SJ:  ["san jose", "sharks"],
  SEA: ["seattle", "kraken"],
  STL: ["st louis", "st. louis", "blues"],
  TB:  ["tampa bay", "tampa", "lightning", "bolts"],
  TOR: ["toronto", "maple leafs", "leafs"],
  UTAH:["utah", "hockey club", "mammoth"],
  VAN: ["vancouver", "canucks"],
  VGK: ["vegas", "las vegas", "golden knights", "knights"],
  WSH: ["washington", "capitals", "caps"],
  WPG: ["winnipeg", "jets"],
};
const NHL_CODES = Object.keys(TEAM_ALIASES);

// Which teams have full seed data in TeamRoomAudition. Others land on a
// "Team Room lighting up soon" placeholder — still with logo + record shell.
const SEEDED = new Set(["BOS", "MTL", "TOR", "EDM", "NYR", "COL"]);

// Reggie's script. Split into "acts" so we can gate progression on user
// input between them. Each line is spoken separately (own audio call) so we
// preserve the staccato broadcast cadence you wrote.
const ACTS = {
  intro: [
    "Hey, bud. Welcome to The Ticker.",
    "Your own sports network — built around you.",
    "You're not gonna find a network like this anywhere else, bud.",
    "I'm Reggie.",
    "What should I call you?",
  ],
  greet: (name) => [
    `Good to meet you, ${name}.`,
    "I've spent a lot of years around the game… but before we get into hockey…",
    "Who's your team?",
  ],
  transition: (teamName) => [
    "Now we're talking.",
    `${teamName}. I like it.`,
  ],
  welcome: [
    "Welcome home.",
    "From now on, this is your hockey headquarters.",
    "I'll keep an eye on your team, find the biggest stories, and help you catch up fast.",
    "If you ever want to jump to another team or search for a play, just ask.",
    "Head over to Predict when you're feeling brave — see if you can beat my calls. Ten-and-ten gets you in the Sharp Room.",
    "Have a look around.",
    "I'll be right here if you need me.",
  ],
};

// Try the Web Speech API. Returns a start/stop pair or null if unsupported.
function useSpeechRecognition({ onResult, onEnd }) {
  const recognitionRef = useRef(null);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = "en-US";
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    r.onresult = (evt) => {
      const last = evt.results[evt.results.length - 1];
      const text = last[0].transcript.trim();
      onResult?.(text, last.isFinal);
    };
    r.onend = () => { setListening(false); onEnd?.(); };
    r.onerror = () => { setListening(false); };
    recognitionRef.current = r;
    setSupported(true);
    return () => { try { r.stop(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = () => {
    if (!recognitionRef.current || listening) return;
    try { recognitionRef.current.start(); setListening(true); } catch {}
  };
  const stop = () => {
    if (!recognitionRef.current) return;
    try { recognitionRef.current.stop(); } catch {}
    setListening(false);
  };
  return { supported, listening, start, stop };
}

// Match spoken text → team code. Simple lowercase substring across aliases.
function matchTeam(spoken) {
  const s = spoken.toLowerCase().trim();
  if (!s) return null;
  // Exact 3-letter code shortcut
  const up = s.toUpperCase();
  if (TEAM_ALIASES[up]) return up;
  // Alias longest-match first (so "new york rangers" beats "new york")
  let best = null;
  let bestLen = 0;
  for (const code of NHL_CODES) {
    for (const alias of TEAM_ALIASES[code]) {
      if (s.includes(alias) && alias.length > bestLen) {
        best = code;
        bestLen = alias.length;
      }
    }
  }
  return best;
}

// Fetch Reggie audio for a line and play it. Returns a promise that resolves
// when playback finishes so we can chain lines in sequence.
async function playReggieLine(text) {
  try {
    const r = await fetch(`${API_BASE}/recap-show/line-audio?speaker=reggie&text=${encodeURIComponent(text)}`);
    const data = await r.json();
    if (!data.audio_url) return;
    const audio = new Audio(data.audio_url.startsWith("/") ? `${HOST_BASE}${data.audio_url}` : data.audio_url);
    await new Promise((resolve) => {
      audio.onended = resolve;
      audio.onerror = resolve;
      audio.play().catch(() => resolve());
    });
  } catch {}
}

/* ------------------------- COMPONENT ------------------------- */

export default function OnboardingOverlay() {
  const navigate = useNavigate();
  const location = useLocation();
  const { map: logoMap } = useTeamLogos();

  // Gate: show only if never onboarded — unless ?onboarding=1 forces it.
  const forced = new URLSearchParams(location.search).get("onboarding") === "1";
  const [visible, setVisible] = useState(() => {
    if (forced) return true;
    try { return !window.localStorage.getItem(STORAGE.onboarded); }
    catch { return true; }
  });

  const [act, setAct] = useState("intro"); // intro | name | greet | team | transition | welcome
  const [linesShown, setLinesShown] = useState(0); // how many lines of the current act have appeared
  const [name, setName] = useState("");
  const [teamCode, setTeamCode] = useState(null);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [teamQuery, setTeamQuery] = useState("");

  // Lines for the current act — memoized so refs stay stable.
  const currentLines = useMemo(() => {
    if (act === "intro") return ACTS.intro;
    if (act === "greet") return ACTS.greet(name || "friend");
    if (act === "transition") return ACTS.transition(logoMap[teamCode]?.name || "");
    if (act === "welcome") return ACTS.welcome;
    return [];
  }, [act, name, teamCode, logoMap]);

  // Auto-reveal + speak each line in sequence. When we've spoken the last
  // line, gate the flow on the next act's input (name → team → welcome).
  useEffect(() => {
    if (!visible) return;
    if (!currentLines.length) return;
    if (linesShown >= currentLines.length) return;
    const idx = linesShown;
    const line = currentLines[idx];
    // Reveal immediately, THEN play Reggie's audio for it. If audio fails or
    // is unavailable, fall back to a fixed timer so the sequence still moves.
    setLinesShown(idx + 1);
    let cancelled = false;
    const fallback = setTimeout(() => {
      if (cancelled) return;
      onLineDone(idx);
    }, Math.max(1400, line.length * 55));
    playReggieLine(line).finally(() => {
      if (cancelled) return;
      clearTimeout(fallback);
      onLineDone(idx);
    });
    return () => { cancelled = true; clearTimeout(fallback); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [act, linesShown, currentLines, visible]);

  function onLineDone(idx) {
    // Small breath between lines
    const isLast = idx + 1 >= currentLines.length;
    if (!isLast) return;
    // Auto-advance from transition → welcome; other transitions gated by input.
    if (act === "transition") {
      setTimeout(() => { setAct("welcome"); setLinesShown(0); }, 500);
    } else if (act === "welcome") {
      setTimeout(finishOnboarding, 900);
    }
  }

  function finishOnboarding() {
    try {
      window.localStorage.setItem(STORAGE.onboarded, "1");
      if (name) window.localStorage.setItem(STORAGE.userName, name);
      if (teamCode) window.localStorage.setItem(STORAGE.homeTeam, teamCode);
    } catch {}
    setVisible(false);
    // Route to Home (Team Room). If they picked a seeded team it fully
    // hydrates; otherwise Team Room shows the "lighting up soon" placeholder.
    navigate("/press-conference");
  }

  // ---- Name capture (voice + text) ----
  const nameSTT = useSpeechRecognition({
    onResult: (text, isFinal) => {
      setVoiceTranscript(text);
      if (isFinal) {
        // Take the first word as the name (people often say "Steve." not "Steve please")
        const first = text.split(/[\s,.!?]+/)[0];
        if (first) setName(first.charAt(0).toUpperCase() + first.slice(1).toLowerCase());
      }
    },
    onEnd: () => {},
  });

  function commitName() {
    if (!name.trim()) return;
    setAct("greet");
    setLinesShown(0);
  }

  // ---- Team capture (voice + tap) ----
  const teamSTT = useSpeechRecognition({
    onResult: (text, isFinal) => {
      setVoiceTranscript(text);
      if (isFinal) {
        const matched = matchTeam(text);
        if (matched) pickTeam(matched);
      }
    },
    onEnd: () => {},
  });

  function pickTeam(code) {
    setTeamCode(code);
    setAct("transition");
    setLinesShown(0);
  }

  // Filter grid by tap-search
  const filteredTeams = useMemo(() => {
    const list = NHL_CODES.filter((c) => logoMap[c]);
    if (!teamQuery.trim()) return list;
    const q = teamQuery.toLowerCase();
    return list.filter((c) => {
      const name = (logoMap[c]?.name || "").toLowerCase();
      return c.toLowerCase().includes(q) || name.includes(q) || TEAM_ALIASES[c].some((a) => a.includes(q));
    });
  }, [logoMap, teamQuery]);

  if (!visible) return null;

  // On the last line of intro, prompt for the name — the "act" doesn't need
  // to change for the input to appear; we just reveal it under the bubble.
  const isIntroDone = act === "intro" && linesShown >= ACTS.intro.length;
  const isGreetDone = act === "greet" && linesShown >= currentLines.length;

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto"
      style={{ background: "radial-gradient(circle at 50% 30%, #16161d 0%, #0a0a0e 70%)" }}
      data-testid="onboarding-overlay"
    >
      {/* Skip (dev/testing) */}
      <button
        onClick={finishOnboarding}
        className="absolute top-4 right-4 z-10 text-white/40 hover:text-white/80 text-xs px-3 py-1.5 rounded-md border border-white/10 hover:border-white/30 transition-colors"
        style={{ fontFamily: "Oswald", fontWeight: 600, letterSpacing: "0.2em" }}
        data-testid="onboarding-skip"
      >
        SKIP
      </button>

      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16 max-w-3xl mx-auto">
        {/* Ticker mark up top */}
        <div className="flex items-center gap-3 mb-10">
          <TMark size={44} variant="light" />
          <div>
            <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "20px", letterSpacing: "0.05em", color: "#fff" }}>THE TICKER</div>
            <div style={{ fontFamily: "Oswald", fontWeight: 600, fontSize: "10px", letterSpacing: "0.35em", color: "#1E5BFF" }}>SPORTS NETWORK</div>
          </div>
        </div>

        {/* Reggie avatar bubble */}
        <div className="flex flex-col items-center w-full">
          <div className="h-20 w-20 rounded-full flex items-center justify-center mb-6"
               style={{ background: "#1E5BFF22", border: "2px solid #1E5BFF66" }}>
            <span style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "28px", color: "#1E5BFF", letterSpacing: "0.05em" }}>RH</span>
          </div>

          {/* Spoken lines revealed in sequence */}
          <div className="w-full space-y-3">
            {currentLines.slice(0, linesShown).map((line, i) => (
              <div key={`${act}-${i}`}
                   className="rounded-2xl border border-white/10 bg-black/50 px-5 py-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-500"
                   style={{ fontFamily: "Rajdhani", fontWeight: 600, fontSize: "22px", lineHeight: 1.35, color: "#fff" }}>
                {line}
              </div>
            ))}
          </div>

          {/* NAME INPUT — appears once intro's last line is up */}
          {isIntroDone && !name && act === "intro" && (
            <div className="mt-6 w-full" data-testid="onboarding-name">
              <NameInput
                stt={nameSTT}
                voiceTranscript={voiceTranscript}
                name={name}
                setName={setName}
                onSubmit={commitName}
              />
            </div>
          )}
          {isIntroDone && name && act === "intro" && (
            <button
              onClick={commitName}
              className="mt-6 px-6 py-3 rounded-md text-black font-bold flex items-center gap-2"
              style={{ background: "#1E5BFF", fontFamily: "Oswald", fontSize: "14px", letterSpacing: "0.2em" }}
              data-testid="onboarding-name-continue"
            >
              CONTINUE AS {name.toUpperCase()} <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {/* TEAM PICKER — appears once greet's last line is up */}
          {isGreetDone && !teamCode && (
            <div className="mt-8 w-full" data-testid="onboarding-team">
              <TeamPicker
                stt={teamSTT}
                voiceTranscript={voiceTranscript}
                query={teamQuery}
                setQuery={setTeamQuery}
                filteredTeams={filteredTeams}
                onPick={pickTeam}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------- NAME INPUT SUB-COMPONENT -------------------- */

function NameInput({ stt, voiceTranscript, name, setName, onSubmit }) {
  const [typed, setTyped] = useState("");
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-4">
      <div className="flex items-center gap-3">
        {stt.supported && (
          <button
            onClick={() => (stt.listening ? stt.stop() : stt.start())}
            className={`h-12 w-12 rounded-full flex items-center justify-center transition-all ${
              stt.listening ? "bg-red-500 animate-pulse" : "bg-[#1E5BFF]"
            }`}
            data-testid="onboarding-name-mic"
            title={stt.listening ? "Listening…" : "Tap to say your name"}
          >
            {stt.listening ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
          </button>
        )}
        <input
          value={typed}
          onChange={(e) => { setTyped(e.target.value); setName(e.target.value.trim()); }}
          onKeyDown={(e) => { if (e.key === "Enter" && typed.trim()) onSubmit(); }}
          placeholder="Type or say your name…"
          autoFocus
          className="flex-1 bg-transparent border-0 outline-none text-white placeholder-white/40"
          style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "24px", letterSpacing: "0.02em" }}
          data-testid="onboarding-name-input"
        />
        <button
          onClick={onSubmit}
          disabled={!typed.trim()}
          className="px-4 py-2.5 rounded-md text-black font-bold disabled:opacity-40 flex items-center gap-1"
          style={{ background: "#1E5BFF", fontFamily: "Oswald", fontSize: "13px", letterSpacing: "0.2em" }}
          data-testid="onboarding-name-submit"
        >
          NEXT <ArrowRight className="w-4 h-4" />
        </button>
      </div>
      {stt.listening && voiceTranscript && (
        <div className="mt-2 text-white/60 text-sm" style={{ fontFamily: "Inter" }}>
          Heard: "<span className="text-white">{voiceTranscript}</span>"
        </div>
      )}
    </div>
  );
}

/* -------------------- TEAM PICKER SUB-COMPONENT -------------------- */

function TeamPicker({ stt, voiceTranscript, query, setQuery, filteredTeams, onPick }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-4">
      <div className="flex items-center gap-3 mb-4">
        {stt.supported && (
          <button
            onClick={() => (stt.listening ? stt.stop() : stt.start())}
            className={`h-12 w-12 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
              stt.listening ? "bg-red-500 animate-pulse" : "bg-[#1E5BFF]"
            }`}
            data-testid="onboarding-team-mic"
            title={stt.listening ? "Listening…" : "Tap to say your team"}
          >
            {stt.listening ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
          </button>
        )}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Say or search — "Chicago Blackhawks"'
          className="flex-1 bg-transparent border-0 outline-none text-white placeholder-white/40"
          style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "18px", letterSpacing: "0.01em" }}
          data-testid="onboarding-team-search"
        />
      </div>
      {stt.listening && voiceTranscript && (
        <div className="mb-3 text-white/60 text-sm" style={{ fontFamily: "Inter" }}>
          Heard: "<span className="text-white">{voiceTranscript}</span>"
        </div>
      )}
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-[280px] overflow-y-auto no-scrollbar">
        {filteredTeams.map((code) => (
          <button
            key={code}
            onClick={() => onPick(code)}
            className="aspect-square rounded-md border border-white/10 hover:border-white/60 bg-black/40 hover:bg-black/70 flex items-center justify-center transition-all"
            title={code}
            data-testid={`onboarding-team-${code}`}
          >
            <TeamLogo code={code} size={40} />
          </button>
        ))}
      </div>
      {filteredTeams.length === 0 && (
        <div className="text-white/40 text-sm text-center py-6" style={{ fontFamily: "Inter" }}>
          No teams match that. Try again.
        </div>
      )}
    </div>
  );
}
