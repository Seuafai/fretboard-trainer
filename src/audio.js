import { useCallback, useEffect, useRef, useState } from "react";

// time-domain autocorrelation pitch detector with the classic McLeod-style
// trim + parabolic interpolation. Returns freq, clarity (0..1) and rms.
export function autoCorrelate(buf, sampleRate) {
  const SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.004) return { freq: null, clarity: 0, rms };

  let r1 = 0,
    r2 = SIZE - 1;
  const thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buf[i]) < thres) {
      r1 = i;
      break;
    }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buf[SIZE - i]) < thres) {
      r2 = SIZE - i;
      break;
    }
  }
  const trimmed = buf.slice(r1, r2);
  const n = trimmed.length;
  if (n < 8) return { freq: null, clarity: 0, rms };
  const c = new Float32Array(n);
  for (let lag = 0; lag < n; lag++) {
    let sum = 0;
    for (let i = 0; i < n - lag; i++) sum += trimmed[i] * trimmed[i + lag];
    c[lag] = sum;
  }
  let d = 0;
  while (d < n - 1 && c[d] > c[d + 1]) d++;
  let maxVal = -1,
    maxPos = -1;
  for (let i = d; i < n; i++) {
    if (c[i] > maxVal) {
      maxVal = c[i];
      maxPos = i;
    }
  }
  if (maxPos <= 0) return { freq: null, clarity: 0, rms };
  const x1 = c[maxPos - 1] ?? c[maxPos];
  const x2 = c[maxPos];
  const x3 = c[maxPos + 1] ?? c[maxPos];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  let T0 = maxPos;
  if (a) T0 = maxPos - b / (2 * a);
  const freq = sampleRate / T0;
  const clarity = c[0] ? maxVal / c[0] : 0;
  // cap covers the whole 24-fret neck: high-e fret 24 ≈ 1319 Hz. Fundamentals above
  // this are ignored on purpose (we only want notes actually on the neck).
  if (freq < 55 || freq > 1400) return { freq: null, clarity: 0, rms };
  return { freq, clarity, rms };
}

// harmonic profile of a tone: the amplitudes of harmonics 2..6 relative to the
// fundamental. Guitar strings have a recognizable decay shape here; synthesised
// tones (a TV, a beep) don't, which is how we tell them apart.
export function extractFingerprint(freqBytes, f0, sampleRate, fftSize) {
  const binHz = sampleRate / fftSize;
  const ampAt = (f) => {
    const bin = Math.round(f / binHz);
    let best = 0;
    for (let k = Math.max(0, bin - 2); k <= bin + 2 && k < freqBytes.length; k++) {
      best = Math.max(best, freqBytes[k]);
    }
    return best;
  };
  const a1 = ampAt(f0) || 1;
  const ratios = [];
  for (let k = 2; k <= 6; k++) ratios.push(ampAt(f0 * k) / a1);
  return ratios;
}

// ---------- mic hook ----------

