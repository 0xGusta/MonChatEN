import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStateTogether } from 'react-together';
import { getRandomTetromino, checkCollision, rotate, createBoard, BOARD_WIDTH, BOARD_HEIGHT } from '../utils/tetrisHelpers';
import { getSyncedNow } from '../utils/timeSync';

const GAME_TICK_INTERVAL = 500;
const SPEED_INCREASE_INTERVAL = 30000;

const Cell = ({ value }) => {
    const colorMap = {
        0: 'bg-gray-800',
        1: 'bg-cyan-500', 
        2: 'bg-blue-500', 
        3: 'bg-orange-500', 
        4: 'bg-yellow-500', 
        5: 'bg-green-500', 
        6: 'bg-purple-500', 
        7: 'bg-red-500', 
    };
    const bgColor = value === 0 ? 'bg-gray-800' : (value === 1 ? 'bg-monad' : 'bg-gray-600');
    return <div className={`w-5 h-5 border border-gray-700 ${bgColor}`} />;
};

export default function GameModal({ isOpen, onClose, gameType, opponentAddress, opponentUsername, currentUserAddress, currentUsername, gameSessionId }) {
    if (!isOpen) return null;

    const [myGameState, setMyGameState] = useStateTogether(`game-${gameSessionId}-${currentUserAddress}`, () => ({
        board: createBoard(),
        currentPiece: getRandomTetromino(),
        nextPiece: getRandomTetromino(),
        score: 0,
        gameOver: false,
        lastTickTime: getSyncedNow(),
        lastSpeedIncreaseTime: getSyncedNow(),
        currentTickInterval: GAME_TICK_INTERVAL,
        linesCleared: 0
    }));

    const [opponentGameState] = useStateTogether(`game-${gameSessionId}-${opponentAddress}`, {
        board: createBoard(),
        currentPiece: null,
        nextPiece: null,
        score: 0,
        gameOver: false,
        lastTickTime: 0,
        lastSpeedIncreaseTime: 0,
        currentTickInterval: GAME_TICK_INTERVAL,
        linesCleared: 0
    });

    const gameLoopRef = useRef(null);
    const lastTimeRef = useRef(0);

    const updatePiecePosition = useCallback((x, y) => { 
        setMyGameState(prev => {
            if (prev.gameOver) return prev;

            let newPiece = { ...prev.currentPiece, pos: { x: prev.currentPiece.pos.x + x, y: prev.currentPiece.pos.y + y } };
            let newBoard = prev.board;
            let newScore = prev.score;
            let newLinesCleared = prev.linesCleared;
            let newCurrentPiece = prev.currentPiece;
            let newNextPiece = prev.nextPiece;
            let newGameOver = prev.gameOver;

            if (checkCollision(newPiece, newBoard, { x: 0, y: 0 })) {
                if (y > 0) {
                    const mergedBoard = mergePiece(prev.board, prev.currentPiece);
                    const { board: clearedBoard, clearedRows } = clearLines(mergedBoard);
                    
                    newBoard = clearedBoard;
                    newLinesCleared += clearedRows;
                    newScore += clearedRows * 100;
                    
                    newCurrentPiece = newNextPiece;
                    newNextPiece = getRandomTetromino();

                    if (checkCollision(newCurrentPiece, newBoard, { x: 0, y: 0 })) {
                        newGameOver = true;
                    }

                } else {
                    newPiece = prev.currentPiece;
                }
            } else {
                newCurrentPiece = newPiece;
            }

            return {
                ...prev,
                board: newBoard,
                currentPiece: newCurrentPiece,
                nextPiece: newNextPiece,
                score: newScore,
                linesCleared: newLinesCleared,
                gameOver: newGameOver
            };
        });
    }, [setMyGameState]);

    const handlePlayerMove = useCallback((event) => {
        if (myGameState.gameOver) return;

        if (event.key === 'ArrowLeft') {
            if (!checkCollision(myGameState.currentPiece, myGameState.board, { x: -1, y: 0 })) {
                setMyGameState(prev => ({ ...prev, currentPiece: { ...prev.currentPiece, pos: { ...prev.currentPiece.pos, x: prev.currentPiece.pos.x - 1 } } }));
            }
        } else if (event.key === 'ArrowRight') {
            if (!checkCollision(myGameState.currentPiece, myGameState.board, { x: 1, y: 0 })) {
                setMyGameState(prev => ({ ...prev, currentPiece: { ...prev.currentPiece.pos, x: prev.currentPiece.pos.x + 1 } })));
            }
        } else if (event.key === 'ArrowDown') {
            updatePiecePosition(0, 1);
        } else if (event.key === 'ArrowUp') {
            const rotatedPiece = { ...myGameState.currentPiece, shape: rotate(myGameState.currentPiece.shape, 1) };
            if (!checkCollision(rotatedPiece, myGameState.board, { x: 0, y: 0 })) {
                setMyGameState(prev => ({ ...prev, currentPiece: rotatedPiece }));
            }
        }
    }, [myGameState, setMyGameState, updatePiecePosition]);

    useEffect(() => {
        window.addEventListener('keydown', handlePlayerMove);
        return () => {
            window.removeEventListener('keydown', handlePlayerMove);
        };
    }, [handlePlayerMove]);

    const mergePiece = useCallback((board, piece) => {
        const newBoard = board.map(row => [...row]);
        piece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    newBoard[y + piece.pos.y][x + piece.pos.x] = 2; 
                }
            });
        });
        return newBoard;
    }, []);

    const clearLines = useCallback((board) => {
        let clearedRows = 0;
        const newBoard = board.reduce((acc, row) => {
            if (row.every(cell => cell === 2)) {
                clearedRows++;
                return acc;
            }
            acc.push(row);
            return acc;
        }, []);

        while (newBoard.length < BOARD_HEIGHT) {
            newBoard.unshift(Array(BOARD_WIDTH).fill(0));
        }
        return { board: newBoard, clearedRows };
    }, []);

    const gameTick = useCallback(() => {
        setMyGameState(prev => {
            if (prev.gameOver) return prev;

            const now = getSyncedNow();
            const timeSinceLastTick = now - prev.lastTickTime;
            const timeSinceLastSpeedIncrease = now - prev.lastSpeedIncreaseTime;
            let newTickInterval = prev.currentTickInterval;

            if (timeSinceLastSpeedIncrease >= SPEED_INCREASE_INTERVAL) {
                newTickInterval = Math.max(100, prev.currentTickInterval * 0.9);
            }

            if (timeSinceLastTick >= newTickInterval) {
                let newPiece = { ...prev.currentPiece, pos: { ...prev.currentPiece.pos, y: prev.currentPiece.pos.y + 1 } };
                let newBoard = prev.board;
                let newScore = prev.score;
                let newLinesCleared = prev.linesCleared;
                let newCurrentPiece = prev.currentPiece;
                let newNextPiece = prev.nextPiece;
                let newGameOver = prev.gameOver;

                if (checkCollision(newPiece, prev.board, { x: 0, y: 0 })) {
                    const mergedBoard = mergePiece(prev.board, prev.currentPiece);
                    const { board: clearedBoard, clearedRows } = clearLines(mergedBoard);
                    
                    newBoard = clearedBoard;
                    newLinesCleared += clearedRows;
                    newScore += clearedRows * 100;
                    
                    newCurrentPiece = newNextPiece;
                    newNextPiece = getRandomTetromino();

                    if (checkCollision(newCurrentPiece, newBoard, { x: 0, y: 0 })) {
                        newGameOver = true;
                    }
                } else {
                    newCurrentPiece = newPiece;
                }

                return {
                    ...prev,
                    board: newBoard,
                    currentPiece: newCurrentPiece,
                    nextPiece: newNextPiece,
                    score: newScore,
                    linesCleared: newLinesCleared,
                    gameOver: newGameOver,
                    lastTickTime: now,
                    lastSpeedIncreaseTime: timeSinceLastSpeedIncrease >= SPEED_INCREASE_INTERVAL ? now : prev.lastSpeedIncreaseTime,
                    currentTickInterval: newTickInterval
                };
            }
            return prev;
        });
    }, [setMyGameState, mergePiece, clearLines]);

    useEffect(() => {
        gameLoopRef.current = setInterval(gameTick, GAME_TICK_INTERVAL / 10);
        return () => clearInterval(gameLoopRef.current);
    }, [gameTick]);

    const renderBoard = (board, piece) => {
        const boardWithPiece = board.map(row => [...row]);
        if (piece) {
            piece.shape.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value !== 0) {
                        if (boardWithPiece[y + piece.pos.y] && boardWithPiece[y + piece.pos.y][x + piece.pos.x] !== undefined) {
                            boardWithPiece[y + piece.pos.y][x + piece.pos.x] = 1;
                        }
                    }
                });
            });
        }
        return (
            <div className="grid grid-cols-10 border-2 border-monad bg-gray-900">
                {boardWithPiece.map((row, y) =>
                    row.map((cell, x) => <Cell key={`${y}-${x}`} value={cell} />)
                )}
            </div>
        );
    };

    const getGameContent = () => {
        switch (gameType) {
            case 'tetris':
                return (
                    <div className="flex flex-col items-center justify-center space-y-4">
                        <h3 className="text-xl font-bold">Tetris Battle</h3>
                        <div className="flex flex-wrap justify-around w-full gap-4">
                            <div className="text-center">
                                <h4 className="text-lg font-semibold">{currentUsername}</h4>
                                <p>Score: {myGameState.score}</p>
                                {renderBoard(myGameState.board, myGameState.currentPiece)}
                                {myGameState.gameOver && <p className="text-danger font-bold text-2xl mt-4">GAME OVER!</p>}
                            </div>
                            <div className="text-center">
                                <h4 className="text-lg font-semibold">{opponentUsername}</h4>
                                <p>Score: {opponentGameState.score}</p>
                                {renderBoard(opponentGameState.board, opponentGameState.currentPiece)}
                                {opponentGameState.gameOver && <p className="text-danger font-bold text-2xl mt-4">GAME OVER!</p>}
                            </div>
                        </div>
                        <p className="text-sm text-gray-400">Use as Teclas de Seta para jogar!</p>
                    </div>
                );
            case 'placeholder':
                return (
                    <div className="text-center">
                        <h3 className="text-xl font-bold">Jogo Placeholder</h3>
                        <p className="text-gray-300 mt-2">Este jogo está em desenvolvimento. Fique ligado!</p>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <button className="close-button" onClick={onClose}>×</button>
                {getGameContent()}
                <div className="flex gap-2 justify-end mt-4">
                    <button onClick={onClose} className="btn btn-secondary">Fechar Jogo</button>
                </div>
            </div>
        </div>
    );
}
