import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useStateTogether } from 'react-together';
import GameControls from './GameControls';

const COLS = 10;
const ROWS = 20;

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

export default function Tetris({ players, sessionId, myAddress, onRematchOffer, playerStatus, setPlayerStatus, onCloseGame }) {
  const mySymbol = players?.challenger?.address.toLowerCase() === myAddress.toLowerCase() ? 'P1' : 'P2';
  const opponentSymbol = mySymbol === 'P1' ? 'P2' : 'P1';

  const [gameState, setGameState] = useStateTogether(`tetris-gamestate-${sessionId}`, {
    P1: { board: createEmptyBoard(), score: 0, lines: 0, gameOver: false },
    P2: { board: createEmptyBoard(), score: 0, lines: 0, gameOver: false },
    P1_pieceSequence: Array.from({ length: 100 }, () => Math.floor(Math.random() * 7) + 1),
    P2_pieceSequence: Array.from({ length: 100 }, () => Math.floor(Math.random() * 7) + 1),
    P1_piece: null,
    P2_piece: null,
    status: 'playing',
    winner: null,
  });

  const [rematchStatus, setRematchStatus] = useStateTogether(`tetris-rematch-${sessionId}`, null);
  const [player, setPlayer] = useState({ pos: { x: 0, y: 0 }, shape: null, collided: false });
  const [pieceIndex, setPieceIndex] = useState(0);
  const [isLocking, setIsLocking] = useState(false);
  const [isDropping, setIsDropping] = useState(false);
  const [isClearingLines, setIsClearingLines] = useState(false);
  const [needsReset, setNeedsReset] = useState(false);
  const [blockSize, setBlockSize] = useState(20);
  const dropTime = 1000;

  const gameAreaRef = useRef(null);
  const opponentAreaRef = useRef(null);
  const nextPieceCanvasRef = useRef(null);
  const requestRef = useRef();
  const lastTimeRef = useRef(0);
  const dropCounterRef = useRef(0);

  const opponentClosed = playerStatus?.[opponentSymbol] === 'closed';
  const pieceSequence = gameState?.[`${mySymbol}_pieceSequence`];

  useEffect(() => {
    setPlayerStatus(prev => ({ ...prev, [mySymbol]: 'online' }));
  }, [mySymbol, setPlayerStatus]);

  useEffect(() => {
    const handleUnload = () => {
      setPlayerStatus(prev => ({ ...prev, [mySymbol]: 'closed' }));
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

  useEffect(() => {
    const calculateBlockSize = () => {
      const gameContainer = gameAreaRef.current?.parentElement;
      if (gameContainer) {
        const containerWidth = gameContainer.offsetWidth;
        setBlockSize(containerWidth / COLS);
      }
    };
    calculateBlockSize();
    window.addEventListener('resize', calculateBlockSize);
    return () => window.removeEventListener('resize', calculateBlockSize);
  }, []);

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
    if (!pieceSequence) return;
    const nextShapeIndex = pieceSequence[pieceIndex % pieceSequence.length];
    const newShape = SHAPES[nextShapeIndex];
    if (newShape) {
      setPlayer({
        pos: { x: Math.floor(COLS / 2) - Math.floor(newShape[0].length / 2), y: 0 },
        shape: newShape,
        collided: false,
      });
      setPieceIndex(prev => prev + 1);
    }
  }, [pieceIndex, mySymbol, pieceSequence]);

  useEffect(() => {
    resetPlayer();
  }, []);

  useEffect(() => {
    if (player.shape && gameState?.[mySymbol] && !gameState[mySymbol].gameOver) {
      setGameState(prev => {
        if (!prev) return prev;
        if (JSON.stringify(prev[`${mySymbol}_piece`]) === JSON.stringify(player)) {
          return prev;
        }
        return {
          ...prev,
          [`${mySymbol}_piece`]: player,
        };
      });
    }
  }, [player, mySymbol, gameState, setGameState]);

  const movePlayer = useCallback((dir) => {
    if (isLocking || !player.shape || gameState?.status === 'finished' || opponentClosed) return;
    const board = gameState?.[mySymbol]?.board;
    if (!checkCollision({ ...player, pos: { x: player.pos.x + dir, y: player.pos.y } }, board)) {
      setPlayer(prev => ({ ...prev, pos: { x: prev.pos.x + dir, y: prev.pos.y } }));
    }
  }, [isLocking, player, gameState, mySymbol, opponentClosed, checkCollision]);

  const dropPlayer = useCallback(() => {
    if (isLocking || !player.shape || gameState?.status === 'finished' || opponentClosed) return;
    const board = gameState?.[mySymbol]?.board;
    if (!checkCollision({ ...player, pos: { x: player.pos.x, y: player.pos.y + 1 } }, board)) {
      setPlayer(prev => ({ ...prev, pos: { x: prev.pos.x, y: prev.pos.y + 1 } }));
    } else {
      if (player.pos.y < 1) {
        setGameState(prev => ({
          ...prev,
          status: 'finished',
          winner: opponentSymbol,
          [mySymbol]: { ...prev[mySymbol], gameOver: true },
        }));
        return;
      }
      setPlayer(prev => ({ ...prev, collided: true }));
    }
  }, [isLocking, player, gameState, mySymbol, opponentSymbol, opponentClosed, checkCollision, setGameState]);

  const playerRotate = useCallback((dir) => {
    if (isLocking || !player.shape || gameState?.status === 'finished' || opponentClosed) return;
    const clonedPlayer = JSON.parse(JSON.stringify(player));
    const rotate = (matrix) => {
      const transposed = matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
      return dir > 0 ? transposed.map(row => row.reverse()) : transposed.reverse();
    };
    clonedPlayer.shape = rotate(clonedPlayer.shape);
    let offset = 1;
    const board = gameState?.[mySymbol]?.board;
    while (checkCollision(clonedPlayer, board)) {
      clonedPlayer.pos.x += offset;
      offset = -(offset + (offset > 0 ? 1 : -1));
      if (Math.abs(offset) > clonedPlayer.shape[0].length) return;
    }
    setPlayer(clonedPlayer);
  }, [isLocking, player, gameState, mySymbol, opponentClosed, checkCollision]);

  useEffect(() => {
    if (player.collided && !isLocking && gameState?.[mySymbol] && gameState?.[opponentSymbol]) {
      const newMyBoard = gameState[mySymbol].board.map(row => [...row]);
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

      setGameState(prev => {
        if (!prev) return prev;
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
      
      if (linesCleared > 0) {
        setIsLocking(true);
        setIsClearingLines(true);
      } else {
        setIsLocking(true);
        setNeedsReset(true);
      }
    }
  }, [player.collided, isLocking, gameState, mySymbol, opponentSymbol, setGameState]);

  useEffect(() => {
    if (isClearingLines) {
      const timeoutId = setTimeout(() => {
        resetPlayer();
        setIsLocking(false);
        setIsClearingLines(false);
      }, 300);

      return () => clearTimeout(timeoutId);
    }
  }, [isClearingLines, resetPlayer]);
  
  useEffect(() => {
    if (needsReset) {
        resetPlayer();
        setIsLocking(false);
        setNeedsReset(false);
    }
  }, [needsReset, resetPlayer]);

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
    if (gameState?.status === 'playing' && !gameState?.[mySymbol]?.gameOver) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(requestRef.current);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameState, mySymbol, animate]);

  useEffect(() => {
    const myCtx = gameAreaRef.current?.getContext('2d');
    const opponentCtx = opponentAreaRef.current?.getContext('2d');
    const nextPieceCtx = nextPieceCanvasRef.current?.getContext('2d');

    if (!myCtx || !opponentCtx || !gameState) return;

    const drawBoard = (ctx, board, currentPlayer = null, currentBlockSize) => {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        board.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    ctx.fillStyle = COLORS[value];
                    ctx.fillRect(x * currentBlockSize, y * currentBlockSize, currentBlockSize, currentBlockSize);
                    ctx.strokeStyle = '#000000';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x * currentBlockSize, y * currentBlockSize, currentBlockSize, currentBlockSize);
                }
            });
        });

        if (currentPlayer?.shape) {
            currentPlayer.shape.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value !== 0) {
                        const px = (currentPlayer.pos.x + x) * currentBlockSize;
                        const py = (currentPlayer.pos.y + y) * currentBlockSize;
                        ctx.fillStyle = COLORS[value];
                        ctx.fillRect(px, py, currentBlockSize, currentBlockSize);
                        ctx.strokeStyle = '#000000';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(px, py, currentBlockSize, currentBlockSize);
                    }
                });
            });
        }
    };

    const drawNextPiece = (ctx, shape, currentBlockSize) => {
        if (!ctx) return;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        if (!shape) return;

        const colorIndex = shape.flat().find(val => val !== 0) || 0;
        const color = COLORS[colorIndex];
        const shapeWidth = shape[0].length;
        const shapeHeight = shape.length;
        const canvasHeightInBlocks = 2.5;
        const offsetX = (4 - shapeWidth) / 2;
        const offsetY = (canvasHeightInBlocks - shapeHeight) / 2;

        shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    ctx.fillStyle = color;
                    ctx.fillRect((offsetX + x) * currentBlockSize, (offsetY + y) * currentBlockSize, currentBlockSize, currentBlockSize);
                    ctx.strokeStyle = '#000000';
                    ctx.lineWidth = 1;
                    ctx.strokeRect((offsetX + x) * currentBlockSize, (offsetY + y) * currentBlockSize, currentBlockSize, currentBlockSize);
                }
            });
        });
    };

    const myBoardData = gameState[mySymbol];
    const opponentBoardData = gameState[opponentSymbol];

    if (!myBoardData || !opponentBoardData) return;
    
    const opponentPiece = gameState[`${opponentSymbol}_piece`];

    drawBoard(myCtx, myBoardData.board, player, blockSize);
    drawBoard(opponentCtx, opponentBoardData.board, opponentPiece, blockSize);

    const mySequence = gameState[`${mySymbol}_pieceSequence`];
    if (mySequence && mySequence[pieceIndex]) {
        const nextShape = SHAPES[mySequence[pieceIndex]];
        drawNextPiece(nextPieceCtx, nextShape, blockSize);
    } else if (nextPieceCtx) {
        nextPieceCtx.clearRect(0, 0, nextPieceCtx.canvas.width, nextPieceCtx.canvas.height);
    }

  }, [gameState, player, mySymbol, opponentSymbol, pieceIndex, blockSize]);

  const handleRematchRequest = () => {
    if (!players || opponentClosed) return;
    setRematchStatus({ by: mySymbol, status: 'pending' });
    onRematchOffer(sessionId, mySymbol, 'pending');
  };

  const handleAcceptRematch = () => {
    setGameState({
      P1: { board: createEmptyBoard(), score: 0, lines: 0, gameOver: false },
      P2: { board: createEmptyBoard(), score: 0, lines: 0, gameOver: false },
      P1_pieceSequence: Array.from({ length: 100 }, () => Math.floor(Math.random() * 7) + 1),
      P2_pieceSequence: Array.from({ length: 100 }, () => Math.floor(Math.random() * 7) + 1),
      P1_piece: null,
      P2_piece: null,
      status: 'playing',
      winner: null,
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

  const handleKeyDown = useCallback((e) => {
    if (isLocking || gameState?.status === 'finished' || opponentClosed) return;
    const key = e.key.toLowerCase();
    if (['a', 'arrowleft', 'd', 'arrowright', 's', 'arrowdown', 'w', 'arrowup', 'q', 'e'].includes(key)) {
      e.preventDefault();
    }
    if (key === 'a' || key === 'arrowleft') movePlayer(-1);
    else if (key === 'd' || key === 'arrowright') movePlayer(1);
    else if (key === 's' || key === 'arrowdown') {
      if (!isDropping) {
        setIsDropping(true);
        dropPlayer();
      }
    }
    else if (key === 'w' || key === 'arrowup') playerRotate(1);
    else if (key === 'q') playerRotate(-1);
    else if (key === 'e') playerRotate(1);
  }, [isLocking, movePlayer, dropPlayer, playerRotate, gameState, opponentClosed, isDropping]);

  const handleKeyUp = useCallback((e) => {
    const key = e.key.toLowerCase();
    if (key === 's' || key === 'arrowdown') {
      setIsDropping(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  const getPlayerName = (symbol) => {
    if (!players) return '';
    if (symbol === 'P1') return players.challenger?.username || 'Player 1';
    if (symbol === 'P2') return players.opponent?.username || 'Player 2';
    return '';
  };
  
  const iAmRematchRequester = rematchStatus && rematchStatus.by === mySymbol;
  const iAmRematchReceiver = rematchStatus && rematchStatus.by === opponentSymbol;

  const renderPlayerArea = (symbol, isOpponent = false) => {
    const areaRef = isOpponent ? opponentAreaRef : gameAreaRef;
    const playerData = gameState?.[symbol] || { board: createEmptyBoard(), score: 0, gameOver: false };

    return (
      <div className="text-center flex flex-col items-center">
        <h3 className="font-bold text-sm sm:text-base mb-1">
          {getPlayerName(symbol)} {!isOpponent ? '(You)' : ''}
        </h3>
        
        <div className="w-[40vw] md:w-[40vw] max-w-[150px] md:max-w-[200px]">
          <canvas
            ref={areaRef}
            width={COLS * blockSize}
            height={ROWS * blockSize}
            className={`w-full h-auto border-2 bg-darkCard ${isOpponent ? 'border-gray-600' : 'border-monad'}`}
          />
        </div>

        <div className="flex flex-row justify-around items-center w-full mt-2 px-1">
          <div className="text-white text-xs sm:text-sm">Score: {playerData.score}</div>
          {!isOpponent && (
            <div className="flex flex-col items-center">
              <h4 className="text-xs font-semibold">Next</h4>
              <canvas
                ref={nextPieceCanvasRef}
                width={blockSize * 4}
                height={blockSize * 2.5}
                className="border border-gray-400 bg-darkCard"
              />
            </div>
          )}
        </div>

        {playerData.gameOver && (
          <div className="text-red-500 font-bold text-xl sm:text-2xl mt-1">GAME OVER</div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center max-h-[90vh] overflow-y-auto">
      <div className="flex flex-row justify-center items-center md:items-start gap-y-1 md:gap-x-1 w-full px-1">
        {renderPlayerArea(mySymbol, false)}
        {renderPlayerArea(opponentSymbol, true)}
      </div>

      {gameState?.status === 'playing' &&
        !gameState?.[mySymbol]?.gameOver &&
        !gameState?.[opponentSymbol]?.gameOver &&
        !opponentClosed && (
          <>
            <div className="block md:hidden mt-4 w-full max-w-xs">
              <GameControls onMove={movePlayer} onRotate={playerRotate} onDrop={dropPlayer} />
            </div>

            <div className="hidden md:flex flex-col items-center mt-4 w-full max-w-xs text-white text-sm">
              <p className="mb-2 font-semibold">Controls:</p>
              <p>← / A : Move Left</p>
              <p>→ / D : Move Right</p>
              <p>↑ or W and Q / E: Rotate</p>
              <p>↓ / S : Soft Drop</p>
            </div>
          </>
        )}

      <div className="text-center mt-4">
        {opponentClosed ? (
          <>
            <p className="mb-2 text-lg font-semibold">The opponent has left the game.</p>
            <button onClick={onCloseGame} className="btn btn-secondary">
              Close
            </button>
          </>
        ) : gameState?.status === 'finished' ? (
          <>
            {gameState.winner && (
              <div className="text-green-400 font-bold text-xl sm:text-2xl mb-4">
                Winner: {getPlayerName(gameState.winner)}
              </div>
            )}
            {rematchStatus?.status === 'pending' ? (
              iAmRematchReceiver ? (
                <>
                  <p className="mb-2">{getPlayerName(opponentSymbol)} wants a rematch!</p>
                  <button onClick={handleAcceptRematch} className="btn btn-primary mr-2">
                    Accept
                  </button>
                  <button onClick={handleDeclineRematch} className="btn btn-secondary">
                    Decline
                  </button>
                </>
              ) : (
                <p>Waiting for {getPlayerName(opponentSymbol)} to respond...</p>
              )
            ) : rematchStatus?.status === 'declined' ? (
              <>
                <p className="mb-2">
                  {iAmRematchRequester
                    ? `${getPlayerName(opponentSymbol)} declined the rematch.`
                    : 'You declined the rematch.'}
                </p>
                <button onClick={onCloseGame} className="btn btn-secondary">
                  Close
                </button>
              </>
            ) : (
              <div className="flex gap-2 justify-center">
                <button onClick={handleRematchRequest} className="btn btn-primary">
                  Play Again?
                </button>
                <button onClick={onCloseGame} className="btn btn-secondary">
                  Close
                </button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
