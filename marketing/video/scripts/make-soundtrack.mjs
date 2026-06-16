// Original, royalty-free soundtrack for the Lumi promo v2 — modern melodic
// future-bass, rendered offline with a real Web Audio engine (node-web-audio-api).
//
// Direction (see marketing/video/V2-BRIEF.md "Music direction"):
//   warm/optimistic future-bass, 120 BPM, key F major,
//   progression  F(add9) – Am7 – Dm7 – Bb(maj9)  (I–iii–vi–IV), resolving to F.
//   Gated supersaws, a 3-note "spark" hook (A→C→D), half-time drums, a clean
//   sine sub + saturated mid-bass, a 16th gated arp, convolution reverb, slap
//   delay, multi-bus sidechain, and a proper glue→limiter master.
//
// 120 BPM (15 video frames / beat, 60 / 2s bar) so scene cuts stay locked to the
// music. Arrangement matches the video: sparse intro → ~1.5s near-silence drop →
// ignition/reveal @6s → groove (hook answers the arp) → benefits lift @20s →
// final impact + hook resolving to F @27s → fade tail by 30s.
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

// ── master chain ─────────────────────────────────────────────────────────────
// glue comp → makeup → brickwall-ish limiter (ratio 20, fast attack) → tanh ceil
const master = ctx.createGain();
master.gain.value = 0.62;

const glue = ctx.createDynamicsCompressor();
glue.threshold.value = -16;
glue.knee.value = 24;
glue.ratio.value = 2.5;
glue.attack.value = 0.008;
glue.release.value = 0.18;

const makeup = ctx.createGain();
makeup.gain.value = 1.5; // recover the glue gain reduction

const brick = ctx.createDynamicsCompressor();
brick.threshold.value = -1.5;
brick.knee.value = 0;
brick.ratio.value = 20;
brick.attack.value = 0.0008;
brick.release.value = 0.05;

const ceiling = ctx.createWaveShaper();
{
  const n = 2048, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 1.25) / Math.tanh(1.25); // gentle safety ceiling
  }
  ceiling.curve = curve;
  ceiling.oversample = "4x";
}
const outTrim = ctx.createGain();
outTrim.gain.value = 0.89; // ~−1 dBTP true-peak headroom
master.connect(glue).connect(makeup).connect(brick).connect(ceiling).connect(outTrim).connect(ctx.destination);

// ── reverb bus (tighter ~1.8s IR, high-passed return) ────────────────────────
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
reverb.buffer = impulse(1.8, 3.0);
const reverbHP = ctx.createBiquadFilter();
reverbHP.type = "highpass";
reverbHP.frequency.value = 300; // clear the mud out of the tail
const reverbGain = ctx.createGain();
reverbGain.gain.value = 0.36; // lower send (~0.3–0.4)
reverb.connect(reverbHP).connect(reverbGain).connect(master);

// ── slap / tempo delay bus ───────────────────────────────────────────────────
const delay = ctx.createDelay();
delay.delayTime.value = beat * 0.75; // dotted-eighth slap
const delayFb = ctx.createGain();
delayFb.gain.value = 0.3;
const delayWet = ctx.createGain();
delayWet.gain.value = 0.26;
const delayHP = ctx.createBiquadFilter();
delayHP.type = "highpass";
delayHP.frequency.value = 350;
delay.connect(delayFb).connect(delay);
delay.connect(delayHP).connect(delayWet).connect(master);

// ── multi-bus sidechain ──────────────────────────────────────────────────────
// pads: deep + slow duck.  bass: fast + shallow duck.  lead/drums: un-ducked.
const padPump = ctx.createGain();
padPump.gain.value = 1;
padPump.connect(master);

const bassPump = ctx.createGain();
bassPump.gain.value = 1;
bassPump.connect(master);

// pads/arp/hook flow through padPump; bass flows through bassPump
const padOut = ctx.createGain();
padOut.connect(padPump);
const arpOut = ctx.createGain();
arpOut.connect(padPump);
const hookOut = ctx.createGain();
hookOut.connect(padPump);
const bassBus = ctx.createGain();
bassBus.connect(bassPump);

