import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { TEST_IDS } from "@/lib/config";
import { Film, PlayCircle, ExternalLink, Video, Zap, Shield, Swords, Users, Sparkles, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";

// Category tab groups → mirror backend TAB_GROUPS. Order defines UI order.
const TABS = [
  { key: "all",      label: "All",         icon: Video,   accent: "#1e5dff" },
  { key: "recaps",   label: "Full Recap",  icon: Film,    accent: "#00e5ff" },
  { key: "goals",    label: "Goals",       icon: Zap,     accent: "#1E5BFF" },
  { key: "saves",    label: "Saves",       icon: Shield,  accent: "#00e5ff" },
  { key: "hits",     label: "Hits & Fights", icon: Swords, accent: "#ff4d6d" },
  { key: "postgame", label: "Post-Game",   icon: Users,   accent: "#c084fc" },
  { key: "viral",    label: "Viral",       icon: Sparkles,accent: "#1E5BFF" },
];

export default function Recaps() {
  const [tab, setTab] = useState("all");
  const [selectedMatch, setSelectedMatch] = useState(null); // null = all games
  const [games, setGames] = useState([]);
  const [logoMap, setLogoMap] = useState({});
  const [highlights, setHighlights] = useState([]);
  const [date, setDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(true);

  // One-shot loads: latest games + all team logos.
  useEffect(() => {
    (async () => {
      try {
        const [g, l] = await Promise.all([
          api.get("/recaps/latest-games"),
          api.get("/images/team-logos"),
        ]);
        setGames(g.data.games || []);
        const map = {};
        (l.data.teams || []).forEach((t) => { if (t.code) map[t.code] = t; });
        setLogoMap(map);
      } catch (e) { console.error("recaps init load", e); }
    })();
  }, []);

  // Reload highlights whenever tab or selected game changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params = { tab, limit: 60 };
        if (selectedMatch) params.match_id = selectedMatch;
        const r = await api.get("/recaps/highlights", { params });
        if (cancelled) return;
        setReady(r.data.ready !== false);
        setHighlights(r.data.highlights || []);
        setDate(r.data.date || null);
      } catch (e) {
        console.error("recaps highlights load", e);
        if (!cancelled) { setHighlights([]); setReady(false); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tab, selectedMatch]);

  const dateNice = useMemo(() => {
    if (!date) return "";
    try {
      const d = new Date(date + "T00:00:00Z");
      return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
    } catch { return date; }
  }, [date]);

  return (
    <div data-testid={TEST_IDS.recaps.pageRoot} className="space-y-8">
      {/* Header */}
      <header>
        <div className="font-accent text-xs uppercase tracking-[0.35em] text-[#1e5dff]">
          <span className="tick-dot live-pulse inline-block mr-2 align-middle" />
          The Morning Line · Every Game Reviewed
        </div>
        <h1 className="font-headline text-4xl sm:text-5xl text-white mt-1">
          By breakfast, the panel already ran the tape.
        </h1>
        <p className="text-white/60 mt-2 text-sm max-w-2xl">
          Verified clips, sourced from official channels. Reggie hooks with the story,
          Marc drops the number, the highlight closes it out. Coach, not casino.
        </p>
        {date && (
          <div className="mt-3 inline-flex items-center gap-2 text-[10px] font-accent uppercase tracking-[0.3em] text-white/50">
            <span className="tick-dot bg-emerald-400" />
            Reviewing: {dateNice}
          </div>
        )}
      </header>

      {/* Game picker with REAL logos */}
      <LogoGamePicker
        games={games}
        logoMap={logoMap}
        selectedMatch={selectedMatch}
        onSelect={setSelectedMatch}
      />

      {/* Category tabs */}
      <nav className="flex gap-2 overflow-x-auto no-scrollbar pb-1" aria-label="Highlight categories">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              data-testid={`recaps-tab-${t.key}`}
              onClick={() => setTab(t.key)}
              className={`flex-shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-full font-accent text-[11px] uppercase tracking-widest transition-all border ${
                active
                  ? "text-white border-transparent"
                  : "border-[#2d2d35] text-white/60 hover:text-white hover:border-white/40"
              }`}
              style={active ? { background: t.accent, boxShadow: `0 0 18px -4px ${t.accent}` } : {}}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* Clip grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => <ClipSkeleton key={i} />)}
        </div>
      ) : !ready ? (
        <UnavailableState />
      ) : highlights.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="recaps-clip-grid">
          {highlights.map((h, i) => (
            <ClipCard key={h.id || i} clip={h} logoMap={logoMap} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Game picker with actual logos ----
function LogoGamePicker({ games, logoMap, selectedMatch, onSelect }) {
  const scrollRef = useRef(null);
  const scroll = (dir) => scrollRef.current?.scrollBy({ left: dir * 260, behavior: "smooth" });
  if (games.length === 0) return null;

  return (
    <div className="relative" data-testid="recaps-picker-strip">
      <button
        type="button"
        onClick={() => scroll(-1)}
        aria-label="Scroll left"
        className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-[#0b0b10]/90 border border-[#2d2d35] items-center justify-center text-white/60 hover:text-white transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div ref={scrollRef} className="flex gap-2 overflow-x-auto no-scrollbar md:px-10 py-2">
        <button
          data-testid="recaps-picker-all"
          onClick={() => onSelect(null)}
          className={`flex-shrink-0 rounded-lg px-4 py-3 min-w-[128px] border transition-all ${
            selectedMatch === null
              ? "bg-[#1e5dff] border-[#1e5dff] text-white shadow-[0_0_18px_-2px_rgba(30,93,255,0.7)]"
              : "bg-[#0b0b10] border-[#2d2d35] text-white/80 hover:border-white/40 hover:text-white"
          }`}
        >
          <div className="flex items-center gap-2 text-[10px] font-accent uppercase tracking-[0.28em]">
            <PlayCircle className="w-3.5 h-3.5" />
            All Games
          </div>
          <div className="text-[11px] mt-1 opacity-70 font-accent uppercase tracking-widest">
            {games.length} matchup{games.length === 1 ? "" : "s"}
          </div>
        </button>

        {games.map((g) => {
          const home = g.home ? logoMap[g.home] : null;
          const away = g.away ? logoMap[g.away] : null;
          const selected = selectedMatch === g.match_id;
          return (
            <button
              key={g.match_id}
              onClick={() => onSelect(g.match_id)}
              data-testid={`recaps-picker-game-${g.match_id}`}
              className={`flex-shrink-0 rounded-lg px-3 py-2.5 min-w-[172px] border transition-all ${
                selected
                  ? "bg-[#101625] border-[#1e5dff] shadow-[0_0_18px_-4px_rgba(30,93,255,0.7)]"
                  : "bg-[#0b0b10] border-[#2d2d35] hover:border-white/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <LogoOrBadge team={away} code={g.away} />
                <span className={`text-[10px] font-accent uppercase tracking-widest ${selected ? "text-white/70" : "text-white/40"}`}>@</span>
                <LogoOrBadge team={home} code={g.home} />
              </div>
              <div className={`text-[9px] font-accent uppercase tracking-[0.25em] mt-1.5 text-center ${selected ? "text-[#1e5dff]" : "text-white/40"}`}>
                {g.away} · {g.home}
              </div>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => scroll(1)}
        aria-label="Scroll right"
        className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-[#0b0b10]/90 border border-[#2d2d35] items-center justify-center text-white/60 hover:text-white transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function LogoOrBadge({ team, code }) {
  if (team?.logo_url) {
    return (
      <img
        src={team.logo_url}
        alt={team.name || code}
        title={team.name || code}
        className="h-9 w-9 object-contain flex-shrink-0"
        loading="lazy"
        onError={(e) => { e.currentTarget.style.display = "none"; }}
      />
    );
  }
  return (
    <div
      className="h-9 w-9 rounded-md flex items-center justify-center font-headline text-[11px] flex-shrink-0"
      style={{ background: "#1e5dff22", border: "1px solid #1e5dff55", color: "#1e5dff" }}
    >
      {code || "?"}
    </div>
  );
}

// ---- Individual clip card ----
function ClipCard({ clip, logoMap }) {
  const away = clip.away_team ? logoMap[clip.away_team] : null;
  const home = clip.home_team ? logoMap[clip.home_team] : null;
  const catMeta = TABS.find((t) => (t.key === clip.category) || (t.key !== "all" && (clip.category === "goal" || clip.category === "power-play-goal" ? t.key === "goals" : false)));

  return (
    <div className="card-surface overflow-hidden group" data-testid={`recaps-clip-${clip.id}`}>
      {/* Embed frame or thumbnail */}
      <div className="relative aspect-video bg-black">
        {clip.embeddable && clip.embed_url ? (
          <iframe
            src={clip.embed_url}
            title={clip.title || "Highlight"}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          />
        ) : (
          <a
            href={clip.source_url || "#"}
            target="_blank"
            rel="noreferrer"
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70 hover:text-white group-hover:bg-white/[0.02] transition-colors"
          >
            <ExternalLink className="w-8 h-8" />
            <span className="font-accent text-[10px] uppercase tracking-widest">Watch on {sourceName(clip.source_url)}</span>
          </a>
        )}
      </div>

      {/* Metadata strip */}
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <CategoryPill category={clip.category} />
          {clip.away_team && clip.home_team && (
            <div className="ml-auto flex items-center gap-1.5 text-[10px] font-accent uppercase tracking-widest text-white/50">
              {away?.logo_url ? <img src={away.logo_url} alt={clip.away_team} className="h-4 w-4 object-contain" /> : <span>{clip.away_team}</span>}
              <span>@</span>
              {home?.logo_url ? <img src={home.logo_url} alt={clip.home_team} className="h-4 w-4 object-contain" /> : <span>{clip.home_team}</span>}
            </div>
          )}
        </div>
        <div className="text-white text-sm leading-snug line-clamp-2 min-h-[2.5rem]">
          {clip.title || "Untitled highlight"}
        </div>
        {clip.channel && (
          <div className="text-[10px] font-accent uppercase tracking-widest text-white/40">
            via {clip.channel}
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryPill({ category }) {
  const CATEGORY_LABELS = {
    "match-highlights": { label: "Full Recap",   color: "#00e5ff" },
    "goal":             { label: "Goal",         color: "#1E5BFF" },
    "power-play-goal":  { label: "PPG",          color: "#1E5BFF" },
    "shorthanded-goal": { label: "SHG",          color: "#1E5BFF" },
    "overtime-shootout-goal": { label: "OT/SO",  color: "#1E5BFF" },
    "hat-trick":        { label: "Hat Trick",    color: "#1E5BFF" },
    "save":             { label: "Save",         color: "#00e5ff" },
    "fight":            { label: "Fight",        color: "#ff4d6d" },
    "hit-check":        { label: "Hit",          color: "#ff4d6d" },
    "assist-play":      { label: "Playmaking",   color: "#1e5dff" },
    "injury":           { label: "Injury",       color: "#ff4d6d" },
    "viral-moment":     { label: "Viral",        color: "#c084fc" },
    "pre-match-content":{ label: "Pregame",      color: "#9ca3af" },
    "post-match-content":{label: "Postgame",     color: "#c084fc" },
    "press-conference": { label: "Presser",      color: "#c084fc" },
    "other":            { label: "Other",        color: "#9ca3af" },
  };
  const meta = CATEGORY_LABELS[category] || { label: category, color: "#9ca3af" };
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full font-accent text-[9px] uppercase tracking-widest"
      style={{ background: meta.color + "22", border: `1px solid ${meta.color}55`, color: meta.color }}
    >
      {meta.label}
    </span>
  );
}

function sourceName(url) {
  if (!url) return "source";
  try {
    const h = new URL(url).hostname.replace("www.", "");
    if (h.includes("youtube") || h.includes("youtu.be")) return "YouTube";
    if (h.includes("twitter") || h.includes("x.com")) return "X";
    if (h.includes("espn")) return "ESPN";
    if (h.includes("reddit")) return "Reddit";
    return h;
  } catch { return "source"; }
}

function ClipSkeleton() {
  return (
    <div className="card-surface overflow-hidden animate-pulse">
      <div className="aspect-video bg-[#0d0d11]" />
      <div className="p-3 space-y-2">
        <div className="h-2 w-1/3 bg-white/10 rounded" />
        <div className="h-3 w-4/5 bg-white/10 rounded" />
        <div className="h-2 w-1/2 bg-white/10 rounded" />
      </div>
    </div>
  );
}

function EmptyState({ tab }) {
  return (
    <div className="card-surface p-8 text-center">
      <Info className="w-6 h-6 text-white/40 mx-auto mb-3" />
      <div className="font-headline text-white text-lg">
        No {tab === "all" ? "clips" : `"${tab}" clips`} on the latest game day.
      </div>
      <div className="text-white/50 text-sm mt-1">
        Try another category tab, or switch to a specific game above.
      </div>
    </div>
  );
}

function UnavailableState() {
  return (
    <div className="rounded-xl border border-dashed border-[#2d2d35] bg-[#0b0b10] p-8 text-center">
      <Film className="w-8 h-8 text-white/30 mx-auto mb-3" />
      <div className="font-headline text-white text-lg">Video service warming up.</div>
      <div className="text-white/50 text-sm mt-1">Refresh in a moment.</div>
    </div>
  );
}
