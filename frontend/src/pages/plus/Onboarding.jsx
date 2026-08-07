// Onboarding — Ticker+ identity capture flow.
// -----------------------------------------------------------------------------
// Six lightweight steps. Nothing gate-keeps except NHL team. Every other step
// is skippable — skipped steps get gentle re-nags later inside the app.
//
//   0  Welcome + brand cold-open (Reggie/Marc TTS)
//   1  Nickname (used by Reggie/Marc when addressing user later)
//   2  NHL team (the anchor — every fan has one)
//   3  Local junior teams (WHL / OHL — suggested by NHL affinity)
//   4  NCAA teams (suggested by NHL affinity)
//   5  Prospects to follow (suggested by teams already picked)
//   6  Interests (analytics / betting IQ / prospects / highlights)
//   7  Reveal: personalized "Your Ticker" with Reggie/Marc calling their name
//
// Everything writes to the localStorage-backed UserProfile. When the user hits
// "Complete", `onboarded_at` is stamped and they're routed to `/plus`.

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ArrowLeft, Check, Sparkles, SkipForward, Volume2, Loader2, Trophy, MapPin, GraduationCap, Star, Compass } from "lucide-react";
import {
  NHL_TEAMS, CHL_DIVISIONS, NCAA_CONFERENCES, PROSPECTS,
  suggestJuniorTeamsForNhl, suggestNcaaTeamsForNhl, suggestProspectsForProfile,
} from "@/data/tickerCatalog";
import { useUserProfile } from "@/lib/userProfile";
import { api } from "@/lib/api";
import { TeamLogo } from "@/components/plus/TeamLogo";

