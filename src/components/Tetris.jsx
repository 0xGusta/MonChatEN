import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useStateTogether } from 'react-together';

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

const isMobile = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

const TETROMINOS = {
    'I': { shape: [[1, 1, 1, 1]], color: '#00FFFF' },
    'J': { shape: [[1, 0, 0], [1, 1, 1]], color: '#0000FF' },
    'L': { shape: [[0, 0, 1], [1, 1, 1]], color: '#FFA500' },
    'O': { shape: [[1, 1], [1, 1]], color: '#FFFF00' },
    'S': { shape: [[0, 1, 1], [1, 1, 0]], color: '#00FF00' },
    'T': { shape: [[0, 1, 0], [1, 1, 1]], color: '#800080' },
    'Z': { shape: [[1, 1, 0], [0, 1, 1]], color: '#FF0000' }
};

const TETROMINO_KEYS = Object.keys(TETROMINOS);

const createEmptyBoard = () => Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill([0, '#000000']));

const getRandomTetromino = (seed) => {
    const pseudoRandom = () => {
        let x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    };
    const key = TETROMINO_KEYS[Math.floor(pseudoRandom() * TETROMINO_KEYS.length)];
    return JSON.parse(JSON.stringify(TETROMINOS[key]));
};

const useGameLoop = (callback, speed) => {
    const savedCallback = useRef();
    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);
    useEffect(() => {
        function tick() {
            savedCallback.current();
        }
        if (speed !== null) {
            let id = setInterval(tick, speed);
            return () => clearInterval(id);
        }
    }, [speed]);
};

