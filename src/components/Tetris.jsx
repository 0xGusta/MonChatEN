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
  const [isDropping, setIsDropping] = useState(false);
  const [blockSize, setBlockSize] = useState(20);
  const dropTime = 1000;

  const gameAreaRef = useRef(null);
  const opponentAreaRef = useRef(null);
  const nextPieceCanvasRef = useRef(null);
  const requestRef = useRef();
  const lastTimeRef = useRef(0);
  const dropCounterRef = useRef(0);
  const gameLoopTimeoutRef = useRef();

  const opponentClosed = playerStatus?.[opponentSymbol] === 'closed';
  const pieceSequence = gameState?.[`${mySymbol}_pieceSequence`];

  const checkCollision = useCallback((playerPiece, board) => {
    if (!playerPiece.shape || !board) return true;
    const { shape, pos } = playerPiece;
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x] !== 0) {
          const boardY = y + pos.y;
          const boardX = x + pos.x;
          if (
            boardY >= ROWS ||
            boardX < 0 ||
            boardX >= COLS ||
            !board[boardY] ||
            board[boardY][boardX] !== 0
          ) {
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
      const newPlayer = {
        pos: { x: Math.floor(COLS / 2) - Math.floor(newShape[0].length / 2), y: 0 },
        shape: newShape,
        collided: false,
      };

      if (checkCollision(newPlayer, gameState[mySymbol].board)) {
        setGameState(prev => ({
          ...prev,
          status: 'finished',
          winner: opponentSymbol,
          [mySymbol]: { ...prev[mySymbol], gameOver: true },
        }));
      } else {
        setPlayer(newPlayer);
      }
      setPieceIndex(prev => prev + 1);
    }
  }, [pieceIndex, pieceSequence, gameState, mySymbol, opponentSymbol, checkCollision, setGameState]);

  useEffect(() => {
    if (player.collided) {
        const newBoard = gameState[mySymbol].board.map(row => [...row]);
        player.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    newBoard[y + player.pos.y][x + player.pos.x] = value;
                }
            });
        });

        let linesCleared = 0;
        const sweptBoard = newBoard.reduce((acc, row) => {
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
            if (garbageToSend > 0 && !prev[opponentSymbol].gameOver) {
                newOpponentBoard = prev[opponentSymbol].board.slice(garbageToSend);
                for (let i = 0; i < garbageToSend; i++) {
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

        gameLoopTimeoutRef.current = setTimeout(() => {
            resetPlayer();
        }, linesCleared > 0 ? 300 : 50);

        return () => clearTimeout(gameLoopTimeoutRef.current);
    }
  }, [player.collided, gameState, mySymbol, opponentSymbol, setGameState, resetPlayer]);

  const dropPlayer = useCallback(() => {
    if (player.collided) return;
    const board = gameState?.[mySymbol]?.board;
    if (!checkCollision({ ...player, pos: { x: player.pos.x, y: player.pos.y + 1 } }, board)) {
      setPlayer(prev => ({ ...prev, pos: { ...prev.pos, y: prev.pos.y + 1 } }));
    } else {
      setPlayer(prev => ({ ...prev, collided: true }));
    }
  }, [player, gameState, mySymbol, checkCollision]);


  const movePlayer = useCallback((dir) => {
    if (player.collided) return;
    const board = gameState?.[mySymbol]?.board;
    if (!checkCollision({ ...player, pos: { x: player.pos.x + dir, y: player.pos.y } }, board)) {
      setPlayer(prev => ({ ...prev, pos: { ...prev.pos, x: prev.pos.x + dir } }));
    }
  }, [player, gameState, mySymbol, checkCollision]);

  const playerRotate = useCallback((dir) => {
    if (player.collided) return;
    const clonedPlayer = JSON.parse(JSON.stringify(player));
    const rotate = (matrix) => {
      const transposed = matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
      return dir > 0 ? transposed.map(row => row.reverse()) : transposed.reverse();
    };
    clonedPlayer.shape = rotate(clonedPlayer.shape);
    const board = gameState?.[mySymbol]?.board;
    let offset = 1;
    while (checkCollision(clonedPlayer, board)) {
      clonedPlayer.pos.x += offset;
      offset = -(offset + (offset > 0 ? 1 : -1));
      if (Math.abs(offset) > clonedPlayer.shape[0].length + 1) return;
    }
    setPlayer(clonedPlayer);
  }, [player, gameState, mySymbol, checkCollision]);
  
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
    if (gameState?.status === 'playing' && !gameState?.[mySymbol]?.gameOver && !player.collided) {
        requestRef.current = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameState, mySymbol, animate, player.collided]);

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
                }
            });
        });
        if (currentPlayer?.shape && !currentPlayer.collided) {
            currentPlayer.shape.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value !== 0) {
                        const px = (currentPlayer.pos.x + x) * currentBlockSize;
                        const py = (currentPlayer.pos.y + y) * currentBlockSize;
                        ctx.fillStyle = COLORS[value];
                        ctx.fillRect(px, py, currentBlockSize, currentBlockSize);
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
        drawNextPiece(nextPieceCanvasRef.current, nextShape, blockSize);
    }
  }, [gameState, player, mySymbol, opponentSymbol, pieceIndex, blockSize]);

  useEffect(() => {
    setPlayerStatus(prev => ({ ...prev, [mySymbol]: 'online' }));
    const handleUnload = () => setPlayerStatus(prev => ({ ...prev, [mySymbol]: 'closed' }));
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [mySymbol, setPlayerStatus]);
  
  useEffect(() => {
    const calculateBlockSize = () => {
      const container = gameAreaRef.current?.parentElement;
      if(container) setBlockSize(container.offsetWidth / COLS);
    };
    calculateBlockSize();
    window.addEventListener('resize', calculateBlockSize);
    return () => window.removeEventListener('resize', calculateBlockSize);
  }, []);
  
  useEffect(() => {
    setPlayer(prev => ({...prev, collided: false}));
    resetPlayer();
  }, [sessionId]);
  const handleKeyDown = useCallback((e) => {
    if (player.collided || gameState?.status === 'finished' || opponentClosed) return;
    const key = e.key.toLowerCase();
    if (['a', 'arrowleft'].includes(key)) movePlayer(-1);
    else if (['d', 'arrowright'].includes(key)) movePlayer(1);
    else if (['s', 'arrowdown'].includes(key)) {
        if (!isDropping) {
            dropPlayer();
            setIsDropping(true);
        }
    }
    else if (['w', 'arrowup', 'e'].includes(key)) playerRotate(1);
    else if (key === 'q') playerRotate(-1);
  }, [player, gameState, opponentClosed, isDropping, movePlayer, dropPlayer, playerRotate]);
  const handleKeyUp = useCallback((e) => {
    const key = e.key.toLowerCase();
    if (['s', 'arrowdown'].includes(key)) setIsDropping(false);
  }, []);
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  const handleRematchRequest = () => onRematchOffer(sessionId, mySymbol, 'pending');
  const handleAcceptRematch = () => {
    onRematchOffer(sessionId, mySymbol, 'accepted');
    setRematchStatus(null);
  };
  const handleDeclineRematch = () => onRematchOffer(sessionId, mySymbol, 'declined');
  const getPlayerName = (symbol) => (players && symbol === 'P1' ? players.challenger?.username : players.opponent?.username) || 'Player';
  const iAmRematchRequester = rematchStatus?.by === mySymbol;
  const iAmRematchReceiver = rematchStatus?.by === opponentSymbol;

  return (
    <div className="flex flex-col items-center max-h-[90vh] overflow-y-auto">
        <div className="flex flex-row justify-center items-start gap-x-2 w-full px-1">
            <div className="text-center">
                <h3 className="font-bold text-base mb-1">{getPlayerName(mySymbol)} (You)</h3>
                <div className="w-[40vw] max-w-[200px]">
                    <canvas ref={gameAreaRef} width={COLS * blockSize} height={ROWS * blockSize} className="w-full h-auto border-2 bg-darkCard border-monad"/>
                </div>
                <div className="flex justify-around items-center w-full mt-2">
                    <div className="text-white text-sm">Score: {gameState?.[mySymbol]?.score}</div>
                    <div className="flex flex-col items-center">
                        <h4 className="text-xs font-semibold">Next</h4>
                        <canvas ref={nextPieceCanvasRef} width={blockSize * 4} height={blockSize * 2.5} className="border border-gray-400 bg-darkCard"/>
                    </div>
                </div>
                {gameState?.[mySymbol]?.gameOver && <div className="text-red-500 font-bold text-2xl mt-1">GAME OVER</div>}
            </div>
            <div className="text-center">
                <h3 className="font-bold text-base mb-1">{getPlayerName(opponentSymbol)}</h3>
                <div className="w-[40vw] max-w-[200px]">
                    <canvas ref={opponentAreaRef} width={COLS * blockSize} height={ROWS * blockSize} className="w-full h-auto border-2 bg-darkCard border-gray-600"/>
                </div>
                <div className="flex justify-around items-center w-full mt-2">
                    <div className="text-white text-sm">Score: {gameState?.[opponentSymbol]?.score}</div>
                </div>
                {gameState?.[opponentSymbol]?.gameOver && <div className="text-red-500 font-bold text-2xl mt-1">GAME OVER</div>}
            </div>
        </div>

        <div className="mt-4 text-center">
            {opponentClosed ? (
                <>
                    <p className="mb-2 text-lg font-semibold">The opponent has left the game.</p>
                    <button onClick={onCloseGame} className="btn btn-secondary">Close</button>
                </>
            ) : gameState?.status === 'finished' ? (
                <>
                    {gameState.winner && <div className="text-green-400 font-bold text-2xl mb-4">Winner: {getPlayerName(gameState.winner)}</div>}
                    {rematchStatus?.status === 'pending' ? (
                        iAmRematchReceiver ? (
                            <>
                                <p className="mb-2">{getPlayerName(opponentSymbol)} wants a rematch!</p>
                                <button onClick={handleAcceptRematch} className="btn btn-primary mr-2">Accept</button>
                                <button onClick={handleDeclineRematch} className="btn btn-secondary">Decline</button>
                            </>
                        ) : (<p>Waiting for {getPlayerName(opponentSymbol)} to respond...</p>)
                    ) : (
                        <div className="flex gap-2 justify-center">
                            <button onClick={handleRematchRequest} className="btn btn-primary">Play Again?</button>
                            <button onClick={onCloseGame} className="btn btn-secondary">Close</button>
                        </div>
                    )}
                </>
            ) : (
                <div className="hidden md:flex flex-col items-center mt-4 w-full max-w-xs text-white text-sm">
                    <p className="mb-2 font-semibold">Controls:</p>
                    <p>← / A : Move Left | → / D : Move Right</p>
                    <p>↑, W, E, Q : Rotate | ↓ / S : Soft Drop</p>
                </div>
            )}
        </div>
    </div>
  );
}