const STEPS = ["welcome", "nickname", "nhl", "chl", "ncaa", "prospects", "interests", "reveal"];
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
  const { profile, updateProfile } = useUserProfile();
  const [step, setStep] = useState(0);
  const audioRef = useRef(null);
  const [ttsPlaying, setTtsPlaying] = useState(null); // "reggie" | "marc" | null

  // ---- Local editable copy of profile — commit on Complete ----
  const [draft, setDraft] = useState({
    nickname: profile.nickname || "",
    nhl_team: profile.nhl_team || null,
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
      case "prospects":  return true; // skippable
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
          {STEPS[step] === "prospects" && (
            <StepProspects draft={draft} onToggle={(id) => {
              setDraft(d => ({
                ...d,
                prospects: d.prospects.includes(id) ? d.prospects.filter(x => x !== id) : [...d.prospects, id],
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
        {["chl", "ncaa", "prospects", "interests"].includes(STEPS[step]) && (
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
        Six quick taps. Reggie and Marc will know your team, your prospects, and your name by the end.
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
            className={`group relative rounded-lg border-2 transition-all p-3 min-h-[72px] flex flex-col items-center justify-center text-center ${selected === t.code ? "border-[#F58220] bg-[#F58220]/10 scale-[1.02]" : "border-white/10 bg-black/40 hover:border-white/25"}`}
          >
            <div className="w-8 h-8 rounded-full mb-1.5 flex items-center justify-center font-headline text-xs text-white shadow-lg" style={{ background: t.primary }}>
              {t.code}
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
  const suggested = draft.nhl_team ? suggestJuniorTeamsForNhl(draft.nhl_team) : [];
  const suggestedCodes = new Set(suggested.map(t => t.code));
  const allChl = CHL_DIVISIONS.flatMap(d => d.teams.map(t => ({ ...t, league: d.league, division: d.name })));
  const other = allChl.filter(t => !suggestedCodes.has(t.code));

  return (
    <div className="py-6">
      <StepHeader eyebrow="Step 03" title="Local junior team?" subtitle="WHL, OHL, QMJHL. Your town's team. This is where the hyper-local desk lives." icon={MapPin} />
      {suggested.length > 0 && (
        <>
          <div className="mt-6 font-accent text-[10px] uppercase tracking-[0.28em] text-[#F58220] max-w-2xl mx-auto">
            Near your NHL orbit
          </div>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-w-2xl mx-auto">
            {suggested.map(t => <ChlTile key={t.code} t={t} selected={draft.chl_teams.includes(t.code)} onClick={() => onToggle(t.code)} />)}
          </div>
        </>
      )}
      <div className="mt-6 font-accent text-[10px] uppercase tracking-[0.28em] text-white/40 max-w-2xl mx-auto">
        Everyone else
      </div>
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-w-2xl mx-auto">
        {other.map(t => <ChlTile key={t.code} t={t} selected={draft.chl_teams.includes(t.code)} onClick={() => onToggle(t.code)} />)}
      </div>
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
  const suggested = draft.nhl_team ? suggestNcaaTeamsForNhl(draft.nhl_team) : [];
  const suggestedCodes = new Set(suggested.map(t => t.code));
  const allNcaa = NCAA_CONFERENCES.flatMap(c => c.teams.map(t => ({ ...t, conference: c.name })));
  const other = allNcaa.filter(t => !suggestedCodes.has(t.code));

  return (
    <div className="py-6">
      <StepHeader eyebrow="Step 04" title="College hockey?" subtitle="Alma mater, hometown school, or just the program that gave you a prospect to root for." icon={GraduationCap} />
      {suggested.length > 0 && (
        <>
          <div className="mt-6 font-accent text-[10px] uppercase tracking-[0.28em] text-[#F58220] max-w-2xl mx-auto">
            Feeds your NHL team
          </div>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-w-2xl mx-auto">
            {suggested.map(t => <NcaaTile key={t.code} t={t} selected={draft.ncaa_teams.includes(t.code)} onClick={() => onToggle(t.code)} />)}
          </div>
        </>
      )}
      <div className="mt-6 font-accent text-[10px] uppercase tracking-[0.28em] text-white/40 max-w-2xl mx-auto">
        Full board
      </div>
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-w-2xl mx-auto">
        {other.map(t => <NcaaTile key={t.code} t={t} selected={draft.ncaa_teams.includes(t.code)} onClick={() => onToggle(t.code)} />)}
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

function StepProspects({ draft, onToggle }) {
  const ranked = suggestProspectsForProfile(draft).slice(0, 10);
  return (
    <div className="py-6">
      <StepHeader eyebrow="Step 05" title="Prospects to follow." subtitle="The kids you want Reggie and Marc to keep an eye on. Pick as many as you like." icon={Star} />
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-2xl mx-auto">
        {ranked.map(p => {
          const selected = draft.prospects.includes(p.id);
          return (
            <button
              key={p.id}
              data-testid={`ob-prospect-${p.id}`}
              onClick={() => onToggle(p.id)}
              className={`text-left rounded-lg border-2 transition-all p-3.5 ${selected ? "border-[#F58220] bg-[#F58220]/10" : "border-white/10 bg-black/40 hover:border-white/25"}`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="font-headline text-white text-base leading-tight">{p.first} {p.last}</div>
                <span className="font-accent text-[9px] uppercase tracking-[0.22em] text-white/45 whitespace-nowrap">
                  {p.pos} · {p.age}
                </span>
              </div>
              <div className="font-accent text-[10px] uppercase tracking-[0.22em] text-white/50 mb-1.5">
                {p.juniorTeam ? `WHL · ${p.juniorTeam}` : `NCAA · ${p.ncaaTeam}`} · {p.draftYear} · #{p.draftRank}
              </div>
              <div className="text-white/75 text-[13px] leading-snug">{p.tagline}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const INTEREST_OPTIONS = [
  { id: "highlights",  label: "Highlight reels",         detail: "Goals, big saves, moments" },
  { id: "prospects",   label: "Prospect development",    detail: "Draft-eligible kids on the rise" },
  { id: "analytics",   label: "Analytics + tape",        detail: "Game Control Score, xG, coverage" },
  { id: "betting_iq",  label: "Coach's Betting IQ",      detail: "Coach, not casino — hard truth on lines" },
  { id: "recaps",      label: "Long-form recaps",        detail: "Full-game desk shows, not clips" },
  { id: "roster_news", label: "Roster + injuries",       detail: "Callups, trades, lineup shifts" },
];

function StepInterests({ draft, onToggle }) {
  return (
    <div className="py-6">
      <StepHeader eyebrow="Step 06" title="What do you actually want to see?" subtitle="Pick anything that sounds like you. The desk builds around your answers." icon={Compass} />
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
  const prospectCount = draft.prospects.length;

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

      <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
        <RevealStat label="NHL" value={nhl?.code || "—"} accent={nhl?.primary} />
        <RevealStat label="Junior" value={chlCount || "—"} accent="#F58220" />
        <RevealStat label="College" value={ncaaCount || "—"} accent="#F58220" />
        <RevealStat label="Prospects" value={prospectCount || "—"} accent="#F58220" />
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
