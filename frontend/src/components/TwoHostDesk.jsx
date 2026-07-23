// TwoHostDesk — Fox-Sports-1-style wide studio two-shot. Built entirely in
// CSS so there is one shared studio (monitor-wall + desk + THE TICKER lit
// logo bar) around BOTH hosts. The two hosts sit inside their own panes as
// smaller, framed subjects; studio air surrounds them so the frame feels
// like a real broadcast wide.
//
// A shot cue (reggie_* / marc_*) pushes one pane wider for a soft camera cut.
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

function focusFor(shot) {
  if (!shot) return null;
  if (shot.startsWith("reggie_")) return "reggie";
  if (shot.startsWith("marc_")) return "marc";
  return null;
}

export default function TwoHostDesk({ shot, speaker, speaking }) {
  const focus = useMemo(() => focusFor(shot), [shot]);

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ aspectRatio: "22 / 10", background: "#050510" }}
    >
      {/* --- Layer 1: monitor wall / studio backdrop --- */}
      <div className="absolute inset-0" style={monitorWallStyle} />
      <div className="absolute inset-0" style={monitorWallOverlayStyle} />
      {/* Studio ambient glow left/right */}
      <div className="absolute inset-y-0 left-0 w-1/3 pointer-events-none" style={{ background: "radial-gradient(circle at 0% 50%, rgba(30,93,255,0.16), transparent 60%)" }} />
      <div className="absolute inset-y-0 right-0 w-1/3 pointer-events-none" style={{ background: "radial-gradient(circle at 100% 50%, rgba(0,229,255,0.12), transparent 60%)" }} />

      {/* --- Layer 2: both hosts, sized to leave studio air around them --- */}
      <div className="absolute inset-x-0 top-0" style={{ bottom: "22%" }}>
        <div className="w-full h-full flex">
          <HostPane host="reggie" focus={focus} speaker={speaker} speaking={speaking} align="right" />
          <HostPane host="marc" focus={focus} speaker={speaker} speaking={speaking} align="left" />
        </div>
      </div>

      {/* --- Layer 3: desk-front with THE TICKER logo strip --- */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none z-20" style={{ height: "22%" }}>
        {/* desk plane */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(5,5,16,0) 0%, rgba(5,5,16,0.85) 12%, rgba(8,10,26,0.98) 45%, #05070f 100%)",
          }}
        />
        {/* thin lit rim across the desk edge */}
        <div
          className="absolute inset-x-0 top-0"
          style={{
            height: "3px",
            background:
              "linear-gradient(90deg, transparent 0%, #1e5dff88 22%, #1e5dff 46%, #00e5ff 54%, #00e5ffaa 78%, transparent 100%)",
            boxShadow: "0 0 24px 4px rgba(30,93,255,0.55)",
          }}
        />
        {/* THE TICKER wordmark carved into the desk front, centered */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="font-headline text-white/80 tracking-[0.35em]"
            style={{
              fontSize: "clamp(16px, 2.2vw, 28px)",
              textShadow:
                "0 0 18px rgba(30,93,255,0.7), 0 1px 0 rgba(0,0,0,0.6)",
            }}
          >
            THE&nbsp;TICKER
          </div>
        </div>
      </div>

      {/* Vignette so the lower-third overlays stay readable */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          boxShadow: "inset 0 0 160px 20px rgba(0,0,0,0.55)",
        }}
      />
    </div>
  );
}

function HostPane({ host, focus, speaker, speaking, align }) {
  const a = ANALYSTS[host] || {};
  const src = a.hero ? `${BACKEND_URL}${a.hero}` : "";

  const grow = focus === host ? 1.8 : focus ? 0.7 : 1;
  const isSpeaker = speaker === host && speaking;
  const isListening = speaker && speaker !== host;

  // Give the character breathing room: sit them at ~68% of pane height so
  // the studio backdrop reads above them, and the desk bar shows below.
  return (
    <div
      className="relative transition-all duration-700 ease-out"
      style={{ flexGrow: grow, flexBasis: 0, minWidth: 0 }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: src ? `url(${src})` : undefined,
          backgroundSize: "auto 92%",
          backgroundPosition: `${align === "right" ? "72%" : "28%"} 26%`,
          backgroundRepeat: "no-repeat",
          filter: isSpeaker
            ? "brightness(1.05) saturate(1.08) contrast(1.02)"
            : isListening
            ? "brightness(0.55) saturate(0.75)"
            : "brightness(0.88)",
          transition: "filter 400ms ease-out, background-position 700ms ease-out",
        }}
      />
      {isSpeaker && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow: `inset 0 -180px 120px -80px ${a.accent}55`,
            animation: "reggieSpeakPulse 2.6s ease-in-out infinite",
          }}
        />
      )}
    </div>
  );
}

// ---- Studio backdrop (CSS "monitor wall") ----
const monitorWallStyle = {
  background:
    "linear-gradient(180deg, #0a0f22 0%, #060814 60%, #04060f 100%)",
};

// A tiled dim monitor pattern — subtle rectangles suggesting a wall of
// video screens without competing with the hosts for attention.
const monitorWallOverlayStyle = {
  backgroundImage: [
    // horizontal scan lines
    "repeating-linear-gradient(0deg, rgba(30,93,255,0.045) 0 1px, transparent 1px 4px)",
    // monitor tiles
    "repeating-linear-gradient(90deg, rgba(255,255,255,0.02) 0 78px, rgba(30,93,255,0.05) 78px 82px)",
    "repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0 44px, rgba(0,229,255,0.04) 44px 48px)",
  ].join(","),
  mixBlendMode: "screen",
  opacity: 0.75,
};
