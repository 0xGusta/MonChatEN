import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useStateTogether } from 'react-together';

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const BLOCK_SIZE = 20;

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
    return TETROMINOS[key];
};

const isMobile = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

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

    const [board, setBoard] = useState(createEmptyBoard());
    const [player, setPlayer] = useState({
        pos: { x: 0, y: 0 },
        tetromino: null,
        collided: false,
    });
    const [nextTetromino, setNextTetromino] = useState(null);
    const [score, setScore] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [gameSpeed, setGameSpeed] = useState(1000);
    const [pieceSeed, setPieceSeed] = useState(mySeed);

    const [opponentBoard, setOpponentBoard] = useStateTogether(`tetris-board-${sessionId}`, createEmptyBoard());
    const [opponentPlayer, setOpponentPlayer] = useStateTogether(`tetris-player-${sessionId}`, { pos: { x: 0, y: 0 }, tetromino: null });
    const [opponentScore, setOpponentScore] = useStateTogether(`tetris-score-${sessionId}`, 0);

    const boardCanvasRef = useRef(null);
    const nextCanvasRef = useRef(null);
    const opponentBoardCanvasRef = useRef(null);

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
        if (!nextTetromino) {
            resetPlayer();
        }
    }, [nextTetromino, resetPlayer]);

    const isColliding = (player, board, { x: moveX, y: moveY }) => {
        if (!player.tetromino) return false;
        for (let y = 0; y < player.tetromino.shape.length; y += 1) {
            for (let x = 0; x < player.tetromino.shape[y].length; x += 1) {
                if (player.tetromino.shape[y][x] !== 0) {
                    const newY = y + player.pos.y + moveY;
                    const newX = x + player.pos.x + moveX;
                    if (
                        !board[newY] ||
                        !board[newY][newX] ||
                        board[newY][newX][0] !== 0
                    ) {
                        return true;
                    }
                }
            }
        }
        return false;
    };

    const rotate = (matrix) => {
        const rotated = matrix.map((_, index) => matrix.map(col => col[index]));
        return rotated.map(row => row.reverse());
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
        setPlayer(prev => ({
            ...prev,
            pos: { x: (prev.pos.x + x), y: (prev.pos.y + y) },
            collided,
        }));
    };

    const drop = () => {
        if (!isColliding(player, board, { x: 0, y: 1 })) {
            updatePlayerPos({ x: 0, y: 1, collided: false });
        } else {
            if (player.pos.y < 1) {
                setGameOver(true);
                setGameSpeed(null);
            }
            setPlayer(prev => ({ ...prev, collided: true }));
        }
    };
    
    const hardDrop = () => {
        let newY = player.pos.y;
        while (!isColliding(player, board, { x: 0, y: newY - player.pos.y + 1 })) {
            newY++;
        }
        setPlayer(prev => ({ ...prev, pos: { ...prev.pos, y: newY }, collided: true }));
    };

    const move = (dir) => {
        if (!isColliding(player, board, { x: dir, y: 0 })) {
            updatePlayerPos({ x: dir, y: 0, collided: false });
        }
    };

    const handleKeyDown = (e) => {
        if (gameOver) return;
        if (e.key === 'ArrowLeft') move(-1);
        else if (e.key === 'ArrowRight') move(1);
        else if (e.key === 'ArrowDown') drop();
        else if (e.key === 'ArrowUp') playerRotate(board);
        else if (e.key === ' ') hardDrop();
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
            for (let y = newBoard.length - 1; y >= 0; y--) {
                if (newBoard[y].every(cell => cell[0] !== 0)) {
                    linesCleared++;
                    newBoard.splice(y, 1);
                }
            }
            if (linesCleared > 0) {
                const newLines = Array.from({ length: linesCleared }, () => Array(BOARD_WIDTH).fill([0, '#000000']));
                newBoard.unshift(...newLines);
                setScore(prev => prev + linesCleared * 10);
            }

            setBoard(newBoard);
            resetPlayer();
        }
    }, [player.collided]);
    
    useGameLoop(() => {
        if (!gameOver) {
            drop();
        }
    }, gameSpeed);
    
    useEffect(() => {
        setOpponentBoard(board);
        setOpponentPlayer(player);
        setOpponentScore(score);
    }, [board, player, score]);

    const draw = (canvas, matrix, playerPiece = null) => {
        const context = canvas.getContext('2d');
        context.fillStyle = '#0F0F23';
        context.fillRect(0, 0, canvas.width, canvas.height);

        matrix.forEach((row, y) => {
            row.forEach((cell, x) => {
                if (cell[0] !== 0) {
                    context.fillStyle = cell[1];
                    context.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                }
            });
        });

        if (playerPiece && playerPiece.tetromino) {
            context.fillStyle = playerPiece.tetromino.color;
            playerPiece.tetromino.shape.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value !== 0) {
                        context.fillRect(
                            (playerPiece.pos.x + x) * BLOCK_SIZE,
                            (playerPiece.pos.y + y) * BLOCK_SIZE,
                            BLOCK_SIZE, BLOCK_SIZE
                        );
                    }
                });
            });
        }
    };

    const drawNext = (canvas, tetromino) => {
        if (!tetromino) return;
        const context = canvas.getContext('2d');
        context.fillStyle = '#1A1A2E';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = tetromino.color;
        tetromino.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    context.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                }
            });
        });
    };

    useEffect(() => {
        if (boardCanvasRef.current) {
            draw(boardCanvasRef.current, board, player);
        }
    }, [board, player]);

    useEffect(() => {
        if (opponentBoardCanvasRef.current) {
            draw(opponentBoardCanvasRef.current, opponentBoard, opponentPlayer);
        }
    }, [opponentBoard, opponentPlayer]);

    useEffect(() => {
        if (nextCanvasRef.current && nextTetromino) {
            drawNext(nextCanvasRef.current, nextTetromino);
        }
    }, [nextTetromino]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [gameOver, board, player]);
    
    return (
        <div className="tetris-container flex-col md:flex-row p-4">
            <div className="game-area relative">
                <canvas
                    ref={boardCanvasRef}
                    width={BOARD_WIDTH * BLOCK_SIZE}
                    height={BOARD_HEIGHT * BLOCK_SIZE}
                ></canvas>
                {gameOver && <div className="game-over-text">GAME OVER</div>}
                <div className="game-info mt-2">
                    <p>Score: {score}</p>
                    <div className="mt-2">
                        <p>Next:</p>
                        <canvas
                            ref={nextCanvasRef}
                            width={4 * BLOCK_SIZE}
                            height={4 * BLOCK_SIZE}
                            className="border border-gray-600 mt-1"
                        ></canvas>
                    </div>
                </div>
            </div>
            <div className="opponent-area">
                <h3 className="text-center text-lg mb-2">Opponent</h3>
                <canvas
                    ref={opponentBoardCanvasRef}
                    width={BOARD_WIDTH * BLOCK_SIZE}
                    height={BOARD_HEIGHT * BLOCK_SIZE}
                ></canvas>
                <div className="game-info mt-2">
                    <p>Opponent Score: {opponentScore}</p>
                </div>
            </div>
            <div className="controls-info mt-4 w-full md:w-auto">
                {isMobile() ? (
                    <div className="mobile-controls grid grid-cols-3 gap-2 p-4 bg-gray-800 rounded-lg">
                        <div className="col-span-1 flex flex-col items-center">
                            <button className="btn btn-secondary p-4" onClick={() => move(-1)}><i className="fas fa-arrow-left"></i></button>
                        </div>
                        <div className="col-span-1 flex flex-col items-center gap-2">
                            <button className="btn btn-secondary p-4" onClick={() => playerRotate(board)}><i className="fas fa-redo"></i></button>
                            <button className="btn btn-secondary p-4" onClick={() => drop()}><i className="fas fa-arrow-down"></i></button>
                        </div>
                        <div className="col-span-1 flex flex-col items-center">
                             <button className="btn btn-secondary p-4" onClick={() => move(1)}><i className="fas fa-arrow-right"></i></button>
                        </div>
                        <div className="col-span-3 mt-2">
                             <button className="btn btn-secondary p-4 w-full" onClick={hardDrop}><i className="fas fa-angle-double-down"></i> Hard Drop</button>
                        </div>
                    </div>
                ) : (
                    <div className="pc-controls bg-gray-800 p-4 rounded-lg">
                        <h4 className="font-bold mb-2">Controls:</h4>
                        <ul>
                            <li><span className="font-bold">Left/Right Arrows:</span> Move</li>
                            <li><span className="font-bold">Up Arrow:</span> Rotate</li>
                            <li><span className="font-bold">Down Arrow:</span> Soft Drop</li>
                            <li><span className="font-bold">Spacebar:</span> Hard Drop</li>
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
