import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useStateTogether } from 'react-together';
import GameControls from './GameControls';

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 20;
const COLORS = [null, '#FF0D72', '#0DC2FF', '#0DFF72', '#F538FF', '#FF8E0D', '#FFE138', '#3877FF', '#6B7280'];
const SHAPES = [
  null,
  [[1, 1, 1], [0, 1, 0]],
  [[2, 2, 2, 2]],
  [[0, 3, 3], [3, 3, 0]],
  [[4, 4, 0], [0, 4, 4]],
  [[5, 0, 0], [5, 5, 5]],
  [[0, 0, 6], [6, 6, 6]],
  [[7, 7], [7, 7]],
];

const createEmptyBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(0));

function generateBag() {
  const bag = [1, 2, 3, 4, 5, 6, 7];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

const initialGameState = {
  P1: { board: createEmptyBoard(), score: 0, lines: 0, gameOver: false },
  P2: { board: createEmptyBoard(), score: 0, lines: 0, gameOver: false },
  pieceSequences: { P1: generateBag(), P2: generateBag() },
  pieceIndexes: { P1: 0, P2: 0 },
  playerStates: { P1: null, P2: null },
  status: 'playing',
  winner: null,
};

export default function Tetris({ players, sessionId, myAddress, onRematchOffer, playerStatus, setPlayerStatus, onCloseGame }) {
  if (!players || !playerStatus) {
    return null;
  }

  const mySymbol = players.challenger?.address.toLowerCase() === myAddress.toLowerCase() ? 'P1' : 'P2';
  const opponentSymbol = mySymbol === 'P1' ? 'P2' : 'P1';

  const [gameState, setGameState] = useStateTogether(`tetris-gamestate-${sessionId}`, initialGameState);
  const [rematchStatus, setRematchStatus] = useStateTogether(`tetris-rematch-${sessionId}`, null);
  const [player, setPlayer] = useState({ pos: { x: 0, y: 0 }, shape: null, collided: false });
  const [isLocking, setIsLocking] = useState(false);
  const [isDropping, setIsDropping] = useState(false);
  const dropTime = 1000;

  const gameAreaRef = useRef(null);
  const opponentAreaRef = useRef(null);
  const requestRef = useRef();
  const lastTimeRef = useRef(0);
  const dropCounterRef = useRef(0);

  const opponentClosed = playerStatus && playerStatus[opponentSymbol] === 'closed';

  useEffect(() => {
    if (setPlayerStatus) {
      setPlayerStatus(prev => ({ ...(prev || {}), [mySymbol]: 'online' }));
    }
  }, [mySymbol, setPlayerStatus]);

  useEffect(() => {
    const handleUnload = () => {
       if (setPlayerStatus) {
        setPlayerStatus(prev => ({ ...(prev || {}), [mySymbol]: 'closed' }));
       }
    };
    window.addEventListener('beforeunload', handleUnload);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') handleUnload();
    });
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      document.removeEventListener('visibilitychange', handleUnload);
    };
  }, [mySymbol, setPlayerStatus]);

  const checkCollision = useCallback((playerPiece, board) => {
    if (!playerPiece.shape || !board) return true;
    for (let y = 0; y < playerPiece.shape.length; y++) {
      for (let x = 0; x < playerPiece.shape[y].length; x++) {
        if (playerPiece.shape[y][x] !== 0) {
          const boardY = y + playerPiece.pos.y;
          const boardX = x + playerPiece.pos.x;
          if (!board[boardY] || board[boardY][boardX] === undefined || board[boardY][boardX] !== 0) {
            return true;
          }
        }
      }
    }
    return false;
  }, []);

  const resetPlayer = useCallback(() => {
    if (!gameState || !gameState.pieceSequences || !gameState.pieceIndexes) return;
    const seq = gameState.pieceSequences;
    const idx = gameState.pieceIndexes;
    const nextShapeIndex = seq[mySymbol]?.[idx[mySymbol]] || 1;
    const newShape = SHAPES[nextShapeIndex];
    if (newShape) {
      setPlayer({
        pos: { x: Math.floor(COLS / 2) - Math.floor(newShape[0].length / 2), y: 0 },
        shape: newShape,
        collided: false,
      });
      setGameState(prev => {
        if (!prev || !prev.pieceIndexes || !prev.pieceSequences) return prev;
        let newIndexes = { ...prev.pieceIndexes };
        newIndexes[mySymbol] = (newIndexes[mySymbol] + 1) % prev.pieceSequences[mySymbol].length;
        let newSequences = { ...prev.pieceSequences };
        if (newIndexes[mySymbol] === 0) newSequences[mySymbol] = generateBag();
        return { ...prev, pieceIndexes: newIndexes, pieceSequences: newSequences };
      });
    }
  }, [gameState, mySymbol, setGameState]);

  useEffect(() => {
    resetPlayer();
  }, []);

  const movePlayer = useCallback(dir => {
      if (isLocking || !player.shape || !gameState || gameState.status === 'finished' || opponentClosed) return;
      const board = gameState[mySymbol]?.board;
      if (board && !checkCollision({ ...player, pos: { x: player.pos.x + dir, y: player.pos.y } }, board)) {
        setPlayer(prev => ({ ...prev, pos: { x: prev.pos.x + dir, y: prev.pos.y } }));
      }
    }, [isLocking, player, gameState, mySymbol, opponentClosed, checkCollision]
  );

  const dropPlayer = useCallback(() => {
    if (isLocking || !player.shape || !gameState || gameState.status === 'finished' || opponentClosed) return;
    const board = gameState[mySymbol]?.board;
    if (board && !checkCollision({ ...player, pos: { x: player.pos.x, y: player.pos.y + 1 } }, board)) {
      setPlayer(prev => ({ ...prev, pos: { x: prev.pos.x, y: prev.pos.y + 1 } }));
    } else {
      if (player.pos.y < 1) {
        setGameState(prev => ({
          ...prev,
          status: 'finished',
          winner: opponentSymbol,
          [mySymbol]: { ...(prev ? prev[mySymbol] : {}), gameOver: true },
        }));
        return;
      }
      setPlayer(prev => ({ ...prev, collided: true }));
    }
  }, [isLocking, player, gameState, mySymbol, opponentSymbol, opponentClosed, checkCollision, setGameState]);

  const playerRotate = useCallback(dir => {
      if (isLocking || !player.shape || !gameState || gameState.status === 'finished' || opponentClosed) return;
      const clonedPlayer = JSON.parse(JSON.stringify(player));
      const rotate = m => m[0].map((_, i) => m.map(r => r[i])).reverse();
      clonedPlayer.shape = dir > 0 ? rotate(clonedPlayer.shape) : rotate(rotate(rotate(clonedPlayer.shape)));
      const board = gameState[mySymbol]?.board;
      if (board) {
        let offset = 1;
        while (checkCollision(clonedPlayer, board)) {
          clonedPlayer.pos.x += offset;
          offset = -(offset + (offset > 0 ? 1 : -1));
          if (Math.abs(offset) > clonedPlayer.shape[0].length) return;
        }
      }
      setPlayer(clonedPlayer);
    }, [isLocking, player, gameState, mySymbol, opponentClosed, checkCollision]
  );

  useEffect(() => {
    if (player.collided && gameState && gameState[mySymbol] && gameState[opponentSymbol]) {
      const newMyBoard = gameState[mySymbol].board.map(r => [...r]);
      player.shape.forEach((row, y) => row.forEach((val, x) => {
        if (val !== 0) newMyBoard[y + player.pos.y][x + player.pos.x] = val;
      }));

      let linesCleared = 0;
      const sweptBoard = newMyBoard.reduce((acc, row) => {
        if (row.every(cell => cell !== 0)) {
          linesCleared++; acc.unshift(Array(COLS).fill(0));
        } else {
          acc.push(row);
        }
        return acc;
      }, []);

      setGameState(prev => {
        if (!prev || !prev[opponentSymbol]) return prev;
        let newOpponentBoard = prev[opponentSymbol].board;
        const garbageToSend = Math.max(0, linesCleared - 1);
        if (garbageToSend > 0 && !prev[opponentSymbol].gameOver && prev[opponentSymbol].board[0].every(c => c === 0)) {
          newOpponentBoard = [...prev[opponentSymbol].board];
          for (let i = 0; i < garbageToSend; i++) {
            newOpponentBoard.shift();
            const garbageRow = Array(COLS).fill(8); garbageRow[Math.floor(Math.random() * COLS)] = 0; newOpponentBoard.push(garbageRow);
          }
        }
        return {
          ...prev,
          [mySymbol]: { ...prev[mySymbol], board: sweptBoard, score: prev[mySymbol].score + linesCleared * 10 },
          [opponentSymbol]: { ...prev[opponentSymbol], board: newOpponentBoard },
        };
      });

      if (linesCleared > 0) {
        setIsLocking(true);
        setTimeout(() => { resetPlayer(); setIsLocking(false) }, 300);
      } else {
        resetPlayer();
      }
    }
  }, [player.collided, gameState, mySymbol, opponentSymbol, resetPlayer, setGameState]);

  const animate = useCallback((time = 0) => {
      const deltaTime = time - lastTimeRef.current; lastTimeRef.current = time;
      dropCounterRef.current += deltaTime;
      if (dropCounterRef.current > dropTime) {
        dropPlayer(); dropCounterRef.current = 0;
      }
      requestRef.current = requestAnimationFrame(animate);
    }, [dropPlayer, dropTime]
  );

  useEffect(() => {
    if (gameState && gameState.status === 'playing' && gameState[mySymbol] && !gameState[mySymbol].gameOver) {
      requestRef.current = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameState, mySymbol, animate]);

  useEffect(() => {
    const myCtx = gameAreaRef.current?.getContext('2d');
    const opponentCtx = opponentAreaRef.current?.getContext('2d');
    if (!myCtx || !opponentCtx || !gameState || !gameState[mySymbol] || !gameState[opponentSymbol]) return;

    const drawBoard = (ctx, board, p = null) => {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      board?.forEach((row, y) => row.forEach((val, x) => {
        if (val !== 0) {
          ctx.fillStyle = COLORS[val]; ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        }
      }));
      p?.shape?.forEach((row, y) => row.forEach((val, x) => {
        if (val !== 0) {
          ctx.fillStyle = COLORS[val]; ctx.fillRect((p.pos.x + x) * BLOCK_SIZE, (p.pos.y + y) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        }
      }));
    };
    drawBoard(myCtx, gameState[mySymbol].board, player);
    drawBoard(opponentCtx, gameState[opponentSymbol].board);
  }, [gameState, player, mySymbol, opponentSymbol]);

  const handleRematchRequest = () => {
    if (!players || opponentClosed) return;
    setRematchStatus({ by: mySymbol, status: 'pending' });
    onRematchOffer(sessionId, mySymbol, 'pending');
  };

  const handleAcceptRematch = () => {
    const newPieceSequences = { P1: generateBag(), P2: generateBag() };
    setGameState({
      P1: { board: createEmptyBoard(), score: 0, lines: 0, gameOver: false },
      P2: { board: createEmptyBoard(), score: 0, lines: 0, gameOver: false },
      pieceSequences: newPieceSequences,
      pieceIndexes: { P1: 0, P2: 0 },
      playerStates: { P1: 'online', P2: 'online' },
      status: 'playing',
      winner: null,
    });
    setRematchStatus(null);
    setPlayerStatus({ P1: 'online', P2: 'online' });
    onRematchOffer(sessionId, mySymbol, 'accepted');
    resetPlayer();
  };

  const handleDeclineRematch = () => {
    onRematchOffer(sessionId, mySymbol, 'declined');
    setRematchStatus(prev => ({ ...prev, status: 'declined' }));
  };

  const handleKeyDown = useCallback(e => {
      if (isLocking || !gameState || gameState.status === 'finished' || opponentClosed) return;
      const k = e.key.toLowerCase(); if (['a','d','s','w','q','e','arrowleft','arrowright','arrowdown','arrowup'].includes(k)) e.preventDefault();
      if (k === 'a' || k === 'arrowleft') movePlayer(-1);
      else if (k === 'd' || k === 'arrowright') movePlayer(1);
      else if (k === 's' || k === 'arrowdown') { if (!isDropping) { setIsDropping(true); dropPlayer() }}
      else if (k === 'w' || k === 'arrowup' || k === 'e') playerRotate(1);
      else if (k === 'q') playerRotate(-1);
    }, [isLocking, movePlayer, dropPlayer, playerRotate, gameState, opponentClosed, isDropping]
  );

  const handleKeyUp = useCallback(e => {
    if (e.key.toLowerCase() === 's' || e.key.toLowerCase() === 'arrowdown') setIsDropping(false);
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown); document.addEventListener('keyup', handleKeyUp);
    return () => { document.removeEventListener('keydown', handleKeyDown); document.removeEventListener('keyup', handleKeyUp) };
  }, [handleKeyDown, handleKeyUp]);

  const getPlayerName = s => players ? (s === 'P1' ? players.challenger?.username : players.opponent?.username) : '';
  const iAmRematchRequester = rematchStatus && rematchStatus.by === mySymbol;
  const iAmRematchReceiver = rematchStatus && rematchStatus.by === opponentSymbol;
  const nextShape = SHAPES[gameState?.pieceSequences?.[mySymbol]?.[gameState.pieceIndexes?.[mySymbol]] || 1];

  return (
    <div className="flex flex-col items-center max-h-[90vh] overflow-y-auto">
        <div className="flex flex-row justify-center items-start gap-2 w-full px-2">
            <div style={{ border: mySymbol === 'P1' ? '4px solid #3b82f6' : '1px solid #ccc', padding: '4px', borderRadius: '6px' }}>
                <h3 className="font-bold text-sm sm:text-base">{getPlayerName('P1')} {mySymbol === 'P1' && '(You)'}</h3>
                <canvas ref={mySymbol === 'P1' ? gameAreaRef : opponentAreaRef} width={COLS * BLOCK_SIZE} height={ROWS * BLOCK_SIZE} style={{ backgroundColor: '#000' }}/>
            </div>
            <div style={{ border: mySymbol === 'P2' ? '4px solid #3b82f6' : '1px solid #ccc', padding: '4px', borderRadius: '6px' }}>
                <h3 className="font-bold text-sm sm:text-base">{getPlayerName('P2')} {mySymbol === 'P2' && '(You)'}</h3>
                <canvas ref={mySymbol === 'P2' ? gameAreaRef : opponentAreaRef} width={COLS * BLOCK_SIZE} height={ROWS * BLOCK_SIZE} style={{ backgroundColor: '#000' }}/>
            </div>
        </div>

        {gameState && gameState.status === 'finished' && (
            <div className="mt-4 flex flex-col items-center gap-2">
                <p className="font-bold text-lg">{gameState.winner === mySymbol ? 'You won!' : 'You lost!'}</p>
                 {!opponentClosed && (
                    <>
                        {!rematchStatus && (
                            <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" onClick={handleRematchRequest}>
                                Request Rematch
                            </button>
                        )}
                        {iAmRematchReceiver && rematchStatus.status === 'pending' && (
                            <div className="flex gap-2">
                            <button className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded" onClick={handleAcceptRematch}>
                                Accept
                            </button>
                            <button className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded" onClick={handleDeclineRematch}>
                                Decline
                            </button>
                            </div>
                        )}
                        {iAmRematchRequester && rematchStatus.status === 'pending' && (
                            <p>Waiting for opponent to accept rematch...</p>
                        )}
                        {rematchStatus && rematchStatus.status === 'declined' && <p>Rematch declined.</p>}
                    </>
                )}
                {opponentClosed && <p>Your opponent has left the game.</p>}
                <button className="mt-2 bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded" onClick={onCloseGame}>
                    Close Game
                </button>
            </div>
        )}
        <GameControls onMove={movePlayer} onRotate={playerRotate} onDrop={dropPlayer} />
    </div>
  );
}
