// ---------- note + string data ----------

export const CHROMATIC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// display order top -> bottom mirrors standard tab notation (high e on top)
// openFreq/open here are the STANDARD-tuning reference values — alternate tunings
// derive their own open note + frequency from these via tunedStrings() below.
export const STRINGS = [
  { id: "e1", label: "e", open: "E", openFreq: 329.63, thickness: 1.4 },
  { id: "B", label: "B", open: "B", openFreq: 246.94, thickness: 1.7 },
  { id: "G", label: "G", open: "G", openFreq: 196.0, thickness: 2.1 },
  { id: "D", label: "D", open: "D", openFreq: 146.83, thickness: 2.6 },
  { id: "A", label: "A", open: "A", openFreq: 110.0, thickness: 3.2 },
  { id: "e2", label: "E", open: "E", openFreq: 82.41, thickness: 3.8 },
];

// each `notes` array matches STRINGS order (high e, B, G, D, A, low E)
export const TUNING_PRESETS = [
  { id: "standard", label: "Standard", notes: ["E", "B", "G", "D", "A", "E"] },
  { id: "dropD", label: "Drop D", notes: ["E", "B", "G", "D", "A", "D"] },
  { id: "halfStepDown", label: "Eb Standard (half step down)", notes: ["D#", "A#", "F#", "C#", "G#", "D#"] },
  { id: "fullStepDown", label: "D Standard (full step down)", notes: ["D", "A", "F", "C", "G", "D"] },
  { id: "dropC", label: "Drop C", notes: ["D", "A", "F", "C", "G", "C"] },
  { id: "openG", label: "Open G", notes: ["D", "B", "G", "D", "G", "D"] },
  { id: "openD", label: "Open D", notes: ["D", "A", "F#", "D", "A", "D"] },
  { id: "openE", label: "Open E", notes: ["E", "B", "G#", "E", "B", "E"] },
  { id: "dadgad", label: "DADGAD", notes: ["D", "A", "G", "D", "A", "D"] },
];

// semitone intervals from the root, ascending within one octave (root is added again at the top)
export const SCALE_PATTERNS = [
  { id: "major", label: "Major (Ionian)", intervals: [0, 2, 4, 5, 7, 9, 11] },
  { id: "dorian", label: "Dorian", intervals: [0, 2, 3, 5, 7, 9, 10] },
  { id: "phrygian", label: "Phrygian", intervals: [0, 1, 3, 5, 7, 8, 10] },
  { id: "lydian", label: "Lydian", intervals: [0, 2, 4, 6, 7, 9, 11] },
  { id: "mixolydian", label: "Mixolydian", intervals: [0, 2, 4, 5, 7, 9, 10] },
  { id: "minor", label: "Natural Minor (Aeolian)", intervals: [0, 2, 3, 5, 7, 8, 10] },
  { id: "locrian", label: "Locrian", intervals: [0, 1, 3, 5, 6, 8, 10] },
  { id: "harmonicMinor", label: "Harmonic Minor", intervals: [0, 2, 3, 5, 7, 8, 11] },
  { id: "melodicMinor", label: "Melodic Minor", intervals: [0, 2, 3, 5, 7, 9, 11] },
  { id: "majorPent", label: "Major Pentatonic", intervals: [0, 2, 4, 7, 9] },
  { id: "minorPent", label: "Minor Pentatonic", intervals: [0, 3, 5, 7, 10] },
  { id: "blues", label: "Blues", intervals: [0, 3, 5, 6, 7, 10] },
];

// the seven modes of the major scale, in position order (position N starts on degree N)
export const MODE_NAMES = ["Ionian", "Dorian", "Phrygian", "Lydian", "Mixolydian", "Aeolian", "Locrian"];

