// TwoHostDesk — renders the current "camera shot" of Reggie + Marc using the
// pre-cropped sprite library at /api/sprites/. A tiny cross-fade between
// shots keeps the broadcast feeling alive.
import { useEffect, useRef, useState } from "react";
import { BACKEND_URL } from "@/lib/api";

// Every shot ID that server-side scripts can reference.
export const SHOTS = new Set([
  "two_neutral_open", "two_reggie_speaks", "two_marc_speaks",
  "two_friendly_debate", "two_laughing", "two_both_monitor",
  "two_reviewing_notes", "two_serious", "two_excited", "two_closing",
  "reggie_neutral", "reggie_explaining", "reggie_leaning", "reggie_pointing",
  "reggie_hands_open", "reggie_counting", "reggie_looking_notes",
  "reggie_looking_monitor", "reggie_listening_off", "reggie_skeptical",
  "reggie_smirking", "reggie_laughing", "reggie_yelling",
  "reggie_disappointed", "reggie_serious",
  "marc_explaining", "marc_analyzing_stats", "marc_looking_notes",
  "marc_adjusting_glasses", "marc_looking_monitor", "marc_listening",
  "marc_smiling", "marc_skeptical", "marc_serious", "marc_chuckle",
  "ots_reggie", "ots_marc", "side_two_shot", "telestrator", "end_of_show_wave",
]);

// Fallback shot when a script gives us something we don't recognise.
const DEFAULT_SHOT = "two_neutral_open";

// Auto-pick a "listening" shot for the silent host based on the current speaker.
export function listeningShotFor(speaker, currentShot) {
  if (speaker === "reggie") return "marc_listening";
  if (speaker === "marc") return "reggie_listening_off";
  return currentShot || DEFAULT_SHOT;
}

export function resolveShot({ shot, speaker }) {
  if (shot && SHOTS.has(shot)) return shot;
  // No explicit cue — infer a solo speaking shot from the speaker.
  if (speaker === "reggie") return "reggie_explaining";
  if (speaker === "marc") return "marc_explaining";
  return DEFAULT_SHOT;
}

export default function TwoHostDesk({ shot, speaking }) {
  const [current, setCurrent] = useState(shot || DEFAULT_SHOT);
  const [previous, setPrevious] = useState(null);
  const [fadeKey, setFadeKey] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!shot || shot === current) return;
    setPrevious(current);
    setCurrent(shot);
    setFadeKey((k) => k + 1);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setPrevious(null), 480);
    return () => timerRef.current && clearTimeout(timerRef.current);
  }, [shot]); // eslint-disable-line react-hooks/exhaustive-deps

  const srcFor = (id) => `${BACKEND_URL}/api/sprites/${id}.png`;
  const layer = (id, isTop) => ({
    backgroundImage: `url(${srcFor(id)})`,
    backgroundSize: "cover",
    backgroundPosition: "center 25%",
    backgroundRepeat: "no-repeat",
    animation: `${isTop ? "reggieFadeIn" : "reggieFadeOut"} 480ms ease-out forwards`,
  });

  return (
    <div className="relative w-full overflow-hidden" style={{ aspectRatio: "5 / 4", background: "#0d0d11" }}>
      {previous && (
        <div key={`prev-${fadeKey}`} className="absolute inset-0 opacity-0" style={layer(previous, false)} />
      )}
      <div key={`curr-${fadeKey}`} className="absolute inset-0 opacity-0" style={layer(current, true)} />

      {/* Cover any leftover blue label bar baked into the sprite's bottom edge */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none z-10"
        style={{ height: "8%", background: "linear-gradient(to bottom, rgba(13,13,17,0) 0%, #0d0d11 60%)" }}
      />

      {/* Subtle "speaking" glow */}
      {speaking && (
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            animation: "reggieSpeakPulse 1.8s ease-in-out infinite",
            boxShadow: "inset 0 0 140px -50px rgba(30,93,255,0.25)",
          }}
        />
      )}
    </div>
  );
}
