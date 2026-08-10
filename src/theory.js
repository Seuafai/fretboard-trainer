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
  { id: "majorPent", label: "Pentatonic (Major)", intervals: [0, 2, 4, 7, 9] },
  { id: "majorBlues", label: "Blues (Major)", intervals: [0, 2, 3, 4, 7, 9] },
  { id: "majorFlat7", label: "Major + ♭7", intervals: [0, 2, 4, 5, 7, 9, 10] },
  { id: "minor", label: "Minor (Aeolian)", intervals: [0, 2, 3, 5, 7, 8, 10] },
  { id: "minorPent", label: "Pentatonic (Minor)", intervals: [0, 3, 5, 7, 10] },
  { id: "blues", label: "Blues (Minor)", intervals: [0, 3, 5, 6, 7, 10] },
  { id: "arpMajor", label: "Arpeggio (Major)", intervals: [0, 4, 7] },
  { id: "arpMaj7", label: "Arpeggio (Major 7th)", intervals: [0, 4, 7, 11] },
  { id: "arpDom7", label: "Arpeggio (Dominant 7th)", intervals: [0, 4, 7, 10] },
  { id: "arpMinor", label: "Arpeggio (Minor)", intervals: [0, 3, 7] },
  { id: "arpMin7", label: "Arpeggio (Minor 7th)", intervals: [0, 3, 7, 10] },
  { id: "arpDim", label: "Arpeggio (Diminished)", intervals: [0, 3, 6] },
  { id: "arpAug", label: "Arpeggio (Augmented)", intervals: [0, 4, 8] },
  { id: "harmonicMinor", label: "Harmonic Minor", intervals: [0, 2, 3, 5, 7, 8, 11] },
  { id: "dorian", label: "Dorian", intervals: [0, 2, 3, 5, 7, 9, 10] },
  { id: "phrygian", label: "Phrygian", intervals: [0, 1, 3, 5, 7, 8, 10] },
  { id: "lydian", label: "Lydian", intervals: [0, 2, 4, 6, 7, 9, 11] },
  { id: "mixolydian", label: "Mixolydian", intervals: [0, 2, 4, 5, 7, 9, 10] },
  { id: "locrian", label: "Locrian", intervals: [0, 1, 3, 5, 6, 8, 10] },
  { id: "chromatic", label: "Chromatic", intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
];

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

// timbre distance between two harmonic fingerprints (ratios of harmonics 2..6 to
// the fundamental). Cosine similarity can't separate these — the profiles are all
// decaying and nearly co-linear — so we compare the actual ratio magnitudes on a
// log scale. Same string ≈ 0.05–0.3 octaves of mean divergence, a different string
// of the same note more, a TV/synth beep far more (its harmonic ratios are ~0).
export function fingerprintDistance(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const x = Math.max(a[i], 0.01);
    const y = Math.max(b[i], 0.01);
    s += Math.abs(Math.log2(x / y));
  }
  return s / a.length;
}

// maximum mean octaves of timbre divergence for a note to count as coming from the
// calibrated guitar. Tunable: lower = stricter (more false rejects), higher = more forgiving.
export const FINGERPRINT_MATCH = 0.8;

// pitch tolerance (cents) for a reading to count as a note on the neck at all
export const PITCH_TOLERANCE = 50;

// the fretted positions that are a unison with some other string's open note —
// pitch alone can't tell those apart, so the calibration test records a timbre
// fingerprint at each one and the tie-break below compares against the spot.
export function unisonSpots(guitarStrings, maxFret) {
  const seen = new Set();
  const spots = [];
  guitarStrings.forEach((a) => {
    guitarStrings.forEach((b) => {
      if (a.id === b.id) return;
      for (let fret = 1; fret <= maxFret; fret++) {
        if (Math.abs(centsBetween(freqAt(a.openFreq, fret), b.openFreq)) < 5) {
          const key = `${a.id}:${fret}`;
          if (!seen.has(key)) {
            seen.add(key);
            spots.push({ stringId: a.id, fret, note: b.open });
          }
          break;
        }
      }
    });
  });
  const order = new Map(guitarStrings.map((s, i) => [s.id, i]));
  spots.sort((x, y) => (order.get(y.stringId) ?? 0) - (order.get(x.stringId) ?? 0) || x.fret - y.fret);
  return spots;
}

