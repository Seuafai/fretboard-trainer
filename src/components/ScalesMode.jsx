import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chip, Segmented, StatCard } from "./shared.jsx";
import FretboardSVG from "./FretboardSVG.jsx";
import NotationStaff from "./NotationStaff.jsx";
import { playScaleRun, stopPlayback, SCALE_RUN_HOLD } from "../audio.js";
import {
  CHROMATIC,
  SCALE_PATTERNS,
  buildTextbookPositions,
  displayName,
  freqToNote,
  noteAt,
  addFingers,
  keySignatureOfScale,
  matchReading,
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

export default function ScalesMode({ maxFret, activeStrings, guitarStrings, tuning, mic, landscape, fill }) {
  const prefs = useRef(savedPrefs());
  const [rootIdx, setRootIdx] = useState(() => prefs.current.key ?? 0); // index into CHROMATIC
  const [scaleId, setScaleId] = useState(() => prefs.current.scale ?? "major");
  const [startMidi, setStartMidi] = useState(() => prefs.current.startMidi ?? null); // exact on-screen note the run starts on (null = the lowest root)
  const [direction, setDirection] = useState(() => prefs.current.direction ?? "updown"); // "up" | "down" | "updown" | "downup"
  const [displayMode, setDisplayMode] = useState("fretboard"); // "fretboard" | "notation"
  const [mapMode, setMapMode] = useState("neck"); // "neck" | "shape"
  const [labelMode, setLabelMode] = useState("name"); // "none" | "name" | "degree" (full-neck view)
  const [highlightMode, setHighlightMode] = useState("none"); // "none" | "root" | "triad" (both views)
  const [patternLabelMode, setPatternLabelMode] = useState("finger"); // "finger" | "name" | "degree" (shape view)
  const [patternIndex, setPatternIndex] = useState(0);
  const [playing, setPlaying] = useState(false); // scale playback running
  const [activePlayMidi, setActivePlayMidi] = useState(null); // midi of the exact note currently sounding, so only that one spot flashes
  const [activeRunIndex, setActiveRunIndex] = useState(null); // position in the run currently sounding (notation highlight)
  const [bpm, setBpm] = useState(() => prefs.current.bpm ?? 80); // playback tempo in BPM
  const [autoscroll, setAutoscroll] = useState(() => prefs.current.autoscroll ?? true); // follow the played/heard note along the neck
  const runTimersRef = useRef([]);
  const [heard, setHeard] = useState(null); // { midi, stringId, fret, timbre } — note the mic is hearing (timbre = string confirmed by calibration)
  const heardTimerRef = useRef(null);
  const areaRef = useRef(null); // the fretboard/notation area, so it can fill the landscape screen
  const [areaH, setAreaH] = useState(null);
  const [selected, setSelected] = useState([]); // [{ stringId, fret }] — the pattern (defaults to the whole scale on the neck)
  const [patternName, setPatternName] = useState("");
  const [savedPatterns, setSavedPatterns] = useState(loadSavedPatterns);

  const scale = SCALE_PATTERNS.find((s) => s.id === scaleId) || SCALE_PATTERNS[0];

  // key signature for the staff: derived from the scale's parent major key so blues /
  // chromatic spellings still get a clean, correct signature
  const keySignature = useMemo(() => keySignatureOfScale(rootIdx, scale.intervals), [rootIdx, scale]);

  // key-correct spelling of the scale (ending back on the root) for notation
  const spelled = spelledScaleSequence(rootIdx, [...scale.intervals, 12]);
  const sequencePcs = spelled.map((n) => CHROMATIC[n.pc]); // sharp-name pitch classes, for matching
  const uniqueScaleNotes = [...new Set(sequencePcs)];
  // key-correct display name per pitch class (Eb blues spells its ♭3 as Gb, not F#)
  const scaleNameByPc = new Map();
  for (const n of spelled) if (!scaleNameByPc.has(n.pc)) scaleNameByPc.set(n.pc, n.name.replace(/\d+$/, ""));

  // notation that reflects the actual guitar fretboard: every distinct scale pitch on the
  // neck, ascending. Written pitch — guitar notation sits an octave above the sounding
  // pitch, so the low-E fret-8 C reads as middle C, not C3. Spelling still comes from
  // `spelled` so the key-correct letter names are kept.
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
      const octave = Math.floor(midi / 12); // written pitch: sounding + 1 octave
      return { ...sp, midi, octave, name: `${sp.name.replace(/\d+$/, "")}${octave}` };
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

  // the active shape's notes as musical notation: written guitar pitch (an octave above
  // sounding), ascending, deduped
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
      const octave = Math.floor(midi / 12); // written pitch: sounding + 1 octave
      return { ...sp, midi, octave, name: `${sp.name.replace(/\d+$/, "")}${octave}` };
    });
  }, [activePatternPosition, guitarStrings, spelled]);

  // the run played out loud (and written on the staff): starts on whichever exact
  // note you picked on screen — shapes hold the root at several octaves, so the choice
  // is a specific note, not just a degree — then ascends / descends / sweeps up-and-down
  // through the notes on screen. Every move is to an adjacent scale degree, and in the
  // up-and-down mode the phrase returns to the note it started on.
  const startOptions = useMemo(() => {
    const seq = mapMode === "shape" ? patternNotationSequence : notationSequence;
    return seq.map((n) => ({
      value: n.midi,
      label: `${degreeOf[CHROMATIC[n.pc]] || "–"} · ${n.name.replace(/\d+$/, "")}${Math.floor(n.midi / 12) - 1}`,
    }));
  }, [mapMode, patternNotationSequence, notationSequence, degreeOf]);

  const effectiveStartMidi = useMemo(() => {
    const seq = mapMode === "shape" ? patternNotationSequence : notationSequence;
    if (startMidi != null && seq.some((n) => n.midi === startMidi)) return startMidi;
    const rootPc = CHROMATIC[rootIdx];
    const firstRoot = seq.find((n) => CHROMATIC[n.pc] === rootPc);
    return firstRoot ? firstRoot.midi : seq.length ? seq[0].midi : null;
  }, [mapMode, patternNotationSequence, notationSequence, startMidi, rootIdx]);

  const runSequence = useMemo(() => {
    const seq = mapMode === "shape" ? patternNotationSequence : notationSequence;
    if (!seq.length) return [];
    const up = seq.map((n) => ({ ...n, pcName: CHROMATIC[n.pc] }));
    let s = up.findIndex((n) => n.midi === effectiveStartMidi);
    if (s === -1) s = 0;
    const fromStart = up.slice(s);
    const below = up.slice(0, s);
    const above = fromStart.slice(1);

    if (direction === "up") {
      // climb from the chosen degree to the top of the shape, then come straight back
      if (mapMode === "shape") {
        if (!above.length) return [fromStart[0]];
        const backDown = [...above.slice(0, -1).reverse(), fromStart[0]];
        return [fromStart[0], ...above, ...backDown];
      }
      // the full neck is too long to double every note; climb to the top and come
      // straight back down to the start note
      return fromStart.length > 1 ? [...fromStart, ...fromStart.slice(1, -1).reverse(), fromStart[0]] : fromStart;
    }

    if (direction === "down") {
      // descend from the chosen degree to the bottom, then climb straight back home
      if (!below.length) return fromStart;
      return [fromStart[0], ...below.slice().reverse(), ...below.slice(1), fromStart[0]];
    }

    if (direction === "downup") {
      // mirror of "up & down": descend to the bottom first, sweep all the way back up
      // to the top, then descend home to the start note
      if (mapMode === "shape") {
        const backDown = [...above.slice(0, -1).reverse(), fromStart[0]];
        if (!below.length) return [fromStart[0], ...above, ...backDown];
        if (!above.length) return [fromStart[0], ...below.slice().reverse(), ...below.slice(1), fromStart[0]];
        return [fromStart[0], ...below.slice().reverse(), ...below.slice(1), fromStart[0], ...above, ...backDown];
      }
      // the full neck is too long to sweep the whole way back; descend to the bottom
      // and climb straight home to the start note
      if (!below.length) return fromStart;
      return fromStart.length > 1 ? [fromStart[0], ...below.slice().reverse(), ...below.slice(1), fromStart[0]] : fromStart;
    }

    // up & down
    if (mapMode === "shape") {
      // a shape is a small handful of notes — play every one of them, starting on the
      // chosen degree, sweeping up to the top, back through the start, down to the low
      // notes and home to the start
      const downToStart = [...above.slice(0, -1).reverse(), fromStart[0]];
      if (!below.length) return [fromStart[0], ...above, ...downToStart];
      if (!above.length) return [fromStart[0], ...below.slice().reverse(), ...below.slice(1), fromStart[0]];
      return [fromStart[0], ...above, ...downToStart, ...below.slice().reverse(), ...below.slice(1), fromStart[0]];
    }
    // the full neck is too long to double every note; climb from the start to the top
    // and come straight back down to it
    return fromStart.length > 1 ? [...fromStart, ...fromStart.slice(1, -1).reverse(), fromStart[0]] : fromStart;
  }, [mapMode, patternNotationSequence, notationSequence, effectiveStartMidi, direction]);

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
    if (mapMode !== "neck") return [];
    const markers = [];
    for (const s of guitarStrings) {
      for (let f = 0; f <= maxFret; f++) {
        const n = noteAt(s.open, f);
        if (!uniqueScaleNotes.includes(n)) continue; // only scale notes on the map
        const inPattern = selectedKeys.has(spotKey(s.id, f));
        const highlighted = highlightPcs.has(n);
        const playing = activePlayMidi != null && freqToNote(s.openFreq).midi + f === activePlayMidi;
        markers.push({
          stringId: s.id,
          fret: f,
          filled: inPattern || highlighted,
          color: highlighted ? highlightPcs.get(n) : inPattern ? "#8b8f96" : "#4a4f58",
          r: highlighted ? 13.5 : 12,
          fs: 12,
          playing,
          heard: heard != null && (heard.timbre ? s.id === heard.stringId && f === heard.fret : freqToNote(s.openFreq).midi + f === heard.midi),
          label: labelMode === "name" ? scaleNameByPc.get(CHROMATIC.indexOf(n)) || displayName(n) : labelMode === "degree" ? degreeOf[n] : null,
        });
      }
    }
    return markers;
  }, [mapMode, guitarStrings, maxFret, selectedKeys, rootIdx, labelMode, degreeOf, uniqueScaleNotes, highlightPcs, activePlayMidi, heard]);

  useEffect(() => {
    localStorage.setItem(SCALES_PREFS_KEY, JSON.stringify({ key: rootIdx, scale: scaleId, startMidi, direction, bpm, autoscroll }));
  }, [rootIdx, scaleId, startMidi, direction, bpm, autoscroll]);

  useEffect(() => {
    setPatternIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootIdx, scaleId]);

  // patterns view: the whole scale sits faint in the background, the selected shape sits
  // on top — either with finger numbers (to learn the fingering), or labelled with note
  // names / scale degrees so you can see what each note in the shape actually is.
  const patternMarkers = useMemo(() => {
    if (mapMode !== "shape" || !activePatternPosition) return [];
    // the shape's own notes. When the mic hears a pitch that lives in the shape, we assume
    // the player is playing the shape's position, so the dim full-neck duplicate stays dark.
    const shapeNotes = addFingers(activePatternPosition).filter((n) => activeStrings.includes(n.stringId));
    const shapeMidis = new Set();
    for (const n of shapeNotes) {
      const s = guitarStrings.find((gs) => gs.id === n.stringId);
      if (s) shapeMidis.add(freqToNote(s.openFreq).midi + n.fret);
    }
    const dim = [];
    for (const s of guitarStrings) {
      for (let f = 0; f <= maxFret; f++) {
        const n = noteAt(s.open, f);
        if (uniqueScaleNotes.includes(n)) {
          const midi = freqToNote(s.openFreq).midi + f;
          dim.push({
            stringId: s.id,
            fret: f,
            color: "#4a4f58",
            r: 6,
            heard: heard != null && midi === heard.midi && !shapeMidis.has(midi),
          });
        }
      }
    }
    const shape = shapeNotes.map((n) => {
      const highlighted = highlightPosColor.has(n.degree);
      const s = guitarStrings.find((gs) => gs.id === n.stringId);
      const midi = s != null ? freqToNote(s.openFreq).midi + n.fret : null;
      const playing = midi != null && activePlayMidi != null && midi === activePlayMidi;
      const marker = { stringId: n.stringId, fret: n.fret, filled: true, big: highlighted, color: highlighted ? highlightPosColor.get(n.degree) : "#8b8f96", r: highlighted ? 12 : 10.5, fs: 9, playing, heard: heard != null && midi === heard.midi };
      if (patternLabelMode === "name") {
        const pcName = s ? noteAt(s.open, n.fret) : null;
        marker.label = pcName ? scaleNameByPc.get(CHROMATIC.indexOf(pcName)) || displayName(pcName) : null;
      } else if (patternLabelMode === "degree") {
        marker.label = s ? degreeOf[noteAt(s.open, n.fret)] : null;
      } else {
        marker.finger = n.finger;
      }
      return marker;
    });
    return [...dim, ...shape];
  }, [mapMode, activePatternPosition, guitarStrings, maxFret, activeStrings, uniqueScaleNotes, highlightPosColor, patternLabelMode, degreeOf, activePlayMidi, heard]);

  const tunedCount = guitarStrings.filter((s) => tuning && tuning[s.id]).length;

  const scaleName = `${displayName(CHROMATIC[rootIdx])} ${scale.label}`;

  const heardPc = heard != null ? heard.midi % 12 : null;
  const heardNote = heardPc != null ? scaleNameByPc.get(heardPc) || displayName(CHROMATIC[heardPc]) : null;
  const heardInScale = heardPc != null && uniqueScaleNotes.includes(CHROMATIC[heardPc]);

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
    setDisplayMode("fretboard");
    setMapMode("neck");
  };

  const deletePattern = (id) => {
    const next = savedPatterns.filter((p) => p.id !== id);
    setSavedPatterns(next);
    localStorage.setItem(SAVED_PATTERNS_KEY, JSON.stringify(next));
  };

  // plays what's on screen: the whole scale across the neck, or just the active
  // shape's notes. The run starts on the chosen degree (the tonic by default), climbs
  // / descends / sweeps through the notes, and lands back on the start. Each sounding
  // note is highlighted in sync. When the run finishes the mic comes on so you can
  // play along and hear yourself.
  const playRun = useCallback(() => {
    const run = runSequence;
    if (!run.length) return;
    if (mic && mic.status === "active") mic.stop(); // never feed playback back through the mic
    const secondsPerNote = 60 / bpm;
    playScaleRun(run, secondsPerNote);
    setPlaying(true);
    setActivePlayMidi(null);
    setActiveRunIndex(null);
    runTimersRef.current.forEach(clearTimeout);
    const timers = [];
    run.forEach((n, i) =>
      timers.push(
        setTimeout(() => {
          setActivePlayMidi(n.midi);
          setActiveRunIndex(i);
        }, Math.round(i * secondsPerNote * 1000))
      )
    );
    timers.push(
      setTimeout(() => {
        setActivePlayMidi(null);
        setActiveRunIndex(null);
        setPlaying(false);
        if (mic) mic.start(); // turn the mic on for practice once the playthrough is done
      }, Math.round((run.length * secondsPerNote + 0.25 + SCALE_RUN_HOLD) * 1000))
    );
    runTimersRef.current = timers;
  }, [runSequence, bpm, mic]);

  const stopRun = useCallback(() => {
    runTimersRef.current.forEach(clearTimeout);
    runTimersRef.current = [];
    stopPlayback();
    setActivePlayMidi(null);
    setActiveRunIndex(null);
    setPlaying(false);
  }, []);

  // stop the run if the view, key, scale, shape or run settings change mid-play
  useEffect(() => {
    stopRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootIdx, scaleId, mapMode, displayMode, patternIndex, startMidi, direction]);

  useEffect(() => () => stopRun(), [stopRun]);

  // with the mic on (after a playthrough it comes back on for practice), listen for the
  // guitar and flash the note being played, so you can play the scale along with the run.
  useEffect(() => {
    if (!mic || mic.status !== "active" || playing) return;
    const iv = setInterval(() => {
      const s = mic.sample();
      if (!s || !s.confident) return;
      const pos = matchReading(s, { guitarStrings, activeStrings, maxFret, tuning });
      if (!pos) return;
      const sObj = guitarStrings.find((gs) => gs.id === pos.stringId);
      if (!sObj) return;
      // when the timbre is calibrated the string is known, so only that spot flashes;
      // otherwise match by pitch alone and light every occurrence of the note.
      setHeard({ midi: freqToNote(sObj.openFreq).midi + pos.fret, stringId: pos.stringId, fret: pos.fret, timbre: pos.dist != null });
      clearTimeout(heardTimerRef.current);
      heardTimerRef.current = setTimeout(() => setHeard(null), 320); // follow the note's sustain
    }, 60);
    return () => {
      clearInterval(iv);
      clearTimeout(heardTimerRef.current);
    };
  }, [mic.status, playing, guitarStrings, activeStrings, maxFret, tuning]);

  // which fret the view should follow. When a note is playing or heard, scroll to it —
  // if the pitch lives at several spots (unison strings), stay on the one nearest to
  // where the view already is so it doesn't jump between strings.
  const followFretRef = useRef(0);
  const followFret = useMemo(() => {
    if (!autoscroll) return null;
    const cands = (mapMode === "neck" ? mapMarkers : patternMarkers).filter((m) => m.playing || m.heard);
    if (!cands.length) return null;
    if (heard && heard.timbre) {
      const exact = cands.find((m) => m.heard && m.stringId === heard.stringId && m.fret === heard.fret);
      if (exact) return exact.fret;
    }
    let best = cands[0];
    for (const c of cands) {
      if (Math.abs(c.fret - followFretRef.current) < Math.abs(best.fret - followFretRef.current)) best = c;
    }
    return best.fret;
  }, [autoscroll, mapMode, mapMarkers, patternMarkers, heard]);

  useEffect(() => {
    if (followFret != null) followFretRef.current = followFret;
  }, [followFret]);

  // measure the fretboard/notation area so the fretboard can stretch to fill it in landscape
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const update = () => setAreaH(el.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [landscape]);

  const statusText = playing ? (
    <span style={{ fontSize: 12, color: "#e0a95f" }}>playing…</span>
  ) : mic && mic.status === "active" ? (
    <span style={{ fontSize: 12, color: heardNote ? (heardInScale ? "#7cb37a" : "#e08a71") : "#7cb37a" }}>
      {heardNote ? `hearing ${heardNote}${heardInScale ? " · in scale" : " · not in scale"}` : "listening…"}
    </span>
  ) : mic && mic.status === "error" ? (
    <span style={{ fontSize: 12, color: "#e08a71" }}>mic error</span>
  ) : null;

  const viewToggle = (
    <Segmented
      options={[
        { value: "fretboard", label: "Fretboard" },
        { value: "notation", label: "Notation" },
      ]}
      value={displayMode}
      onChange={setDisplayMode}
    />
  );

  const modeToggle = (
    <Segmented
      options={[
        { value: "neck", label: "Full neck" },
        { value: "shape", label: "Scale shape" },
      ]}
      value={mapMode}
      onChange={setMapMode}
    />
  );

  const shapeChips = mapMode === "shape" && patternPositions.length > 0 ? (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {patternPositions.map((p, i) => (
        <Chip key={p.id || i} active={patternIndex === i} onClick={() => setPatternIndex(i)}>
          {`Shape ${i + 1}`}
        </Chip>
      ))}
    </div>
  ) : null;

  const hintBox = displayMode === "fretboard" && mapMode === "neck" ? (
    <div style={{ textAlign: "center", padding: "12px 16px", border: "1px dashed #2a2f3a", borderRadius: 10, marginBottom: 12 }}>
      <p style={{ margin: 0, color: "#9aa2ac", fontSize: 14 }}>
        <strong style={{ color: "#f3ead9" }}>{scaleName}</strong> is lit across the whole neck. Tap a lit note to drop it, tap a dim scale note to add it — build the exact pattern you want to play.
      </p>
    </div>
  ) : null;

  const labelsControl = (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: 13, color: "#9aa2ac" }}>Labels</span>
      {mapMode === "shape" ? (
        <Segmented
          options={[
            { value: "finger", label: "Fingers" },
            { value: "name", label: "Notes" },
            { value: "degree", label: "Degrees" },
          ]}
          value={patternLabelMode}
          onChange={setPatternLabelMode}
        />
      ) : (
        <Segmented
          options={[
            { value: "none", label: "None" },
            { value: "name", label: "Notes" },
            { value: "degree", label: "Degrees" },
          ]}
          value={labelMode}
          onChange={setLabelMode}
        />
      )}
    </div>
  );

  const highlightControl = (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: 13, color: "#9aa2ac" }}>Highlight</span>
      <Segmented
        options={[
          { value: "none", label: "None" },
          { value: "root", label: "Root" },
          { value: "triad", label: "1-3-5" },
        ]}
        value={highlightMode}
        onChange={setHighlightMode}
      />
    </div>
  );

  const fretboardOrNotation = displayMode === "notation" ? (
    <NotationStaff
      sequence={runSequence}
      keySignature={keySignature}
      highlightPcs={highlightPcs}
      activeIndex={activeRunIndex}
      heardMidi={heard ? heard.midi : null}
    />
  ) : (
    <FretboardSVG
      maxFret={maxFret}
      activeStrings={activeStrings}
      markers={mapMode === "neck" ? mapMarkers : patternMarkers}
      guitarStrings={guitarStrings}
      onCellClick={mapMode === "neck" ? toggleSpot : undefined}
      clickableAll={mapMode === "neck"}
      followFret={followFret}
    />
  );

  const fretboardOrNotationFill = displayMode === "notation" ? (
    <NotationStaff
      sequence={runSequence}
      keySignature={keySignature}
      highlightPcs={highlightPcs}
      activeIndex={activeRunIndex}
      heardMidi={heard ? heard.midi : null}
    />
  ) : (
    <FretboardSVG
      maxFret={maxFret}
      activeStrings={activeStrings}
      markers={mapMode === "neck" ? mapMarkers : patternMarkers}
      guitarStrings={guitarStrings}
      onCellClick={mapMode === "neck" ? toggleSpot : undefined}
      clickableAll={mapMode === "neck"}
      followFret={followFret}
      height={areaH}
    />
  );

  const patternsUI = mapMode === "neck" ? (
    <div style={{ marginBottom: 20, marginTop: 12 }}>
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
  ) : null;

  const noShapesBox = mapMode === "shape" && patternPositions.length === 0 ? (
    <div style={{ textAlign: "center", padding: "18px 16px", border: "1px dashed #2a2f3a", borderRadius: 10, marginBottom: 14 }}>
      <p style={{ color: "#9aa2ac", fontSize: 14, margin: 0 }}>No textbook shapes found for this scale.</p>
    </div>
  ) : null;

  if (landscape) {
    return (
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#e0a95f", whiteSpace: "nowrap" }}>{scaleName}</span>
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
          {viewToggle}
          {modeToggle}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <MenuSelect
            label="Tempo"
            value={bpm}
            onChange={(v) => setBpm(Number(v))}
            options={[50, 60, 70, 80, 90, 100, 110, 120, 140, 160, 180, 200].map((b) => ({ value: b, label: `${b} BPM` }))}
          />
          <Segmented
            options={[
              { value: "up", label: "Up" },
              { value: "down", label: "Down" },
              { value: "updown", label: "Up & Down" },
              { value: "downup", label: "Down & Up" },
            ]}
            value={direction}
            onChange={setDirection}
          />
          <MenuSelect
            label="Start on"
            value={effectiveStartMidi}
            onChange={(v) => setStartMidi(Number(v))}
            options={startOptions}
          />
          <button
            onClick={() => (mic && mic.status === "active" ? mic.stop() : mic && mic.start())}
            disabled={mic && mic.status === "requesting"}
            style={{ background: "transparent", border: "1px solid #4a6a4a", color: mic && mic.status === "active" ? "#7cb37a" : "#9aa2ac", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}
          >
            {mic && mic.status === "active" ? "Mic on" : mic && mic.status === "requesting" ? "Mic…" : "Mic off"}
          </button>
          <button
            onClick={() => setAutoscroll((a) => !a)}
            style={{ background: "transparent", border: "1px solid #3a4a5a", color: autoscroll ? "#6ba5e8" : "#9aa2ac", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}
          >
            {autoscroll ? "Auto-scroll on" : "Auto-scroll off"}
          </button>
          {statusText}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {shapeChips && <span style={{ fontSize: 13, color: "#9aa2ac" }}>Shape</span>}
          {shapeChips}
          {labelsControl}
          {highlightControl}
        </div>
        <div style={{ flex: 1, minHeight: 0, position: "relative", display: "flex" }}>
          <div ref={areaRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", paddingRight: 2 }}>
            {noShapesBox}
            {fill ? fretboardOrNotationFill : fretboardOrNotation}
            {hintBox}
            {patternsUI}
          </div>
          <button
            onClick={playing ? stopRun : playRun}
            style={{
              position: "absolute",
              bottom: 16,
              right: 16,
              width: 64,
              height: 64,
              borderRadius: 999,
              background: "#e0a95f",
              color: "#14171c",
              fontSize: 15,
              fontWeight: 700,
              border: "none",
              boxShadow: "0 6px 18px #00000066",
              cursor: "pointer",
              zIndex: 5,
            }}
          >
            {playing ? "Stop" : "Play"}
          </button>
        </div>
      </div>
    );
  }

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

      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>{viewToggle}</div>

      <div style={{ display: "flex", justifyContent: "center", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <button className="ft-primary-btn" onClick={playing ? stopRun : playRun} style={{ minWidth: 90 }}>
          {playing ? "Stop" : "Play"}
        </button>
        <MenuSelect
          label="Tempo"
          value={bpm}
          onChange={(v) => setBpm(Number(v))}
          options={[50, 60, 70, 80, 90, 100, 110, 120, 140, 160, 180, 200].map((b) => ({ value: b, label: `${b} BPM` }))}
        />
        <Segmented
          options={[
            { value: "up", label: "Up" },
            { value: "down", label: "Down" },
            { value: "updown", label: "Up & Down" },
            { value: "downup", label: "Down & Up" },
          ]}
          value={direction}
          onChange={setDirection}
        />
        <MenuSelect
          label="Start on"
          value={effectiveStartMidi}
          onChange={(v) => setStartMidi(Number(v))}
          options={startOptions}
        />
        <button
          onClick={() => (mic && mic.status === "active" ? mic.stop() : mic && mic.start())}
          disabled={mic && mic.status === "requesting"}
          style={{ background: "transparent", border: "1px solid #4a6a4a", color: mic && mic.status === "active" ? "#7cb37a" : "#9aa2ac", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}
        >
          {mic && mic.status === "active" ? "Mic on" : mic && mic.status === "requesting" ? "Mic…" : "Mic off"}
        </button>
        <button
          onClick={() => setAutoscroll((a) => !a)}
          style={{ background: "transparent", border: "1px solid #3a4a5a", color: autoscroll ? "#6ba5e8" : "#9aa2ac", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}
        >
          {autoscroll ? "Auto-scroll on" : "Auto-scroll off"}
        </button>
        {statusText}
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>{modeToggle}</div>

      {shapeChips && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: "#9aa2ac", marginBottom: 6 }}>Shape</div>
          {shapeChips}
        </div>
      )}

      {hintBox}

      {displayMode === "fretboard" && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap", justifyContent: "center" }}>
          {labelsControl}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap", justifyContent: "center" }}>
        {highlightControl}
      </div>

      {noShapesBox}
      <div style={{ marginBottom: 14 }}>{fretboardOrNotation}</div>
      {patternsUI}
    </div>
  );
}