// The classic CAGED major-scale boxes — five overlapping shapes named after their chord form.
// `strings` holds per-string fret numbers for G major (key root G, tonic fret on the anchor
// string in `anchorFret`). Each box transposes to any key by shifting so the key's root lands
// on the anchor string; every placed note is then pitch-class-checked against the major scale.
export const CAGED_FORMS = [
  {
    id: "E",
    label: "E form",
    anchorString: "e2",
    anchorFret: 3,
    strings: { e1: [2, 3, 5], B: [3, 5], G: [2, 4, 5], D: [2, 4, 5], A: [2, 3, 5], e2: [2, 3, 5] },
  },
  {
    id: "D",
    label: "D form",
    anchorString: "D",
    anchorFret: 5,
    strings: { e1: [5, 7, 8], B: [5, 7, 8], G: [4, 5, 7], D: [4, 5, 7], A: [5, 7], e2: [5, 7, 8] },
  },
  {
    id: "C",
    label: "C form",
    anchorString: "A",
    anchorFret: 10,
    strings: { e1: [7, 8, 10], B: [7, 8, 10], G: [7, 9], D: [7, 9, 10], A: [7, 9, 10], e2: [7, 8, 10] },
  },
  {
    id: "A",
    label: "A form",
    anchorString: "A",
    anchorFret: 10,
    strings: { e1: [10, 12], B: [10, 12, 13], G: [9, 11, 12], D: [9, 10, 12], A: [9, 10, 12], e2: [10, 12] },
  },
  {
    id: "G",
    label: "G form",
    anchorString: "e2",
    anchorFret: 15,
    strings: { e1: [12, 14, 15], B: [12, 13, 15], G: [11, 12, 14], D: [12, 14], A: [12, 14, 15], e2: [12, 14, 15] },
  },
];

// selectable pattern systems; each defines its own position-building strategy and the
// scales it applies to. `allowedScales` = null means every scale works with it.
export const PATTERN_SYSTEMS = [
  { id: "modes3nps", label: "Modes / 3NPS", defaultScale: "major", allowedScales: null },
  { id: "caged", label: "CAGED boxes", defaultScale: "major", allowedScales: ["major"] },
  { id: "penta", label: "Pentatonic boxes", defaultScale: "minorPent", allowedScales: ["majorPent", "minorPent"] },
  { id: "blues", label: "Blues boxes", defaultScale: "blues", allowedScales: ["blues"] },
  { id: "twoOctave", label: "Two-octave", defaultScale: "major", allowedScales: null },
];

export function systemAllowsScale(systemId, scaleId) {
  const sys = PATTERN_SYSTEMS.find((s) => s.id === systemId);
  if (!sys || !sys.allowedScales) return true;
  return sys.allowedScales.includes(scaleId);
}

// shifts a standard-tuning reference frequency to a different note, picking the
// nearest direction around the chromatic circle (correct for all alt-tuning shifts, which are small)
export function shiftFreq(standardFreq, standardLetter, targetLetter) {
  const standardIdx = CHROMATIC.indexOf(standardLetter);
  const targetIdx = CHROMATIC.indexOf(targetLetter);
  let shift = (((targetIdx - standardIdx) % 12) + 12) % 12;
  if (shift > 6) shift -= 12;
  return standardFreq * Math.pow(2, shift / 12);
}

// combines the fixed per-string metadata (id/label/thickness) with a tuning preset's
// open notes, producing the array used everywhere else in the app for note/frequency math
export function tunedStrings(presetNotes) {
  return STRINGS.map((s, i) => ({
    ...s,
    open: presetNotes[i],
    openFreq: shiftFreq(s.openFreq, s.open, presetNotes[i]),
  }));
}

export function noteAt(openLetter, fret) {
  const start = CHROMATIC.indexOf(openLetter);
  return CHROMATIC[(start + fret) % 12];
}

export function freqAt(openFreq, fret) {
  return openFreq * Math.pow(2, fret / 12);
}

export function freqToNote(freq) {
  const midi = 69 + 12 * Math.log2(freq / 440);
  const rounded = Math.round(midi);
  const cents = Math.round((midi - rounded) * 100);
  const idx = ((rounded % 12) + 12) % 12;
  return { name: CHROMATIC[idx], cents, midi: rounded };
}

