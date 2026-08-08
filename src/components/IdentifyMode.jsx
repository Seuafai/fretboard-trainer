import { useState, useCallback, useEffect, useRef } from "react";
import { StatCard } from "./shared.jsx";
import FretboardSVG from "./FretboardSVG.jsx";
import { storage, STATS_KEY } from "../storage.js";
import { CHROMATIC, displayName, noteAt } from "../theory.js";

export default function IdentifyMode({ maxFret, activeStrings, guitarStrings }) {
  const [prompt, setPrompt] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [storageReady, setStorageReady] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await storage.get(STATS_KEY);
        if (!cancelled && res && res.value) setBest(JSON.parse(res.value).best || 0);
      } catch (e) {}
      if (!cancelled) setStorageReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistBest = useCallback((value) => {
    storage.set(STATS_KEY, JSON.stringify({ best: value })).catch(() => {});
  }, []);

  const nextPrompt = useCallback(() => {
    const pool = activeStrings.length ? activeStrings : guitarStrings.map((s) => s.id);
    const stringId = pool[Math.floor(Math.random() * pool.length)];
    const stringDef = guitarStrings.find((s) => s.id === stringId);
    const fret = Math.floor(Math.random() * (maxFret + 1));
    const note = noteAt(stringDef.open, fret);
    setPrompt({ stringId, fret, note });
    setFeedback(null);
  }, [activeStrings, maxFret, guitarStrings]);

  useEffect(() => {
    nextPrompt();
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (prompt && (!activeStrings.includes(prompt.stringId) || prompt.fret > maxFret)) nextPrompt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStrings, maxFret, guitarStrings]);

  function handleAnswer(note) {
    if (feedback || !prompt) return;
    const isCorrect = note === prompt.note;
    setFeedback({ picked: note, correct: isCorrect });
    setTotalCount((t) => t + 1);
    if (isCorrect) {
      setCorrectCount((c) => c + 1);
      setStreak((s) => {
        const next = s + 1;
        if (next > best) {
          setBest(next);
          persistBest(next);
        }
        return next;
      });
    } else {
      setStreak(0);
    }
    timer.current = setTimeout(() => nextPrompt(), isCorrect ? 550 : 1100);
  }

  const accuracy = totalCount ? Math.round((correctCount / totalCount) * 100) : null;
  const markers = prompt
    ? [{ stringId: prompt.stringId, fret: prompt.fret, filled: true, color: feedback ? (feedback.correct ? "#7cb37a" : "#d9694e") : "#e0a95f" }]
    : [];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        <StatCard label="Streak" value={streak} />
        <StatCard label="Best streak" value={storageReady ? best : "–"} />
        <StatCard label="Accuracy" value={accuracy === null ? "–" : `${accuracy}%`} />
        <StatCard label="Answered" value={totalCount} />
      </div>
      <div style={{ marginBottom: 22 }}>
        <FretboardSVG maxFret={maxFret} activeStrings={activeStrings} markers={markers} pulse={null} guitarStrings={guitarStrings} />
      </div>
      <div style={{ textAlign: "center", marginBottom: 16, minHeight: 26 }}>
        {feedback ? (
          <span className="ft-title" style={{ fontSize: 18, color: feedback.correct ? "#8fbb7f" : "#e08a71" }}>
            {feedback.correct ? "Correct — that's " + displayName(prompt.note) : `Not quite — that's ${displayName(prompt.note)}`}
          </span>
        ) : (
          <span style={{ fontSize: 14, color: "#9aa2ac" }}>What note is lit up?</span>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
        {CHROMATIC.map((note) => {
          const isPicked = feedback && feedback.picked === note;
          const isCorrectNote = feedback && note === prompt.note;
          let bg = "#232833",
            border = "#2a2f3a",
            color = "#f3ead9";
          if (feedback && isCorrectNote) {
            bg = "#7cb37a";
            border = "#7cb37a";
            color = "#14171c";
          } else if (isPicked && !feedback.correct) {
            bg = "#d9694e";
            border = "#d9694e";
          }
          return (
            <button
              key={note}
              className="ft-note-btn"
              disabled={!!feedback}
              onClick={() => handleAnswer(note)}
              style={{ padding: "14px 0", borderRadius: 8, border: `1px solid ${border}`, background: bg, color, fontSize: 16, fontWeight: 600, cursor: feedback ? "default" : "pointer" }}
            >
              {displayName(note)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