// drums bypass the pumps (they trigger them)
const drumsOut = ctx.createGain();
drumsOut.gain.value = 1;
drumsOut.connect(master);

// FX (risers, impacts, ignition transients) un-ducked
const fxOut = ctx.createGain();
fxOut.connect(master);

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

// tanh waveshaper curve factory (reusable saturation)
function tanhCurve(drive) {
  const n = 1024, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * drive) / Math.tanh(drive);
  }
  return curve;
}
const _tanhCache = {};
function shaper(drive) {
  const key = drive.toFixed(2);
  if (!_tanhCache[key]) _tanhCache[key] = tanhCurve(drive);
  const ws = ctx.createWaveShaper();
  ws.curve = _tanhCache[key];
  ws.oversample = "2x";
  return ws;
}

let _noiseCache = {};
function noiseBuffer(sec) {
  const len = Math.max(1, Math.floor(SR * sec));
  const b = ctx.createBuffer(1, len, SR);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

// ── duck helpers (per-bus sidechain) ─────────────────────────────────────────
function duckPads(t, amt = 1) {
  const depth = 0.55 * Math.min(1, amt); // deep
  padPump.gain.setValueAtTime(1 - depth, t + 0.003);
  padPump.gain.linearRampToValueAtTime(1, t + 0.32); // slow recovery
}
function duckBass(t, amt = 1) {
  const depth = 0.3 * Math.min(1, amt); // shallow
  bassPump.gain.setValueAtTime(1 - depth, t + 0.002);
  bassPump.gain.linearRampToValueAtTime(1, t + 0.14); // fast recovery
}

// ── gated supersaw chord (future-bass signature) ─────────────────────────────
// 7 detuned voices ±20–30c, hard-panned (octave "air" layer added separately),
// light tanh saturation, a mostly-fixed lowpass, and rhythmic 8th/16th gating.
function supersaw(freqs, t, dur, gain, opts = {}) {
  const {
    gate = null,        // array of [onset(beats), len(beats)] within dur, or null = sustained
    cutoff = 2200,      // fixed lowpass
    air = true,         // octave-up sine "air" layer
    drive = 1.6,        // tanh saturation amount
    hp = 170,           // high-pass to keep lows for the bass
  } = opts;

  const sat = shaper(drive);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = cutoff;
  lp.Q.value = 0.7;
  const hpf = ctx.createBiquadFilter();
  hpf.type = "highpass";
  hpf.frequency.value = hp;

  // 7 detuned voices per chord note, hard-panned for width
  const detunes = [-28, -18, -9, 0, 9, 18, 28];
  const pans = [-0.95, -0.6, -0.3, 0, 0.3, 0.6, 0.95];
  freqs.forEach((freq) => {
    detunes.forEach((det, vi) => {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = freq;
      o.detune.value = det;
      const p = ctx.createStereoPanner();
      p.pan.value = pans[vi];
      o.connect(p).connect(sat);
      o.start(t);
      o.stop(t + dur + 0.4);
    });
    if (air) {
      const oa = ctx.createOscillator();
      oa.type = "sine";
      oa.frequency.value = freq * 2; // octave-up air
      const ag = ctx.createGain();
      ag.gain.value = 0.18;
      oa.connect(ag).connect(sat);
      oa.start(t);
      oa.stop(t + dur + 0.4);
    }
  });

  sat.connect(lp).connect(hpf);
  const vca = ctx.createGain();
  hpf.connect(vca);

  if (gate) {
    // rhythmic gating: each [onset,len] is an amplitude burst
    vca.gain.setValueAtTime(0.0001, t);
    for (const [on, len] of gate) {
      const gt = t + on * beat;
      const gd = len * beat;
      vca.gain.setValueAtTime(0.0001, gt);
      vca.gain.exponentialRampToValueAtTime(gain, gt + 0.008);
      vca.gain.setValueAtTime(gain, gt + gd * 0.6);
      vca.gain.exponentialRampToValueAtTime(0.0001, gt + gd);
    }
  } else {
    adsr(vca.gain, t, dur, gain, 0.22, 0.3, 0.85, 0.5);
  }

  vca.connect(padOut);
  sendTo(vca, reverb, 0.34);
}

// ── intro swell pad (heavily LP'd, no gate) ──────────────────────────────────
function swellPad(freqs, t, dur, gain) {
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(380, t);
  lp.frequency.linearRampToValueAtTime(700, t + dur * 0.6);
  lp.Q.value = 0.5;
  const vca = ctx.createGain();
  freqs.forEach((freq) => {
    for (const det of [-7, 0, 7]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = freq;
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.4);
    }
  });
  lp.connect(vca);
  adsr(vca.gain, t, dur, gain, 0.9, 0.6, 0.9, 1.0);
  vca.connect(padOut);
  sendTo(vca, reverb, 0.4);
}

