import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMic } from "./audio.js";
import { storage, TUNING_KEY } from "./storage.js";
import { CHROMATIC, STRINGS, TUNING_PRESETS, tunedStrings } from "./theory.js";
import { Chip, TuneBanner } from "./components/shared.jsx";
import TunerPage from "./components/TunerPage.jsx";
import FindMode from "./components/FindMode.jsx";
import ScalesMode from "./components/ScalesMode.jsx";
import "./assets/fonts.css"; // fonts are bundled locally so the app needs no internet

const MAX_FRET = 23; // a standard 23-fret neck — lets every CAGED form (incl. the G form at the 15th) fit in every key

// true when the viewing platform is wider than it is tall — landscape phones, tablets,
// and every desktop monitor. Portrait phones keep the single-column layout; landscape
// gets the wide fretboard-first layout.
function useOrientation() {
  const [landscape, setLandscape] = useState(() => typeof window !== "undefined" && window.innerWidth > window.innerHeight);
  useEffect(() => {
    if (!window.matchMedia) return;
    const q = window.matchMedia("(orientation: landscape)");
    const onChange = (e) => setLandscape(e.matches);
    setLandscape(q.matches);
    q.addEventListener("change", onChange);
    return () => q.removeEventListener("change", onChange);
  }, []);
  return landscape;
}

// true on touch-first handheld devices (phones, tablets). Only these stretch the
// fretboard to fill the whole screen in landscape — a desktop monitor would blow the
// board up to absurd proportions, so it keeps the natural-height fretboard instead.
function useHandheld() {
  const [handheld, setHandheld] = useState(() => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);
  useEffect(() => {
    if (!window.matchMedia) return;
    const q = window.matchMedia("(pointer: coarse)");
    const onChange = (e) => setHandheld(e.matches);
    setHandheld(q.matches);
    q.addEventListener("change", onChange);
    return () => q.removeEventListener("change", onChange);
  }, []);
  return handheld;
}

