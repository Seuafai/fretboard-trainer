import { useEffect, useMemo, useRef, useState } from "react";
import { Chip, StatCard } from "./shared.jsx";
import FretboardSVG from "./FretboardSVG.jsx";
import NotationStaff from "./NotationStaff.jsx";
import {
  CHROMATIC,
  SCALE_PATTERNS,
  buildTextbookPositions,
  displayName,
  freqToNote,
  noteAt,
  addFingers,
  spelledScaleSequence,
} from "../theory.js";

const SCALES_PREFS_KEY = "ft.scales.prefs";
const SAVED_PATTERNS_KEY = "ft.savedPatterns";

// scale-degree labels per built-in scale. Naively comparing a scale's intervals to the
// major scale at the same index produces nonsense like "###5" for pentatonic / blues /
// arpeggio scales that skip degrees (minor pentatonic's ♭7 read as "###5"), so each
// scale carries its own correct spelling (1 ♭3 4 5 ♭7, …).
const SCALE_DEGREE_LABELS = {
  major: ["1", "2", "3", "4", "5", "6", "7"],
  majorPent: ["1", "2", "3", "5", "6"],
  majorBlues: ["1", "2", "b3", "3", "5", "6"],
  majorFlat7: ["1", "2", "3", "4", "5", "6", "b7"],
  minor: ["1", "2", "b3", "4", "5", "b6", "b7"],
  minorPent: ["1", "b3", "4", "5", "b7"],
  blues: ["1", "b3", "4", "b5", "5", "b7"],
  arpMajor: ["1", "3", "5"],
  arpMaj7: ["1", "3", "5", "7"],
  arpDom7: ["1", "3", "5", "b7"],
  arpMinor: ["1", "b3", "5"],
  arpMin7: ["1", "b3", "5", "b7"],
  arpDim: ["1", "b3", "b5"],
  arpAug: ["1", "3", "#5"],
  harmonicMinor: ["1", "2", "b3", "4", "5", "b6", "7"],
  dorian: ["1", "2", "b3", "4", "5", "6", "b7"],
  phrygian: ["1", "b2", "b3", "4", "5", "b6", "b7"],
  lydian: ["1", "2", "3", "#4", "5", "6", "7"],
  mixolydian: ["1", "2", "3", "4", "5", "6", "b7"],
  locrian: ["1", "b2", "b3", "4", "b5", "b6", "b7"],
  chromatic: ["1", "b2", "2", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7"],
};

// the 1-3-5 highlight paints each chord tone a different colour so root / 3rd / 5th
// read apart at a glance (amber root, blue 3rd, purple 5th).
const HIGHLIGHT_DEG_COLORS = { 0: "#e0a95f", 2: "#6ba5e8", 4: "#c78bf0" };

function savedPrefs() {
  try {
    return JSON.parse(localStorage.getItem(SCALES_PREFS_KEY)) || {};
  } catch {
    return {};
  }
}

function loadSavedPatterns() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_PATTERNS_KEY)) || [];
  } catch {
    return [];
  }
}