// ── bass: clean sine sub (mono) + saturated mid-bass (saw→tanh→bandpass) ──────
function bass(freq, t, dur, gain = 0.5) {
  // sub — clean sine, mono
  const sub = ctx.createOscillator();
  sub.type = "sine";
  sub.frequency.value = freq;
  const subG = ctx.createGain();
  sub.connect(subG);
  adsr(subG.gain, t, dur, gain, 0.012, 0.12, 0.78, 0.12);
  subG.connect(bassBus);

  // mid-bass — saw → tanh → bandpass 120–400Hz (phone audibility), mono
  const o = ctx.createOscillator();
  o.type = "sawtooth";
  o.frequency.value = freq;
  const sat = shaper(2.4);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 240;
  bp.Q.value = 0.7;
  const midG = ctx.createGain();
  o.connect(sat).connect(bp).connect(midG);
  adsr(midG.gain, t, dur, gain * 0.45, 0.012, 0.1, 0.7, 0.12);
  midG.connect(bassBus);

  sub.start(t); o.start(t);
  sub.stop(t + dur + 0.2); o.stop(t + dur + 0.2);
}

// ── 16th gated arp pluck → arp bus + delay + reverb ──────────────────────────
function pluck(freq, t, gain = 0.1, pan = 0.4) {
  const o = ctx.createOscillator();
  o.type = "triangle";
  o.frequency.value = freq;
  const o2 = ctx.createOscillator();
  o2.type = "sawtooth";
  o2.frequency.value = freq;
  o2.detune.value = 8;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(5400, t);
  lp.frequency.exponentialRampToValueAtTime(1100, t + 0.18);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 180;
  const vca = ctx.createGain();
  const p = ctx.createStereoPanner();
  p.pan.value = pan;
  o.connect(lp); o2.connect(lp); lp.connect(hp).connect(vca).connect(p);
  adsr(vca.gain, t, 0.14, gain, 0.004, 0.08, 0.18, 0.1);
  p.connect(arpOut);
  sendTo(vca, delay, 0.4);
  sendTo(vca, reverb, 0.26);
  o.start(t); o2.start(t);
  o.stop(t + 0.36); o2.stop(t + 0.36);
}

