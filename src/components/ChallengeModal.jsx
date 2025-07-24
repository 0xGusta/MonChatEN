import React, { useEffect, useState, useRef } from 'react';

export default function ChallengeModal({ isOpen, onClose, challenge, onAccept, onDecline }) {
    const [timeLeft, setTimeLeft] = useState(10);
    const timerRef = useRef(null);

    useEffect(() => {
        if (isOpen && challenge) {
            setTimeLeft(10);
            timerRef.current = setInterval(() => {
                setTimeLeft(prevTime => {
                    if (prevTime <= 1) {
                        clearInterval(timerRef.current);
                        onDecline(challenge.id);
                        return 0;
                    }
                    return prevTime - 1;
                });
            }, 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [isOpen, challenge, onDecline]);

    if (!isOpen || !challenge) return null;

    return (
        <div className="modal-overlay" onClick={() => onDecline(challenge.id)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4">Game Challenge!</h2>
                <p className="text-gray-300 mb-4">
                    {challenge.challenger.username} challenged you to a game of Tic-Tac-Toe!
                </p>
                <p className="text-gray-400 text-sm mb-4">
                    Time left to respond: {timeLeft}s
                </p>
                <div className="flex gap-2 justify-end">
                    <button onClick={() => onDecline(challenge.id)} className="btn btn-secondary">Decline</button>
                    <button onClick={() => onAccept(challenge.id)} className="btn btn-primary">Accept</button>
                </div>
            </div>
        </div>
    );
}
