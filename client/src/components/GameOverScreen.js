import React, { useEffect, useState } from "react";

export default function GameOverScreen({ leaderboard, onPlayAgain }) {
  const [show, setShow] = useState(false);
  useEffect(() => { setTimeout(() => setShow(true), 100); }, []);

  const medals = ["🥇","🥈","🥉","4️⃣","5️⃣"];
  const bgColors = [
    "linear-gradient(135deg, #ffd700, #ff8c00)",
    "linear-gradient(135deg, #c0c0c0, #808080)",
    "linear-gradient(135deg, #cd7f32, #8b4513)",
    "rgba(255,255,255,0.07)",
    "rgba(255,255,255,0.05)",
  ];

  return (
    <div style={s.root}>
      <div style={{ ...s.panel, opacity: show ? 1 : 0, transform: show ? "translateY(0)" : "translateY(40px)" }}>
        <div style={s.title}>🎉 จบเกม!</div>
        <div style={s.subtitle}>ผลการแข่งขัน Band Rush</div>

        <div style={s.list}>
          {(leaderboard || []).map((team, idx) => (
            <div key={team.teamId} style={{ ...s.row, background: bgColors[idx] || bgColors[3] }}>
              <span style={s.medal}>{medals[idx] || `${idx+1}`}</span>
              <div style={s.teamInfo}>
                <div style={s.teamName}>{team.teamName || team.teamId}</div>
                <div style={s.teamSub}>🪙 {team.coins} เหรียญ</div>
              </div>
              <div style={s.score}>{team.score} <span style={s.pt}>pt</span></div>
            </div>
          ))}
          {(!leaderboard || leaderboard.length === 0) && (
            <div style={{ textAlign: "center", color: "#718096", padding: 32 }}>ไม่มีข้อมูล</div>
          )}
        </div>

        <button style={s.btn} onClick={onPlayAgain}>🔄 เล่นอีกครั้ง</button>
      </div>
    </div>
  );
}

const s = {
  root: { width: "100vw", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)" },
  panel: { background: "rgba(255,255,255,0.05)", borderRadius: 24, padding: 32, width: "90%", maxWidth: 440,
    backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)",
    transition: "all 0.5s ease", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" },
  title: { fontSize: 40, fontWeight: 900, textAlign: "center",
    background: "linear-gradient(90deg,#ffd700,#ff6b6b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  subtitle: { fontSize: 14, color: "#a0aec0", textAlign: "center", marginTop: 4, marginBottom: 24 },
  list: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 },
  row: { display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderRadius: 14 },
  medal: { fontSize: 28, minWidth: 36 },
  teamInfo: { flex: 1 },
  teamName: { fontSize: 18, fontWeight: 800, color: "white" },
  teamSub: { fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2 },
  score: { fontSize: 28, fontWeight: 900, color: "white" },
  pt: { fontSize: 13, fontWeight: 400, opacity: 0.7 },
  btn: { width: "100%", padding: 16, background: "linear-gradient(135deg,#667eea,#764ba2)",
    border: "none", borderRadius: 14, color: "white", fontWeight: 900, fontSize: 18, cursor: "pointer",
    boxShadow: "0 6px 20px rgba(102,126,234,0.4)" },
};