export default function Tetris({ sessionId, myAddress }) {
    const mySeed = parseInt(myAddress.slice(2, 10), 16);
    
    const [blockSize, setBlockSize] = useState(20);
    const [board, setBoard] = useState(createEmptyBoard());
    const [player, setPlayer] = useState({ pos: { x: 0, y: 0 }, tetromino: null, collided: false });
    const [nextTetromino, setNextTetromino] = useState(null);
    const [score, setScore] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [gameSpeed, setGameSpeed] = useState(1000);
    const [pieceSeed, setPieceSeed] = useState(mySeed);
    
    const [sharedState, setSharedState] = useStateTogether(`tetris-game-${sessionId}`, {});
    
    useEffect(() => {
        setSharedState(prev => ({ ...prev, [myAddress]: { board, player, score, nextTetromino, gameOver } }));
    }, [board, player, score, nextTetromino, gameOver, myAddress, setSharedState]);
    
    const opponentAddress = Object.keys(sharedState).find(addr => addr !== myAddress);
    const opponentData = opponentAddress ? sharedState[opponentAddress] : null;
    const opponentBoard = opponentData?.board || createEmptyBoard();
    const opponentPlayer = opponentData?.player;
    const opponentScore = opponentData?.score || 0;
    
    const boardCanvasRef = useRef(null);
    const nextCanvasRef = useRef(null);
    const opponentBoardCanvasRef = useRef(null);
    
    useEffect(() => {
        const handleResize = () => {
            const screenHeight = window.innerHeight;
            const screenWidth = window.innerWidth;

            const heightBasedSize = Math.floor((screenHeight * 0.40) / BOARD_HEIGHT);
            
            const widthPercentage = isMobile() ? 0.95 : 0.80;
            const widthBasedSize = Math.floor((screenWidth * widthPercentage / 2) / BOARD_WIDTH);

            setBlockSize(Math.max(8, Math.min(heightBasedSize, widthBasedSize)));
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    
    const resetPlayer = useCallback(() => {
        const newTetromino = nextTetromino || getRandomTetromino(pieceSeed);
        setPieceSeed(prev => prev + 1);
        const newNextTetromino = getRandomTetromino(pieceSeed + 1);
        setNextTetromino(newNextTetromino);
        setPlayer({
            pos: { x: Math.floor(BOARD_WIDTH / 2) - 1, y: 0 },
            tetromino: newTetromino,
            collided: false,
        });
    }, [nextTetromino, pieceSeed]);
    
    useEffect(() => {
        if (!player.tetromino) {
            resetPlayer();
        }
    }, [player.tetromino, resetPlayer]);
    
    const isColliding = (p, b, { x: moveX, y: moveY }) => {
        if (!p.tetromino) return false;
        for (let y = 0; y < p.tetromino.shape.length; y += 1) {
            for (let x = 0; x < p.tetromino.shape[y].length; x += 1) {
                if (p.tetromino.shape[y][x] !== 0) {
                    const newY = y + p.pos.y + moveY;
                    const newX = x + p.pos.x + moveX;
                    if (!b[newY] || !b[newY][newX] || b[newY][newX][0] !== 0) {
                        return true;
                    }
                }
            }
        }
        return false;
    };
    
    const rotate = (matrix) => {
        const transposed = matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
        return transposed.map(row => row.reverse());
    };
    
    const playerRotate = (board) => {
        const clonedPlayer = JSON.parse(JSON.stringify(player));
        clonedPlayer.tetromino.shape = rotate(clonedPlayer.tetromino.shape);
        const pos = clonedPlayer.pos.x;
        let offset = 1;
        while (isColliding(clonedPlayer, board, { x: 0, y: 0 })) {
            clonedPlayer.pos.x += offset;
            offset = -(offset + (offset > 0 ? 1 : -1));
            if (offset > clonedPlayer.tetromino.shape[0].length) {
                clonedPlayer.pos.x = pos;
                return;
            }
        }
        setPlayer(clonedPlayer);
    };
    
    const updatePlayerPos = ({ x, y, collided }) => {
        setPlayer(prev => ({ ...prev, pos: { x: prev.pos.x + x, y: prev.pos.y + y }, collided }));
    };
    
    const drop = useCallback(() => {
        if (!isColliding(player, board, { x: 0, y: 1 })) {
            updatePlayerPos({ x: 0, y: 1, collided: false });
        } else {
            if (player.pos.y < 1) {
                setGameOver(true);
                setGameSpeed(null);
            }
            setPlayer(prev => ({ ...prev, collided: true }));
        }
    }, [board, player]);
    
    const hardDrop = () => {
        let y = 0;
        while (!isColliding(player, board, { x: 0, y: y + 1 })) {
            y++;
        }
        updatePlayerPos({ x: 0, y, collided: true });
    };
    
    const move = (dir) => {
        if (!isColliding(player, board, { x: dir, y: 0 })) {
            updatePlayerPos({ x: dir, y: 0, collided: false });
        }
    };
    
    useEffect(() => {
        if (player.collided) {
            const newBoard = board.map(row => [...row]);
            player.tetromino.shape.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value !== 0) {
                        const boardY = y + player.pos.y;
                        const boardX = x + player.pos.x;
                        if (boardY >= 0) {
                            newBoard[boardY][boardX] = [1, player.tetromino.color];
                        }
                    }
                });
            });
            let linesCleared = 0;
            const clearedBoard = newBoard.filter(row => !row.every(cell => cell[0] !== 0));
            linesCleared = BOARD_HEIGHT - clearedBoard.length;
            if (linesCleared > 0) {
                const newLines = Array.from({ length: linesCleared }, () => Array(BOARD_WIDTH).fill([0, '#000000']));
                setBoard([...newLines, ...clearedBoard]);
                setScore(prev => prev + linesCleared * 10);
            } else {
                setBoard(newBoard);
            }
            resetPlayer();
        }
    }, [player.collided, board, player.tetromino, player.pos.x, player.pos.y, resetPlayer]);
    
    useGameLoop(() => {
        if (!gameOver) {
            drop();
        }
    }, gameSpeed);
    
    const draw = useCallback((canvas, matrix, playerPiece = null) => {
        const context = canvas.getContext('2d');
        context.fillStyle = '#0F0F23';
        context.fillRect(0, 0, canvas.width, canvas.height);
        matrix.forEach((row, y) => {
            row.forEach((cell, x) => {
                if (cell[0] !== 0) {
                    context.fillStyle = cell[1];
                    context.fillRect(x * blockSize, y * blockSize, blockSize, blockSize);
                }
            });
        });
        if (playerPiece && playerPiece.tetromino) {
            context.fillStyle = playerPiece.tetromino.color;
            playerPiece.tetromino.shape.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value !== 0) {
                        context.fillRect((playerPiece.pos.x + x) * blockSize, (playerPiece.pos.y + y) * blockSize, blockSize, blockSize);
                    }
                });
            });
        }
    }, [blockSize]);
    
    const drawNext = useCallback((canvas, tetromino) => {
        const context = canvas.getContext('2d');
        context.fillStyle = '#1A1A2E';
        context.fillRect(0, 0, canvas.width, canvas.height);
        if (tetromino) {
            context.fillStyle = tetromino.color;
            const offsetX = (canvas.width - tetromino.shape[0].length * blockSize) / 2;
            const offsetY = (canvas.height - tetromino.shape.length * blockSize) / 2;
            tetromino.shape.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value !== 0) {
                        context.fillRect(offsetX + x * blockSize, offsetY + y * blockSize, blockSize, blockSize);
                    }
                });
            });
        }
    }, [blockSize]);
    
    useEffect(() => {
        if (boardCanvasRef.current) draw(boardCanvasRef.current, board, player);
    }, [board, player, draw]);
    
    useEffect(() => {
        if (opponentBoardCanvasRef.current) draw(opponentBoardCanvasRef.current, opponentBoard, opponentPlayer);
    }, [opponentBoard, opponentPlayer, draw]);
    
    useEffect(() => {
        if (nextCanvasRef.current) drawNext(nextCanvasRef.current, nextTetromino);
    }, [nextTetromino, drawNext]);
    
    const handleKeyDown = useCallback((e) => {
        if (gameOver) return;
        const keyMap = {
            'ArrowLeft': () => move(-1), 'ArrowRight': () => move(1), 'ArrowDown': drop,
            'ArrowUp': () => playerRotate(board), ' ': hardDrop,
        };
        const action = keyMap[e.key];
        if (action) {
            e.preventDefault();
            action();
        }
    }, [gameOver, drop, playerRotate, hardDrop, board]);
    
    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);
    
    return (
        <div className="tetris-container flex flex-col items-center p-2 text-white">
            <div className="boards-container flex flex-row justify-center items-start gap-2 md:gap-4">
                <div className="game-area relative flex flex-col items-center">
                    <h3 className="text-lg mb-1">You</h3>
                    <canvas
                        ref={boardCanvasRef}
                        width={BOARD_WIDTH * blockSize}
                        height={BOARD_HEIGHT * blockSize}
                        className="border-2 border-gray-500"
                    />
                    {gameOver && <div className="game-over-text">GAME OVER</div>}
                </div>
                <div className="opponent-area flex flex-col items-center">
                    <h3 className="text-lg mb-1">Opponent</h3>
                    <canvas
                        ref={opponentBoardCanvasRef}
                        width={BOARD_WIDTH * blockSize}
                        height={BOARD_HEIGHT * blockSize}
                        className="border-2 border-gray-700"
                    />
                </div>
            </div>
            <div className="info-panel flex flex-row justify-around w-full max-w-4xl mt-2 text-sm md:text-base">
                <p>Score: {score}</p>
                <div className="flex flex-col items-center">
                    <p>Next:</p>
                    <canvas
                        ref={nextCanvasRef}
                        width={4 * blockSize}
                        height={4 * blockSize}
                        className="border border-gray-600 mt-1"
                    />
                </div>
                <p>Opponent Score: {opponentScore}</p>
            </div>
            <div className="controls-info mt-4 w-full max-w-sm">
                {isMobile() ? (
                    <div className="mobile-controls grid grid-cols-3 gap-4 p-2 bg-gray-800 rounded-xl">
                        <button className="text-2xl py-3 rounded-lg bg-gray-700 active:bg-gray-600" onClick={() => move(-1)}>◀</button>
                        <button className="text-2xl py-3 rounded-lg bg-gray-700 active:bg-gray-600" onClick={() => playerRotate(board)}>↺</button>
                        <button className="text-2xl py-3 rounded-lg bg-gray-700 active:bg-gray-600" onClick={() => move(1)}>▶</button>
                        <button className="col-span-3 text-xl py-3 rounded-lg bg-blue-700 active:bg-blue-600" onClick={drop}>▼</button>
                        <button className="col-span-3 text-xl py-3 rounded-lg bg-red-700 active:bg-red-600" onClick={hardDrop}>DROP</button>
                    </div>
                ) : (
                    <div className="pc-controls bg-gray-800 p-3 rounded-lg text-sm text-center">
                        <h4 className="font-bold mb-1">Controls:</h4>
                        <p><span className="font-bold">←/→:</span> Move | <span className="font-bold">↑:</span> Rotate | <span className="font-bold">↓:</span> Soft Drop | <span className="font-bold">Space:</span> Hard Drop</p>
                    </div>
                )}
            </div>
        </div>
    );
}
