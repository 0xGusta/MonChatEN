import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useStateTogether } from 'react-together';
import GameControls from './GameControls';

const COLS = 10;
const ROWS = 20;
const SHAPES = [
  null,
  [[1, 1, 1], [0, 1, 0]],
  [[2, 2, 2, 2]],
  [[0, 3, 3], [3, 3, 0]],
  [[4, 4, 0], [0, 4, 4]],
  [[5, 0, 0], [5, 5, 5]],
  [[0, 0, 6], [6, 6, 6]],
  [[7, 7], [7, 7]]
];
const COLORS = [null, '#FF0D72', '#0DC2FF', '#0DFF72', '#F538FF', '#FF8E0D', '#FFE138', '#3877FF'];

const createEmptyBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(0));

export default function Tetris({ players, sessionId, myAddress }) {
  const mySymbol = players?.challenger?.address.toLowerCase() === myAddress.toLowerCase() ? 'P1' : 'P2';
  const opponentSymbol = mySymbol === 'P1' ? 'P2' : 'P1';

  const [gameState, setGameState] = useStateTogether(`tetris-${sessionId}`, {
    P1: { board: createEmptyBoard(), score: 0, piece: null, pieceIndex: 0, sequence: Array.from({ length: 100 }, () => Math.floor(Math.random() * 7) + 1), gameOver: false },
    P2: { board: createEmptyBoard(), score: 0, piece: null, pieceIndex: 0, sequence: Array.from({ length: 100 }, () => Math.floor(Math.random() * 7) + 1), gameOver: false },
  });

  const blockSize = 20;
  const dropInterval = 1000;
  const dropRef = useRef(0);
  const lastTimeRef = useRef(0);
  const requestRef = useRef();
  const canvasRef = useRef();
  const opponentCanvasRef = useRef();
  const nextCanvasRef = useRef();

  const updatePiece = useCallback((modifier) => {
    setGameState(prev => {
      const player = prev[mySymbol];
      if (!player) return prev;
      const data = { ...player };
      data.piece = modifier(data.piece);
      return { ...prev, [mySymbol]: data };
    });
  }, [mySymbol, setGameState]);

  const mergePieceToBoard = (board, piece) => {
    const newBoard = board.map(row => [...row]);
    piece.shape.forEach((row, y) => {
      row.forEach((val, x) => {
        if (val !== 0) {
          const py = y + piece.pos.y;
          const px = x + piece.pos.x;
          if (py >= 0 && py < ROWS && px >= 0 && px < COLS) {
            newBoard[py][px] = val;
          }
        }
      });
    });
    return newBoard;
  };

  const checkCollision = (piece, board) => {
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x] !== 0) {
          const py = piece.pos.y + y;
          const px = piece.pos.x + x;
          if (py >= ROWS || px < 0 || px >= COLS || (py >= 0 && board[py][px] !== 0)) {
            return true;
          }
        }
      }
    }
    return false;
  };

  const sweepLines = (board) => {
    let lines = 0;
    const newBoard = board.reduce((acc, row) => {
      if (row.every(cell => cell !== 0)) {
        lines++;
        acc.unshift(Array(COLS).fill(0));
      } else {
        acc.push(row);
      }
      return acc;
    }, []);
    return [newBoard, lines];
  };

  const resetPiece = useCallback(() => {
    setGameState(prev => {
      const player = prev[mySymbol];
      if (!player) return prev;
      const data = { ...player };
      const nextShapeIndex = data.sequence[data.pieceIndex % data.sequence.length];
      const newShape = SHAPES[nextShapeIndex];
      const newPiece = {
        shape: newShape,
        pos: { x: Math.floor(COLS / 2) - Math.floor(newShape[0].length / 2), y: 0 }
      };
      if (checkCollision(newPiece, data.board)) {
        data.gameOver = true;
      } else {
        data.piece = newPiece;
        data.pieceIndex++;
      }
      return { ...prev, [mySymbol]: data };
    });
  }, [mySymbol, setGameState]);

  const drop = useCallback(() => {
    setGameState(prev => {
      const player = prev[mySymbol];
      if (!player || player.gameOver || !player.piece) return prev;
      const data = { ...player };
      const moved = { ...data.piece, pos: { ...data.piece.pos, y: data.piece.pos.y + 1 } };
      if (checkCollision(moved, data.board)) {
        const merged = mergePieceToBoard(data.board, data.piece);
        const [cleaned, lines] = sweepLines(merged);
        data.board = cleaned;
        data.score += lines * 10;
        data.piece = null;
        return { ...prev, [mySymbol]: data };
      } else {
        data.piece = moved;
        return { ...prev, [mySymbol]: data };
      }
    });
  }, [mySymbol, setGameState]);

  const move = useCallback((dir) => {
    updatePiece(piece => {
      const board = gameState[mySymbol]?.board;
      if (!board || !piece) return piece;
      const moved = { ...piece, pos: { ...piece.pos, x: piece.pos.x + dir } };
      if (!checkCollision(moved, board)) return moved;
      return piece;
    });
  }, [updatePiece, gameState, mySymbol]);

  const rotate = useCallback(() => {
    updatePiece(piece => {
      const board = gameState[mySymbol]?.board;
      if (!board || !piece) return piece;
      const rotated = piece.shape[0].map((_, i) => piece.shape.map(r => r[i])).reverse();
      const test = { ...piece, shape: rotated };
      if (!checkCollision(test, board)) return test;
      return piece;
    });
  }, [updatePiece, gameState, mySymbol]);

  useEffect(() => {
    if (!gameState[mySymbol]?.piece && !gameState[mySymbol]?.gameOver) {
      resetPiece();
    }
  }, [gameState, mySymbol, resetPiece]);

  const animate = useCallback((time = 0) => {
    const delta = time - lastTimeRef.current;
    lastTimeRef.current = time;
    dropRef.current += delta;
    if (dropRef.current > dropInterval) {
      drop();
      dropRef.current = 0;
    }
    requestRef.current = requestAnimationFrame(animate);
  }, [drop]);

  useEffect(() => {
    if (!gameState[mySymbol]?.gameOver) {
      requestRef.current = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameState, mySymbol, animate]);

  useEffect(() => {
    const handleKey = (e) => {
      if (gameState[mySymbol]?.gameOver) return;
      if (['ArrowLeft', 'a'].includes(e.key)) move(-1);
      else if (['ArrowRight', 'd'].includes(e.key)) move(1);
      else if (['ArrowUp', 'w', 'q', 'e'].includes(e.key)) rotate();
      else if (['ArrowDown', 's'].includes(e.key)) drop();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [move, drop, rotate, gameState, mySymbol]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    const ctx2 = opponentCanvasRef.current?.getContext('2d');
    const nextCtx = nextCanvasRef.current?.getContext('2d');
    if (!ctx || !ctx2) return;

    const drawBoard = (ctx, board, piece) => {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      board.forEach((row, y) => {
        row.forEach((val, x) => {
          if (val !== 0) {
            ctx.fillStyle = COLORS[val];
            ctx.fillRect(x * blockSize, y * blockSize, blockSize, blockSize);
          }
        });
      });
      if (piece) {
        piece.shape.forEach((row, y) => {
          row.forEach((val, x) => {
            if (val !== 0) {
              ctx.fillStyle = COLORS[val];
              ctx.fillRect((x + piece.pos.x) * blockSize, (y + piece.pos.y) * blockSize, blockSize, blockSize);
            }
          });
        });
      }
    };

    const me = gameState[mySymbol];
    const opp = gameState[opponentSymbol];
    if (me) drawBoard(ctx, me.board, me.piece);
    if (opp) drawBoard(ctx2, opp.board, opp.piece);

    if (nextCtx && me) {
      nextCtx.clearRect(0, 0, nextCtx.canvas.width, nextCtx.canvas.height);
      const idx = me.sequence[me.pieceIndex % 100];
      const shape = SHAPES[idx];
      shape.forEach((row, y) => {
        row.forEach((val, x) => {
          if (val !== 0) {
            nextCtx.fillStyle = COLORS[val];
            nextCtx.fillRect(x * blockSize, y * blockSize, blockSize, blockSize);
          }
        });
      });
    }
  }, [gameState, mySymbol, opponentSymbol]);

  const me = gameState[mySymbol];
  const opp = gameState[opponentSymbol];

  return (
    <div className="flex flex-col items-center">
      <div className="flex gap-4">
        <div className="flex flex-col items-center">
          <p className="text-white text-sm mb-1">You</p>
          <canvas ref={canvasRef} width={COLS * blockSize} height={ROWS * blockSize} className="bg-black border" />
          <canvas ref={nextCanvasRef} width={blockSize * 4} height={blockSize * 2.5} className="mt-2 bg-black border" />
          <p className="text-white text-xs mt-1">Score: {me?.score ?? 0}</p>
        </div>
        <div className="flex flex-col items-center">
          <p className="text-white text-sm mb-1">Opponent</p>
          <canvas ref={opponentCanvasRef} width={COLS * blockSize} height={ROWS * blockSize} className="bg-black border" />
          <p className="text-white text-xs mt-1">Score: {opp?.score ?? 0}</p>
        </div>
      </div>
      <div className="mt-4 w-full max-w-xs">
        <GameControls onMove={move} onRotate={rotate} onDrop={drop} />
      </div>
      {me?.gameOver && <p className="text-red-500 text-xl mt-4">Game Over</p>}
    </div>
  );
}
