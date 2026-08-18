import React, { useState, useEffect, useCallback } from "react";
import { useSocket } from "./hooks/useSocket";
import LobbyScreen from "./components/LobbyScreen";
import GameScreen from "./components/GameScreen";
import TeacherDashboard from "./components/TeacherDashboard";
import GameOverScreen from "./components/GameOverScreen";

function App() {
  const { emit, on, off, connected, socket } = useSocket();
  const [screen, setScreen] = useState("lobby"); // lobby | game | teacher | gameover
  const [gameState, setGameState] = useState(null);
  const [myInfo, setMyInfo] = useState(null); // { roomId, teamId, socketId }
  const [leaderboard, setLeaderboard] = useState(null);
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((msg, type = "info") => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setNotifications((prev) => prev.filter((n) => n.id !== id)), 3000);
  }, []);

  useEffect(() => {
    const removeSyncState = on("sync_state", (state) => {
      setGameState(state);
    });
    const removeGameStarted = on("game_started", ({ timer }) => {
      setScreen("game");
      addNotification("🎵 เกมเริ่มแล้ว! ตั้งวงกันเถอะ!", "success");
    });
    const removeGameOver = on("game_over", ({ leaderboard }) => {
      setLeaderboard(leaderboard);
      setScreen("gameover");
    });
    const removePlayerJoined = on("player_joined", ({ name, teamId }) => {
      addNotification(`👋 ${name} เข้าร่วม ${teamId}`, "info");
    });
    const removeSabotage = on("sabotage_hit", ({ targetTeamId, itemType, attackerTeamId }) => {
      if (myInfo && targetTeamId === myInfo.teamId) {
        const msgs = {
          coda: "💣 โดนขยะถล่ม! ปัดการ์ดขยะออก!",
          glissando: "🌀 การ์ดถูกสับสลับหมดเลย!",
          fermata: "❄️ จอถูกแช่แข็ง 5 วินาที!",
        };
        addNotification(msgs[itemType] || "โดนโจมตี!", "danger");
      }
    });

    return () => {
      removeSyncState();
      removeGameStarted();
      removeGameOver();
      removePlayerJoined();
      removeSabotage();
    };
  }, [on, addNotification, myInfo]);

  const handleJoinedRoom = (info) => {
    setMyInfo({ ...info, socketId: socket?.id });
    if (info.isTeacher) {
      setScreen("teacher");
    }
  };

  const handleStartGame = () => {
    emit("start_game", {}, (res) => {
      if (!res?.success) addNotification("ไม่สามารถเริ่มเกมได้", "danger");
    });
  };

  const handlePlayAgain = () => {
    setScreen("lobby");
    setGameState(null);
    setMyInfo(null);
    setLeaderboard(null);
  };

  return (
    <div className="app-root">
      {/* Notifications */}
      <div className="notifications-container">
        {notifications.map((n) => (
          <div key={n.id} className={`notification notification-${n.type}`}>
            {n.msg}
          </div>
        ))}
      </div>

      {/* Connection indicator */}
      <div className={`conn-dot ${connected ? "connected" : "disconnected"}`} title={connected ? "Connected" : "Disconnected"} />

      {screen === "lobby" && (
        <LobbyScreen emit={emit} on={on} off={off} onJoined={handleJoinedRoom} connected={connected} />
      )}
      {screen === "game" && gameState && myInfo && (
        <GameScreen
          gameState={gameState}
          myInfo={myInfo}
          emit={emit}
          on={on}
          off={off}
          addNotification={addNotification}
          onStartGame={handleStartGame}
        />
      )}
      {screen === "teacher" && gameState && myInfo && (
        <TeacherDashboard
          gameState={gameState}
          myInfo={myInfo}
          emit={emit}
          on={on}
          off={off}
          onStartGame={handleStartGame}
        />
      )}
      {screen === "gameover" && (
        <GameOverScreen leaderboard={leaderboard} onPlayAgain={handlePlayAgain} />
      )}

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', sans-serif; background: #1a1a2e; color: white; overflow: hidden; }
        .app-root { width: 100vw; height: 100vh; position: relative; }
        .conn-dot {
          position: fixed; top: 8px; right: 8px; width: 10px; height: 10px;
          border-radius: 50%; z-index: 9999;
        }
        .conn-dot.connected { background: #00ff88; box-shadow: 0 0 6px #00ff88; }
        .conn-dot.disconnected { background: #ff4444; animation: pulse 1s infinite; }
        .notifications-container {
          position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
          z-index: 9998; display: flex; flex-direction: column; gap: 8px; pointer-events: none;
          width: 90%; max-width: 400px;
        }
        .notification {
          padding: 10px 16px; border-radius: 12px; text-align: center;
          font-size: 14px; font-weight: 600; animation: slideDown 0.3s ease;
          backdrop-filter: blur(10px);
        }
        .notification-info { background: rgba(99,179,237,0.9); color: #1a1a2e; }
        .notification-success { background: rgba(72,187,120,0.9); color: #1a1a2e; }
        .notification-danger { background: rgba(245,101,101,0.9); color: white; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}

export default App;
