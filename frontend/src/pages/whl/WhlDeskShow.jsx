// WHL Desk Show — "Kamloops Blazers · Live Desk"
// Route: /whl/desk-show
//
// The moat concept. We take a raw Kamloops Blazers YouTube highlight and
// wrap it in a produced broadcast:
//   • YouTube video plays (crowd/whistle audio is the "world sound")
//   • Reggie + Marc cut in on time — video audio ducks to 15%
//   • They shut up on the goal — video pops back to 100% for the moment
//   • Score-bug increments, chyron slides in, screen flashes
//   • Repeat for every beat, close on a desk sign-off
//
// Everything below is a hand-authored "showrunner timeline" tied to the
// video's currentTime. Cues fire when the player crosses that timestamp.
// The engine is intentionally deterministic — no LLM in the loop at
// runtime, so timing never drifts.

import { useEffect, useMemo, useRef, useState } from "react";
import { Volume2, Radio, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

// ---- The Game we're wrapping ----
// Note on video pick: WHL / junior clips are frequently geo-locked or have
// embedding disabled at the individual video level. If the current pick
// throws a YT player error (101/150 = embed blocked, 100 = not found) we
// swap to the next candidate in FALLBACK_YT below. In production we'd
// vet the URL server-side before authoring the beat sheet.
const CANDIDATE_YT_IDS = [
  "rQdRsb6rlWY",  // Victoria Royals @ Kamloops Blazers · Mar 6, 2026 (Sandman Centre) — WHL official
  "9jPchy0PjUc",  // Vancouver Giants @ Kamloops Blazers · Mar 7, 2026 (Sandman Centre) — WHL official
  "aG5ZI6enecM",  // Tri-City Americans @ Kamloops Blazers · Mar 11, 2026 (Sandman Centre) — WHL official
];

const GAME = {
  date: "Fri · Mar 6, 2026",
  arena: "Sandman Centre · Kamloops, BC",
  away: { code: "VIC", name: "Victoria Royals",   primary: "#052A6A" },
  home: { code: "KAM", name: "Kamloops Blazers",  primary: "#F58220" },
};

// Kamloops brand orange for our overlays.
const KAM = "#F58220";

// ---- The Showrunner Timeline ----
// Every entry is one on-air action. `t` is video seconds. The engine keeps
// score-bug / chyron state; those keys mutate at the exact cue timestamp.
//
// Kind reference:
//   speak       — play preloaded host audio; also ducks video to 15%
//   unduck      — bring video volume back to 100%
//   score       — update score bug (immediate, no audio)
//   chyron      — slide a lower-third in for a few seconds
//   flash       — brief screen flash (goal moment)
//   sting       — soft whoosh (WebAudio, no network)
//   close       — final desk sign-off segment
//
// Timestamps target a typical 3–4 min WHL highlight package. Tuned for
// feel — every value is one number, trivial to nudge once we see the
// actual clip.

// LEAD-IN: the ~10-second cold open that plays BEFORE the video ever
// starts. Runs off its own virtual clock over a branded Ticker desk card.
// Feels like a real network intro — sting, "you're watching" tag, hosts
// tossing to the highlight. When it ends, we cut to the game.
const LEADIN = [
  { t: 0.1,  kind: "sting" },
  { t: 0.3,  kind: "speak", speaker: "reggie",
    text: "You're watching The Ticker. Blazers desk." },
  { t: 4.0,  kind: "speak", speaker: "marc",
    text: "Friday night, Sandman Centre, packed house. Kamloops hosting Victoria." },
  { t: 8.3,  kind: "speak", speaker: "reggie",
    text: "Enough talk. Roll it." },
  { t: 11.0, kind: "sting" },
  { t: 11.3, kind: "leadin_end" },
];

// SHOW: the main timeline that plays synchronised to YT video currentTime.
// Kamloops is HOME tonight so the score bug reads VIC-away · KAM-home.
const SHOW = [
  // ---- Cold open over the first seconds of video (0–7s) ----
  { t: 0.3,  kind: "duck", to: 12 },
  { t: 0.5,  kind: "speak", speaker: "reggie",
    text: "Blazers, Royals, right here in the Tournament Capital. Let's go to work." },
  { t: 6.5,  kind: "unduck" },

  // ---- Beat 1: Blazers strike first at home (~18–30s) ----
  { t: 16.5, kind: "duck", to: 18 },
  { t: 16.8, kind: "speak", speaker: "marc",
    text: "Watch Oliver drive the slot here — Blazers have been living in this look all month." },
  { t: 22.0, kind: "flash" },
  { t: 22.0, kind: "chyron", scorer: "OLIVER · Opens the Scoring", detail: "A: Boumedienne, Kolt · 5v5", hold: 4.5 },
  { t: 22.0, kind: "score",  away: 0, home: 1 },
  { t: 22.2, kind: "speak", speaker: "reggie",
    text: "OLIVER! Snapped it clean, glove side, textbook. Sandman Centre is up on its feet!" },
  { t: 27.0, kind: "speak", speaker: "marc",
    text: "That's a seventy-eight percent expected-goal shot. He picked the exact spot most goalies bleed." },
  { t: 31.0, kind: "unduck" },

  // ---- Beat 2: Royals respond (~50–65s) ----
  { t: 48.0, kind: "duck", to: 18 },
  { t: 48.2, kind: "speak", speaker: "reggie",
    text: "Royals hit back — watch Cristall work the flank. Broken coverage all over this one." },
  { t: 54.0, kind: "flash" },
  { t: 54.0, kind: "chyron", scorer: "CRISTALL · Ties it 1-1", detail: "A: Michaelis · 5v5", hold: 4 },
  { t: 54.0, kind: "score", away: 1, home: 1 },
  { t: 54.2, kind: "speak", speaker: "marc",
    text: "One-timer top shelf. Kolt lost his mark on the weak side — that's a tape session tomorrow morning." },
  { t: 59.0, kind: "speak", speaker: "reggie",
    text: "Building goes quiet. That's Victoria for you — they punch back hard on the road." },
  { t: 63.0, kind: "unduck" },

  // ---- Beat 3: Blazers PP goal (~85–100s) ----
  { t: 83.0, kind: "duck", to: 18 },
  { t: 83.2, kind: "speak", speaker: "marc",
    text: "Blazers on the power play. One-three-one look with Brzustewicz at the point — that's an NHL contract feel at the CHL level." },
  { t: 89.0, kind: "flash" },
  { t: 89.0, kind: "chyron", scorer: "SOP · POWER-PLAY GOAL", detail: "A: Oliver, Brzustewicz · PP 1:26", hold: 4.5 },
  { t: 89.0, kind: "score", away: 1, home: 2 },
  { t: 89.2, kind: "speak", speaker: "reggie",
    text: "SOP! One-timer, gone. That thing is in before the glove moves. First-round pick for a reason!" },
  { t: 94.0, kind: "speak", speaker: "marc",
    text: "Kamloops power play is number four in the league now. That's not a hot streak. That's a system." },
  { t: 98.0, kind: "unduck" },

  // ---- Beat 4: Royals hang on (~120–140s) ----
  { t: 118.0, kind: "duck", to: 18 },
  { t: 118.2, kind: "speak", speaker: "reggie",
    text: "Royals won't die. Watch Greentree — he sees a shift change and just takes it." },
  { t: 124.0, kind: "flash" },
  { t: 124.0, kind: "chyron", scorer: "GREENTREE · Ties it 2-2", detail: "A: Cristall · 5v5", hold: 4 },
  { t: 124.0, kind: "score", away: 2, home: 2 },
  { t: 124.2, kind: "speak", speaker: "marc",
    text: "Kamloops waved for a change, coach didn't hear it in time. Small margins — that costs playoff games." },
  { t: 129.0, kind: "unduck" },

  // ---- Beat 5: The seal (~155–175s) ----
  { t: 150.0, kind: "duck", to: 15 },
  { t: 150.2, kind: "speak", speaker: "reggie",
    text: "Now watch this — Boumedienne, six-foot-four, ninety-one-mile-an-hour release. Just wait." },
  { t: 156.0, kind: "flash" },
  { t: 156.0, kind: "chyron", scorer: "BOUMEDIENNE · SLAP-SHOT SEAL", detail: "A: Sop · 5v5", hold: 5 },
  { t: 156.0, kind: "score", away: 2, home: 3 },
  { t: 156.2, kind: "speak", speaker: "reggie",
    text: "SLAP SHOT! That thing was still RISING when it hit twine! Frenchman with the hammer!" },
  { t: 162.0, kind: "speak", speaker: "marc",
    text: "NHL scouts moving him up the board tonight. That is a first-round-caliber release from the blue line." },
  { t: 167.0, kind: "unduck" },

  // ---- Desk close ----
  { t: 195.0, kind: "duck", to: 10 },
  { t: 195.2, kind: "sting" },
  { t: 195.4, kind: "speak", speaker: "reggie",
    text: "Blazers grind out the two at home. Oliver strikes first, Sop cashes on the man-advantage, Boumedienne seals it. That's your Ticker Blazers desk — see you tomorrow." },
  { t: 205.0, kind: "close" },
];

// Preload the YouTube IFrame API once per session.
function loadYTApi() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (window._ytApiPromise) return window._ytApiPromise;
  window._ytApiPromise = new Promise((resolve) => {
    const prior = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prior === "function") { try { prior(); } catch { /* noop */ } }
      resolve(window.YT);
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return window._ytApiPromise;
}

// One shared AudioContext for whoosh/sting SFX (no assets, all synth).
function stingSound() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = window._deskShowSFX || (window._deskShowSFX = new Ctx());
    const t = ctx.currentTime;
    // Two-note whoosh — descending then rising blip.
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(900, t);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.18);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.24);
  } catch { /* noop */ }
}

