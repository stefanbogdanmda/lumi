// Original, royalty-free soundtrack for the Lumi promo, rendered offline with a
// real Web Audio engine (node-web-audio-api) — supersaw pads, a sub bass, a
// plucked arpeggio, a singing lead, layered drums, convolution reverb, a tempo
// delay, and a sidechain "pump" so the mix breathes with the kick.
//
// 120 BPM (15 video frames / beat, 60 / 2s bar) so scene cuts stay locked to the
// music. Arrangement matches the video: intro build → impact/reveal at 6s →
// full groove → benefits lift → final impact at 27s → resolving tail.
//
//   node scripts/make-soundtrack.mjs   →   public/audio/soundtrack.wav
import { OfflineAudioContext } from "node-web-audio-api";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SR = 44100;
const SECONDS = 30;
const BPM = 120;
const beat = 60 / BPM; // 0.5s
const bar = beat * 4; // 2s

const ctx = new OfflineAudioContext(2, SR * SECONDS, SR);
const mid = (n) => 440 * Math.pow(2, (n - 69) / 12); // midi → Hz

// ── master chain: glue compressor → soft-clip limiter → out ──────────────────
const master = ctx.createGain();
master.gain.value = 0.9;
const glue = ctx.createDynamicsCompressor();
glue.threshold.value = -14;
glue.knee.value = 28;
glue.ratio.value = 2.5;
glue.attack.value = 0.006;
glue.release.value = 0.18;
const limiter = ctx.createWaveShaper();
{
  const n = 1024, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 1.6);
  }
  limiter.curve = curve;
}
master.connect(glue).connect(limiter).connect(ctx.destination);

// ── reverb bus (generated impulse response) ──────────────────────────────────
function impulse(seconds, decay) {
  const len = Math.floor(SR * seconds);
  const buf = ctx.createBuffer(2, len, SR);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}
const reverb = ctx.createConvolver();
reverb.buffer = impulse(3.2, 2.6);
const reverbGain = ctx.createGain();
reverbGain.gain.value = 0.9;
reverb.connect(reverbGain).connect(master);

// tempo delay bus
const delay = ctx.createDelay();
delay.delayTime.value = beat * 0.75; // dotted-eighth
const delayFb = ctx.createGain();
delayFb.gain.value = 0.32;
const delayWet = ctx.createGain();
delayWet.gain.value = 0.28;
delay.connect(delayFb).connect(delay);
delay.connect(delayWet).connect(master);

// ── sidechained music bus (pads/bass/arp pump with the kick) ─────────────────
const pump = ctx.createGain();
pump.gain.value = 1;
pump.connect(master);
const harmonyOut = ctx.createGain();
harmonyOut.connect(pump);

// drums bypass the pump (they trigger it)
const drumsOut = ctx.createGain();
drumsOut.gain.value = 1;
drumsOut.connect(master);

// lead sits slightly above the pump for presence
const leadOut = ctx.createGain();
leadOut.gain.value = 1;
leadOut.connect(master);

// ── helpers ──────────────────────────────────────────────────────────────────
function adsr(param, t, dur, peak, a, d, s, r) {
  param.setValueAtTime(0.0001, t);
  param.exponentialRampToValueAtTime(peak, t + a);
  param.exponentialRampToValueAtTime(Math.max(0.0001, peak * s), t + a + d);
  param.setValueAtTime(Math.max(0.0001, peak * s), t + dur);
  param.exponentialRampToValueAtTime(0.0001, t + dur + r);
}

function sendTo(node, bus, amount) {
  const g = ctx.createGain();
  g.gain.value = amount;
  node.connect(g).connect(bus);
}

// Supersaw pad voice → harmony bus (+ reverb).
function pad(freq, t, dur, gain = 0.16) {
  const vca = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(500, t);
  lp.frequency.linearRampToValueAtTime(2600, t + Math.min(0.9, dur * 0.5));
  lp.frequency.linearRampToValueAtTime(900, t + dur);
  lp.Q.value = 0.6;
  for (const det of [-9, -4, 0, 5, 10]) {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = freq;
    o.detune.value = det;
    o.connect(lp);
    o.start(t);
    o.stop(t + dur + 0.5);
  }
  lp.connect(vca);
  adsr(vca.gain, t, dur, gain, 0.18, 0.25, 0.8, 0.45);
  vca.connect(harmonyOut);
  sendTo(vca, reverb, 0.5);
}

