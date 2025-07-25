import React, { useEffect, useState } from 'react';

const OnlineCounter = ({ count }) => {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const checkSpinner = () => {
      const el = document.querySelector('#croquet_spinnerOverlay');
      if (el) {
        const style = getComputedStyle(el);
        const visible = style.display !== 'none' && style.opacity !== '0' && style.visibility !== 'hidden';
        setIsLoading(visible);
      } else {
        setIsLoading(false);
      }
    };

    const interval = setInterval(checkSpinner, 300);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="online-counter" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span>Online:</span>
      {isLoading ? (
        <span className="loading-spinner" />
      ) : (
        <span>{count}</span>
      )}
    </div>
  );
};

export default OnlineCounter;