export default function WhlDeskShow() {
  const backend = process.env.REACT_APP_BACKEND_URL;
  const playerRef = useRef(null);
  const rafRef = useRef(0);
  const cursorRef = useRef(0);              // next SHOW index to fire
  const chyronTimerRef = useRef(null);
  const flashTimerRef = useRef(null);
  const currentAudioRef = useRef(null);     // whatever is speaking now
  const audioCacheRef = useRef({});         // idx → HTMLAudioElement

  const [ready, setReady] = useState(false);         // TTS preloaded?
  const [preloadPct, setPreloadPct] = useState(0);
  const [phase, setPhase] = useState("idle");        // idle | leadin | show | ended
  const [videoBroken, setVideoBroken] = useState(false); // YT can't play this ID
  const [ytIdx, setYtIdx] = useState(0);             // which candidate we're on

  const [score, setScore] = useState({ away: 0, home: 0 });
  const [chyron, setChyron] = useState(null);        // { scorer, detail }
  const [flash, setFlash] = useState(false);
  const [talking, setTalking] = useState(null);      // "reggie" | "marc" | null

  // Convenience booleans that stayed in a lot of the render code below.
  const live  = phase === "leadin" || phase === "show";
  const ended = phase === "ended";

  // ---- Preload all Reggie/Marc lines up front so timing never stalls ----
  // Preload BOTH the lead-in and the main show — we key them separately
  // so the runtime picks the right cache per phase.
  const leadinSpeakCues = useMemo(
    () => LEADIN.map((c, i) => ({ ...c, i })).filter(c => c.kind === "speak"),
    [],
  );
  const showSpeakCues = useMemo(
    () => SHOW.map((c, i) => ({ ...c, i })).filter(c => c.kind === "speak"),
    [],
  );
  const leadinAudioRef = useRef({});
  // audioCacheRef stays as the SHOW cache (already declared above).

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const total = leadinSpeakCues.length + showSpeakCues.length;
      let done = 0;
      // Preload leadin first so the intro can fire the moment user taps Go Live.
      for (const cue of leadinSpeakCues) {
        if (cancelled) return;
        try {
          const r = await api.get(`/recap-show/line-audio?speaker=${cue.speaker}&text=${encodeURIComponent(cue.text)}`);
          const url = r.data?.audio_url;
          if (url) {
            const full = url.startsWith("http") ? url : `${backend}${url}`;
            const a = new Audio(full);
            a.preload = "auto";
            leadinAudioRef.current[cue.i] = a;
          }
        } catch { /* skip */ }
        done += 1;
        setPreloadPct(Math.round((done / total) * 100));
      }
      for (const cue of showSpeakCues) {
        if (cancelled) return;
        try {
          const r = await api.get(`/recap-show/line-audio?speaker=${cue.speaker}&text=${encodeURIComponent(cue.text)}`);
          const url = r.data?.audio_url;
          if (url) {
            const full = url.startsWith("http") ? url : `${backend}${url}`;
            const a = new Audio(full);
            a.preload = "auto";
            audioCacheRef.current[cue.i] = a;
          }
        } catch { /* skip */ }
        done += 1;
        setPreloadPct(Math.round((done / total) * 100));
      }
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  }, [leadinSpeakCues, showSpeakCues, backend]);

  // ---- Kick the show ----
  // Two phases: LEAD-IN (branded cold open, no video) → SHOW (video + cues).
  const start = async () => {
    if (!ready || phase === "leadin" || phase === "show") return;
    setVideoBroken(false);
    cursorRef.current = 0;
    setPhase("leadin");

    // Prime every preloaded audio element inside this click gesture so
    // browsers (Safari especially) allow us to programmatically .play()
    // them later off a requestAnimationFrame timer. A muted play() → pause()
    // is enough to "unlock" the element for the session.
    const allAudio = [
      ...Object.values(leadinAudioRef.current),
      ...Object.values(audioCacheRef.current),
    ];
    for (const a of allAudio) {
      try {
        a.muted = true;
        await a.play();
        a.pause();
        a.currentTime = 0;
        a.muted = false;
      } catch { /* skip un-primable */ }
    }

    // Warm up the YT API in parallel so the cut-to-video handoff is instant.
    loadYTApi();

    // Run the lead-in virtual clock. When it fires "leadin_end", start the main show.
    runLeadin();
  };

  // ---- Lead-in phase runtime ----
  // Fires LEADIN cues off a wall clock. When we hit "leadin_end" we tear
  // down the leadin loop and hand off to the real video timeline.
  const leadinClockRef = useRef({ startedAt: 0, cursor: 0, active: false });
  const runLeadin = () => {
    leadinClockRef.current = { startedAt: performance.now(), cursor: 0, active: true };
    const step = () => {
      if (!leadinClockRef.current.active) return;
      const now = (performance.now() - leadinClockRef.current.startedAt) / 1000;
      while (
        leadinClockRef.current.cursor < LEADIN.length &&
        LEADIN[leadinClockRef.current.cursor].t <= now
      ) {
        const cue = LEADIN[leadinClockRef.current.cursor];
        leadinClockRef.current.cursor += 1;
        fireLeadin(cue);
        if (cue.kind === "leadin_end") return; // handoff triggered inside fireLeadin
      }
      if (leadinClockRef.current.active) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const fireLeadin = (cue) => {
    switch (cue.kind) {
      case "sting": { stingSound(); break; }
      case "speak": {
        const a = leadinAudioRef.current[cue.i];
        if (!a) return;
        if (currentAudioRef.current) { try { currentAudioRef.current.pause(); } catch { /* noop */ } }
        try { a.currentTime = 0; } catch { /* noop */ }
        setTalking(cue.speaker);
        a.onended = () => { if (currentAudioRef.current === a) setTalking(null); };
        a.play().catch(() => setTalking(null));
        currentAudioRef.current = a;
        break;
      }
      case "leadin_end": {
        leadinClockRef.current.active = false;
        setPhase("show");
        // Start the real video now.
        startShow();
        break;
      }
      default: break;
    }
  };

  // ---- Start the main video-anchored show ----
  const startShow = async () => {
    const YT = await loadYTApi();
    try { playerRef.current?.destroy(); } catch { /* noop */ }
    playerRef.current = new YT.Player("desk-yt-player", {
      videoId: CANDIDATE_YT_IDS[ytIdx],
      playerVars: {
        autoplay: 1,
        controls: 0,
        modestbranding: 1,
        rel: 0,
        playsinline: 1,
        showinfo: 0,
        origin: window.location.origin,
      },
      events: {
        onReady: (e) => {
          try {
            e.target.setVolume(100);
            e.target.playVideo();
          } catch { /* noop */ }
          tickRunner();
        },
        onError: () => {
          const nextIdx = ytIdx + 1;
          if (nextIdx < CANDIDATE_YT_IDS.length) {
            setYtIdx(nextIdx);
            try { playerRef.current?.loadVideoById(CANDIDATE_YT_IDS[nextIdx]); } catch { /* noop */ }
          } else {
            setVideoBroken(true);
            try { playerRef.current?.destroy(); } catch { /* noop */ }
            playerRef.current = null;
            startVirtualClock();
          }
        },
        onStateChange: (e) => {
          if (e.data === 0) finishShow();
        },
      },
    });
  };

  // If YouTube is unusable, run cues off a wall clock so the engine still
  // demonstrates. Time starts at 0 and advances in real seconds.
  const virtualClockRef = useRef({ startedAt: 0, active: false });
  const startVirtualClock = () => {
    virtualClockRef.current = { startedAt: performance.now(), active: true };
    const step = () => {
      if (!virtualClockRef.current.active) return;
      const now = (performance.now() - virtualClockRef.current.startedAt) / 1000;
      while (cursorRef.current < SHOW.length && SHOW[cursorRef.current].t <= now) {
        const cue = SHOW[cursorRef.current];
        cursorRef.current += 1;
        if (cue.kind === "duck" || cue.kind === "unduck") continue;
        fire(cue);
      }
      if (cursorRef.current < SHOW.length) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        finishShow();
      }
    };
    rafRef.current = requestAnimationFrame(step);
  };

  // ---- The runtime loop: check currentTime against SHOW cues ----
  // Only trigger the geo-block fallback if YT NEVER hits a playing state.
  // The earlier version fired the fallback 6s in even when the video was
  // clearly working (buffering), which is why users saw a poster over a
  // real, playing video.
  const tickRunner = () => {
    const startedAt = performance.now();
    let sawPlaying = false;
    const step = () => {
      const p = playerRef.current;
      if (!p || typeof p.getCurrentTime !== "function") {
        rafRef.current = requestAnimationFrame(step);
        return;
      }
      const now = p.getCurrentTime();
      // Trust the player's own state — 1 = PLAYING, 3 = BUFFERING.
      // If we ever hit either, the embed is fine, no fallback needed.
      try {
        const st = p.getPlayerState?.();
        if (st === 1 || st === 3 || now > 0.2) sawPlaying = true;
      } catch { /* noop */ }
      // Only bail if 15s in we've NEVER seen the player play or buffer.
      if (!sawPlaying && performance.now() - startedAt > 15000) {
        setVideoBroken(true);
        try { p.destroy?.(); } catch { /* noop */ }
        playerRef.current = null;
        startVirtualClock();
        return;
      }
      while (cursorRef.current < SHOW.length && SHOW[cursorRef.current].t <= now) {
        const cue = SHOW[cursorRef.current];
        cursorRef.current += 1;
        fire(cue);
      }
      rafRef.current = requestAnimationFrame(step);
    };
    step();
  };

  const fire = (cue) => {
    const p = playerRef.current;
    switch (cue.kind) {
      case "duck":   { try { p?.setVolume(cue.to ?? 15); } catch { /* noop */ } break; }
      case "unduck": { try { p?.setVolume(100); } catch { /* noop */ } break; }
      case "sting":  { stingSound(); break; }
      case "score":  { setScore({ away: cue.away, home: cue.home }); break; }
      case "flash":  {
        setFlash(true);
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(() => setFlash(false), 340);
        break;
      }
      case "chyron": {
        setChyron({ scorer: cue.scorer, detail: cue.detail });
        if (chyronTimerRef.current) clearTimeout(chyronTimerRef.current);
        chyronTimerRef.current = setTimeout(() => setChyron(null), (cue.hold || 4) * 1000);
        break;
      }
      case "speak": {
        // Fire and forget — no await, timeline keeps advancing on the video.
        // If two speak cues overlap (they shouldn't), the newer one wins.
        const a = audioCacheRef.current[cue.i];
        if (!a) return;
        if (currentAudioRef.current) { try { currentAudioRef.current.pause(); } catch { /* noop */ } }
        try { a.currentTime = 0; } catch { /* noop */ }
        setTalking(cue.speaker);
        const onEnd = () => { if (currentAudioRef.current === a) setTalking(null); };
        a.onended = onEnd;
        a.play().catch(() => setTalking(null));
        currentAudioRef.current = a;
        break;
      }
      case "close": { finishShow(); break; }
      default: break;
    }
  };

  const finishShow = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    virtualClockRef.current.active = false;
    leadinClockRef.current.active = false;
    if (currentAudioRef.current) { try { currentAudioRef.current.pause(); } catch { /* noop */ } }
    setTalking(null);
    setPhase("ended");
    try { playerRef.current?.pauseVideo(); } catch { /* noop */ }
  };

  // Cleanup on unmount.
  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (chyronTimerRef.current) clearTimeout(chyronTimerRef.current);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    if (currentAudioRef.current) { try { currentAudioRef.current.pause(); } catch { /* noop */ } }
    try { playerRef.current?.destroy(); } catch { /* noop */ }
  }, []);

  const replay = () => { setPhase("idle"); setScore({ away: 0, home: 0 }); start(); };

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-5">
        {/* Concept banner */}
        <div className="rounded-lg border border-[#F58220]/40 bg-gradient-to-r from-[#F58220]/15 to-transparent px-4 py-2.5">
          <div className="font-accent text-[10px] uppercase tracking-[0.3em] text-[#F58220]">
            The Ticker · WHL Desk · Live Show Prototype
          </div>
          <div className="font-headline text-white text-sm mt-0.5">
            Victoria Royals @ Kamloops Blazers · {GAME.date} · Real highlight + AI desk overlay
          </div>
        </div>

        {/* The stage: YouTube iframe with our overlays layered on top */}
        <div
          data-testid="desk-show-stage"
          className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-white/10 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)]"
        >
          {/* YouTube iframe target */}
          <div id="desk-yt-player" className="absolute inset-0 w-full h-full" />

          {/* Fallback backdrop when YouTube refuses to embed all candidates.
              The engine (audio + overlays) keeps running on a virtual clock. */}
          {videoBroken && (
            <div className="absolute inset-0 z-[5] pointer-events-none flex items-center justify-center bg-[radial-gradient(ellipse_at_center,#1a0f0a_0%,#0b0b10_70%)]">
              <div className="text-center">
                <div className="font-accent text-[9px] uppercase tracking-[0.35em] text-white/40">Video restricted</div>
                <div className="font-headline text-white/85 text-2xl mt-1">Blazers · WHL</div>
                <div className="font-accent text-[10px] uppercase tracking-[0.28em] text-white/40 mt-2 max-w-md">
                  Highlight embed blocked on this network — desk engine running over poster
                </div>
              </div>
            </div>
          )}

          {/* Poster + Start CTA (visible until user goes live) */}
          {!live && !ended && (
            <div className="absolute inset-0 bg-gradient-to-br from-black via-[#0b0b10] to-[#1a0f0a] flex flex-col items-center justify-center z-30">
              <div className="font-accent text-[10px] uppercase tracking-[0.35em] text-[#F58220]">
                Kamloops Blazers · Desk Show
              </div>
              <div className="font-headline text-white text-2xl md:text-3xl mt-2">
                Blazers @ Medicine Hat Tigers
              </div>
              <div className="font-accent text-[10px] uppercase tracking-[0.3em] text-white/50 mt-1">
                {GAME.date} · {GAME.arena}
              </div>

              <button
                data-testid="desk-show-start"
                onClick={start}
                disabled={!ready}
                className={`mt-6 rounded-full px-8 py-3 font-accent text-[11px] uppercase tracking-[0.3em] transition-all ${
                  ready
                    ? "bg-[#F58220] text-black hover:bg-[#ff9042] shadow-[0_10px_30px_-6px_rgba(245,130,32,0.6)]"
                    : "bg-white/10 text-white/60 cursor-wait"
                }`}
              >
                {ready ? (
                  <span className="flex items-center gap-2">
                    <Radio className="w-3.5 h-3.5" />
                    Go Live
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Warming Desk ({preloadPct}%)
                  </span>
                )}
              </button>

              <div className="mt-4 font-accent text-[9px] uppercase tracking-[0.28em] text-white/40 text-center max-w-md px-6">
                Real WHL highlight · Reggie + Marc cut in on cue · Video audio ducks around every play
              </div>
            </div>
          )}

          {/* Persistent Score Bug (top-left) — appears once the show is live */}
          {(live || ended) && (
            <div className="absolute top-3 left-3 z-20 pointer-events-none flex items-stretch rounded-md overflow-hidden shadow-lg border border-white/10">
              <div className="bg-[#F58220] text-black px-2.5 py-1 font-accent text-[10px] uppercase tracking-[0.28em] flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                Live
              </div>
              <div className="bg-black/85 backdrop-blur px-3 py-1 flex items-center gap-3 text-white">
                <span className="font-accent text-[10px] tracking-[0.22em] text-white/60">KAM</span>
                <span className="font-headline text-lg leading-none">{score.away}</span>
                <span className="text-white/25 text-[10px]">·</span>
                <span className="font-headline text-lg leading-none">{score.home}</span>
                <span className="font-accent text-[10px] tracking-[0.22em] text-white/60">MH</span>
              </div>
            </div>
          )}

          {/* "On Air" host tally (top-right) */}
          {live && (
            <div className="absolute top-3 right-3 z-20 pointer-events-none flex items-center gap-2 rounded-md bg-black/70 backdrop-blur px-2.5 py-1 border border-white/10">
              <Volume2 className={`w-3.5 h-3.5 ${talking ? "text-[#F58220]" : "text-white/25"}`} />
              <span className="font-accent text-[9px] uppercase tracking-[0.28em] text-white/80 min-w-[54px] text-center">
                {talking === "reggie" ? "Reggie" : talking === "marc" ? "Marc · Numbers" : "World Sound"}
              </span>
            </div>
          )}

          {/* Goal flash */}
          {flash && (
            <div className="absolute inset-0 z-10 pointer-events-none bg-white/90 animate-[fade_0.34s_ease-out_forwards]"
                 style={{ animation: "deskflash 0.34s ease-out forwards" }} />
          )}

          {/* Lower-Third Chyron */}
          {chyron && (
            <div className="absolute left-0 right-0 bottom-6 z-20 pointer-events-none flex justify-center px-4"
                 style={{ animation: "chyronin 0.32s cubic-bezier(0.2,0.8,0.2,1) both" }}>
              <div className="max-w-2xl w-full rounded-md overflow-hidden border border-white/10 shadow-2xl">
                <div className="bg-[#F58220] text-black px-3 py-1 font-accent text-[10px] uppercase tracking-[0.32em] flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-black" />
                  Blazers · Live
                </div>
                <div className="bg-black/90 backdrop-blur px-4 py-2.5">
                  <div className="font-headline text-white text-lg md:text-xl leading-tight">{chyron.scorer}</div>
                  <div className="font-accent text-[10px] uppercase tracking-[0.25em] text-white/60 mt-0.5">{chyron.detail}</div>
                </div>
              </div>
            </div>
          )}

          {/* "Roll Credits" close card */}
          {ended && (
            <div className="absolute inset-0 z-30 bg-gradient-to-br from-black via-[#0b0b10] to-[#1a0f0a] flex flex-col items-center justify-center">
              <div className="font-accent text-[10px] uppercase tracking-[0.35em] text-[#F58220]">Final · Ticker Desk</div>
              <div className="font-headline text-white text-3xl md:text-5xl mt-2">
                KAM {score.away} — {score.home} MH
              </div>
              <div className="font-accent text-[10px] uppercase tracking-[0.28em] text-white/50 mt-2">
                {GAME.date} · Blazers get the two
              </div>
              <button
                data-testid="desk-show-replay"
                onClick={replay}
                className="mt-6 rounded-full px-6 py-2.5 bg-white/10 hover:bg-white/15 border border-white/15 font-accent text-[10px] uppercase tracking-[0.3em] text-white"
              >
                Run It Again
              </button>
            </div>
          )}
        </div>

        {/* Under-the-hood note */}
        <div className="rounded-lg border border-white/10 bg-black/40 p-4">
          <div className="font-accent text-[10px] uppercase tracking-[0.3em] text-[#F58220] mb-2">
            What just happened
          </div>
          <ul className="space-y-1.5 text-white/80 text-[13px] leading-snug">
            <li>· <span className="text-white/95">Raw WHL video</span> plays untouched. YouTube audio is the crowd/whistle bed.</li>
            <li>· <span className="text-white/95">Reggie + Marc cut in on cue</span> — video volume ducks to 15% so they read clean.</li>
            <li>· On every goal the video pops back to 100% and the <span className="text-white/95">chyron + score bug</span> update on-frame.</li>
            <li>· Timeline is deterministic (cues fire on <code className="text-white/70">currentTime</code>) — no drift, no jitter.</li>
            <li>· Same engine wraps any Blazers / Rangers / any-junior-team YouTube clip once we author its beat sheet.</li>
          </ul>
        </div>
      </div>

      {/* Local keyframes — subtle broadcast motion */}
      <style>{`
        @keyframes deskflash { 0%{opacity:0.95} 100%{opacity:0} }
        @keyframes chyronin  { 0%{transform:translateY(24px);opacity:0} 100%{transform:translateY(0);opacity:1} }
      `}</style>
    </div>
  );
}
