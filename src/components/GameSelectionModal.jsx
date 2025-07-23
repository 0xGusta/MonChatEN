import React, { useState } from 'react';

export default function GameSelectionModal({ isOpen, onClose, onChallenge, opponentUsername }) {
    const [selectedGame, setSelectedGame] = useState(null);

    if (!isOpen) return null;

    const handleChallengeClick = () => {
        if (selectedGame) {
            onChallenge(selectedGame);
            onClose();
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <button className="close-button" onClick={onClose}>×</button>
                <h2 className="text-xl font-bold mb-4">Challenge {opponentUsername} to a game!</h2>
                
                <div className="flex flex-col gap-3 mb-6">
                    <button 
                        className={`btn ${selectedGame === 'tetris' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setSelectedGame('tetris')}
                    >
                        Tetris
                    </button>
                    <button 
                        className={`btn ${selectedGame === 'placeholder' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setSelectedGame('placeholder')}
                    >
                        Placeholder Game (Coming Soon)
                    </button>
                </div>

                <div className="flex gap-2 justify-end">
                    <button onClick={onClose} className="btn btn-secondary">Cancel</button>
                    <button onClick={handleChallengeClick} className="btn btn-primary" disabled={!selectedGame}>Challenge</button>
                </div>
            </div>
        </div>
    );
}
