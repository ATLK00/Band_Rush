import React, { useState, useEffect, useRef, useCallback } from "react";

const FAMILIES = ["Strings", "Brass", "Woodwind", "Percussion", "Keyboard"];
const FAMILY_COLORS = {
  Strings: "#e53e3e",
  Brass: "#d69e2e",
  Woodwind: "#38a169",
  Percussion: "#805ad5",
  Keyboard: "#3182ce",
};
const FAMILY_EMOJI = {
  Strings: "🎻", Brass: "🎺", Woodwind: "🎷", Percussion: "🥁", Keyboard: "🎹",
};

export default function GameScreen({ gameState, myInfo, emit, on, off, addNotification, onStartGame }) {
  const [localCards, setLocalCards] = useState([]);
  const [myCoins, setMyCoins] = useState(0);
  const [myScore, setMyScore] = useState(0);
  const [timer, setTimer] = useState(120);
  const [frozen, setFrozen] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showTargetPicker, setShowTargetPicker] = useState(null); // itemType
  const [dragCard, setDragCard] = useState(null);
  const [incomingCard, setIncomingCard] = useState(null);
  const [matchFeedback, setMatchFeedback] = useState(null); // { correct, text }
  const [isHost, setIsHost] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const deskRef = useRef(null);
  const dragStart = useRef(null);

  const myTeam = gameState?.teams?.[myInfo?.teamId];
  const myRoles = myTeam?.players?.[myInfo?.socketId]?.assigned_roles || [];

  // Sync state
  useEffect(() => {
    if (!gameState || !myInfo) return;
    const team = gameState.teams?.[myInfo.teamId];
    if (!team) return;
    setLocalCards(team.cards_on_desk || []);
    setMyCoins(team.coins || 0);
    setMyScore(team.score || 0);
    setFrozen(team.active_debuffs?.includes("frozen") || false);

    // Check if host
    const myPlayer = team.players?.[myInfo.socketId];
    setIsHost(myPlayer?.isHost || false);
    setGameStarted(gameState.status === "PLAYING");
  }, [gameState, myInfo]);

  useEffect(() => {
    const r1 = on("timer_tick", ({ seconds }) => setTimer(seconds));
    const r2 = on("coin_updated", ({ teamId, newBalance, score }) => {
      if (teamId === myInfo?.teamId) {
        setMyCoins(newBalance);
        if (score !== undefined) setMyScore(score);
      }
    });
    const r3 = on("match_result", ({ isCorrect, pointsAdded, coinsAdded, combo }) => {
      if (isCorrect) {
        const text = combo >= 3 ? `✨ Combo x${combo}! +${pointsAdded}pt +${coinsAdded}🪙` : `✅ ถูก! +${pointsAdded}pt +${coinsAdded}🪙`;
        setMatchFeedback({ correct: true, text });
      } else {
        setMatchFeedback({ correct: false, text: "❌ ผิด! ลองใหม่" });
      }
      setTimeout(() => setMatchFeedback(null), 1500);
    });
    const r4 = on("receive_card", ({ cardData, fromDirection }) => {
      setIncomingCard({ ...cardData, fromDir: fromDirection });
      setTimeout(() => {
        setLocalCards(prev => {
          if (prev.find(c => c.cardId === cardData.cardId)) return prev;
          return [...prev, { ...cardData, x: fromDirection === "left" ? 10 : 80, y: 40 }];
        });
        setIncomingCard(null);
      }, 400);
    });
    const r5 = on("sabotage_hit", ({ targetTeamId, itemType }) => {
      if (targetTeamId === myInfo?.teamId && itemType === "fermata") {
        setFrozen(true);
        setTimeout(() => setFrozen(false), 5000);
      }
    });
    const r6 = on("debuff_cleared", ({ teamId, debuff }) => {
      if (teamId === myInfo?.teamId && debuff === "frozen") setFrozen(false);
    });
    return () => { r1(); r2(); r3(); r4(); r5(); r6(); };
  }, [on, myInfo]);

  // ---- CARD INTERACTIONS ----
  const handleCardFlip = useCallback((cardId, currentFaceUp) => {
    if (frozen) return;
    emit("flip_card", { cardId, isFaceUp: !currentFaceUp });
  }, [emit, frozen]);

  const handleDragStart = useCallback((e, card) => {
    if (frozen) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStart.current = { x: clientX, y: clientY, card, startX: card.x, startY: card.y };
    setDragCard(card.cardId);
  }, [frozen]);

  const handleDragMove = useCallback((e) => {
    if (!dragStart.current || !deskRef.current) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const desk = deskRef.current.getBoundingClientRect();
    const pct_x = ((clientX - desk.left) / desk.width) * 100;
    const pct_y = ((clientY - desk.top) / desk.height) * 100;

    setLocalCards(prev => prev.map(c =>
      c.cardId === dragStart.current.card.cardId
        ? { ...c, x: Math.max(0, Math.min(90, pct_x)), y: Math.max(0, Math.min(90, pct_y)) }
        : c
    ));
  }, []);

  const handleDragEnd = useCallback((e) => {
    if (!dragStart.current) return;
    const card = dragStart.current.card;
    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const desk = deskRef.current?.getBoundingClientRect();

    if (desk) {
      const pct_x = ((clientX - desk.left) / desk.width) * 100;
      // Swipe right off screen
      if (pct_x > 95) {
        setLocalCards(prev => prev.filter(c => c.cardId !== card.cardId));
        emit("swipe_card", { cardId: card.cardId, direction: "right" });
        addNotification("🃏 ปัดการ์ดไปให้เพื่อน!", "info");
      }
      // Swipe left off screen
      else if (pct_x < 5) {
        setLocalCards(prev => prev.filter(c => c.cardId !== card.cardId));
        emit("swipe_card", { cardId: card.cardId, direction: "left" });
        addNotification("🃏 ปัดการ์ดไปให้เพื่อน!", "info");
      }
      // Trash card: swipe up to discard
      else if (card.isTrash) {
        const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
        const pct_y = ((clientY - desk.top) / desk.height) * 100;
        if (pct_y < 10) {
          emit("discard_trash", { cardId: card.cardId });
          setLocalCards(prev => prev.filter(c => c.cardId !== card.cardId));
          addNotification("🗑️ ทิ้งของขยะแล้ว!", "info");
        }
      }
    }
    dragStart.current = null;
    setDragCard(null);
  }, [emit, addNotification]);

  const handleDropZone = useCallback((family) => {
    const faceUpCard = localCards.find(c => c.isFaceUp && !c.isTrash);
    if (!faceUpCard) {
      addNotification("หงายการ์ดก่อนนะ!", "info");
      return;
    }
    emit("submit_match", { cardId: faceUpCard.cardId, targetRole: family });
  }, [localCards, emit, addNotification]);

  const handleBuyItem = useCallback((itemType) => {
    const sabotageItems = ["coda", "glissando", "fermata"];
    if (sabotageItems.includes(itemType)) {
      setShowShop(false);
      setShowTargetPicker(itemType);
    } else {
      emit("buy_and_use_item", { itemType, targetTeamId: null }, (res) => {
        if (!res.success) addNotification(res.error || "ซื้อไม่ได้!", "danger");
        else { addNotification("✨ ใช้ Forte แล้ว!", "success"); setShowShop(false); }
      });
    }
  }, [emit, addNotification]);

  const handleAttackTarget = useCallback((targetTeamId) => {
    emit("buy_and_use_item", { itemType: showTargetPicker, targetTeamId }, (res) => {
      if (!res.success) addNotification(res.error || "ซื้อไม่ได้!", "danger");
      else addNotification("🎯 ยิงไอเทมใส่เป้าหมายแล้ว!", "success");
    });
    setShowTargetPicker(null);
  }, [emit, showTargetPicker, addNotification]);

  const timerColor = timer > 30 ? "#68d391" : timer > 10 ? "#f6ad55" : "#fc8181";

  const otherTeams = gameState ? Object.entries(gameState.teams).filter(([tid]) => tid !== myInfo?.teamId && tid !== "teacher") : [];

  const ITEMS = [
    { type: "coda", name: "Coda 💣", price: 20, desc: "ขยะ 5 ใบ" },
    { type: "glissando", name: "Glissando 🌀", price: 40, desc: "สลับการ์ด" },
    { type: "fermata", name: "Fermata ❄️", price: 80, desc: "แช่แข็ง 5s" },
    { type: "forte", name: "Forte 💡", price: 30, desc: "เปิดไพ่ 3s" },
  ];

  return (
    <div style={styles.root} onMouseMove={handleDragMove} onTouchMove={handleDragMove}
      onMouseUp={handleDragEnd} onTouchEnd={handleDragEnd}>

      {/* Frozen overlay */}
      {frozen && (
        <div style={styles.frozenOverlay}>
          <div style={styles.frozenText}>❄️ แช่แข็ง!</div>
        </div>
      )}

      {/* Incoming card flash */}
      {incomingCard && (
        <div style={styles.incomingFlash}>
          <div style={styles.incomingEmoji}>{incomingCard.emoji}</div>
          <div>การ์ดบินมา!</div>
        </div>
      )}

      {/* Match feedback */}
      {matchFeedback && (
        <div style={{ ...styles.matchFeedback, background: matchFeedback.correct ? "rgba(72,187,120,0.95)" : "rgba(245,101,101,0.95)" }}>
          {matchFeedback.text}
        </div>
      )}

      {/* TOP BAR */}
      <div style={styles.topBar}>
        {/* Drop zones */}
        <div style={styles.dropZones}>
          {(myRoles.length > 0 ? myRoles : FAMILIES.slice(0, 2)).map(role => (
            <div key={role} style={{ ...styles.dropZone, borderColor: FAMILY_COLORS[role] || "#666" }}
              onClick={() => handleDropZone(role)}>
              <span>{FAMILY_EMOJI[role]}</span>
              <span style={styles.dropZoneLabel}>{role}</span>
            </div>
          ))}
        </div>
        {/* Stats */}
        <div style={styles.statsBox}>
          <div style={{ ...styles.timerBox, color: timerColor }}>⏱ {timer}s</div>
          <div style={styles.coinBox}>🪙 {myCoins}</div>
          <div style={styles.scoreBox}>⭐ {myScore}</div>
        </div>
      </div>

      {/* DESK */}
      <div ref={deskRef} style={{ ...styles.desk, filter: frozen ? "brightness(0.4)" : "none" }}>
        {!gameStarted && (
          <div style={styles.waitOverlay}>
            <div style={styles.waitText}>รอเกมเริ่ม...</div>
            {isHost && (
              <button style={styles.startBtn} onClick={onStartGame}>🎵 เริ่มเกม!</button>
            )}
            {!isHost && <div style={styles.waitSub}>รอโฮสต์กด Start</div>}
          </div>
        )}

        {localCards.map((card) => (
          <div key={card.cardId}
            style={{
              ...styles.card,
              left: `${card.x}%`,
              top: `${card.y}%`,
              zIndex: dragCard === card.cardId ? 100 : card.isFaceUp ? 10 : 5,
              transform: dragCard === card.cardId ? "scale(1.1) rotate(3deg)" : "scale(1)",
              boxShadow: card.isTrash ? "0 0 12px rgba(255,100,100,0.8)" : dragCard === card.cardId ? "0 12px 30px rgba(0,0,0,0.5)" : "0 4px 12px rgba(0,0,0,0.3)",
            }}
            onMouseDown={(e) => handleDragStart(e, card)}
            onTouchStart={(e) => handleDragStart(e, card)}
            onClick={() => !dragCard && handleCardFlip(card.cardId, card.isFaceUp)}
          >
            {card.isFaceUp ? (
              <div style={{ ...styles.cardFront, background: card.isTrash ? "#2d1515" : CARD_BG[card.family] || "#1a2a3a" }}>
                <div style={styles.cardEmoji}>{card.emoji}</div>
                <div style={styles.cardName}>{card.name}</div>
                {!card.isTrash && (
                  <div style={{ ...styles.cardFamily, color: FAMILY_COLORS[card.family] || "#999" }}>
                    {FAMILY_EMOJI[card.family]} {card.family}
                  </div>
                )}
                {card.isTrash && <div style={styles.trashHint}>↑ ปัดขึ้นทิ้ง</div>}
              </div>
            ) : (
              <div style={styles.cardBack}>
                <div style={styles.cardBackEmoji}>🎵</div>
              </div>
            )}
          </div>
        ))}

        {/* Swipe hint arrows */}
        {gameStarted && localCards.length > 0 && (
          <>
            <div style={styles.swipeHintLeft}>◀ ปัดซ้าย</div>
            <div style={styles.swipeHintRight}>ปัดขวา ▶</div>
          </>
        )}

        {localCards.length === 0 && gameStarted && (
          <div style={styles.emptyDesk}>🎉 หมดโต๊ะ! รอการ์ดใหม่...</div>
        )}
      </div>

      {/* BOTTOM BAR */}
      <div style={styles.bottomBar}>
        <div style={styles.teamInfo}>
          <span style={styles.teamName}>👥 {myTeam?.name || myInfo?.teamId}</span>
          <span style={styles.cardCount}>🃏 {localCards.length} ใบ</span>
        </div>
        <button style={styles.shopBtn} onClick={() => setShowShop(true)}>🛒 Shop</button>
      </div>

      {/* SHOP OVERLAY */}
      {showShop && (
        <div style={styles.overlay} onClick={() => setShowShop(false)}>
          <div style={styles.shopPanel} onClick={e => e.stopPropagation()}>
            <div style={styles.shopTitle}>🛒 ร้านค้า</div>
            <div style={styles.shopCoins}>🪙 {myCoins} เหรียญ</div>
            <div style={styles.itemGrid}>
              {ITEMS.map(item => (
                <button key={item.type}
                  style={{ ...styles.itemBtn, opacity: myCoins >= item.price ? 1 : 0.4 }}
                  onClick={() => myCoins >= item.price && handleBuyItem(item.type)}
                  disabled={myCoins < item.price}>
                  <div style={styles.itemName}>{item.name}</div>
                  <div style={styles.itemDesc}>{item.desc}</div>
                  <div style={styles.itemPrice}>🪙 {item.price}</div>
                </button>
              ))}
            </div>
            <button style={styles.closeBtn} onClick={() => setShowShop(false)}>✕ ปิด</button>
          </div>
        </div>
      )}

      {/* TARGET PICKER */}
      {showTargetPicker && (
        <div style={styles.overlay} onClick={() => setShowTargetPicker(null)}>
          <div style={styles.shopPanel} onClick={e => e.stopPropagation()}>
            <div style={styles.shopTitle}>🎯 เลือกเป้าหมาย</div>
            <div style={styles.shopCoins}>ยิงไอเทม: {showTargetPicker}</div>
            <div style={styles.itemGrid}>
              {otherTeams.map(([tid, team]) => (
                <button key={tid} style={{ ...styles.itemBtn, background: "rgba(245,101,101,0.2)" }}
                  onClick={() => handleAttackTarget(tid)}>
                  <div style={styles.itemName}>💀 {team.name || tid}</div>
                  <div style={styles.itemDesc}>⭐ {team.score} คะแนน</div>
                  <div style={styles.itemPrice}>🪙 {team.coins} เหรียญ</div>
                </button>
              ))}
              {otherTeams.length === 0 && <div style={{ color: "#a0aec0", gridColumn: "1/-1", textAlign: "center", padding: 20 }}>ยังไม่มีทีมอื่น</div>}
            </div>
            <button style={styles.closeBtn} onClick={() => setShowTargetPicker(null)}>✕ ยกเลิก</button>
          </div>
        </div>
      )}
    </div>
  );
}