function MenuSelect({ label, value, onChange, options }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ fontSize: 12, color: "#7a8290", letterSpacing: 0.4 }}>{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ background: "#1b1f27", color: "#f3ead9", border: "1px solid #2a2f3a", borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function ScalesMode({ maxFret, activeStrings, guitarStrings, tuning }) {
  const prefs = useRef(savedPrefs());
  const [rootIdx, setRootIdx] = useState(() => prefs.current.key ?? 0); // index into CHROMATIC
  const [scaleId, setScaleId] = useState(() => prefs.current.scale ?? "major");
  const [viewMode, setViewMode] = useState("map"); // "map" | "notation" | "patterns"
  const [labelMode, setLabelMode] = useState("name"); // "none" | "name" | "degree" (map + patterns view)
  const [highlightMode, setHighlightMode] = useState("none"); // "none" | "root" | "triad" (map view only)
  const [patternLabelMode, setPatternLabelMode] = useState("finger"); // "finger" | "name" | "degree" (patterns view only)
  const [patternShow, setPatternShow] = useState("fretboard"); // "fretboard" | "notation" (patterns view: how a shape is displayed)
  const [patternIndex, setPatternIndex] = useState(0);
  const [selected, setSelected] = useState([]); // [{ stringId, fret }] — the pattern (defaults to the whole scale on the neck)
  const [patternName, setPatternName] = useState("");
  const [savedPatterns, setSavedPatterns] = useState(loadSavedPatterns);

  const scale = SCALE_PATTERNS.find((s) => s.id === scaleId) || SCALE_PATTERNS[0];

  // key-correct spelling of the scale (ending back on the root) for notation
  const spelled = spelledScaleSequence(rootIdx, [...scale.intervals, 12]);
  const sequencePcs = spelled.map((n) => CHROMATIC[n.pc]); // sharp-name pitch classes, for matching
  const uniqueScaleNotes = [...new Set(sequencePcs)];

  // notation that reflects the actual guitar fretboard: every distinct scale pitch on the
  // neck, ascending, with its real octave (instead of a single abstracted octave). Spelling
  // still comes from `spelled` so the key-correct letter names are kept.
  const notationSequence = useMemo(() => {
    if (!guitarStrings) return spelled;
    const spellByPc = new Map(spelled.map((n) => [n.pc, n]));
    const seen = new Set();
    const found = [];
    for (const s of guitarStrings) {
      const openMidi = freqToNote(s.openFreq).midi;
      for (let f = 0; f <= maxFret; f++) {
        const pcName = noteAt(s.open, f);
        const sp = spellByPc.get(CHROMATIC.indexOf(pcName));
        if (!sp) continue; // not a scale note
        const midi = openMidi + f;
        if (seen.has(midi)) continue; // same pitch on neighbouring strings
        seen.add(midi);
        found.push({ midi, sp });
      }
    }
    found.sort((a, b) => a.midi - b.midi);
    return found.map(({ midi, sp }) => {
      const octave = Math.floor(midi / 12) - 1;
      return { ...sp, octave, name: `${sp.name.replace(/\d+$/, "")}${octave}` };
    });
  }, [guitarStrings, maxFret, uniqueScaleNotes, spelled]);

  // degree labels like 1, 2, ♭3, 4 … derived from the scale's own intervals so
  // minor/harmonic/minor-ish spellings come out right (A minor → 1 2 ♭3 4 5 ♭6 ♭7)
  const degreeOf = useMemo(() => {
    const labels = SCALE_DEGREE_LABELS[scale.id] || scale.intervals.map((_, i) => `${i + 1}`);
    const m = {};
    scale.intervals.forEach((iv, i) => {
      m[CHROMATIC[(rootIdx + iv) % 12]] = labels[i];
    });
    return m;
  }, [scale, rootIdx]);

  const spotKey = (sid, fret) => `${sid}@${fret}`;
  const selectedKeys = useMemo(() => new Set(selected.map((sp) => spotKey(sp.stringId, sp.fret))), [selected]);

  // when the key or scale changes, reset the selection to the whole scale on the neck
  useEffect(() => {
    const spots = [];
    for (const s of guitarStrings) {
      for (let f = 0; f <= maxFret; f++) {
        if (uniqueScaleNotes.includes(noteAt(s.open, f))) spots.push({ stringId: s.id, fret: f });
      }
    }
    setSelected(spots);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootIdx, scaleId, guitarStrings, maxFret]);

  const toggleSpot = (stringId, fret) => {
    setSelected((prev) => {
      const key = spotKey(stringId, fret);
      const has = prev.some((sp) => spotKey(sp.stringId, sp.fret) === key);
      return has ? prev.filter((sp) => spotKey(sp.stringId, sp.fret) !== key) : [...prev, { stringId, fret }];
    });
  };

  // the textbook scale shapes for this scale (Shape 1..5)
  const patternPositions = useMemo(
    () => buildTextbookPositions(rootIdx, scale, maxFret, guitarStrings),
    [rootIdx, scale, maxFret, guitarStrings]
  );
  const activePatternPosition = patternPositions[Math.min(patternIndex, patternPositions.length - 1)];

  // the active shape's notes as musical notation: real fretboard octaves, ascending, deduped
  const patternNotationSequence = useMemo(() => {
    if (!activePatternPosition || !guitarStrings) return [];
    const spellByPc = new Map(spelled.map((n) => [n.pc, n]));
    const seen = new Set();
    const found = [];
    for (const n of activePatternPosition.notes) {
      const s = guitarStrings.find((gs) => gs.id === n.stringId);
      if (!s) continue;
      const pc = CHROMATIC.indexOf(noteAt(s.open, n.fret));
      const sp = spellByPc.get(pc);
      if (!sp) continue;
      const midi = freqToNote(s.openFreq).midi + n.fret;
      if (seen.has(midi)) continue; // unison on neighbouring strings
      seen.add(midi);
      found.push({ midi, sp });
    }
    found.sort((a, b) => a.midi - b.midi);
    return found.map(({ midi, sp }) => {
      const octave = Math.floor(midi / 12) - 1;
      return { ...sp, octave, name: `${sp.name.replace(/\d+$/, "")}${octave}` };
    });
  }, [activePatternPosition, guitarStrings, spelled]);

  // highlighted scale degrees: "root" = the tonic (degree 0); "triad" = the 1-3-5 chord
  // tones of the scale. For 7-note scales these are simply degrees 0/2/4, but pentatonic,
  // blues, and arpeggio scales skip degrees, so the 3rd and 5th are found by their actual
  // interval (3rd = ♭3/3, 5th = ♭5/5/♯5) instead of by scale position.
  const highlightRoles = useMemo(() => {
    if (highlightMode === "none") return [];
    const ivs = scale.intervals;
    const rootPos = ivs.indexOf(0);
    const roles = [];
    if (rootPos !== -1) roles.push({ pos: rootPos, role: 0 });
    if (highlightMode === "triad") {
      const third = ivs.includes(4) ? 4 : ivs.includes(3) ? 3 : null;
      const fifth = ivs.includes(7) ? 7 : ivs.includes(6) ? 6 : ivs.includes(8) ? 8 : null;
      if (third != null && ivs.includes(third)) roles.push({ pos: ivs.indexOf(third), role: 2 });
      if (fifth != null && ivs.includes(fifth)) roles.push({ pos: ivs.indexOf(fifth), role: 4 });
    }
    return roles;
  }, [highlightMode, scale]);

  // pitch classes to accent on the map, each with its own highlight colour
  // (amber root, blue 3rd, purple 5th)
  const highlightPcs = useMemo(() => {
    const m = new Map();
    for (const { pos, role } of highlightRoles) m.set(CHROMATIC[(rootIdx + scale.intervals[pos]) % 12], HIGHLIGHT_DEG_COLORS[role]);
    return m;
  }, [highlightRoles, rootIdx, scale]);

  // scale-degree positions -> highlight colour, for the pattern-shape view
  const highlightPosColor = useMemo(() => {
    const m = new Map();
    for (const { pos, role } of highlightRoles) m.set(pos, HIGHLIGHT_DEG_COLORS[role]);
    return m;
  }, [highlightRoles]);

  // map view: scale notes only; grey by default, accented where the highlight option says.
  // Tap to toggle any scale note in/out of the pattern.
  const mapMarkers = useMemo(() => {
    if (viewMode !== "map") return [];
    const markers = [];
    for (const s of guitarStrings) {
      for (let f = 0; f <= maxFret; f++) {
        const n = noteAt(s.open, f);
        if (!uniqueScaleNotes.includes(n)) continue; // only scale notes on the map
        const inPattern = selectedKeys.has(spotKey(s.id, f));
        const highlighted = highlightPcs.has(n);
        markers.push({
          stringId: s.id,
          fret: f,
          filled: inPattern || highlighted,
          color: highlighted ? highlightPcs.get(n) : inPattern ? "#8b8f96" : "#4a4f58",
          r: highlighted ? 13.5 : 12,
          fs: 12,
          label: labelMode === "name" ? displayName(n) : labelMode === "degree" ? degreeOf[n] : null,
        });
      }
    }
    return markers;
  }, [viewMode, guitarStrings, maxFret, selectedKeys, rootIdx, labelMode, degreeOf, uniqueScaleNotes, highlightPcs]);

  useEffect(() => {
    localStorage.setItem(SCALES_PREFS_KEY, JSON.stringify({ key: rootIdx, scale: scaleId }));
  }, [rootIdx, scaleId]);

  useEffect(() => {
    setPatternIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootIdx, scaleId]);

  // patterns view: the whole scale sits faint in the background, the selected shape sits
  // on top — either with finger numbers (to learn the fingering), or labelled with note
  // names / scale degrees so you can see what each note in the shape actually is.
  const patternMarkers = useMemo(() => {
    if (viewMode !== "patterns" || !activePatternPosition) return [];
    const dim = [];
    for (const s of guitarStrings) {
      for (let f = 0; f <= maxFret; f++) {
        const n = noteAt(s.open, f);
        if (uniqueScaleNotes.includes(n)) dim.push({ stringId: s.id, fret: f, color: "#4a4f58", r: 6 });
      }
    }
    const shape = addFingers(activePatternPosition).flatMap((n) => {
      if (!activeStrings.includes(n.stringId)) return [];
      const highlighted = highlightPosColor.has(n.degree);
      const marker = { stringId: n.stringId, fret: n.fret, filled: true, big: highlighted, color: highlighted ? highlightPosColor.get(n.degree) : "#8b8f96", r: highlighted ? 12 : 10.5, fs: 9 };
      if (patternLabelMode === "name") {
        const s = guitarStrings.find((gs) => gs.id === n.stringId);
        marker.label = s ? displayName(noteAt(s.open, n.fret)) : null;
      } else if (patternLabelMode === "degree") {
        const s = guitarStrings.find((gs) => gs.id === n.stringId);
        marker.label = s ? degreeOf[noteAt(s.open, n.fret)] : null;
      } else {
        marker.finger = n.finger;
      }
      return marker;
    });
    return [...dim, ...shape];
  }, [viewMode, activePatternPosition, guitarStrings, maxFret, activeStrings, uniqueScaleNotes, highlightPosColor, patternLabelMode, degreeOf]);

  const tunedCount = guitarStrings.filter((s) => tuning && tuning[s.id]).length;

  const scaleName = `${displayName(CHROMATIC[rootIdx])} ${scale.label}`;

  const savePattern = () => {
    if (!patternName.trim() || selected.length === 0) return;
    const entry = { id: `${Date.now()}`, name: patternName.trim(), spots: selected };
    const next = [...savedPatterns, entry];
    setSavedPatterns(next);
    localStorage.setItem(SAVED_PATTERNS_KEY, JSON.stringify(next));
    setPatternName("");
  };

  const loadPattern = (p) => {
    setSelected(p.spots);
    setPatternName(p.name);
    setViewMode("map");
  };

  const deletePattern = (id) => {
    const next = savedPatterns.filter((p) => p.id !== id);
    setSavedPatterns(next);
    localStorage.setItem(SAVED_PATTERNS_KEY, JSON.stringify(next));
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 20 }}>
        <StatCard label="Scale" value={scaleName} />
        <StatCard label="Strings tuned" value={`${tunedCount} / ${guitarStrings.length}`} />
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
        <MenuSelect
          label="Key"
          value={rootIdx}
          onChange={(v) => setRootIdx(Number(v))}
          options={CHROMATIC.map((n, i) => ({ value: i, label: displayName(n) }))}
        />
        <MenuSelect
          label="Scale"
          value={scaleId}
          onChange={setScaleId}
          options={SCALE_PATTERNS.map((sc) => ({ value: sc.id, label: sc.label }))}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 12 }}>
        <Chip active={viewMode === "map"} onClick={() => setViewMode("map")}>
          Map
        </Chip>
        <Chip active={viewMode === "notation"} onClick={() => setViewMode("notation")}>
          Notation
        </Chip>
        <Chip active={viewMode === "patterns"} onClick={() => setViewMode("patterns")}>
          Patterns
        </Chip>
      </div>

      {viewMode === "map" && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "#9aa2ac" }}>Labels</span>
          <Chip active={labelMode === "name"} onClick={() => setLabelMode("name")}>
            Note name
          </Chip>
          <Chip active={labelMode === "degree"} onClick={() => setLabelMode("degree")}>
            Scale degree
          </Chip>
          <Chip active={labelMode === "none"} onClick={() => setLabelMode("none")}>
            None
          </Chip>
        </div>
      )}

      {(viewMode === "map" || viewMode === "patterns") && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "#9aa2ac" }}>Highlight</span>
          <Chip active={highlightMode === "none"} onClick={() => setHighlightMode("none")}>
            None
          </Chip>
          <Chip active={highlightMode === "root"} onClick={() => setHighlightMode("root")}>
            Root
          </Chip>
          <Chip active={highlightMode === "triad"} onClick={() => setHighlightMode("triad")}>
            1-3-5
          </Chip>
        </div>
      )}

      {viewMode === "map" && (
        <div style={{ textAlign: "center", padding: "12px 16px", border: "1px dashed #2a2f3a", borderRadius: 10, marginBottom: 14 }}>
          <p style={{ margin: 0, color: "#9aa2ac", fontSize: 14 }}>
            <strong style={{ color: "#f3ead9" }}>{scaleName}</strong> is lit across the whole neck. Tap a lit note to drop it, tap a dim scale note to add it — build the exact pattern you want to play.
          </p>
        </div>
      )}

      {viewMode === "patterns" && patternPositions.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: "#9aa2ac", marginBottom: 6 }}>Shape</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {patternPositions.map((p, i) => (
              <Chip key={p.id || i} active={patternIndex === i} onClick={() => setPatternIndex(i)}>
                {`Shape ${i + 1}`}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {viewMode === "patterns" && patternPositions.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: "#9aa2ac", marginBottom: 6 }}>Shape display</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Chip active={patternShow === "fretboard"} onClick={() => setPatternShow("fretboard")}>
              Fretboard
            </Chip>
            <Chip active={patternShow === "notation"} onClick={() => setPatternShow("notation")}>
              Notation
            </Chip>
          </div>
        </div>
      )}

      {viewMode === "patterns" && patternPositions.length > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "#9aa2ac" }}>Shape labels</span>
          <Chip active={patternLabelMode === "finger"} onClick={() => setPatternLabelMode("finger")}>
            Fingers
          </Chip>
          <Chip active={patternLabelMode === "name"} onClick={() => setPatternLabelMode("name")}>
            Notes
          </Chip>
          <Chip active={patternLabelMode === "degree"} onClick={() => setPatternLabelMode("degree")}>
            Degrees
          </Chip>
        </div>
      )}

      {viewMode === "patterns" && patternPositions.length === 0 && (
        <div style={{ textAlign: "center", padding: "18px 16px", border: "1px dashed #2a2f3a", borderRadius: 10, marginBottom: 14 }}>
          <p style={{ color: "#9aa2ac", fontSize: 14, margin: 0 }}>No textbook shapes found for this scale.</p>
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        {viewMode === "notation" || (viewMode === "patterns" && patternShow === "notation") ? (
          <NotationStaff sequence={viewMode === "notation" ? notationSequence : patternNotationSequence} />
        ) : (
          <FretboardSVG
            maxFret={maxFret}
            activeStrings={activeStrings}
            markers={viewMode === "map" ? mapMarkers : patternMarkers}
            guitarStrings={guitarStrings}
            onCellClick={viewMode === "map" ? toggleSpot : undefined}
            clickableAll={viewMode === "map"}
          />
        )}
      </div>

      {viewMode === "map" && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
            <input
              value={patternName}
              onChange={(e) => setPatternName(e.target.value)}
              placeholder="Pattern name (e.g. Cmaj7 sweep)"
              style={{ flex: 1, minWidth: 220, background: "#1b1f27", color: "#f3ead9", border: "1px solid #2a2f3a", borderRadius: 8, padding: "10px 12px", fontSize: 14 }}
            />
            <button className="ft-primary-btn" onClick={savePattern} disabled={!patternName.trim() || selected.length === 0}>
              Save pattern ({selected.length} notes)
            </button>
            <Chip active={false} onClick={() => setSelected([])}>
              Clear
            </Chip>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {savedPatterns.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1b1f27", border: "1px solid #2a2f3a", borderRadius: 8, padding: "6px 6px 6px 12px" }}>
                <span style={{ fontSize: 13, color: "#f3ead9" }}>{p.name}</span>
                <span style={{ fontSize: 11, color: "#7a8290" }}>{p.spots.length} notes</span>
                <button onClick={() => loadPattern(p)} style={{ background: "transparent", border: "1px solid #e0a95f", color: "#e0a95f", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>
                  Load
                </button>
                <button onClick={() => deletePattern(p.id)} style={{ background: "transparent", border: "1px solid #3a3030", color: "#b0705f", borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: "pointer" }}>
                  ✕
                </button>
              </div>
            ))}
            {savedPatterns.length === 0 && <div style={{ color: "#5a6270", fontSize: 13, padding: "8px 0" }}>No saved patterns yet.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
