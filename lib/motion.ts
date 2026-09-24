import { createContext, useContext } from 'react';

/** Mirrors the app's animation setting from session_start.reducedMotion. */
export const ReducedMotionContext = createContext(false);
export const useReducedMotion = () => useContext(ReducedMotionContext);
