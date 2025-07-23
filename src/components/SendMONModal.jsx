import React, { useState } from 'react';
import { ethers } from 'ethers';

export default function SendMONModal({ isOpen, onClose, recipientAddress, recipientUsername, onSend, userBalance }) {
    const [amount, setAmount] = useState('');
    const [sending, setSending] = useState(false);

    const handleSend = async () => {
        try {
            setSending(true);
            const amountWei = ethers.parseEther(amount);
            await onSend(recipientAddress, amountWei);
            onClose();
            setAmount('');
        } catch (error) {
            console.error('Error sending MON:', error);
        } finally {
            setSending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <button className="close-button" onClick={onClose}>×</button>
                <h2 className="text-xl font-bold mb-4">Send MON</h2>
                <p className="text-gray-300 mb-4">Sending to: <strong>{recipientUsername}</strong></p>
                <div className="input-group">
                    <label className="block text-sm font-medium mb-2">Amount (MON)</label>
                    <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="input-field" placeholder="0.0" min="0.1" step="0.1" />
                    <p className="text-xs text-gray-400 mt-1">Minimum: 0.1 MON | You have {userBalance} MON</p>
                </div>
                <div className="flex gap-2 justify-end">
                    <button onClick={onClose} className="btn btn-secondary" disabled={sending}>Cancel</button>
                    <button onClick={handleSend} className="btn btn-primary" disabled={sending || !amount || parseFloat(amount) < 0.1 || parseFloat(amount) > parseFloat(userBalance)}>{sending ? 'Sending...' : 'Send'}</button>
                </div>
            </div>
        </div>
    );
}