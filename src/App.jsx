import { useState, useEffect, useCallback, useRef } from "react";

const CHROMATIC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// display order top -> bottom mirrors standard tab notation (high e on top)
const STRINGS = [
  { id: "e1", label: "e", open: "E", openFreq: 329.63, thickness: 1.4 },
  { id: "B", label: "B", open: "B", openFreq: 246.94, thickness: 1.7 },
  { id: "G", label: "G", open: "G", openFreq: 196.0, thickness: 2.1 },
  { id: "D", label: "D", open: "D", openFreq: 146.83, thickness: 2.6 },
  { id: "A", label: "A", open: "A", openFreq: 110.0, thickness: 3.2 },
  { id: "e2", label: "E", open: "E", openFreq: 82.41, thickness: 3.8 },
];

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
function getOpenFreq(stringId, tuning) {
  const t = tuning && tuning[stringId];
  if (t && t.freq) return t.freq;
  return STRINGS.find((s) => s.id === stringId).openFreq;
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
  if (rms < 0.012) return { freq: null, clarity: 0 };

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
  if (n < 8) return { freq: null, clarity: 0 };
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
  if (maxPos <= 0) return { freq: null, clarity: 0 };
  const x1 = c[maxPos - 1] ?? c[maxPos];
  const x2 = c[maxPos];
  const x3 = c[maxPos + 1] ?? c[maxPos];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  let T0 = maxPos;
  if (a) T0 = maxPos - b / (2 * a);
  const freq = sampleRate / T0;
  const clarity = c[0] ? maxVal / c[0] : 0;
  if (freq < 55 || freq > 900) return { freq: null, clarity: 0 };
  return { freq, clarity };
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
function fingerprintDistance(a, b) {
  if (!a || !b) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) * (a[i] - b[i]);
  return Math.sqrt(sum);
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
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const source = ctx.createMediaStreamSource(stream);
      const timeAnalyser = ctx.createAnalyser();
      timeAnalyser.fftSize = 2048;
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
    const { freq, clarity } = autoCorrelate(buf, ctx.sampleRate);
    if (!freq || clarity < 0.85) return null;
    const freqBytes = freqBufRef.current;
    freqAnalyser.getByteFrequencyData(freqBytes);
    const fingerprint = extractFingerprint(freqBytes, freq, ctx.sampleRate, freqAnalyser.fftSize);
    return { freq, clarity, fingerprint };
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
function TuneBanner({ tuning, onGoTune }) {
  const timestamps = STRINGS.map((s) => tuning && tuning[s.id] && tuning[s.id].tunedAt).filter(Boolean);
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

function FretboardSVG({ maxFret, activeStrings, markers, pulse }) {
  const boardLeft = 46;
  const totalWidth = 54 * maxFret;
  const boardWidth = boardLeft + totalWidth + 26;
  const rowHeight = 34;
  const boardTop = 18;
  const boardHeight = rowHeight * (STRINGS.length - 1) + 28;
  const inlayFrets = [3, 5, 7, 9, 15, 17, 19, 21];
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
            const dots = f === 12 ? [cy - 22, cy + 22] : [cy];
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

        {STRINGS.map((s, idx) => {
          const y = boardTop + 14 + idx * rowHeight;
          const dimmed = !activeStrings.includes(s.id);
          return (
            <g key={s.id} opacity={dimmed ? 0.28 : 1}>
              <text x={16} y={y + 4} fontSize={13} fill="#f3ead9" className="ft-mono" textAnchor="middle">
                {s.label}
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
          const idx = STRINGS.findIndex((s) => s.id === m.stringId);
          const y = boardTop + 14 + idx * rowHeight;
          const x = cellMidX(m.fret);
          const isPulse = pulse && pulse.stringId === m.stringId && pulse.fret === m.fret;
          return (
            <g key={i} onClick={m.onClick} style={{ cursor: m.onClick ? "pointer" : "default" }}>
              {isPulse && <circle cx={x} cy={y} r={18} fill="url(#markerglow2)" opacity={0.7} />}
              <circle cx={x} cy={y} r={m.filled ? 10 : 9} fill={m.filled ? m.color : "transparent"} stroke={m.color} strokeWidth={m.filled ? 1.5 : 2} />
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
  const cx = 140,
    cy = 130,
    r = 100;
  const ticks = [-50, -25, 0, 25, 50];
  return (
    <svg width={280} height={150} viewBox="0 0 280 150">
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} stroke="#2a2f3a" strokeWidth={3} fill="none" />
      {ticks.map((t) => {
        const a = (t / 50) * 60 * (Math.PI / 180) - Math.PI / 2;
        const x1 = cx + Math.cos(a) * (r - 10);
        const y1 = cy + Math.sin(a) * (r - 10);
        const x2 = cx + Math.cos(a) * r;
        const y2 = cy + Math.sin(a) * r;
        return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} stroke={t === 0 ? "#e0a95f" : "#5a6270"} strokeWidth={t === 0 ? 3 : 2} />;
      })}
      <line
        x1={cx}
        y1={cy}
        x2={cx + Math.cos((angle * Math.PI) / 180 - Math.PI / 2) * (r - 20)}
        y2={cy + Math.sin((angle * Math.PI) / 180 - Math.PI / 2) * (r - 20)}
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        style={{ transition: "all 0.12s ease" }}
      />
      <circle cx={cx} cy={cy} r={6} fill={color} />
      <text x={cx - r + 2} y={cy + 20} fontSize={10} fill="#7a8290" className="ft-mono">
        flat
      </text>
      <text x={cx + r - 20} y={cy + 20} fontSize={10} fill="#7a8290" className="ft-mono">
        sharp
      </text>
    </svg>
  );
}

function TunerPage({ mic, tuning, onUpdateTuning }) {
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
      if (!s) {
        setReading(null);
        setDetectedString(null);
        stableStartRef.current = null;
        setLockProgress(0);
        return;
      }
      // find nearest string by target frequency (within ~4 semitones)
      let best = null,
        bestCents = Infinity;
      STRINGS.forEach((str) => {
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

      if (Math.abs(bestCents) < 4) {
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
  }, [mic.status]);

  const tunedCount = STRINGS.filter((s) => tuning && tuning[s.id]).length;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
        <StatCard label="Strings tuned" value={`${tunedCount} / 6`} />
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

      <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
        <TunerGauge cents={reading ? reading.cents : null} active={!!reading} />
      </div>
      <div style={{ textAlign: "center", marginBottom: 22, minHeight: 20 }}>
        {reading ? (
          <span className="ft-mono" style={{ fontSize: 13, color: "#9aa2ac" }}>
            {reading.cents > 0 ? "+" : ""}
            {Math.round(reading.cents)}¢ {Math.abs(reading.cents) < 4 ? "· holding…" : ""}
          </span>
        ) : (
          <span style={{ fontSize: 13, color: "#5a6270" }}>{mic.status === "active" ? "waiting for a string…" : ""}</span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
        {STRINGS.map((s) => {
          const data = tuning && tuning[s.id];
          const isCurrent = detectedString === s.id;
          const isLocking = isCurrent && lockProgress > 0;
          const isJustLocked = justLocked === s.id;
          return (
            <div
              key={s.id}
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
                {s.label}
              </div>
              <div style={{ fontSize: 10, color: data ? "#8fbb7f" : "#5a6270", marginTop: 4 }}>
                {isJustLocked ? "locked ✓" : data ? timeAgo(data.tunedAt) : "not tuned"}
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 12, color: "#5a6270", marginTop: 14, textAlign: "center" }}>
        Play each string and hold it steady — it locks in automatically once it's in tune. You can leave any time; untuned strings just fall back to standard pitch.
      </p>
    </div>
  );
}

// ---------- Identify mode ----------

function IdentifyMode({ maxFret, activeStrings }) {
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
    const pool = activeStrings.length ? activeStrings : STRINGS.map((s) => s.id);
    const stringId = pool[Math.floor(Math.random() * pool.length)];
    const stringDef = STRINGS.find((s) => s.id === stringId);
    const fret = Math.floor(Math.random() * (maxFret + 1));
    const note = noteAt(stringDef.open, fret);
    setPrompt({ stringId, fret, note });
    setFeedback(null);
  }, [activeStrings, maxFret]);

  useEffect(() => {
    nextPrompt();
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (prompt && (!activeStrings.includes(prompt.stringId) || prompt.fret > maxFret)) nextPrompt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStrings, maxFret]);

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
        <FretboardSVG maxFret={maxFret} activeStrings={activeStrings} markers={markers} pulse={null} />
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

function computeGroups(note, maxFret, activeStrings, tuning) {
  const positions = [];
  STRINGS.forEach((s) => {
    if (!activeStrings.includes(s.id)) return;
    const openFreq = getOpenFreq(s.id, tuning);
    const openIdx = CHROMATIC.indexOf(s.open);
    const targetIdx = CHROMATIC.indexOf(note);
    const fret = (targetIdx - openIdx + 12) % 12;
    positions.push({ stringId: s.id, fret, freq: freqAt(openFreq, fret) });
    if (fret + 12 <= maxFret) positions.push({ stringId: s.id, fret: fret + 12, freq: freqAt(openFreq, fret + 12) });
  });
  const groups = [];
  positions.forEach((p) => {
    const g = groups.find((g) => Math.abs(1200 * Math.log2(g.freq / p.freq)) < 15);
    if (g) g.positions.push(p);
    else groups.push({ freq: p.freq, positions: [p], credited: [] });
  });
  groups.sort((a, b) => a.freq - b.freq);
  return groups;
}

function FindMode({ mic, maxFret, activeStrings, tuning, onGoTune }) {
  const [note, setNote] = useState(() => CHROMATIC[Math.floor(Math.random() * 12)]);
  const [groups, setGroups] = useState(() => computeGroups(note, maxFret, activeStrings, tuning));
  const [reading, setReading] = useState(null);
  const [pulse, setPulse] = useState(null);
  const intervalRef = useRef(null);
  const lastMatchRef = useRef(0);

  useEffect(() => {
    setGroups(computeGroups(note, maxFret, activeStrings, tuning));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note, maxFret, activeStrings]);

  useEffect(() => {
    if (mic.status !== "active") return;
    intervalRef.current = setInterval(() => {
      const s = mic.sample();
      if (!s) return;
      const { name } = freqToNote(s.freq);
      setReading({ name });
      if (name !== note) return;
      const now = Date.now();
      if (now - lastMatchRef.current < 500) return;

      setGroups((prev) => {
        const groupIdx = prev.findIndex((g) => Math.abs(1200 * Math.log2(g.freq / s.freq)) < 40);
        if (groupIdx === -1) return prev;
        const group = prev[groupIdx];
        const candidates = group.positions.filter((p) => !(group.credited || []).includes(p.stringId));
        if (candidates.length === 0) return prev;
        let chosen = candidates[0];
        if (candidates.length > 1) {
          let bestDist = Infinity;
          candidates.forEach((c) => {
            const fp = tuning && tuning[c.stringId] && tuning[c.stringId].fingerprint;
            const dist = fingerprintDistance(s.fingerprint, fp);
            if (dist < bestDist) {
              bestDist = dist;
              chosen = c;
            }
          });
        }
        lastMatchRef.current = now;
        setPulse({ stringId: chosen.stringId, fret: chosen.fret });
        const next = [...prev];
        next[groupIdx] = { ...group, credited: [...(group.credited || []), chosen.stringId] };
        return next;
      });
    }, 110);
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mic.status, note, tuning]);

  function toggleManual(stringId, fret) {
    setGroups((prev) => {
      const groupIdx = prev.findIndex((g) => g.positions.some((p) => p.stringId === stringId && p.fret === fret));
      if (groupIdx === -1) return prev;
      const group = prev[groupIdx];
      const credited = group.credited || [];
      const nextCredited = credited.includes(stringId) ? credited.filter((id) => id !== stringId) : [...credited, stringId];
      const next = [...prev];
      next[groupIdx] = { ...group, credited: nextCredited };
      return next;
    });
  }

  const totalPositions = groups.reduce((sum, g) => sum + g.positions.length, 0);
  const foundPositions = groups.reduce((sum, g) => sum + (g.credited ? g.credited.length : 0), 0);
  const allFound = totalPositions > 0 && foundPositions >= totalPositions;
  const tunedCount = STRINGS.filter((s) => tuning && tuning[s.id]).length;

  const markers = groups.flatMap((g) =>
    g.positions.map((p) => {
      const isFound = (g.credited || []).includes(p.stringId);
      return { stringId: p.stringId, fret: p.fret, filled: isFound, color: isFound ? "#7cb37a" : "#e0a95f", onClick: () => toggleManual(p.stringId, p.fret) };
    })
  );

  function newNote() {
    setNote(CHROMATIC[Math.floor(Math.random() * 12)]);
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
        <StatCard label="Target note" value={note} />
        <StatCard label="Found" value={`${foundPositions} / ${totalPositions}`} />
        <StatCard label="Strings tuned" value={`${tunedCount} / 6`} />
      </div>

      {mic.status !== "active" && (
        <div style={{ textAlign: "center", padding: "22px 16px", border: "1px dashed #2a2f3a", borderRadius: 10, marginBottom: 20 }}>
          <p style={{ color: "#9aa2ac", fontSize: 14, marginBottom: 14 }}>Find It listens through your microphone as you play. Turn it on to begin.</p>
          <button className="ft-primary-btn" onClick={() => mic.start()} disabled={mic.status === "requesting"}>
            {mic.status === "requesting" ? "Requesting mic…" : "Enable microphone"}
          </button>
          {mic.status === "error" && <p style={{ color: "#e08a71", fontSize: 13, marginTop: 12 }}>{mic.error} — you can still tap positions manually below.</p>}
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <FretboardSVG maxFret={maxFret} activeStrings={activeStrings} markers={markers} pulse={pulse} />
      </div>

      <div style={{ textAlign: "center", marginBottom: 18, minHeight: 40 }}>
        {allFound ? (
          <>
            <div className="ft-title" style={{ fontSize: 18, color: "#8fbb7f", marginBottom: 10 }}>
              Found every {note} on the neck
            </div>
            <button className="ft-primary-btn" onClick={newNote}>
              Next note
            </button>
          </>
        ) : (
          <div style={{ fontSize: 14, color: "#9aa2ac" }}>
            Play every <strong style={{ color: "#f3ead9" }}>{note}</strong> within your fret range — any string, any octave.
          </div>
        )}
      </div>

      {!allFound && (
        <div style={{ textAlign: "center", marginBottom: 10 }}>
          <button onClick={newNote} style={{ background: "transparent", border: "1px solid #2a2f3a", color: "#9aa2ac", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>
            Skip to a different note
          </button>
        </div>
      )}

      {tunedCount < 6 && (
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
  const [activeStrings, setActiveStrings] = useState(STRINGS.map((s) => s.id));
  const [tuning, setTuning] = useState(null); // null = loading
  const mic = useMic();

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
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          <Chip active={page === "tuner"} onClick={() => setPage("tuner")}>
            Tuner
          </Chip>
          <Chip active={page === "identify"} onClick={() => setPage("identify")}>
            Note ID
          </Chip>
          <Chip active={page === "find"} onClick={() => setPage("find")}>
            Find It
          </Chip>
        </div>

        {page !== "tuner" && <TuneBanner tuning={tuning} onGoTune={() => setPage("tuner")} />}

        {tuning === null ? (
          <div style={{ textAlign: "center", color: "#5a6270", padding: 30 }}>loading…</div>
        ) : (
          <>
            {page === "tuner" && <TunerPage mic={mic} tuning={tuning} onUpdateTuning={updateTuning} />}
            {page === "identify" && <IdentifyMode maxFret={maxFret} activeStrings={activeStrings} />}
            {page === "find" && <FindMode mic={mic} maxFret={maxFret} activeStrings={activeStrings} tuning={tuning} onGoTune={() => setPage("tuner")} />}
          </>
        )}

        {page !== "tuner" && (
          <div style={{ background: "#1b1f27", border: "1px solid #2a2f3a", borderRadius: 10, padding: 16, marginTop: 22 }}>
            <div className="ft-mono" style={{ fontSize: 11, letterSpacing: 1, color: "#e0a95f", marginBottom: 10 }}>
              SETTINGS
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: "#9aa2ac", marginBottom: 6 }}>Fret range</div>
              <div style={{ display: "flex", gap: 8 }}>
                {[5, 12, 15].map((n) => (
                  <Chip key={n} active={maxFret === n} onClick={() => setMaxFret(n)}>
                    0–{n}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: "#9aa2ac", marginBottom: 6 }}>Strings</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {STRINGS.map((s) => (
                  <Chip key={s.id} active={activeStrings.includes(s.id)} onClick={() => toggleString(s.id)}>
                    {s.label} string
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
