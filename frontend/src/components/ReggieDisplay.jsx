// Reggie Banks expression sprite — 5 columns × 4 rows = 20 poses.
// Expressions numbered 1-20 per the animation spec.
import { useEffect, useState } from "react";

const SPRITE_URL =
  "https://customer-assets-39nsmqrw.emergentagent.net/job_sports-broadcast-21/artifacts/cqs0kmwo_EC893176-63E9-4A05-8631-04B04978FF2B.png";

const COLS = 5;
const ROWS = 4;

export const EXPRESSIONS = {
  neutral: 1,
  friendly_smile: 2,
  big_laugh: 3,
  smirk: 4,
  raised_eyebrow: 5,
  thinking: 6,
  leaning_forward: 7,
  finger_point: 8,
  open_hands: 9,
  hands_together: 10,
  arms_crossed: 11,
  shrug: 12,
  head_shake: 13,
  face_palm: 14,
  fist_pump: 15,
  applause: 16,
  confident_grin: 17,
  listening: 18,
  wink: 19,
  closing_smile: 20,
};

function positionFor(number) {
  const idx = Math.min(Math.max(number - 1, 0), COLS * ROWS - 1);
  const col = idx % COLS;
  const row = Math.floor(idx / COLS);
  const x = (col / (COLS - 1)) * 100;
  const y = (row / (ROWS - 1)) * 100;
  return { x, y };
}

export default function ReggieDisplay({ expression = "neutral", speaking = false, className = "" }) {
  // Cross-fade layer: keep the previous expression on a lower layer, fade the
  // new one in over the top.
  const [current, setCurrent] = useState(expression);
  const [previous, setPrevious] = useState(null);
  const [fadeKey, setFadeKey] = useState(0);

  useEffect(() => {
    if (expression === current) return;
    setPrevious(current);
    setCurrent(expression);
    setFadeKey((k) => k + 1);
    const t = setTimeout(() => setPrevious(null), 420);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expression]);

  const num = EXPRESSIONS[current] || 1;
  const pos = positionFor(num);

  const spriteStyle = (n) => {
    const p = positionFor(n);
    return {
      backgroundImage: `url(${SPRITE_URL})`,
      backgroundSize: `${COLS * 100}% ${ROWS * 100}%`,
      backgroundPosition: `${p.x}% ${p.y}%`,
      backgroundRepeat: "no-repeat",
    };
  };

  return (
    <div
      className={`relative w-full ${className}`}
      style={{ aspectRatio: "1 / 1", overflow: "hidden" }}
    >
      {previous && (
        <div
          key={`prev-${fadeKey}`}
          className="absolute inset-0 opacity-0"
          style={{ ...spriteStyle(EXPRESSIONS[previous] || 1), animation: "reggieFadeOut 420ms ease-out forwards" }}
        />
      )}
      <div
        key={`curr-${fadeKey}`}
        className="absolute inset-0"
        style={{ ...spriteStyle(num), opacity: 0, animation: "reggieFadeIn 420ms ease-out forwards" }}
      />
      {/* Solid bar hiding the label text baked into each sprite cell */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none z-10"
        style={{ height: "14%", background: "#0d0d11" }}
      />
      {/* Subtle speaking pulse — tiny brightness + scale bump while audio plays */}
      {speaking && (
        <div className="absolute inset-0 pointer-events-none" style={{
          animation: "reggieSpeakPulse 1.6s ease-in-out infinite",
          boxShadow: "inset 0 0 120px -40px rgba(30,93,255,0.25)",
        }} />
      )}
    </div>
  );
}
