import React, { useEffect, useState } from 'react';

const OnlineCounter = ({ count }) => {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const checkSpinner = () => {
      const el = document.querySelector('#croquet_spinnerOverlay');
      setIsLoading(!!el);
    };

    const interval = setInterval(checkSpinner, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="online-counter" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span>Online:</span>
      {isLoading ? (
        <span 
          className="loading-spinner" 
          style={{ width: '16px', height: '16px', borderWidth: '2px' }}
          title="synchronizing with multisynq... If this takes too long, reload the page, this affects games and online and typing status."
        />
      ) : (
        <span>{count}</span>
      )}
    </div>
  );
};

export default OnlineCounter;
