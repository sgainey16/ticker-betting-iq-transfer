// The Ticker — network stinger.
//
// Familiar sports-network DNA (SportsCenter-style deep whoosh + snare-ish
// tail) blended with a modern synth click on top so it reads as "we're
// advanced". Synthesized in the browser via Web Audio API — no external
// file, no network cost, deterministic. We can retune the "feel" just by
// nudging the numbers below.
//
// Two intensities:
//   playStinger()      — full network sting, fires between segments
//   playStingerSoft()  — subtler version for show open / small confirms

let _ctx = null;
function ctx() {
  if (_ctx) return _ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  _ctx = new AC();
  return _ctx;
}

// A short deep sub-bass whoosh — this is the "cinematic" bottom end.
function whoosh(startTime, duration = 0.55, startHz = 220, endHz = 42, gain = 0.32) {
  const a = ctx();
  const osc = a.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(startHz, startTime);
  osc.frequency.exponentialRampToValueAtTime(endHz, startTime + duration);

  const filter = a.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(900, startTime);
  filter.Q.value = 0.7;

  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, startTime);
  g.gain.exponentialRampToValueAtTime(gain, startTime + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(filter).connect(g).connect(a.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

// A modern synth "click" — short filtered white noise burst up top. This
// is what makes it feel current instead of purely 90s-broadcast.
function click(startTime, gain = 0.18, freq = 6000) {
  const a = ctx();
  const bufferSize = a.sampleRate * 0.06;
  const buffer = a.createBuffer(1, bufferSize, a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);

  const src = a.createBufferSource();
  src.buffer = buffer;

  const filter = a.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = freq;

  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, startTime);
  g.gain.exponentialRampToValueAtTime(gain, startTime + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.06);

  src.connect(filter).connect(g).connect(a.destination);
  src.start(startTime);
  src.stop(startTime + 0.08);
}

// The signature punch-out — a short upward sine riser. Reads as "cue".
function riser(startTime, dur = 0.22, startHz = 300, endHz = 900, gain = 0.14) {
  const a = ctx();
  const osc = a.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(startHz, startTime);
  osc.frequency.exponentialRampToValueAtTime(endHz, startTime + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, startTime);
  g.gain.exponentialRampToValueAtTime(gain, startTime + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);
  osc.connect(g).connect(a.destination);
  osc.start(startTime);
  osc.stop(startTime + dur + 0.02);
}

// Public: full segment-break sting.
//   whoosh (deep bottom) + click (modern top) + riser (punch-out cue).
export function playStinger() {
  const a = ctx();
  if (!a) return;
  // Resume the context if the browser has suspended it (autoplay policies).
  if (a.state === "suspended") a.resume().catch(() => {});
  const t = a.currentTime;
  whoosh(t, 0.55, 240, 40, 0.32);
  click(t + 0.02, 0.18, 6000);
  riser(t + 0.30, 0.22, 300, 900, 0.16);
  // Trailing click accent — the "brand tick" of The Ticker.
  click(t + 0.50, 0.09, 8500);
}

// Public: softer variant used at show open / small confirms.
export function playStingerSoft() {
  const a = ctx();
  if (!a) return;
  if (a.state === "suspended") a.resume().catch(() => {});
  const t = a.currentTime;
  whoosh(t, 0.40, 180, 55, 0.22);
  click(t + 0.02, 0.12, 5500);
}
