import React from 'react';

export default function Popup({ message, isLoading, type = 'info', isExiting }) {
    const getIcon = () => {
        switch (type) {
            case 'success': return '<i class="fas fa-check-circle"></i>';
            case 'error': return '<i class="fas fa-times-circle"></i>';
            case 'warning': return '<i class="fas fa-exclamation-triangle"></i>';
            default: return '<i class="fas fa-info-circle"></i>';
        }
    };

    return (
        <div className={`popup p-4 rounded-lg shadow-xl flex items-center max-w-sm z-[9999] ${isExiting ? 'popup-exit' : ''}`}>
            {isLoading ? (
                <>
                    <div className="loading-spinner mr-3"></div>
                    <p className="text-sm">{message}</p>
                </>
            ) : (
                <>
                    <span className="mr-3 text-lg" dangerouslySetInnerHTML={{ __html: getIcon() }}></span>
                    <p className="text-sm">{message}</p>
                </>
            )}
        </div>
    );
}