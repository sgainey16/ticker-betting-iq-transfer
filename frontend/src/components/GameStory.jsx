import { useEffect, useState } from "react";
import { api } from "@/lib/api";

// GameStory — The Ticker's signature "translate data into meaning" panel.
// Shows above the split-screen PlayByPlay + PostGameStats grid.
//
// Left slot:  Game Control Score gauge (/100). One number tells you who
//             ran the game.
// Right slot: Lead sentence Reggie & Marc can read on-air, followed by
//             3-5 objective "Why X Lost" bullets.
//
// Shares the same `/recap-show/post-game-stats` endpoint as the box-score
// component (single fetch, single cache — see `game_story.py`).

const _cache = new Map(); // match_id → payload

export default function GameStory({ segment }) {
  const matchId = segment?.match_id;
  const [data, setData] = useState(() => _cache.get(matchId) || null);

  useEffect(() => {
    if (!matchId) return;
    if (_cache.has(matchId)) { setData(_cache.get(matchId)); return; }
    let cancelled = false;
    api.get(`/recap-show/post-game-stats?match_id=${matchId}`)
      .then((r) => { if (!cancelled) { _cache.set(matchId, r.data); setData(r.data); } })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [matchId]);

  if (!segment || !data?.ready || !data?.story || !data?.control) return null;

  const away = segment.away || {};
  const home = segment.home || {};
  const { story, control } = data;
  const winnerIsHome = story.winner_code === (home.code || (data.home?.team?.shortName));
  const winControl  = winnerIsHome ? control.home : control.away;
  const loseControl = 100 - winControl;

  return (
    <section
      className="rounded-2xl border border-[#2d2d35] bg-gradient-to-br from-[#0b0b10] via-[#0b0b10] to-[#111426] overflow-hidden"
      data-testid="game-story-panel"
    >
      <div className="grid md:grid-cols-[200px_1fr] gap-0">
        {/* Left: Game Control Score gauge — compact */}
        <div className="p-4 border-b md:border-b-0 md:border-r border-[#2d2d35] flex md:flex-col items-center justify-center gap-3 md:gap-2 bg-black/30">
          <ControlGauge value={winControl} />
          <div className="text-center leading-tight">
            <div className="font-accent text-[9px] uppercase tracking-[0.3em] text-[#1E5BFF]">
              Game Control
            </div>
            <div className="font-headline text-base text-white mt-1" data-testid="game-story-winner">
              {story.winner_code}
            </div>
            <div className="font-accent text-[9px] uppercase tracking-[0.25em] text-white/40">
              vs {story.loser_code} · {loseControl}
            </div>
          </div>
        </div>

        {/* Right: Story — tighter padding */}
        <div className="p-4 sm:p-5 flex flex-col gap-3">
          <div>
            <div className="font-accent text-[9px] uppercase tracking-[0.3em] text-white/40 mb-1.5">
              {story.headline}
            </div>
            <p className="font-headline text-base sm:text-lg text-white leading-snug"
               data-testid="game-story-lead">
              {story.lead}
            </p>
          </div>
          {story.bullets?.length > 0 && (
            <ul className="space-y-1.5" data-testid="game-story-bullets">
              {story.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2.5 text-white/85 text-[13px] sm:text-sm">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-[#1E5BFF] flex-shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="text-[8px] font-accent uppercase tracking-[0.25em] text-white/25">
            Ticker Model · xG · Chances · High-Danger · Possession · Special Teams · Goaltending
          </div>
        </div>
      </div>
    </section>
  );
}

// Compact circular gauge — smaller ring so the whole panel stays low-height.
function ControlGauge({ value }) {
  const size = 92;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const dash = (pct / 100) * c;
  const color = pct >= 62 ? "#1E5BFF" : pct >= 55 ? "#7cb2ff" : "#ffffff";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r}
          stroke="#2d2d35" strokeWidth={stroke} fill="transparent" />
        <circle cx={size / 2} cy={size / 2} r={r}
          stroke={color} strokeWidth={stroke} fill="transparent"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          style={{ transition: "stroke-dasharray 800ms ease-out" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-headline text-2xl text-white leading-none">{pct}</div>
        <div className="font-accent text-[8px] uppercase tracking-[0.3em] text-white/40 mt-0.5">/ 100</div>
      </div>
    </div>
  );
}
