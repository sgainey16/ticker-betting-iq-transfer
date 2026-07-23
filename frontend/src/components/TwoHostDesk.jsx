// TwoHostDesk — renders the "1-on-1 press conference" frame of whoever's
// speaking, cross-fading between hosts on cuts. Uses the user's canonical
// hero images at /api/hosts/. Later shot cues (expression variants, wides,
// two-shots) will layer on top of this base without needing to rewire.
import { useEffect, useRef, useState } from "react";
import { BACKEND_URL } from "@/lib/api";
import { ANALYSTS } from "@/lib/config";

// Every shot ID still supported. `hostFor(shot)` decides which hero to render.
export const SHOTS = new Set([
  "side_two_shot", "two_neutral_open", "two_friendly_debate", "two_laughing",
  "reggie_neutral", "reggie_explaining", "reggie_leaning", "reggie_pointing",
  "reggie_hands_open", "reggie_counting", "reggie_looking_notes",
  "reggie_looking_monitor", "reggie_listening_off", "reggie_skeptical",
  "reggie_smirking", "reggie_laughing", "reggie_yelling",
  "reggie_disappointed", "reggie_serious",
  "marc_explaining", "marc_analyzing_stats", "marc_looking_notes",
  "marc_adjusting_glasses", "marc_looking_monitor", "marc_listening",
  "marc_smiling", "marc_skeptical", "marc_serious", "marc_chuckle",
]);

function hostFor(shot, speaker) {
  if (typeof shot === "string") {
    if (shot.startsWith("reggie_")) return "reggie";
    if (shot.startsWith("marc_")) return "marc";
    // For two-shots and unknown cues, fall back to the speaker.
  }
  return speaker || "reggie";
}

export function resolveShot({ shot, speaker }) {
  if (shot && SHOTS.has(shot)) return shot;
  if (speaker === "reggie") return "reggie_explaining";
  if (speaker === "marc") return "marc_explaining";
  return "reggie_neutral";
}

export default function TwoHostDesk({ shot, speaker, speaking }) {
  const activeHost = hostFor(shot, speaker);
  const [current, setCurrent] = useState(activeHost);
  const [previous, setPrevious] = useState(null);
  const [fadeKey, setFadeKey] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (activeHost === current) return;
    setPrevious(current);
    setCurrent(activeHost);
    setFadeKey((k) => k + 1);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setPrevious(null), 500);
    return () => timerRef.current && clearTimeout(timerRef.current);
  }, [activeHost]); // eslint-disable-line react-hooks/exhaustive-deps

  const srcFor = (id) => `${BACKEND_URL}${ANALYSTS[id]?.hero}`;
  const layer = (host, isTop) => ({
    backgroundImage: `url(${srcFor(host)})`,
    backgroundSize: "cover",
    backgroundPosition: "center center",
    backgroundRepeat: "no-repeat",
    animation: `${isTop ? "reggieFadeIn" : "reggieFadeOut"} 500ms ease-out forwards`,
  });

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ aspectRatio: "3 / 2", background: "#0d0d11" }}
    >
      {previous && (
        <div
          key={`prev-${fadeKey}`}
          className="absolute inset-0 opacity-0"
          style={layer(previous, false)}
        />
      )}
      <div
        key={`curr-${fadeKey}`}
        className="absolute inset-0 opacity-0"
        style={layer(current, true)}
      />

      {/* Vignette that lets the lower-third sit cleanly at the bottom */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none z-10"
        style={{
          height: "35%",
          background:
            "linear-gradient(to bottom, rgba(13,13,17,0) 0%, rgba(13,13,17,0.55) 55%, rgba(13,13,17,0.95) 100%)",
        }}
      />

      {/* Subtle speaking glow tied to the on-mic host */}
      {speaking && (
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            animation: "reggieSpeakPulse 2.4s ease-in-out infinite",
            boxShadow: `inset 0 0 180px -40px ${
              ANALYSTS[current]?.accent || "#1e5dff"
            }35`,
          }}
        />
      )}
    </div>
  );
}
