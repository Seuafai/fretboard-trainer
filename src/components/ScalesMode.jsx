import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chip, StatCard } from "./shared.jsx";
import FretboardSVG from "./FretboardSVG.jsx";
import NotationStaff from "./NotationStaff.jsx";
import {
  CHROMATIC,
  SCALE_PATTERNS,
  PATTERN_SYSTEMS,
  MODE_NAMES,
  displayName,
  freqToNote,
  matchReading,
  systemAllowsScale,
  addFingers,
  buildScalePositions,
  buildCagedPositions,
  buildTwoOctavePositions,
  spelledScaleSequence,
} from "../theory.js";

export default function ScalesMode({ mic, maxFret, activeStrings, guitarStrings, onGoTune, tuning }) {
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

  // key-correct spelling of the scale (ending back on the root) for notation + chips
  const spelled = spelledScaleSequence(rootIdx, [...scale.intervals, 12]);
  const sequencePcs = spelled.map((n) => CHROMATIC[n.pc]); // sharp-name pitch classes, for matching
  const sequenceNames = spelled.map((n) => n.name);
  const uniqueScaleNotes = [...new Set(sequencePcs)];

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
      if (!s) return;
      const name = s.freq ? freqToNote(s.freq).name : null;
      setReading({ name });
      const now = Date.now();
      const pos = matchReading(s, {
        guitarStrings,
        activeStrings,
        maxFret,
        tuning,
        preferredRange: revealScale && activePosition ? { start: activePosition.start, end: activePosition.end } : null,
      });
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
    }, 50);
    return () => {
      clearInterval(intervalRef.current);
      clearTimeout(flashTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mic.status, sequencePcs.join(","), guitarStrings, activeStrings, maxFret, tuning, revealScale, positions, positionIndex, anchorRoot, anchorString]);

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
        <StatCard label="Scale" value={`${displayName(CHROMATIC[rootIdx])} ${scale.label}`} />
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
              {displayName(n)}
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
        {sequenceNames.map((n, i) => {
          const found = foundNotes.includes(sequencePcs[i]);
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
          <NotationStaff sequence={spelled} foundPcs={foundNotes} />
        )}
      </div>

      <div style={{ textAlign: "center", marginBottom: 18, minHeight: 40 }}>
        {allFound ? (
          <div className="ft-title" style={{ fontSize: 18, color: "#8fbb7f" }}>
            Every note in this scale found
          </div>
        ) : (
          <div style={{ fontSize: 14, color: "#9aa2ac" }}>
            Play any note in <strong style={{ color: "#f3ead9" }}>{displayName(CHROMATIC[rootIdx])} {scale.label}</strong> — any string, any order.
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
