import React, { useState, useEffect, useRef } from 'react';
import { useStateTogether } from 'react-together';

const initialBoard = Array(9).fill(null);

export default function TicTacToe({ players, sessionId, myAddress, onGameEnd, onRematchOffer }) {

    const [board, setBoard] = useStateTogether(`tictactoe-board-${sessionId}`, initialBoard);
    const [xIsNext, setXIsNext] = useStateTogether(`tictactoe-xIsNext-${sessionId}`, true);
    const [status, setStatus] = useStateTogether(`tictactoe-status-${sessionId}`, 'playing');
    const [winner, setWinner] = useStateTogether(`tictactoe-winner-${sessionId}`, null);
    const [rematchStatus, setRematchStatus] = useStateTogether(`tictactoe-rematch-${sessionId}`, null);
    const [lastMoveTimestamp, setLastMoveTimestamp] = useStateTogether(`tictactoe-lastMove-${sessionId}`, Date.now());

    const [timeLeft, setTimeLeft] = useState(30);
    const timerRef = useRef(null);

    const isMyTurn = (xIsNext && players?.challenger?.address.toLowerCase() === myAddress.toLowerCase()) ||
                     (!xIsNext && players?.opponent?.address.toLowerCase() === myAddress.toLowerCase());
    const mySymbol = players?.challenger?.address.toLowerCase() === myAddress.toLowerCase() ? 'X' : 'O';
    const opponentSymbol = mySymbol === 'X' ? 'O' : 'X';

    const getPlayerName = (symbol) => {
        if (!players) return '';
        if (symbol === 'X') return players.challenger?.username || 'Player X';
        if (symbol === 'O') return players.opponent?.username || 'Player O';
        return '';
    };
    
    useEffect(() => {
        if (isMyTurn && !winner && status === 'playing') {
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
            clearInterval(timerRef.current);
            setTimeLeft(30);
        }

        return () => clearInterval(timerRef.current);
    }, [isMyTurn, winner, status, board]);


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
        const checkOpponentActivity = setInterval(() => {
            if (status === 'playing' && Date.now() - lastMoveTimestamp > 35000) { 
                setStatus('opponent_left');
                onGameEnd(sessionId, 'opponent_left');
            }
        }, 5000);

        return () => clearInterval(checkOpponentActivity);
    }, [lastMoveTimestamp, status, sessionId, onGameEnd]);

    const handleClick = (i) => {
        if (winner || board[i] || !isMyTurn || status === 'opponent_left' || (rematchStatus && rematchStatus.status === 'pending')) {
            return;
        }
        const newBoard = board.slice();
        newBoard[i] = xIsNext ? 'X' : 'O';
        setBoard(newBoard);
        setXIsNext(!xIsNext);
        setLastMoveTimestamp(Date.now());
    };

    const renderSquare = (i) => (
        <button
            className={`square ${board[i] === 'X' ? 'text-blue-400' : 'text-red-400'}`}
            onClick={() => handleClick(i)}
            disabled={!isMyTurn || !!board[i] || !!winner || status === 'opponent_left' || (rematchStatus && rematchStatus.status === 'pending')}
        >
            {board[i]}
        </button>
    );

    const handleRematchRequest = () => {
        setRematchStatus({ by: mySymbol, status: 'pending' });
        onRematchOffer(sessionId, mySymbol, 'pending');
    };

    const handleAcceptRematch = () => {
        onRematchOffer(sessionId, mySymbol, 'accepted');

        setBoard(initialBoard);
        setXIsNext(true);
        setWinner(null);
        setStatus('playing');
        setRematchStatus(null);
        setLastMoveTimestamp(Date.now());
    };

    const handleDeclineRematch = () => {
        onRematchOffer(sessionId, mySymbol, 'declined');
    };

    const handleCloseGame = () => {
        onGameEnd(sessionId, 'closed');
    };

    let displayStatus;
    if (winner) {
        displayStatus = winner === 'Draw' ? "It's a Draw!" : `Winner: ${getPlayerName(winner)}!`;
    } else if (status === 'opponent_left') {
        displayStatus = 'Opponent left the game. Game over.';
    } else {
        displayStatus = `Next player: ${getPlayerName(xIsNext ? 'X' : 'O')} (${isMyTurn ? 'Your turn' : "Opponent's turn"})`;
    }
    
    const iAmRematchRequester = rematchStatus && rematchStatus.by === mySymbol;
    const iAmRematchReceiver = rematchStatus && rematchStatus.by === opponentSymbol;

    return (
        <div className="tic-tac-toe p-4 bg-gray-800 rounded-lg text-white">
            <div className="flex justify-between items-center w-full mb-2">
                <span className="text-lg font-bold">You are: {mySymbol}</span>
                {isMyTurn && !winner && status === 'playing' && <span className="text-lg font-bold">Time left: {timeLeft}s</span>}
            </div>
            <div className="status text-center text-lg font-bold mb-4">
                {displayStatus}
            </div>
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
            {(winner || status === 'opponent_left') && (
                <div className="text-center mt-4">
                    {rematchStatus?.status === 'pending' && iAmRematchReceiver ? (
                        <>
                            <p className="mb-2">{getPlayerName(opponentSymbol)} wants a rematch!</p>
                            <button onClick={handleAcceptRematch} className="btn btn-primary mr-2">Accept</button>
                            <button onClick={handleDeclineRematch} className="btn btn-secondary">Decline</button>
                        </>
                    ) : rematchStatus?.status === 'pending' && iAmRematchRequester ? (
                        <p>Waiting for {getPlayerName(opponentSymbol)} to respond...</p>
                    ) : (
                        <div className="flex gap-2 justify-center">
                            <button onClick={handleRematchRequest} className="btn btn-primary" disabled={status === 'opponent_left'}>Play Again?</button>
                            <button onClick={handleCloseGame} className="btn btn-secondary">Close</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
