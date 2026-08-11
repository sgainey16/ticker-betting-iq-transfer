// TwoHostDesk — the on-air broadcast frame.
//
// Two rendering modes:
//   1) SOLO SHOT — when the scripted `shot` names a specific host expression
//      (e.g. reggie_pointing, marc_analyzing_stats) AND we have the matching
//      full-frame portrait on disk, render that portrait as the entire frame.
//      This is the real "camera cut" — a hand-drawn Reggie/Marc pose fills
//      the screen exactly like a broadcast tight shot.
//   2) COMPOSED TWO-SHOT — for wide two-shots or when the specific portrait
//      isn't available yet, fall back to the original CSS studio with both
//      hosts side-by-side and the speaker pane widened.
//
// Adding new expressions is just dropping a PNG into
//   /app/backend/static/hosts/expressions/<host>/<slug>.png
// where <slug> is the shot suffix with underscores replaced by hyphens.

import { useMemo, useState, useEffect } from "react";
import { BACKEND_URL } from "@/lib/api";
import { ANALYSTS } from "@/lib/config";

// The 20 solo-expression slots each host has a portrait for.
const EXPRESSION_SLUGS = [
  "neutral", "explaining", "pointing", "leaning",
  "hands_open", "counting", "looking_notes", "looking_monitor",
  "listening_off", "skeptical", "smirking", "laughing",
  "yelling", "disappointed", "serious", "chirping",
  "celebrating", "thinking", "hot_take", "mic_drop",
  // legacy cues still supported for backwards-compat with old scripts
  "analyzing_stats", "adjusting_glasses", "listening", "smiling", "chuckle",
];

// The 20 two-shot slots (mirrors filenames in /hosts/expressions/together/).
export const TOGETHER_SLUGS = [
  "neutral_open", "cold_open", "panel_wide", "side_two_shot", "reggie_leads",
  "marc_leads", "friendly_debate", "arguing", "hot_take_clash", "in_agreement",
  "serious_analysis", "reviewing_tape", "looking_at_monitor", "both_thinking",
  "both_pointing", "shocked", "laughing", "celebrating", "punchline", "signoff",
];

