import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chip, StatCard } from "./shared.jsx";
import FretboardSVG from "./FretboardSVG.jsx";
import { CHROMATIC, displayName, freqToNote, matchReading, noteAt } from "../theory.js";

// note patterns repeat every octave, so the drill only needs one octave of the neck
const FIND_FRETS = 12;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function stringLabel(s) {
  if (s.id === "e1") return "high E";
  if (s.id === "e2") return "low E";
  return `${s.label} string`;
}

export default function FindMode({ mic, maxFret, activeStrings, guitarStrings, tuning, onGoTune }) {
  const neckMax = Math.min(maxFret, FIND_FRETS);
  const [mode, setMode] = useState("play"); // "play" = mic, "click" = tap the spot
  const [note, setNote] = useState(() => CHROMATIC[Math.floor(Math.random() * 12)]);
  const [stringIds, setStringIds] = useState([]);
  const [stringIndex, setStringIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [reading, setReading] = useState(null); // { name, stringId } from the mic
  const [marker, setMarker] = useState(null); // correct-answer reveal
  const [hl, setHl] = useState({ color: "#e0a95f", key: Date.now() }); // string highlight
  const intervalRef = useRef(null);
  const lastMatchRef = useRef(0);
  const lastWrongRef = useRef(0);
  const flashTimeoutRef = useRef(null);
  const redTimeoutRef = useRef(null);

  // Play it verifies which string you actually played via the tuner's timbre
  // fingerprints, so only calibrated strings can take part (unisons like low-E
  // open vs A-string fret 7 vs 12th fret are indistinguishable by pitch alone).
  const calibratedIds = useMemo(
    () => guitarStrings.filter((s) => tuning && tuning[s.id] && tuning[s.id].fingerprint).map((s) => s.id),
    [guitarStrings, tuning]
  );
  const pool = useMemo(
    () => (mode === "play" ? activeStrings.filter((id) => calibratedIds.includes(id)) : activeStrings),
    [mode, activeStrings, calibratedIds]
  );

  const targetStringId = !done && stringIds.length ? stringIds[stringIndex] : null;
  const targetString = targetStringId ? guitarStrings.find((s) => s.id === targetStringId) : null;

  const stringLabelById = useCallback(
    (id) => {
      const s = guitarStrings.find((x) => x.id === id);
      return s ? stringLabel(s) : "—";
    },
    [guitarStrings]
  );

  const startRound = useCallback(
    (n) => {
      setNote(n);
      setStringIds(shuffle(pool));
      setStringIndex(0);
      setDone(false);
      setMarker(null);
      setHl({ color: "#e0a95f", key: Date.now() });
      lastMatchRef.current = 0;
      lastWrongRef.current = 0;
      clearTimeout(flashTimeoutRef.current);
      clearTimeout(redTimeoutRef.current);
    },
    [pool]
  );

  const startRandom = useCallback(() => {
    startRound(CHROMATIC[Math.floor(Math.random() * 12)]);
  }, [startRound]);

  // a fresh shuffle whenever the string pool changes (mode switch, tuning/calibration
  // changes, or the enabled-string set changes — also runs once on mount)
  useEffect(() => {
    startRound(note);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startRound]);

  const switchMode = useCallback(
    (m) => {
      setMode(m);
      if (m === "click" && mic.status === "active") mic.stop();
    },
    [mic.status, mic.stop]
  );

  const advance = useCallback(() => {
    if (stringIndex + 1 >= stringIds.length) setDone(true);
    else setStringIndex(stringIndex + 1);
    setMarker(null);
    setHl({ color: "#e0a95f", key: Date.now() });
  }, [stringIndex, stringIds.length]);

  const flashWrong = useCallback(() => {
    const now = Date.now();
    setHl({ color: "#d9694e", key: now });
    clearTimeout(redTimeoutRef.current);
    redTimeoutRef.current = setTimeout(() => {
      setHl((h) => (h.key === now ? { color: "#e0a95f", key: Date.now() } : h));
    }, 700);
  }, []);

  const handleCorrect = useCallback(
    (stringId, fret) => {
      const now = Date.now();
      setMarker({ stringId, fret, color: "#7cb37a" });
      setHl({ color: "#7cb37a", key: now });
      clearTimeout(redTimeoutRef.current);
      clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = setTimeout(advance, 1200);
    },
    [advance]
  );

  const handleCellClick = useCallback(
    (stringId, fret) => {
      if (done || stringId !== targetStringId || !targetString) return;
      if (noteAt(targetString.open, fret) === note) handleCorrect(stringId, fret);
      else flashWrong();
    },
    [done, targetStringId, targetString, note, handleCorrect, flashWrong]
  );

  useEffect(() => {
    if (mic.status !== "active" || mode !== "play") return;
    intervalRef.current = setInterval(() => {
      const s = mic.sample();
      if (!s || !s.confident) return;
      // timbre-gated: returns the actual string+fret, or null if it isn't a
      // confident in-tune note on the calibrated guitar
      const pos = matchReading(s, { guitarStrings, activeStrings, maxFret: neckMax, tuning });
      const name = s.freq ? freqToNote(s.freq).name : null;
      setReading({ name, stringId: pos ? pos.stringId : null });
      if (!pos) return;
      const now = Date.now();
      if (done || !targetStringId) return;

      // strict: right pitch on the wrong string (open low-E for the A-string's
      // fret 7, the 12th-fret E, etc.) is a miss
      if (pos.stringId !== targetStringId || name !== note) {
        if (now - lastWrongRef.current < 600) return;
        lastWrongRef.current = now;
        flashWrong();
        return;
      }

      if (now - lastMatchRef.current < 600) return;
      lastMatchRef.current = now;
      handleCorrect(pos.stringId, pos.fret);
    }, 50);
    return () => {
      clearInterval(intervalRef.current);
      clearTimeout(flashTimeoutRef.current);
      clearTimeout(redTimeoutRef.current);
    };
  }, [mic.status, mode, note, done, targetStringId, guitarStrings, activeStrings, tuning, handleCorrect, flashWrong]);

  const handleSelect = (e) => {
    const v = e.target.value;
    if (v === "__random__") startRandom();
    else startRound(v);
  };

  const hearing = reading && reading.name ? `${displayName(reading.name)}${reading.stringId ? ` · ${stringLabelById(reading.stringId)}` : ""}` : "—";

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <Chip active={mode === "play"} onClick={() => switchMode("play")}>
          Play it
        </Chip>
        <Chip active={mode === "click"} onClick={() => switchMode("click")}>
          Name it
        </Chip>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
        <StatCard label="Target note" value={displayName(note)} />
        <StatCard label="Strings found" value={`${done ? stringIds.length : stringIndex} / ${stringIds.length}`} />
        <StatCard label={mode === "play" ? "Hearing" : "Target string"} value={mode === "play" ? hearing : targetString ? stringLabel(targetString) : "—"} />
      </div>

      {mode === "play" && mic.status !== "active" && (
        <div style={{ textAlign: "center", padding: "22px 16px", border: "1px dashed #2a2f3a", borderRadius: 10, marginBottom: 20 }}>
          <p style={{ color: "#9aa2ac", fontSize: 14, marginBottom: 14 }}>Find It listens through your microphone as you play. Turn it on to begin.</p>
          <button className="ft-primary-btn" onClick={() => mic.start()} disabled={mic.status === "requesting"}>
            {mic.status === "requesting" ? "Requesting mic…" : "Enable microphone"}
          </button>
          {mic.status === "error" && <p style={{ color: "#e08a71", fontSize: 13, marginTop: 12 }}>{mic.error}</p>}
        </div>
      )}

      {mode === "play" && pool.length === 0 ? (
        <div style={{ textAlign: "center", padding: "26px 16px", border: "1px solid #2a2f3a", borderRadius: 10 }}>
          <div className="ft-title" style={{ fontSize: 20, marginBottom: 8 }}>
            Play it needs a timbre profile
          </div>
          <p style={{ color: "#9aa2ac", fontSize: 14, maxWidth: 460, margin: "0 auto 14px" }}>
            The Tuner learns each string's unique voice — that's what lets the app tell the low-E from the A-string's 7th fret (they're the same pitch). Tune each string (3 steady plucks) to unlock it here.
          </p>
          <button className="ft-primary-btn" onClick={onGoTune}>
            Go to Tuner
          </button>
        </div>
      ) : (
        <>
          {mode === "play" && pool.length < activeStrings.length && (
            <div style={{ textAlign: "center", fontSize: 12, color: "#7a8290", marginBottom: 10 }}>
              {activeStrings.length - pool.length} string{activeStrings.length - pool.length > 1 ? "s" : ""} without a timbre profile aren't in this drill — tune them to add them.
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <select
              value={note}
              onChange={handleSelect}
              style={{ background: "#1b1f27", color: "#f3ead9", border: "1px solid #2a2f3a", borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}
            >
              {CHROMATIC.map((n) => (
                <option key={n} value={n}>
                  {displayName(n)}
                </option>
              ))}
            </select>
            <button onClick={startRandom} style={{ background: "transparent", border: "1px solid #2a2f3a", color: "#9aa2ac", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>
              Random note
            </button>
          </div>

          <div style={{ textAlign: "center", marginBottom: 14, minHeight: 44 }}>
            {done ? (
              <>
                <div className="ft-title" style={{ fontSize: 22, color: "#7cb37a" }}>
                  Found {displayName(note)} on all {stringIds.length} strings
                </div>
                <div style={{ fontSize: 13, color: "#9aa2ac", marginTop: 4 }}>Pick the next note to keep going.</div>
              </>
            ) : (
              <>
                <div className="ft-title" style={{ fontSize: 22 }}>
                  Find <span style={{ color: "#e0a95f" }}>{displayName(note)}</span> on the {targetString ? stringLabel(targetString) : "…"} string
                </div>
                <div style={{ fontSize: 13, color: "#9aa2ac", marginTop: 4 }}>{mode === "play" ? "Frets 0–12 — only that note on that string counts." : "Click the spot on the highlighted string — frets 0–12."}</div>
              </>
            )}
          </div>

          <div style={{ marginBottom: 14 }}>
            <FretboardSVG
              maxFret={neckMax}
              activeStrings={activeStrings}
              markers={marker ? [marker] : []}
              pulse={marker}
              highlightString={targetStringId}
              highlightColor={hl.color}
              highlightKey={hl.key}
              onCellClick={mode === "click" ? handleCellClick : undefined}
              guitarStrings={guitarStrings}
            />
          </div>
        </>
      )}
    </div>
  );
}
