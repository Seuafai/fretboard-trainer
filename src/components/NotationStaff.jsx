import { CHROMATIC, ledgerYsFor, noteNameToStepsFromE4 } from "../theory.js";

// shows a whole scale laid out on the staff at once; notes already played this lap turn green,
// the rest stay neutral. `sequence` comes from spelledScaleSequence() so each note carries its
// key-correct spelling (Bb vs A#, etc.). `foundPcs` holds the sharp-name pitch classes played.
export default function NotationStaff({ sequence, foundPcs }) {
  const lineSpacing = 12;
  const halfStep = lineSpacing / 2;
  const bottomLineY = 96; // E4, the bottom staff line
  const startX = 46;
  const stepX = 28;

  const notes = sequence.map((n, i) => {
    const stepsFromE4 = noteNameToStepsFromE4(n.letter, n.octave);
    return { ...n, x: startX + i * stepX, y: bottomLineY - stepsFromE4 * halfStep, stepsFromE4 };
  });

  const allY = notes.map((n) => n.y);
  const viewW = startX + sequence.length * stepX + 20;
  const viewH = Math.max(160, bottomLineY - Math.min(...allY) + 40, Math.max(...allY) - (bottomLineY - 4 * lineSpacing) + 40);
  const lineRight = startX + (sequence.length - 1) * stepX + 20;

  return (
    <div style={{ overflowX: "auto", background: "#100e0b", border: "1px solid #2a2f3a", borderRadius: 10, padding: "16px 6px", display: "flex", justifyContent: "center" }}>
      <svg width={viewW} height={viewH} viewBox={`0 0 ${viewW} ${viewH}`} style={{ maxWidth: "100%", height: "auto" }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={i} x1={20} x2={lineRight} y1={bottomLineY - i * lineSpacing} y2={bottomLineY - i * lineSpacing} stroke="#5a6270" strokeWidth={1.2} />
        ))}
        <text x={22} y={bottomLineY - lineSpacing * 1.2} fontSize={40} fill="#7a8290">
          𝄞
        </text>
        {notes.map((n, i) => {
          const found = foundPcs.includes(CHROMATIC[n.pc]);
          const color = found ? "#7cb37a" : "#f3ead9";
          const ledgerYs = ledgerYsFor(n.stepsFromE4, bottomLineY, halfStep);
          return (
            <g key={i}>
              {ledgerYs.map((y, li) => (
                <line key={li} x1={n.x - 11} x2={n.x + 11} y1={y} y2={y} stroke="#7a8290" strokeWidth={1.2} />
              ))}
              {n.diff > 0 && (
                <text x={n.x - 20} y={n.y + 5} fontSize={14} fill={color}>
                  {"♯".repeat(Math.min(2, n.diff))}
                </text>
              )}
              {n.diff < 0 && (
                <text x={n.x - 20} y={n.y + 5} fontSize={14} fill={color}>
                  {"♭".repeat(Math.min(2, -n.diff))}
                </text>
              )}
              <ellipse cx={n.x} cy={n.y} rx={7} ry={5.5} fill={color} transform={`rotate(-18 ${n.x} ${n.y})`} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
