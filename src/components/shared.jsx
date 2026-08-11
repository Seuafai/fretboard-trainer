export function StatCard({ label, value }) {
  return (
    <div style={{ background: "#1b1f27", border: "1px solid #2a2f3a", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, color: "#7a8290", marginBottom: 4, letterSpacing: 0.5 }}>{label}</div>
      <div className="ft-title" style={{ fontSize: 20, color: "#f3ead9" }}>
        {value}
      </div>
    </div>
  );
}

export function Segmented({ options, value, onChange }) {
  return (
    <div style={{ display: "inline-flex", background: "#161a21", border: "1px solid #2a2f3a", borderRadius: 9, padding: 3, gap: 2 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            className="ft-chip"
            onClick={() => onChange(o.value)}
            style={{
              padding: "6px 14px",
              borderRadius: 7,
              border: "none",
              background: active ? "#e0a95f" : "transparent",
              color: active ? "#14171c" : "#9aa2ac",
              fontSize: 13,
              fontWeight: active ? 600 : 500,
              cursor: "pointer",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Chip({ active, onClick, children }) {
  return (
    <button
      className="ft-chip"
      onClick={onClick}
      style={{
        padding: "6px 14px",
        borderRadius: 999,
        border: `1px solid ${active ? "#e0a95f" : "#2a2f3a"}`,
        background: active ? "#e0a95f" : "transparent",
        color: active ? "#14171c" : "#9aa2ac",
        fontSize: 13,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

export function TuneBanner({ tuning, onGoTune, guitarStrings }) {
  const timestamps = guitarStrings.map((s) => tuning && tuning[s.id] && tuning[s.id].tunedAt).filter(Boolean);
  const newest = timestamps.length ? Math.max(...timestamps) : null;
  const staleMs = 24 * 60 * 60 * 1000;
  if (newest && Date.now() - newest < staleMs) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        background: "#232833",
        border: "1px solid #e0a95f55",
        borderRadius: 10,
        padding: "10px 14px",
        marginBottom: 18,
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontSize: 13, color: "#e8d6b8" }}>
        {newest ? "It's been a while since you tuned — a quick check-in improves note detection." : "Tuning first gives more accurate note detection. Not required, just recommended."}
      </span>
      <button onClick={onGoTune} style={{ background: "transparent", border: "1px solid #e0a95f", color: "#e0a95f", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
        Tune now
      </button>
    </div>
  );
}
