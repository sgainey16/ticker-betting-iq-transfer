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
      <div className="grid md:grid-cols-[280px_1fr] gap-0">
        {/* Left: Game Control Score gauge */}
        <div className="p-5 border-b md:border-b-0 md:border-r border-[#2d2d35] flex flex-col items-center justify-center gap-3 bg-black/30">
          <div className="font-accent text-[10px] uppercase tracking-[0.3em] text-[#1E5BFF]">
            Game Control Score
          </div>
          <ControlGauge value={winControl} />
          <div className="text-center leading-tight">
            <div className="font-headline text-2xl text-white" data-testid="game-story-winner">
              {story.winner_code}
            </div>
            <div className="font-accent text-[10px] uppercase tracking-[0.25em] text-white/40 mt-1">
              vs {story.loser_code} · {loseControl}
            </div>
          </div>
        </div>

        {/* Right: Story */}
        <div className="p-5 sm:p-6 flex flex-col gap-4">
          <div>
            <div className="font-accent text-[10px] uppercase tracking-[0.3em] text-white/40 mb-2">
              {story.headline}
            </div>
            <p className="font-headline text-xl sm:text-2xl text-white leading-snug"
               data-testid="game-story-lead">
              {story.lead}
            </p>
          </div>
          {story.bullets?.length > 0 && (
            <ul className="space-y-2" data-testid="game-story-bullets">
              {story.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-3 text-white/85 text-sm sm:text-base">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#1E5BFF] flex-shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="text-[9px] font-accent uppercase tracking-[0.25em] text-white/25 pt-1">
            Ticker Model · Weighted across xG, chances, high-danger, possession, special teams, goaltending
          </div>
        </div>
      </div>
    </section>
  );
}

// Circular progress gauge. SVG ring stroke fills from 0 to `value`/100.
// Color shifts from white (~50) → Ticker blue (>60) so a blowout reads
// instantly. Range floor at 0, ceiling at 100.
function ControlGauge({ value }) {
  const size = 140;
  const stroke = 10;
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
        <div className="font-headline text-4xl text-white leading-none">{pct}</div>
        <div className="font-accent text-[9px] uppercase tracking-[0.3em] text-white/40 mt-1">/ 100</div>
      </div>
    </div>
  );
}
