import React from 'react';

export default function GameControls({ onMove, onRotate, onDrop }) {
    return (
        <div className="md:hidden w-full max-w-xs flex flex-col items-center justify-center p-1 bg-darkCard/50 rounded-md mt-2 space-y-3">
            <div className="flex justify-between w-full gap-1">
                <button
                    onClick={() => onRotate(-1)}
                    className="btn btn-secondary p-1 rounded-full text-xl aspect-square w-12"
                >
                    <i className="fas fa-undo"></i>
                </button>
                <button
                    onClick={() => onRotate(1)}
                    className="btn btn-secondary p-1 rounded-full text-xl aspect-square w-12"
                >
                    <i className="fas fa-redo"></i>
                </button>
            </div>
            <div className="flex justify-between w-full gap-4">
                <button
                    onClick={() => onMove(-1)}
                    className="btn btn-secondary p-1 rounded-full text-xl aspect-square w-12"
                >
                    <i className="fas fa-arrow-left"></i>
                </button>
                <button
                    onClick={onDrop}
                    className="btn btn-secondary p-1 rounded-full text-xl aspect-square w-12"
                >
                    <i className="fas fa-arrow-down"></i>
                </button>
                <button
                    onClick={() => onMove(1)}
                    className="btn btn-secondary p-1 rounded-full text-xl aspect-square w-12"
                >
                    <i className="fas fa-arrow-right"></i>
                </button>
            </div>
        </div>
    );
}
