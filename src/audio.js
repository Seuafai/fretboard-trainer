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

// Plucks a guitar-like note with additive synthesis: a stack of sine partials at
// 1, 2, 3 … times the fundamental, each quieter than the last (1/√n) and decaying
// faster the higher it is — the same harmonic rolloff a plucked string has — plus a
// short filtered noise burst for the pick's attack. Purely in-tune (no feedback-loop
// phase drift) and no samples required.

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

function pluck(ctx, freq, when, duration, out) {
  if (!Number.isFinite(freq) || !Number.isFinite(when)) return; // never schedule a bad note
  const bus = ctx.createGain();
  bus.gain.value = 0.5;
  bus.connect(out);

  // the string's harmonic body
  const partials = Math.min(10, Math.floor(3200 / freq));
  for (let k = 1; k <= partials; k++) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq * k;
    const g = ctx.createGain();
    const amp = 1 / Math.sqrt(k); // louder fundamental, quieter partials
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(amp, when + 0.004); // pluck attack
    const decay = duration / (1 + 0.5 * (k - 1)); // higher partials fade out sooner
    g.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    osc.connect(g);
    g.connect(bus);
    osc.start(when);
    osc.stop(when + duration + 0.05);
  }

  // the pick's attack: a burst of noise, band-limited near the note so it just
  // colours the first few milliseconds rather than clicking
  const burstLen = Math.max(16, Math.round(ctx.sampleRate * 0.02));
  const burst = ctx.createBuffer(1, burstLen, ctx.sampleRate);
  const data = burst.getChannelData(0);
  for (let i = 0; i < burstLen; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = burst;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = Math.min(8000, freq * 12);
  band.Q.value = 1.2;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, when);
  ng.gain.exponentialRampToValueAtTime(0.12, when + 0.001);
  ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.045);
  noise.connect(band);
  band.connect(ng);
  ng.connect(bus);
  noise.start(when);
  noise.stop(when + 0.06);
}

// schedules a whole run of notes on the audio clock. `notes` are in play order
// and carry a midi number; each one starts `secondsPerNote` after the last.
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
    pluck(ctx, midiToFreq(n.midi), ctx.currentTime + i * step, dur, master);
  });
  playback = { master, endAt: ctx.currentTime + notes.length * step + dur };
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
