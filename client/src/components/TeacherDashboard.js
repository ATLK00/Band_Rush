import React, { useState, useEffect } from "react";

const FAMILY_COLORS = {
  Strings: "#e53e3e", Brass: "#d69e2e", Woodwind: "#38a169",
  Percussion: "#805ad5", Keyboard: "#3182ce",
};

export default function TeacherDashboard({ gameState, myInfo, emit, on, off, onStartGame }) {
  const [timer, setTimer] = useState(120);
  const [dashTeams, setDashTeams] = useState([]);
  const [latestEvent, setLatestEvent] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);

  useEffect(() => {
    if (!gameState) return;
    setGameStarted(gameState.status === "PLAYING");
    setTimer(gameState.timer_seconds || 120);
    const teams = Object.entries(gameState.teams || {})
      .filter(([tid]) => tid !== "teacher")
      .map(([tid, team]) => ({
        id: tid,
        name: team.name || tid,
        score: team.score || 0,
        coins: team.coins || 0,
        players: Object.values(team.players || {}).map(p => p.name),
        debuffs: team.active_debuffs || [],
        cards: team.cards_on_desk?.length || 0,
      }));
    setDashTeams(teams);
  }, [gameState]);

  useEffect(() => {
    const r1 = on("timer_tick", ({ seconds }) => setTimer(seconds));
    const r2 = on("dashboard_update", ({ teams }) => {
      setDashTeams(prev => prev.map(pt => {
        const updated = teams.find(t => t.teamId === pt.id);
        return updated ? { ...pt, score: updated.score, coins: updated.coins } : pt;
      }));
    });
    const r3 = on("match_result", () => {});
    const r4 = on("sabotage_hit", ({ targetTeamId, itemType, attackerTeamId }) => {
      setLatestEvent({ msg: `💀 ทีมโจมตีด้วย ${itemType} → ${targetTeamId}`, time: Date.now() });
      setTimeout(() => setLatestEvent(null), 4000);
    });
    const r5 = on("coin_updated", ({ teamId, newBalance, score }) => {
      setDashTeams(prev => prev.map(t => t.id === teamId ? { ...t, score: score ?? t.score, coins: newBalance } : t));
    });
    return () => { r1(); r2(); r3(); r4(); r5(); };
  }, [on]);

  const maxScore = Math.max(...dashTeams.map(t => t.score), 1);
  const timerColor = timer > 30 ? "#68d391" : timer > 10 ? "#f6ad55" : "#fc8181";

  return (
    <div style={s.root}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.titleRow}>
          <span style={s.title}>🎵 Band Rush! — Teacher Dashboard</span>
          <span style={{ ...s.timer, color: timerColor }}>⏱ {timer}s</span>
        </div>
        {latestEvent && <div style={s.eventBanner}>{latestEvent.msg}</div>}
      </div>

      {/* Team scoreboard */}
      <div style={s.teamsGrid}>
        {dashTeams.map((team, idx) => (
          <div key={team.id} style={{ ...s.teamCard, border: `2px solid ${TEAM_COLORS[idx % TEAM_COLORS.length]}` }}>
            {/* Rank medal */}
            <div style={s.rankBadge}>{["🥇","🥈","🥉","4️⃣","5️⃣"][idx] || `${idx+1}`}</div>
            {/* Debuff icon */}
            {team.debuffs.includes("frozen") && <div style={s.debuffIcon}>❄️</div>}

            <div style={{ ...s.teamName, color: TEAM_COLORS[idx % TEAM_COLORS.length] }}>{team.name}</div>
            <div style={s.playerNames}>{team.players.join(", ") || "ไม่มีผู้เล่น"}</div>

            {/* Score bar */}
            <div style={s.scoreBarBg}>
              <div style={{
                ...s.scoreBarFill,
                width: `${Math.min(100, (team.score / maxScore) * 100)}%`,
                background: TEAM_COLORS[idx % TEAM_COLORS.length],
              }} />
            </div>

            <div style={s.statRow}>
              <div style={s.statItem}><span style={s.statLabel}>⭐ คะแนน</span><span style={s.statVal}>{team.score}</span></div>
              <div style={s.statItem}><span style={s.statLabel}>🪙 เหรียญ</span><span style={s.statVal}>{team.coins}</span></div>
              <div style={s.statItem}><span style={s.statLabel}>🃏 การ์ด</span><span style={s.statVal}>{team.cards}</span></div>
            </div>
          </div>
        ))}

        {dashTeams.length === 0 && (
          <div style={s.waitMsg}>
            <div style={{ fontSize: 60 }}>🎵</div>
            <div style={{ fontSize: 24, marginTop: 16 }}>รอทีมเข้าร่วม...</div>
            <div style={{ fontSize: 14, color: "#718096", marginTop: 8 }}>แชร์ PIN ให้นักเรียนสแกน</div>
          </div>
        )}
      </div>

      {/* PIN & Controls */}
      <div style={s.footer}>
        <div style={s.pinArea}>
          <span style={s.pinLabel}>PIN ห้อง</span>
          <span style={s.pin}>{myInfo?.pin || "----"}</span>
        </div>
        {!gameStarted && dashTeams.length > 0 && (
          <button style={s.startBtn} onClick={onStartGame}>🎵 เริ่มเกม!</button>
        )}
        {gameStarted && <div style={s.playingBadge}>🔴 กำลังเล่น</div>}
        <div style={s.teamCount}>{dashTeams.length} ทีม • {dashTeams.reduce((s,t) => s + t.players.length, 0)} ผู้เล่น</div>
      </div>
    </div>
  );
}