export function centsBetween(freq, target) {
  return 1200 * Math.log2(freq / target);
}

export function timeAgo(ts) {
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

// ---------- enharmonic spelling ----------

export const NATURAL_LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
export const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

// pitch classes that are conventionally spelled with flats (F major, and the
// "sharp-looking" roots C#/D#/G#/A# which are more practical as Db/Eb/Ab/Bb).
const FLAT_PREFERRED = { C: "C", F: "F", "C#": "Db", "D#": "Eb", "G#": "Ab", "A#": "Bb" };

// friendly label for a pitch class (sharp names are used internally for matching)
export function displayName(pc) {
  return FLAT_PREFERRED[pc] || pc;
}

// sharps are drawn on the same staff position as the natural below them, with an accidental
export function pitchClassToNatural(name) {
  if (!name.includes("#")) return { letter: name, sharp: false };
  return { letter: name[0], sharp: true };
}

// diatonic steps from the bottom staff line (E4) — each step is half a line-spacing vertically
export function noteNameToStepsFromE4(letter, octave) {
  return octave * 7 + NATURAL_LETTERS.indexOf(letter) - (4 * 7 + 2);
}

export function ledgerYsFor(stepsFromE4, bottomLineY, halfStep) {
  const ys = [];
  if (stepsFromE4 < 0) {
    for (let s = -2; s >= stepsFromE4 - (stepsFromE4 % 2 === 0 ? 0 : 1); s -= 2) ys.push(bottomLineY - s * halfStep);
  } else if (stepsFromE4 > 8) {
    for (let s = 10; s <= stepsFromE4 + (stepsFromE4 % 2 === 0 ? 0 : 1); s += 2) ys.push(bottomLineY - s * halfStep);
  }
  return ys;
}

// spelling style for a scale root: major keys on F and the flat-preferring roots
// (C#→Db, D#→Eb, G#→Ab, A#→Bb) use flats; everything else uses sharps.
export function spellDirection(rootIdx) {
  const pc = CHROMATIC[rootIdx];
  return FLAT_PREFERRED[pc] && (pc === "F" || pc.includes("#")) ? "flat" : "sharp";
}

const naturalPcOf = (letter) => [0, 2, 4, 5, 7, 9, 11][NATURAL_LETTERS.indexOf(letter)]; // C=0 D=2 E=4 F=5 G=7 A=9 B=11

// spells a scale the way it should be written in the key: each degree gets its own
// letter (all 7 used once for 7-note scales; letters skipped for pentatonic/blues),
// with ♯/♭ accidentals chosen to match the key. `intervals` should include the octave
// root (e.g. [...major.intervals, 12]).
export function spelledScaleSequence(rootIdx, intervals) {
  const dir = spellDirection(rootIdx);
  const names = dir === "flat" ? FLAT_NAMES : CHROMATIC;
  const rootLetter = names[rootIdx][0];
  const R = NATURAL_LETTERS.indexOf(rootLetter);
  const L = intervals.length;
  const letters = new Array(L);
  letters[0] = rootLetter;
  letters[L - 1] = rootLetter;

  // pentatonic/blues notes are a subset of a 7-note parent scale; spell them with the
  // parent's letters (so Db minor pentatonic reads Fb not E). If they fit the major
  // scale they're major-family, otherwise minor-family (covers majorPent/minorPent/blues).
  const MAJOR_PARENT = [0, 2, 4, 5, 7, 9, 11];
  const MINOR_PARENT = [0, 2, 3, 5, 7, 8, 10];
  const child = intervals.slice(0, L - 1);

  if (L === 8) {
    // 7-note scales use every letter once, ascending from the root (deterministic)
    for (let i = 1; i <= L - 2; i++) letters[i] = NATURAL_LETTERS[(R + i) % 7];
  } else {
    const parent = child.every((c) => MAJOR_PARENT.includes(c)) ? MAJOR_PARENT : MINOR_PARENT;
    let prevK = 0;
    for (let i = 1; i <= L - 2; i++) {
      const c = intervals[i];
      let k;
      if (c === 6) {
        // blues b5: reuse the 5th's letter when it's within a semitone of the b5
        // pitch (D blues b5→Ab, G blues b5→Db), otherwise use the 4th's letter
        // (Eb blues b5→A, F blues b5→B). Matches how blues scales are written.
        const b5Pc = (rootIdx + c) % 12;
        const fifthPc = naturalPcOf(NATURAL_LETTERS[(R + 4) % 7]);
        k = Math.abs(fifthPc - b5Pc) <= 1 ? 4 : 3;
        if (k < prevK) k = prevK;
      } else {
        // nearest parent-scale interval, non-decreasing; tie → later letter
        k = prevK;
        let bestDist = Infinity;
        for (let kk = prevK; kk < 7; kk++) {
          const dist = Math.abs(c - parent[kk]);
          if (dist < bestDist || (dist === bestDist && kk > k)) {
            bestDist = dist;
            k = kk;
          }
        }
      }
      prevK = k;
      letters[i] = NATURAL_LETTERS[(R + k) % 7];
    }
  }

  return intervals.map((iv, i) => {
    const pc = (rootIdx + iv) % 12;
    const letter = letters[i];
    let diff = (((pc - naturalPcOf(letter)) % 12) + 12) % 12;
    if (diff > 6) diff -= 12;
    const accidental = diff === 0 ? null : diff > 0 ? "#" : "b";
    const name = accidental ? letter + (accidental === "b" ? "b".repeat(-diff) : "#".repeat(diff)) : letter;
    return { pc, letter, accidental, diff, name, octave: 4 + Math.floor((rootIdx + iv) / 12) };
  });
}

// ---------- fretboard geometry ----------

// real fret spacing: frets compress toward the body, following the 12th-root-of-2 scale.
export function fretFraction(n) {
  return 1 - 1 / Math.pow(2, n / 12);
}

// ---------- note detection ----------

// cosine similarity between two harmonic fingerprints (5 ratios to the fundamental).
// Same string plucked at any fret keeps its timbre shape; an unrelated source (a TV,
// synth, another instrument) has a very different harmonic profile → low similarity.
export function fingerprintSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / Math.sqrt(na * nb);
}

