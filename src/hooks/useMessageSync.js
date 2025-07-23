import { useEffect, useRef } from 'react';
import { useStateTogether } from 'react-together';
import { getSyncedNow } from '../utils/timeSync';

export function useMessageSync(onNewMessage, myAddress) {
  const [notification, setNotification] = useStateTogether('messageNotification', { timestamp: 0, sender: null });
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (notification.timestamp > 0 && notification.sender?.toLowerCase() !== myAddress?.toLowerCase()) {
      onNewMessage();
    }
  }, [notification, myAddress, onNewMessage]);

  const notifyNewMessage = () => {
    setNotification({ timestamp: getSyncedNow(), sender: myAddress });
  };

  return { notifyNewMessage };
}
