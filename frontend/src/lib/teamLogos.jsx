import { useEffect, useState } from "react";
import { api } from "@/lib/api";

// Global one-shot fetch of all 32 NHL team logos from Highlightly (proxied
// via /api/images/team-logos). We memoize the promise at module level so
// every consumer shares the same request and cached map.

let _cache = null;   // { code: {code, name, logo_url, id} }
let _promise = null;

function loadLogos() {
  if (_cache) return Promise.resolve(_cache);
  if (_promise) return _promise;
  _promise = api.get("/images/team-logos").then((r) => {
    const map = {};
    (r.data?.teams || []).forEach((t) => { if (t.code) map[t.code] = t; });
    _cache = map;
    return map;
  }).catch(() => ({}));
  return _promise;
}

// Some backend endpoints return "TBL" / "LAK" / "SJS" (three-letter
// Sportradar convention) while our logo map is keyed by the two-letter
// Highlightly code "TB" / "LA" / "SJ". Normalize before lookup so any
// league-abbreviation drift resolves cleanly.
const CODE_ALIASES = {
  TBL: "TB",
  LAK: "LA",
  SJS: "SJ",
  NJD: "NJ",
  UTA: "UTAH",
  VGK: "VGK",
};

function normalize(code) {
  if (!code) return code;
  const up = code.toUpperCase();
  return CODE_ALIASES[up] || up;
}

export function useTeamLogos() {
  const [map, setMap] = useState(_cache || {});
  const [ready, setReady] = useState(!!_cache);
  useEffect(() => {
    if (_cache) { setMap(_cache); setReady(true); return; }
    let cancelled = false;
    loadLogos().then((m) => {
      if (cancelled) return;
      setMap(m);
      setReady(true);
    });
    return () => { cancelled = true; };
  }, []);
  const logoByCode = (code) => (code ? map[normalize(code)]?.logo_url : null);
  const nameByCode = (code) => (code ? map[normalize(code)]?.name : null);
  return { logoByCode, nameByCode, map, ready };
}

// Teams whose primary logo is dark-on-transparent (black, navy, deep blue)
// and needs a light backdrop to be visible on dark app surfaces. Keyed by
// the normalized (post-alias) code. Every code in here gets a subtle white
// halo behind the image so it reads on any accent color.
const DARK_LOGO_CODES = new Set([
  "TB",    // Tampa Bay Lightning — navy + black
  "PIT",   // Pittsburgh Penguins — black + gold
  "BOS",   // Boston Bruins — black + gold
  "LA",    // LA Kings — black + silver
  "SJ",    // San Jose Sharks — teal + black
  "ANA",   // Anaheim Ducks — black + orange (dark on dark)
  "VGK",   // Vegas Golden Knights — gold + black (dark rim)
  "DAL",   // Dallas Stars — green + black + silver
  "UTAH",  // Utah HC — very dark palette
  "NJ",    // New Jersey Devils — red + black on transparent
]);

// Small presentational component — renders <img> if logo is known, else a
// tasteful monogram chip. Keeps every use-site identical & tidy.
export function TeamLogo({ code, size = 20, className = "", monogramClass = "" }) {
  const { logoByCode } = useTeamLogos();
  const src = logoByCode(code);
  const norm = normalize(code);
  const needsHalo = src && DARK_LOGO_CODES.has(norm);
  if (!code) return null;
  if (src) {
    // Dark-logo teams get a subtle light halo behind the image so the mark
    // is legible on any dark app surface or coloured accent tile. Everyone
    // else renders unwrapped (no visual noise added).
    if (needsHalo) {
      const pad = Math.max(2, Math.round(size * 0.08));
      return (
        <span
          style={{
            width: size, height: size,
            background: "rgba(255,255,255,0.92)",
            borderRadius: "9999px",
            padding: pad,
            display: "inline-flex",
            alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
          className={className}
          data-testid={`team-logo-halo-${norm}`}
        >
          <img
            src={src}
            alt={code}
            loading="lazy"
            style={{ width: "100%", height: "100%" }}
            className="object-contain"
            data-testid={`team-logo-${norm}`}
          />
        </span>
      );
    }
    return (
      <img
        src={src}
        alt={code}
        loading="lazy"
        style={{ width: size, height: size }}
        className={`object-contain flex-shrink-0 ${className}`}
        data-testid={`team-logo-${norm}`}
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size }}
      className={`inline-flex items-center justify-center rounded-sm font-accent text-[9px] uppercase tracking-widest bg-white/10 text-white/70 flex-shrink-0 ${monogramClass}`}
      data-testid={`team-logo-fallback-${code}`}
    >
      {code}
    </span>
  );
}
