import React from 'react';

export default function GameControls({ onMove, onRotate, onDrop }) {
    return (
        <div className="md:hidden fixed bottom-24 left-0 right-0 flex justify-around p-2 bg-darkCard/50 backdrop-blur-sm">
            <div className="flex flex-col items-center">
                <button onClick={() => onRotate(-1)} className="btn btn-secondary p-4 rounded-full h-16 w-16 text-2xl"><i className="fas fa-undo"></i></button>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={() => onMove(-1)} className="btn btn-secondary p-4 rounded-full h-16 w-16 text-2xl"><i className="fas fa-arrow-left"></i></button>
                <button onClick={onDrop} className="btn btn-secondary p-4 rounded-full h-16 w-16 text-2xl"><i className="fas fa-arrow-down"></i></button>
                <button onClick={() => onMove(1)} className="btn btn-secondary p-4 rounded-full h-16 w-16 text-2xl"><i className="fas fa-arrow-right"></i></button>
            </div>
            <div className="flex flex-col items-center">
                <button onClick={() => onRotate(1)} className="btn btn-secondary p-4 rounded-full h-16 w-16 text-2xl"><i className="fas fa-redo"></i></button>
            </div>
        </div>
    );
}
