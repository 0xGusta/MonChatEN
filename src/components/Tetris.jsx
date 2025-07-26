import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useStateTogether } from 'react-together';

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

const isMobile = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const BLOCK_SIZE = isMobile() ? 12 : 20;

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
    useEffect(() => { savedCallback.current = callback; }, [callback]);
    useEffect(() => {
        function tick() { savedCallback.current(); }
        if (speed !== null) {
            let id = setInterval(tick, speed);
            return () => clearInterval(id);
        }
    }, [speed]);
};

const GameResultDisplay = ({ message, onExit }) => {
    return (
        <div className="game-over-overlay">
            <div className="game-over-box">
                <h2>Game Over</h2>
                <p>{message}</p>
                <button onClick={onExit} className="btn btn-primary mt-4">Exit</button>
            </div>
        </div>
    );
};


export default function Tetris({ players, sessionId, myAddress, onGameEnd }) {
    const mySeed = parseInt(myAddress.slice(2, 10), 16);

    const mySymbol = players?.challenger?.address.toLowerCase() === myAddress.toLowerCase() ? 'P1' : 'P2';
    const opponentSymbol = mySymbol === 'P1' ? 'P2' : 'P1';
    
    const [playerStatus, setPlayerStatus] = useStateTogether(`tetris-playerStatus-${sessionId}`, { P1: 'online', P2: 'online' });
    const [sharedState, setSharedState] = useStateTogether(`tetris-players-${sessionId}`, {});

    const opponentClosed = playerStatus[opponentSymbol] === 'closed';
    const opponentGameOver = playerStatus[opponentSymbol] === 'gameOver';
    const iLost = playerStatus[mySymbol] === 'gameOver';

    const [board, setBoard] = useState(createEmptyBoard());
    const [player, setPlayer] = useState({ pos: { x: 0, y: 0 }, tetromino: null, collided: false });
    const [nextTetromino, setNextTetromino] = useState(null);
    const [score, setScore] = useState(0);
    const [gameSpeed, setGameSpeed] = useState(1000);
    const [pieceSeed, setPieceSeed] = useState(mySeed);

    const opponentData = sharedState[opponentSymbol];
    const opponentBoard = opponentData?.board || createEmptyBoard();
    const opponentPlayer = opponentData?.player;
    const opponentScore = opponentData?.score ?? 0;

    const boardCanvasRef = useRef(null);
    const nextCanvasRef = useRef(null);
    const opponentBoardCanvasRef = useRef(null);
    
    const handleCloseGame = useCallback(() => {
        setPlayerStatus(prev => ({ ...prev, [mySymbol]: 'closed' }));
        onGameEnd(sessionId, 'closed');
    }, [mySymbol, onGameEnd, sessionId, setPlayerStatus]);


    useEffect(() => {
        setSharedState(prev => ({ ...prev, [mySymbol]: { board, player, score } }));
    }, [board, player, score, mySymbol, setSharedState]);


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
    
    const setMyGameOver = useCallback(() => {
        setGameSpeed(null);
        setPlayerStatus(prev => ({ ...prev, [mySymbol]: 'gameOver' }));
    }, [mySymbol, setPlayerStatus]);
    
    useEffect(() => {
        if (opponentClosed || opponentGameOver) {
            setGameSpeed(null);
        }
    }, [opponentClosed, opponentGameOver]);


    useEffect(() => {
        if (!player.tetromino && playerStatus[mySymbol] === 'online') {
            resetPlayer();
        }
    }, [player.tetromino, resetPlayer, playerStatus, mySymbol]);

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
    
    const drop = useCallback(() => {
        if (!isColliding(player, board, { x: 0, y: 1 })) {
            setPlayer(prev => ({ ...prev, pos: { ...prev.pos, y: prev.pos.y + 1 }}));
        } else {
            if (player.pos.y < 1) setMyGameOver();
            setPlayer(prev => ({ ...prev, collided: true }));
        }
    }, [board, player, setMyGameOver]);

    const rotate = (matrix) => {
        const transposed = matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
        return transposed.map(row => row.reverse());
    };

    const playerRotate = (board) => {
        if (iLost || opponentClosed || opponentGameOver) return;
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

    const hardDrop = () => {
        if (iLost || opponentClosed || opponentGameOver) return;
        let y = 0;
        while (!isColliding(player, board, { x: 0, y: y + 1 })) { y++; }
        setPlayer(prev => ({ ...prev, pos: { ...prev.pos, y: prev.pos.y + y }, collided: true }));
    };

    const move = (dir) => {
        if (iLost || opponentClosed || opponentGameOver) return;
        if (!isColliding(player, board, { x: dir, y: 0 })) {
            setPlayer(prev => ({...prev, pos: {...prev.pos, x: prev.pos.x + dir}}));
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
                        if (boardY >= 0) newBoard[boardY][boardX] = [1, player.tetromino.color];
                    }
                });
            });
            const clearedBoard = newBoard.filter(row => !row.every(cell => cell[0] !== 0));
            const linesCleared = BOARD_HEIGHT - clearedBoard.length;
            if (linesCleared > 0) {
                const newLines = Array.from({ length: linesCleared }, () => Array(BOARD_WIDTH).fill([0, '#000000']));
                setBoard([...newLines, ...clearedBoard]);
                setScore(prev => prev + linesCleared * 10);
            } else {
                setBoard(newBoard);
            }
            resetPlayer();
        }
    }, [player.collided, board, player.tetromino, player.pos, resetPlayer]);

    useGameLoop(() => {
        if (!iLost && !opponentClosed && !opponentGameOver) {
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
                    context.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                }
            });
        });
        if (playerPiece && playerPiece.tetromino) {
            context.fillStyle = playerPiece.tetromino.color;
            playerPiece.tetromino.shape.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value !== 0) {
                        context.fillRect((playerPiece.pos.x + x) * BLOCK_SIZE, (playerPiece.pos.y + y) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                    }
                });
            });
        }
    }, []);

    const drawNext = useCallback((canvas, tetromino) => {
        const context = canvas.getContext('2d');
        context.fillStyle = '#1A1A2E';
        context.fillRect(0, 0, canvas.width, canvas.height);
        if (tetromino) {
            context.fillStyle = tetromino.color;
            tetromino.shape.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value !== 0) {
                        const offsetX = (canvas.width - tetromino.shape[0].length * BLOCK_SIZE) / 2;
                        const offsetY = (canvas.height - tetromino.shape.length * BLOCK_SIZE) / 2;
                        context.fillRect(offsetX + x * BLOCK_SIZE, offsetY + y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                    }
                });
            });
        }
    }, []);

    useEffect(() => { if (boardCanvasRef.current) draw(boardCanvasRef.current, board, player); }, [board, player, draw]);
    useEffect(() => { if (opponentBoardCanvasRef.current) draw(opponentBoardCanvasRef.current, opponentBoard, opponentPlayer); }, [opponentBoard, opponentPlayer, draw]);
    useEffect(() => { if (nextCanvasRef.current) drawNext(nextCanvasRef.current, nextTetromino); }, [nextTetromino, drawNext]);

    const handleKeyDown = useCallback((e) => {
        if (iLost || opponentClosed || opponentGameOver) return;
        const keyMap = { 'ArrowLeft': () => move(-1), 'ArrowRight': () => move(1), 'ArrowDown': drop, 'ArrowUp': () => playerRotate(board), ' ': hardDrop };
        if (keyMap[e.key]) { e.preventDefault(); keyMap[e.key](); }
    }, [iLost, opponentClosed, opponentGameOver, move, drop, playerRotate, hardDrop, board]);
    
    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    let finalMessage = null;
    if (opponentClosed) {
        finalMessage = "Opponent has left the game.";
    } else if (iLost && opponentGameOver) {
        finalMessage = score > opponentScore ? "You Win!" : (opponentScore > score ? "Opponent Wins!" : "It's a Draw!");
    } else if (iLost) {
        finalMessage = "Opponent Wins!";
    } else if (opponentGameOver) {
        finalMessage = "You Win!";
    }
    
    return (
        <div className="tetris-container flex flex-col items-center p-2 text-white relative">
            {finalMessage && <GameResultDisplay message={finalMessage} onExit={handleCloseGame} />}
            <button onClick={handleCloseGame} className="absolute top-2 right-2 btn-sm btn-circle z-20">✕</button>

            <div className="boards-container flex flex-row justify-center items-start gap-2 md:gap-4">
                <div className="game-area relative flex flex-col items-center">
                    <h3 className="text-lg mb-1">You</h3>
                    <canvas ref={boardCanvasRef} width={BOARD_WIDTH * BLOCK_SIZE} height={BOARD_HEIGHT * BLOCK_SIZE} className="border-2 border-gray-500" />
                </div>
                <div className="opponent-area flex flex-col items-center">
                    <h3 className="text-lg mb-1">Opponent</h3>
                    <canvas ref={opponentBoardCanvasRef} width={BOARD_WIDTH * BLOCK_SIZE} height={BOARD_HEIGHT * BLOCK_SIZE} className="border-2 border-gray-700" />
                </div>
            </div>

            <div className="info-panel flex flex-row justify-around w-full max-w-lg mt-2 text-sm md:text-base">
                <p>Score: {score}</p>
                <div className="flex flex-col items-center">
                    <p>Next:</p>
                    <canvas ref={nextCanvasRef} width={4 * BLOCK_SIZE} height={4 * BLOCK_SIZE} className="border border-gray-600 mt-1" />
                </div>
                <p>Opponent Score: {opponentScore}</p>
            </div>

            <div className="controls-info mt-4">
                 {isMobile() ? (
                    <div className="mobile-controls grid grid-cols-3 gap-2 p-2 bg-gray-800 rounded-lg">
                        <button className="btn-control" onClick={() => move(-1)}>◀</button>
                        <button className="btn-control" onClick={() => move(1)}>▶</button>
                        <button className="btn-control" onClick={() => playerRotate(board)}>↺</button>
                        <button className="btn-control col-span-3" onClick={hardDrop}>DROP</button>
                        <button className="btn-control col-span-3" onClick={drop}>▼</button>
                    </div>
                ) : (
                    <div className="pc-controls bg-gray-800 p-3 rounded-lg text-sm">
                        <h4 className="font-bold mb-1">Controls:</h4>
                        <p><span className="font-bold">←/→:</span> Move | <span className="font-bold">↑:</span> Rotate | <span className="font-bold">↓:</span> Soft Drop | <span className="font-bold">Space:</span> Hard Drop</p>
                    </div>
                )}
            </div>
        </div>
    );
}
