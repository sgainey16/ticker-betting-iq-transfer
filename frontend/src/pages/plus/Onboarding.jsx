// Onboarding — Ticker+ identity capture flow.
// -----------------------------------------------------------------------------
// Short, fan-first. Prospects are deliberately NOT asked about here — they're
// an internal curation layer that Reggie & Marc lean into when covering the
// junior/college game, not something we ask fans to opt into up front.
//
//   0  Welcome + brand cold-open (Reggie/Marc TTS)
//   1  Nickname (used by Reggie/Marc when addressing user later)
//   2  NHL team (the anchor — every fan has one)
//   3  Local junior teams (WHL / OHL — suggested by NHL affinity)
//   4  NCAA teams (suggested by NHL affinity)
//   5  Interests (analytics / betting IQ / highlights)
//   6  Reveal: personalized "Your Ticker" with Reggie/Marc calling their name
//
// Everything writes to the localStorage-backed UserProfile. When the user hits
// "Complete", `onboarded_at` is stamped and they're routed to `/plus`.

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ArrowLeft, Check, Sparkles, SkipForward, Volume2, Loader2, Trophy, MapPin, GraduationCap, Compass, Globe } from "lucide-react";
import {
  NHL_TEAMS, CHL_DIVISIONS, NCAA_CONFERENCES,
  suggestJuniorTeamsForNhl, suggestNcaaTeamsForNhl,
} from "@/data/tickerCatalog";
import { useUserProfile } from "@/lib/userProfile";
import { api } from "@/lib/api";
import { TeamLogo } from "@/components/plus/TeamLogo";
// Shared NHL logo component — pulls from NHL's official asset CDN. Used for
// the NHL team-picker so onboarding matches what the fan sees on Home.
import { TeamLogo as NhlLogo } from "@/lib/teamLogos";

const STEPS = ["welcome", "nickname", "nhl", "chl", "ncaa", "interests", "reveal"];
const KAM = "#F58220";

// One shared audio unlock — needed for Safari to allow programmatic play() later
function primeAudio(el) {
  try {
    el.muted = true;
    return el.play().then(() => { el.pause(); el.currentTime = 0; el.muted = false; }).catch(() => {});
  } catch { return Promise.resolve(); }
}

// TTS helper — one-shot ElevenLabs line, returns Audio element ready to play.
async function tts(speaker, text, backend) {
  const r = await api.get(`/recap-show/line-audio?speaker=${speaker}&text=${encodeURIComponent(text)}`);
  const url = r.data?.audio_url;
  if (!url) return null;
  const full = url.startsWith("http") ? url : `${backend}${url}`;
  const a = new Audio(full);
  a.preload = "auto";
  return a;
}

