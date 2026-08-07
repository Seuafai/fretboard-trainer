import { useState, useEffect, useCallback, useRef, useMemo } from "react";

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

// the seven modes of the major scale, in position order (position N starts on degree N)
const MODE_NAMES = ["Ionian", "Dorian", "Phrygian", "Lydian", "Mixolydian", "Aeolian", "Locrian"];

// The classic CAGED major-scale boxes — five overlapping shapes named after their chord form.
// `strings` holds per-string fret numbers for G major (key root G, tonic fret on the anchor
// string in `anchorFret`). Each box transposes to any key by shifting so the key's root lands
// on the anchor string; every placed note is then pitch-class-checked against the major scale.
// selectable pattern systems; each defines its own position-building strategy and the
// scales it applies to. `allowedScales` = null means every scale works with it.
const PATTERN_SYSTEMS = [
  { id: "modes3nps", label: "Modes / 3NPS", defaultScale: "major", allowedScales: null },
  { id: "caged", label: "CAGED boxes", defaultScale: "major", allowedScales: ["major"] },
  { id: "penta", label: "Pentatonic boxes", defaultScale: "minorPent", allowedScales: ["majorPent", "minorPent"] },
  { id: "blues", label: "Blues boxes", defaultScale: "blues", allowedScales: ["blues"] },
  { id: "twoOctave", label: "Two-octave", defaultScale: "major", allowedScales: null },
];
function systemAllowsScale(systemId, scaleId) {
  const sys = PATTERN_SYSTEMS.find((s) => s.id === systemId);
  if (!sys || !sys.allowedScales) return true;
  return sys.allowedScales.includes(scaleId);
}