// ── THE HOOK — 3-note rising spark motif A→C→D (dotted feel) ──────────────────
// 2 detuned saws + triangle, light vibrato, pluck→sustain, slap-delay, reverb.
// octaveShift in semitones; on the drop & CTA we double it an octave up with a
// bell/FM layer (passed via opts.bell).
const HOOK = [
  // [midi, onset(beats), len(beats)] — dotted, rising. A4=69 C5=72 D5=74
  [69, 0.0, 1.5],
  [72, 1.5, 1.0],
  [74, 2.5, 1.5],
];
function hookNote(midiNote, t, len, gain, pan, withBell) {
  const freq = mid(midiNote);
  const o = ctx.createOscillator();
  o.type = "sawtooth";
  o.frequency.value = freq;
  o.detune.value = -8;
  const o2 = ctx.createOscillator();
  o2.type = "sawtooth";
  o2.frequency.value = freq;
  o2.detune.value = 8;
  const o3 = ctx.createOscillator();
  o3.type = "triangle";
  o3.frequency.value = freq;
  // light vibrato
  const vib = ctx.createOscillator();
  vib.frequency.value = 5.0;
  const vibG = ctx.createGain();
  vibG.gain.value = freq * 0.005;
  vib.connect(vibG);
  vibG.connect(o.frequency); vibG.connect(o2.frequency); vibG.connect(o3.frequency);

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 4200;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 180;
  const vca = ctx.createGain();
  const p = ctx.createStereoPanner();
  p.pan.value = pan;
  o.connect(lp); o2.connect(lp); o3.connect(lp);
  lp.connect(hp).connect(vca).connect(p);
  // pluck → sustain
  adsr(vca.gain, t, len * beat, gain, 0.01, 0.12, 0.7, 0.3);
  p.connect(hookOut);
  sendTo(vca, delay, 0.45);
  sendTo(vca, reverb, 0.3);
  o.start(t); o2.start(t); o3.start(t); vib.start(t);
  const end = t + len * beat + 0.4;
  o.stop(end); o2.stop(end); o3.stop(end); vib.stop(end);

  if (withBell) {
    // bell/FM layer an octave up (drop & CTA only)
    const car = ctx.createOscillator();
    car.frequency.value = freq * 2;
    const modu = ctx.createOscillator();
    modu.frequency.value = freq * 2 * 2.0;
    const modG = ctx.createGain();
    modG.gain.value = freq * 2 * 1.2;
    modu.connect(modG); modG.connect(car.frequency);
    const bg = ctx.createGain();
    car.connect(bg);
    adsr(bg.gain, t, 0.05, gain * 0.5, 0.005, 0.35, 0.15, 0.9);
    bg.connect(hookOut);
    sendTo(bg, reverb, 0.5);
    car.start(t); modu.start(t);
    car.stop(t + 1.4); modu.stop(t + 1.4);
  }
}

// reusable: play the full hook motif starting at time t
function playHook(t, octaveShift = 0, gain = 0.2, opts = {}) {
  const { pan = -0.35, bell = false } = opts;
  for (const [n, on, len] of HOOK) {
    hookNote(n + octaveShift, t + on * beat, len, gain, pan, bell);
  }
}