const TEAM_COLORS = ["#ffd700", "#f093fb", "#4ecdc4", "#f6ad55", "#68d391", "#90cdf4"];

const s = {
  root: { width: "100vw", height: "100vh", display: "flex", flexDirection: "column",
    background: "linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 100%)", color: "white", overflow: "hidden" },
  header: { padding: "16px 24px", background: "rgba(0,0,0,0.5)", borderBottom: "1px solid rgba(255,255,255,0.1)" },
  titleRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 22, fontWeight: 900, letterSpacing: 1 },
  timer: { fontSize: 36, fontWeight: 900, fontFamily: "monospace" },
  eventBanner: { marginTop: 8, padding: "8px 16px", background: "rgba(245,101,101,0.2)",
    borderRadius: 8, fontSize: 16, fontWeight: 700, color: "#fc8181",
    border: "1px solid rgba(245,101,101,0.4)" },
  teamsGrid: { flex: 1, display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 16, padding: 20, overflowY: "auto" },
  teamCard: { background: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 20,
    position: "relative", backdropFilter: "blur(10px)" },
  rankBadge: { position: "absolute", top: 12, right: 12, fontSize: 22 },
  debuffIcon: { position: "absolute", top: 12, left: 12, fontSize: 22, animation: "pulse 0.5s infinite" },
  teamName: { fontSize: 22, fontWeight: 900, marginBottom: 4 },
  playerNames: { fontSize: 12, color: "#a0aec0", marginBottom: 16 },
  scoreBarBg: { height: 12, background: "rgba(255,255,255,0.1)", borderRadius: 6, overflow: "hidden", marginBottom: 16 },
  scoreBarFill: { height: "100%", borderRadius: 6, transition: "width 0.5s ease", minWidth: 4 },
  statRow: { display: "flex", gap: 12 },
  statItem: { flex: 1, display: "flex", flexDirection: "column", gap: 2,
    background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: "8px 10px" },
  statLabel: { fontSize: 10, color: "#718096" },
  statVal: { fontSize: 20, fontWeight: 900 },
  waitMsg: { gridColumn: "1/-1", display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", padding: 60, color: "#a0aec0" },
  footer: { padding: "12px 24px", background: "rgba(0,0,0,0.5)", borderTop: "1px solid rgba(255,255,255,0.1)",
    display: "flex", alignItems: "center", gap: 20 },
  pinArea: { display: "flex", flexDirection: "column", gap: 2 },
  pinLabel: { fontSize: 10, color: "#718096", textTransform: "uppercase", letterSpacing: 2 },
  pin: { fontSize: 32, fontWeight: 900, color: "#ffd700", letterSpacing: 8, fontFamily: "monospace" },
  startBtn: { padding: "12px 28px", background: "linear-gradient(135deg, #667eea, #764ba2)",
    border: "none", borderRadius: 12, color: "white", fontWeight: 900, fontSize: 18, cursor: "pointer",
    boxShadow: "0 6px 20px rgba(102,126,234,0.4)" },
  playingBadge: { padding: "10px 20px", background: "rgba(245,101,101,0.2)",
    border: "1px solid #fc8181", borderRadius: 10, color: "#fc8181", fontWeight: 700, fontSize: 16 },
  teamCount: { marginLeft: "auto", color: "#718096", fontSize: 13 },
};
