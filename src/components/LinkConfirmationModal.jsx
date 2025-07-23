import React from 'react';

export default function LinkConfirmationModal({ isOpen, onClose, onConfirm, url }) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <button className="close-button" onClick={onClose}>×</button>
                <h2 className="text-xl font-bold mb-4">External Link</h2>
                <p className="text-gray-300 mb-4">You are about to open the following link in a new tab:</p>
                <p className="text-monad bg-darkBg p-2 rounded break-all mb-6">{url}</p>
                <div className="flex gap-2 justify-end">
                    <button onClick={onClose} className="btn btn-secondary">Cancel</button>
                    <button onClick={onConfirm} className="btn btn-primary">Continue</button>
                </div>
            </div>
        </div>
    );
}