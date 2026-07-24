// Dev/debug preview — cycles through every named solo shot in the 22:10
// broadcast frame so you can eyeball the full cast of expressions without
// waiting for audio. Access at /desk-preview
//
// Not linked from the main nav. Safe to leave in production; it's just a
// visual QA aid.
import { useEffect, useState } from "react";
import TwoHostDesk from "@/components/TwoHostDesk";

const EXPRESSIONS = [
  "neutral", "explaining", "pointing", "leaning",
  "hands_open", "counting", "looking_notes", "looking_monitor",
  "listening_off", "skeptical", "smirking", "laughing",
  "yelling", "disappointed", "serious", "chirping",
  "celebrating", "thinking", "hot_take", "mic_drop",
];

const TWO_SHOTS = [
  "neutral_open", "cold_open", "panel_wide", "side_two_shot", "reggie_leads",
  "marc_leads", "friendly_debate", "arguing", "hot_take_clash", "in_agreement",
  "serious_analysis", "reviewing_tape", "looking_at_monitor", "both_thinking",
  "both_pointing", "shocked", "laughing", "celebrating", "punchline", "signoff",
];

const ALL_SHOTS = [
  ...TWO_SHOTS.map((s) => (s === "side_two_shot" ? s : `two_${s}`)),
  ...EXPRESSIONS.map((s) => `reggie_${s}`),
  ...EXPRESSIONS.map((s) => `marc_${s}`),
];

export default function DeskPreview() {
  const [idx, setIdx] = useState(0);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % ALL_SHOTS.length), 1400);
    return () => clearInterval(t);
  }, [auto]);

  const shot = ALL_SHOTS[idx];
  const speaker = shot.startsWith("reggie_") ? "reggie" : shot.startsWith("marc_") ? "marc" : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="font-headline text-2xl text-white">Desk preview</div>
        <div className="font-accent text-[11px] uppercase tracking-widest text-white/60">
          Shot {idx + 1}/{ALL_SHOTS.length} · <span className="text-white">{shot}</span>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setAuto((a) => !a)}
            className="px-3 py-1.5 rounded-full border border-[#2d2d35] hover:border-white/40 text-white/80 font-accent text-[11px] uppercase tracking-widest"
          >
            {auto ? "Pause" : "Auto-cycle"}
          </button>
          <button
            onClick={() => setIdx((i) => (i - 1 + ALL_SHOTS.length) % ALL_SHOTS.length)}
            className="px-3 py-1.5 rounded-full border border-[#2d2d35] hover:border-white/40 text-white/80 font-accent text-[11px] uppercase tracking-widest"
          >
            ← Prev
          </button>
          <button
            onClick={() => setIdx((i) => (i + 1) % ALL_SHOTS.length)}
            className="px-3 py-1.5 rounded-full border border-[#2d2d35] hover:border-white/40 text-white/80 font-accent text-[11px] uppercase tracking-widest"
          >
            Next →
          </button>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden border border-[#2d2d35]">
        <TwoHostDesk shot={shot} speaker={speaker} speaking={true} />
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
        {ALL_SHOTS.map((s, i) => (
          <button
            key={s}
            onClick={() => { setAuto(false); setIdx(i); }}
            className={`text-left rounded border px-2 py-1.5 font-accent text-[10px] uppercase tracking-widest transition-colors ${
              i === idx
                ? "border-[#1e5dff] bg-[#1e5dff]/20 text-white"
                : "border-[#2d2d35] text-white/60 hover:border-white/40 hover:text-white"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