export default function FretboardTrainer() {
  const [page, setPage] = useState("tuner");
  const [tuningPresetId, setTuningPresetId] = useState("standard");
  const [activeStrings, setActiveStrings] = useState(STRINGS.map((s) => s.id));
  const [tuning, setTuning] = useState(null); // null = loading; holds mic-CALIBRATED frequencies (separate from the tuning preset above)
  const [settingsOpen, setSettingsOpen] = useState(true); // the settings panel, collapsed by default on short landscape screens
  const mic = useMic();
  const landscape = useOrientation();
  const handheld = useHandheld();
  const scalesLandscape = handheld && landscape && page === "scales"; // scales page fills the whole screen on handhelds

  // close the settings panel when entering landscape (screen height is scarce); a manual
  // toggle afterwards is respected until the next rotation into landscape
  useEffect(() => {
    if (landscape) setSettingsOpen(false);
  }, [landscape]);

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
    const goFind = () => setPage("find");
    window.addEventListener("ft-go-find", goFind);
    return () => window.removeEventListener("ft-go-find", goFind);
  }, []);

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

  // the mic is a single global resource toggled by the header button. The scales page
  // temporarily mutes it during playback (see playRun), and shuts it down on unmount.
  useEffect(() => () => mic.stop(), [mic.stop]);

  function toggleString(id) {
    setActiveStrings((prev) => (prev.includes(id) ? (prev.length > 1 ? prev.filter((s) => s !== id) : prev) : [...prev, id]));
  }

  return (
      <div
        style={{
          background: "radial-gradient(1100px 520px at 18% -10%, #1d2431 0%, #12151a 55%, #0d1016 100%)",
          minHeight: "100%",
          padding: scalesLandscape ? 0 : landscape ? "14px 14px 26px" : "28px 18px 36px",
          fontFamily: "'Inter', system-ui, sans-serif",
          color: "#f3ead9",
          boxSizing: "border-box",
        }}
      >
      <style>{`
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

      <div
        style={{
          maxWidth: scalesLandscape ? "100vw" : landscape ? "min(100vw - 24px, 1500px)" : 780,
          margin: "0 auto",
          ...(scalesLandscape ? { height: "100vh", display: "flex", flexDirection: "column" } : {}),
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: landscape ? 0 : 4 }}>
          <h1 className="ft-title" style={{ fontSize: landscape ? 22 : 28, margin: 0, letterSpacing: 0.3, background: "linear-gradient(120deg, #f3ead9 0%, #e0a95f 60%, #c98a4a 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Fretboard Trainer
          </h1>
          <span className="ft-mono" style={{ fontSize: landscape ? 10 : 12, color: "#e0a95f", letterSpacing: 1 }}>
            LEARN EVERY NOTE, EVERY STRING
          </span>
        </div>
        {!landscape && (
          <p style={{ margin: "0 0 18px", color: "#9aa2ac", fontSize: 14, lineHeight: 1.5 }}>
            {page === "tuner" && "Get in tune — it quietly teaches the app your guitar's voice (pitch and timbre) at the same time. The calibrate tab records your guitar's timbre at every shared-note spot."}
            {page === "find" && "Find a note on each string by ear, or name a lit fret with a click — your choice."}
            {page === "scales" && "Pick a scale and key, see every note lit across the neck, then tap to shape your own pattern — save it for later."}
          </p>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: landscape ? 10 : 18, flexWrap: "wrap", alignItems: "center" }}>
          <Chip active={page === "tuner"} onClick={() => setPage("tuner")}>
            Tuner
          </Chip>
          <Chip active={page === "find"} onClick={() => setPage("find")}>
            Find It
          </Chip>
          <Chip active={page === "scales"} onClick={() => setPage("scales")}>
            Scales
          </Chip>
          <span style={{ flex: 1 }} />
          <button
            onClick={() => (mic.status === "active" ? mic.stop() : mic.start())}
            disabled={mic.status === "requesting"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "transparent",
              border: `1px solid ${mic.status === "active" ? "#7cb37a" : "#2a2f3a"}`,
              color: mic.status === "active" ? "#7cb37a" : "#9aa2ac",
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 999, background: mic.status === "active" ? "#7cb37a" : mic.status === "error" ? "#e08a71" : "#4a5160" }} />
            {mic.status === "active" ? "Mic on" : mic.status === "requesting" ? "Mic…" : mic.status === "error" ? "Mic error" : "Mic off"}
          </button>
        </div>

        {page !== "tuner" && <TuneBanner tuning={tuning} onGoTune={() => setPage("tuner")} guitarStrings={guitarStrings} />}

        {tuning === null ? (
          <div style={{ textAlign: "center", color: "#5a6270", padding: 30 }}>loading…</div>
        ) : (
          <div className="ft-fade" key={page} style={scalesLandscape ? { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } : undefined}>
            {page === "tuner" && <TunerPage mic={mic} tuning={tuning} onUpdateTuning={updateTuning} onUpdateSpot={updateSpot} maxFret={MAX_FRET} guitarStrings={guitarStrings} />}
            {page === "find" && <FindMode mic={mic} maxFret={MAX_FRET} activeStrings={activeStrings} tuning={tuning} onGoTune={() => setPage("tuner")} guitarStrings={guitarStrings} />}
            {page === "scales" && <ScalesMode maxFret={MAX_FRET} activeStrings={activeStrings} guitarStrings={guitarStrings} tuning={tuning} mic={mic} landscape={landscape} fill={handheld && landscape} />}
          </div>
        )}

        <div style={{ background: "#1b1f27", border: "1px solid #2a2f3a", borderRadius: 10, padding: 16, marginTop: landscape ? 12 : 22 }}>
          <div onClick={() => setSettingsOpen((o) => !o)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}>
            <div className="ft-mono" style={{ fontSize: 11, letterSpacing: 1, color: "#e0a95f" }}>
              SETTINGS
            </div>
            <span style={{ color: "#7a8290", fontSize: 13 }}>{settingsOpen ? "▾" : "▸"}</span>
          </div>
          {settingsOpen && (
            <>
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 13, color: "#9aa2ac", marginBottom: 6 }}>Tuning</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {TUNING_PRESETS.map((t) => (
                    <Chip key={t.id} active={tuningPresetId === t.id} onClick={() => setTuningPresetId(t.id)}>
                      {t.label}
                    </Chip>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 13, color: "#9aa2ac", marginBottom: 6 }}>Strings</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[...guitarStrings].reverse().map((s) => (
                    <Chip key={s.id} active={activeStrings.includes(s.id)} onClick={() => toggleString(s.id)}>
                      {s.open} string
                    </Chip>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
