// TwoHostDesk — split-screen two-shot. Both hosts are ALWAYS visible so it
// feels like the show is already on when the app opens. The active speaker
// gets accent glow + full brightness; the listener dims slightly, stays
// present, and keeps small idle motion via the CSS speak-pulse fallback.
//
// Shot cues can request a solo close-up (reggie_* / marc_*) — the frame
// gently zooms and pans so that side takes over the canvas, then returns to
// the equal two-shot when the cue clears.
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

// Which host does the given shot cue focus on? null = equal two-shot.
function focusFor(shot) {
  if (!shot) return null;
  if (shot.startsWith("reggie_")) return "reggie";
  if (shot.startsWith("marc_")) return "marc";
  return null; // any "two_*" or "side_two_shot" stays equal
}

export default function TwoHostDesk({ shot, speaker, speaking }) {
  const focus = useMemo(() => focusFor(shot), [shot]);

  const reggieStyle = paneStyle("reggie", { focus, speaker, speaking });
  const marcStyle = paneStyle("marc", { focus, speaker, speaking });

  return (
    <div
      className="relative w-full overflow-hidden flex"
      style={{ aspectRatio: "16 / 8", background: "#0a0a0e" }}
    >
      <div className="relative flex-1 transition-all duration-700 ease-out" style={reggieStyle.wrap}>
        <div className="absolute inset-0" style={reggieStyle.img} />
        <div className="absolute inset-0 pointer-events-none" style={reggieStyle.tint} />
        {speaking && speaker === "reggie" && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              boxShadow: `inset 0 0 240px -40px ${ANALYSTS.reggie.accent}55`,
              animation: "reggieSpeakPulse 2.4s ease-in-out infinite",
            }}
          />
        )}
      </div>

      {/* Vertical seam blend between the two panes */}
      <div
        className="w-px flex-shrink-0 self-stretch pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.10) 30%, rgba(255,255,255,0.10) 70%, transparent 100%)",
        }}
      />

      <div className="relative flex-1 transition-all duration-700 ease-out" style={marcStyle.wrap}>
        <div className="absolute inset-0" style={marcStyle.img} />
        <div className="absolute inset-0 pointer-events-none" style={marcStyle.tint} />
        {speaking && speaker === "marc" && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              boxShadow: `inset 0 0 240px -40px ${ANALYSTS.marc.accent}55`,
              animation: "reggieSpeakPulse 2.4s ease-in-out infinite",
            }}
          />
        )}
      </div>

      {/* Vignette so the lower-third overlays sit cleanly */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none z-10"
        style={{
          height: "32%",
          background:
            "linear-gradient(to bottom, rgba(10,10,14,0) 0%, rgba(10,10,14,0.55) 55%, rgba(10,10,14,0.95) 100%)",
        }}
      />
    </div>
  );
}

// Compute the per-pane style: flex-grow, image position (which side of its
// crop to show), and dim/highlight tint based on speaker/focus.
function paneStyle(host, { focus, speaker, speaking }) {
  const a = ANALYSTS[host] || {};
  const src = a.hero ? `${BACKEND_URL}${a.hero}` : "";

  // flex-grow: focused side takes 2/3, other 1/3. Equal when no focus.
  const grow = focus === host ? 2.2 : focus ? 0.55 : 1;

  // Both stage images are cropped tight to the character. Position them so
  // the person is anchored toward the "outer" edge of their own pane — Reggie
  // sits toward the right of his pane so his gesture reads into the middle;
  // Marc sits toward the left of his pane for the mirror effect.
  const bgPos = host === "reggie" ? "center right" : "center left";

  const isSpeaker = speaker === host && speaking;
  const isListening = speaker && speaker !== host;

  return {
    wrap: {
      flexGrow: grow,
      flexBasis: 0,
      minWidth: 0,
    },
    img: {
      backgroundImage: src ? `url(${src})` : undefined,
      backgroundSize: "cover",
      backgroundPosition: bgPos,
      backgroundRepeat: "no-repeat",
      filter: isSpeaker
        ? "brightness(1.05) saturate(1.1)"
        : isListening
        ? "brightness(0.62) saturate(0.85)"
        : "brightness(0.92)",
      transition: "filter 400ms ease-out",
    },
    tint: {
      background: isSpeaker
        ? `linear-gradient(180deg, ${a.accent}00 40%, ${a.accent}22 100%)`
        : "transparent",
      transition: "background 400ms ease-out",
    },
  };
}
