// The Ticker — signature 2-second broadcast sting.
//
// Pure Web Audio API composition — no asset files. Fires on first audio
// unlock and between topic segment changes. Meant to be reused anywhere we
// need a "show is on" moment. Later can be swapped for a recorded MP3
// without changing the call sites.
//
// The composition: sub-bass drop → whoosh sweep → brass-stab triad → kick
// tail. Total length ≈ 1.9s.

function makeOsc(ctx, type, freq, startT, dur, opts = {}) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startT);
  if (opts.freqEndAt) {
    osc.frequency.exponentialRampToValueAtTime(opts.freqEndAt.value, startT + opts.freqEndAt.t);
  }
  return osc;
}

function envelope(ctx, gainNode, startT, dur, peak, opts = {}) {
  const attack = opts.attack ?? 0.008;
  const release = opts.release ?? 0.9;
  gainNode.gain.setValueAtTime(0.0001, startT);
  gainNode.gain.exponentialRampToValueAtTime(peak, startT + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startT + dur * release);
}

/**
 * Play the signature Ticker sting.
 * @param {AudioContext} ctx  Live audio context.
 * @param {number} volume     Overall gain multiplier (0..1). Defaults to 0.4.
 */
export function playTickerSting(ctx, volume = 0.4) {
  if (!ctx) return;
  try {
    const now = ctx.currentTime + 0.02;
    const master = ctx.createGain();
    master.gain.value = volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 20;
    comp.ratio.value = 4;
    comp.attack.value = 0.005;
    comp.release.value = 0.25;
    master.connect(comp).connect(ctx.destination);

    // ---- 1) Sub-bass drop (0.00 - 0.55s) ----
    const bass = makeOsc(ctx, "sine", 120, now, 0.55, {
      freqEndAt: { value: 42, t: 0.5 },
    });
    const bassGain = ctx.createGain();
    envelope(ctx, bassGain, now, 0.55, 0.55, { attack: 0.01, release: 0.95 });
    bass.connect(bassGain).connect(master);
    bass.start(now);
    bass.stop(now + 0.6);

    // ---- 2) Whoosh sweep (0.10 - 0.75s) ----
    // Filtered noise sweeping up in cutoff.
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.7, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(400, now + 0.1);
    bp.frequency.exponentialRampToValueAtTime(5200, now + 0.72);
    const noiseGain = ctx.createGain();
    envelope(ctx, noiseGain, now + 0.1, 0.65, 0.32, { attack: 0.02, release: 0.9 });
    noise.connect(bp).connect(noiseGain).connect(master);
    noise.start(now + 0.1);
    noise.stop(now + 0.85);

    // ---- 3) Brass-stab triad (0.55 - 1.45s) ----
    // Bb2 root + F3 fifth + D4 major-third — classic sports fanfare.
    // Sawtooth into low-pass filter to fake brass.
    const notes = [116.54, 174.61, 293.66];
    notes.forEach((f, idx) => {
      const saw = makeOsc(ctx, "sawtooth", f, now + 0.55, 0.9);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(f * 5, now + 0.55);
      lp.frequency.exponentialRampToValueAtTime(f * 2.2, now + 1.35);
      lp.Q.value = 0.8;
      const g = ctx.createGain();
      const peak = idx === 0 ? 0.28 : idx === 1 ? 0.22 : 0.18;
      envelope(ctx, g, now + 0.55, 0.9, peak, { attack: 0.02, release: 0.9 });
      saw.connect(lp).connect(g).connect(master);
      saw.start(now + 0.55);
      saw.stop(now + 1.5);
    });

    // ---- 4) Kick-drum tail (0.55s + 1.20s accents) ----
    [0.55, 1.2].forEach((t) => {
      const k = makeOsc(ctx, "sine", 90, now + t, 0.18, {
        freqEndAt: { value: 40, t: 0.16 },
      });
      const kg = ctx.createGain();
      envelope(ctx, kg, now + t, 0.18, 0.6, { attack: 0.002, release: 0.9 });
      k.connect(kg).connect(master);
      k.start(now + t);
      k.stop(now + t + 0.22);
    });

    // ---- 5) High shimmer tail (1.35 - 1.9s) ----
    const shim = makeOsc(ctx, "triangle", 1760, now + 1.35, 0.55);
    const sg = ctx.createGain();
    envelope(ctx, sg, now + 1.35, 0.55, 0.08, { attack: 0.04, release: 0.95 });
    shim.connect(sg).connect(master);
    shim.start(now + 1.35);
    shim.stop(now + 1.95);
  } catch (e) {
    console.warn("Ticker sting failed", e);
  }
}