const CAGED_FORMS = [
  {
    id: "E",
    label: "E form",
    anchorString: "e2",
    anchorFret: 3,
    strings: { e1: [2, 3, 5], B: [3, 5], G: [2, 4, 5], D: [2, 4, 5], A: [2, 3, 5], e2: [2, 3, 5] },
  },
  {
    id: "D",
    label: "D form",
    anchorString: "D",
    anchorFret: 5,
    strings: { e1: [5, 7, 8], B: [5, 7, 8], G: [4, 5, 7], D: [4, 5, 7], A: [5, 7], e2: [5, 7, 8] },
  },
  {
    id: "C",
    label: "C form",
    anchorString: "A",
    anchorFret: 10,
    strings: { e1: [7, 8, 10], B: [7, 8, 10], G: [7, 9], D: [7, 9, 10], A: [7, 9, 10], e2: [7, 8, 10] },
  },
  {
    id: "A",
    label: "A form",
    anchorString: "A",
    anchorFret: 10,
    strings: { e1: [10, 12], B: [10, 12, 13], G: [9, 11, 12], D: [9, 10, 12], A: [9, 10, 12], e2: [10, 12] },
  },
  {
    id: "G",
    label: "G form",
    anchorString: "e2",
    anchorFret: 15,
    strings: { e1: [12, 14, 15], B: [12, 13, 15], G: [11, 12, 14], D: [12, 14], A: [12, 14, 15], e2: [12, 14, 15] },
  },
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
              {m.finger != null && (
                <text x={x} y={y + 3.5} fontSize={m.big ? 9 : 8} fontWeight={700} textAnchor="middle" className="ft-mono" fill={m.filled ? "#14171c" : "#e0a95f"}>
                  {m.finger}
                </text>
              )}
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
function NotationStaff({ sequenceAbs, foundNotes }) {
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
    return { x: startX + i * stepX, y: bottomLineY - stepsFromE4 * halfStep, sharp, stepsFromE4, pcName };
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
          const found = foundNotes.includes(n.pcName);
          const color = found ? "#7cb37a" : "#f3ead9";
          const ledgerYs = ledgerYsFor(n.stepsFromE4, bottomLineY, halfStep);
          return (
            <g key={i}>
              {ledgerYs.map((y, li) => (
                <line key={li} x1={n.x - 11} x2={n.x + 11} y1={y} y2={y} stroke="#7a8290" strokeWidth={1.2} />
              ))}
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

// Recognized scale positions via the notes-per-string system:
//   7-note scales -> 3 notes per string (7 positions), 5/6-note scales -> 2 notes per string (5/6 boxes).
// Each position starts on a consecutive scale degree on the low-E string and walks the scale
// upward across the strings. Consecutive strings are tuned a 4th (5 semitones) apart except the
// G->B break (4 semitones); the drift between strings is exactly the scale distance of `nps`
// degrees minus the tuning offset, which is what produces the textbook boxes.
function buildScalePositions(rootIdx, scale, maxFret, guitarStrings) {
  const intervals = scale.intervals;
  const N = intervals.length;
  const nps = N === 5 || N === 6 ? 2 : 3;
  const strings = [...guitarStrings].reverse(); // low E first
  const pcs = intervals.map((iv) => CHROMATIC[((rootIdx + iv) % 12 + 12) % 12]);
  const semisOf = (k) => intervals[k % N] + 12 * Math.floor(k / N);

  const tuningOffsets = [];
  for (let i = 0; i < strings.length - 1; i++) {
    const a = CHROMATIC.indexOf(strings[i].open);
    const b = CHROMATIC.indexOf(strings[i + 1].open);
    tuningOffsets.push((((b - a) % 12) + 12) % 12);
  }

  const occ = strings.map((s) => {
    const map = {};
    for (let f = 0; f <= maxFret; f++) {
      const n = noteAt(s.open, f);
      (map[n] = map[n] || []).push(f);
    }
    return map;
  });

  // nearest occurrence to `target`, but only within half an octave so we can't
  // accidentally jump to the wrong octave's occurrence (pcs repeat every 12 frets)
  const pick = (list, target) => {
    if (!list) return null;
    let best = null;
    for (const f of list) {
      if (Math.abs(f - target) > 6) continue;
      if (best === null || Math.abs(f - target) < Math.abs(best - target)) best = f;
    }
    return best;
  };

  const positions = [];
  for (let p = 0; p < N; p++) {
    const anchors = occ[0][pcs[p]] || [];
    let built = null;
    for (const anchor of anchors) {
      const notes = [];
      let startFret = anchor;
      let ok = true;
      for (let i = 0; i < strings.length; i++) {
        const baseIdx = p + nps * i;
        const firstFret = pick(occ[i][pcs[baseIdx % N]], startFret);
        if (firstFret === null) {
          ok = false;
          break;
        }
        notes.push({ stringId: strings[i].id, fret: firstFret, degree: baseIdx % N });
        let prevFret = firstFret;
        for (let j = 1; j < nps; j++) {
          const absIdx = baseIdx + j;
          const expected = prevFret + (semisOf(absIdx) - semisOf(baseIdx + j - 1));
          const fret = pick(occ[i][pcs[absIdx % N]], expected);
          if (fret === null) {
            ok = false;
            break;
          }
          notes.push({ stringId: strings[i].id, fret, degree: absIdx % N });
          prevFret = fret;
        }
        if (!ok) break;
        if (i < strings.length - 1) {
          startFret = firstFret + (semisOf(baseIdx + nps) - semisOf(baseIdx) - tuningOffsets[i]);
        }
      }
      if (ok) {
        const frets = notes.map((n) => n.fret);
        built = { notes, start: Math.min(...frets), end: Math.max(...frets), labelNote: pcs[p] };
        break;
      }
    }
    if (built) positions.push(built);
  }
  return positions;
}

// builds the five classic CAGED boxes for the selected root. The shapes are stored as fret
// positions for G major; transposing shifts the whole rigid shape so the key's root lands on
// the form's anchor string. Each occurrence of the root on the anchor string is tried, nearest
// to the shape's natural position first, until one fits within the neck; every placed note is
// then pitch-class-checked against the major scale so any data slip fails fast.
function buildCagedPositions(rootIdx, maxFret, guitarStrings) {
  const major = SCALE_PATTERNS.find((s) => s.id === "major");
  const pcs = major.intervals.map((iv) => CHROMATIC[((rootIdx + iv) % 12 + 12) % 12]);
  const rootName = CHROMATIC[rootIdx];
  const positions = [];
  for (const form of CAGED_FORMS) {
    const anchor = guitarStrings.find((s) => s.id === form.anchorString);
    if (!anchor) continue;
    const anchors = [];
    for (let f = 0; f <= maxFret; f++) {
      if (noteAt(anchor.open, f) === rootName) anchors.push(f);
    }
    anchors.sort((a, b) => Math.abs(a - form.anchorFret) - Math.abs(b - form.anchorFret));
    let built = null;
    for (const anchorFret of anchors) {
      const shift = anchorFret - form.anchorFret;
      const notes = [];
      let ok = true;
      for (const [sid, frets] of Object.entries(form.strings)) {
        const s = guitarStrings.find((gs) => gs.id === sid);
        if (!s) {
          ok = false;
          break;
        }
        for (const f of frets) {
          const fret = f + shift;
          if (fret < 0 || fret > maxFret) {
            ok = false;
            break;
          }
          const pc = noteAt(s.open, fret);
          const deg = pcs.indexOf(pc);
          if (deg === -1) {
            ok = false;
            break;
          }
          notes.push({ stringId: sid, fret, degree: deg });
        }
        if (!ok) break;
      }
      if (!ok) continue;
      const frets = notes.map((n) => n.fret);
      built = {
        id: form.id,
        label: form.label,
        notes,
        start: Math.min(...frets),
        end: Math.max(...frets),
        labelNote: rootName,
      };
      break;
    }
    if (built) positions.push(built);
  }
  return positions;
}

// two-octave scale shapes: start on the root of the 6th or 5th string and walk the scale
// upward three notes per string, stopping exactly at the root two octaves up. Produces the
// classic "two octave scale" shapes (root on low E, root on A).
function buildTwoOctavePositions(rootIdx, scale, maxFret, guitarStrings) {
  const intervals = scale.intervals;
  const N = intervals.length;
  const strings = [...guitarStrings].reverse(); // low E first
  const pcs = intervals.map((iv) => CHROMATIC[((rootIdx + iv) % 12 + 12) % 12]);
  const semisOf = (k) => intervals[k % N] + 12 * Math.floor(k / N);

  const tuningOffsets = [];
  for (let i = 0; i < strings.length - 1; i++) {
    const a = CHROMATIC.indexOf(strings[i].open);
    const b = CHROMATIC.indexOf(strings[i + 1].open);
    tuningOffsets.push((((b - a) % 12) + 12) % 12);
  }

  const occ = strings.map((s) => {
    const map = {};
    for (let f = 0; f <= maxFret; f++) {
      const n = noteAt(s.open, f);
      (map[n] = map[n] || []).push(f);
    }
    return map;
  });

  const pick = (list, target) => {
    if (!list) return null;
    let best = null;
    for (const f of list) {
      if (Math.abs(f - target) > 6) continue;
      if (best === null || Math.abs(f - target) < Math.abs(best - target)) best = f;
    }
    return best;
  };

  const positions = [];
  for (let anchorIdx = 0; anchorIdx <= 1; anchorIdx++) {
    const rootFrets = occ[anchorIdx][pcs[0]] || [];
    for (const startFret of rootFrets) {
      const notes = [];
      let str = anchorIdx;
      let prevFret = startFret;
      let placedOnString = 1;
      notes.push({ stringId: strings[str].id, fret: startFret, degree: 0 });
      let ok = true;
      for (let k = 1; k <= N * 2; k++) {
        const deg = k % N;
        const expected = prevFret + (semisOf(k) - semisOf(k - 1));
        let fret = null;
        if (placedOnString < 3 && str < strings.length) {
          fret = pick(occ[str][pcs[deg]], expected);
        }
        if (fret === null && str < strings.length - 1) {
          str++;
          placedOnString = 0;
          fret = pick(occ[str][pcs[deg]], expected - tuningOffsets[str - 1]);
        }
        if (fret === null) {
          ok = false;
          break;
        }
        notes.push({ stringId: strings[str].id, fret, degree: deg });
        prevFret = fret;
        placedOnString++;
      }
      if (!ok || notes.length !== N * 2 + 1) continue;
      const frets = notes.map((n) => n.fret);
      positions.push({
        id: `two-oct-${anchorIdx}-${startFret}`,
        label: `2-oct · ${strings[anchorIdx].label}`,
        notes,
        start: Math.min(...frets),
        end: Math.max(...frets),
        labelNote: pcs[0],
      });
    }
  }
  return positions;
}

// method-book finger numbers: within a 4-fret box each fret cell maps to one finger
// (1 = index … 4 = pinky); wider 3NPS/two-octave shapes use the per-string convention
// (fingers relative to the first note on that string, capped at 4).
function addFingers(position) {
  const notes = position ? position.notes : [];
  if (!notes.length) return notes;
  const frets = notes.map((n) => n.fret);
  const span = Math.max(...frets) - Math.min(...frets);
  if (span <= 3) {
    const startFret = Math.min(...frets);
    return notes.map((n) => ({ ...n, finger: n.fret - startFret + 1 }));
  }
  const byString = {};
  for (const n of notes) (byString[n.stringId] = byString[n.stringId] || []).push(n);
  const fingered = [];
  for (const sid of Object.keys(byString)) {
    const ns = byString[sid].slice().sort((a, b) => a.fret - b.fret);
    const firstFret = ns[0].fret;
    for (const n of ns) fingered.push({ ...n, finger: Math.max(1, Math.min(4, n.fret - firstFret + 1)) });
  }
  return fingered;
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
  const [patternSystem, setPatternSystem] = useState("modes3nps");
  const [anchorRoot, setAnchorRoot] = useState(false);
  const [anchorString, setAnchorString] = useState("e2");
  const [reading, setReading] = useState(null);
  const [flash, setFlash] = useState(null);
  const [foundNotes, setFoundNotes] = useState([]); // pitch-class strings found this session, any order
  const [revealScale, setRevealScale] = useState(false);
  const [viewMode, setViewMode] = useState("fretboard"); // "fretboard" | "notation"
  const [positionIndex, setPositionIndex] = useState(0);
  const intervalRef = useRef(null);
  const lastMatchRef = useRef(0);
  const lastWrongRef = useRef(0);
  const flashTimeoutRef = useRef(null);

  const scale = SCALE_PATTERNS.find((s) => s.id === scaleId) || SCALE_PATTERNS[0];
  const sequenceAbs = [...scale.intervals, 12].map((iv) => rootIdx + iv); // ascending absolute semitone offsets, used for staff octave placement
  const sequence = sequenceAbs.map((abs) => CHROMATIC[((abs % 12) + 12) % 12]); // ends back on the root
  const uniqueScaleNotes = [...new Set(sequence)];

  // positions depend on the chosen pattern system: modes/3NPS + pentatonic + blues use the
  // notes-per-string walk; CAGED uses the five hand-verified classic boxes; two-octave builds
  // the 2-octave shapes rooted on the low E and A strings.
  const positions = useMemo(() => {
    switch (patternSystem) {
      case "caged":
        return buildCagedPositions(rootIdx, maxFret, guitarStrings);
      case "twoOctave":
        return buildTwoOctavePositions(rootIdx, scale, maxFret, guitarStrings);
      default:
        return buildScalePositions(rootIdx, scale, maxFret, guitarStrings);
    }
  }, [patternSystem, rootIdx, scale, maxFret, guitarStrings]);

  // when anchoring, pick the position whose root note (degree 0) sits on the chosen anchor
  // string at the lowest fret — the "same shape, different root string/note" practice flow
  const anchoredPosition = useMemo(() => {
    if (!anchorRoot) return null;
    const candidates = positions.filter((p) => p.notes.some((n) => n.degree === 0 && n.stringId === anchorString));
    if (!candidates.length) return null;
    return candidates.reduce((a, b) => (a.start <= b.start ? a : b));
  }, [positions, anchorRoot, anchorString]);
  const activePosition = anchoredPosition || positions[Math.min(positionIndex, positions.length - 1)];

  const triggerFlash = useCallback((stringId, fret, color, duration) => {
    setFlash({ stringId, fret, color });
    clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = setTimeout(() => setFlash(null), duration);
  }, []);

  function resetRun() {
    setFoundNotes([]);
    setFlash(null);
    clearTimeout(flashTimeoutRef.current);
  }

  useEffect(() => {
    resetRun();
    setPositionIndex(0);
    if (!systemAllowsScale(patternSystem, scaleId)) {
      const sys = PATTERN_SYSTEMS.find((s) => s.id === patternSystem);
      if (sys) setScaleId(sys.defaultScale);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootIdx, scaleId, patternSystem]);

  useEffect(() => {
    if (mic.status !== "active") return;
    intervalRef.current = setInterval(() => {
      const s = mic.sample();
      if (!s || !s.freq) return;
      const { name } = freqToNote(s.freq);
      setReading({ name });
      const now = Date.now();
      const pos = nearestPosition(
        s.freq,
        guitarStrings,
        activeStrings,
        maxFret,
        revealScale && activePosition ? { start: activePosition.start, end: activePosition.end } : null
      );
      if (!pos) return;

      if (!uniqueScaleNotes.includes(name)) {
        if (now - lastWrongRef.current < 500) return;
        lastWrongRef.current = now;
        triggerFlash(pos.stringId, pos.fret, "#d9694e", 650);
        return;
      }
      if (now - lastMatchRef.current < 500) return;
      lastMatchRef.current = now;
      triggerFlash(pos.stringId, pos.fret, "#7cb37a", 1800);
      setFoundNotes((prev) => (prev.includes(name) ? prev : [...prev, name]));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, 110);
    return () => {
      clearInterval(intervalRef.current);
      clearTimeout(flashTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mic.status, sequence.join(","), guitarStrings, activeStrings, maxFret, revealScale, positions, positionIndex, anchorRoot, anchorString]);

  const isBoxScale = scale.intervals.length === 5 || scale.intervals.length === 6;
  const isModeScale = patternSystem === "modes3nps" && scale.id === "major" && !isBoxScale;
  const positionLabel = (p, i) => {
    if (patternSystem === "caged" || patternSystem === "twoOctave") return p.label;
    if (isBoxScale) return `Box ${i + 1} · ${p.labelNote}`;
    if (isModeScale) return `Position ${i + 1} · ${MODE_NAMES[i] || ""}`.trim();
    return `Position ${i + 1} · ${p.labelNote}`;
  };

  const revealMarkers =
    revealScale && activePosition
      ? addFingers(activePosition).flatMap((n) => {
          if (!activeStrings.includes(n.stringId)) return [];
          const isRoot = n.degree === 0;
          return [{ stringId: n.stringId, fret: n.fret, filled: isRoot, big: isRoot, color: isRoot ? "#e0a95f" : "#e0a95f77", finger: n.finger }];
        })
      : [];
  const markers = [...revealMarkers, ...(flash ? [{ stringId: flash.stringId, fret: flash.fret, filled: true, color: flash.color }] : [])];
  const allFound = uniqueScaleNotes.every((n) => foundNotes.includes(n));
  const tunedCount = guitarStrings.filter((s) => tuning && tuning[s.id]).length;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
        <StatCard label="Scale" value={`${CHROMATIC[rootIdx]} ${scale.label}`} />
        <StatCard label="Found" value={`${foundNotes.length} / ${uniqueScaleNotes.length}`} />
        <StatCard label="Strings tuned" value={`${tunedCount} / ${guitarStrings.length}`} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "#9aa2ac", marginBottom: 6 }}>Pattern system</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {PATTERN_SYSTEMS.map((sys) => (
            <Chip key={sys.id} active={patternSystem === sys.id} onClick={() => setPatternSystem(sys.id)}>
              {sys.label}
            </Chip>
          ))}
        </div>
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
          {SCALE_PATTERNS.filter((sc) => systemAllowsScale(patternSystem, sc.id)).map((sc) => (
            <Chip key={sc.id} active={scaleId === sc.id} onClick={() => setScaleId(sc.id)}>
              {sc.label}
            </Chip>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <Chip active={revealScale} onClick={() => setRevealScale((v) => !v)}>
            {revealScale ? "Reveal on" : "Reveal scale positions"}
          </Chip>
          {revealScale && (
            <Chip active={anchorRoot} onClick={() => setAnchorRoot((v) => !v)}>
              {anchorRoot ? `Anchor: root on ${(guitarStrings.find((s) => s.id === anchorString) || {}).label || anchorString}` : "Anchor to root string"}
            </Chip>
          )}
        </div>
        {revealScale && (
          <div style={{ marginTop: 10 }}>
            {anchorRoot ? (
              <>
                <div style={{ fontSize: 13, color: "#9aa2ac", marginBottom: 6 }}>Anchor root to string</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {guitarStrings.map((s) => (
                    <Chip key={s.id} active={anchorString === s.id} onClick={() => setAnchorString(s.id)}>
                      {s.label}
                    </Chip>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: "#9aa2ac", marginBottom: 6 }}>Position</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {positions.map((p, i) => (
                    <Chip key={p.id || i} active={positionIndex === i} onClick={() => setPositionIndex(i)}>
                      {positionLabel(p, i)}
                    </Chip>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {mic.status !== "active" && (
        <div style={{ textAlign: "center", padding: "22px 16px", border: "1px dashed #2a2f3a", borderRadius: 10, marginBottom: 20 }}>
          <p style={{ color: "#9aa2ac", fontSize: 14, marginBottom: 14 }}>Scales listens through your microphone as you play.</p>
          <button className="ft-primary-btn" onClick={() => mic.start()} disabled={mic.status === "requesting"}>
            {mic.status === "requesting" ? "Requesting mic…" : "Enable microphone"}
          </button>
          {mic.status === "error" && <p style={{ color: "#e08a71", fontSize: 13, marginTop: 12 }}>{mic.error}</p>}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {sequence.map((n, i) => {
          const found = foundNotes.includes(n);
          return (
            <div
              key={i}
              style={{
                width: 34,
                height: 34,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                fontSize: 14,
                border: `1.5px solid ${found ? "#7cb37a" : "#2a2f3a"}`,
                background: found ? "#7cb37a22" : "transparent",
                color: found ? "#8fbb7f" : "#5a6270",
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
          <NotationStaff sequenceAbs={sequenceAbs} foundNotes={foundNotes} />
        )}
      </div>

      <div style={{ textAlign: "center", marginBottom: 18, minHeight: 40 }}>
        {allFound ? (
          <div className="ft-title" style={{ fontSize: 18, color: "#8fbb7f" }}>
            Every note in this scale found
          </div>
        ) : (
          <div style={{ fontSize: 14, color: "#9aa2ac" }}>
            Play any note in <strong style={{ color: "#f3ead9" }}>{CHROMATIC[rootIdx]} {scale.label}</strong> — any string, any order.
          </div>
        )}
      </div>

      <div style={{ textAlign: "center", marginBottom: 10 }}>
        <button onClick={resetRun} style={{ background: "transparent", border: "1px solid #2a2f3a", color: "#9aa2ac", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>
          Reset progress
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
  const maxFret = 15; // fixed — no longer a user setting
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
          {page === "scales" && "Pick a scale, choose a position, and play its notes — recognized fretboard patterns."}
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
