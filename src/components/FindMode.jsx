import { useCallback, useEffect, useRef, useState } from "react";
import { StatCard } from "./shared.jsx";
import FretboardSVG from "./FretboardSVG.jsx";
import { CHROMATIC, displayName, freqToNote, matchReading } from "../theory.js";

// note patterns repeat every octave, so Find It only needs one octave of the neck
const FIND_FRETS = 12;

export default function FindMode({ mic, maxFret, activeStrings, tuning, onGoTune, guitarStrings }) {
  const neckMax = Math.min(maxFret, FIND_FRETS);
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
      if (!s) return;
      const name = s.freq ? freqToNote(s.freq).name : null;
      setReading({ name });
      const now = Date.now();
      // only confident, in-tune, guitar-timbre sounds count — see matchReading
      const pos = matchReading(s, { guitarStrings, activeStrings, maxFret: neckMax, tuning });
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
    }, 50);
    return () => {
      clearInterval(intervalRef.current);
      clearTimeout(flashTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mic.status, note, guitarStrings, activeStrings, neckMax, tuning]);

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
        <StatCard label="Target note" value={displayName(note)} />
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
        <FretboardSVG maxFret={neckMax} activeStrings={activeStrings} markers={markers} pulse={flash} guitarStrings={guitarStrings} />
      </div>

      <div style={{ textAlign: "center", marginBottom: 18, minHeight: 40 }}>
        <div style={{ fontSize: 14, color: "#9aa2ac" }}>
          Play <strong style={{ color: "#f3ead9" }}>{displayName(note)}</strong> anywhere in frets 0–12 — any string, as many times as you like.
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