// minimum fingerprint similarity required to accept a note as coming from a tuned string.
// Tunable: raise it to be stricter (more false rejects), lower to be more forgiving.
export const FINGERPRINT_MATCH = 0.5;

// pitch tolerance (cents) for a reading to count as a note on the neck at all
export const PITCH_TOLERANCE = 50;

// finds the neck position nearest `freq`. Uses each string's mic-calibrated open
// frequency when available (so tuning actually sharpens detection). Many notes live
// at the exact same pitch on neighbouring strings (G = string 3 open = string 4
// fret 5), so when several positions are within a small cents band of the best we
// break the tie with the string whose calibrated harmonic fingerprint is closest to
// the live sound. A reading that matches no calibrated string at all is rejected
// (that's how TV/synth tones are blocked).
export function nearestPosition(freq, guitarStrings, activeStrings, maxFret, preferredRange, tuning, fingerprint) {
  const openFreqFor = (s) => {
    const cal = tuning && tuning[s.id];
    return cal && cal.freq ? cal.freq : s.openFreq;
  };
  const simFor = (s) => {
    const cal = tuning && tuning[s.id];
    return fingerprint && cal && cal.fingerprint ? fingerprintSimilarity(fingerprint, cal.fingerprint) : null;
  };
  const anyCalibrated = guitarStrings.some((s) => {
    const cal = tuning && tuning[s.id];
    return cal && cal.fingerprint;
  });
  const TIE_BAND = 30; // cents around the best within which timbre decides

  // gateTimbre: true keeps the TV-block (drop strings whose timbre is clearly not
  // the calibrated guitar); false is the uncalibrated fallback that matches any string.
  const search = (fretMin, fretMax, tolerance, gateTimbre) => {
    let best = null;
    guitarStrings.forEach((s) => {
      if (!activeStrings.includes(s.id)) return;
      const sim = simFor(s);
      if (gateTimbre && sim !== null && sim < FINGERPRINT_MATCH) return;
      const base = openFreqFor(s);
      for (let fret = fretMin; fret <= fretMax; fret++) {
        const cents = Math.abs(1200 * Math.log2(freq / (base * Math.pow(2, fret / 12))));
        if (cents > tolerance) continue;
        if (!best || cents < best.cents - TIE_BAND) {
          best = { stringId: s.id, fret, cents, sim };
        } else if (cents <= best.cents + TIE_BAND) {
          const better =
            cents < best.cents ||
            (cents === best.cents && (sim ?? -1) > (best.sim ?? -1)) ||
            (cents === best.cents && (sim ?? -1) === (best.sim ?? -1) && s.id < best.stringId);
          if (better) best = { stringId: s.id, fret, cents, sim };
        }
      }
    });
    return best;
  };

  if (preferredRange) {
    const inWindow = search(preferredRange.start, preferredRange.end, 35, true);
    if (inWindow) return inWindow;
  }
  const gated = search(0, maxFret, PITCH_TOLERANCE, true);
  if (gated) return gated;
  if (anyCalibrated) return null; // notes are playing but none match our guitar's timbre
  return search(0, maxFret, PITCH_TOLERANCE, false); // nothing calibrated → match by pitch alone
}

