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
export default function NotationStaff({ sequence, keySignature, highlightPcs, activeIndex, heardMidi }) {
  const lineSpacing = 12;
  const halfStep = lineSpacing / 2;
  const bottomLineY = 96; // E4, the bottom staff line
  const startX = 46;
  const stepX = 28;

  const keySig = keySignature || [];
  const sigStartX = 58;
  const sigGap = 13;
  const notesStartX = startX + (keySig.length ? sigStartX - startX + keySig.length * sigGap + 8 : 0);
  const sigLetterToSteps = (letter) => NATURAL_LETTERS.indexOf(letter) - 2; // steps above E4

  const notes = sequence.map((n, i) => {
    const stepsFromE4 = noteNameToStepsFromE4(n.letter, n.octave);
    return { ...n, x: notesStartX + i * stepX, y: bottomLineY - stepsFromE4 * halfStep, stepsFromE4 };
  });

  const sigLetters = new Set(keySig.map((s) => s.letter));
  const inSignature = (n) => sigLetters.has(n.letter) && (n.diff || 0) !== 0;

  const allY = notes.map((n) => n.y);
  const viewW = Math.max(120, notesStartX + sequence.length * stepX + 20);
  const viewH = Math.max(160, allY.length ? bottomLineY - Math.min(...allY) + 40 : 160, allY.length ? Math.max(...allY) - (bottomLineY - 4 * lineSpacing) + 40 : 160);
  const lineRight = Math.max(120, notesStartX + (sequence.length - 1) * stepX + 20);

  return (
    <div style={{ background: "#100e0b", border: "1px solid #2a2f3a", borderRadius: 10, padding: "16px 6px" }}>
      <div style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${viewW} ${viewH}`} style={{ display: "block", width: viewW, height: "auto" }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={i} x1={20} x2={lineRight} y1={bottomLineY - i * lineSpacing} y2={bottomLineY - i * lineSpacing} stroke="#5a6270" strokeWidth={1.2} />
          ))}
          <text x={22} y={bottomLineY - lineSpacing * 1.2} fontSize={40} fill="#7a8290">
            𝄞
          </text>
          {keySig.map((s, i) => {
            const y = bottomLineY - sigLetterToSteps(s.letter) * halfStep;
            return (
              <text key={i} x={sigStartX + i * sigGap} y={y + 5} fontSize={15} fill="#9aa2ac" textAnchor="middle">
                {s.glyph}
              </text>
            );
          })}
          {notes.map((n, i) => {
            const color = (highlightPcs && highlightPcs.get(CHROMATIC[n.pc])) || "#f3ead9";
            const isActive = activeIndex != null && activeIndex === i;
            const isHeard = heardMidi != null && n.midi === heardMidi;
            const noteColor = isActive ? "#fff3d6" : isHeard ? "#7cb37a" : color;
            const ledgerYs = ledgerYsFor(n.stepsFromE4, bottomLineY, halfStep);
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
        </svg>
      </div>
    </div>
  );
}
