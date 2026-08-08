import { useState, useCallback, useEffect, useRef } from "react";
import { StatCard } from "./shared.jsx";
import { STRINGS, centsBetween, timeAgo } from "../theory.js";

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

export default function TunerPage({ mic, tuning, onUpdateTuning, guitarStrings }) {
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
        Play each string and hold it steady — it locks in automatically once it's in tune. Tuned strings teach the app your guitar's exact pitch and timbre, so practice modes recognize only your guitar — a tune on the TV won't count anymore.
      </p>
    </div>
  );
}