export function useMic() {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const ctxRef = useRef(null);
  const timeAnalyserRef = useRef(null);
  const freqAnalyserRef = useRef(null);
  const streamRef = useRef(null);
  const timeBufRef = useRef(null);
  const freqBufRef = useRef(null);

  const start = useCallback(async () => {
    if (ctxRef.current) return true;
    setStatus("requesting");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
          // non-standard flags some Chromium builds honor to disable extra processing
          googEchoCancellation: false,
          googAutoGainControl: false,
          googNoiseSuppression: false,
          googHighpassFilter: false,
        },
      });
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const source = ctx.createMediaStreamSource(stream);
      const timeAnalyser = ctx.createAnalyser();
      timeAnalyser.fftSize = 4096;
      const freqAnalyser = ctx.createAnalyser();
      freqAnalyser.fftSize = 8192;
      freqAnalyser.smoothingTimeConstant = 0;
      source.connect(timeAnalyser);
      source.connect(freqAnalyser);

      ctxRef.current = ctx;
      timeAnalyserRef.current = timeAnalyser;
      freqAnalyserRef.current = freqAnalyser;
      streamRef.current = stream;
      timeBufRef.current = new Float32Array(timeAnalyser.fftSize);
      freqBufRef.current = new Uint8Array(freqAnalyser.frequencyBinCount);
      setStatus("active");
      return true;
    } catch (e) {
      setError(e && e.message ? e.message : "Microphone access denied");
      setStatus("error");
      return false;
    }
  }, []);

  const stop = useCallback(() => {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    if (ctxRef.current) ctxRef.current.close().catch(() => {});
    ctxRef.current = null;
    timeAnalyserRef.current = null;
    freqAnalyserRef.current = null;
    streamRef.current = null;
    setStatus("idle");
  }, []);

  const sample = useCallback(() => {
    const ctx = ctxRef.current;
    const timeAnalyser = timeAnalyserRef.current;
    const freqAnalyser = freqAnalyserRef.current;
    if (!ctx || !timeAnalyser || !freqAnalyser) return null;
    const buf = timeBufRef.current;
    timeAnalyser.getFloatTimeDomainData(buf);
    const { freq, clarity, rms } = autoCorrelate(buf, ctx.sampleRate);
    const confident = !!freq && clarity >= 0.7;
    if (!freq) return { freq: null, clarity, rms, confident: false, fingerprint: null };
    const freqBytes = freqBufRef.current;
    freqAnalyser.getByteFrequencyData(freqBytes);
    const fingerprint = extractFingerprint(freqBytes, freq, ctx.sampleRate, freqAnalyser.fftSize);
    return { freq, clarity, rms, confident, fingerprint };
  }, []);

  useEffect(() => () => stop(), [stop]);
  return { status, error, start, stop, sample };
}

// ---------- guitar synthesis & scale playback ----------

// Plucks a guitar-like note with Karplus–Strong synthesis. The plucked-string
// waveform is computed sample-by-sample in JS: a windowed noise burst (the pick)
// circulates through a delay of exactly one string period, with a one-pole lowpass
// that closes over the note's life (the "darkening" a string's stiffness produces)
// and a per-sample damping so the note rings out naturally. The period is fractional
// and the delay read is interpolated, so the pitch is sample-accurate on every fret.
// Computing the loop in JS instead of with a DelayNode feedback graph keeps the sound
// deterministic and exact, and sidesteps per-browser feedback-cycle quirks. No samples
// required.

let synthCtx = null;
let playback = null; // { master, endAt } of the currently scheduled run

export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function getSynthCtx() {
  if (!synthCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    synthCtx = new Ctx();
  }
  if (synthCtx.state === "suspended") synthCtx.resume().catch(() => {});
  return synthCtx;
}

// one-pole lowpass coefficient for a cutoff frequency in Hz
function lowpassCoeff(sr, fc) {
  return Math.exp((-2 * Math.PI * fc) / sr);
}