export const SHOTS = new Set([
  // Legacy two-shot aliases that scripts may already use.
  "side_two_shot", "two_neutral_open", "two_friendly_debate", "two_laughing",
  ...EXPRESSION_SLUGS.map((s) => `reggie_${s}`),
  ...EXPRESSION_SLUGS.map((s) => `marc_${s}`),
  // Full two-shot roster; can be used bare (arguing) or with `two_` prefix.
  ...TOGETHER_SLUGS,
  ...TOGETHER_SLUGS.map((s) => `two_${s}`),
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

// Resolve any shot cue to a PNG under /api/hosts/expressions/<host>/<slug>.png.
// Returns null if the shot is a plain two-shot fallback that has no artwork.
function expressionUrl(shot) {
  if (!shot) return null;

  // Solo shots — reggie_* / marc_*
  const solo = /^(reggie|marc)_(.+)$/.exec(shot);
  if (solo) {
    const slug = solo[2].replace(/_/g, "-");
    return `${BACKEND_URL}/api/hosts/expressions/${solo[1]}/${slug}.png`;
  }

  // Two-shot cues — either "two_arguing" or bare "arguing"
  const twoPrefixed = /^two_(.+)$/.exec(shot);
  const bareSlug = twoPrefixed ? twoPrefixed[1] : shot;
  if (bareSlug === "side_two_shot") {
    return `${BACKEND_URL}/api/hosts/expressions/together/side-two-shot.png`;
  }
  if (TOGETHER_SLUGS.includes(bareSlug)) {
    const slug = bareSlug.replace(/_/g, "-");
    return `${BACKEND_URL}/api/hosts/expressions/together/${slug}.png`;
  }
  return null;
}

export default function TwoHostDesk({ shot, speaker, speaking, fill = false }) {
  const focus = useMemo(() => focusFor(shot), [shot]);
  const soloUrl = useMemo(() => expressionUrl(shot), [shot]);
  const [soloReady, setSoloReady] = useState(false);
  const [soloFailed, setSoloFailed] = useState(false);

  // Preload the solo portrait; if it 404s we fall back to composed studio.
  useEffect(() => {
    setSoloReady(false); setSoloFailed(false);
    if (!soloUrl) return;
    const img = new Image();
    img.onload = () => setSoloReady(true);
    img.onerror = () => setSoloFailed(true);
    img.src = soloUrl;
  }, [soloUrl]);

  const useSolo = soloUrl && soloReady && !soloFailed;

  // `fill` lets the caller stretch the desk to its parent (used in the
  // Recap Show landscape bleed). Otherwise we keep the natural 22:10 ratio.
  const containerStyle = fill
    ? { background: "#050510" }
    : { aspectRatio: "22 / 10", background: "#050510" };
  const containerCls = fill
    ? "relative w-full h-full overflow-hidden"
    : "relative w-full overflow-hidden";

  return (
    <div
      className={containerCls}
      style={containerStyle}
    >
      {useSolo ? (
        <SoloFrame url={soloUrl} host={focus} speaking={speaking && speaker === focus} />
      ) : (
        <ComposedStudio focus={focus} speaker={speaker} speaking={speaking} />
      )}

      {/* Vignette so overlays stay readable */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{ boxShadow: "inset 0 0 160px 20px rgba(0,0,0,0.55)" }}
      />
    </div>
  );
}

// ---- Solo camera cut: full-frame expression portrait ----
function SoloFrame({ url, host, speaking }) {
  const a = ANALYSTS[host] || {};
  return (
    <div className="absolute inset-0">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${url})`,
          backgroundSize: "cover",
          backgroundPosition: "center 28%",
          backgroundRepeat: "no-repeat",
          filter: speaking
            ? "brightness(1.02) saturate(1.06)"
            : "brightness(0.94)",
          transition: "filter 400ms ease-out",
        }}
      />
      {/* subtle speaker pulse rim in the host accent */}
      {speaking && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow: `inset 0 -180px 140px -80px ${a.accent}55`,
            animation: "reggieSpeakPulse 2.6s ease-in-out infinite",
          }}
        />
      )}
    </div>
  );
}

// ---- Fallback: composed studio with both hosts (existing behavior) ----
function ComposedStudio({ focus, speaker, speaking }) {
  return (
    <>
      <div className="absolute inset-0" style={monitorWallStyle} />
      <div className="absolute inset-0" style={monitorWallOverlayStyle} />
      <div className="absolute inset-y-0 left-0 w-1/3 pointer-events-none"
        style={{ background: "radial-gradient(circle at 0% 50%, rgba(30,93,255,0.16), transparent 60%)" }} />
      <div className="absolute inset-y-0 right-0 w-1/3 pointer-events-none"
        style={{ background: "radial-gradient(circle at 100% 50%, rgba(0,229,255,0.12), transparent 60%)" }} />

      <div className="absolute inset-x-0 top-0" style={{ bottom: "22%" }}>
        <div className="w-full h-full flex">
          <HostPane host="reggie" focus={focus} speaker={speaker} speaking={speaking} align="right" />
          <HostPane host="marc" focus={focus} speaker={speaker} speaking={speaking} align="left" />
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 pointer-events-none z-20" style={{ height: "22%" }}>
        <div className="absolute inset-0" style={{
          background:
            "linear-gradient(180deg, rgba(5,5,16,0) 0%, rgba(5,5,16,0.85) 12%, rgba(8,10,26,0.98) 45%, #05070f 100%)",
        }} />
        <div className="absolute inset-x-0 top-0" style={{
          height: "3px",
          background:
            "linear-gradient(90deg, transparent 0%, #1e5dff88 22%, #1e5dff 46%, #00e5ff 54%, #00e5ffaa 78%, transparent 100%)",
          boxShadow: "0 0 24px 4px rgba(30,93,255,0.55)",
        }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="font-headline text-white/80 tracking-[0.35em]"
            style={{
              fontSize: "clamp(16px, 2.2vw, 28px)",
              textShadow: "0 0 18px rgba(30,93,255,0.7), 0 1px 0 rgba(0,0,0,0.6)",
            }}>
            THE&nbsp;TICKER
          </div>
        </div>
      </div>
    </>
  );
}

function HostPane({ host, focus, speaker, speaking, align }) {
  const a = ANALYSTS[host] || {};
  const src = a.hero ? `${BACKEND_URL}${a.hero}` : "";
  const grow = focus === host ? 1.8 : focus ? 0.7 : 1;
  const isSpeaker = speaker === host && speaking;
  const isListening = speaker && speaker !== host;

  return (
    <div className="relative transition-all duration-700 ease-out"
      style={{ flexGrow: grow, flexBasis: 0, minWidth: 0 }}>
      <div className="absolute inset-0"
        style={{
          backgroundImage: src ? `url(${src})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center 30%",
          backgroundRepeat: "no-repeat",
          filter: isSpeaker
            ? "brightness(1.05) saturate(1.08) contrast(1.02)"
            : isListening
            ? "brightness(0.55) saturate(0.75)"
            : "brightness(0.88)",
          transition: "filter 400ms ease-out, background-position 700ms ease-out",
        }} />
      {isSpeaker && (
        <div className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow: `inset 0 -180px 120px -80px ${a.accent}55`,
            animation: "reggieSpeakPulse 2.6s ease-in-out infinite",
          }} />
      )}
    </div>
  );
}

const monitorWallStyle = {
  background: "linear-gradient(180deg, #0a0f22 0%, #060814 60%, #04060f 100%)",
};

const monitorWallOverlayStyle = {
  backgroundImage: [
    "repeating-linear-gradient(0deg, rgba(30,93,255,0.045) 0 1px, transparent 1px 4px)",
    "repeating-linear-gradient(90deg, rgba(255,255,255,0.02) 0 78px, rgba(30,93,255,0.05) 78px 82px)",
    "repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0 44px, rgba(0,229,255,0.04) 44px 48px)",
  ].join(","),
  mixBlendMode: "screen",
  opacity: 0.75,
};