// full gate for a mic sample in the practice modes: the signal must be confident
// (clear fundamental), on the neck within pitch tolerance, and timbre-matched.
export function matchReading(s, { guitarStrings, activeStrings, maxFret, tuning, preferredRange }) {
  if (!s || !s.freq || !s.confident) return null;
  return nearestPosition(s.freq, guitarStrings, activeStrings, maxFret, preferredRange, tuning, s.fingerprint);
}

// ---------- scale position builders ----------

// Recognized scale positions via the notes-per-string system:
//   7-note scales -> 3 notes per string (7 positions), 5/6-note scales -> 2 notes per string (5/6 boxes).
// Each position starts on a consecutive scale degree on the low-E string and walks the scale
// upward across the strings. Consecutive strings are tuned a 4th (5 semitones) apart except the
// G->B break (4 semitones); the drift between strings is exactly the scale distance of `nps`
// degrees minus the tuning offset, which is what produces the textbook boxes.
export function buildScalePositions(rootIdx, scale, maxFret, guitarStrings) {
  const intervals = scale.intervals;
  const N = intervals.length;
  const nps = N === 5 || N === 6 ? 2 : 3;
  const strings = [...guitarStrings].reverse(); // low E first
  const pcs = intervals.map((iv) => CHROMATIC[((rootIdx + iv) % 12 + 12) % 12]);
  const semisOf = (k) => intervals[k % N] + 12 * Math.floor(k / N);

  const tuningOffsets = [];
  for (let i = 0; i < strings.length - 1; i++) {
    const a = CHROMATIC.indexOf(strings[i].open);
    const b = CHROMATIC.indexOf(strings[i + 1].open);
    tuningOffsets.push((((b - a) % 12) + 12) % 12);
  }

  const occ = strings.map((s) => {
    const map = {};
    for (let f = 0; f <= maxFret; f++) {
      const n = noteAt(s.open, f);
      (map[n] = map[n] || []).push(f);
    }
    return map;
  });

  // nearest occurrence to `target`, but only within half an octave so we can't
  // accidentally jump to the wrong octave's occurrence (pcs repeat every 12 frets)
  const pick = (list, target) => {
    if (!list) return null;
    let best = null;
    for (const f of list) {
      if (Math.abs(f - target) > 6) continue;
      if (best === null || Math.abs(f - target) < Math.abs(best - target)) best = f;
    }
    return best;
  };

  const positions = [];
  for (let p = 0; p < N; p++) {
    const anchors = occ[0][pcs[p]] || [];
    let built = null;
    for (const anchor of anchors) {
      const notes = [];
      let startFret = anchor;
      let ok = true;
      for (let i = 0; i < strings.length; i++) {
        const baseIdx = p + nps * i;
        const firstFret = pick(occ[i][pcs[baseIdx % N]], startFret);
        if (firstFret === null) {
          ok = false;
          break;
        }
        notes.push({ stringId: strings[i].id, fret: firstFret, degree: baseIdx % N });
        let prevFret = firstFret;
        for (let j = 1; j < nps; j++) {
          const absIdx = baseIdx + j;
          const expected = prevFret + (semisOf(absIdx) - semisOf(baseIdx + j - 1));
          const fret = pick(occ[i][pcs[absIdx % N]], expected);
          if (fret === null) {
            ok = false;
            break;
          }
          notes.push({ stringId: strings[i].id, fret, degree: absIdx % N });
          prevFret = fret;
        }
        if (!ok) break;
        if (i < strings.length - 1) {
          startFret = firstFret + (semisOf(baseIdx + nps) - semisOf(baseIdx) - tuningOffsets[i]);
        }
      }
      if (ok) {
        const frets = notes.map((n) => n.fret);
        built = { notes, start: Math.min(...frets), end: Math.max(...frets), labelNote: pcs[p] };
        break;
      }
    }
    if (built) positions.push(built);
  }
  return positions;
}

