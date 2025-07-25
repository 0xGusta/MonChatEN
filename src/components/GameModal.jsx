import React from 'react';
import TicTacToe from './TicTacToe';
import Tetris from './Tetris';

export default function GameModal({ isOpen, onClose, gameType, players, sessionId, myAddress, onGameEnd, onRematchOffer }) {
    if (!isOpen) return null;

    const handleCloseGame = () => {
        //onClose();
        onGameEnd(sessionId, 'closed');
    };

    const getGameTitle = () => {
        if (gameType === 'tictactoe') return 'Tic-Tac-Toe';
        if (gameType === 'tetris') return 'Tetris Battle';
        return 'Game';
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: 'fit-content', width: '95%' }} onClick={e => e.stopPropagation()}>
                <button className="close-button" onClick={handleCloseGame}>×</button>
                <h2 className="text-xl font-bold mb-4 text-center">{getGameTitle()}</h2>
                <div className="game-container">
                    {gameType === 'tictactoe' && (
                        <TicTacToe
                            players={players}
                            sessionId={sessionId}
                            myAddress={myAddress}
                            onGameEnd={onGameEnd}
                            onRematchOffer={onRematchOffer}
                        />
                    )}
                    {gameType === 'tetris' && (
                        <Tetris
                            players={players}
                            sessionId={sessionId}
                            myAddress={myAddress}
                            onGameEnd={onGameEnd}
                            onRematchOffer={onRematchOffer}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
