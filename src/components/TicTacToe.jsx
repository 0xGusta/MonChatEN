import React, { useState, useEffect, useRef } from 'react';
import { useStateTogether } from 'react-together';
import { getSyncedNow } from '../utils/timeSync.js';

const initialBoard = Array(9).fill(null);

export default function TicTacToe({ players, sessionId, myAddress, onGameEnd, onRematchOffer }) {
    const [board, setBoard] = useStateTogether(`tictactoe-board-${sessionId}`, initialBoard);
    const [xIsNext, setXIsNext] = useStateTogether(`tictactoe-xIsNext-${sessionId}`, true);
    const [status, setStatus] = useStateTogether(`tictactoe-status-${sessionId}`, 'playing');
    const [winner, setWinner] = useStateTogether(`tictactoe-winner-${sessionId}`, null);
    const [rematchStatus, setRematchStatus] = useStateTogether(`tictactoe-rematch-${sessionId}`, null);
    const [lastMoveX, setLastMoveX] = useStateTogether(`tictactoe-lastMoveX-${sessionId}`, getSyncedNow());
    const [lastMoveO, setLastMoveO] = useStateTogether(`tictactoe-lastMoveO-${sessionId}`, getSyncedNow());
    const [playerStatus, setPlayerStatus] = useStateTogether(`tictactoe-playerStatus-${sessionId}`, {
        X: 'online',
        O: 'online',
    });

    const [timeLeft, setTimeLeft] = useState(30);
    const [rematchBlocked, setRematchBlocked] = useState(false);
    const timerRef = useRef(null);

    const isMyTurn = (xIsNext && players?.challenger?.address.toLowerCase() === myAddress.toLowerCase()) ||
                     (!xIsNext && players?.opponent?.address.toLowerCase() === myAddress.toLowerCase());
    const mySymbol = players?.challenger?.address.toLowerCase() === myAddress.toLowerCase() ? 'X' : 'O';
    const opponentSymbol = mySymbol === 'X' ? 'O' : 'X';
    const opponentClosed = playerStatus[opponentSymbol] === 'closed';

    useEffect(() => {
        setPlayerStatus(prev => ({
            ...prev,
            [mySymbol]: 'online'
        }));
    }, []);

    useEffect(() => {
        clearInterval(timerRef.current);
        if (isMyTurn && !winner && status === 'playing' && !opponentClosed) {
            setTimeLeft(30);
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(timerRef.current);
                        const availableSpots = board.map((val, idx) => val === null ? idx : null).filter(val => val !== null);
                        if (availableSpots.length > 0) {
                            const randomMove = availableSpots[Math.floor(Math.random() * availableSpots.length)];
                            handleClick(randomMove);
                        }
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            setTimeLeft(30);
        }
        return () => clearInterval(timerRef.current);
    }, [isMyTurn, winner, status, board, opponentClosed]);

    useEffect(() => {
        const calculateWinner = (squares) => {
            const lines = [
                [0, 1, 2], [3, 4, 5], [6, 7, 8],
                [0, 3, 6], [1, 4, 7], [2, 5, 8],
                [0, 4, 8], [2, 4, 6],
            ];
            for (let i = 0; i < lines.length; i++) {
                const [a, b, c] = lines[i];
                if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
                    return squares[a];
                }
            }
            if (squares.every(Boolean)) return 'Draw';
            return null;
        };

        const gameResult = calculateWinner(board);
        if (gameResult && !winner) {
            setWinner(gameResult);
            setStatus(gameResult === 'Draw' ? 'draw' : 'win');
        }
    }, [board, winner]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (status !== 'playing' || winner) return;
            const opponentLast = mySymbol === 'X' ? lastMoveO : lastMoveX;
            if (getSyncedNow() - opponentLast > 35000) {
                setPlayerStatus(prev => ({
                    ...prev,
                    [opponentSymbol]: 'closed'
                }));
            }
        }, 5000);
        return () => clearInterval(interval);
    }, [lastMoveX, lastMoveO, winner, status]);

    const handleClick = (i) => {
        if (winner || board[i] || !isMyTurn || opponentClosed || (rematchStatus && rematchStatus.status === 'pending')) return;
        const newBoard = board.slice();
        newBoard[i] = xIsNext ? 'X' : 'O';
        setBoard(newBoard);
        setXIsNext(!xIsNext);
        const now = getSyncedNow();
        if (mySymbol === 'X') setLastMoveX(now);
        else setLastMoveO(now);
    };

    const renderSquare = (i) => (
        <button
            className={`square ${board[i] === 'X' ? 'text-blue-400' : 'text-red-400'}`}
            onClick={() => handleClick(i)}
            disabled={!isMyTurn || !!board[i] || !!winner || opponentClosed || (rematchStatus && rematchStatus.status === 'pending')}
        >
            {board[i]}
        </button>
    );

    const handleRematchRequest = () => {
        if (!players || opponentClosed || rematchBlocked) return;
        setRematchStatus({ by: mySymbol, status: 'pending' });
        onRematchOffer(sessionId, mySymbol, 'pending');
    };

    const handleAcceptRematch = () => {
        setBoard(initialBoard);
        setXIsNext(true);
        setWinner(null);
        setStatus('playing');
        setRematchStatus(null);
        setRematchBlocked(false);
        const now = getSyncedNow();
        setLastMoveX(now);
        setLastMoveO(now);
        setPlayerStatus(prev => ({
            ...prev,
            [mySymbol]: 'online',
            [opponentSymbol]: 'online',
        }));
        onRematchOffer(sessionId, mySymbol, 'accepted');
    };

    const handleDeclineRematch = () => {
        onRematchOffer(sessionId, mySymbol, 'declined');
        setRematchStatus(null);
        if (iAmRematchReceiver) {
            setRematchBlocked(true);
        }
    };

    const handleCloseGame = (e) => {
        if (e) e.stopPropagation();
        setPlayerStatus(prev => ({
            ...prev,
            [mySymbol]: 'closed',
        }));
        onGameEnd(sessionId, 'closed');
    };

    const getPlayerName = (symbol) => {
        if (!players) return '';
        if (symbol === 'X') return players.challenger?.username || 'Player X';
        if (symbol === 'O') return players.opponent?.username || 'Player O';
        return '';
    };

    const iAmRematchRequester = rematchStatus && rematchStatus.by === mySymbol;
    const iAmRematchReceiver = rematchStatus && rematchStatus.by === opponentSymbol;

    let displayStatus;
    if (opponentClosed) {
        displayStatus = 'Opponent left the game. You can close now.';
    } else if (winner) {
        displayStatus = winner === 'Draw' ? "It's a Draw!" : `Winner: ${getPlayerName(winner)}!`;
    } else {
        displayStatus = `Next player: ${getPlayerName(xIsNext ? 'X' : 'O')} (${isMyTurn ? 'Your turn' : "Opponent's turn"})`;
    }

    return (
        <div className="tic-tac-toe p-4 bg-gray-800 rounded-lg text-white">
            <div className="flex justify-between items-center w-full mb-2">
                <span className="text-lg font-bold">You are: {mySymbol}</span>
                <button className="close-button" onClick={handleCloseGame}>×</button>
                {isMyTurn && !winner && status === 'playing' && !opponentClosed && <span className="text-lg font-bold">Time left: {timeLeft}s</span>}
            </div>
            <div className="status text-center text-lg font-bold mb-4">{displayStatus}</div>
            <div className="board-container">
                <div className="board-row">
                    {renderSquare(0)}{renderSquare(1)}{renderSquare(2)}
                </div>
                <div className="board-row">
                    {renderSquare(3)}{renderSquare(4)}{renderSquare(5)}
                </div>
                <div className="board-row">
                    {renderSquare(6)}{renderSquare(7)}{renderSquare(8)}
                </div>
            </div>

            {(winner || opponentClosed || status === 'draw') && (
                <div className="text-center mt-4">
                    {opponentClosed ? (
                        <button onClick={handleCloseGame} className="btn btn-secondary">Close</button>
                    ) : rematchStatus?.status === 'pending' && iAmRematchReceiver ? (
                        <>
                            <p className="mb-2">{getPlayerName(opponentSymbol)} wants a rematch!</p>
                            <button onClick={handleAcceptRematch} className="btn btn-primary mr-2">Accept</button>
                            <button onClick={handleDeclineRematch} className="btn btn-secondary">Decline</button>
                        </>
                    ) : rematchStatus?.status === 'pending' && iAmRematchRequester ? (
                        <p>Waiting for {getPlayerName(opponentSymbol)} to respond...</p>
                    ) : rematchStatus?.status === 'declined' && iAmRematchRequester ? (
                        <p>{getPlayerName(opponentSymbol)} recusou o rematch. Você não pode enviar novas solicitações.</p>
                    ) : (
                        <div className="flex gap-2 justify-center">
                            <button
                                onClick={handleRematchRequest}
                                className="btn btn-primary"
                                disabled={rematchBlocked}
                            >
                                Play Again?
                            </button>
                            <button onClick={handleCloseGame} className="btn btn-secondary">Close</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
