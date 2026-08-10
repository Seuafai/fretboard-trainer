import { fretFraction, STRINGS } from "../theory.js";

// a full-neck SVG fretboard with wood grain, pearl inlays and fret markers.
export default function FretboardSVG({ maxFret, activeStrings, markers, pulse, guitarStrings = STRINGS, highlightString, highlightColor = "#e0a95f", highlightKey, onCellClick, clickableAll }) {
  const boardLeft = 46;
  const totalWidth = 54 * maxFret;
  const boardWidth = boardLeft + totalWidth + 26;
  const rowHeight = 34;
  const boardTop = 18;
  const boardHeight = rowHeight * (guitarStrings.length - 1) + 28;
  const inlayFrets = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];
  const scale = fretFraction(maxFret) || 1;

  const fretX = (n) => boardLeft + (fretFraction(n) / scale) * totalWidth;
  const cellMidX = (n) => (n === 0 ? boardLeft - 17 : (fretX(n - 1) + fretX(n)) / 2);

  return (
    <div style={{ overflowX: "auto", background: "#100e0b", border: "1px solid #5c4530", borderRadius: 10, padding: "12px 6px", boxShadow: "0 6px 18px #00000055 inset" }}>
      <style>{`
        @keyframes ftStringPulse { 0%,100% { opacity: 0.45; } 50% { opacity: 1; } }
        .ft-string-hl { animation: ftStringPulse 1.15s ease-in-out infinite; }
      `}</style>
      <svg width={boardWidth} height={boardHeight + boardTop + 6} viewBox={`0 0 ${boardWidth} ${boardHeight + boardTop + 6}`}>
        <defs>
          <linearGradient id="woodgrain2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6b4a30" />
            <stop offset="12%" stopColor="#5c3f28" />
            <stop offset="50%" stopColor="#6b4a30" />
            <stop offset="88%" stopColor="#5c3f28" />
            <stop offset="100%" stopColor="#4a331f" />
          </linearGradient>
          <filter id="grainFilter" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.09" numOctaves="2" seed="7" result="noise" />
            <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.15,  0 0 0 0 0.09,  0 0 0 0 0.04,  0 0 0 0.5 0" />
          </filter>
          <linearGradient id="fretBevel" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fff3d6" />
            <stop offset="45%" stopColor="#e0a95f" />
            <stop offset="100%" stopColor="#8a6530" />
          </linearGradient>
          <linearGradient id="nutGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fffaf0" />
            <stop offset="100%" stopColor="#dcd2bd" />
          </linearGradient>
          <radialGradient id="pearlShine" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="45%" stopColor="#f3ead9" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#f3ead9" stopOpacity="0.18" />
          </radialGradient>
          <radialGradient id="markerglow2" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f3ead9" />
            <stop offset="55%" stopColor="#e0a95f" />
            <stop offset="100%" stopColor="#e0a95f00" />
          </radialGradient>
        </defs>

        <rect x={0} y={boardTop} width={boardWidth} height={boardHeight} fill="url(#woodgrain2)" rx={7} />
        <rect x={0} y={boardTop} width={boardWidth} height={boardHeight} fill="#000000" opacity={0.22} filter="url(#grainFilter)" rx={7} />
        <rect x={0} y={boardTop} width={boardWidth} height={6} fill="#ffffff" opacity={0.06} rx={3} />
        <rect x={0} y={boardTop + boardHeight - 5} width={boardWidth} height={5} fill="#000000" opacity={0.25} />

        {inlayFrets
          .filter((f) => f <= maxFret)
          .map((f) => {
            const cx = cellMidX(f);
            const cy = boardTop + boardHeight / 2;
            const dots = f === 12 || f === 24 ? [cy - 28, cy + 28] : [cy];
            return (
              <g key={f}>
                {dots.map((dy, i) => (
                  <g key={i}>
                    <circle cx={cx} cy={dy} r={6} fill="#00000033" />
                    <circle cx={cx} cy={dy} r={5.5} fill="url(#pearlShine)" />
                  </g>
                ))}
              </g>
            );
          })}

        <rect x={boardLeft - 6} y={boardTop - 2} width={6} height={boardHeight + 4} fill="url(#nutGrad)" rx={1.5} />
        <rect x={boardLeft} y={boardTop - 2} width={2} height={boardHeight + 4} fill="#00000030" />

        {Array.from({ length: maxFret }, (_, i) => i + 1).map((f) => (
          <rect key={f} x={fretX(f) - 1.1} y={boardTop} width={2.2} height={boardHeight} fill="url(#fretBevel)" />
        ))}

        {Array.from({ length: maxFret + 1 }, (_, i) => i).map((f) => (
          <text key={f} x={cellMidX(f)} y={boardTop + boardHeight + 17} fontSize={11} fill="#c9a878" textAnchor="middle" className="ft-mono">
            {f}
          </text>
        ))}

        {guitarStrings.map((s, idx) => {
          const y = boardTop + 14 + idx * rowHeight;
          const dimmed = !activeStrings.includes(s.id);
          return (
            <g key={s.id} opacity={dimmed ? 0.28 : 1}>
              <text x={16} y={y + 4} fontSize={13} fill="#f3ead9" className="ft-mono" textAnchor="middle">
                {s.open}
              </text>
              <line x1={boardLeft - 6} x2={fretX(maxFret)} y1={y} y2={y} stroke="#8b8f96" strokeWidth={s.thickness} strokeLinecap="round" />
              <line
                x1={boardLeft - 6}
                x2={fretX(maxFret)}
                y1={y - Math.max(0.6, s.thickness / 5)}
                y2={y - Math.max(0.6, s.thickness / 5)}
                stroke="#e8eaee"
                strokeWidth={Math.max(0.5, s.thickness / 4)}
                strokeLinecap="round"
                opacity={0.7}
              />
            </g>
          );
        })}

        {highlightString &&
          guitarStrings.map((s, idx) => {
            if (s.id !== highlightString) return null;
            const y = boardTop + 14 + idx * rowHeight;
            return (
              <g key={highlightKey || s.id} className="ft-string-hl">
                <rect x={boardLeft - 8} y={y - rowHeight / 2 + 5} width={fretX(maxFret) - boardLeft + 8} height={rowHeight - 10} rx={5} fill={highlightColor} opacity={0.22} />
                <line x1={boardLeft - 8} x2={fretX(maxFret)} y1={y} y2={y} stroke={highlightColor} strokeWidth={Math.max(2, s.thickness + 1)} strokeLinecap="round" opacity={0.9} />
              </g>
            );
          })}

        {onCellClick &&
          (highlightString || clickableAll) &&
          guitarStrings.map((s) => {
            if (highlightString && s.id !== highlightString) return null;
            const idx = guitarStrings.indexOf(s);
            const y = boardTop + 14 + idx * rowHeight;
            const cells = [];
            for (let f = 0; f <= maxFret; f++) {
              const x0 = f === 0 ? boardLeft - 34 : fretX(f - 1);
              const x1 = f === 0 ? boardLeft : fretX(f);
              cells.push(
                <rect key={f} x={x0} y={y - rowHeight / 2} width={x1 - x0} height={rowHeight} fill="transparent" style={{ cursor: "pointer" }} onClick={() => onCellClick(s.id, f)} />
              );
            }
            return <g key={s.id}>{cells}</g>;
          })}

        {markers.map((m, i) => {
          const idx = guitarStrings.findIndex((s) => s.id === m.stringId);
          const y = boardTop + 14 + idx * rowHeight;
          const x = cellMidX(m.fret);
          const isPulse = pulse && pulse.stringId === m.stringId && pulse.fret === m.fret;
          return (
            <g key={i} onClick={m.onClick} style={{ cursor: m.onClick ? "pointer" : "default" }}>
              {isPulse && <circle cx={x} cy={y} r={18} fill="url(#markerglow2)" opacity={0.7} />}
              <circle cx={x} cy={y} r={m.r ?? (m.big ? 12 : m.filled ? 10 : 9)} fill={m.filled ? m.color : "transparent"} stroke={m.color} strokeWidth={m.filled ? 1.5 : 2} />
              {(m.finger != null || m.label != null) && (
                <text x={x} y={y + 3.5} fontSize={m.fs ?? (m.big ? 9 : 8)} fontWeight={700} textAnchor="middle" className="ft-mono" fill={m.filled ? "#14171c" : "#e0a95f"}>
                  {m.finger != null ? m.finger : m.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
