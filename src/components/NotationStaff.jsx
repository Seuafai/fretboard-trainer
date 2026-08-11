import { useEffect, useMemo, useRef, useState } from "react";
import { CHROMATIC, ledgerYsFor, noteNameToStepsFromE4 } from "../theory.js";

const NATURAL_LETTERS = ["C", "D", "E", "F", "G", "A", "B"];

// shows the played phrase laid out on the staff as written music, in the scale's key
// signature. `sequence` is the run in play order (ascending then descending), each note
// carrying its key-correct spelling from spelledScaleSequence(). `keySignature` is the
// scale's accidental letters in circle-of-fifths order (from keySignatureOfScale) and
// `keySigLetters` is that same set, used to drop redundant per-note accidentals.
// `highlightPcs` maps pitch class -> colour (root amber, 3rd blue, 5th purple) to match
// the fretboard highlight. `activeIndex` is the position in the run currently sounding —
// that note gets the white highlight. `heardMidi` is the pitch the mic just heard — every
// occurrence of it in the phrase lights green, matching the fretboard's heard flash.
//
// The run always fits the available width: one line at natural spacing when it fits,
// packed a little tighter when it nearly does, and split across several staff systems
// (like real sheet music) when one line would get too cramped to read.
export default function NotationStaff({ sequence, keySignature, highlightPcs, activeIndex, heardMidi }) {
  const lineSpacing = 12;
  const halfStep = lineSpacing / 2;
  const bottomLineY = 96; // E4, the bottom staff line (first system)
  const startX = 46;
  const stepX = 28; // natural horizontal spacing per note
  const minStepX = 20; // below this, wrap to another system instead of squashing further

  const keySig = keySignature || [];
  const sigStartX = 58;
  const sigGap = 13;
  const firstNotesStartX = startX + (keySig.length ? sigStartX - startX + keySig.length * sigGap + 8 : 0);
  const contNotesStartX = startX + (sigStartX - startX) + 8; // clef only on continuation lines
  const sigLetterToSteps = (letter) => NATURAL_LETTERS.indexOf(letter) - 2; // steps above E4

  const wrapRef = useRef(null);
  const [availW, setAvailW] = useState(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setAvailW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // choose a stepX and split the run into staff systems that fit the measured width
  const layout = useMemo(() => {
    if (availW == null || sequence.length === 0) return null;
    const w = Math.max(120, availW - 12);
    const lines = [];
    let step;
    const firstRoom = w - firstNotesStartX - 20;
    if (firstNotesStartX + sequence.length * stepX + 20 <= w) {
      step = stepX; // fits at natural spacing
      lines.push({ start: 0, count: sequence.length, notesStartX: firstNotesStartX });
    } else if (firstRoom / sequence.length >= minStepX) {
      step = firstRoom / sequence.length; // pack one line until it gets too cramped
      lines.push({ start: 0, count: sequence.length, notesStartX: firstNotesStartX });
    } else {
      step = stepX; // wrap: as many natural-spaced notes per line as fit
      let start = 0;
      while (start < sequence.length) {
        const nsx = start === 0 ? firstNotesStartX : contNotesStartX;
        const capacity = Math.max(4, Math.floor((w - nsx - 20) / step));
        const count = Math.min(capacity, sequence.length - start);
        lines.push({ start, count, notesStartX: nsx });
        start += count;
      }
    }
    return { step, lines };
  }, [availW, sequence.length]);

  const systems = useMemo(() => {
    if (!layout) return [];
    const staffH = 4 * lineSpacing;
    const gapY = 26;
    return layout.lines.map((ln, li) => ({
      ...ln,
      bottomLineY: bottomLineY + li * (staffH + gapY),
      lineRight: ln.notesStartX + (ln.count - 1) * layout.step + 20,
    }));
  }, [layout]);

  const noteToSystem = useMemo(() => {
    if (!systems.length) return [];
    const map = new Array(sequence.length);
    systems.forEach((s, si) => {
      for (let i = s.start; i < s.start + s.count; i++) map[i] = si;
    });
    return map;
  }, [systems, sequence.length]);

  let notes = [];
  let viewW = 120;
  let viewH = 160;
  let shift = 0;
  if (layout) {
    notes = sequence.map((n, i) => {
      const stepsFromE4 = noteNameToStepsFromE4(n.letter, n.octave);
      const si = noteToSystem[i];
      const s = systems[si];
      return { ...n, si, x: s.notesStartX + (i - s.start) * layout.step, y: s.bottomLineY - stepsFromE4 * halfStep, stepsFromE4 };
    });
    viewW = Math.max(120, ...systems.map((s) => s.lineRight));
    if (notes.length) {
      const ys = notes.map((n) => n.y);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      shift = minY < 8 ? 8 - minY : 0; // keep ledger lines from clipping off the top
      viewH = Math.max(160, maxY + shift + 34);
    }
  }

  const sigLetters = new Set(keySig.map((s) => s.letter));
  const inSignature = (n) => sigLetters.has(n.letter) && (n.diff || 0) !== 0;

  return (
    <div ref={wrapRef} style={{ background: "#100e0b", border: "1px solid #2a2f3a", borderRadius: 10, padding: "16px 6px" }}>
      {layout ? (
        <div style={{ overflowX: "auto" }}>
          <svg viewBox={`0 0 ${viewW} ${viewH}`} style={{ display: "block", width: viewW, height: "auto" }}>
            <g transform={`translate(0 ${shift})`}>
              {systems.map((s, li) => (
                <g key={li}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <line key={i} x1={20} x2={s.lineRight} y1={s.bottomLineY - i * lineSpacing} y2={s.bottomLineY - i * lineSpacing} stroke="#5a6270" strokeWidth={1.2} />
                  ))}
                  <text x={22} y={s.bottomLineY - lineSpacing * 1.2} fontSize={40} fill="#7a8290">
                    𝄞
                  </text>
                  {li === 0 &&
                    keySig.map((k, i) => {
                      const y = s.bottomLineY - sigLetterToSteps(k.letter) * halfStep;
                      return (
                        <text key={i} x={sigStartX + i * sigGap} y={y + 5} fontSize={15} fill="#9aa2ac" textAnchor="middle">
                          {k.glyph}
                        </text>
                      );
                    })}
                </g>
              ))}
              {notes.map((n, i) => {
                const color = (highlightPcs && highlightPcs.get(CHROMATIC[n.pc])) || "#f3ead9";
                const isActive = activeIndex != null && activeIndex === i;
                const isHeard = heardMidi != null && n.midi === heardMidi;
                const noteColor = isActive ? "#fff3d6" : isHeard ? "#7cb37a" : color;
                const ledgerYs = ledgerYsFor(n.stepsFromE4, systems[n.si].bottomLineY, halfStep);
                return (
                  <g key={i}>
                    {ledgerYs.map((y, li) => (
                      <line key={li} x1={n.x - 11} x2={n.x + 11} y1={y} y2={y} stroke="#7a8290" strokeWidth={1.2} />
                    ))}
                    {n.diff > 0 && !inSignature(n) && (
                      <text x={n.x - 20} y={n.y + 5} fontSize={14} fill={noteColor}>
                        {"♯".repeat(Math.min(2, n.diff))}
                      </text>
                    )}
                    {n.diff < 0 && !inSignature(n) && (
                      <text x={n.x - 20} y={n.y + 5} fontSize={14} fill={noteColor}>
                        {"♭".repeat(Math.min(2, -n.diff))}
                      </text>
                    )}
                    <ellipse cx={n.x} cy={n.y} rx={7} ry={5.5} fill={noteColor} transform={`rotate(-18 ${n.x} ${n.y})`} />
                    {isActive && <circle cx={n.x} cy={n.y} r={10.5} fill="none" stroke="#fff3d6" strokeWidth={1.6} />}
                    {isHeard && !isActive && <circle cx={n.x} cy={n.y} r={10.5} fill="none" stroke="#7cb37a" strokeWidth={1.6} />}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      ) : (
        <div style={{ minHeight: 160 }} />
      )}
    </div>
  );
}
