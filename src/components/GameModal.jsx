import React from 'react';
import TicTacToe from './TicTacToe';

export default function GameModal({ isOpen, onClose, gameType, players, sessionId, myAddress, onGameEnd, onRematchOffer }) {
    if (!isOpen) return null;

    const handleCloseGame = () => {
            onClose();
    };

    const handleRematch = () => {
        onRematchOffer();
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '600px', width: '90%' }} onClick={e => e.stopPropagation()}>
                <button className="close-button" onClick={handleCloseGame}>×</button>
                <h2 className="text-xl font-bold mb-4 text-center">{gameType === 'tictactoe' ? 'Tic-Tac-Toe' : 'Game'}</h2>
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
                </div>
            </div>
        </div>
    );
}
