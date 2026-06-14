// Generates an original, royalty-free soundtrack for the Lumi promo as a 16-bit
// stereo WAV. The arrangement is locked to 120 BPM (15 video frames per beat,
// 60 frames per 2-second bar) so scene cuts in the video land on musical bars.
//
// Sound design: a warm, hopeful electronic bed — sine/triangle pad chords, a
// soft sub kick, filtered-noise hats, a bright plucked arpeggio for movement,
// bell "sparkles" on key story beats (the logo reveal and the final lockup),
// plus a light stereo delay for air. No samples, no external assets.
//
// Run with:  node scripts/make-soundtrack.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SR = 44100; // sample rate
const BPM = 120;
const SECONDS = 30;
const N = SR * SECONDS;
const beat = 60 / BPM; // 0.5s
const bar = beat * 4; // 2s

const TAU = Math.PI * 2;

// ---- note frequencies -------------------------------------------------------
const NOTE = {
  F2: 87.31, G2: 98.0, A2: 110.0, C3: 130.81, E3: 164.81, F3: 174.61,
  G3: 196.0, A3: 220.0, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63,
  F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88, C5: 523.25, E5: 659.25, G5: 783.99,
};

// Uplifting I–V–vi–IV in C major, one chord per bar, looping.
const PROG = [
  { bass: NOTE.C3, notes: [NOTE.C4, NOTE.E4, NOTE.G4], arp: [NOTE.C4, NOTE.E4, NOTE.G4, NOTE.C5] }, // C
  { bass: NOTE.G2, notes: [NOTE.B3, NOTE.D4, NOTE.G4], arp: [NOTE.G3, NOTE.B3, NOTE.D4, NOTE.G4] }, // G
  { bass: NOTE.A2, notes: [NOTE.A3, NOTE.C4, NOTE.E4], arp: [NOTE.A3, NOTE.C4, NOTE.E4, NOTE.A4] }, // Am
  { bass: NOTE.F2, notes: [NOTE.F3, NOTE.A3, NOTE.C4], arp: [NOTE.F3, NOTE.A3, NOTE.C4, NOTE.F4] }, // F
];

// ---- buffers ----------------------------------------------------------------
const L = new Float32Array(N);
const R = new Float32Array(N);

const t = (s) => Math.max(0, Math.floor(s * SR));

// Simple ADSR-ish envelope.
function env(i, start, dur, a, d, s, rel) {
  const x = i / SR - start;
  if (x < 0 || x > dur) return 0;
  if (x < a) return x / a;
  if (x < a + d) return 1 - (1 - s) * ((x - a) / d);
  if (x < dur - rel) return s;
  return s * Math.max(0, (dur - x) / rel);
}

function addTone(buf, freq, start, dur, gain, type, env_) {
  const s0 = t(start), s1 = Math.min(N, t(start + dur));
  for (let i = s0; i < s1; i++) {
    const ph = TAU * freq * (i / SR);
    let v;
    if (type === "sine") v = Math.sin(ph);
    else if (type === "tri") v = Math.asin(Math.sin(ph)) * (2 / Math.PI);
    else if (type === "saw") v = 2 * ((freq * (i / SR)) % 1) - 1;
    else v = Math.sin(ph);
    buf[i] += v * gain * env_(i);
  }
}

// Sub kick: pitch-dropping sine with fast decay.
function kick(start, gain = 0.9) {
  const dur = 0.32;
  const s0 = t(start), s1 = Math.min(N, t(start + dur));
  for (let i = s0; i < s1; i++) {
    const x = (i - s0) / SR;
    const f = 120 * Math.exp(-x * 22) + 45;
    const e = Math.exp(-x * 9);
    const v = Math.sin(TAU * f * x) * e * gain;
    L[i] += v; R[i] += v;
  }
}

// Hi-hat: short burst of low-passed noise.
let hatState = 0;
function hat(start, gain = 0.18, open = false) {
  const dur = open ? 0.14 : 0.045;
  const s0 = t(start), s1 = Math.min(N, t(start + dur));
  for (let i = s0; i < s1; i++) {
    const x = (i - s0) / SR;
    const noise = Math.random() * 2 - 1;
    hatState = hatState * 0.55 + noise * 0.45; // light high-pass-ish via diff
    const v = (noise - hatState) * Math.exp(-x * (open ? 30 : 80)) * gain;
    L[i] += v * 0.9; R[i] += v;
  }
}

// Bell sparkle: stacked sines with shimmer, long tail.
function sparkle(start, root, gain = 0.5) {
  const partials = [1, 2.01, 3.0, 4.2, 5.4];
  const dur = 2.6;
  for (let p = 0; p < partials.length; p++) {
    const f = root * partials[p];
    const g = gain / (p + 1.4);
    const s0 = t(start), s1 = Math.min(N, t(start + dur));
    for (let i = s0; i < s1; i++) {
      const x = (i - s0) / SR;
      const e = Math.exp(-x * (1.4 + p * 0.5));
      const vib = 1 + 0.004 * Math.sin(TAU * 5 * x);
      const v = Math.sin(TAU * f * vib * x) * e * g;
      L[i] += v; R[i] += v;
    }
  }
}

// White-noise riser into a target time.
function riser(end, dur, gain = 0.25) {
  const start = end - dur;
  const s0 = t(start), s1 = Math.min(N, t(end));
  let lp = 0;
  for (let i = s0; i < s1; i++) {
    const x = (i - s0) / (s1 - s0);
    const noise = Math.random() * 2 - 1;
    lp = lp * (0.9 - 0.4 * x) + noise * (0.1 + 0.4 * x);
    const v = lp * x * x * gain;
    L[i] += v; R[i] += v;
  }
}

