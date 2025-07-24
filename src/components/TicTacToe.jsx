import React, { useState, useEffect } from 'react';
import { useStateTogether } from 'react-together';

const initialBoard = Array(9).fill(null);

export default function TicTacToe({ players, sessionId, myAddress, onGameEnd, onRematchOffer }) {
    const [board, setBoard] = useStateTogether(`tictactoe-board-${sessionId}`, initialBoard);
    const [xIsNext, setXIsNext] = useStateTogether(`tictactoe-xIsNext-${sessionId}`, true);
    const [status, setStatus] = useStateTogether(`tictactoe-status-${sessionId}`, null);
    const [winner, setWinner] = useStateTogether(`tictactoe-winner-${sessionId}`, null);
    const [rematchStatus, setRematchStatus] = useStateTogether(`tictactoe-rematch-${sessionId}`, null);
    const [lastMoveTimestamp, setLastMoveTimestamp] = useStateTogether(`tictactoe-lastMove-${sessionId}`, Date.now());

    const isMyTurn = (xIsNext && players.challenger.address.toLowerCase() === myAddress.toLowerCase()) ||
                     (!xIsNext && players.opponent.address.toLowerCase() === myAddress.toLowerCase());

    const mySymbol = players.challenger.address.toLowerCase() === myAddress.toLowerCase() ? 'X' : 'O';
    const opponentSymbol = mySymbol === 'X' ? 'O' : 'X';

    const getPlayerName = (symbol) => {
        if (symbol === 'X') return players.challenger.username;
        if (symbol === 'O') return players.opponent.username;
        return '';
    };

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
            if (squares.every(Boolean)) {
                return 'Draw';
            }
            return null;
        };

        const gameResult = calculateWinner(board);
        if (gameResult) {
            setWinner(gameResult);
            setStatus(gameResult === 'Draw' ? 'draw' : 'win');
            onGameEnd(sessionId, gameResult === 'Draw' ? 'draw' : 'finished', getPlayerName(gameResult));
        } else {
            setStatus('playing');
        }
    }, [board, sessionId, onGameEnd]);

    useEffect(() => {
        const checkOpponentActivity = setInterval(() => {
            const currentTime = Date.now();
            if (status === 'playing' && currentTime - lastMoveTimestamp > 30000) {
                onGameEnd(sessionId, 'opponent_left');
                setStatus('opponent_left');
            }
        }, 5000);

        return () => clearInterval(checkOpponentActivity);
    }, [lastMoveTimestamp, status, sessionId, onGameEnd]);

    const handleClick = (i) => {
        if (winner || board[i] || !isMyTurn || status === 'opponent_left' || rematchStatus === 'pending') {
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
            disabled={!isMyTurn || !!board[i] || !!winner || status === 'opponent_left' || rematchStatus === 'pending'}
        >
            {board[i]}
        </button>
    );

    const handleRematchRequest = () => {
        if (status === 'opponent_left') {
            onGameEnd(sessionId, 'closed');
            return;
        }
        setRematchStatus('pending');
        onRematchOffer(sessionId, mySymbol);
    };

    const handleAcceptRematch = () => {
        setBoard(initialBoard);
        setXIsNext(true);
        setWinner(null);
        setStatus('playing');
        setRematchStatus(null);
        setLastMoveTimestamp(Date.now());
        onRematchOffer(sessionId, mySymbol, 'accepted');
    };

    const handleDeclineRematch = () => {
        setRematchStatus('declined');
        onGameEnd(sessionId, 'rematch_declined');
    };

    let displayStatus;
    if (winner) {
        if (winner === 'Draw') {
            displayStatus = 'It\'s a Draw!';
        } else {
            displayStatus = `Winner: ${getPlayerName(winner)}!`;
        }
    } else if (status === 'opponent_left') {
        displayStatus = 'Opponent left the game. Game over.';
    } else if (rematchStatus === 'pending') {
        displayStatus = `Rematch requested by ${rematchStatus === 'pending' && players.challenger.address.toLowerCase() === myAddress.toLowerCase() ? getPlayerName(opponentSymbol) : getPlayerName(mySymbol)}...`;
    } else {
        displayStatus = `Next player: ${getPlayerName(xIsNext ? 'X' : 'O')} (${isMyTurn ? 'Your turn' : 'Opponent\'s turn'})`;
    }

    return (
        <div className="tic-tac-toe p-4 bg-gray-800 rounded-lg text-white">
            <div className="status text-center text-lg font-bold mb-4">
                {displayStatus}
            </div>
            <div className="board-row">
                {renderSquare(0)}
                {renderSquare(1)}
                {renderSquare(2)}
            </div>
            <div className="board-row">
                {renderSquare(3)}
                {renderSquare(4)}
                {renderSquare(5)}
            </div>
            <div className="board-row">
                {renderSquare(6)}
                {renderSquare(7)}
                {renderSquare(8)}
            </div>
            {(winner || status === 'opponent_left') && (
                <div className="text-center mt-4">
                    {rematchStatus === 'pending' && players.challenger.address.toLowerCase() !== myAddress.toLowerCase() ? (
                        <>
                            <p className="mb-2">{getPlayerName(opponentSymbol)} wants to play again!</p>
                            <button onClick={handleAcceptRematch} className="btn btn-primary mr-2">Accept Rematch</button>
                            <button onClick={handleDeclineRematch} className="btn btn-secondary">Decline</button>
                        </>
                    ) : rematchStatus === 'pending' ? (
                        <p>Waiting for {getPlayerName(opponentSymbol)} to accept rematch...</p>
                    ) : rematchStatus === 'declined' ? (
                        <p>Rematch declined.</p>
                    ) : (
                        <button onClick={handleRematchRequest} className="btn btn-primary">Play Again?</button>
                    )}
                </div>
            )}
        </div>
    );
}
