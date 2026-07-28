import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { TEST_IDS } from "@/lib/config";
import GamePickerStrip from "@/components/GamePickerStrip";
import { Film, Zap, Shield, Swords, Trophy, PlayCircle, Info } from "lucide-react";

// Recaps page — same broadcast-flavored show format as Predictions, but
// oriented around GAME HIGHLIGHTS instead of prediction voting.
//
// PHASE 1 STATE (today): audio-only preview lit up — voice from Reggie/Marc
// wrapped around the *idea* of highlights. Video panel shows a "lighting up
// soon" placeholder until Sportradar Sales unlocks LCP / Match Pulse video.
//
// LAYOUT
// - Top: game-picker strip (Play All ▶  + AWAY @ HOME tiles)
// - Middle: main "now playing" recap panel (selected game or continuous show)
// - Bottom: SHORTS row — Top 10 Goals · Saves · Hits · Fights (placeholder
//   destinations pointing at /soon/top10-* while we source video)

const SHORTS = [
  { id: "goals",  title: "Top 10 Goals",  icon: Zap,    accent: "#1e5dff", blurb: "Snipes, snapshots, and mistakes on ice." },
  { id: "saves",  title: "Top 10 Saves",  icon: Shield, accent: "#00e5ff", blurb: "Robberies you have to watch twice." },
  { id: "hits",   title: "Top 10 Hits",   icon: Swords, accent: "#F5A623", blurb: "Clean, brutal, and audible from the cheap seats." },
  { id: "fights", title: "Top 10 Fights", icon: Trophy, accent: "#ff4d6d", blurb: "Old-time hockey. Enter at your own risk." },
];

export default function Recaps() {
  const [games, setGames] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selected, setSelected] = useState(null); // null = Play All

  useEffect(() => {
    (async () => {
      try {
        const [g, t] = await Promise.all([
          api.get("/predictions/games"),
          api.get("/stats/teams"),
        ]);
        setGames(g.data.games || []);
        setTeams(t.data.teams || []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const selectedGame = selected ? games.find((g) => g.id === selected) : null;
  const teamMeta = (code) => teams.find((t) => t.code === code) || { name: code, accent: "#1e5dff" };

  return (
    <div data-testid={TEST_IDS.recaps.pageRoot} className="space-y-8">
      {/* Header */}
      <header>
        <div className="font-accent text-xs uppercase tracking-[0.35em] text-[#1e5dff]">
          <span className="tick-dot live-pulse inline-block mr-2 align-middle" />
          Recaps · The Sports Desk
        </div>
        <h1 className="font-headline text-4xl sm:text-5xl text-white mt-1">
          Every game. Every story.
        </h1>
        <p className="text-white/60 mt-2 text-sm max-w-2xl">
          Pick a matchup or hit <em className="not-italic text-white">Play All</em> and let the desk carry you through
          the night. Reggie hooks with a story, Marc drops the number, the highlight closes it out. Next.
        </p>
      </header>

      {/* Game picker strip */}
      <GamePickerStrip
        games={games}
        teams={teams}
        selectedGameId={selected}
        onSelect={setSelected}
        playAllLabel="Play All"
        testids={{
          root: TEST_IDS.recaps.picker,
          all: TEST_IDS.recaps.pickerAll,
          game: TEST_IDS.recaps.pickerGame,
        }}
      />

      {/* Now-playing panel */}
      <div className="card-surface p-6" data-testid="recaps-now-playing">
        {selectedGame ? (
          <NowPlayingGame game={selectedGame} teamMeta={teamMeta} />
        ) : (
          <NowPlayingContinuous count={games.length} />
        )}
      </div>

      {/* Shorts row */}
      <section>
        <div className="flex items-center gap-3 mb-3">
          <div className="font-accent text-[11px] uppercase tracking-[0.35em] text-white/60">
            Shorts · when you only have two minutes
          </div>
          <div className="flex-1 h-px bg-[#2d2d35]" />
          <div className="text-[10px] font-accent uppercase tracking-widest text-white/40">
            Fresh cuts weekly
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {SHORTS.map((s) => {
            const Icon = s.icon;
            return (
              <a
                key={s.id}
                href={`/soon/top10-${s.id}`}
                data-testid={TEST_IDS.recaps.shortsTile(s.id)}
                className="card-surface p-4 hover:border-white/40 transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div
                    className="h-8 w-8 rounded-md flex items-center justify-center"
                    style={{ background: `${s.accent}22`, border: `1px solid ${s.accent}55` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: s.accent }} />
                  </div>
                  <PlayCircle className="w-4 h-4 text-white/30 group-hover:text-white/70 transition-colors" />
                </div>
                <div className="font-headline text-white text-lg">{s.title}</div>
                <div className="text-white/50 text-xs mt-1">{s.blurb}</div>
              </a>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function NowPlayingContinuous({ count }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="tick-dot live-pulse" />
        <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-[#1e5dff]">
          Play All · continuous show
        </div>
      </div>
      <div className="font-headline text-2xl sm:text-3xl text-white">
        Tonight&rsquo;s slate, back-to-back.
      </div>
      <div className="text-white/60 text-sm mt-2 max-w-2xl">
        The desk will roll through {count || "every"} game{count === 1 ? "" : "s"} on tonight&rsquo;s card. Story &rarr; stat
        &rarr; highlight &rarr; sign-off. No dead space. If you like a matchup, tap the logo strip above to jump to it.
      </div>
      <RecapVideoPlaceholder />
    </div>
  );
}

function NowPlayingGame({ game, teamMeta }) {
  const away = teamMeta(game.away);
  const home = teamMeta(game.home);
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="tick-dot live-pulse" />
        <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-[#1e5dff]">
          Now cued · {new Date(game.start_iso).toLocaleString(undefined, {
            weekday: "short", hour: "numeric", minute: "2-digit",
          })}
        </div>
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        <TeamBig code={game.away} name={away.name} accent={away.accent} label="Away" />
        <div className="font-headline text-3xl text-white/40 px-3">@</div>
        <TeamBig code={game.home} name={home.name} accent={home.accent} label="Home" />
      </div>
      <RecapVideoPlaceholder />
    </div>
  );
}

function TeamBig({ code, name, accent, label }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-14 w-14 rounded-lg flex items-center justify-center font-headline text-lg"
        style={{ background: `${accent}22`, border: `1px solid ${accent}66`, color: accent }}
      >
        {code}
      </div>
      <div>
        <div className="text-[10px] font-accent uppercase tracking-widest text-white/40">{label}</div>
        <div className="font-headline text-xl text-white">{name}</div>
      </div>
    </div>
  );
}

function RecapVideoPlaceholder() {
  return (
    <div
      className="mt-5 rounded-xl border border-dashed border-[#2d2d35] bg-gradient-to-br from-[#0b0b10] to-[#101625] px-5 py-8 flex items-center gap-4 flex-wrap"
      data-testid="recaps-video-placeholder"
    >
      <div className="h-14 w-14 rounded-full bg-[#1e5dff]/15 border border-[#1e5dff]/40 flex items-center justify-center flex-shrink-0">
        <Film className="w-6 h-6 text-[#1e5dff]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-headline text-white text-lg">
          Video lights up when Sportradar unlocks the feed.
        </div>
        <div className="text-white/55 text-xs mt-1 flex items-start gap-1.5">
          <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>
            Trial for the video product (LCP / Match Pulse) is in negotiation. Meantime the desk audio &mdash; Reggie&rsquo;s
            story, Marc&rsquo;s number, closing line &mdash; will roll behind each clip the moment it drops in. Zero rebuild.
          </span>
        </div>
      </div>
    </div>
  );
}
