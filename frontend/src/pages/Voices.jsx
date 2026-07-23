// Voice Picker — audition + swap voices for each host.
import { useEffect, useRef, useState } from "react";
import { api, BACKEND_URL } from "@/lib/api";
import { ANALYSTS } from "@/lib/config";
import AnalystAvatar from "@/components/AnalystAvatar";
import { Play, Pause, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Voices() {
  const [state, setState] = useState({ hosts: {} });
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(null); // "reggie:VOICE_ID"
  const [switching, setSwitching] = useState(null); // "reggie:VOICE_ID"
  const [pending, setPending] = useState({}); // preview generation pending
  const audioRef = useRef(null);

  async function load() {
    const r = await api.get("/voices/picker");
    setState(r.data);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function playPreview(host, voice_id) {
    const key = `${host}:${voice_id}`;
    if (playing === key) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }

    // Ensure preview exists.
    let url = state.hosts[host]?.find((c) => c.voice_id === voice_id)?.preview_url;
    // Try direct fetch first. If it 404s, generate.
    try {
      const head = await fetch(`${BACKEND_URL}${url}`, { method: "HEAD" });
      if (!head.ok) throw new Error("missing");
    } catch {
      setPending((p) => ({ ...p, [key]: true }));
      try {
        const r = await api.post(`/voices/preview/${host}/${voice_id}`);
        url = r.data.preview_url;
      } catch (e) {
        toast.error("Preview failed — check ElevenLabs quota");
        setPending((p) => ({ ...p, [key]: false }));
        return;
      }
      setPending((p) => ({ ...p, [key]: false }));
    }

    if (!audioRef.current) return;
    audioRef.current.src = `${BACKEND_URL}${url}`;
    audioRef.current.onended = () => setPlaying(null);
    audioRef.current.onerror = () => setPlaying(null);
    audioRef.current.play().catch(() => setPlaying(null));
    setPlaying(key);
  }

  async function setActive(host, voice_id) {
    const key = `${host}:${voice_id}`;
    setSwitching(key);
    try {
      const r = await api.post("/voices/set-active", { host, voice_id });
      toast.success(`${ANALYSTS[host]?.short} now voiced by ${voiceLabelFor(voice_id, host)}`, {
        description: `Cleared ${r.data.cleared_cache} old lines — the desk will regenerate on next play.`,
      });
      await load();
    } catch (e) {
      toast.error("Couldn't switch voice — try again");
    } finally {
      setSwitching(null);
    }
  }

  function voiceLabelFor(vid, host) {
    return state.hosts[host]?.find((c) => c.voice_id === vid)?.name || "the new voice";
  }

  return (
    <div className="space-y-8">
      <audio ref={audioRef} preload="none" playsInline />

      <header className="space-y-2">
        <div className="font-accent text-[11px] uppercase tracking-[0.35em] text-[#1e5dff]">
          Voice Booth
        </div>
        <h1 className="font-headline text-4xl sm:text-5xl text-white">
          Cast the desk.
        </h1>
        <p className="text-white/60 max-w-2xl">
          Audition every voice for each host. Tap play to hear it read a signature line in
          character. Pick the one that lands — the whole desk switches on the next play.
        </p>
      </header>

      {loading ? (
        <div className="text-white/50 font-accent uppercase tracking-widest text-sm">
          Loading candidates…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Object.keys(state.hosts).map((host) => (
            <HostColumn
              key={host}
              host={host}
              candidates={state.hosts[host]}
              playing={playing}
              switching={switching}
              pending={pending}
              onPlay={playPreview}
              onPick={setActive}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HostColumn({ host, candidates, playing, switching, pending, onPlay, onPick }) {
  const a = ANALYSTS[host] || {};
  return (
    <section
      className="rounded-2xl border border-[#2d2d35] bg-[#0d0d11] overflow-hidden"
      data-testid={`voices-column-${host}`}
    >
      <div
        className="px-5 py-4 border-b border-[#2d2d35] flex items-center gap-4"
        style={{ background: `linear-gradient(90deg, ${a.accent}22 0%, transparent 60%)` }}
      >
        <AnalystAvatar analystId={host} size={56} ring />
        <div className="min-w-0 flex-1">
          <div
            className="font-headline text-xl"
            style={{ color: a.accent }}
          >
            {a.name?.toUpperCase()}
          </div>
          <div className="font-accent text-[11px] uppercase tracking-widest text-white/50 truncate">
            {a.role}
          </div>
        </div>
      </div>

      <ul className="divide-y divide-[#2d2d35]">
        {candidates.map((c) => {
          const key = `${host}:${c.voice_id}`;
          const isPlaying = playing === key;
          const isSwitching = switching === key;
          const isPending = pending[key];
          return (
            <li
              key={c.voice_id}
              className={`px-5 py-4 flex items-center gap-4 transition-colors ${
                c.is_active ? "bg-white/[0.03]" : "hover:bg-white/[0.02]"
              }`}
              data-testid={`voice-row-${host}-${c.voice_id}`}
            >
              <button
                onClick={() => onPlay(host, c.voice_id)}
                data-testid={`voice-play-${host}-${c.voice_id}`}
                className="h-11 w-11 rounded-full flex items-center justify-center border transition-colors flex-shrink-0"
                style={{
                  borderColor: isPlaying ? a.accent : "#2d2d35",
                  background: isPlaying ? a.accent + "22" : "transparent",
                  color: isPlaying ? a.accent : "#ffffffcc",
                }}
                aria-label={isPlaying ? "Pause preview" : "Play preview"}
              >
                {isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5" />
                )}
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-headline text-base text-white">
                    {c.name}
                  </div>
                  {c.is_active && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-accent uppercase tracking-widest"
                      style={{ background: a.accent + "22", color: a.accent }}
                    >
                      <Check className="w-3 h-3" /> On Mic
                    </span>
                  )}
                </div>
                <div className="text-sm text-white/50 truncate">{c.vibe}</div>
              </div>

              <button
                onClick={() => onPick(host, c.voice_id)}
                disabled={c.is_active || isSwitching}
                data-testid={`voice-pick-${host}-${c.voice_id}`}
                className={`px-4 py-2 rounded-full text-[11px] font-accent uppercase tracking-widest transition-all flex-shrink-0 ${
                  c.is_active
                    ? "opacity-40 cursor-default border border-[#2d2d35] text-white/40"
                    : "border border-[#2d2d35] hover:border-white/40 text-white/80 hover:text-white"
                } disabled:cursor-wait`}
                style={c.is_active ? {} : { "--hover-accent": a.accent }}
              >
                {isSwitching ? (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Switching
                  </span>
                ) : c.is_active ? (
                  "Active"
                ) : (
                  "Use this voice"
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