export default function Onboarding() {
  const nav = useNavigate();
  const backend = process.env.REACT_APP_BACKEND_URL;
  const { profile, updateProfile, isOnboarded } = useUserProfile();
  const [step, setStep] = useState(0);
  const audioRef = useRef(null);
  const [ttsPlaying, setTtsPlaying] = useState(null); // "reggie" | "marc" | null

  // ---- Local editable copy of profile — commit on Complete ----
  const [draft, setDraft] = useState({
    nickname: profile.nickname || "",
    nhl_team: profile.nhl_team || null,
    language: profile.language || "en",
    chl_teams: profile.chl_teams || [],
    ncaa_teams: profile.ncaa_teams || [],
    prospects: profile.prospects || [],
    interests: profile.interests || [],
  });

  // ---- Play a Reggie/Marc line on demand ----
  const speak = async (speaker, text) => {
    try {
      if (audioRef.current) { try { audioRef.current.pause(); } catch { /* noop */ } }
      const a = await tts(speaker, text, backend);
      if (!a) return;
      await primeAudio(a);
      setTtsPlaying(speaker);
      a.onended = () => setTtsPlaying(null);
      audioRef.current = a;
      a.play().catch(() => setTtsPlaying(null));
    } catch { setTtsPlaying(null); }
  };

  // ---- Cleanup ----
  useEffect(() => () => {
    if (audioRef.current) { try { audioRef.current.pause(); } catch { /* noop */ } }
  }, []);

  const go = (delta) => setStep(s => Math.max(0, Math.min(STEPS.length - 1, s + delta)));
  const canProceed = useMemo(() => {
    switch (STEPS[step]) {
      case "welcome":    return true;
      case "nickname":   return draft.nickname.trim().length > 0;
      case "nhl":        return Boolean(draft.nhl_team);
      case "chl":        return true; // skippable
      case "ncaa":       return true; // skippable
      case "interests":  return true; // skippable
      case "reveal":     return true;
      default:           return true;
    }
  }, [step, draft]);

  const complete = () => {
    updateProfile({
      ...draft,
      nickname: draft.nickname.trim(),
      onboarded_at: new Date().toISOString(),
    });
    nav("/plus/your-ticker");
  };

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white flex flex-col">
      {/* Already-onboarded soft banner — landing here directly (e.g. via the
       * "Rebuild desk" button or manual URL) is fine, but signal clearly
       * that this will overwrite the current desk. Never blocks progress. */}
      {isOnboarded && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/25 px-4 md:px-6 py-2.5 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-accent text-[10px] uppercase tracking-[0.28em] text-emerald-400">Already set up</span>
          </div>
          <span className="font-accent text-[10px] uppercase tracking-[0.22em] text-white/70">
            {profile.nickname ? `Welcome back, ${profile.nickname}.` : "You've already built your desk."} Continuing here will overwrite it.
          </span>
          <button
            data-testid="ob-goto-yourticker"
            onClick={() => nav("/plus/your-ticker")}
            className="ml-auto rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 font-accent text-[9px] uppercase tracking-[0.28em] text-emerald-400 hover:bg-emerald-500/20 transition-colors"
          >
            Skip to Your Ticker →
          </button>
        </div>
      )}

      {/* Top progress rail */}
      <div className="border-b border-white/10 bg-black/60 backdrop-blur px-4 md:px-6 py-3 flex items-center gap-3">
        <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-[#F58220]">The Ticker</div>
        <div className="font-accent text-[10px] uppercase tracking-[0.28em] text-white/40">· Building your desk</div>
        <div className="ml-auto flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all ${i === step ? "w-8 bg-[#F58220]" : i < step ? "w-3 bg-white/70" : "w-3 bg-white/15"}`}
            />
          ))}
        </div>
      </div>

      {/* Speaking indicator */}
      {ttsPlaying && (
        <div className="fixed top-16 right-4 z-40 flex items-center gap-2 rounded-full bg-black/85 backdrop-blur px-3 py-1.5 border border-white/15 shadow-lg">
          <Volume2 className="w-3.5 h-3.5 text-[#F58220]" />
          <span className="font-accent text-[9px] uppercase tracking-[0.28em] text-white/80">
            On air · {ttsPlaying}
          </span>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center px-4 md:px-6 py-6 md:py-10">
        <div className="w-full max-w-2xl">
          {/* Step-by-step content */}
          {STEPS[step] === "welcome" && (
            <StepWelcome onSpeak={speak} onNext={() => go(1)} />
          )}
          {STEPS[step] === "nickname" && (
            <StepNickname value={draft.nickname} onChange={(v) => setDraft(d => ({ ...d, nickname: v }))} onSpeak={speak} />
          )}
          {STEPS[step] === "nhl" && (
            <StepNhl selected={draft.nhl_team} onSelect={(code) => {
              setDraft(d => ({ ...d, nhl_team: code }));
              const t = NHL_TEAMS.find(x => x.code === code);
              if (t) speak("reggie", `${draft.nickname || "Alright"}. ${t.name} it is.`);
            }} />
          )}
          {STEPS[step] === "chl" && (
            <StepChl draft={draft} onToggle={(code) => {
              setDraft(d => ({
                ...d,
                chl_teams: d.chl_teams.includes(code) ? d.chl_teams.filter(x => x !== code) : [...d.chl_teams, code],
              }));
            }} />
          )}
          {STEPS[step] === "ncaa" && (
            <StepNcaa draft={draft} onToggle={(code) => {
              setDraft(d => ({
                ...d,
                ncaa_teams: d.ncaa_teams.includes(code) ? d.ncaa_teams.filter(x => x !== code) : [...d.ncaa_teams, code],
              }));
            }} />
          )}
          {STEPS[step] === "interests" && (
            <StepInterests draft={draft} onToggle={(id) => {
              setDraft(d => ({
                ...d,
                interests: d.interests.includes(id) ? d.interests.filter(x => x !== id) : [...d.interests, id],
              }));
            }} />
          )}
          {STEPS[step] === "reveal" && (
            <StepReveal draft={draft} onSpeak={speak} onComplete={complete} />
          )}
        </div>
      </div>

      {/* Nav footer */}
      <div className="border-t border-white/10 bg-black/60 backdrop-blur px-4 md:px-6 py-4 flex items-center justify-between">
        <button
          data-testid="ob-back"
          onClick={() => go(-1)}
          disabled={step === 0}
          className={`inline-flex items-center gap-2 font-accent text-[10px] uppercase tracking-[0.3em] transition-all ${step === 0 ? "text-white/25 cursor-not-allowed" : "text-white/70 hover:text-white"}`}
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>

        {/* Skip on optional steps */}
        {["chl", "ncaa", "interests"].includes(STEPS[step]) && (
          <button
            data-testid="ob-skip"
            onClick={() => go(1)}
            className="inline-flex items-center gap-1.5 font-accent text-[10px] uppercase tracking-[0.28em] text-white/40 hover:text-white/80 transition-colors"
          >
            <SkipForward className="w-3 h-3" /> Skip
          </button>
        )}

        {STEPS[step] !== "reveal" ? (
          <button
            data-testid="ob-next"
            onClick={() => go(1)}
            disabled={!canProceed}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2 font-accent text-[10px] uppercase tracking-[0.3em] transition-all ${canProceed ? "bg-[#F58220] text-black hover:bg-[#ff9042] shadow-[0_6px_24px_-6px_rgba(245,130,32,0.6)]" : "bg-white/10 text-white/30 cursor-not-allowed"}`}
          >
            Next <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            data-testid="ob-complete"
            onClick={complete}
            className="inline-flex items-center gap-2 rounded-full bg-[#F58220] text-black px-6 py-2.5 font-accent text-[10px] uppercase tracking-[0.3em] hover:bg-[#ff9042] transition-colors shadow-[0_6px_24px_-6px_rgba(245,130,32,0.6)]"
          >
            <Check className="w-3.5 h-3.5" /> Enter The Ticker
          </button>
        )}
      </div>
    </div>
  );
}

// ---- Step Components ----

function StepWelcome({ onSpeak, onNext }) {
  const [primed, setPrimed] = useState(false);
  useEffect(() => {
    if (primed) return;
    // Prime audio on first paint — but only after user gesture. We use the
    // "Let's build it" button as the primer.
  }, [primed]);
  return (
    <div className="text-center py-10">
      <div className="font-accent text-[10px] uppercase tracking-[0.35em] text-[#F58220]">The Ticker</div>
      <div className="font-headline text-white text-4xl md:text-5xl leading-[1.05] mt-3">
        Let's build your desk.
      </div>
      <div className="font-accent text-sm uppercase tracking-[0.24em] text-white/55 mt-5 max-w-md mx-auto">
        Five quick taps. Reggie and Marc will know your team, your leagues, and your name by the end.
      </div>
      <button
        data-testid="ob-welcome-start"
        onClick={async () => {
          setPrimed(true);
          onSpeak("reggie", "Welcome to The Ticker. Let's build your desk. Tell us who you are.");
          setTimeout(onNext, 400);
        }}
        className="mt-10 inline-flex items-center gap-2 rounded-full bg-[#F58220] text-black px-7 py-3 font-accent text-[10px] uppercase tracking-[0.32em] hover:bg-[#ff9042] transition-colors shadow-[0_10px_30px_-6px_rgba(245,130,32,0.6)]"
      >
        <Sparkles className="w-3.5 h-3.5" /> Let's build it
      </button>
      <div className="mt-4 font-accent text-[9px] uppercase tracking-[0.28em] text-white/40">
        Tap starts the audio — Reggie's in your ear
      </div>
    </div>
  );
}

function StepNickname({ value, onChange, onSpeak }) {
  return (
    <div className="py-8">
      <StepHeader eyebrow="Step 01" title="What should Reggie and Marc call you?" subtitle="This is how the hosts will address you on air. First name, nickname, handle — whatever feels like you." />
      <div className="mt-8 max-w-md mx-auto">
        <input
          data-testid="ob-nickname-input"
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => value.trim() && onSpeak("reggie", `${value.trim()}. Nice to have you at the desk.`)}
          placeholder="Nickname"
          maxLength={24}
          className="w-full bg-black/40 border border-white/15 rounded-lg px-4 py-4 font-headline text-2xl text-white placeholder:text-white/25 focus:outline-none focus:border-[#F58220] transition-colors"
        />
        <div className="mt-3 font-accent text-[9px] uppercase tracking-[0.28em] text-white/40 text-center">
          Doesn't have to be your real name — it's the name Reggie says
        </div>
      </div>
    </div>
  );
}

function StepNhl({ selected, onSelect }) {
  return (
    <div className="py-8">
      <StepHeader eyebrow="Step 02" title="Your NHL team." subtitle="The one whose loss actually ruins your Sunday. Pick one." icon={Trophy} />
      <div className="mt-8 grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-w-2xl mx-auto">
        {NHL_TEAMS.map(t => (
          <button
            key={t.code}
            data-testid={`ob-nhl-${t.code}`}
            onClick={() => onSelect(t.code)}
            className={`group relative rounded-lg border-2 transition-all p-3 min-h-[86px] flex flex-col items-center justify-center text-center ${selected === t.code ? "border-[#F58220] bg-[#F58220]/10 scale-[1.02]" : "border-white/10 bg-black/40 hover:border-white/25"}`}
          >
            <div className="w-11 h-11 rounded-full mb-2 flex items-center justify-center overflow-hidden"
                 style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${t.primary || "#F58220"}55` }}>
              <NhlLogo code={t.code} size={34} monogramClass="!bg-transparent" />
            </div>
            <div className="font-accent text-[9px] uppercase tracking-[0.22em] text-white/70 leading-tight">
              {t.name.split(" ").pop()}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepChl({ draft, onToggle }) {
  // Group by league — Western, Ontario, Quebec — so fans navigate by the
  // three CHL leagues they actually know (W / O / Q) instead of one long
  // flat list. If a fan's NHL team has a natural affinity to a junior team
  // we surface those first inside each league.
  const byLeague = useMemo(() => {
    const groups = { WHL: [], OHL: [], QMJHL: [] };
    CHL_DIVISIONS.forEach(div => {
      const teams = div.teams.map(t => ({ ...t, league: div.league, division: div.name }));
      if (groups[div.league]) groups[div.league].push(...teams);
    });
    return groups;
  }, []);
  const affinityCodes = useMemo(() => new Set(
    (draft.nhl_team ? suggestJuniorTeamsForNhl(draft.nhl_team) : []).map(t => t.code)
  ), [draft.nhl_team]);

  const [activeLeague, setActiveLeague] = useState("WHL");
  const leagues = [
    { code: "WHL",   label: "WHL",   sub: "Western"  },
    { code: "OHL",   label: "OHL",   sub: "Ontario"  },
    { code: "QMJHL", label: "QMJHL", sub: "Quebec"   },
  ];
  const activeTeams = byLeague[activeLeague] || [];
  const affinity = activeTeams.filter(t => affinityCodes.has(t.code));
  const rest = activeTeams.filter(t => !affinityCodes.has(t.code));

  return (
    <div className="py-6">
      <StepHeader eyebrow="Step 03" title="Any junior teams you follow?" subtitle="The three CHL leagues — Western, Ontario, Quebec. Pick as many as you want. Fans who follow junior see their NHL team's future two years earlier." icon={MapPin} />

      {/* League tab strip — W / O / Q */}
      <div className="mt-6 flex justify-center gap-2 max-w-2xl mx-auto" role="tablist">
        {leagues.map(l => (
          <button
            key={l.code}
            role="tab"
            aria-selected={activeLeague === l.code}
            data-testid={`ob-chl-league-${l.code}`}
            onClick={() => setActiveLeague(l.code)}
            className={`px-4 py-2 rounded-lg border transition-all ${
              activeLeague === l.code
                ? "border-[#F58220] bg-[#F58220]/10 text-white"
                : "border-white/10 bg-black/40 text-white/60 hover:border-white/30"
            }`}
          >
            <div className="font-headline text-lg leading-none" style={{ fontFamily: "Rajdhani", fontWeight: 700 }}>{l.label}</div>
            <div className="font-accent text-[9px] uppercase tracking-[0.24em] text-white/50 mt-0.5">{l.sub}</div>
          </button>
        ))}
      </div>

      {affinity.length > 0 && (
        <>
          <div className="mt-6 font-accent text-[10px] uppercase tracking-[0.28em] text-[#F58220] max-w-2xl mx-auto">
            Feeds {draft.nhl_team}
          </div>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-w-2xl mx-auto">
            {affinity.map(t => <ChlTile key={t.code} t={t} selected={draft.chl_teams.includes(t.code)} onClick={() => onToggle(t.code)} />)}
          </div>
        </>
      )}

      <div className="mt-6 font-accent text-[10px] uppercase tracking-[0.28em] text-white/40 max-w-2xl mx-auto">
        {affinity.length > 0 ? `Everyone else in the ${activeLeague}` : `${activeLeague} teams`}
      </div>
      {rest.length === 0 ? (
        <div className="mt-2 max-w-2xl mx-auto rounded-md border border-dashed border-white/10 bg-white/[0.02] p-4 text-center text-white/40 text-xs">
          No teams seeded for the {activeLeague} yet. Full league lands with the Elite Prospects roster sync.
        </div>
      ) : (
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-w-2xl mx-auto">
          {rest.map(t => <ChlTile key={t.code} t={t} selected={draft.chl_teams.includes(t.code)} onClick={() => onToggle(t.code)} />)}
        </div>
      )}
    </div>
  );
}

function ChlTile({ t, selected, onClick }) {
  return (
    <button
      data-testid={`ob-chl-${t.code}`}
      onClick={onClick}
      className={`text-left rounded-lg border-2 transition-all p-3 ${selected ? "border-[#F58220] bg-[#F58220]/10 scale-[1.02]" : "border-white/10 bg-black/40 hover:border-white/25"}`}
    >
      <div className="flex items-center gap-2.5">
        <TeamLogo team={t} size={28} />
        <div className="min-w-0">
          <div className="font-headline text-white text-sm leading-tight truncate">{t.name}</div>
          <div className="font-accent text-[9px] uppercase tracking-[0.22em] text-white/50 truncate">
            {t.league} · {t.city}
          </div>
        </div>
      </div>
    </button>
  );
}

function StepNcaa({ draft, onToggle }) {
  // Group by conference — same tabbed pattern as CHL. Users navigate by
  // conference (Big Ten, Hockey East, NCHC, ECAC, CCHA, Atlantic) instead
  // of one long list.
  const conferences = NCAA_CONFERENCES.map(c => ({ code: c.code, name: c.name }));
  const [activeConf, setActiveConf] = useState(conferences[0]?.code || "B1G");
  const activeTeams = useMemo(() => {
    const c = NCAA_CONFERENCES.find(x => x.code === activeConf);
    return (c?.teams || []).map(t => ({ ...t, conference: c?.name }));
  }, [activeConf]);
  const affinityCodes = useMemo(() => new Set(
    (draft.nhl_team ? suggestNcaaTeamsForNhl(draft.nhl_team) : []).map(t => t.code)
  ), [draft.nhl_team]);
  const affinity = activeTeams.filter(t => affinityCodes.has(t.code));
  const rest = activeTeams.filter(t => !affinityCodes.has(t.code));

  return (
    <div className="py-6">
      <StepHeader eyebrow="Step 04" title="Any college programs you follow?" subtitle="30%+ of American NHL players come through the NCAA. Pick by conference — your NHL team's kids are probably on one of these rosters." icon={GraduationCap} />

      {/* Conference tabs — scrollable on narrow screens */}
      <div className="mt-6 max-w-3xl mx-auto overflow-x-auto no-scrollbar">
        <div className="flex gap-2 pb-1 min-w-max px-1" role="tablist">
          {conferences.map(c => (
            <button
              key={c.code}
              role="tab"
              aria-selected={activeConf === c.code}
              data-testid={`ob-ncaa-conf-${c.code}`}
              onClick={() => setActiveConf(c.code)}
              className={`px-3 py-2 rounded-lg border transition-all whitespace-nowrap ${
                activeConf === c.code
                  ? "border-[#F58220] bg-[#F58220]/10 text-white"
                  : "border-white/10 bg-black/40 text-white/60 hover:border-white/30"
              }`}
            >
              <div className="font-headline text-sm leading-none" style={{ fontFamily: "Rajdhani", fontWeight: 700 }}>{c.code}</div>
              <div className="font-accent text-[8px] uppercase tracking-[0.22em] text-white/50 mt-0.5">{c.name}</div>
            </button>
          ))}
        </div>
      </div>

      {affinity.length > 0 && (
        <>
          <div className="mt-6 font-accent text-[10px] uppercase tracking-[0.28em] text-[#F58220] max-w-2xl mx-auto">
            Feeds {draft.nhl_team}
          </div>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-w-2xl mx-auto">
            {affinity.map(t => <NcaaTile key={t.code} t={t} selected={draft.ncaa_teams.includes(t.code)} onClick={() => onToggle(t.code)} />)}
          </div>
        </>
      )}

      <div className="mt-6 font-accent text-[10px] uppercase tracking-[0.28em] text-white/40 max-w-2xl mx-auto">
        {affinity.length > 0 ? `Everyone else in the ${activeConf}` : `${activeConf} teams`}
      </div>
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-w-2xl mx-auto">
        {rest.map(t => <NcaaTile key={t.code} t={t} selected={draft.ncaa_teams.includes(t.code)} onClick={() => onToggle(t.code)} />)}
      </div>
    </div>
  );
}

function NcaaTile({ t, selected, onClick }) {
  return (
    <button
      data-testid={`ob-ncaa-${t.code}`}
      onClick={onClick}
      className={`text-left rounded-lg border-2 transition-all p-3 ${selected ? "border-[#F58220] bg-[#F58220]/10 scale-[1.02]" : "border-white/10 bg-black/40 hover:border-white/25"}`}
    >
      <div className="flex items-center gap-2.5">
        <TeamLogo team={t} size={28} />
        <div className="min-w-0">
          <div className="font-headline text-white text-sm leading-tight truncate">{t.name}</div>
          <div className="font-accent text-[9px] uppercase tracking-[0.22em] text-white/50 truncate">
            NCAA · {t.city}
          </div>
        </div>
      </div>
    </button>
  );
}

const INTEREST_OPTIONS = [
  { id: "highlights",  label: "Highlight reels",         detail: "Goals, big saves, moments" },
  { id: "analytics",   label: "Analytics + tape",        detail: "Game Control Score, xG, coverage" },
  { id: "betting_iq",  label: "Coach's Betting IQ",      detail: "Coach, not casino — hard truth on lines" },
  { id: "recaps",      label: "Long-form recaps",        detail: "Full-game desk shows, not clips" },
  { id: "roster_news", label: "Roster + injuries",       detail: "Callups, trades, lineup shifts" },
];

function StepInterests({ draft, onToggle }) {
  return (
    <div className="py-6">
      <StepHeader eyebrow="Step 05" title="What do you actually want to see?" subtitle="Pick anything that sounds like you. The desk builds around your answers." icon={Compass} />
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-2xl mx-auto">
        {INTEREST_OPTIONS.map(o => {
          const selected = draft.interests.includes(o.id);
          return (
            <button
              key={o.id}
              data-testid={`ob-interest-${o.id}`}
              onClick={() => onToggle(o.id)}
              className={`text-left rounded-lg border-2 transition-all p-3.5 ${selected ? "border-[#F58220] bg-[#F58220]/10" : "border-white/10 bg-black/40 hover:border-white/25"}`}
            >
              <div className="font-headline text-white text-base leading-tight">{o.label}</div>
              <div className="font-accent text-[10px] uppercase tracking-[0.22em] text-white/50 mt-1">{o.detail}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepReveal({ draft, onSpeak, onComplete }) {
  const [ttsFired, setTtsFired] = useState(false);
  useEffect(() => {
    if (ttsFired) return;
    const t = setTimeout(() => {
      const name = draft.nickname?.trim() || "friend";
      const nhl  = NHL_TEAMS.find(x => x.code === draft.nhl_team);
      const junior = draft.chl_teams.length > 0 ? draft.chl_teams[0] : null;
      const line = junior && nhl
        ? `${name}. ${nhl.name} for the pros, ${junior} on the junior side. Your Ticker is loaded.`
        : nhl
          ? `${name}. ${nhl.name} fan. Let's get you set up.`
          : `${name}. Welcome to the desk.`;
      onSpeak("reggie", line);
      setTtsFired(true);
    }, 500);
    return () => clearTimeout(t);
  }, [draft, onSpeak, ttsFired]);

  const nhl = NHL_TEAMS.find(x => x.code === draft.nhl_team);
  const chlCount = draft.chl_teams.length;
  const ncaaCount = draft.ncaa_teams.length;

  return (
    <div className="py-10 text-center">
      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 mb-6">
        <Sparkles className="w-3 h-3 text-emerald-400" />
        <span className="font-accent text-[9px] uppercase tracking-[0.32em] text-emerald-400">Desk built</span>
      </div>
      <div className="font-headline text-white text-4xl md:text-5xl leading-[1.05]">
        Welcome, <span className="text-[#F58220]">{draft.nickname?.trim() || "friend"}</span>.
      </div>
      <div className="font-accent text-sm uppercase tracking-[0.24em] text-white/55 mt-4">
        Reggie and Marc are on the mic. Your desk is loaded.
      </div>

      <div className="mt-10 grid grid-cols-3 gap-3 max-w-xl mx-auto">
        <RevealStat label="NHL" value={nhl?.code || "—"} accent={nhl?.primary} />
        <RevealStat label="Junior" value={chlCount || "—"} accent="#F58220" />
        <RevealStat label="College" value={ncaaCount || "—"} accent="#F58220" />
      </div>

      <div className="mt-8 font-accent text-[10px] uppercase tracking-[0.28em] text-white/45">
        Tap "Enter The Ticker" to see your personalized desk.
      </div>
    </div>
  );
}

function RevealStat({ label, value, accent = "#F58220" }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/40 p-4">
      <div className="font-accent text-[9px] uppercase tracking-[0.28em] text-white/45">{label}</div>
      <div className="font-headline text-3xl mt-1" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function StepHeader({ eyebrow, title, subtitle, icon: Icon }) {
  return (
    <div className="text-center max-w-2xl mx-auto">
      <div className="flex items-center justify-center gap-2 mb-2">
        {Icon && <Icon className="w-3.5 h-3.5 text-[#F58220]" />}
        <span className="font-accent text-[10px] uppercase tracking-[0.32em] text-[#F58220]">{eyebrow}</span>
      </div>
      <div className="font-headline text-white text-3xl md:text-4xl leading-tight">{title}</div>
      <div className="font-accent text-sm uppercase tracking-[0.22em] text-white/55 mt-3">{subtitle}</div>
    </div>
  );
}
