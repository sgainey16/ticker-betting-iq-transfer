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

// Small presentational component — renders <img> if logo is known, else a
// tasteful monogram chip. Keeps every use-site identical & tidy.
export function TeamLogo({ code, size = 20, className = "", monogramClass = "" }) {
  const { logoByCode } = useTeamLogos();
  const src = logoByCode(code);
  const style = { width: size, height: size };
  if (!code) return null;
  if (src) {
    return (
      <img
        src={src}
        alt={code}
        loading="lazy"
        style={style}
        className={`object-contain flex-shrink-0 ${className}`}
        data-testid={`team-logo-${normalize(code)}`}
      />
    );
  }
  return (
    <span
      style={style}
      className={`inline-flex items-center justify-center rounded-sm font-accent text-[9px] uppercase tracking-widest bg-white/10 text-white/70 flex-shrink-0 ${monogramClass}`}
      data-testid={`team-logo-fallback-${code}`}
    >
      {code}
    </span>
  );
}
