import { useEffect, useState, useMemo, useRef } from 'react';
import { useStateTogether } from 'react-together';
import { setTimeOffset } from '../utils/timeSync.js';

const HEARTBEAT_INTERVAL = 5000;
const OFFLINE_THRESHOLD = 12000;
const TYPING_THRESHOLD = 3000;

const fetchWithRetry = async (url, options, retries = 5, backoff = 300) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`API call failed with status: ${response.status}`);
      }
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(res => setTimeout(res, backoff * (i + 1) + Math.random() * 100));
    }
  }
};

export function usePresence(userId, userName) {
  const [presence, setPresence] = useStateTogether('presence', {});
  const [now, setNow] = useState(Date.now());
  const isInitialized = useRef(false);
  const timeOffset = useRef(0);

  useEffect(() => {
    const fetchWorldTime = async () => {
      const apiKey = import.meta.env.VITE_TIMEZONEDB_API_KEY;
      if (!apiKey) {
        return;
      }

      try {
        const response = await fetchWithRetry(
          `https://api.timezonedb.com/v2.1/get-time-zone?key=${apiKey}&format=json&by=zone&zone=UTC`
        );
        const data = await response.json();

        if (data.status !== 'OK') {
          throw new Error(`TimeZoneDB API returned an error: ${data.message}`);
        }

        const serverTime = data.timestamp * 1000;
        const localTime = Date.now();
        const offset = serverTime - localTime;
        timeOffset.current = offset;
        setTimeOffset(offset);
      } catch (error) {

      }
    };

    fetchWorldTime();
  }, []);

  const getSyncedNow = () => Date.now() + timeOffset.current;

  useEffect(() => {
    if (!userId || !userName || isInitialized.current) {
      return;
    }

    isInitialized.current = true;
    const lowerCaseUserId = userId.toLowerCase();

    const updateMyPresenceData = () => {
      setPresence(prev => {
        const currentPresence = prev || {};
        return {
          ...currentPresence,
          [lowerCaseUserId]: {
            ...(currentPresence[lowerCaseUserId] || {}),
            name: userName,
            lastSeen: getSyncedNow(),
          },
        };
      });
    };

    updateMyPresenceData();
    const intervalId = setInterval(updateMyPresenceData, HEARTBEAT_INTERVAL);

    return () => {
      clearInterval(intervalId);
      setPresence(prev => {
        const newState = { ...prev };
        delete newState[lowerCaseUserId];
        return newState;
      });
      isInitialized.current = false;
    };
  }, [userId, userName, setPresence]);

  useEffect(() => {
    const intervalId = setInterval(() => setNow(getSyncedNow()), 5000);
    return () => clearInterval(intervalId);
  }, []);

  const updateMyPresence = (data) => {
    if (!userId) return;
    const lowerCaseUserId = userId.toLowerCase();
    setPresence(prev => {
      const currentPresence = prev || {};
      return {
        ...currentPresence,
        [lowerCaseUserId]: {
          ...(currentPresence[lowerCaseUserId] || {}),
          ...data,
          lastSeen: getSyncedNow(),
        },
      };
    });
  };

    const onlineUsers = useMemo(() => {

        return Object.keys(presence || {})
            .map(key => {
                const user = presence[key];
                if (!user || !user.name || !user.lastSeen) {
                    return null;
                }
                const timeSinceSeen = now - user.lastSeen;
                const isOnline = timeSinceSeen < OFFLINE_THRESHOLD;
                const timeSinceTyped = now - (user.lastTyped || 0);
                const isTyping = timeSinceTyped < TYPING_THRESHOLD;

                if (!isOnline) {
                    return null;
                }

                return {
                    userId: key,
                    name: user.name,
                    isTyping: isTyping,
                    isOnline: true,
                };
            })
            .filter(Boolean);
    }, [presence, now]);

  return {
    onlineUsers,
    onlineCount: onlineUsers.length,
    updateMyPresence,
    getSyncedNow,
  };
}