// ── drums (half-time) ────────────────────────────────────────────────────────
function kick(t, gain = 1.0) {
  // bottom ~55–60Hz
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(57, t + 0.1);
  const og = ctx.createGain();
  og.gain.setValueAtTime(gain, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
  o.connect(og); og.connect(drumsOut);
  o.start(t); o.stop(t + 0.36);
  // 200Hz body
  const b = ctx.createOscillator();
  b.frequency.setValueAtTime(220, t);
  b.frequency.exponentialRampToValueAtTime(150, t + 0.05);
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(gain * 0.5, t);
  bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  b.connect(bg); bg.connect(drumsOut);
  b.start(t); b.stop(t + 0.16);
  // click transient
  const ns = ctx.createBufferSource(); ns.buffer = noiseBuffer(0.02);
  const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2400;
  const cg = ctx.createGain(); cg.gain.value = 0.3 * gain;
  ns.connect(hp).connect(cg).connect(drumsOut);
  ns.start(t);
  // trigger both sidechains
  duckPads(t, gain);
  duckBass(t, gain);
}

function clap(t, gain = 0.5) {
  // clap + snare layer on beat 3
  const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1700; bp.Q.value = 0.8;
  const vca = ctx.createGain();
  const ns = ctx.createBufferSource(); ns.buffer = noiseBuffer(0.22);
  ns.connect(bp).connect(vca);
  vca.gain.setValueAtTime(0.0001, t);
  [0, 0.011, 0.022].forEach((o) => {
    vca.gain.setValueAtTime(gain, t + o);
    vca.gain.exponentialRampToValueAtTime(0.0001, t + o + 0.045);
  });
  vca.gain.setValueAtTime(gain, t + 0.028);
  vca.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
  vca.connect(drumsOut);
  sendTo(vca, reverb, 0.3);
  ns.start(t); ns.stop(t + 0.26);
  // snare body (tone + noise)
  const tone = ctx.createOscillator();
  tone.type = "triangle";
  tone.frequency.setValueAtTime(190, t);
  tone.frequency.exponentialRampToValueAtTime(140, t + 0.08);
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(gain * 0.4, t);
  tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  tone.connect(tg).connect(drumsOut);
  tone.start(t); tone.stop(t + 0.14);
}

function hat(t, gain = 0.16, open = false) {
  const dur = open ? 0.15 : 0.04;
  const ns = ctx.createBufferSource(); ns.buffer = noiseBuffer(dur + 0.02);
  const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 8500;
  const vca = ctx.createGain();
  vca.gain.setValueAtTime(gain, t);
  vca.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  ns.connect(hp).connect(vca).connect(drumsOut);
  ns.start(t); ns.stop(t + dur + 0.05);
}

// ghost shaker / perc 16ths
function shaker(t, gain = 0.06) {
  const ns = ctx.createBufferSource(); ns.buffer = noiseBuffer(0.03);
  const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 6000;
  const vca = ctx.createGain();
  vca.gain.setValueAtTime(gain, t);
  vca.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  ns.connect(hp).connect(vca).connect(drumsOut);
  ns.start(t); ns.stop(t + 0.06);
}

// snare fill (into CTA ~24s)
function fill(t, beats, gain = 0.4) {
  const steps = beats * 4; // 16ths
  for (let i = 0; i < steps; i++) {
    const st = t + i * (beat / 4);
    const v = gain * (0.5 + 0.5 * (i / steps)); // crescendo
    const ns = ctx.createBufferSource(); ns.buffer = noiseBuffer(0.05);
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1800; bp.Q.value = 0.9;
    const vca = ctx.createGain();
    vca.gain.setValueAtTime(v, st);
    vca.gain.exponentialRampToValueAtTime(0.0001, st + 0.08);
    ns.connect(bp).connect(vca).connect(drumsOut);
    ns.start(st); ns.stop(st + 0.1);
  }
}

// ── FX: risers, impacts, ignition transients ─────────────────────────────────
function riser(end, dur, gain = 0.3) {
  const start = end - dur;
  const ns = ctx.createBufferSource(); ns.buffer = noiseBuffer(dur + 0.1);
  const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(500, start);
  bp.frequency.exponentialRampToValueAtTime(6500, end);
  const vca = ctx.createGain();
  vca.gain.setValueAtTime(0.0001, start);
  vca.gain.exponentialRampToValueAtTime(gain, end);
  vca.gain.linearRampToValueAtTime(0.0001, end + 0.12);
  ns.connect(bp).connect(vca).connect(fxOut);
  sendTo(vca, reverb, 0.4);
  ns.start(start); ns.stop(end + 0.15);
}

function impact(t, gain = 0.9) {
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(85, t);
  o.frequency.exponentialRampToValueAtTime(36, t + 0.7);
  const vca = ctx.createGain();
  vca.gain.setValueAtTime(gain, t);
  vca.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
  o.connect(vca); vca.connect(fxOut);
  sendTo(vca, reverb, 0.45);
  o.start(t); o.stop(t + 1.1);
}

// signature "ignition" transient — soft bell + pluck, ~150ms.
function ignition(t, midiNote, gain = 0.3) {
  const freq = mid(midiNote);
  // bell
  const car = ctx.createOscillator();
  car.frequency.value = freq;
  const modu = ctx.createOscillator();
  modu.frequency.value = freq * 3.0;
  const modG = ctx.createGain();
  modG.gain.value = freq * 2.0;
  modu.connect(modG); modG.connect(car.frequency);
  const bg = ctx.createGain();
  car.connect(bg);
  bg.gain.setValueAtTime(0.0001, t);
  bg.gain.exponentialRampToValueAtTime(gain, t + 0.006);
  bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  bg.connect(fxOut);
  sendTo(bg, reverb, 0.5);
  car.start(t); modu.start(t);
  car.stop(t + 0.22); modu.stop(t + 0.22);
  // pluck spark
  const o = ctx.createOscillator();
  o.type = "triangle";
  o.frequency.value = freq * 2;
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass";
  lp.frequency.setValueAtTime(7000, t);
  lp.frequency.exponentialRampToValueAtTime(1500, t + 0.12);
  const pg = ctx.createGain();
  pg.gain.setValueAtTime(0.0001, t);
  pg.gain.exponentialRampToValueAtTime(gain * 0.6, t + 0.004);
  pg.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  o.connect(lp).connect(pg).connect(fxOut);
  sendTo(pg, delay, 0.3);
  o.start(t); o.stop(t + 0.18);
}

// ── harmony / progression — F major ──────────────────────────────────────────
// F(add9) – Am7 – Dm7 – Bb(maj9), looping every 4 bars (8s). MIDI: F4=65.
const PROG = [
  { pad: [65, 69, 72, 79], bassRoot: 41, arp: [65, 69, 72, 79] }, // F(add9): F A C G(9)
  { pad: [69, 72, 76, 79], bassRoot: 45, arp: [69, 72, 76, 79] }, // Am7: A C E G
  { pad: [62, 65, 69, 72], bassRoot: 38, arp: [62, 65, 69, 72] }, // Dm7: D F A C
  { pad: [70, 74, 77, 81], bassRoot: 46, arp: [70, 74, 77, 81] }, // Bb(maj9): Bb D F C(9)
];
// CTA resolves to F — final bars use F.
const F_CHORD = { pad: [65, 69, 72, 77], bassRoot: 41, arp: [65, 69, 72, 77] };

const totalBars = Math.floor(SECONDS / bar); // 15

// 8th/16th gate patterns (onset, len in beats) over a 2s bar — future-bass chop
const GATE_8TH = [
  [0, 0.5], [0.5, 0.5], [1.5, 0.5], [2, 0.5], [2.5, 0.5], [3, 0.5], [3.5, 0.5],
];
const GATE_16TH = [
  [0, 0.25], [0.5, 0.25], [0.75, 0.25], [1, 0.25], [1.5, 0.5], [2, 0.25],
  [2.25, 0.25], [2.75, 0.25], [3, 0.25], [3.5, 0.5],
];

function section(b) {
  // returns arrangement flags by bar index (bar = 2s)
  if (b < 3) return { phase: "intro", drums: 0, arp: 0, padGain: 0.0 };       // 0–6 intro
  if (b < 5) return { phase: "drop", drums: 1, arp: 0.6, padGain: 0.14 };     // 6–10 drop/reveal
  if (b < 10) return { phase: "groove", drums: 1, arp: 1, padGain: 0.13 };    // 10–20 groove
  if (b < 13) return { phase: "lift", drums: 1, arp: 1, padGain: 0.15 };      // 20–26 benefits lift
  if (b < 14) return { phase: "pre", drums: 0.5, arp: 0.4, padGain: 0.14 };   // 26–28 CTA
  return { phase: "tail", drums: 0, arp: 0, padGain: 0.16 };                  // 28–30 tail
}

// schedule pads / bass / arp / drums per bar
for (let b = 0; b < totalBars; b++) {
  const t0 = b * bar;
  let ch = PROG[b % 4];
  const s = section(b);

  // resolve to F under the CTA (bars 13+)
  if (b >= 13) ch = F_CHORD;

  if (s.phase === "intro") {
    // heavily-LP'd swell pad for the 0–6s intro (one long swell per 2 bars)
    if (b === 0) swellPad(PROG[0].pad.map(mid), 0, bar * 2.6, 0.12);
    // carve a ~1.5s near-silence drop right before the 6s reveal (bar 3 = 6s):
    // we simply do NOT sound the last intro bar's tail — handled by stopping
    // the swell before 6s via its release. Tease single hook notes:
    if (b === 0) hookNote(69, beat * 1, 1.0, 0.14, -0.3, false); // A4 tease
    if (b === 1) hookNote(72, t0 + beat * 1, 1.0, 0.13, -0.3, false); // C5 tease
    // bar 2 (4–6s) is left sparse → the near-silence drop into the reveal
  } else if (s.phase !== "tail") {
    // gated supersaw chords (8th in groove/lift; opened lowpass at the drop)
    const gate = s.phase === "groove" ? GATE_16TH : GATE_8TH;
    const cutoff = s.phase === "drop" ? 3200 : (s.phase === "lift" ? 3000 : 2400);
    supersaw(ch.pad.map(mid), t0, bar, s.padGain, {
      gate, cutoff, drive: 1.7, air: true, hp: 180,
    });

    // bass — half-time: notes on beats 1 & 3
    bass(mid(ch.bassRoot), t0, beat * 1.7, 0.5);
    bass(mid(ch.bassRoot), t0 + beat * 2, beat * 1.7, 0.5);
  }

  // 16th gated arp counter-melody (panned opposite the hook = right)
  if (s.arp > 0) {
    for (let i = 0; i < 16; i++) {
      // swing the off-16ths slightly
      const swing = i % 2 === 1 ? 0.02 : 0;
      const note = ch.arp[i % ch.arp.length] + (i >= 8 ? 12 : 0);
      pluck(mid(note), t0 + i * (beat / 4) + swing, 0.085 * s.arp, 0.5);
    }
  }

  // drums — half-time (kick on 1 & 3, clap/snare on 3)
  if (s.drums > 0) {
    kick(t0 + 0 * beat, 0.98 * s.drums);
    kick(t0 + 2 * beat, 0.98 * s.drums);
    clap(t0 + 2 * beat, 0.5 * s.drums); // beat 3
    // swung, velocity-varied hats on 8ths
    for (let i = 0; i < 8; i++) {
      const off = i % 2 === 1 ? beat * 0.08 : 0; // swing
      const open = i === 7;
      const vel = 0.1 + (i % 4 === 2 ? 0.06 : 0) + Math.random() * 0.03;
      hat(t0 + i * (beat / 2) + off, vel * s.drums, open);
    }
    // ghost shaker/perc 16ths during 11–20s (bars 5–9)
    if (b >= 5 && b < 10) {
      for (let i = 0; i < 16; i++) {
        if (i % 2 === 1) shaker(t0 + i * (beat / 4), 0.05);
      }
    }
  }
}

// ── hook placement ───────────────────────────────────────────────────────────
// intro single-note teases handled above. Full hook on the 6s drop;
// hook answers the arp through 11–20s; hook +octave on the 27s CTA → F.
playHook(6.0, 0, 0.22, { pan: -0.35, bell: true });        // full hook on the drop (+bell)
playHook(12.0, 0, 0.18, { pan: -0.4 });                    // answers the arp (groove)
playHook(16.0, 0, 0.18, { pan: -0.4 });                    // call-and-response
playHook(20.0, 0, 0.2, { pan: -0.35 });                    // benefits lift
playHook(27.0, 12, 0.22, { pan: -0.3, bell: true });       // CTA +octave (+bell), over F

// ── sync FX / accents ────────────────────────────────────────────────────────
// (the ~1.5s near-silence drop before 6s is created by the sparse 4–6s window)
impact(0.0, 0.4);                 // soft opening swell impact

// ignition transient on the reveal/ignition (6s) + montage word-ignitions
// rising in pitch through 11–17s
ignition(6.0, 81, 0.34);          // reveal ignition (A5)
ignition(11.0, 77, 0.26);         // F5
ignition(13.0, 81, 0.28);         // A5
ignition(15.0, 84, 0.3);          // C6
ignition(17.0, 86, 0.32);         // D6 (rising)

riser(6.0, 1.4, 0.3);             // riser → impact into the 6s reveal
impact(6.0, 0.9);

riser(20.0, 1.0, 0.26);           // riser → impact into the 20s benefits lift
impact(20.0, 0.8);

fill(24.0, 1, 0.42);              // brief snare fill into the CTA (~24s)

riser(27.0, 0.7, 0.22);           // impact + final hook on the 27s CTA
impact(27.0, 0.9);

// ── master fades ─────────────────────────────────────────────────────────────
master.gain.setValueAtTime(0.0001, 0);
master.gain.exponentialRampToValueAtTime(0.62, 0.6);
master.gain.setValueAtTime(0.62, SECONDS - 2.6);
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
    const bb = Math.max(-1, Math.min(1, r[i]));
    buf.writeInt16LE((a * 32767) | 0, off); off += 2;
    buf.writeInt16LE((bb * 32767) | 0, off); off += 2;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
}

const out = new URL("../public/audio/soundtrack.wav", import.meta.url).pathname;
writeWav(out, left, right);
console.log(`Wrote ${out} (${SECONDS}s @ ${BPM} BPM, F major future-bass, ${SR}Hz stereo, Web Audio render)`);