const CARD_BG = {
  Strings: "#2d1515", Brass: "#2d2415", Woodwind: "#152d15",
  Percussion: "#1e1530", Keyboard: "#151d30",
};

const styles = {
  root: { width: "100vw", height: "100vh", display: "flex", flexDirection: "column",
    background: "linear-gradient(180deg, #0f0f1a 0%, #1a1a2e 100%)", userSelect: "none", position: "relative" },
  topBar: { height: "22%", display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "8px 12px", background: "rgba(0,0,0,0.4)", borderBottom: "1px solid rgba(255,255,255,0.1)" },
  dropZones: { display: "flex", gap: 8, flex: 1 },
  dropZone: { flex: 1, border: "2px dashed", borderRadius: 12, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", padding: "6px 4px", cursor: "pointer",
    background: "rgba(255,255,255,0.04)", minWidth: 60, fontSize: 18, transition: "all 0.2s",
    ":hover": { background: "rgba(255,255,255,0.1)" } },
  dropZoneLabel: { fontSize: 10, color: "#a0aec0", marginTop: 2 },
  statsBox: { display: "flex", flexDirection: "column", gap: 4, marginLeft: 10, minWidth: 70 },
  timerBox: { fontSize: 20, fontWeight: 900, textAlign: "right" },
  coinBox: { fontSize: 14, fontWeight: 700, color: "#ffd700", textAlign: "right" },
  scoreBox: { fontSize: 14, fontWeight: 700, color: "#68d391", textAlign: "right" },
  desk: { flex: 1, position: "relative", overflow: "hidden",
    background: "radial-gradient(ellipse at center, #2d4a2d 0%, #1a2e1a 40%, #0f1f0f 100%)",
    backgroundImage: "radial-gradient(ellipse at center, #2d4a2d 0%, #1a2e1a 40%, #0f1f0f 100%), url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='20' cy='20' r='2'/%3E%3C/g%3E%3C/svg%3E\")" },
  card: { position: "absolute", width: 80, height: 110, borderRadius: 10, cursor: "grab",
    transition: "box-shadow 0.2s, transform 0.2s", touchAction: "none" },
  cardFront: { width: "100%", height: "100%", borderRadius: 10, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", padding: 6,
    border: "1px solid rgba(255,255,255,0.15)" },
  cardEmoji: { fontSize: 28 },
  cardName: { fontSize: 9, color: "white", textAlign: "center", fontWeight: 700, marginTop: 4, lineHeight: 1.2 },
  cardFamily: { fontSize: 8, marginTop: 4, fontWeight: 600 },
  trashHint: { fontSize: 8, color: "#fc8181", marginTop: 4 },
  cardBack: { width: "100%", height: "100%", borderRadius: 10,
    background: "linear-gradient(135deg, #2a2a4a, #1a1a3a)",
    border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" },
  cardBackEmoji: { fontSize: 28, opacity: 0.4 },
  bottomBar: { height: "10%", display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0 16px", background: "rgba(0,0,0,0.5)", borderTop: "1px solid rgba(255,255,255,0.1)" },
  teamInfo: { display: "flex", flexDirection: "column", gap: 2 },
  teamName: { fontSize: 13, fontWeight: 700, color: "#90cdf4" },
  cardCount: { fontSize: 11, color: "#a0aec0" },
  shopBtn: { padding: "10px 18px", background: "linear-gradient(135deg, #f093fb, #f5576c)",
    border: "none", borderRadius: 12, color: "white", fontWeight: 700, fontSize: 15, cursor: "pointer" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200,
    display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" },
  shopPanel: { background: "#1a1a2e", borderRadius: 20, padding: 24, width: "90%", maxWidth: 380,
    border: "1px solid rgba(255,255,255,0.15)" },
  shopTitle: { fontSize: 22, fontWeight: 900, textAlign: "center", marginBottom: 4 },
  shopCoins: { textAlign: "center", color: "#ffd700", fontWeight: 700, marginBottom: 16, fontSize: 16 },
  itemGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 },
  itemBtn: { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 12, padding: 12, cursor: "pointer", color: "white", textAlign: "center", transition: "all 0.2s" },
  itemName: { fontSize: 14, fontWeight: 800, marginBottom: 4 },
  itemDesc: { fontSize: 11, color: "#a0aec0", marginBottom: 6 },
  itemPrice: { fontSize: 14, color: "#ffd700", fontWeight: 700 },
  closeBtn: { width: "100%", padding: "12px", background: "rgba(255,255,255,0.08)",
    border: "none", borderRadius: 10, color: "white", cursor: "pointer", fontSize: 15, fontWeight: 700 },
  frozenOverlay: { position: "fixed", inset: 0, background: "rgba(100,200,255,0.15)", zIndex: 150,
    display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "all",
    animation: "pulse 0.5s infinite" },
  frozenText: { fontSize: 40, fontWeight: 900, color: "#90cdf4", textShadow: "0 0 20px #4299e1" },
  incomingFlash: { position: "fixed", top: "40%", left: "50%", transform: "translate(-50%,-50%)",
    zIndex: 300, textAlign: "center", background: "rgba(72,187,120,0.9)", padding: "20px 30px",
    borderRadius: 16, fontSize: 16, fontWeight: 800, animation: "slideDown 0.3s ease" },
  incomingEmoji: { fontSize: 40, marginBottom: 8 },
  matchFeedback: { position: "fixed", top: "35%", left: "50%", transform: "translate(-50%,-50%)",
    zIndex: 400, padding: "16px 24px", borderRadius: 14, fontSize: 18, fontWeight: 900,
    color: "white", textAlign: "center", boxShadow: "0 8px 30px rgba(0,0,0,0.4)" },
  waitOverlay: { position: "absolute", inset: 0, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", zIndex: 50 },
  waitText: { fontSize: 24, fontWeight: 900, color: "#a0aec0", marginBottom: 16 },
  waitSub: { fontSize: 14, color: "#718096" },
  startBtn: { padding: "14px 32px", background: "linear-gradient(135deg, #667eea, #764ba2)",
    border: "none", borderRadius: 14, color: "white", fontWeight: 900, fontSize: 18, cursor: "pointer",
    boxShadow: "0 8px 25px rgba(102,126,234,0.5)" },
  swipeHintLeft: { position: "absolute", left: 4, top: "50%", transform: "translateY(-50%)",
    color: "rgba(255,255,255,0.2)", fontSize: 11, pointerEvents: "none" },
  swipeHintRight: { position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
    color: "rgba(255,255,255,0.2)", fontSize: 11, pointerEvents: "none" },
  emptyDesk: { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
    color: "rgba(255,255,255,0.4)", fontSize: 18, fontWeight: 700, textAlign: "center" },
};
