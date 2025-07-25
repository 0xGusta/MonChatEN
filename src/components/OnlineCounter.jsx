import React, { useEffect, useState } from 'react';

const OnlineCounter = ({ count }) => {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const checkSpinner = () => {
      const spinner = document.querySelector('#croquet_spinnerOverlay');
      setIsLoading(spinner && spinner.offsetParent !== null);
    };

    const interval = setInterval(checkSpinner, 300);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="online-counter" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {isLoading ? (
        <span className="loading-spinner" />
      ) : (
        <>Online: {count}</>
      )}
    </div>
  );
};

export default OnlineCounter;
