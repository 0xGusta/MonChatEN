import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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

const generatePieceSequence = (seed, length = 100) => {
  const sequence = [];
  let currentSeed = seed;
  
  for (let i = 0; i < length; i++) {

    currentSeed = (currentSeed * 1664525 + 1013904223) % Math.pow(2, 32);
    sequence.push((Math.abs(currentSeed) % 7) + 1);
  }
  
  return sequence;
};

export default function Tetris({ players, sessionId, myAddress, onGameEnd, onRematchOffer, playerStatus, setPlayerStatus, onCloseGame }) {
  const mySymbol = players?.challenger?.address.toLowerCase() === myAddress.toLowerCase() ? 'P1' : 'P2';
  const opponentSymbol = mySymbol === 'P1' ? 'P2' : 'P1';

  const gameSeed = useMemo(() => {
    return sessionId ? parseInt(sessionId.slice(-8), 16) : Date.now();
  }, [sessionId]);

  const [sharedGameState, setSharedGameState] = useStateTogether(`tetris-shared-${sessionId}`, {
    P1: { 
      board: createEmptyBoard(), 
      score: 0, 
      lines: 0, 
      gameOver: false,
      currentPiece: null,
      pieceIndex: 0
    },
    P2: { 
      board: createEmptyBoard(), 
      score: 0, 
      lines: 0, 
      gameOver: false,
      currentPiece: null,
      pieceIndex: 0
    },
    status: 'playing',
    winner: null,
    gameStartTime: Date.now()
  });

  const [rematchStatus, setRematchStatus] = useStateTogether(`tetris-rematch-${sessionId}`, null);
  
  const [localPlayer, setLocalPlayer] = useState({ pos: { x: 0, y: 0 }, shape: null, collided: false });
  const [isLocking, setIsLocking] = useState(false);
  const [isDropping, setIsDropping] = useState(false);
  const [isClearingLines, setIsClearingLines] = useState(false);
  const [blockSize, setBlockSize] = useState(20);
  const [lastSyncTime, setLastSyncTime] = useState(0);

  const gameAreaRef = useRef(null);
  const opponentAreaRef = useRef(null);
  const nextPieceCanvasRef = useRef(null);
  const requestRef = useRef();
  const lastTimeRef = useRef(0);
  const dropCounterRef = useRef(0);
  const syncCounterRef = useRef(0);

  const dropTime = 1000;
  const syncInterval = 100;
  
  const opponentClosed = playerStatus[opponentSymbol] === 'closed';

  const pieceSequences = useMemo(() => ({
    P1: generatePieceSequence(gameSeed, 200),
    P2: generatePieceSequence(gameSeed + 1, 200)
  }), [gameSeed]);

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
          
          if (boardY < 0 || boardY >= ROWS || boardX < 0 || boardX >= COLS) {
            return true;
          }
          
          if (board[boardY][boardX] !== 0) {
            return true;
          }
        }
      }
    }
    return false;
  }, []);

  const getNextPiece = useCallback((pieceIndex) => {
    const sequence = pieceSequences[mySymbol];
    if (!sequence || pieceIndex >= sequence.length) return null;
    
    const shapeIndex = sequence[pieceIndex];
    return SHAPES[shapeIndex];
  }, [pieceSequences, mySymbol]);

  const resetPlayer = useCallback(() => {
    const currentPieceIndex = sharedGameState[mySymbol].pieceIndex;
    const newShape = getNextPiece(currentPieceIndex);
    
    if (newShape) {
      const newPlayer = {
        pos: { 
          x: Math.floor(COLS / 2) - Math.floor(newShape[0].length / 2), 
          y: 0 
        },
        shape: newShape,
        collided: false,
      };
      
      setLocalPlayer(newPlayer);
      
      setSharedGameState(prev => ({
        ...prev,
        [mySymbol]: {
          ...prev[mySymbol],
          currentPiece: {
            shape: newShape,
            pos: newPlayer.pos
          },
          pieceIndex: currentPieceIndex + 1
        }
      }));
    }
  }, [sharedGameState, mySymbol, getNextPiece, setSharedGameState]);

  useEffect(() => {
    if (sharedGameState[mySymbol].pieceIndex === 0 && !localPlayer.shape) {
      resetPlayer();
    }
  }, [sharedGameState, mySymbol, localPlayer.shape, resetPlayer]);

  const movePlayer = useCallback((dir) => {
    if (isLocking || !localPlayer.shape || sharedGameState.status === 'finished' || opponentClosed) return;
    
    const board = sharedGameState[mySymbol].board;
    const newPos = { x: localPlayer.pos.x + dir, y: localPlayer.pos.y };
    
    if (!checkCollision({ ...localPlayer, pos: newPos }, board)) {
      const newPlayer = { ...localPlayer, pos: newPos };
      setLocalPlayer(newPlayer);
      
      setSharedGameState(prev => ({
        ...prev,
        [mySymbol]: {
          ...prev[mySymbol],
          currentPiece: {
            ...prev[mySymbol].currentPiece,
            pos: newPos
          }
        }
      }));
    }
  }, [isLocking, localPlayer, sharedGameState, mySymbol, opponentClosed, checkCollision, setSharedGameState]);

  const dropPlayer = useCallback(() => {
    if (isLocking || !localPlayer.shape || sharedGameState.status === 'finished' || opponentClosed) return;
    
    const board = sharedGameState[mySymbol].board;
    const newPos = { x: localPlayer.pos.x, y: localPlayer.pos.y + 1 };
    
    if (!checkCollision({ ...localPlayer, pos: newPos }, board)) {
      const newPlayer = { ...localPlayer, pos: newPos };
      setLocalPlayer(newPlayer);
      
      setSharedGameState(prev => ({
        ...prev,
        [mySymbol]: {
          ...prev[mySymbol],
          currentPiece: {
            ...prev[mySymbol].currentPiece,
            pos: newPos
          }
        }
      }));
    } else {

      if (localPlayer.pos.y < 1) {
        setSharedGameState(prev => ({
          ...prev,
          status: 'finished',
          winner: opponentSymbol,
          [mySymbol]: { ...prev[mySymbol], gameOver: true },
        }));
        return;
      }
      setLocalPlayer(prev => ({ ...prev, collided: true }));
    }
  }, [isLocking, localPlayer, sharedGameState, mySymbol, opponentSymbol, opponentClosed, checkCollision, setSharedGameState]);

  const playerRotate = useCallback((dir) => {
    if (isLocking || !localPlayer.shape || sharedGameState.status === 'finished' || opponentClosed) return;
    
    const clonedPlayer = JSON.parse(JSON.stringify(localPlayer));
    
    const rotate = (matrix) => {
      const transposed = matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
      return dir > 0 ? transposed.map(row => row.reverse()) : transposed.reverse();
    };
    
    clonedPlayer.shape = rotate(clonedPlayer.shape);
    
    let offset = 1;
    const board = sharedGameState[mySymbol].board;
    
    while (checkCollision(clonedPlayer, board)) {
      clonedPlayer.pos.x += offset;
      offset = -(offset + (offset > 0 ? 1 : -1));
      if (Math.abs(offset) > clonedPlayer.shape[0].length) return;
    }
    
    setLocalPlayer(clonedPlayer);
    
    setSharedGameState(prev => ({
      ...prev,
      [mySymbol]: {
        ...prev[mySymbol],
        currentPiece: {
          shape: clonedPlayer.shape,
          pos: clonedPlayer.pos
        }
      }
    }));
  }, [isLocking, localPlayer, sharedGameState, mySymbol, opponentClosed, checkCollision, setSharedGameState]);

  useEffect(() => {
    if (localPlayer.collided && !isLocking) {
      setIsLocking(true);
      
      const newMyBoard = sharedGameState[mySymbol].board.map(row => [...row]);
      localPlayer.shape.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value !== 0) {
            const boardY = y + localPlayer.pos.y;
            const boardX = x + localPlayer.pos.x;
            if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
              newMyBoard[boardY][boardX] = value;
            }
          }
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
      
      setSharedGameState(prev => {
        let newOpponentBoard = prev[opponentSymbol].board;
        
        if (garbageToSend > 0 && !prev[opponentSymbol].gameOver) {
          const hasSpaceForGarbage = prev[opponentSymbol].board.slice(0, garbageToSend).every(row => 
            row.every(cell => cell === 0)
          );
          
          if (hasSpaceForGarbage) {
            newOpponentBoard = prev[opponentSymbol].board.slice();
            for (let i = 0; i < garbageToSend; i++) {
              newOpponentBoard.shift();
              const garbageRow = Array(COLS).fill(8);
              garbageRow[Math.floor(Math.random() * COLS)] = 0;
              newOpponentBoard.push(garbageRow);
            }
          }
        }

        return {
          ...prev,
          [mySymbol]: { 
            ...prev[mySymbol], 
            board: sweptBoard, 
            score: prev[mySymbol].score + (linesCleared * 10 * linesCleared),
            lines: prev[mySymbol].lines + linesCleared
          },
          [opponentSymbol]: { 
            ...prev[opponentSymbol], 
            board: newOpponentBoard 
          }
        };
      });
      
      if (linesCleared > 0) {
        setIsClearingLines(true);
        setTimeout(() => {
          setIsClearingLines(false);
          setIsLocking(false);
          resetPlayer();
        }, 300);
      } else {
        setIsLocking(false);
        resetPlayer();
      }
    }
  }, [localPlayer.collided, isLocking, sharedGameState, mySymbol, opponentSymbol, resetPlayer, setSharedGameState]);

  const animate = useCallback((time = 0) => {
    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;
    
    dropCounterRef.current += deltaTime;
    syncCounterRef.current += deltaTime;
    
    if (dropCounterRef.current > dropTime) {
      dropPlayer();
      dropCounterRef.current = 0;
    }
    
    requestRef.current = requestAnimationFrame(animate);
  }, [dropPlayer, dropTime]);

  useEffect(() => {
    if (sharedGameState.status === 'playing' && !sharedGameState[mySymbol].gameOver) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    }
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [sharedGameState.status, sharedGameState[mySymbol].gameOver, animate]);

  useEffect(() => {
    const myCtx = gameAreaRef.current?.getContext('2d');
    const opponentCtx = opponentAreaRef.current?.getContext('2d');
    const nextPieceCtx = nextPieceCanvasRef.current?.getContext('2d');
    
    if (!myCtx || !opponentCtx) return;

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

    drawBoard(myCtx, sharedGameState[mySymbol].board, localPlayer, blockSize);
    
    const opponentCurrentPiece = sharedGameState[opponentSymbol].currentPiece;
    drawBoard(opponentCtx, sharedGameState[opponentSymbol].board, opponentCurrentPiece, blockSize);

    const nextShape = getNextPiece(sharedGameState[mySymbol].pieceIndex);
    drawNextPiece(nextPieceCtx, nextShape, blockSize);

  }, [sharedGameState, localPlayer, mySymbol, opponentSymbol, blockSize, getNextPiece]);

  const handleRematchRequest = () => {
    if (!players || opponentClosed) return;
    setRematchStatus({ by: mySymbol, status: 'pending' });
    onRematchOffer(sessionId, mySymbol, 'pending');
  };

  const handleAcceptRematch = () => {
    const newSeed = Date.now();
    setSharedGameState({
      P1: { board: createEmptyBoard(), score: 0, lines: 0, gameOver: false, currentPiece: null, pieceIndex: 0 },
      P2: { board: createEmptyBoard(), score: 0, lines: 0, gameOver: false, currentPiece: null, pieceIndex: 0 },
      status: 'playing',
      winner: null,
      gameStartTime: newSeed
    });
    setLocalPlayer({ pos: { x: 0, y: 0 }, shape: null, collided: false });
    setRematchStatus(null);
    setPlayerStatus({ P1: 'online', P2: 'online' });
    onRematchOffer(sessionId, mySymbol, 'accepted');
  };

  const handleDeclineRematch = () => {
    onRematchOffer(sessionId, mySymbol, 'declined');
    setRematchStatus(prev => ({ ...prev, status: 'declined' }));
  };

  const handleKeyDown = useCallback((e) => {
    if (isLocking || sharedGameState.status === 'finished' || opponentClosed) return;
    
    const key = e.key.toLowerCase();
    if (['a', 'arrowleft', 'd', 'arrowright', 's', 'arrowdown', 'w', 'arrowup', 'q', 'e'].includes(key)) {
      e.preventDefault();
    }
    
    switch (key) {
      case 'a':
      case 'arrowleft':
        movePlayer(-1);
        break;
      case 'd':
      case 'arrowright':
        movePlayer(1);
        break;
      case 's':
      case 'arrowdown':
        if (!isDropping) {
          setIsDropping(true);
          dropPlayer();
        }
        break;
      case 'w':
      case 'arrowup':
      case 'e':
        playerRotate(1);
        break;
      case 'q':
        playerRotate(-1);
        break;
    }
  }, [isLocking, movePlayer, dropPlayer, playerRotate, sharedGameState.status, opponentClosed, isDropping]);

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
    const playerData = sharedGameState[symbol] || { board: createEmptyBoard(), score: 0, gameOver: false };

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
                className="border border-gray-600 bg-darkCard"
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-dark text-white p-4">
      <div className="w-full max-w-4xl">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-monad">Tetris Battle</h1>
          {opponentClosed && (
            <div className="text-red-400 text-sm">
              Opponent disconnected
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row justify-center items-start gap-4 sm:gap-8 mb-6">
          {renderPlayerArea(mySymbol, false)}
          {renderPlayerArea(opponentSymbol, true)}
        </div>

        <GameControls />

        {sharedGameState.status === 'playing' && !opponentClosed ? (
          <>
            <div className="text-center mb-4">
              <p className="text-sm">Use WASD or Arrow Keys to play</p>
              <p className="text-xs text-gray-400">W/↑: Rotate | A/←: Left | D/→: Right | S/↓: Soft Drop</p>
            </div>
          </>
        ) : sharedGameState.status === 'finished' ? (
          <>
            {sharedGameState.winner && (
              <div className="text-green-400 font-bold text-xl sm:text-2xl mb-4">
                Winner: {getPlayerName(sharedGameState.winner)}
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
