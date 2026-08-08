// localStorage-backed persistence (the app runs entirely in the browser)

export const TUNING_KEY = "fretboard-trainer-tuning";
export const STATS_KEY = "fretboard-trainer-stats";

export const storage = {
  async get(key) {
    try {
      const v = window.localStorage.getItem(key);
      return v === null ? null : { value: v };
    } catch (e) {
      return null;
    }
  },
  async set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      // storage full or unavailable — non-fatal
    }
    return { value };
  },
};
