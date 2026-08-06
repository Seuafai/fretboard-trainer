import { useState, useEffect, useCallback, useRef } from "react";

const CHROMATIC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// display order top -> bottom mirrors standard tab notation (high e on top)
// openFreq/open here are the STANDARD-tuning reference values — alternate tunings
// derive their own open note + frequency from these via tunedStrings() below.
const STRINGS = [
  { id: "e1", label: "e", open: "E", openFreq: 329.63, thickness: 1.4 },
  { id: "B", label: "B", open: "B", openFreq: 246.94, thickness: 1.7 },
  { id: "G", label: "G", open: "G", openFreq: 196.0, thickness: 2.1 },
  { id: "D", label: "D", open: "D", openFreq: 146.83, thickness: 2.6 },
  { id: "A", label: "A", open: "A", openFreq: 110.0, thickness: 3.2 },
  { id: "e2", label: "E", open: "E", openFreq: 82.41, thickness: 3.8 },
];

// each `notes` array matches STRINGS order (high e, B, G, D, A, low E)
const TUNING_PRESETS = [
  { id: "standard", label: "Standard", notes: ["E", "B", "G", "D", "A", "E"] },
  { id: "dropD", label: "Drop D", notes: ["E", "B", "G", "D", "A", "D"] },
  { id: "halfStepDown", label: "Eb Standard (half step down)", notes: ["D#", "A#", "F#", "C#", "G#", "D#"] },
  { id: "fullStepDown", label: "D Standard (full step down)", notes: ["D", "A", "F", "C", "G", "D"] },
  { id: "dropC", label: "Drop C", notes: ["D", "A", "F", "C", "G", "C"] },
  { id: "openG", label: "Open G", notes: ["D", "B", "G", "D", "G", "D"] },
  { id: "openD", label: "Open D", notes: ["D", "A", "F#", "D", "A", "D"] },
  { id: "openE", label: "Open E", notes: ["E", "B", "G#", "E", "B", "E"] },
  { id: "dadgad", label: "DADGAD", notes: ["D", "A", "G", "D", "A", "D"] },
];

// semitone intervals from the root, ascending within one octave (root is added again at the top)
const SCALE_PATTERNS = [
  { id: "major", label: "Major (Ionian)", intervals: [0, 2, 4, 5, 7, 9, 11] },
  { id: "dorian", label: "Dorian", intervals: [0, 2, 3, 5, 7, 9, 10] },
  { id: "phrygian", label: "Phrygian", intervals: [0, 1, 3, 5, 7, 8, 10] },
  { id: "lydian", label: "Lydian", intervals: [0, 2, 4, 6, 7, 9, 11] },
  { id: "mixolydian", label: "Mixolydian", intervals: [0, 2, 4, 5, 7, 9, 10] },
  { id: "minor", label: "Natural Minor (Aeolian)", intervals: [0, 2, 3, 5, 7, 8, 10] },
  { id: "locrian", label: "Locrian", intervals: [0, 1, 3, 5, 6, 8, 10] },
  { id: "harmonicMinor", label: "Harmonic Minor", intervals: [0, 2, 3, 5, 7, 8, 11] },
  { id: "melodicMinor", label: "Melodic Minor", intervals: [0, 2, 3, 5, 7, 9, 11] },
  { id: "majorPent", label: "Major Pentatonic", intervals: [0, 2, 4, 7, 9] },
  { id: "minorPent", label: "Minor Pentatonic", intervals: [0, 3, 5, 7, 10] },
  { id: "blues", label: "Blues", intervals: [0, 3, 5, 6, 7, 10] },
];

// shifts a standard-tuning reference frequency to a different note, picking the
// nearest direction around the chromatic circle (correct for all alt-tuning shifts, which are small)
function shiftFreq(standardFreq, standardLetter, targetLetter) {
  const standardIdx = CHROMATIC.indexOf(standardLetter);
  const targetIdx = CHROMATIC.indexOf(targetLetter);
  let shift = (((targetIdx - standardIdx) % 12) + 12) % 12;
  if (shift > 6) shift -= 12;
  return standardFreq * Math.pow(2, shift / 12);
}

// combines the fixed per-string metadata (id/label/thickness) with a tuning preset's
// open notes, producing the array used everywhere else in the app for note/frequency math
function tunedStrings(presetNotes) {
  return STRINGS.map((s, i) => ({
    ...s,
    open: presetNotes[i],
    openFreq: shiftFreq(s.openFreq, s.open, presetNotes[i]),
  }));
}

function noteAt(openLetter, fret) {
  const start = CHROMATIC.indexOf(openLetter);
  return CHROMATIC[(start + fret) % 12];
}
function freqAt(openFreq, fret) {
  return openFreq * Math.pow(2, fret / 12);
}
function freqToNote(freq) {
  const midi = 69 + 12 * Math.log2(freq / 440);
  const rounded = Math.round(midi);
  const cents = Math.round((midi - rounded) * 100);
  const idx = ((rounded % 12) + 12) % 12;
  return { name: CHROMATIC[idx], cents, midi: rounded };
}
function centsBetween(freq, target) {
  return 1200 * Math.log2(freq / target);
}
function timeAgo(ts) {
  if (!ts) return null;
  const diff = Date.now() - ts;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

const TUNING_KEY = "fretboard-trainer-tuning";
const STATS_KEY = "fretboard-trainer-stats";

// simple localStorage-backed store (the artifact sandbox's window.storage isn't available
// on a real deployed page, so this app just uses the browser's own storage instead)
const storage = {
  async get(key) {
    try {
      const v = window.localStorage.getItem(key);
      return v === null ? null : { value: v };
    } catch (e) {
      return null;
    }
  },
  async set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      // storage full or unavailable — non-fatal
    }
    return { value };
  },
};

// ---------- pitch + timbre analysis ----------

function autoCorrelate(buf, sampleRate) {
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
  if (freq < 55 || freq > 900) return { freq: null, clarity: 0, rms };
  return { freq, clarity, rms };
}