// finds the neck position nearest `freq`. Uses each string's mic-calibrated open
// frequency when available (so tuning actually sharpens detection). Many notes live
// at the exact same pitch on neighbouring strings (G = string 3 open = string 4
// fret 5), so when several positions are within a small cents band of the best we
// break the tie with the string whose calibrated harmonic fingerprint is closest to
// the live sound. When a fingerprint was recorded at the exact spot (the calibration
// test), that one is used; otherwise the string's open fingerprint is the fallback.
// A reading that matches no calibrated string at all is rejected (TV/synth tones).
export function nearestPosition(freq, guitarStrings, activeStrings, maxFret, preferredRange, tuning, fingerprint) {
  const openFreqFor = (s) => {
    const cal = tuning && tuning[s.id];
    return cal && cal.freq ? cal.freq : s.openFreq;
  };
  // the fingerprint recorded closest to the candidate: exact spot > open string
  const fpFor = (s, fret) => {
    const cal = tuning && tuning[s.id];
    if (!cal) return null;
    const spot = cal.spots && cal.spots[fret];
    if (spot && spot.fingerprint) return spot.fingerprint;
    return cal.fingerprint || null;
  };
  const anyCalibrated = guitarStrings.some((s) => {
    const cal = tuning && tuning[s.id];
    return cal && (cal.fingerprint || (cal.spots && Object.keys(cal.spots).length));
  });
  const TIE_BAND = 30; // cents around the best within which timbre decides
  const UNISON_EPS = 1; // cents: below this, positions are the same pitch → timbre decides

  // gateTimbre: true keeps the TV-block (drop candidates whose timbre is clearly
  // not the calibrated guitar); false is the uncalibrated fallback (pitch only).
  const search = (fretMin, fretMax, tolerance, gateTimbre) => {
    let best = null;
    guitarStrings.forEach((s) => {
      if (!activeStrings.includes(s.id)) return;
      const base = openFreqFor(s);
      for (let fret = fretMin; fret <= fretMax; fret++) {
        const cents = Math.abs(1200 * Math.log2(freq / (base * Math.pow(2, fret / 12))));
        if (cents > tolerance) continue;
        const fp = fingerprint ? fpFor(s, fret) : null;
        const dist = fp ? fingerprintDistance(fingerprint, fp) : null;
        if (gateTimbre && dist !== null && dist > FINGERPRINT_MATCH) continue;
        if (!best || cents < best.cents - TIE_BAND) {
          best = { stringId: s.id, fret, cents, dist };
        } else if (cents <= best.cents + TIE_BAND) {
          const samePitch = Math.abs(cents - best.cents) <= UNISON_EPS;
          const better =
            cents < best.cents - UNISON_EPS ||
            (samePitch && (dist ?? Infinity) < (best.dist ?? Infinity)) ||
            (samePitch && (dist ?? Infinity) === (best.dist ?? Infinity) && s.id < best.stringId);
          if (better) best = { stringId: s.id, fret, cents, dist };
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
  // the walk assumes strings are ordered low to high (index 0 = the low-E anchor string);
  // sort internally so the builders work with any input order
  const strings = guitarStrings
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (a.s.openFreq ?? a.i) - (b.s.openFreq ?? b.i))
    .map(({ s }) => s);
  const intervals = scale.intervals;
  const N = intervals.length;
  const nps = N <= 6 ? 2 : 3;
  const pcs = intervals.map((iv) => CHROMATIC[((rootIdx + iv) % 12 + 12) % 12]);
  const semisOf = (k) => intervals[k % N] + 12 * Math.floor(k / N);

  const occ = strings.map((s) => {
    const map = {};
    for (let f = 0; f <= maxFret; f++) {
      const n = noteAt(s.open, f);
      (map[n] = map[n] || []).push(f);
    }
    return map;
  });

  // the first note of a string's group is placed near the anchor fret (the position's
  // low-E root), keeping the whole position compact — the classic 3NPS / pentatonic
  // boxes. The remaining notes follow the scale upward 1-2 frets per step.
  const pickGroupStart = (strOcc, degIdx, anchorFret) => {
    const list = strOcc[pcs[degIdx % N]];
    if (!list) return null;
    let best = null;
    for (const f of list) {
      if (Math.abs(f - anchorFret) > 4) continue;
      if (best === null || Math.abs(f - anchorFret) < Math.abs(best - anchorFret)) best = f;
    }
    return best;
  };

  const positions = [];
  for (let p = 0; p < N; p++) {
    // anchor: lowest fret on the low-E string that is this scale degree and lets the
    // whole shape fit within the neck
    const anchors = occ[0][pcs[p]] || [];
    let built = null;
    for (const anchor of anchors) {
      const notes = [];
      let ok = true;
      for (let i = 0; i < strings.length; i++) {
        const baseIdx = p + nps * i;
        const firstFret = pickGroupStart(occ[i], baseIdx, anchor);
        if (firstFret === null) {
          ok = false;
          break;
        }
        notes.push({ stringId: strings[i].id, fret: firstFret, degree: baseIdx % N });
        let prevFret = firstFret;
        for (let j = 1; j < nps; j++) {
          const absIdx = baseIdx + j;
          const expected = prevFret + (semisOf(absIdx) - semisOf(baseIdx + j - 1));
          const list = occ[i][pcs[absIdx % N]];
          let fret = null;
          for (const f of list) {
            if (Math.abs(f - expected) <= 1 && (fret === null || Math.abs(f - expected) < Math.abs(fret - expected))) fret = f;
          }
          if (fret === null) {
            ok = false;
            break;
          }
          notes.push({ stringId: strings[i].id, fret, degree: absIdx % N });
          prevFret = fret;
        }
        if (!ok) break;
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

// ---------- pattern families ----------

// The classic CAGED major-scale boxes — five overlapping shapes named after their chord form.
// `strings` holds per-string fret numbers for G major (key root G, tonic fret on the anchor
// string in `anchorFret`). Each box transposes to any key by shifting so the key's root lands
// on the anchor string; every placed note is then pitch-class-checked against the major scale.
const CAGED_FORMS = [
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

// The CAGED forms are the G-major fingerings, so a scale whose note spacing differs from
// major (e.g. harmonic minor's augmented 2nd ♭6→7) can leave some of its tones sitting
// just outside every transposed box. Complete each box by pulling in each missing scale
// tone where the scale's own step geometry puts it — continuing a string's existing
// consecutive run (root-2nd-♭3 on the low E, say) ahead of filling a gap — rather than
// just the nearest empty fret. Never a 3-note span covering 5+ frets. This is a no-op for
// scales whose boxes are already complete (major and the modal scales).
function completeScalePosition(position, scalePcs, maxFret, guitarStrings) {
  const present = new Set(position.notes.map((n) => n.degree));
  const missing = [];
  for (let d = 0; d < scalePcs.length; d++) if (!present.has(d)) missing.push(d);
  if (!missing.length) return position;

  const order = new Map(guitarStrings.map((s, i) => [s.id, i]));
  const N = scalePcs.length;
  const rootPc = CHROMATIC.indexOf(scalePcs[0]);
  const semis = scalePcs.map((pc) => (CHROMATIC.indexOf(pc) - rootPc + 12) % 12);
  const notes = position.notes.map((n) => ({ ...n }));
  const byString = {};
  for (const n of notes) (byString[n.stringId] = byString[n.stringId] || []).push(n);

  for (const deg of missing) {
    const pc = scalePcs[deg];
    let pick = null;
    let cands = null;
    for (const [ws, we] of [
      [position.start - 1, position.end + 1],
      [position.start - 2, position.end + 2],
      [position.start - 3, position.end + 3],
    ]) {
      cands = [];
      for (const s of guitarStrings) {
        const placed = byString[s.id] || [];
        if (placed.length >= 4) continue; // hard cap: never 5 notes on a string
        const placedDegs = new Set(placed.map((n) => n.degree));
        const hasPrev = placedDegs.has((deg - 1 + N) % N);
        const hasNext = placedDegs.has((deg + 1) % N);
        const cur = placed.map((n) => n.fret);
        for (let f = Math.max(0, ws); f <= Math.min(maxFret, we); f++) {
          if (cur.includes(f)) continue;
          if (noteAt(s.open, f) !== pc) continue;
          // does this fret continue the string's scale run from a neighbouring degree?
          let aligned = false;
          for (const n of placed) {
            const pred = n.fret + semis[deg] - semis[n.degree];
            const oct = Math.round((f - pred) / 12) * 12;
            if (pred + oct === f) {
              aligned = true;
              break;
            }
          }
          const test = cur.concat(f).sort((a, b) => a - b);
          let wide = false;
          for (let i = 0; i + 2 < test.length; i++) {
            if (test[i + 2] - test[i] >= 5) {
              wide = true;
              break;
            }
          }
          if (wide) continue;
          // preference: extend a consecutive run > fill a gap > sit beside a degree
          const score = !hasPrev && !hasNext ? 4 : hasPrev && !hasNext ? 1 : hasPrev && hasNext ? 2 : 3;
          cands.push({ stringId: s.id, fret: f, score: aligned ? score : score + 5, aligned });
        }
      }
      if (!cands.length) continue;
      cands.sort(
        (a, b) => a.score - b.score || a.fret - b.fret || (order.get(a.stringId) ?? 0) - (order.get(b.stringId) ?? 0)
      );
      pick = cands[0];
      break;
    }
    if (!pick) continue;
    notes.push({ stringId: pick.stringId, fret: pick.fret, degree: deg });
    (byString[pick.stringId] = byString[pick.stringId] || []).push({ stringId: pick.stringId, fret: pick.fret, degree: deg });
    // the classic shapes mirror across the two E strings (both carry the same run, e.g. the
    // R-2-♭3 on Shape 1). When the best placement is on one E string and its mirror has the
    // identical aligned spot, complete both instead of picking one.
    const mirror = pick.stringId === "e1" ? "e2" : pick.stringId === "e2" ? "e1" : null;
    if (mirror && cands) {
      const m = cands.find((c) => c.stringId === mirror && c.fret === pick.fret);
      if (m) {
        notes.push({ stringId: m.stringId, fret: m.fret, degree: deg });
        (byString[m.stringId] = byString[m.stringId] || []).push({ stringId: m.stringId, fret: m.fret, degree: deg });
      }
    }
  }
  notes.sort((a, b) => (order.get(a.stringId) ?? 0) - (order.get(b.stringId) ?? 0) || a.fret - b.fret);
  const frets = notes.map((n) => n.fret);
  return { ...position, notes, start: Math.min(...frets), end: Math.max(...frets) };
}

// builds the five classic CAGED boxes for the selected root and scale. The shapes are stored
// as fret positions for G major; transposing shifts the whole rigid shape so the key's root
// lands on the form's anchor string. Each occurrence of the root on the anchor string is
// tried, lowest on the neck first (so open-position and first-position shapes are found
// before their higher repetitions), until one fits within the neck. Only notes whose pitch
// class is in the scale are kept — for the major scale this is every note
// of the classic CAGED positions; for other scales it is the same textbook boxes containing
// that scale's tones.
//
// `positionRootIdx` lets a scale's shapes be anchored to a different root than the one used
// for pitch-class/degree labelling: the modes anchor to their relative major, whose boxes
// contain every one of the seven modal tones. Defaults to the scale root.
export function buildCagedPositions(rootIdx, scale, maxFret, guitarStrings, positionRootIdx = rootIdx) {
  const pcs = scale.intervals.map((iv) => CHROMATIC[((rootIdx + iv) % 12 + 12) % 12]);
  const rootName = CHROMATIC[positionRootIdx];
  const positions = [];
  for (const form of CAGED_FORMS) {
    const anchor = guitarStrings.find((s) => s.id === form.anchorString);
    if (!anchor) continue;
    const anchors = [];
    for (let f = 0; f <= maxFret; f++) {
      if (noteAt(anchor.open, f) === rootName) anchors.push(f);
    }
    anchors.sort((a, b) => a - b); // lowest (open-position) anchor first
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
          if (deg === -1) continue; // not a scale tone — drop it, don't fail the shape
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
        labelNote: CHROMATIC[rootIdx],
      };
      break;
    }
    if (built) positions.push(completeScalePosition(built, pcs, maxFret, guitarStrings));
  }
  return positions;
}

// blues boxes: the classic pentatonic boxes with the blue note added where it falls
// inside each box (♭5 for minor blues, ♭3 for major blues). This keeps every box a
// compact 2-notes-per-string shape instead of a stretched walk. Every note carries its
// degree in the six-note blues scale (not the pentatonic parent).
export function buildBluesBoxes(rootIdx, scale, maxFret, guitarStrings) {
  const isMajorBlues = scale.id === "majorBlues";
  const pentaId = isMajorBlues ? "majorPent" : "minorPent";
  const blueIv = isMajorBlues ? 3 : 6;
  const penta = SCALE_PATTERNS.find((s) => s.id === pentaId);
  const bluesPcs = scale.intervals.map((iv) => CHROMATIC[((rootIdx + iv) % 12 + 12) % 12]);
  const bluePc = CHROMATIC[((rootIdx + blueIv) % 12 + 12) % 12];
  const blueDeg = scale.intervals.indexOf(blueIv);
  const openOf = new Map(guitarStrings.map((s) => [s.id, s.open]));
  const boxes = buildScalePositions(rootIdx, penta, maxFret, guitarStrings);
  return boxes.map((box, i) => {
    const notes = box.notes.map((n) => ({ ...n, degree: bluesPcs.indexOf(noteAt(openOf.get(n.stringId), n.fret)) }));
    const spanStart = box.start - 1;
    const spanEnd = box.end + 1;
    for (const s of guitarStrings) {
      const strHasNotes = notes.some((n) => n.stringId === s.id);
      if (!strHasNotes) continue;
      for (let f = spanStart; f <= spanEnd; f++) {
        if (f < 0 || f > maxFret) continue;
        if (noteAt(s.open, f) === bluePc && !notes.some((n) => n.stringId === s.id && n.fret === f)) {
          notes.push({ stringId: s.id, fret: f, degree: blueDeg });
        }
      }
    }
    notes.sort((a, b) => a.stringId === b.stringId ? a.fret - b.fret : 0);
    const frets = notes.map((n) => n.fret);
    return { ...box, id: `blues-${i}`, notes, start: Math.min(...frets), end: Math.max(...frets) };
  });
}

// compact arpeggio shapes: reuse the five CAGED chord-form shapes, transposing each to the
// selected root and keeping the notes that are arpeggio tones (root, 3rd, 5th, [7th]). The
// chord forms are major triads, so the ♭3/♭7 of a minor or dominant arpeggio never appear in
// the raw shape — we pull them in from the notes that sit just inside the form's box so every
// arpeggio shape is complete. Every resulting shape is one of the classic chord-shaped
// arpeggios, so no string ever carries 3 notes covering 5+ frets — satisfying the
// "no wide spreads" preference.
export function buildArpeggioPositions(rootIdx, scale, maxFret, guitarStrings) {
  const pcs = scale.intervals.map((iv) => CHROMATIC[((rootIdx + iv) % 12 + 12) % 12]);
  const rootName = CHROMATIC[rootIdx];
  const positions = [];
  for (const form of CAGED_FORMS) {
    const anchor = guitarStrings.find((s) => s.id === form.anchorString);
    if (!anchor) continue;
    const anchors = [];
    for (let f = 0; f <= maxFret; f++) {
      if (noteAt(anchor.open, f) === rootName) anchors.push(f);
    }
    anchors.sort((a, b) => a - b); // lowest (open-position) anchor first
    let built = null;
    for (const anchorFret of anchors) {
      const shift = anchorFret - form.anchorFret;
      const notes = [];
      let ok = true;
      let minRaw = Infinity;
      let maxRaw = -Infinity;
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
          if (fret < minRaw) minRaw = fret;
          if (fret > maxRaw) maxRaw = fret;
          const pc = noteAt(s.open, fret);
          const deg = pcs.indexOf(pc);
          if (deg === -1) continue; // not an arpeggio tone — skip, don't fail
          notes.push({ stringId: sid, fret, degree: deg });
        }
        if (!ok) break;
      }
      if (!ok) continue;
      // complete the shape: any arpeggio tone sitting just inside the form's box
      // (e.g. the ♭3 of a minor chord or the 7th of a 7th chord) that the raw
      // major-triad shape doesn't contain. A tone is only kept when it doesn't give
      // a string 3 notes covering 5+ frets (the "no wide spreads" invariant).
      const order = new Map(guitarStrings.map((s, i) => [s.id, i]));
      const byString = {};
      for (const n of notes) (byString[n.stringId] = byString[n.stringId] || []).push({ ...n });
      const finalNotes = [];
      for (const s of guitarStrings) {
        const core = (byString[s.id] || []).slice().sort((a, b) => a.fret - b.fret);
        const kept = core.map((n) => n.fret);
        const cands = [];
        for (let f = Math.max(0, minRaw - 1); f <= Math.min(maxFret, maxRaw + 1); f++) {
          if (kept.includes(f)) continue;
          const pc = noteAt(s.open, f);
          const deg = pcs.indexOf(pc);
          if (deg !== -1) cands.push({ fret: f, degree: deg });
        }
        cands.sort((a, b) => a.fret - b.fret);
        for (const c of cands) {
          const test = kept.concat(c.fret).sort((a, b) => a - b);
          let wide = false;
          for (let i = 0; i + 2 < test.length; i++) {
            if (test[i + 2] - test[i] >= 5) {
              wide = true;
              break;
            }
          }
          if (!wide) kept.push(c.fret);
        }
        const set = new Map(core.map((n) => [n.fret, n]));
        for (const f of kept) {
          finalNotes.push(set.get(f) || { stringId: s.id, fret: f, degree: pcs.indexOf(noteAt(s.open, f)) });
        }
      }
      finalNotes.sort((a, b) => (order.get(a.stringId) ?? 0) - (order.get(b.stringId) ?? 0) || a.fret - b.fret);
      const frets = finalNotes.map((n) => n.fret);
      built = {
        id: form.id,
        label: form.label,
        notes: finalNotes,
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


// the single set of textbook scale shapes shown in the Scales → Patterns tab. Every scale
// gets its classic five shapes, numbered Shape 1..5 in the UI:
//  - 7-note scales (major, modes, harmonic minor): the five CAGED positions. The modes
//    anchor to their relative major (A Dorian = the G major positions), so every box
//    contains all seven scale tones instead of leaving some out.
//  - pentatonic: the five classic boxes
//  - blues: the five blues boxes (pentatonic + blue note)
//  - arpeggios: the five chord-shaped arpeggios
// Invariant: on any string, 3 notes are allowed but never span 5+ frets.

// semitones from a modal root up to its relative major's root (0 = the scale is its own major)
const MODE_TO_MAJOR_OFFSET = {
  majorFlat7: 7, // mixolydian
  minor: 9, // aeolian
  dorian: 2,
  phrygian: 4,
  lydian: 5,
  mixolydian: 7,
  locrian: 11,
};

// The five classic harmonic minor positions, built exactly like the aeolian (natural minor)
// boxes: the same CAGED positions the app uses for natural minor, with the ♭7 raised to the
// leading tone (7) and each box completed with its full runs of scale tones. Shape 1 starts
// on the root of the low E string, and every position contains all seven notes of the scale.
// Each layout lists, per string, the scale degrees that belong to it in ascending fret
// order; frets are derived from the root's position on the form's anchor string.
const HARMONIC_MINOR_SHAPES = [
  {
    id: "E",
    label: "Position 1",
    rootString: "e2",
    layout: { e2: [0, 1, 2], A: [3, 4, 5], D: [6, 0], G: [1, 2, 3], B: [4, 5, 6], e1: [0, 1, 2] },
  },
  {
    id: "D",
    label: "Position 2",
    rootString: "D",
    layout: { e2: [1, 2, 3], A: [4, 5, 6], D: [0, 1, 2], G: [3, 4, 5], B: [6, 0], e1: [1, 2, 3] },
  },
  {
    id: "C",
    label: "Position 3",
    rootString: "A",
    layout: { e2: [3, 4, 5], A: [6, 0], D: [1, 2, 3], G: [4, 5, 6], B: [0, 1, 2], e1: [3, 4, 5] },
  },
  {
    id: "A",
    label: "Position 4",
    rootString: "A",
    layout: { e2: [4, 5, 6], A: [0, 1, 2], D: [3, 4, 5], G: [6, 0, 1], B: [1, 2, 3], e1: [4, 5, 6] },
  },
  {
    id: "G",
    label: "Position 5",
    rootString: "G",
    layout: { e2: [6, 0], A: [1, 2, 3], D: [4, 5, 6], G: [0, 1, 2], B: [3, 4, 5], e1: [6, 0] },
  },
];

export function buildHarmonicMinorPositions(rootIdx, scale, maxFret, guitarStrings) {
  const pcs = scale.intervals.map((iv) => CHROMATIC[((rootIdx + iv) % 12 + 12) % 12]);
  const rootPc = pcs[0];
  const positions = [];
  for (const form of HARMONIC_MINOR_SHAPES) {
    const anchor = guitarStrings.find((s) => s.id === form.rootString);
    if (!anchor) continue;
    const anchors = [];
    for (let f = 0; f <= maxFret; f++) {
      if (noteAt(anchor.open, f) === rootPc) anchors.push(f);
    }
    anchors.sort((a, b) => a - b); // lowest (open-position) anchor first
    let built = null;
    for (const a of anchors) {
      const notes = [];
      let ok = true;
      for (const [sid, degs] of Object.entries(form.layout)) {
        const s = guitarStrings.find((gs) => gs.id === sid);
        if (!s) {
          ok = false;
          break;
        }
        for (const deg of degs) {
          let best = null;
          for (let f = Math.max(0, a - 6); f <= Math.min(maxFret, a + 6); f++) {
            if (noteAt(s.open, f) !== pcs[deg]) continue;
            const d = Math.abs(f - a);
            if (best == null || d < best.d) best = { f, d };
          }
          if (!best) {
            ok = false;
            break;
          }
          notes.push({ stringId: sid, fret: best.f, degree: deg });
        }
        if (!ok) break;
      }
      if (!ok) continue;
      // reject anchors that force an unplayable reach (e.g. a root landing on an open
      // string with its leading tone an octave below): no string may span 7+ frets and
      // no three consecutive notes on one string may span 5+ frets
      const perString = {};
      for (const n of notes) (perString[n.stringId] = perString[n.stringId] || []).push(n.fret);
      let reachable = true;
      for (const frets of Object.values(perString)) {
        frets.sort((x, y) => x - y);
        if (frets[frets.length - 1] - frets[0] >= 7) {
          reachable = false;
          break;
        }
        for (let i = 0; i + 2 < frets.length; i++) {
          if (frets[i + 2] - frets[i] >= 5) {
            reachable = false;
            break;
          }
        }
        if (!reachable) break;
      }
      if (!reachable) continue;
      const frets = notes.map((n) => n.fret);
      built = {
        id: form.id,
        label: form.label,
        notes,
        start: Math.min(...frets),
        end: Math.max(...frets),
        labelNote: CHROMATIC[rootIdx],
      };
      break;
    }
    if (built) positions.push(built);
  }
  return positions;
}

// the classic CAGED layouts assume standard tuning; fall back to the generic box builder
// for non-standard tunings so nothing renders off the neck
const isStandardTuning = (guitarStrings) =>
  guitarStrings &&
  ["e2", "A", "D", "G", "B", "e1"].every((id) => {
    const s = guitarStrings.find((gs) => gs.id === id);
    return s && s.open === (id === "e2" || id === "e1" ? "E" : id);
  });

export function buildTextbookPositions(rootIdx, scale, maxFret, guitarStrings) {
  const N = scale.intervals.length;
  if (["majorPent", "minorPent"].includes(scale.id)) return buildScalePositions(rootIdx, scale, maxFret, guitarStrings);
  if (["blues", "majorBlues"].includes(scale.id)) return buildBluesBoxes(rootIdx, scale, maxFret, guitarStrings);
  if (N <= 4) return buildArpeggioPositions(rootIdx, scale, maxFret, guitarStrings);
  if (scale.id === "harmonicMinor" && isStandardTuning(guitarStrings)) return buildHarmonicMinorPositions(rootIdx, scale, maxFret, guitarStrings);
  const offset = MODE_TO_MAJOR_OFFSET[scale.id];
  const positionRootIdx = offset == null ? rootIdx : ((rootIdx - offset) % 12 + 12) % 12;
  return buildCagedPositions(rootIdx, scale, maxFret, guitarStrings, positionRootIdx);
}

// Standard finger numbers:
//  - open-position shapes: open strings are 0, fretted notes follow the open layout
//  - a 4-fret box (or tighter): one finger per fret, index on the lowest fret
//  - wider 3NPS-style shapes: each string starts on finger 1 and fingers follow the
//    fret gaps (skip a finger for a 2-semitone gap), capped at the pinky at 4
export function addFingers(position) {
  const notes = position ? position.notes : [];
  if (!notes.length) return notes;
  const frets = notes.map((n) => n.fret);
  const startFret = Math.min(...frets);
  const span = Math.max(...frets) - startFret;

  if (startFret === 0) {
    return notes.map((n) => ({ ...n, finger: n.fret === 0 ? 0 : Math.min(4, n.fret) }));
  }

  if (span <= 3) {
    return notes.map((n) => ({ ...n, finger: n.fret - startFret + 1 }));
  }

  const byString = {};
  for (const n of notes) (byString[n.stringId] = byString[n.stringId] || []).push(n);
  const fingered = [];
  for (const sid of Object.keys(byString)) {
    const ns = byString[sid].slice().sort((a, b) => a.fret - b.fret);
    let prevFinger = 0;
    let prevFret = null;
    for (const n of ns) {
      const gap = prevFret === null ? 0 : n.fret - prevFret;
      prevFinger = Math.min(4, prevFinger + (gap === 0 ? 1 : gap));
      prevFret = n.fret;
      fingered.push({ ...n, finger: prevFinger });
    }
  }
  return fingered;
}
