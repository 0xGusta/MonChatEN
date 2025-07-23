let timeOffset = 0;

export const setTimeOffset = (offset) => {
  timeOffset = offset;
};

export const getSyncedNow = () => {
  return Date.now() + timeOffset;
};
