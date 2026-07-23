// TwoHostDesk — Fox-Sports-style studio, powered by the AI-generated wide
// two-shot at /api/hosts/studio.png. Speaker gets a subtle side glow so you
// know who's on mic without touching the base composition.
import { useMemo } from "react";
import { BACKEND_URL } from "@/lib/api";
import { ANALYSTS } from "@/lib/config";

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

export function resolveShot({ shot, speaker }) {
  if (shot && SHOTS.has(shot)) return shot;
  if (speaker === "reggie") return "reggie_explaining";
  if (speaker === "marc") return "marc_explaining";
  return "side_two_shot";
}

function sideFor(shot, speaker) {
  if (shot?.startsWith("reggie_")) return "left";
  if (shot?.startsWith("marc_")) return "right";
  if (speaker === "reggie") return "left";
  if (speaker === "marc") return "right";
  return null;
}

export default function TwoHostDesk({ shot, speaker, speaking }) {
  const side = useMemo(() => sideFor(shot, speaker), [shot, speaker]);
  const focused = side && speaking;

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ aspectRatio: "24 / 10", background: "#050510" }}
    >
      {/* Base studio composition */}
      <div
        className="absolute inset-0 transition-transform duration-1000 ease-out"
        style={{
          backgroundImage: `url(${BACKEND_URL}/api/hosts/studio.png)`,
          backgroundSize: "cover",
          backgroundPosition: "center 30%",
          backgroundRepeat: "no-repeat",
          transform: focused
            ? `scale(1.06) translateX(${side === "left" ? "6%" : "-6%"})`
            : "scale(1) translateX(0)",
        }}
      />

      {/* Dim the non-speaking half to guide the eye */}
      {focused && (
        <>
          <div
            className="absolute inset-y-0 pointer-events-none transition-opacity duration-500"
            style={{
              left: side === "left" ? "50%" : 0,
              right: side === "left" ? 0 : "50%",
              background:
                "linear-gradient(90deg, rgba(5,5,16,0) 0%, rgba(5,5,16,0.55) 100%)",
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              boxShadow: `inset ${side === "left" ? "220px" : "-220px"} 0 180px -80px ${
                ANALYSTS[speaker]?.accent || "#1e5dff"
              }55`,
              animation: "reggieSpeakPulse 2.6s ease-in-out infinite",
            }}
          />
        </>
      )}

      {/* Vignette so the lower-third overlays stay readable */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ boxShadow: "inset 0 0 200px 30px rgba(0,0,0,0.55)" }}
      />
    </div>
  );
}