// builds the five classic CAGED boxes for the selected root. The shapes are stored as fret
// positions for G major; transposing shifts the whole rigid shape so the key's root lands on
// the form's anchor string. Each occurrence of the root on the anchor string is tried, nearest
// to the shape's natural position first, until one fits within the neck; every placed note is
// then pitch-class-checked against the major scale so any data slip fails fast.
export function buildCagedPositions(rootIdx, maxFret, guitarStrings) {
  const major = SCALE_PATTERNS.find((s) => s.id === "major");
  const pcs = major.intervals.map((iv) => CHROMATIC[((rootIdx + iv) % 12 + 12) % 12]);
  const rootName = CHROMATIC[rootIdx];
  const positions = [];
  for (const form of CAGED_FORMS) {
    const anchor = guitarStrings.find((s) => s.id === form.anchorString);
    if (!anchor) continue;
    const anchors = [];
    for (let f = 0; f <= maxFret; f++) {
      if (noteAt(anchor.open, f) === rootName) anchors.push(f);
    }
    anchors.sort((a, b) => Math.abs(a - form.anchorFret) - Math.abs(b - form.anchorFret));
    let built = null;
    for (const anchorFret of anchors) {
      const shift = anchorFret - form.anchorFret;
      const notes = [];
      let ok = true;
      for (const [sid, frets] of Object.entries(form.strings)) {
        const s = guitarStrings.find((gs) => gs.id === sid);
        if (!s) {
          ok = false;
          break;
        }
        for (const f of frets) {
          const fret = f + shift;
          if (fret < 0 || fret > maxFret) {
            ok = false;
            break;
          }
          const pc = noteAt(s.open, fret);
          const deg = pcs.indexOf(pc);
          if (deg === -1) {
            ok = false;
            break;
          }
          notes.push({ stringId: sid, fret, degree: deg });
        }
        if (!ok) break;
      }
      if (!ok) continue;
      const frets = notes.map((n) => n.fret);
      built = {
        id: form.id,
        label: form.label,
        notes,
        start: Math.min(...frets),
        end: Math.max(...frets),
        labelNote: rootName,
      };
      break;
    }
    if (built) positions.push(built);
  }
  return positions;
}