// Sub bass → harmony bus.
function bass(freq, t, dur, gain = 0.5) {
  const o = ctx.createOscillator();
  o.type = "sawtooth";
  o.frequency.value = freq;
  const sub = ctx.createOscillator();
  sub.type = "sine";
  sub.frequency.value = freq / 2;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 320;
  const vca = ctx.createGain();
  o.connect(lp);
  sub.connect(lp);
  lp.connect(vca);
  adsr(vca.gain, t, dur, gain, 0.01, 0.12, 0.75, 0.12);
  vca.connect(harmonyOut);
  o.start(t); sub.start(t);
  o.stop(t + dur + 0.2); sub.stop(t + dur + 0.2);
}

// Plucked arpeggio note → harmony + delay + reverb.
function pluck(freq, t, gain = 0.12) {
  const o = ctx.createOscillator();
  o.type = "triangle";
  o.frequency.value = freq;
  const o2 = ctx.createOscillator();
  o2.type = "sawtooth";
  o2.frequency.value = freq;
  o2.detune.value = 6;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(5200, t);
  lp.frequency.exponentialRampToValueAtTime(900, t + 0.22);
  const vca = ctx.createGain();
  o.connect(lp); o2.connect(lp); lp.connect(vca);
  adsr(vca.gain, t, 0.18, gain, 0.004, 0.1, 0.2, 0.12);
  vca.connect(harmonyOut);
  sendTo(vca, delay, 0.5);
  sendTo(vca, reverb, 0.3);
  o.start(t); o2.start(t);
  o.stop(t + 0.4); o2.stop(t + 0.4);
}

// Singing lead → lead bus + reverb + delay, with vibrato.
function lead(freq, t, dur, gain = 0.2) {
  const o = ctx.createOscillator();
  o.type = "sawtooth";
  o.frequency.value = freq;
  const o2 = ctx.createOscillator();
  o2.type = "triangle";
  o2.frequency.value = freq;
  o2.detune.value = -6;
  const vib = ctx.createOscillator();
  vib.frequency.value = 5.2;
  const vibG = ctx.createGain();
  vibG.gain.value = freq * 0.006;
  vib.connect(vibG); vibG.connect(o.frequency); vibG.connect(o2.frequency);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 3400;
  const vca = ctx.createGain();
  o.connect(lp); o2.connect(lp); lp.connect(vca);
  adsr(vca.gain, t, dur, gain, 0.03, 0.15, 0.7, 0.25);
  vca.connect(leadOut);
  sendTo(vca, reverb, 0.45);
  sendTo(vca, delay, 0.3);
  o.start(t); o2.start(t); vib.start(t);
  o.stop(t + dur + 0.3); o2.stop(t + dur + 0.3); vib.stop(t + dur + 0.3);
}

// FM-ish bell → reverb-heavy.
function bell(freq, t, gain = 0.3) {
  const car = ctx.createOscillator();
  car.frequency.value = freq;
  const modu = ctx.createOscillator();
  modu.frequency.value = freq * 2.0;
  const modG = ctx.createGain();
  modG.gain.value = freq * 1.4;
  modu.connect(modG); modG.connect(car.frequency);
  const vca = ctx.createGain();
  car.connect(vca);
  adsr(vca.gain, t, 0.05, gain, 0.005, 0.4, 0.2, 1.6);
  vca.connect(master);
  sendTo(vca, reverb, 0.8);
  car.start(t); modu.start(t);
  car.stop(t + 2.2); modu.stop(t + 2.2);
}

// Drums --------------------------------------------------------------------
function kick(t, gain = 1.0) {
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(160, t);
  o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
  const vca = ctx.createGain();
  vca.gain.setValueAtTime(gain, t);
  vca.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o.connect(vca); vca.connect(drumsOut);
  o.start(t); o.stop(t + 0.34);
  // click
  const nb = noiseBuffer(0.02);
  const ns = ctx.createBufferSource(); ns.buffer = nb;
  const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1800;
  const cg = ctx.createGain(); cg.gain.value = 0.25 * gain;
  ns.connect(hp).connect(cg).connect(drumsOut);
  ns.start(t);
  // trigger sidechain pump
  duck(t, gain);
}

