import React, { useState } from 'react';

export default function ModerationModal({ isOpen, onClose, action, onConfirm }) {
    const [username, setUsername] = useState('');
    const [processing, setProcessing] = useState(false);

    const handleConfirm = async () => {
        if (!username.trim()) return;
        try {
            setProcessing(true);
            await onConfirm(username.trim());
            onClose();
            setUsername('');
        } catch (error) {
            console.error('Error in moderation action:', error);
        } finally {
            setProcessing(false);
        }
    };

    if (!isOpen) return null;

    const getTitle = () => {
        switch (action) {
            case 'ban': return 'Ban User';
            case 'unban': return 'Unban User';
            case 'addModerator': return 'Add Moderator';
            case 'removeModerator': return 'Remove Moderator';
            default: return 'Moderation Action';
        }
    };

    const getDescription = () => {
        switch (action) {
            case 'ban': return 'Enter the username you want to ban:';
            case 'unban': return 'Enter the username you want to unban:';
            case 'addModerator': return 'Enter the username you want to make a moderator:';
            case 'removeModerator': return 'Enter the moderator username you want to remove:';
            default: return 'Enter the username:';
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <button className="close-button" onClick={onClose}>×</button>
                <h2 className="text-xl font-bold mb-4">{getTitle()}</h2>
                <p className="text-gray-300 mb-4">{getDescription()}</p>
                <div className="input-group">
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="input-field" placeholder="Username" maxLength={32} />
                </div>
                <div className="flex gap-2 justify-end">
                    <button onClick={onClose} className="btn btn-secondary" disabled={processing}>Cancel</button>
                    <button onClick={handleConfirm} className="btn btn-primary" disabled={processing || !username.trim()}>{processing ? 'Processing...' : 'Confirm'}</button>
                </div>
            </div>
        </div>
    );
}