import React from 'react';

const OnlineCounter = ({ count }) => {
  return (
    <div className="online-counter">
      Online: {count}
    </div>
  );
};

export default OnlineCounter;