function duck(t, amt = 1) {
  const depth = 0.32 * Math.min(1, amt);
  pump.gain.setValueAtTime(1 - depth, t + 0.002);
  pump.gain.linearRampToValueAtTime(1, t + 0.19);
}

function clap(t, gain = 0.5) {
  const nb = noiseBuffer(0.2);
  const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1700; bp.Q.value = 0.8;
  const vca = ctx.createGain();
  const ns = ctx.createBufferSource(); ns.buffer = nb;
  ns.connect(bp).connect(vca);
  // three quick taps + body
  vca.gain.setValueAtTime(0.0001, t);
  [0, 0.012, 0.024].forEach((o) => {
    vca.gain.setValueAtTime(gain, t + o);
    vca.gain.exponentialRampToValueAtTime(0.0001, t + o + 0.05);
  });
  vca.gain.setValueAtTime(gain, t + 0.03);
  vca.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  vca.connect(drumsOut);
  sendTo(vca, reverb, 0.35);
  ns.start(t); ns.stop(t + 0.25);
}

function hat(t, gain = 0.18, open = false) {
  const dur = open ? 0.16 : 0.04;
  const nb = noiseBuffer(dur + 0.02);
  const ns = ctx.createBufferSource(); ns.buffer = nb;
  const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 8000;
  const vca = ctx.createGain();
  vca.gain.setValueAtTime(gain, t);
  vca.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  ns.connect(hp).connect(vca).connect(drumsOut);
  ns.start(t); ns.stop(t + dur + 0.05);
}