// two-octave scale shapes: start on the root of the 6th or 5th string and walk the scale
// upward three notes per string, stopping exactly at the root two octaves up. Produces the
// classic "two octave scale" shapes (root on low E, root on A).
export function buildTwoOctavePositions(rootIdx, scale, maxFret, guitarStrings) {
  const intervals = scale.intervals;
  const N = intervals.length;
  const strings = [...guitarStrings].reverse(); // low E first
  const pcs = intervals.map((iv) => CHROMATIC[((rootIdx + iv) % 12 + 12) % 12]);
  const semisOf = (k) => intervals[k % N] + 12 * Math.floor(k / N);

  const tuningOffsets = [];
  for (let i = 0; i < strings.length - 1; i++) {
    const a = CHROMATIC.indexOf(strings[i].open);
    const b = CHROMATIC.indexOf(strings[i + 1].open);
    tuningOffsets.push((((b - a) % 12) + 12) % 12);
  }

  const occ = strings.map((s) => {
    const map = {};
    for (let f = 0; f <= maxFret; f++) {
      const n = noteAt(s.open, f);
      (map[n] = map[n] || []).push(f);
    }
    return map;
  });

  const pick = (list, target) => {
    if (!list) return null;
    let best = null;
    for (const f of list) {
      if (Math.abs(f - target) > 6) continue;
      if (best === null || Math.abs(f - target) < Math.abs(best - target)) best = f;
    }
    return best;
  };

  const positions = [];
  for (let anchorIdx = 0; anchorIdx <= 1; anchorIdx++) {
    const rootFrets = occ[anchorIdx][pcs[0]] || [];
    for (const startFret of rootFrets) {
      const notes = [];
      let str = anchorIdx;
      let prevFret = startFret;
      let placedOnString = 1;
      notes.push({ stringId: strings[str].id, fret: startFret, degree: 0 });
      let ok = true;
      for (let k = 1; k <= N * 2; k++) {
        const deg = k % N;
        const expected = prevFret + (semisOf(k) - semisOf(k - 1));
        let fret = null;
        if (placedOnString < 3 && str < strings.length) {
          fret = pick(occ[str][pcs[deg]], expected);
        }
        if (fret === null && str < strings.length - 1) {
          str++;
          placedOnString = 0;
          fret = pick(occ[str][pcs[deg]], expected - tuningOffsets[str - 1]);
        }
        if (fret === null) {
          ok = false;
          break;
        }
        notes.push({ stringId: strings[str].id, fret, degree: deg });
        prevFret = fret;
        placedOnString++;
      }
      if (!ok || notes.length !== N * 2 + 1) continue;
      const frets = notes.map((n) => n.fret);
      positions.push({
        id: `two-oct-${anchorIdx}-${startFret}`,
        label: `2-oct · ${strings[anchorIdx].label}`,
        notes,
        start: Math.min(...frets),
        end: Math.max(...frets),
        labelNote: pcs[0],
      });
    }
  }
  return positions;
}

// method-book finger numbers: within a 4-fret box each fret cell maps to one finger
// (1 = index … 4 = pinky); wider 3NPS/two-octave shapes use the per-string convention
// (fingers relative to the first note on that string, capped at 4).
export function addFingers(position) {
  const notes = position ? position.notes : [];
  if (!notes.length) return notes;
  const frets = notes.map((n) => n.fret);
  const span = Math.max(...frets) - Math.min(...frets);
  if (span <= 3) {
    const startFret = Math.min(...frets);
    return notes.map((n) => ({ ...n, finger: n.fret - startFret + 1 }));
  }
  const byString = {};
  for (const n of notes) (byString[n.stringId] = byString[n.stringId] || []).push(n);
  const fingered = [];
  for (const sid of Object.keys(byString)) {
    const ns = byString[sid].slice().sort((a, b) => a.fret - b.fret);
    const firstFret = ns[0].fret;
    for (const n of ns) fingered.push({ ...n, finger: Math.max(1, Math.min(4, n.fret - firstFret + 1)) });
  }
  return fingered;
}
