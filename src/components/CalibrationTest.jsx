import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StatCard } from "./shared.jsx";
import FretboardSVG from "./FretboardSVG.jsx";
import { displayName, unisonSpots, centsBetween } from "../theory.js";

// records a timbre fingerprint at every unison position (notes that exist at the
// exact same pitch on two strings). The tie-break in nearestPosition uses these
// spot fingerprints to tell which string the player actually used.
export default function CalibrationTest({ mic, tuning, onUpdateSpot, guitarStrings, maxFret }) {
  const spots = useMemo(() => unisonSpots(guitarStrings, Math.min(maxFret, 12)), [guitarStrings, maxFret]);
  const [index, setIndex] = useState(0);
  const [recorded, setRecorded] = useState(() => new Set());
  const [reading, setReading] = useState(null);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const stableRef = useRef(null);
  const bufRef = useRef([]);
  const spotsRef = useRef(spots);
  spotsRef.current = spots;

  const target = (spotsRef.current[index] || null);
  const expectedFreq = useCallback(
    (sp) => {
      const cal = tuning && tuning[sp.stringId];
      const base = (cal && cal.freq) || guitarStrings.find((s) => s.id === sp.stringId).openFreq;
      return base * Math.pow(2, sp.fret / 12);
    },
    [tuning, guitarStrings]
  );
  const expectedFreqRef = useRef(expectedFreq);
  expectedFreqRef.current = expectedFreq;

  useEffect(() => {
    const spotsNow = spotsRef.current;
    const targetNow = spotsNow[index] || null;
    if (mic.status !== "active" || !targetNow) return;
    const interval = setInterval(() => {
      const s = mic.sample();
      if (!s || !s.freq) {
        stableRef.current = null;
        bufRef.current = [];
        setReading(null);
        setProgress(0);
        return;
      }
      const cents = centsBetween(s.freq, expectedFreqRef.current(targetNow));
      setReading(cents);
      if (Math.abs(cents) < 30 && s.confident) {
        if (!stableRef.current) {
          stableRef.current = Date.now();
          bufRef.current = [];
        }
        bufRef.current.push(s);
        const p = Math.min(1, (Date.now() - stableRef.current) / 500);
        setProgress(p);
        if (p >= 1) {
          const bufs = bufRef.current;
          const avgFp = [0, 0, 0, 0, 0];
          bufs.forEach((b) => b.fingerprint.forEach((v, i) => (avgFp[i] += v / bufs.length)));
          const avgFreq = bufs.reduce((sum, b) => sum + b.freq, 0) / bufs.length;
          onUpdateSpot(targetNow.stringId, targetNow.fret, { freq: avgFreq, fingerprint: avgFp });
          setRecorded((prev) => new Set(prev).add(`${targetNow.stringId}:${targetNow.fret}`));
          stableRef.current = null;
          bufRef.current = [];
          setProgress(0);
          setTimeout(() => {
            if (index + 1 >= spotsNow.length) setDone(true);
            else setIndex((i) => i + 1);
            setReading(null);
          }, 600);
        }
      } else {
        stableRef.current = null;
        bufRef.current = [];
        setProgress(0);
      }
    }, 90);
    return () => {
      clearInterval(interval);
      clearTimeout(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mic.status, index, onUpdateSpot]);

  const skip = () => {
    stableRef.current = null;
    bufRef.current = [];
    setProgress(0);
    setReading(null);
    if (index + 1 >= spots.length) setDone(true);
    else setIndex((i) => i + 1);
  };

  const restart = () => {
    setIndex(0);
    setRecorded(new Set());
    setDone(false);
    setReading(null);
    setProgress(0);
  };

  const markers = spots
    .filter((sp) => recorded.has(`${sp.stringId}:${sp.fret}`))
    .map((sp) => ({ stringId: sp.stringId, fret: sp.fret, filled: true, color: "#7cb37a" }));

  if (!spots.length) {
    return <p style={{ color: "#9aa2ac", fontSize: 14 }}>No shared-note positions in this tuning — nothing to calibrate.</p>;
  }

  if (done) {
    return (
      <div style={{ textAlign: "center", padding: 26, border: "1px solid #2a2f3a", borderRadius: 10 }}>
        <div className="ft-title" style={{ fontSize: 20, marginBottom: 8 }}>
          Calibration complete
        </div>
        <p style={{ color: "#9aa2ac", fontSize: 14, marginBottom: 6 }}>
          {recorded.size} of {spots.length} unison positions recorded.
          {recorded.size < spots.length && " Skipped spots fall back to the open-string timbre."}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 14 }}>
          <button className="ft-primary-btn" onClick={() => restart()} style={{ background: "transparent", border: "1px solid #2a2f3a", color: "#9aa2ac" }}>
            Run again
          </button>
          <button className="ft-primary-btn" onClick={() => window.dispatchEvent(new CustomEvent("ft-go-find"))}>
            Start finding notes
          </button>
        </div>
      </div>
    );
  }

  const s = guitarStrings.find((x) => x.id === target.stringId);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
        <StatCard label="Position" value={`${recorded.size + 1} / ${spots.length}`} />
        <StatCard label="Play" value={s ? `${s.label} string, fret ${target.fret}` : ""} />
        <StatCard label="Note" value={displayName(target.note)} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <FretboardSVG
          maxFret={Math.min(maxFret, 12)}
          activeStrings={guitarStrings.map((g) => g.id)}
          markers={markers}
          pulse={{ stringId: target.stringId, fret: target.fret, color: "#e0a95f" }}
          guitarStrings={guitarStrings}
        />
      </div>

      <div style={{ textAlign: "center", minHeight: 44, marginBottom: 12 }}>
        {reading === null ? (
          <span style={{ fontSize: 13, color: "#5a6270" }}>
            {mic.status === "active" ? "Play this spot and hold it steady…" : "Enable the microphone to begin."}
          </span>
        ) : Math.abs(reading) < 30 ? (
          <span className="ft-mono" style={{ fontSize: 13, color: "#7cb37a" }}>
            {progress >= 1 ? "recording ✓" : `in tune · ${Math.round(progress * 100)}%`}
          </span>
        ) : (
          <span className="ft-mono" style={{ fontSize: 13, color: "#e0a95f" }}>
            {Math.round(reading)}¢ off
          </span>
        )}
      </div>

      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: "#9aa2ac", margin: "0 0 10px" }}>
          These are the spots where the same note lives on two strings — the app learns your guitar's timbre here so Find It knows which string you're actually playing.
        </p>
        <button
          onClick={skip}
          style={{ background: "transparent", border: "1px solid #2a2f3a", color: "#9aa2ac", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13 }}
        >
          Skip this spot
        </button>
      </div>
    </div>
  );
}