// ---- arrangement ------------------------------------------------------------
const totalBars = Math.floor(SECONDS / bar); // 15

// Section gains over time (problem -> reveal -> groove -> benefits -> resolve)
function sectionGain(barIdx) {
  if (barIdx < 3) return { drums: 0.0, arp: 0.25, pad: 0.7 };   // 0-6s problem
  if (barIdx < 5) return { drums: 0.5, arp: 0.5, pad: 0.85 };   // 6-10s reveal
  if (barIdx < 10) return { drums: 1.0, arp: 1.0, pad: 1.0 };   // 10-20s groove
  if (barIdx < 13) return { drums: 1.0, arp: 1.0, pad: 1.0 };   // 20-26s benefits
  if (barIdx < 14) return { drums: 0.6, arp: 0.7, pad: 1.0 };   // 26-28s pre-resolve
  return { drums: 0.0, arp: 0.0, pad: 1.0 };                    // 28-30s resolve
}

for (let b = 0; b < totalBars; b++) {
  const chord = PROG[b % PROG.length];
  const barStart = b * bar;
  const g = sectionGain(b);

  // Pad chord (sustained, soft attack) — two detuned layers for warmth.
  for (const f of chord.notes) {
    addTone(L, f, barStart, bar, 0.07 * g.pad, "tri", (i) => env(i, barStart, bar, 0.25, 0.2, 0.85, 0.5));
    addTone(R, f * 1.004, barStart, bar, 0.07 * g.pad, "tri", (i) => env(i, barStart, bar, 0.25, 0.2, 0.85, 0.5));
    addTone(L, f * 0.5, barStart, bar, 0.04 * g.pad, "sine", (i) => env(i, barStart, bar, 0.3, 0.2, 0.85, 0.5));
  }

  // Bass: root on beats 1 and 3.
  if (b >= 3) {
    for (const off of [0, 2 * beat]) {
      addTone(L, chord.bass, barStart + off, beat * 1.8, 0.22, "sine", (i) => env(i, barStart + off, beat * 1.8, 0.01, 0.15, 0.6, 0.3));
      addTone(R, chord.bass, barStart + off, beat * 1.8, 0.22, "sine", (i) => env(i, barStart + off, beat * 1.8, 0.01, 0.15, 0.6, 0.3));
    }
  }

  // Arp: eighth notes, panned alternately.
  const steps = 8;
  for (let s = 0; s < steps; s++) {
    const note = chord.arp[s % chord.arp.length] * (s >= 4 ? 1 : 1);
    const at = barStart + s * (beat / 2);
    const gg = 0.05 * g.arp;
    const buf = s % 2 === 0 ? L : R;
    addTone(buf, note * 2, at, beat / 2, gg, "tri", (i) => env(i, at, beat / 2, 0.005, 0.05, 0.3, 0.08));
  }

  // Drums: four-on-the-floor kick, offbeat hats.
  if (g.drums > 0) {
    for (let bt = 0; bt < 4; bt++) {
      kick(barStart + bt * beat, 0.85 * g.drums);
      hat(barStart + bt * beat + beat / 2, 0.13 * g.drums, bt === 3);
      hat(barStart + bt * beat + beat / 4, 0.06 * g.drums);
    }
  }
}

// Story sparkles + risers on the bar boundaries that match scene cuts.
sparkle(6.0, NOTE.C5, 0.55);    // logo reveal at 6s
riser(6.0, 1.0, 0.22);          // riser into reveal
sparkle(10.0, NOTE.G4, 0.3);    // into "how it works"
riser(20.0, 0.8, 0.16);         // into benefits
sparkle(27.0, NOTE.E5, 0.6);    // final lockup at 27s
sparkle(27.0, NOTE.C5, 0.45);

// ---- master: light stereo delay, soft limiter, master fades -----------------
function delay(buf, timeS, fb, mix) {
  const d = Math.floor(timeS * SR);
  const out = new Float32Array(buf.length);
  for (let i = 0; i < buf.length; i++) {
    const wet = i >= d ? out[i - d] * fb + buf[i - d] : 0;
    out[i] = buf[i] + wet * mix;
  }
  return out;
}
let l = delay(L, 0.27, 0.3, 0.22);
let r = delay(R, 0.36, 0.3, 0.22);

const fadeIn = t(0.4), fadeOut = t(SECONDS) - t(2.0);
function master(buf) {
  for (let i = 0; i < buf.length; i++) {
    let v = buf[i];
    if (i < fadeIn) v *= i / fadeIn;
    if (i > fadeOut) v *= Math.max(0, (N - i) / (N - fadeOut));
    // soft clip / limiter
    v = Math.tanh(v * 1.1);
    buf[i] = v * 0.92;
  }
}
master(l); master(r);

// ---- write 16-bit PCM stereo WAV --------------------------------------------
function writeWav(path, left, right) {
  const channels = 2, bytesPerSample = 2;
  const dataLen = left.length * channels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataLen);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataLen, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(SR, 24);
  buffer.writeUInt32LE(SR * channels * bytesPerSample, 28);
  buffer.writeUInt16LE(channels * bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataLen, 40);
  let off = 44;
  for (let i = 0; i < left.length; i++) {
    const sl = Math.max(-1, Math.min(1, left[i]));
    const sr = Math.max(-1, Math.min(1, right[i]));
    buffer.writeInt16LE((sl * 32767) | 0, off); off += 2;
    buffer.writeInt16LE((sr * 32767) | 0, off); off += 2;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buffer);
}

const outPath = new URL("../public/audio/soundtrack.wav", import.meta.url).pathname;
writeWav(outPath, l, r);
console.log(`Wrote ${outPath} (${SECONDS}s @ ${BPM} BPM, ${SR}Hz stereo)`);
