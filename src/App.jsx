import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMic } from "./audio.js";
import { storage, TUNING_KEY } from "./storage.js";
import { CHROMATIC, STRINGS, TUNING_PRESETS, tunedStrings } from "./theory.js";
import { Chip, TuneBanner } from "./components/shared.jsx";
import TunerPage from "./components/TunerPage.jsx";
import IdentifyMode from "./components/IdentifyMode.jsx";
import FindMode from "./components/FindMode.jsx";
import ScalesMode from "./components/ScalesMode.jsx";
import CalibrationTest from "./components/CalibrationTest.jsx";

const MAX_FRET = 24; // a standard 24-fret neck — lets every CAGED form (incl. the G form at the 15th) fit in every key

export default function FretboardTrainer() {
  const [page, setPage] = useState("tuner");
  const [tuningPresetId, setTuningPresetId] = useState("standard");
  const [activeStrings, setActiveStrings] = useState(STRINGS.map((s) => s.id));
  const [tuning, setTuning] = useState(null); // null = loading; holds mic-CALIBRATED frequencies (separate from the tuning preset above)
  const mic = useMic();

  const tuningPreset = TUNING_PRESETS.find((t) => t.id === tuningPresetId) || TUNING_PRESETS[0];
  const guitarStrings = useMemo(() => tunedStrings(tuningPreset.notes), [tuningPreset]);

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

  // stable callback: records a timbre fingerprint at a unison spot (stringId, fret)
  // so the Find It tie-break can tell which string a note was actually played on.
  const updateSpot = useCallback((stringId, fret, data) => {
    setTuning((prev) => {
      const s = (prev && prev[stringId]) || {};
      const next = { ...(prev || {}), [stringId]: { ...s, spots: { ...(s.spots || {}), [fret]: { ...data, freq: (s.freq && data.freq) || null } } } };
      storage.set(TUNING_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  useEffect(() => {
    const goFind = () => setPage("find");
    window.addEventListener("ft-go-find", goFind);
    return () => window.removeEventListener("ft-go-find", goFind);
  }, []);

  function toggleString(id) {
    setActiveStrings((prev) => (prev.includes(id) ? (prev.length > 1 ? prev.filter((s) => s !== id) : prev) : [...prev, id]));
  }

  return (
    <div
      style={{
        background: "radial-gradient(1100px 520px at 18% -10%, #1d2431 0%, #12151a 55%, #0d1016 100%)",
        minHeight: "100%",
        padding: "28px 18px 36px",
        fontFamily: "'Inter', system-ui, sans-serif",
        color: "#f3ead9",
        boxSizing: "border-box",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bitter:wght@600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap');
        .ft-title { font-family: 'Bitter', Georgia, serif; }
        .ft-mono { font-family: 'JetBrains Mono', monospace; }
        .ft-note-btn { transition: transform 0.08s ease, box-shadow 0.15s ease, background 0.15s ease; }
        .ft-note-btn:active { transform: scale(0.94); }
        .ft-note-btn:not(:disabled):hover { box-shadow: 0 0 0 2px #e0a95f55; }
        .ft-chip { transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.08s ease; }
        .ft-chip:hover { transform: translateY(-1px); }
        .ft-primary-btn { background: #e0a95f; color: #14171c; border: none; border-radius: 8px; padding: 10px 18px; font-size: 14px; font-weight: 600; cursor: pointer; transition: filter 0.15s ease, transform 0.08s ease; }
        .ft-primary-btn:hover:not(:disabled) { filter: brightness(1.08); }
        .ft-primary-btn:disabled { opacity: 0.6; cursor: default; }
        .ft-fade { animation: ftFadeIn 0.28s ease; }
        @keyframes ftFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
      `}</style>

      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 4 }}>
          <h1 className="ft-title" style={{ fontSize: 28, margin: 0, letterSpacing: 0.3, background: "linear-gradient(120deg, #f3ead9 0%, #e0a95f 60%, #c98a4a 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Fretboard Trainer
          </h1>
          <span className="ft-mono" style={{ fontSize: 12, color: "#e0a95f", letterSpacing: 1 }}>
            LEARN EVERY NOTE, EVERY STRING
          </span>
        </div>
        <p style={{ margin: "0 0 18px", color: "#9aa2ac", fontSize: 14, lineHeight: 1.5 }}>
          {page === "tuner" && "Get in tune — it quietly teaches the app your guitar's voice (pitch and timbre) at the same time."}
          {page === "identify" && "A brass marker lights up a fret. Name the note before it fades."}
          {page === "find" && "Play back the note the app calls out — everywhere it lives on the neck."}
          {page === "scales" && "Pick a scale, choose a position, and play its notes — recognized fretboard patterns."}
          {page === "calibrate" && "Record your guitar's timbre at every shared-note spot so Find It knows which string you actually played."}
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
          <Chip active={page === "calibrate"} onClick={() => setPage("calibrate")}>
            Calibrate
          </Chip>
        </div>

        {page !== "tuner" && <TuneBanner tuning={tuning} onGoTune={() => setPage("tuner")} guitarStrings={guitarStrings} />}

        {tuning === null ? (
          <div style={{ textAlign: "center", color: "#5a6270", padding: 30 }}>loading…</div>
        ) : (
          <div className="ft-fade" key={page}>
            {page === "tuner" && <TunerPage mic={mic} tuning={tuning} onUpdateTuning={updateTuning} guitarStrings={guitarStrings} />}
            {page === "identify" && <IdentifyMode maxFret={MAX_FRET} activeStrings={activeStrings} guitarStrings={guitarStrings} />}
            {page === "find" && <FindMode mic={mic} maxFret={MAX_FRET} activeStrings={activeStrings} tuning={tuning} onGoTune={() => setPage("tuner")} guitarStrings={guitarStrings} />}
            {page === "scales" && <ScalesMode mic={mic} maxFret={MAX_FRET} activeStrings={activeStrings} guitarStrings={guitarStrings} tuning={tuning} onGoTune={() => setPage("tuner")} />}
            {page === "calibrate" && <CalibrationTest mic={mic} tuning={tuning} onUpdateSpot={updateSpot} maxFret={MAX_FRET} guitarStrings={guitarStrings} />}
          </div>
        )}

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
      </div>
    </div>
  );
}