let _noise;
function noiseBuffer(sec) {
  const len = Math.max(1, Math.floor(SR * sec));
  const b = ctx.createBuffer(1, len, SR);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

// Noise riser into time `end`.
function riser(end, dur, gain = 0.3) {
  const start = end - dur;
  const nb = noiseBuffer(dur + 0.1);
  const ns = ctx.createBufferSource(); ns.buffer = nb;
  const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(500, start);
  bp.frequency.exponentialRampToValueAtTime(6000, end);
  const vca = ctx.createGain();
  vca.gain.setValueAtTime(0.0001, start);
  vca.gain.exponentialRampToValueAtTime(gain, end);
  vca.gain.linearRampToValueAtTime(0.0001, end + 0.12);
  ns.connect(bp).connect(vca).connect(master);
  sendTo(vca, reverb, 0.4);
  ns.start(start); ns.stop(end + 0.15);
}

// Sub boom / impact.
function impact(t, gain = 0.9) {
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(90, t);
  o.frequency.exponentialRampToValueAtTime(36, t + 0.7);
  const vca = ctx.createGain();
  vca.gain.setValueAtTime(gain, t);
  vca.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
  o.connect(vca); vca.connect(master);
  sendTo(vca, reverb, 0.5);
  o.start(t); o.stop(t + 1.2);
}

// ── harmony / progression ────────────────────────────────────────────────────
// C(add9) – G – Am7 – F(add9): warm, hopeful, looping every 4 bars (8s).
const PROG = [
  { pad: [60, 64, 67, 71], bassRoot: 36, arp: [60, 64, 67, 72] }, // C
  { pad: [55, 59, 62, 67], bassRoot: 43, arp: [55, 62, 67, 71] }, // G
  { pad: [57, 60, 64, 67], bassRoot: 45, arp: [57, 60, 64, 69] }, // Am7
  { pad: [53, 57, 60, 64], bassRoot: 41, arp: [53, 57, 60, 65] }, // F
];

// Lead motif (midi, beats) over 4 bars — rises hopefully.
const MOTIF = [
  [67, 1], [69, 1], [67, 1], [64, 1],
  [62, 1], [64, 1], [62, 2],
  [60, 1], [64, 1], [69, 2],
  [67, 1], [69, 1], [72, 2],
];

const totalBars = Math.floor(SECONDS / bar); // 15

function section(b) {
  // returns flags by bar index
  if (b < 3) return { drums: 0, arp: 0.5, lead: 0, padGain: 0.12 };   // 0–6 intro
  if (b < 5) return { drums: 1, arp: 0.9, lead: 1, padGain: 0.16 };   // 6–10 reveal
  if (b < 10) return { drums: 1, arp: 1, lead: 0.7, padGain: 0.16 };  // 10–20 groove
  if (b < 13) return { drums: 1, arp: 1, lead: 1, padGain: 0.17 };    // 20–26 benefits lift
  if (b < 14) return { drums: 0.5, arp: 0.6, lead: 0, padGain: 0.16 };// 26–28 pre-resolve
  return { drums: 0, arp: 0, lead: 0, padGain: 0.18 };                // 28–30 tail
}

// schedule pads / bass / arp / drums
for (let b = 0; b < totalBars; b++) {
  const t0 = b * bar;
  const ch = PROG[b % 4];
  const s = section(b);

  for (const n of ch.pad) pad(mid(n), t0, bar, s.padGain);

  if (b >= 3 && b < 14) {
    bass(mid(ch.bassRoot), t0, beat * 1.6, 0.5);
    bass(mid(ch.bassRoot), t0 + beat * 2, beat * 1.6, 0.5);
    if (b >= 5) bass(mid(ch.bassRoot), t0 + beat * 3, beat * 0.8, 0.4);
  }

  // arpeggio: sixteenth-ish movement
  if (s.arp > 0) {
    for (let i = 0; i < 8; i++) {
      const note = ch.arp[i % ch.arp.length] + (i >= 4 ? 12 : 0);
      pluck(mid(note), t0 + i * (beat / 2), 0.1 * s.arp);
    }
  }

  // drums
  if (s.drums > 0) {
    for (let bt = 0; bt < 4; bt++) {
      kick(t0 + bt * beat, 0.95 * s.drums);
      hat(t0 + bt * beat + beat / 2, 0.14 * s.drums, bt === 3);
      hat(t0 + bt * beat + beat * 0.25, 0.07 * s.drums);
      hat(t0 + bt * beat + beat * 0.75, 0.07 * s.drums);
    }
    clap(t0 + beat, 0.45 * s.drums);
    clap(t0 + beat * 3, 0.45 * s.drums);
  }
}

// lead motif during reveal (6s) and benefits (20s)
function playMotif(startBar, gain) {
  let t = startBar * bar;
  for (const [n, d] of MOTIF) {
    lead(mid(n), t, d * beat * 0.92, gain);
    t += d * beat;
  }
}
playMotif(3, 0.2);  // from 6s
playMotif(10, 0.22); // from 20s

// story accents
impact(0.0, 0.5);
riser(6.0, 1.2, 0.32);
impact(6.0, 0.95);
bell(mid(84), 6.0, 0.32); // C6 sparkle at reveal
bell(mid(79), 10.0, 0.22); // into how-it-works
riser(20.0, 0.9, 0.22);
riser(27.0, 0.6, 0.2);
impact(27.0, 0.9);
bell(mid(88), 27.0, 0.34); // E6 final lockup
bell(mid(84), 27.0, 0.28);

// master fades
master.gain.setValueAtTime(0.0001, 0);
master.gain.exponentialRampToValueAtTime(0.9, 0.5);
master.gain.setValueAtTime(0.9, SECONDS - 2.4);
master.gain.linearRampToValueAtTime(0.0001, SECONDS - 0.05);

// ── render & write WAV ────────────────────────────────────────────────────────
const rendered = await ctx.startRendering();
const left = rendered.getChannelData(0);
const right = rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : left;

function writeWav(path, l, r) {
  const channels = 2, bps = 2, dataLen = l.length * channels * bps;
  const buf = Buffer.alloc(44 + dataLen);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + dataLen, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(channels, 22); buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * channels * bps, 28); buf.writeUInt16LE(channels * bps, 32);
  buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(dataLen, 40);
  let off = 44;
  for (let i = 0; i < l.length; i++) {
    const a = Math.max(-1, Math.min(1, l[i]));
    const b = Math.max(-1, Math.min(1, r[i]));
    buf.writeInt16LE((a * 32767) | 0, off); off += 2;
    buf.writeInt16LE((b * 32767) | 0, off); off += 2;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
}

const out = new URL("../public/audio/soundtrack.wav", import.meta.url).pathname;
writeWav(out, left, right);
console.log(`Wrote ${out} (${SECONDS}s @ ${BPM} BPM, ${SR}Hz stereo, Web Audio render)`);
