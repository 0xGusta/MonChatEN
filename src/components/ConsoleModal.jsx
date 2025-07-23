import React from 'react';

export default function ConsoleModal({ isOpen, onClose, logs }) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content console-modal" onClick={e => e.stopPropagation()}>
                <button className="close-button" onClick={onClose}>×</button>
                <h2 className="text-xl font-bold mb-4">Console</h2>
                <div className="console-logs">
                    {logs.map((log, index) => (
                        <div key={index} className={`log-entry ${log.type}`}>
                            <span className="log-timestamp">{log.timestamp}</span>
                            <pre className="log-message">{log.message}</pre>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
