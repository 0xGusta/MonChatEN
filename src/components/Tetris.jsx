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

export default function Tetris({ players, sessionId, myAddress, onGameEnd, onRematchOffer }) {
  const mySymbol = players?.challenger?.address.toLowerCase() === myAddress.toLowerCase() ? 'P1' : 'P2';
  const opponentSymbol = mySymbol === 'P1' ? 'P2' : 'P1';

  const [gameState, setGameState] = useStateTogether(`tetris-gamestate-${sessionId}`, {
    P1: { board: createEmptyBoard(), score: 0, lines: 0, gameOver: false },
    P2: { board: createEmptyBoard(), score: 0, lines: 0, gameOver: false },
    pieceSequence: Array.from({ length: 100 }, () => Math.floor(Math.random() * 7) + 1),
    status: 'playing',
  });

  const [rematchStatus, setRematchStatus] = useStateTogether(`tetris-rematch-${sessionId}`, null);
  const [playerStatus, setPlayerStatus] = useStateTogether(`tetris-playerStatus-${sessionId}`, {
    P1: 'online',
    P2: 'online',
  });

  const [player, setPlayer] = useState({ pos: { x: 0, y: 0 }, shape: null, collided: false });
  const [pieceIndex, setPieceIndex] = useState(0);
  const dropTime = 1000;

  const gameAreaRef = useRef(null);
  const opponentAreaRef = useRef(null);
  const requestRef = useRef();
  const lastTimeRef = useRef(0);
  const dropCounterRef = useRef(0);

  const opponentClosed = playerStatus[opponentSymbol] === 'closed';

  useEffect(() => {
    setPlayerStatus(prev => ({ ...prev, [mySymbol]: 'online' }));
  }, []);

  useEffect(() => {
    if (playerStatus[opponentSymbol] === 'closed') {
    }
  }, [playerStatus[opponentSymbol]]);

  useEffect(() => {
    const handleUnload = () => {
      const updatedStatus = { [mySymbol]: 'closed' };
      localStorage.setItem(`tetris-playerStatus-${sessionId}`, JSON.stringify(updatedStatus));
      setPlayerStatus(prev => ({ ...prev, ...updatedStatus }));
    };
  
    window.addEventListener('beforeunload', handleUnload);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        handleUnload();
      }
    });
  
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      document.removeEventListener('visibilitychange', handleUnload);
    };
  }, []);

  useEffect(() => {
  const interval = setInterval(() => {
    const status = localStorage.getItem(`tetris-playerStatus-${sessionId}`);
    if (status) {
      try {
        const parsed = JSON.parse(status);
        if (parsed[opponentSymbol] === 'closed') {
          setPlayerStatus(prev => ({ ...prev, [opponentSymbol]: 'closed' }));
        }
      } catch {}
    }
  }, 3000);

  return () => clearInterval(interval);
}, [opponentSymbol, sessionId]);

  const checkCollision = useCallback((playerPiece, board) => {
    if (!playerPiece.shape || !board) return true;
    const { shape, pos } = playerPiece;
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x] !== 0) {
          const boardY = y + pos.y;
          const boardX = x + pos.x;
          if (!board[boardY] || board[boardY][boardX] === undefined || board[boardY][boardX] !== 0) {
            return true;
          }
        }
      }
    }
    return false;
  }, []);

  const resetPlayer = useCallback(() => {
    const sequence = gameState.pieceSequence;
    const nextShapeIndex = sequence[pieceIndex % sequence.length];
    const newShape = SHAPES[nextShapeIndex];
    if (newShape) {
      setPlayer({
        pos: { x: Math.floor(COLS / 2) - Math.floor(newShape[0].length / 2), y: 0 },
        shape: newShape,
        collided: false,
      });
      setPieceIndex(prev => prev + 1);
    }
  }, [pieceIndex, gameState.pieceSequence]);

  useEffect(() => {
    resetPlayer();
  }, []);

  const movePlayer = useCallback((dir) => {
    if (!player.shape || gameState[mySymbol].gameOver || opponentClosed) return;
    const board = gameState[mySymbol].board;
    if (!checkCollision({ ...player, pos: { x: player.pos.x + dir, y: player.pos.y } }, board)) {
      setPlayer(prev => ({ ...prev, pos: { x: prev.pos.x + dir, y: prev.pos.y } }));
    }
  }, [player, gameState, mySymbol, opponentClosed, checkCollision]);

  const dropPlayer = useCallback(() => {
    if (!player.shape || gameState[mySymbol].gameOver || opponentClosed) return;
    const board = gameState[mySymbol].board;
    if (!checkCollision({ ...player, pos: { x: player.pos.x, y: player.pos.y + 1 } }, board)) {
      setPlayer(prev => ({ ...prev, pos: { x: prev.pos.x, y: prev.pos.y + 1 } }));
    } else {
      if (player.pos.y < 1) {
        setGameState(prev => ({ ...prev, [mySymbol]: { ...prev[mySymbol], gameOver: true } }));
        return;
      }
      setPlayer(prev => ({ ...prev, collided: true }));
    }
  }, [player, gameState, mySymbol, opponentClosed, checkCollision, setGameState]);

  const playerRotate = useCallback((dir) => {
    if (!player.shape || gameState[mySymbol].gameOver || opponentClosed) return;
    const clonedPlayer = JSON.parse(JSON.stringify(player));
    const rotate = (matrix) => {
      const transposed = matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
      return dir > 0 ? transposed.map(row => row.reverse()) : transposed.reverse();
    };
    clonedPlayer.shape = rotate(clonedPlayer.shape);
    let offset = 1;
    const board = gameState[mySymbol].board;
    while (checkCollision(clonedPlayer, board)) {
      clonedPlayer.pos.x += offset;
      offset = -(offset + (offset > 0 ? 1 : -1));
      if (Math.abs(offset) > clonedPlayer.shape[0].length) return;
    }
    setPlayer(clonedPlayer);
  }, [player, gameState, mySymbol, opponentClosed, checkCollision]);

  useEffect(() => {
    if (player.collided) {
      setGameState(prev => {
        const newMyBoard = prev[mySymbol].board.map(row => [...row]);
        player.shape.forEach((row, y) => {
          row.forEach((value, x) => {
            if (value !== 0) newMyBoard[y + player.pos.y][x + player.pos.x] = value;
          });
        });
        let linesCleared = 0;
        const sweptBoard = newMyBoard.reduce((acc, row) => {
          if (row.every(cell => cell !== 0)) {
            linesCleared++;
            acc.unshift(Array(COLS).fill(0));
          } else {
            acc.push(row);
          }
          return acc;
        }, []);
        const garbageToSend = Math.max(0, linesCleared - 1);
        let newOpponentBoard = prev[opponentSymbol].board;
        const isOpponentTopRowClear = prev[opponentSymbol].board[0]?.every(cell => cell === 0);
        if (garbageToSend > 0 && !prev[opponentSymbol].gameOver && isOpponentTopRowClear) {
          newOpponentBoard = prev[opponentSymbol].board.slice();
          for (let i = 0; i < garbageToSend; i++) {
            newOpponentBoard.shift();
            const garbageRow = Array(COLS).fill(8);
            garbageRow[Math.floor(Math.random() * COLS)] = 0;
            newOpponentBoard.push(garbageRow);
          }
        }
        return {
          ...prev,
          [mySymbol]: { ...prev[mySymbol], board: sweptBoard, score: prev[mySymbol].score + (linesCleared * 10) },
          [opponentSymbol]: { ...prev[opponentSymbol], board: newOpponentBoard }
        };
      });
      resetPlayer();
    }
  }, [player.collided, player.shape, player.pos, mySymbol, opponentSymbol, resetPlayer, setGameState]);

  const animate = useCallback((time = 0) => {
    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;
    dropCounterRef.current += deltaTime;
    if (dropCounterRef.current > dropTime) {
      dropPlayer();
      dropCounterRef.current = 0;
    }
    requestRef.current = requestAnimationFrame(animate);
  }, [dropPlayer, dropTime]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [animate]);

  useEffect(() => {
    const myCtx = gameAreaRef.current?.getContext('2d');
    const opponentCtx = opponentAreaRef.current?.getContext('2d');
    if (!myCtx || !opponentCtx) return;
    const drawBoard = (ctx, board, currentPlayer = null) => {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      board.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value !== 0) {
            ctx.fillStyle = COLORS[value];
            ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
          }
        });
      });
      if (currentPlayer?.shape) {
        currentPlayer.shape.forEach((row, y) => {
          row.forEach((value, x) => {
            if (value !== 0) {
              ctx.fillStyle = COLORS[value];
              ctx.fillRect((currentPlayer.pos.x + x) * BLOCK_SIZE, (currentPlayer.pos.y + y) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
            }
          });
        });
      }
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
    const newPieceSequence = Array.from({ length: 100 }, () => Math.floor(Math.random() * 7) + 1);
    setGameState({
      P1: { board: createEmptyBoard(), score: 0, lines: 0, gameOver: false },
      P2: { board: createEmptyBoard(), score: 0, lines: 0, gameOver: false },
      pieceSequence: newPieceSequence,
      status: 'playing',
    });
    setPieceIndex(0);
    setRematchStatus(null);
    setPlayerStatus({ P1: 'online', P2: 'online' });
    onRematchOffer(sessionId, mySymbol, 'accepted');
    resetPlayer();
  };

  const handleDeclineRematch = () => {
    onRematchOffer(sessionId, mySymbol, 'declined');
    setRematchStatus(prev => ({ ...prev, status: 'declined' }));
  };

  const handleCloseGame = (e) => {
    if (e) e.stopPropagation();
    setPlayerStatus(prev => ({ ...prev, [mySymbol]: 'closed' }));
    onGameEnd(sessionId, 'closed');
  };

  const handleKeyDown = useCallback((e) => {
    if (gameState[mySymbol].gameOver || opponentClosed) return;
    const relevantKeys = ['a', 'ArrowLeft', 'd', 'ArrowRight', 's', 'ArrowDown', 'q', 'ArrowUp', 'e'];
    if (!relevantKeys.includes(e.key)) return;
    e.preventDefault();
    if (e.key === 'a' || e.key === 'ArrowLeft') movePlayer(-1);
    else if (e.key === 'd' || e.key === 'ArrowRight') movePlayer(1);
    else if (e.key === 's' || e.key === 'ArrowDown') dropPlayer();
    else if (e.key === 'q' || e.key === 'ArrowUp') playerRotate(-1);
    else if (e.key === 'e') playerRotate(1);
  }, [movePlayer, dropPlayer, playerRotate, gameState, mySymbol, opponentClosed]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const getPlayerName = (symbol) => {
    if (!players) return '';
    if (symbol === 'P1') return players.challenger?.username || 'Player 1';
    if (symbol === 'P2') return players.opponent?.username || 'Player 2';
    return '';
  };

  const iAmRematchRequester = rematchStatus && rematchStatus.by === mySymbol;
  const iAmRematchReceiver = rematchStatus && rematchStatus.by === opponentSymbol;
  const winner = gameState.P1.gameOver ? 'P2' : gameState.P2.gameOver ? 'P1' : null;

  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-row justify-center items-start gap-2 w-full px-2">
        <div className="text-center flex flex-col items-center">
          <h3 className="font-bold text-sm sm:text-base">{getPlayerName('P1')} {mySymbol === 'P1' ? '(You)' : ''}</h3>
          <div className="w-[40vw] max-w-[200px]">
            <canvas ref={mySymbol === 'P1' ? gameAreaRef : opponentAreaRef} width={COLS * BLOCK_SIZE} height={ROWS * BLOCK_SIZE} className="w-full h-auto border-2 border-monad bg-darkCard" />
          </div>
          <div className="text-white text-sm">Score: {gameState.P1.score}</div>
          {gameState.P1.gameOver && <div className="text-red-500 font-bold text-xl sm:text-2xl">GAME OVER</div>}
        </div>
        <div className="text-center flex flex-col items-center">
          <h3 className="font-bold text-sm sm:text-base">{getPlayerName('P2')} {mySymbol === 'P2' ? '(You)' : ''}</h3>
          <div className="w-[40vw] max-w-[200px]">
            <canvas ref={mySymbol === 'P2' ? gameAreaRef : opponentAreaRef} width={COLS * BLOCK_SIZE} height={ROWS * BLOCK_SIZE} className="w-full h-auto border-2 border-gray-600 bg-darkCard" />
          </div>
          <div className="text-white text-sm">Score: {gameState.P2.score}</div>
          {gameState.P2.gameOver && <div className="text-red-500 font-bold text-xl sm:text-2xl">GAME OVER</div>}
        </div>
        <div className="block md:hidden fixed bottom-0 w-full p-4 z-50">
          <GameControls onMove={movePlayer} onRotate={playerRotate} onDrop={dropPlayer} />
        </div>
      </div>

      <div className="text-center mt-4">
        {opponentClosed ? (
          <>
            <p className="mb-2 text-lg font-semibold">The opponent has left the game.</p>
            <p className="mb-4">You won by forfeit.</p>
            <button onClick={handleCloseGame} className="btn btn-secondary">
              Close
            </button>
          </>
        ) : gameState.P1.gameOver || gameState.P2.gameOver ? (
          rematchStatus?.status === 'pending' ? (
            iAmRematchReceiver ? (
              <>
                <p className="mb-2">{getPlayerName(opponentSymbol)} wants a rematch!</p>
                <button onClick={handleAcceptRematch} className="btn btn-primary mr-2">Accept</button>
                <button onClick={handleDeclineRematch} className="btn btn-secondary">Decline</button>
              </>
            ) : (
              <p>Waiting for {getPlayerName(opponentSymbol)} to respond...</p>
            )
          ) : rematchStatus?.status === 'declined' ? (
            <>
              <p className="mb-2">
                {iAmRematchRequester
                  ? `${getPlayerName(opponentSymbol)} declined the rematch.`
                  : `You declined the rematch.`}
              </p>
              <button onClick={handleCloseGame} className="btn btn-secondary">Close</button>
            </>
          ) : (
            <div className="flex gap-2 justify-center">
              <button onClick={handleRematchRequest} className="btn btn-primary">Play Again?</button>
              <button onClick={handleCloseGame} className="btn btn-secondary">Close</button>
            </div>
          )
        ) : null}
      </div>
        </div>
      )}
    </div>
  );
}