function extractFingerprint(freqBytes, f0, sampleRate, fftSize) {
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

function useMic() {
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

// ---------- shared bits ----------

function StatCard({ label, value }) {
  return (
    <div style={{ background: "#1b1f27", border: "1px solid #2a2f3a", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, color: "#7a8290", marginBottom: 4, letterSpacing: 0.5 }}>{label}</div>
      <div className="ft-title" style={{ fontSize: 20, color: "#f3ead9" }}>
        {value}
      </div>
    </div>
  );
}
function Chip({ active, onClick, children }) {
  return (
    <button
      className="ft-chip"
      onClick={onClick}
      style={{
        padding: "6px 14px",
        borderRadius: 999,
        border: `1px solid ${active ? "#e0a95f" : "#2a2f3a"}`,
        background: active ? "#e0a95f" : "transparent",
        color: active ? "#14171c" : "#9aa2ac",
        fontSize: 13,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
function TuneBanner({ tuning, onGoTune, guitarStrings }) {
  const timestamps = guitarStrings.map((s) => tuning && tuning[s.id] && tuning[s.id].tunedAt).filter(Boolean);
  const newest = timestamps.length ? Math.max(...timestamps) : null;
  const staleMs = 24 * 60 * 60 * 1000;
  if (newest && Date.now() - newest < staleMs) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        background: "#232833",
        border: "1px solid #e0a95f55",
        borderRadius: 10,
        padding: "10px 14px",
        marginBottom: 18,
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontSize: 13, color: "#e8d6b8" }}>
        {newest ? "It's been a while since you tuned — a quick check-in improves note detection." : "Tuning first gives more accurate note detection. Not required, just recommended."}
      </span>
      <button onClick={onGoTune} style={{ background: "transparent", border: "1px solid #e0a95f", color: "#e0a95f", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
        Tune now
      </button>
    </div>
  );
}

// real fret spacing: frets compress toward the body, following the 12th-root-of-2 scale.
function fretFraction(n) {
  return 1 - 1 / Math.pow(2, n / 12);
}

function FretboardSVG({ maxFret, activeStrings, markers, pulse, guitarStrings = STRINGS }) {
  const boardLeft = 46;
  const totalWidth = 54 * maxFret;
  const boardWidth = boardLeft + totalWidth + 26;
  const rowHeight = 34;
  const boardTop = 18;
  const boardHeight = rowHeight * (guitarStrings.length - 1) + 28;
  const inlayFrets = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];
  const scale = fretFraction(maxFret) || 1;

  const fretX = (n) => boardLeft + (fretFraction(n) / scale) * totalWidth;
  const cellMidX = (n) => (n === 0 ? boardLeft - 17 : (fretX(n - 1) + fretX(n)) / 2);

  return (
    <div style={{ overflowX: "auto", background: "#100e0b", border: "1px solid #5c4530", borderRadius: 10, padding: "12px 6px", boxShadow: "0 6px 18px #00000055 inset" }}>
      <svg width={boardWidth} height={boardHeight + boardTop + 6} viewBox={`0 0 ${boardWidth} ${boardHeight + boardTop + 6}`}>
        <defs>
          <linearGradient id="woodgrain2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6b4a30" />
            <stop offset="12%" stopColor="#5c3f28" />
            <stop offset="50%" stopColor="#6b4a30" />
            <stop offset="88%" stopColor="#5c3f28" />
            <stop offset="100%" stopColor="#4a331f" />
          </linearGradient>
          <filter id="grainFilter" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.09" numOctaves="2" seed="7" result="noise" />
            <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.15,  0 0 0 0 0.09,  0 0 0 0 0.04,  0 0 0 0.5 0" />
          </filter>
          <linearGradient id="fretBevel" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fff3d6" />
            <stop offset="45%" stopColor="#e0a95f" />
            <stop offset="100%" stopColor="#8a6530" />
          </linearGradient>
          <linearGradient id="nutGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fffaf0" />
            <stop offset="100%" stopColor="#dcd2bd" />
          </linearGradient>
          <radialGradient id="pearlShine" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="45%" stopColor="#f3ead9" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#f3ead9" stopOpacity="0.18" />
          </radialGradient>
          <radialGradient id="markerglow2" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f3ead9" />
            <stop offset="55%" stopColor="#e0a95f" />
            <stop offset="100%" stopColor="#e0a95f00" />
          </radialGradient>
        </defs>

        <rect x={0} y={boardTop} width={boardWidth} height={boardHeight} fill="url(#woodgrain2)" rx={7} />
        <rect x={0} y={boardTop} width={boardWidth} height={boardHeight} fill="#000000" opacity={0.22} filter="url(#grainFilter)" rx={7} />
        <rect x={0} y={boardTop} width={boardWidth} height={6} fill="#ffffff" opacity={0.06} rx={3} />
        <rect x={0} y={boardTop + boardHeight - 5} width={boardWidth} height={5} fill="#000000" opacity={0.25} />

        {inlayFrets
          .filter((f) => f <= maxFret)
          .map((f) => {
            const cx = cellMidX(f);
            const cy = boardTop + boardHeight / 2;
            const dots = f === 12 || f === 24 ? [cy - 22, cy + 22] : [cy];
            return (
              <g key={f}>
                {dots.map((dy, i) => (
                  <g key={i}>
                    <circle cx={cx} cy={dy} r={6} fill="#00000033" />
                    <circle cx={cx} cy={dy} r={5.5} fill="url(#pearlShine)" />
                  </g>
                ))}
              </g>
            );
          })}

        <rect x={boardLeft - 6} y={boardTop - 2} width={6} height={boardHeight + 4} fill="url(#nutGrad)" rx={1.5} />
        <rect x={boardLeft} y={boardTop - 2} width={2} height={boardHeight + 4} fill="#00000030" />

        {Array.from({ length: maxFret }, (_, i) => i + 1).map((f) => (
          <rect key={f} x={fretX(f) - 1.1} y={boardTop} width={2.2} height={boardHeight} fill="url(#fretBevel)" />
        ))}

        {Array.from({ length: maxFret + 1 }, (_, i) => i).map((f) => (
          <text key={f} x={cellMidX(f)} y={boardTop + boardHeight + 17} fontSize={11} fill="#c9a878" textAnchor="middle" className="ft-mono">
            {f}
          </text>
        ))}

        {guitarStrings.map((s, idx) => {
          const y = boardTop + 14 + idx * rowHeight;
          const dimmed = !activeStrings.includes(s.id);
          return (
            <g key={s.id} opacity={dimmed ? 0.28 : 1}>
              <text x={16} y={y + 4} fontSize={13} fill="#f3ead9" className="ft-mono" textAnchor="middle">
                {s.open}
              </text>
              <line x1={boardLeft - 6} x2={fretX(maxFret)} y1={y} y2={y} stroke="#8b8f96" strokeWidth={s.thickness} strokeLinecap="round" />
              <line
                x1={boardLeft - 6}
                x2={fretX(maxFret)}
                y1={y - Math.max(0.6, s.thickness / 5)}
                y2={y - Math.max(0.6, s.thickness / 5)}
                stroke="#e8eaee"
                strokeWidth={Math.max(0.5, s.thickness / 4)}
                strokeLinecap="round"
                opacity={0.7}
              />
            </g>
          );
        })}

        {markers.map((m, i) => {
          const idx = guitarStrings.findIndex((s) => s.id === m.stringId);
          const y = boardTop + 14 + idx * rowHeight;
          const x = cellMidX(m.fret);
          const isPulse = pulse && pulse.stringId === m.stringId && pulse.fret === m.fret;
          return (
            <g key={i} onClick={m.onClick} style={{ cursor: m.onClick ? "pointer" : "default" }}>
              {isPulse && <circle cx={x} cy={y} r={18} fill="url(#markerglow2)" opacity={0.7} />}
              <circle cx={x} cy={y} r={m.big ? 12 : m.filled ? 10 : 9} fill={m.filled ? m.color : "transparent"} stroke={m.color} strokeWidth={m.filled ? 1.5 : 2} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---------- notation staff ----------

const NATURAL_LETTERS = ["C", "D", "E", "F", "G", "A", "B"];

// sharps are drawn on the same staff position as the natural below them, with a sharp sign
function pitchClassToNatural(name) {
  if (!name.includes("#")) return { letter: name, sharp: false };
  return { letter: name[0], sharp: true };
}
// diatonic steps from the bottom staff line (E4) — each step is half a line-spacing vertically
function noteNameToStepsFromE4(letter, octave) {
  return octave * 7 + NATURAL_LETTERS.indexOf(letter) - (4 * 7 + 2);
}

function ledgerYsFor(stepsFromE4, bottomLineY, halfStep) {
  const ys = [];
  if (stepsFromE4 < 0) {
    for (let s = -2; s >= stepsFromE4 - (stepsFromE4 % 2 === 0 ? 0 : 1); s -= 2) ys.push(bottomLineY - s * halfStep);
  } else if (stepsFromE4 > 8) {
    for (let s = 10; s <= stepsFromE4 + (stepsFromE4 % 2 === 0 ? 0 : 1); s += 2) ys.push(bottomLineY - s * halfStep);
  }
  return ys;
}

// shows the whole scale laid out on the staff at once; notes already played this lap turn green,
// the current target glows gold (and rings red briefly on a wrong note), the rest stay neutral
function NotationStaff({ sequenceAbs, stepIndex, wrong }) {
  const lineSpacing = 12;
  const halfStep = lineSpacing / 2;
  const bottomLineY = 96; // E4, the bottom staff line
  const startX = 46;
  const stepX = 28;

  const notes = sequenceAbs.map((abs, i) => {
    const octave = 4 + Math.floor(abs / 12);
    const pcName = CHROMATIC[((abs % 12) + 12) % 12];
    const { letter, sharp } = pitchClassToNatural(pcName);
    const stepsFromE4 = noteNameToStepsFromE4(letter, octave);
    return { x: startX + i * stepX, y: bottomLineY - stepsFromE4 * halfStep, sharp, stepsFromE4 };
  });

  const allY = notes.map((n) => n.y);
  const viewW = startX + sequenceAbs.length * stepX + 20;
  const viewH = Math.max(160, bottomLineY - Math.min(...allY) + 40, Math.max(...allY) - (bottomLineY - 4 * lineSpacing) + 40);
  const lineRight = startX + (sequenceAbs.length - 1) * stepX + 20;

  return (
    <div style={{ overflowX: "auto", background: "#100e0b", border: "1px solid #2a2f3a", borderRadius: 10, padding: "16px 6px", display: "flex", justifyContent: "center" }}>
      <svg width={viewW} height={viewH} viewBox={`0 0 ${viewW} ${viewH}`} style={{ maxWidth: "100%", height: "auto" }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={i} x1={20} x2={lineRight} y1={bottomLineY - i * lineSpacing} y2={bottomLineY - i * lineSpacing} stroke="#5a6270" strokeWidth={1.2} />
        ))}
        <text x={22} y={bottomLineY - lineSpacing * 1.2} fontSize={40} fill="#7a8290">
          𝄞
        </text>
        {notes.map((n, i) => {
          const done = i < stepIndex;
          const isCurrent = i === stepIndex;
          const color = done ? "#7cb37a" : isCurrent ? "#e0a95f" : "#f3ead9";
          const ledgerYs = ledgerYsFor(n.stepsFromE4, bottomLineY, halfStep);
          return (
            <g key={i}>
              {ledgerYs.map((y, li) => (
                <line key={li} x1={n.x - 11} x2={n.x + 11} y1={y} y2={y} stroke="#7a8290" strokeWidth={1.2} />
              ))}
              {isCurrent && <circle cx={n.x} cy={n.y} r={13} fill="none" stroke={wrong ? "#d9694e" : "#e0a95f"} strokeWidth={2} opacity={0.8} />}
              {n.sharp && (
                <text x={n.x - 20} y={n.y + 5} fontSize={14} fill={color}>
                  ♯
                </text>
              )}
              <ellipse cx={n.x} cy={n.y} rx={7} ry={5.5} fill={color} transform={`rotate(-18 ${n.x} ${n.y})`} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---------- Tuner page ----------

function TunerGauge({ cents, active }) {
  const clamped = Math.max(-50, Math.min(50, cents ?? 0));
  const angle = (clamped / 50) * 60; // -60deg..60deg
  const color = !active ? "#4a5160" : Math.abs(clamped) < 5 ? "#7cb37a" : Math.abs(clamped) < 20 ? "#e0a95f" : "#d9694e";
  const cx = 210,
    cy = 195,
    r = 150;
  const ticks = [-50, -25, 0, 25, 50];
  return (
    <svg width={420} height={225} viewBox="0 0 420 225" style={{ maxWidth: "100%", height: "auto" }}>
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} stroke="#2a2f3a" strokeWidth={4} fill="none" />
      {ticks.map((t) => {
        const a = (t / 50) * 60 * (Math.PI / 180) - Math.PI / 2;
        const x1 = cx + Math.cos(a) * (r - 15);
        const y1 = cy + Math.sin(a) * (r - 15);
        const x2 = cx + Math.cos(a) * r;
        const y2 = cy + Math.sin(a) * r;
        return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} stroke={t === 0 ? "#e0a95f" : "#5a6270"} strokeWidth={t === 0 ? 4 : 3} />;
      })}
      <line
        x1={cx}
        y1={cy}
        x2={cx + Math.cos((angle * Math.PI) / 180 - Math.PI / 2) * (r - 30)}
        y2={cy + Math.sin((angle * Math.PI) / 180 - Math.PI / 2) * (r - 30)}
        stroke={color}
        strokeWidth={6}
        strokeLinecap="round"
        style={{ transition: "all 0.12s ease" }}
      />
      <circle cx={cx} cy={cy} r={9} fill={color} />
      <text x={cx - r + 4} y={cy + 30} fontSize={15} fill="#7a8290" className="ft-mono">
        flat
      </text>
      <text x={cx + r - 32} y={cy + 30} fontSize={15} fill="#7a8290" className="ft-mono">
        sharp
      </text>
    </svg>
  );
}


function TunerPage({ mic, tuning, onUpdateTuning, guitarStrings }) {
  const [reading, setReading] = useState(null);
  const [detectedString, setDetectedString] = useState(null);
  const [lockProgress, setLockProgress] = useState(0);
  const [justLocked, setJustLocked] = useState(null);
  const stableStartRef = useRef(null);
  const captureBufRef = useRef([]);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (mic.status !== "active") return;
    intervalRef.current = setInterval(() => {
      const s = mic.sample();
      if (!s) return;
      if (!s.freq) {
        setReading(null);
        setDetectedString(null);
        stableStartRef.current = null;
        setLockProgress(0);
        return;
      }
      // find nearest string by target frequency (within ~4 semitones)
      let best = null,
        bestCents = Infinity;
      guitarStrings.forEach((str) => {
        const c = centsBetween(s.freq, str.openFreq);
        if (Math.abs(c) < Math.abs(bestCents)) {
          bestCents = c;
          best = str;
        }
      });
      if (!best || Math.abs(bestCents) > 400) {
        setReading(null);
        setDetectedString(null);
        stableStartRef.current = null;
        setLockProgress(0);
        return;
      }
      setDetectedString(best.id);
      setReading({ cents: bestCents, freq: s.freq });

      if (Math.abs(bestCents) < 4 && s.confident) {
        if (!stableStartRef.current) {
          stableStartRef.current = Date.now();
          captureBufRef.current = [];
        }
        captureBufRef.current.push(s);
        const elapsed = Date.now() - stableStartRef.current;
        setLockProgress(Math.min(1, elapsed / 700));
        if (elapsed >= 700) {
          const bufs = captureBufRef.current;
          const avgFp = [0, 0, 0, 0, 0];
          bufs.forEach((b) => b.fingerprint.forEach((v, i) => (avgFp[i] += v / bufs.length)));
          const avgFreq = bufs.reduce((sum, b) => sum + b.freq, 0) / bufs.length;
          onUpdateTuning(best.id, { freq: avgFreq, fingerprint: avgFp, tunedAt: Date.now() });
          setJustLocked(best.id);
          stableStartRef.current = null;
          setLockProgress(0);
          captureBufRef.current = [];
          setTimeout(() => setJustLocked(null), 1400);
        }
      } else {
        stableStartRef.current = null;
        setLockProgress(0);
      }
    }, 90);
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mic.status, guitarStrings]);

  const tunedCount = guitarStrings.filter((s) => tuning && tuning[s.id]).length;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
        <StatCard label="Strings tuned" value={`${tunedCount} / ${guitarStrings.length}`} />
        <StatCard label="Detecting" value={detectedString ? STRINGS.find((s) => s.id === detectedString).label : "–"} />
        <StatCard label="Status" value={mic.status === "active" ? "listening" : mic.status} />
      </div>

      {mic.status !== "active" && (
        <div style={{ textAlign: "center", padding: "22px 16px", border: "1px dashed #2a2f3a", borderRadius: 10, marginBottom: 20 }}>
          <p style={{ color: "#9aa2ac", fontSize: 14, marginBottom: 14 }}>Pluck a string and the tuner listens through your microphone.</p>
          <button className="ft-primary-btn" onClick={() => mic.start()} disabled={mic.status === "requesting"}>
            {mic.status === "requesting" ? "Requesting mic…" : "Enable microphone"}
          </button>
          {mic.status === "error" && <p style={{ color: "#e08a71", fontSize: 13, marginTop: 12 }}>{mic.error}</p>}
        </div>
      )}

      {(() => {
        const orderedIds = ["e2", "A", "D", "G", "B", "e1"]; // low to high: E A D G B e

        const StringCard = ({ id }) => {
          const s = guitarStrings.find((x) => x.id === id);
          const data = tuning && tuning[id];
          const isCurrent = detectedString === id;
          const isLocking = isCurrent && lockProgress > 0;
          const isJustLocked = justLocked === id;
          return (
            <div
              style={{
                position: "relative",
                textAlign: "center",
                padding: "12px 4px",
                borderRadius: 8,
                border: `1px solid ${isCurrent ? "#e0a95f" : data ? "#7cb37a55" : "#2a2f3a"}`,
                background: isJustLocked ? "#7cb37a33" : isCurrent ? "#e0a95f11" : "#1b1f27",
                overflow: "hidden",
              }}
            >
              {isLocking && (
                <div style={{ position: "absolute", left: 0, bottom: 0, height: 3, width: `${lockProgress * 100}%`, background: "#e0a95f", transition: "width 0.09s linear" }} />
              )}
              <div className="ft-title" style={{ fontSize: 18 }}>
                {s.open}
              </div>
              <div style={{ fontSize: 10, color: data ? "#8fbb7f" : "#5a6270", marginTop: 4 }}>
                {isJustLocked ? "locked ✓" : data ? timeAgo(data.tunedAt) : "not tuned"}
              </div>
            </div>
          );
        };

        return (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginBottom: 8 }}>
            <TunerGauge cents={reading ? reading.cents : null} active={!!reading} />
            <div style={{ textAlign: "center", minHeight: 20 }}>
              {reading ? (
                <span className="ft-mono" style={{ fontSize: 13, color: "#9aa2ac" }}>
                  {reading.cents > 0 ? "+" : ""}
                  {Math.round(reading.cents)}¢ {Math.abs(reading.cents) < 4 ? "· holding…" : ""}
                </span>
              ) : (
                <span style={{ fontSize: 13, color: "#5a6270" }}>{mic.status === "active" ? "waiting for a string…" : ""}</span>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              {orderedIds.map((id) => (
                <div key={id} style={{ width: 76 }}>
                  <StringCard id={id} />
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <p style={{ fontSize: 12, color: "#5a6270", marginTop: 14, textAlign: "center" }}>
        Play each string and hold it steady — it locks in automatically once it's in tune. You can leave any time; untuned strings just fall back to standard pitch.
      </p>
    </div>
  );
}

// ---------- Identify mode ----------

function IdentifyMode({ maxFret, activeStrings, guitarStrings }) {
  const [prompt, setPrompt] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [storageReady, setStorageReady] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await storage.get(STATS_KEY);
        if (!cancelled && res && res.value) setBest(JSON.parse(res.value).best || 0);
      } catch (e) {}
      if (!cancelled) setStorageReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistBest = useCallback((value) => {
    storage.set(STATS_KEY, JSON.stringify({ best: value })).catch(() => {});
  }, []);

  const nextPrompt = useCallback(() => {
    const pool = activeStrings.length ? activeStrings : guitarStrings.map((s) => s.id);
    const stringId = pool[Math.floor(Math.random() * pool.length)];
    const stringDef = guitarStrings.find((s) => s.id === stringId);
    const fret = Math.floor(Math.random() * (maxFret + 1));
    const note = noteAt(stringDef.open, fret);
    setPrompt({ stringId, fret, note });
    setFeedback(null);
  }, [activeStrings, maxFret, guitarStrings]);

  useEffect(() => {
    nextPrompt();
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (prompt && (!activeStrings.includes(prompt.stringId) || prompt.fret > maxFret)) nextPrompt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStrings, maxFret, guitarStrings]);

  function handleAnswer(note) {
    if (feedback || !prompt) return;
    const isCorrect = note === prompt.note;
    setFeedback({ picked: note, correct: isCorrect });
    setTotalCount((t) => t + 1);
    if (isCorrect) {
      setCorrectCount((c) => c + 1);
      setStreak((s) => {
        const next = s + 1;
        if (next > best) {
          setBest(next);
          persistBest(next);
        }
        return next;
      });
    } else {
      setStreak(0);
    }
    timer.current = setTimeout(() => nextPrompt(), isCorrect ? 550 : 1100);
  }

  const accuracy = totalCount ? Math.round((correctCount / totalCount) * 100) : null;
  const markers = prompt
    ? [{ stringId: prompt.stringId, fret: prompt.fret, filled: true, color: feedback ? (feedback.correct ? "#7cb37a" : "#d9694e") : "#e0a95f" }]
    : [];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        <StatCard label="Streak" value={streak} />
        <StatCard label="Best streak" value={storageReady ? best : "–"} />
        <StatCard label="Accuracy" value={accuracy === null ? "–" : `${accuracy}%`} />
        <StatCard label="Answered" value={totalCount} />
      </div>
      <div style={{ marginBottom: 22 }}>
        <FretboardSVG maxFret={maxFret} activeStrings={activeStrings} markers={markers} pulse={null} guitarStrings={guitarStrings} />
      </div>
      <div style={{ textAlign: "center", marginBottom: 16, minHeight: 26 }}>
        {feedback ? (
          <span className="ft-title" style={{ fontSize: 18, color: feedback.correct ? "#8fbb7f" : "#e08a71" }}>
            {feedback.correct ? "Correct — that's " + prompt.note : `Not quite — that's ${prompt.note}`}
          </span>
        ) : (
          <span style={{ fontSize: 14, color: "#9aa2ac" }}>What note is lit up?</span>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
        {CHROMATIC.map((note) => {
          const isPicked = feedback && feedback.picked === note;
          const isCorrectNote = feedback && note === prompt.note;
          let bg = "#232833",
            border = "#2a2f3a",
            color = "#f3ead9";
          if (feedback && isCorrectNote) {
            bg = "#7cb37a";
            border = "#7cb37a";
            color = "#14171c";
          } else if (isPicked && !feedback.correct) {
            bg = "#d9694e";
            border = "#d9694e";
          }
          return (
            <button
              key={note}
              className="ft-note-btn"
              disabled={!!feedback}
              onClick={() => handleAnswer(note)}
              style={{ padding: "14px 0", borderRadius: 8, border: `1px solid ${border}`, background: bg, color, fontSize: 16, fontWeight: 600, cursor: feedback ? "default" : "pointer" }}
            >
              {note}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Find It mode ----------

function nearestPosition(freq, guitarStrings, activeStrings, maxFret, preferredRange) {
  const search = (fretMin, fretMax, tolerance) => {
    let best = null,
      bestCents = Infinity;
    guitarStrings.forEach((s) => {
      if (!activeStrings.includes(s.id)) return;
      for (let fret = fretMin; fret <= fretMax; fret++) {
        const f = freqAt(s.openFreq, fret);
        const cents = Math.abs(1200 * Math.log2(freq / f));
        if (cents < bestCents) {
          bestCents = cents;
          best = { stringId: s.id, fret };
        }
      }
    });
    return bestCents <= tolerance ? best : null;
  };
  if (preferredRange) {
    const inWindow = search(preferredRange.start, preferredRange.end, 35);
    if (inWindow) return inWindow;
  }
  return search(0, maxFret, Infinity);
}

function FindMode({ mic, maxFret, activeStrings, tuning, onGoTune, guitarStrings }) {
  const [note, setNote] = useState(() => CHROMATIC[Math.floor(Math.random() * 12)]);
  const [reading, setReading] = useState(null);
  const [flash, setFlash] = useState(null); // { stringId, fret, color } — temporary, auto-clears
  const [correctCount, setCorrectCount] = useState(0);
  const intervalRef = useRef(null);
  const lastMatchRef = useRef(0);
  const lastWrongRef = useRef(0);
  const flashTimeoutRef = useRef(null);

  const triggerFlash = useCallback((stringId, fret, color, duration) => {
    setFlash({ stringId, fret, color });
    clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = setTimeout(() => setFlash(null), duration);
  }, []);

  useEffect(() => {
    if (mic.status !== "active") return;
    intervalRef.current = setInterval(() => {
      const s = mic.sample();
      if (!s || !s.freq) return;
      const { name } = freqToNote(s.freq);
      setReading({ name });
      const now = Date.now();
      const pos = nearestPosition(s.freq, guitarStrings, activeStrings, maxFret);
      if (!pos) return;

      if (name !== note) {
        if (now - lastWrongRef.current < 500) return;
        lastWrongRef.current = now;
        triggerFlash(pos.stringId, pos.fret, "#d9694e", 650);
        return;
      }
      if (now - lastMatchRef.current < 500) return;
      lastMatchRef.current = now;
      triggerFlash(pos.stringId, pos.fret, "#7cb37a", 1800);
      setCorrectCount((c) => c + 1);
    }, 110);
    return () => {
      clearInterval(intervalRef.current);
      clearTimeout(flashTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mic.status, note, guitarStrings, activeStrings, maxFret]);

  const tunedCount = guitarStrings.filter((s) => tuning && tuning[s.id]).length;
  const markers = flash ? [{ stringId: flash.stringId, fret: flash.fret, filled: true, color: flash.color }] : [];

  function newNote() {
    setNote(CHROMATIC[Math.floor(Math.random() * 12)]);
    setCorrectCount(0);
    setFlash(null);
    clearTimeout(flashTimeoutRef.current);
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
        <StatCard label="Target note" value={note} />
        <StatCard label="Correct hits" value={correctCount} />
        <StatCard label="Strings tuned" value={`${tunedCount} / ${guitarStrings.length}`} />
      </div>

      {mic.status !== "active" && (
        <div style={{ textAlign: "center", padding: "22px 16px", border: "1px dashed #2a2f3a", borderRadius: 10, marginBottom: 20 }}>
          <p style={{ color: "#9aa2ac", fontSize: 14, marginBottom: 14 }}>Find It listens through your microphone as you play. Turn it on to begin.</p>
          <button className="ft-primary-btn" onClick={() => mic.start()} disabled={mic.status === "requesting"}>
            {mic.status === "requesting" ? "Requesting mic…" : "Enable microphone"}
          </button>
          {mic.status === "error" && <p style={{ color: "#e08a71", fontSize: 13, marginTop: 12 }}>{mic.error}</p>}
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <FretboardSVG maxFret={maxFret} activeStrings={activeStrings} markers={markers} pulse={flash} guitarStrings={guitarStrings} />
      </div>

      <div style={{ textAlign: "center", marginBottom: 18, minHeight: 40 }}>
        <div style={{ fontSize: 14, color: "#9aa2ac" }}>
          Play <strong style={{ color: "#f3ead9" }}>{note}</strong> anywhere on the neck — any string, any octave, as many times as you like.
        </div>
      </div>

      <div style={{ textAlign: "center", marginBottom: 10 }}>
        <button onClick={newNote} style={{ background: "transparent", border: "1px solid #2a2f3a", color: "#9aa2ac", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>
          Skip to a different note
        </button>
      </div>

      {tunedCount < guitarStrings.length && (
        <div style={{ textAlign: "center" }}>
          <button onClick={onGoTune} style={{ background: "transparent", border: "none", color: "#7a8290", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
            Tune remaining strings for better string detection
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- Scales mode ----------

function ScalesMode({ mic, maxFret, activeStrings, guitarStrings, onGoTune, tuning }) {
  const [rootIdx, setRootIdx] = useState(0); // index into CHROMATIC
  const [scaleId, setScaleId] = useState("major");
  const [stepIndex, setStepIndex] = useState(0);
  const [reading, setReading] = useState(null);
  const [flash, setFlash] = useState(null);
  const [completedLaps, setCompletedLaps] = useState(0);
  const [revealScale, setRevealScale] = useState(false);
  const [viewMode, setViewMode] = useState("fretboard"); // "fretboard" | "notation"
  const [positionIndex, setPositionIndex] = useState(0);
  const intervalRef = useRef(null);
  const lastMatchRef = useRef(0);
  const lastWrongRef = useRef(0);
  const flashTimeoutRef = useRef(null);
  const lapTimeoutRef = useRef(null);

  const scale = SCALE_PATTERNS.find((s) => s.id === scaleId) || SCALE_PATTERNS[0];
  const sequenceAbs = [...scale.intervals, 12].map((iv) => rootIdx + iv); // ascending absolute semitone offsets, used for staff octave placement
  const sequence = sequenceAbs.map((abs) => CHROMATIC[((abs % 12) + 12) % 12]); // ends back on the root

  // slide a ~5-fret window across the whole range, stepping by 3 frets so windows overlap —
  // gives several playable positions even within a single 12-fret span, not just once per root recurrence
  const positions = [];
  for (let start = 0; start <= maxFret; start += 3) {
    const end = Math.min(maxFret, start + 4);
    positions.push({ start, end });
    if (end >= maxFret) break;
  }
  const activePosition = positions[Math.min(positionIndex, positions.length - 1)] || { start: 0, end: Math.min(maxFret, 4) };

  const triggerFlash = useCallback((stringId, fret, color, duration) => {
    setFlash({ stringId, fret, color });
    clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = setTimeout(() => setFlash(null), duration);
  }, []);

  function resetRun() {
    setStepIndex(0);
    setFlash(null);
    clearTimeout(flashTimeoutRef.current);
    clearTimeout(lapTimeoutRef.current);
  }

  useEffect(() => {
    resetRun();
    setPositionIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootIdx, scaleId]);

  useEffect(() => {
    if (mic.status !== "active") return;
    intervalRef.current = setInterval(() => {
      const s = mic.sample();
      if (!s || !s.freq) return;
      const { name } = freqToNote(s.freq);
      setReading({ name });
      const now = Date.now();
      const pos = nearestPosition(s.freq, guitarStrings, activeStrings, maxFret, revealScale ? activePosition : null);
      if (!pos) return;

      const target = sequence[stepIndex];
      if (name !== target) {
        if (now - lastWrongRef.current < 500) return;
        lastWrongRef.current = now;
        triggerFlash(pos.stringId, pos.fret, "#d9694e", 650);
        return;
      }
      if (now - lastMatchRef.current < 500) return;
      lastMatchRef.current = now;
      triggerFlash(pos.stringId, pos.fret, "#7cb37a", 1800);

      setStepIndex((i) => {
        const next = i + 1;
        if (next >= sequence.length) {
          setCompletedLaps((c) => c + 1);
          lapTimeoutRef.current = setTimeout(() => setStepIndex(0), 1400);
          return i; // hold on the final note briefly before looping back to the start
        }
        return next;
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, 110);
    return () => {
      clearInterval(intervalRef.current);
      clearTimeout(flashTimeoutRef.current);
      clearTimeout(lapTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mic.status, stepIndex, sequence.join(","), guitarStrings, activeStrings, maxFret, revealScale, activePosition.start, activePosition.end]);

  const scaleNoteSet = new Set(sequence);
  const rootNote = CHROMATIC[rootIdx];

  const revealMarkers = revealScale
    ? guitarStrings.flatMap((s) => {
        if (!activeStrings.includes(s.id)) return [];
        const out = [];
        for (let fret = activePosition.start; fret <= activePosition.end; fret++) {
          const n = noteAt(s.open, fret);
          if (!scaleNoteSet.has(n)) continue;
          const isRoot = n === rootNote;
          out.push({ stringId: s.id, fret, filled: isRoot, big: isRoot, color: isRoot ? "#e0a95f" : "#e0a95f77" });
        }
        return out;
      })
    : [];
  const markers = [...revealMarkers, ...(flash ? [{ stringId: flash.stringId, fret: flash.fret, filled: true, color: flash.color }] : [])];
  const justCompleted = stepIndex >= sequence.length - 1 && completedLaps > 0 && Date.now() - lastMatchRef.current < 1400;
  const tunedCount = guitarStrings.filter((s) => tuning && tuning[s.id]).length;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
        <StatCard label="Scale" value={`${CHROMATIC[rootIdx]} ${scale.label}`} />
        <StatCard label="Step" value={`${Math.min(stepIndex + 1, sequence.length)} / ${sequence.length}`} />
        <StatCard label="Laps completed" value={completedLaps} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "#9aa2ac", marginBottom: 6 }}>Root note</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {CHROMATIC.map((n, i) => (
            <Chip key={n} active={rootIdx === i} onClick={() => setRootIdx(i)}>
              {n}
            </Chip>
          ))}
        </div>
        <div style={{ fontSize: 13, color: "#9aa2ac", marginBottom: 6 }}>Scale</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {SCALE_PATTERNS.map((sc) => (
            <Chip key={sc.id} active={scaleId === sc.id} onClick={() => setScaleId(sc.id)}>
              {sc.label}
            </Chip>
          ))}
        </div>
        <Chip active={revealScale} onClick={() => setRevealScale((v) => !v)}>
          {revealScale ? "Reveal on" : "Reveal scale positions"}
        </Chip>
        {revealScale && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 13, color: "#9aa2ac", marginBottom: 6 }}>Position</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {positions.map((p, i) => (
                <Chip key={i} active={positionIndex === i} onClick={() => setPositionIndex(i)}>
                  {i + 1} (fr {p.start}–{p.end})
                </Chip>
              ))}
            </div>
          </div>
        )}
      </div>

      {mic.status !== "active" && (
        <div style={{ textAlign: "center", padding: "22px 16px", border: "1px dashed #2a2f3a", borderRadius: 10, marginBottom: 20 }}>
          <p style={{ color: "#9aa2ac", fontSize: 14, marginBottom: 14 }}>Scales listens through your microphone as you play through the sequence.</p>
          <button className="ft-primary-btn" onClick={() => mic.start()} disabled={mic.status === "requesting"}>
            {mic.status === "requesting" ? "Requesting mic…" : "Enable microphone"}
          </button>
          {mic.status === "error" && <p style={{ color: "#e08a71", fontSize: 13, marginTop: 12 }}>{mic.error}</p>}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {sequence.map((n, i) => {
          const done = i < stepIndex;
          const isCurrent = i === stepIndex;
          return (
            <div
              key={i}
              className={isCurrent ? "ft-title" : ""}
              style={{
                width: 34,
                height: 34,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                fontSize: isCurrent ? 16 : 14,
                border: `1.5px solid ${isCurrent ? "#e0a95f" : done ? "#7cb37a" : "#2a2f3a"}`,
                background: isCurrent ? "#e0a95f22" : done ? "#7cb37a22" : "transparent",
                color: isCurrent ? "#f3ead9" : done ? "#8fbb7f" : "#5a6270",
              }}
            >
              {n}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 12 }}>
        <Chip active={viewMode === "fretboard"} onClick={() => setViewMode("fretboard")}>
          Fretboard
        </Chip>
        <Chip active={viewMode === "notation"} onClick={() => setViewMode("notation")}>
          Notation
        </Chip>
      </div>

      <div style={{ marginBottom: 14 }}>
        {viewMode === "fretboard" ? (
          <FretboardSVG maxFret={maxFret} activeStrings={activeStrings} markers={markers} pulse={flash} guitarStrings={guitarStrings} />
        ) : (
          <NotationStaff sequenceAbs={sequenceAbs} stepIndex={stepIndex} wrong={!!flash && flash.color === "#d9694e"} />
        )}
      </div>

      <div style={{ textAlign: "center", marginBottom: 18, minHeight: 40 }}>
        {justCompleted ? (
          <div className="ft-title" style={{ fontSize: 18, color: "#8fbb7f" }}>
            Lap complete — starting over
          </div>
        ) : (
          <div style={{ fontSize: 14, color: "#9aa2ac" }}>
            Play <strong style={{ color: "#f3ead9" }}>{sequence[stepIndex]}</strong> next — anywhere on the neck.
          </div>
        )}
      </div>

      <div style={{ textAlign: "center", marginBottom: 10 }}>
        <button onClick={resetRun} style={{ background: "transparent", border: "1px solid #2a2f3a", color: "#9aa2ac", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>
          Restart from the root
        </button>
      </div>

      {tunedCount < guitarStrings.length && (
        <div style={{ textAlign: "center" }}>
          <button onClick={onGoTune} style={{ background: "transparent", border: "none", color: "#7a8290", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
            Tune remaining strings for better string detection
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- root ----------

export default function FretboardTrainer() {
  const [page, setPage] = useState("tuner");
  const [maxFret, setMaxFret] = useState(12);
  const [tuningPresetId, setTuningPresetId] = useState("standard");
  const [activeStrings, setActiveStrings] = useState(STRINGS.map((s) => s.id));
  const [tuning, setTuning] = useState(null); // null = loading; holds mic-CALIBRATED frequencies (separate from the tuning preset above)
  const mic = useMic();

  const tuningPreset = TUNING_PRESETS.find((t) => t.id === tuningPresetId) || TUNING_PRESETS[0];
  const guitarStrings = tunedStrings(tuningPreset.notes);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await storage.get(TUNING_KEY);
        if (!cancelled) setTuning(res && res.value ? JSON.parse(res.value) : {});
      } catch (e) {
        if (!cancelled) setTuning({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (page === "identify" && mic.status === "active") mic.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const prevTuningPresetRef = useRef(tuningPresetId);
  useEffect(() => {
    if (prevTuningPresetRef.current !== tuningPresetId) {
      prevTuningPresetRef.current = tuningPresetId;
      setTuning({}); // old calibration was measured for a different tuning — no longer valid
    }
  }, [tuningPresetId]);

  const updateTuning = useCallback((stringId, data) => {
    setTuning((prev) => {
      const next = { ...(prev || {}), [stringId]: data };
      storage.set(TUNING_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  function toggleString(id) {
    setActiveStrings((prev) => (prev.includes(id) ? (prev.length > 1 ? prev.filter((s) => s !== id) : prev) : [...prev, id]));
  }

  return (
    <div style={{ background: "#12151a", minHeight: "100%", padding: "28px 18px 36px", fontFamily: "'Inter', system-ui, sans-serif", color: "#f3ead9", boxSizing: "border-box" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bitter:wght@600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap');
        .ft-title { font-family: 'Bitter', Georgia, serif; }
        .ft-mono { font-family: 'JetBrains Mono', monospace; }
        .ft-note-btn { transition: transform 0.08s ease, box-shadow 0.15s ease; }
        .ft-note-btn:active { transform: scale(0.94); }
        .ft-chip { transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease; }
        .ft-primary-btn { background: #e0a95f; color: #14171c; border: none; border-radius: 8px; padding: 10px 18px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .ft-primary-btn:disabled { opacity: 0.6; cursor: default; }
      `}</style>

      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 4 }}>
          <h1 className="ft-title" style={{ fontSize: 28, margin: 0, letterSpacing: 0.3 }}>
            Fretboard Trainer
          </h1>
          <span className="ft-mono" style={{ fontSize: 12, color: "#e0a95f", letterSpacing: 1 }}>
            LEARN EVERY NOTE, EVERY STRING
          </span>
        </div>
        <p style={{ margin: "0 0 18px", color: "#9aa2ac", fontSize: 14, lineHeight: 1.5 }}>
          {page === "tuner" && "Get in tune — it quietly teaches the app your guitar's voice at the same time."}
          {page === "identify" && "A brass marker lights up a fret. Name the note before it fades."}
          {page === "find" && "Play back the note the app calls out — everywhere it lives on the neck."}
          {page === "scales" && "Pick a scale and play it in order — one note calls the next."}
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          <Chip active={page === "tuner"} onClick={() => setPage("tuner")}>
            Tuner
          </Chip>
          <Chip active={page === "identify"} onClick={() => setPage("identify")}>
            Note ID
          </Chip>
          <Chip active={page === "find"} onClick={() => setPage("find")}>
            Find It
          </Chip>
          <Chip active={page === "scales"} onClick={() => setPage("scales")}>
            Scales
          </Chip>
        </div>

        {page !== "tuner" && <TuneBanner tuning={tuning} onGoTune={() => setPage("tuner")} guitarStrings={guitarStrings} />}

        {tuning === null ? (
          <div style={{ textAlign: "center", color: "#5a6270", padding: 30 }}>loading…</div>
        ) : (
          <>
            {page === "tuner" && <TunerPage mic={mic} tuning={tuning} onUpdateTuning={updateTuning} guitarStrings={guitarStrings} />}
            {page === "identify" && <IdentifyMode maxFret={maxFret} activeStrings={activeStrings} guitarStrings={guitarStrings} />}
            {page === "find" && <FindMode mic={mic} maxFret={maxFret} activeStrings={activeStrings} tuning={tuning} onGoTune={() => setPage("tuner")} guitarStrings={guitarStrings} />}
            {page === "scales" && <ScalesMode mic={mic} maxFret={maxFret} activeStrings={activeStrings} guitarStrings={guitarStrings} tuning={tuning} onGoTune={() => setPage("tuner")} />}
          </>
        )}

        {(
          <div style={{ background: "#1b1f27", border: "1px solid #2a2f3a", borderRadius: 10, padding: 16, marginTop: 22 }}>
            <div className="ft-mono" style={{ fontSize: 11, letterSpacing: 1, color: "#e0a95f", marginBottom: 10 }}>
              SETTINGS
            </div>
            {page !== "tuner" && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: "#9aa2ac", marginBottom: 6 }}>Fret range</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {[5, 12, 15, 22, 24].map((n) => (
                    <Chip key={n} active={maxFret === n} onClick={() => setMaxFret(n)}>
                      0–{n}
                    </Chip>
                  ))}
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#9aa2ac" }}>
                    custom:
                    <input
                      type="number"
                      min={3}
                      max={24}
                      value={maxFret}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        if (!isNaN(n)) setMaxFret(Math.max(3, Math.min(24, n)));
                      }}
                      style={{ width: 52, background: "#12151a", border: "1px solid #2a2f3a", borderRadius: 6, color: "#f3ead9", padding: "5px 6px", fontSize: 13 }}
                    />
                  </label>
                </div>
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: "#9aa2ac", marginBottom: 6 }}>Tuning</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {TUNING_PRESETS.map((t) => (
                  <Chip key={t.id} active={tuningPresetId === t.id} onClick={() => setTuningPresetId(t.id)}>
                    {t.label}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: "#9aa2ac", marginBottom: 6 }}>Strings</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[...guitarStrings].reverse().map((s) => (
                  <Chip key={s.id} active={activeStrings.includes(s.id)} onClick={() => toggleString(s.id)}>
                    {s.open} string
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
