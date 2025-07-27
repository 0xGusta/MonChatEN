import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useStateTogether, usePlayerId } from 'react-together';
import GameControls from './GameControls';

const COLS = 10;
const ROWS = 20;
const EMPTY_ROW = () => Array(COLS).fill(0);
const COLORS = [null, '#FF0D72', '#0DC2FF', '#0DFF72', '#F538FF', '#FF8E0D', '#FFE138', '#3877FF'];

const Tetris = ({ sessionId }) => {
  const playerId = usePlayerId();
  const [sharedState, setSharedState] = useStateTogether(`tetris-${sessionId}`, {});
  const [connectionLost, setConnectionLost] = useState(false);

  const opponentId = Object.keys(sharedState || {}).find((id) => id !== playerId);

  useEffect(() => {
    if (opponentId && !sharedState?.[opponentId]) {
      setConnectionLost(true);
    }
  }, [sharedState, opponentId]);

  const move = (dir) => {
    setSharedState((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        x: (prev[playerId]?.x || 0) + dir,
      },
    }));
  };

  const rotate = () => {
    setSharedState((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        rotation: ((prev[playerId]?.rotation || 0) + 1) % 4,
      },
    }));
  };

  const drop = () => {
    setSharedState((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        y: (prev[playerId]?.y || 0) + 1,
      },
    }));
  };

  const hardDrop = () => {
    setSharedState((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        y: (prev[playerId]?.y || 0) + 5,
      },
    }));
  };

  if (connectionLost) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-red-500 font-semibold text-lg">
        Other player disconnected.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <h2 className="font-bold text-xl mb-2">Tetris Multiplayer</h2>
      <canvas
        width={COLS * 20}
        height={ROWS * 20}
        className="bg-black border border-gray-400"
      ></canvas>

      <div className="mobile-controls grid grid-cols-3 gap-2 p-2 bg-gray-800 rounded-lg mt-4 w-full max-w-xs">
        <button className="btn-control py-2 px-4 bg-gray-700 text-white rounded" onClick={() => move(-1)}>◀</button>
        <button className="btn-control py-2 px-4 bg-gray-700 text-white rounded" onClick={() => move(1)}>▶</button>
        <button className="btn-control py-2 px-4 bg-gray-700 text-white rounded" onClick={rotate}>↺</button>
        <button className="btn-control col-span-3 py-2 px-4 bg-green-600 text-white rounded" onClick={hardDrop}>DROP</button>
        <button className="btn-control col-span-3 py-2 px-4 bg-blue-600 text-white rounded" onClick={drop}>▼</button>
      </div>
    </div>
  );
};

export default Tetris;
