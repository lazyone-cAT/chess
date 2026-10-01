import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Peer } from 'peerjs';
import { FILES, VALUES, genRoomCode } from '../lib/glyphs';

const ROOM_PREFIX = 'hearth-chess-';

function safeMove(game, opts) {
  try {
    return game.move(opts);
  } catch (e) {
    return null;
  }
}

function safeLoad(game, fen) {
  try {
    game.load(fen);
    return true;
  } catch (e) {
    return false;
  }
}

function findKing(game, color) {
  const pos = game.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const c = pos[r][f];
      if (c && c.type === 'k' && c.color === color) return FILES[f] + (8 - r);
    }
  }
  return null;
}

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useChessTable() {
  const gameRef = useRef(null);
  if (!gameRef.current) gameRef.current = new Chess();
  const fxRef = useRef(null);
  const peerRef = useRef(null);
  const connRef = useRef(null);
  const modeRef = useRef(null);
  const myColorRef = useRef(null);
  const playerNameRef = useRef('Guest');
  const opponentNameRef = useRef('Friend');
  const lastCheckRef = useRef(false);
  const fxQueueRef = useRef([]);
  const cutinTimer = useRef(0);
  const endTimer = useRef(0);

  const reduced = useMemo(prefersReduced, []);

  const [screen, setScreen] = useState('home');
  const [mode, setMode] = useState(null);
  const [myColor, setMyColor] = useState(null);
  const [orientation, setOrientation] = useState('w');
  const [opponentName, setOpponentName] = useState('Friend');
  const [room, setRoom] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [version, setVersion] = useState(0);
  const [selected, setSelected] = useState(null);
  const [hover, setHover] = useState(null);
  const [lastMove, setLastMove] = useState(null);
  const [chat, setChat] = useState([]);
  const [chatVisible, setChatVisible] = useState(true);
  const [note, setNote] = useState(null);
  const [cinematic, setCinematic] = useState(null);
  const [cutin, setCutin] = useState(null);
  const [backdrop, setBackdrop] = useState('home');
  const [introKey, setIntroKey] = useState(0);
  const [connected, setConnected] = useState(false);
  const [playerName, setPlayerName] = useState('Guest');

  const game = gameRef.current;

  /* ---------------- derived ---------------- */
  const history = useMemo(() => game.history({ verbose: true }), [game, version]);

  const moveRows = useMemo(() => {
    const rows = [];
    for (let i = 0; i < history.length; i += 2) {
      rows.push({ no: i / 2 + 1, a: history[i], b: history[i + 1] || null });
    }
    return rows;
  }, [history]);

  const captures = useMemo(() => {
    const w = [];
    const b = [];
    let score = 0;
    history.forEach((m) => {
      if (!m.captured) return;
      if (m.color === 'w') {
        w.push(m.captured);
        score += VALUES[m.captured];
      } else {
        b.push(m.captured);
        score -= VALUES[m.captured];
      }
    });
    const sort = (l) => l.slice().sort((x, y) => VALUES[y] - VALUES[x]);
    return { w: sort(w), b: sort(b), score };
  }, [history]);

  const hints = useMemo(() => {
    const map = {};
    if (!selected) return map;
    game.moves({ square: selected, verbose: true }).forEach((m) => {
      map[m.to] = m.captured || m.flags.indexOf('e') >= 0 ? 'cap' : 'move';
    });
    return map;
  }, [game, selected, version]);

  const inCheck = game.isCheck();
  const checkSq = useMemo(
    () => (inCheck ? findKing(game, game.turn()) : null),
    [game, inCheck, version]
  );
  const gameOver = game.isGameOver();

  const statusLine = useMemo(() => {
    if (game.isCheckmate()) {
      const winner = game.turn() === 'w' ? 'Black' : 'White';
      return { text: 'Checkmate — ' + winner + ' wins', kind: 'mate' };
    }
    if (game.isDraw()) {
      let text = 'Draw';
      if (game.isStalemate()) text = 'Draw — stalemate';
      else if (game.isThreefoldRepetition()) text = 'Draw — threefold repetition';
      else if (game.isInsufficientMaterial()) text = 'Draw — insufficient material';
      else text = 'Draw — fifty-move rule';
      return { text, kind: '' };
    }
    const turnName = game.turn() === 'w' ? 'White' : 'Black';
    let extra = '';
    if (mode === 'online') {
      if (myColor === game.turn()) extra = ' — your move';
      else if (myColor) extra = ' — waiting for opponent';
      else extra = ' — spectating';
    } else {
      extra = ' to move';
    }
    let text = turnName + extra;
    let kind = '';
    if (inCheck) {
      text += ' — check!';
      kind = 'check';
    }
    return { text, kind };
  }, [game, mode, myColor, inCheck, version]);

  /* ---------------- fx plumbing ---------------- */
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const pumpQueue = useCallback(() => {
    const fx = fxRef.current;
    if (!fx || fx.isBusy() || !fxQueueRef.current.length) return;
    const fn = fxQueueRef.current.shift();
    fn();
  }, []);

  const enqueue = useCallback(
    (fn) => {
      fxQueueRef.current.push(fn);
      pumpQueue();
    },
    [pumpQueue]
  );

  const getQueueDepth = useCallback(() => fxQueueRef.current.length, []);

  const showCutin = useCallback((main, sub) => {
    setCutin({ id: Date.now() + Math.random(), main, note: sub || '' });
    clearTimeout(cutinTimer.current);
    cutinTimer.current = setTimeout(() => setCutin(null), 1500);
  }, []);

  const addChatMessage = useCallback((msg) => {
    setChat((c) => [...c, msg]);
  }, []);

  const addSystemChat = useCallback(
    (text) => addChatMessage({ kind: 'sys', text }),
    [addChatMessage]
  );

  /* ---------------- move flow ---------------- */
  const canIMove = useCallback(() => {
    if (modeRef.current === 'local') return true;
    return !!connRef.current && myColorRef.current === gameRef.current.turn();
  }, []);

  const showEnd = useCallback(() => {
    const g = gameRef.current;
    let title = 'GAME OVER';
    let sub = 'The battle is finished';
    if (g.isCheckmate()) {
      const winner = g.turn() === 'w' ? 'Black' : 'White';
      title = 'CHECKMATE';
      sub = winner + ' wins the duel';
    } else if (g.isStalemate()) {
      title = 'STALEMATE';
      sub = 'No legal moves remain';
    } else if (g.isThreefoldRepetition()) {
      title = 'DRAW';
      sub = 'Threefold repetition';
    } else if (g.isInsufficientMaterial()) {
      title = 'DRAW';
      sub = 'Insufficient material';
    } else if (g.isDraw()) {
      title = 'DRAW';
      sub = 'Fifty-move rule';
    }
    setCinematic({ title, sub });
    if (fxRef.current) fxRef.current.speedBurst();
  }, []);

  const postMove = useCallback(() => {
    const g = gameRef.current;
    const isCheck = g.isCheck();
    if (isCheck && !lastCheckRef.current && !g.isGameOver()) {
      if (fxRef.current) fxRef.current.lightning();
      showCutin('CHECK', '!');
    }
    lastCheckRef.current = isCheck;
    if (g.isGameOver()) {
      clearTimeout(endTimer.current);
      endTimer.current = setTimeout(showEnd, isCheck ? 750 : 520);
    }
  }, [showCutin, showCutin]);

  const applyMove = useCallback(
    (move) => {
      setLastMove(move);
      bump();
      enqueue(() => {
        const fx = fxRef.current;
        if (!fx) {
          postMove();
          return;
        }
        fx.playMove(move, () => {
          postMove();
          pumpQueue();
        });
      });

      const banner = () => {
        if (move.flags.indexOf('k') >= 0 || move.flags.indexOf('q') >= 0) {
          if (move.piece === 'k') showCutin('CASTLE', '');
        } else if (move.promotion) {
          showCutin('PROMOTION', 'QUEEN');
        } else if (move.captured) {
          showCutin(move.san.replace(/[^a-zA-Z0-9+#]/g, ''), 'TAKE');
        }
      };
      setTimeout(banner, reduced ? 0 : 260);
    },
    [bump, enqueue, postMove, pumpQueue, reduced, showCutin]
  );

  const attemptMove = useCallback(
    (from, to) => {
      if (!canIMove()) return false;
      const move = safeMove(gameRef.current, { from, to, promotion: 'q' });
      if (!move) return false;
      applyMove(move);
      const conn = connRef.current;
      if (conn) conn.send({ type: 'move', from, to, promotion: 'q', fen: gameRef.current.fen() });
      return true;
    },
    [applyMove, canIMove]
  );

  const onSquareClick = useCallback(
    (sq) => {
      if (screen !== 'game') return;
      if (fxRef.current && fxRef.current.isBusy()) return;
      if (gameRef.current.isGameOver()) return;

      if (!selected) {
        const piece = gameRef.current.get(sq);
        if (piece && piece.color === gameRef.current.turn() && canIMove()) setSelected(sq);
        return;
      }
      if (sq === selected) {
        setSelected(null);
        return;
      }
      const piece = gameRef.current.get(sq);
      if (piece && piece.color === gameRef.current.turn() && canIMove()) {
        setSelected(sq);
        return;
      }
      const from = selected;
      setSelected(null);
      attemptMove(from, sq);
    },
    [attemptMove, canIMove, screen, selected]
  );

  /* ---------------- game lifecycle ---------------- */
  const startGame = useCallback(() => {
    setIntroKey((k) => k + 1);
    setSelected(null);
    setLastMove(null);
    if (fxRef.current) fxRef.current.sync();
    bump();
  }, [bump]);

  const newGame = useCallback(() => {
    gameRef.current.reset();
    setSelected(null);
    setHover(null);
    setLastMove(null);
    setCinematic(null);
    lastCheckRef.current = false;
    fxQueueRef.current = [];
    if (fxRef.current) {
      fxRef.current.clearFx();
      fxRef.current.sync();
    }
    startGame();
  }, [startGame]);

  const playLocal = useCallback(() => {
    modeRef.current = 'local';
    myColorRef.current = null;
    setMode('local');
    setMyColor(null);
    setOrientation('w');
    setBackdrop('game');
    setRoom({ code: null, role: 'local' });
    setChatVisible(false);
    setNote(
      '<b>Pass &amp; play.</b> Tap a piece, then tap where it goes — the device stays put, no connection needed.'
    );
    setChat([]);
    addSystemChat('Local pass-and-play. Chat is off in this mode.');
    setScreen('game');
    startGame();
  }, [addSystemChat, startGame]);

  /* ---------------- online ---------------- */
  const withTimeout = useCallback((peerObj, code) => {
    const t = setTimeout(() => {
      setStatusMsg(
        'Still trying to reach the connection server… if this sits here, that public relay may be blocked on your network. Local play always works.'
      );
    }, 7000);
    peerObj.on('open', () => clearTimeout(t));
    peerObj.on('error', () => clearTimeout(t));
  }, []);

  const handlePeerError = useCallback((err, code) => {
    const type = err && err.type;
    if (type === 'unavailable-id') {
      setStatusMsg('That room code is taken right now — try Create Room again for a fresh code.');
    } else if (type === 'peer-unavailable') {
      setStatusMsg('No table found for "' + code + '". Double-check the code with your friend.');
    } else {
      setStatusMsg('Connection problem (' + (type || 'unknown') + '). Try again.');
    }
  }, []);

  const handleRemoteMessage = useCallback(
    (data) => {
      if (!data || !data.type) return;
      if (data.type === 'hello') {
        const nm = data.name || 'Friend';
        opponentNameRef.current = nm;
        setOpponentName(nm);
        addSystemChat(nm + ' joined the table.');
        setVersion((v) => v + 1);
      } else if (data.type === 'move') {
        const g = gameRef.current;
        const before = g.fen();
        const move = safeMove(g, {
          from: data.from,
          to: data.to,
          promotion: data.promotion || 'q'
        });
        if (!move) {
          if (data.fen) safeLoad(g, data.fen);
        } else if (data.fen && g.fen() !== data.fen) {
          safeLoad(g, data.fen);
        }
        if (g.fen() !== before) {
          const h = g.history({ verbose: true });
          const last = h.length ? h[h.length - 1] : null;
          if (last) applyMove(last);
          else {
            if (fxRef.current) fxRef.current.sync();
            bump();
          }
        }
      } else if (data.type === 'sync') {
        const g = gameRef.current;
        if (data.fen && g.fen() !== data.fen) {
          if (safeLoad(g, data.fen)) {
            lastCheckRef.current = g.isCheck();
            if (fxRef.current) fxRef.current.sync();
            bump();
          }
        }
      } else if (data.type === 'chat') {
        addChatMessage({
          kind: 'msg',
          name: data.name || 'Guest',
          text: data.text || '',
          self: false
        });
      }
    },
    [addChatMessage, addSystemChat, applyMove, bump]
  );

  const wireConnection = useCallback(() => {
    const conn = connRef.current;
    if (!conn) return;
    conn.on('data', handleRemoteMessage);
    conn.send({ type: 'hello', name: playerNameRef.current });
    conn.on('close', () => {
      setConnected(false);
      addSystemChat(opponentNameRef.current + ' disconnected.');
      setVersion((v) => v + 1);
    });
    setConnected(true);
    if (myColorRef.current === 'w') conn.send({ type: 'sync', fen: gameRef.current.fen() });
    setVersion((v) => v + 1);
  }, [addSystemChat, handleRemoteMessage]);

  const startAsHost = useCallback(
    (code) => {
      setStatusMsg('Opening room ' + code + '…');
      modeRef.current = 'online';
      myColorRef.current = 'w';
      setMode('online');
      setMyColor('w');
      setOrientation('w');
      setBackdrop('game');
      const peer = new Peer(ROOM_PREFIX + code, { debug: 0 });
      peerRef.current = peer;
      withTimeout(peer, code);
      peer.on('open', () => {
        setRoom({ code, role: 'host' });
        setScreen('game');
        setStatusMsg('Room open — send that code to your friend.');
        addSystemChat('Table created. Waiting for someone to join…');
        setChatVisible(true);
        setNote(null);
        startGame();
      });
      peer.on('connection', (c) => {
        if (connRef.current) {
          c.close();
          return;
        }
        connRef.current = c;
        wireConnection();
      });
      peer.on('error', (err) => handlePeerError(err, code));
    },
    [addSystemChat, handlePeerError, startGame, wireConnection, withTimeout]
  );

  const startAsGuest = useCallback(
    (code) => {
      setStatusMsg('Joining room ' + code + '…');
      modeRef.current = 'online';
      myColorRef.current = 'b';
      setMode('online');
      setMyColor('b');
      setOrientation('b');
      setBackdrop('game');
      const peer = new Peer(undefined, { debug: 0 });
      peerRef.current = peer;
      withTimeout(peer, code);
      peer.on('open', () => {
        const conn = peer.connect(ROOM_PREFIX + code, { reliable: true });
        connRef.current = conn;
        conn.on('open', () => {
          setRoom({ code, role: 'guest' });
          setScreen('game');
          setStatusMsg('');
          setChatVisible(true);
          setNote(null);
          wireConnection();
          startGame();
        });
        conn.on('error', () => setStatusMsg('Could not reach that room. Check the code and try again.'));
      });
      peer.on('error', (err) => handlePeerError(err, code));
    },
    [handlePeerError, startGame, wireConnection, withTimeout]
  );

  const createRoom = useCallback(
    (name) => {
      const clean = (name || '').trim() || 'Guest';
      playerNameRef.current = clean;
      setPlayerName(clean);
      startAsHost(genRoomCode());
    },
    [startAsHost]
  );

  const joinRoom = useCallback(
    (name, rawCode) => {
      const code = (rawCode || '').trim().toUpperCase();
      if (!code) {
        setStatusMsg('Enter a room code first.');
        return;
      }
      const clean = (name || '').trim() || 'Guest';
      playerNameRef.current = clean;
      setPlayerName(clean);
      startAsGuest(code);
    },
    [startAsGuest]
  );

  const leaveTable = useCallback(() => {
    try {
      if (connRef.current) connRef.current.close();
    } catch (e) {}
    try {
      if (peerRef.current) peerRef.current.destroy();
    } catch (e) {}
    connRef.current = null;
    peerRef.current = null;
    modeRef.current = null;
    myColorRef.current = null;
    setMode(null);
    setMyColor(null);
    setOrientation('w');
    setRoom(null);
    setChat([]);
    setChatVisible(true);
    setNote(null);
    setCinematic(null);
    setScreen('home');
    setBackdrop('home');
    setStatusMsg('');
    newGame();
  }, [newGame]);

  const sendChat = useCallback((text) => {
    const conn = connRef.current;
    if (!text || !conn) return;
    conn.send({ type: 'chat', name: playerNameRef.current, text });
    addChatMessage({ kind: 'msg', name: playerNameRef.current, text, self: true });
  }, [addChatMessage]);

  const playAgain = useCallback(() => {
    if (modeRef.current === 'local') {
      setCinematic(null);
      newGame();
    } else {
      window.location.reload();
    }
  }, [newGame]);

  const closeCinematic = useCallback(() => setCinematic(null), []);

  const flipBoard = useCallback(() => setOrientation((o) => (o === 'w' ? 'b' : 'w')), []);

  /* ---------------- effects ---------------- */
  useEffect(() => {
    return () => {
      clearTimeout(cutinTimer.current);
      clearTimeout(endTimer.current);
      try {
        if (peerRef.current) peerRef.current.destroy();
      } catch (e) {}
    };
  }, []);

  useEffect(() => {
    if (screen !== 'game') return;
    if (fxRef.current) fxRef.current.sync();
  }, [screen, version]);

  return {
    game,
    screen,
    mode,
    myColor,
    orientation,
    flipBoard,
    opponentName,
    room,
    playerName,
    statusMsg,
    setStatusMsg,
    version,
    selected,
    setSelected,
    hover,
    setHover,
    lastMove,
    moveRows,
    captures,
    hints,
    checkSq,
    gameOver,
    statusLine,
    chat,
    chatVisible,
    note,
    cinematic,
    cutin,
    backdrop,
    introKey,
    connected,
    reduced,
    fxRef,
    getQueueDepth,
    onSquareClick,
    createRoom,
    joinRoom,
    playLocal,
    leaveTable,
    sendChat,
    playAgain,
    closeCinematic,
    startGame
  };
}
