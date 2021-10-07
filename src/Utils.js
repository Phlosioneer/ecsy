import { Tag } from "./Tag";

// Detector for browser's "window"
export const hasWindow = typeof window !== "undefined";

// performance.now() "polyfill"
export const now =
  hasWindow && typeof window.performance !== "undefined"
    ? performance.now.bind(performance)
    : Date.now.bind(Date);