function pluck(ctx, freq, when, duration, out) {
  if (!Number.isFinite(freq) || !Number.isFinite(when)) return; // never schedule a bad note
  const sr = ctx.sampleRate;
  const period = sr / freq; // fractional string period in samples
  const N = Math.max(2, Math.round(period));
  const total = Math.ceil(sr * duration) + N;
  const wave = new Float32Array(total);

  // the pick: one string-period of softly-filtered noise, windowed so the attack
  // has no hard edges (hard edges are what click).
  let lp = 0;
  for (let i = 0; i < N; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i + 0.5)) / N); // Hann window
    const n = Math.random() * 2 - 1;
    lp += 0.4 * (n - lp);
    wave[i] = (n * 0.6 + lp * 0.4) * w;
  }

  // the string: the KS loop, reading one period behind the write with interpolation
  // for exact pitch, damping each pass so the note dies out around `duration`, and a
  // lowpass that closes from bright to warm — low strings stay warm, high strings open
  // up and then darken like a real pluck.
  const perSampleDecay = Math.pow(0.002, 1 / (duration * sr));
  const start = Math.ceil(period); // the string starts ringing one period in
  // pass 1 — the string: a pure delay line, reading one period behind the write with
  // interpolation for exact pitch. Nothing else in the loop: any filtering here would
  // add phase lag and pull the note flat (a lot, up high). Damping is just a gain.
  for (let t = start; t < total; t++) {
    const r = t - period;
    const r0 = Math.floor(r);
    const frac = r - r0;
    const a = wave[r0];
    const b = wave[r0 + 1] ?? a;
    wave[t] = (a + (b - a) * frac) * perSampleDecay;
  }

  // pass 2 — the body: a one-pole lowpass on the OUTPUT whose cutoff closes from
  // bright to warm across the note. This is what makes a plucked string darken as it
  // decays, and living outside the loop it can't shift the pitch.
  const brightFc = Math.min(8000, Math.max(3500, freq * 8)); // low strings warm, high strings bright
  const warmFc = Math.max(900, brightFc / 3);
  const brightK = lowpassCoeff(sr, brightFc);
  const warmK = lowpassCoeff(sr, warmFc);
  let filt = 0;
  for (let t = 0; t < total; t++) {
    const k = t / total; // 0 → 1 across the note
    const c = brightK + (warmK - brightK) * k;
    filt += c * (wave[t] - filt);
    wave[t] = filt;
  }

  // no clicks: 2 ms fade-in, 30 ms fade-out
  const atk = Math.min(total, Math.round(sr * 0.002));
  for (let i = 0; i < atk; i++) wave[i] *= i / atk;
  const rel = Math.round(sr * 0.03);
  for (let i = Math.max(atk, total - rel); i < total; i++) wave[i] *= (total - i) / rel;

  // same peak level for every note, whatever the random pick produced
  let peak = 0;
  for (let i = 0; i < total; i++) peak = Math.max(peak, Math.abs(wave[i]));
  const norm = peak > 0 ? 0.5 / peak : 1;
  for (let i = 0; i < total; i++) wave[i] *= norm;

  const buffer = ctx.createBuffer(1, total, sr);
  buffer.copyToChannel(wave, 0);
  const src = ctx.createBufferSource();
  src.buffer = buffer;

  // the body: a touch of acoustic resonance at 110 Hz, sub-bass thump gone, and the
  // very top end rolled off so the tone stays clean instead of wiry.
  const body = ctx.createBiquadFilter();
  body.type = "peaking";
  body.frequency.value = 110;
  body.gain.value = 2;
  body.Q.value = 1;
  const hi = ctx.createBiquadFilter();
  hi.type = "highpass";
  hi.frequency.value = 55;
  hi.Q.value = 0.7;
  const top = ctx.createBiquadFilter();
  top.type = "lowpass";
  top.frequency.value = 9000;
  top.Q.value = 0.5;

  src.connect(body);
  body.connect(hi);
  hi.connect(top);
  top.connect(out);
  src.onended = () => {
    try {
      body.disconnect();
      hi.disconnect();
      top.disconnect();
    } catch {}
  };
  src.start(when);
}

// how long (seconds) the final note of a scale run keeps ringing after the rest
// of the run has finished, so the landing note doesn't cut off abruptly
export const SCALE_RUN_HOLD = 1;

// schedules a whole run of notes on the audio clock. `notes` are in play order
// and carry a midi number; each one starts `secondsPerNote` after the last. The
// last note rings on for SCALE_RUN_HOLD so the run lands instead of stopping.
export function playScaleRun(notes, secondsPerNote) {
  stopPlayback();
  const ctx = getSynthCtx();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  master.gain.linearRampToValueAtTime(0.28, ctx.currentTime + 0.02);
  const step = secondsPerNote;
  const dur = step * 1.6;
  notes.forEach((n, i) => {
    const isLast = i === notes.length - 1;
    pluck(ctx, midiToFreq(n.midi), ctx.currentTime + i * step, isLast ? dur + SCALE_RUN_HOLD : dur, master);
  });
  playback = { master, endAt: ctx.currentTime + (notes.length - 1) * step + dur + SCALE_RUN_HOLD };
}

export function stopPlayback() {
  if (!playback) return;
  const { master } = playback;
  playback = null;
  const ctx = synthCtx;
  if (ctx && master) {
    try {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
    } catch {}
    setTimeout(() => {
      try {
        master.disconnect();
      } catch {}
    }, 250);
  }
}
