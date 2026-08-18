import React, { useState, useEffect } from "react";

export default function LobbyScreen({ emit, on, off, onJoined, connected }) {
  const [mode, setMode] = useState(null); // null | create | join | teacher
  const [playerName, setPlayerName] = useState("");
  const [teamName, setTeamName] = useState("Team 1");
  const [pin, setPin] = useState("");
  const [teamId, setTeamId] = useState("team_1");
  const [gameType, setGameType] = useState("COMPETITIVE");
  const [roomInfo, setRoomInfo] = useState(null); // after create: show pin
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lobbyPlayers, setLobbyPlayers] = useState([]);

  useEffect(() => {
    const rem1 = on("sync_state", (state) => {
      if (state && roomInfo) {
        const players = [];
        Object.entries(state.teams || {}).forEach(([tid, team]) => {
          Object.entries(team.players || {}).forEach(([sid, p]) => {
            players.push({ name: p.name, teamId: tid, teamName: team.name });
          });
        });
        setLobbyPlayers(players);
      }
    });
    return () => rem1();
  }, [on, roomInfo]);

  const handleCreate = () => {
    if (!playerName.trim()) { setError("กรุณาใส่ชื่อ"); return; }
    setLoading(true);
    setError("");
    emit("create_room", { type: gameType, playerName, teamName }, (res) => {
      setLoading(false);
      if (res.success) {
        setRoomInfo(res);
        onJoined({ roomId: res.roomId, teamId: res.teamId, pin: res.pin, isHost: true });
      } else {
        setError("สร้างห้องไม่ได้");
      }
    });
  };

  const handleJoin = () => {
    if (!playerName.trim()) { setError("กรุณาใส่ชื่อ"); return; }
    if (!pin.trim()) { setError("กรุณาใส่ PIN"); return; }
    setLoading(true);
    setError("");
    emit("join_room", { pin, playerName, teamId }, (res) => {
      setLoading(false);
      if (res.success) {
        onJoined({ roomId: res.roomId, teamId: res.teamId, pin, isHost: false });
      } else {
        setError(res.error || "เข้าห้องไม่ได้");
      }
    });
  };

  const handleTeacherJoin = () => {
    if (!pin.trim()) { setError("กรุณาใส่ PIN"); return; }
    setLoading(true);
    emit("join_room", { pin, playerName: "Teacher 👩‍🏫", teamId: "teacher" }, (res) => {
      setLoading(false);
      if (res.success) {
        onJoined({ roomId: res.roomId, teamId: "teacher", pin, isHost: false, isTeacher: true });
      } else {
        setError(res.error || "เข้าห้องไม่ได้");
      }
    });
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.title}>🎵 Band Rush!</div>
        <div style={styles.subtitle}>ตั้งวงด่วน! เกมเครื่องดนตรีแบบ Real-time</div>
      </div>

      {/* Main card */}
      <div style={styles.card}>
        {!mode && !roomInfo && (
          <div style={styles.menuGrid}>
            <button style={{...styles.btn, ...styles.btnCreate}} onClick={() => setMode("create")}>
              🏠 สร้างห้องใหม่
            </button>
            <button style={{...styles.btn, ...styles.btnJoin}} onClick={() => setMode("join")}>
              🚪 เข้าร่วมห้อง
            </button>
            <button style={{...styles.btn, ...styles.btnTeacher}} onClick={() => setMode("teacher")}>
              👩‍🏫 หน้าจอครู
            </button>
          </div>
        )}

        {mode === "create" && !roomInfo && (
          <div style={styles.form}>
            <div style={styles.formTitle}>🏠 สร้างห้องใหม่</div>
            <input style={styles.input} placeholder="ชื่อของคุณ" value={playerName}
              onChange={e => setPlayerName(e.target.value)} maxLength={20} />
            <input style={styles.input} placeholder="ชื่อทีม" value={teamName}
              onChange={e => setTeamName(e.target.value)} maxLength={20} />
            <div style={styles.radioGroup}>
              {["COMPETITIVE", "COOP"].map(t => (
                <label key={t} style={styles.radioLabel}>
                  <input type="radio" value={t} checked={gameType === t} onChange={() => setGameType(t)} />
                  <span style={{marginLeft: 6}}>{t === "COMPETITIVE" ? "🔴 แข่งขัน" : "🟢 ร่วมมือ"}</span>
                </label>
              ))}
            </div>
            {error && <div style={styles.error}>{error}</div>}
            <div style={styles.btnRow}>
              <button style={{...styles.btn, ...styles.btnBack}} onClick={() => { setMode(null); setError(""); }}>← กลับ</button>
              <button style={{...styles.btn, ...styles.btnCreate}} onClick={handleCreate} disabled={loading || !connected}>
                {loading ? "กำลังสร้าง..." : "สร้างห้อง 🎵"}
              </button>
            </div>
          </div>
        )}

        {roomInfo && (
          <div style={styles.waitRoom}>
            <div style={styles.formTitle}>✅ ห้องถูกสร้างแล้ว!</div>
            <div style={styles.pinDisplay}>
              <div style={styles.pinLabel}>PIN ห้อง</div>
              <div style={styles.pinCode}>{roomInfo.pin}</div>
              <div style={styles.pinHint}>แชร์ PIN นี้ให้เพื่อนร่วมทีม</div>
            </div>
            <div style={styles.playerList}>
              <div style={styles.playerListTitle}>ผู้เล่นในห้อง ({lobbyPlayers.length})</div>
              {lobbyPlayers.map((p, i) => (
                <div key={i} style={styles.playerItem}>
                  <span>👤 {p.name}</span>
                  <span style={styles.teamTag}>{p.teamName || p.teamId}</span>
                </div>
              ))}
            </div>
            <div style={styles.startHint}>⏳ รอให้ทุกคนเข้าร่วม แล้วกด Start บนหน้าจอเกม</div>
          </div>
        )}

        {mode === "join" && (
          <div style={styles.form}>
            <div style={styles.formTitle}>🚪 เข้าร่วมห้อง</div>
            <input style={styles.input} placeholder="ชื่อของคุณ" value={playerName}
              onChange={e => setPlayerName(e.target.value)} maxLength={20} />
            <input style={{...styles.input, ...styles.pinInput}} placeholder="รหัส PIN 4 ตัว" value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              maxLength={4} inputMode="numeric" />
            <select style={styles.input} value={teamId} onChange={e => setTeamId(e.target.value)}>
              <option value="team_1">Team 1</option>
              <option value="team_2">Team 2</option>
              <option value="team_3">Team 3</option>
              <option value="team_4">Team 4</option>
            </select>
            {error && <div style={styles.error}>{error}</div>}
            <div style={styles.btnRow}>
              <button style={{...styles.btn, ...styles.btnBack}} onClick={() => { setMode(null); setError(""); }}>← กลับ</button>
              <button style={{...styles.btn, ...styles.btnJoin}} onClick={handleJoin} disabled={loading || !connected}>
                {loading ? "กำลังเข้า..." : "เข้าร่วม! 🎶"}
              </button>
            </div>
          </div>
        )}

        {mode === "teacher" && (
          <div style={styles.form}>
            <div style={styles.formTitle}>👩‍🏫 หน้าจอครู (โปรเจคเตอร์)</div>
            <input style={{...styles.input, ...styles.pinInput}} placeholder="รหัส PIN 4 ตัว"
              value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              maxLength={4} inputMode="numeric" />
            {error && <div style={styles.error}>{error}</div>}
            <div style={styles.btnRow}>
              <button style={{...styles.btn, ...styles.btnBack}} onClick={() => { setMode(null); setError(""); }}>← กลับ</button>
              <button style={{...styles.btn, ...styles.btnTeacher}} onClick={handleTeacherJoin} disabled={loading || !connected}>
                {loading ? "กำลังเข้า..." : "เปิดแดชบอร์ด 📊"}
              </button>
            </div>
          </div>
        )}

        {!connected && (
          <div style={styles.offline}>🔴 กำลังเชื่อมต่อ... โปรดรอสักครู่</div>
        )}
      </div>

      <style>{`
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const styles = {
  container: { width: "100vw", height: "100vh", display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" },
  header: { textAlign: "center", marginBottom: 24 },
  title: { fontSize: 42, fontWeight: 900, letterSpacing: 2,
    background: "linear-gradient(90deg, #ffd700, #ff6b6b, #4ecdc4)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  subtitle: { fontSize: 16, color: "#a0aec0", marginTop: 4 },
  card: { background: "rgba(255,255,255,0.05)", borderRadius: 24, padding: 32,
    width: "90%", maxWidth: 420, backdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" },
  menuGrid: { display: "flex", flexDirection: "column", gap: 12 },
  btn: { padding: "14px 20px", borderRadius: 14, border: "none", cursor: "pointer",
    fontSize: 16, fontWeight: 700, transition: "all 0.2s", width: "100%" },
  btnCreate: { background: "linear-gradient(135deg, #667eea, #764ba2)", color: "white" },
  btnJoin: { background: "linear-gradient(135deg, #f093fb, #f5576c)", color: "white" },
  btnTeacher: { background: "linear-gradient(135deg, #4facfe, #00f2fe)", color: "#1a1a2e" },
  btnBack: { background: "rgba(255,255,255,0.1)", color: "white", width: "auto", padding: "14px 20px" },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  formTitle: { fontSize: 20, fontWeight: 800, textAlign: "center", marginBottom: 4 },
  input: { padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)", color: "white", fontSize: 16, outline: "none" },
  pinInput: { fontSize: 28, textAlign: "center", fontWeight: 900, letterSpacing: 8 },
  radioGroup: { display: "flex", gap: 16, justifyContent: "center" },
  radioLabel: { display: "flex", alignItems: "center", cursor: "pointer", fontSize: 15 },
  btnRow: { display: "flex", gap: 10, marginTop: 4 },
  error: { color: "#fc8181", fontSize: 14, textAlign: "center",
    background: "rgba(252,129,129,0.1)", padding: "8px 12px", borderRadius: 8 },
  waitRoom: { display: "flex", flexDirection: "column", gap: 16 },
  pinDisplay: { textAlign: "center", padding: 20, background: "rgba(255,215,0,0.1)",
    borderRadius: 16, border: "2px solid #ffd700" },
  pinLabel: { fontSize: 12, color: "#a0aec0", letterSpacing: 2, textTransform: "uppercase" },
  pinCode: { fontSize: 56, fontWeight: 900, color: "#ffd700", letterSpacing: 12, marginTop: 4 },
  pinHint: { fontSize: 13, color: "#a0aec0", marginTop: 8 },
  playerList: { maxHeight: 160, overflowY: "auto" },
  playerListTitle: { fontSize: 13, color: "#a0aec0", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 },
  playerItem: { display: "flex", justifyContent: "space-between", padding: "8px 0",
    borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 15 },
  teamTag: { background: "rgba(99,179,237,0.2)", color: "#63b3ed",
    padding: "2px 10px", borderRadius: 20, fontSize: 12 },
  startHint: { fontSize: 13, color: "#68d391", textAlign: "center", padding: 12,
    background: "rgba(104,211,145,0.1)", borderRadius: 10 },
  offline: { marginTop: 16, textAlign: "center", color: "#fc8181", fontSize: 14 },
};
