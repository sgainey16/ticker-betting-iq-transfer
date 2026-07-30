import { useEffect, useRef, useState } from "react";
import { Radio, Pause, Play, VolumeX, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";

// A small radio picker + player that lives inside an expanded Scoreboard
// card. Two buttons: Home Radio / Away Radio. Tapping either fetches the
// team's flagship station from /api/radio/station and starts an <audio>
// stream. If the direct URL fails (hotlink-protected, geo-blocked), we
// fall back to a TuneIn embed iframe so the station still plays.

const _cache = new Map(); // team_code → station response

async function fetchStation(code) {
  if (_cache.has(code)) return _cache.get(code);
  try {
    const r = await api.get(`/radio/station/${code}`);
    _cache.set(code, r.data);
    return r.data;
  } catch {
    return { available: false };
  }
}

export default function RadioPicker({ awayCode, homeCode }) {
  const [active, setActive] = useState(null);           // "home" | "away" | null
  const [station, setStation] = useState(null);
  const [status, setStatus] = useState("idle");         // idle | loading | playing | error | fallback
  const audioRef = useRef(null);

  // Load the station whenever the user flips sides.
  useEffect(() => {
    if (!active) { setStation(null); return; }
    let cancelled = false;
    const code = active === "home" ? homeCode : awayCode;
    setStatus("loading");
    fetchStation(code).then((s) => {
      if (cancelled) return;
      setStation(s);
      if (!s?.available) {
        setStatus("error");
      } else if (s.stream_url) {
        setStatus("playing");
      } else {
        setStatus("fallback"); // no direct URL — TuneIn iframe path
      }
    });
    return () => { cancelled = true; };
  }, [active, homeCode, awayCode]);

  // Attach the stream URL and try to play. If the browser blocks it
  // (hotlink 403 / CORS), degrade to the TuneIn fallback embed.
  useEffect(() => {
    if (status !== "playing") return;
    const el = audioRef.current;
    if (!el || !station?.stream_url) return;
    el.src = station.stream_url;
    const p = el.play();
    if (p && p.catch) {
      p.catch(() => setStatus("fallback"));
    }
  }, [status, station]);

  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setActive(null);
    setStatus("idle");
  };

  return (
    <div className="rounded-md border border-white/10 bg-black/30 p-3" data-testid="radio-picker">
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 font-accent text-[10px] uppercase tracking-[0.25em] text-white/60">
          <Radio className="w-3.5 h-3.5" />
          Radio
        </div>
        {active && (
          <button
            onClick={stop}
            className="text-white/50 hover:text-white text-[10px] font-accent uppercase tracking-widest"
            data-testid="radio-stop"
          >
            Stop
          </button>
        )}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <RadioButton
          side="away"
          code={awayCode}
          active={active === "away"}
          onClick={() => setActive(active === "away" ? null : "away")}
        />
        <RadioButton
          side="home"
          code={homeCode}
          active={active === "home"}
          onClick={() => setActive(active === "home" ? null : "home")}
        />
      </div>

      {/* Station attribution + player */}
      {active && (
        <div className="mt-3">
          {status === "loading" && (
            <div className="font-accent text-[10px] uppercase tracking-widest text-white/40">
              Tuning in…
            </div>
          )}
          {status === "error" && (
            <div className="font-accent text-[10px] uppercase tracking-widest text-white/50 flex items-center gap-1">
              <VolumeX className="w-3 h-3" />
              No station seeded for {active === "home" ? homeCode : awayCode} yet
            </div>
          )}
          {(status === "playing" || status === "fallback") && station?.available && (
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-headline text-white text-sm truncate">{station.name}</div>
                  <div className="font-accent text-[9px] uppercase tracking-widest text-white/40 truncate">
                    {station.callsign} · {station.city}
                  </div>
                </div>
                {status === "playing" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 border border-red-500/40 px-2 py-0.5 text-[9px] font-accent uppercase tracking-widest text-red-300">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                    </span>
                    On air
                  </span>
                )}
              </div>

              {/* Direct MP3/HLS player */}
              {status === "playing" && (
                <audio
                  ref={audioRef}
                  controls
                  className="w-full mt-2 rounded"
                  data-testid="radio-audio"
                />
              )}

              {/* TuneIn iframe fallback for stations without a direct hotlinkable URL */}
              {status === "fallback" && station.tunein_id && (
                <div className="mt-2">
                  <iframe
                    title={station.name}
                    src={`https://tunein.com/embed/player/${station.tunein_id}/`}
                    width="100%"
                    height="100"
                    frameBorder="0"
                    scrolling="no"
                    data-testid="radio-tunein"
                    style={{ borderRadius: 6 }}
                  />
                  <a
                    href={`https://tunein.com/radio/${station.tunein_id}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-[9px] font-accent uppercase tracking-widest text-white/40 hover:text-white/70"
                  >
                    Open on TuneIn <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              )}

              {station.notes && (
                <div className="mt-1.5 text-[9px] font-accent uppercase tracking-widest text-white/30">
                  {station.notes}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RadioButton({ side, code, active, onClick }) {
  return (
    <button
      onClick={onClick}
      data-testid={`radio-${side}-${code}`}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 font-accent text-[10px] uppercase tracking-widest transition-colors ${
        active
          ? "bg-red-500/20 border border-red-500/50 text-red-200"
          : "bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-white/30"
      }`}
    >
      {active ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
      {side === "home" ? "Home" : "Away"} · {code}
    </button>
  );
}
