/**
 * Game side of the app bridge, protocol v1.
 *
 *   game -> app : CyanGameBridge.postMessage(JSON.stringify({ type, data }))
 *   app -> game : window.cyanBridge.receive({ type, data })
 *
 * With no CyanGameBridge on the page (QA in a desktop browser) the game runs
 * standalone and posts nothing (BR-09).
 */

export const PROTOCOL_VERSION = 1;
export const SESSION_START_TIMEOUT_MS = 5000; // BR-11

export interface SessionStart {
  protocolVersion: number;
  sessionId: string;
  expectedLocale: string;
  levelIds: string[];
  reducedMotion: boolean;
  tutorialSeen: boolean;
}

export type RoundStats = { wrongTaps: number; hintsUsed: number; rotations: number };

export type AppMessage =
  | { type: 'session_start'; data: SessionStart }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'abort'; data?: { reason?: string } };

export type ErrorCode =
  | 'translations_unavailable'
  | 'locale_mismatch'
  | 'session_start_timeout'
  | 'protocol_mismatch'
  | 'invalid_session'
  | 'unknown_level'
  | 'render_error';

type Listener = (msg: AppMessage) => void;

interface NativeChannel {
  postMessage: (message: string) => void;
}

const listeners = new Set<Listener>();
const pending: AppMessage[] = [];
/** Once the activity has ended (finished, exited, errored, aborted) nothing more is posted. */
let closed = false;

function channel(): NativeChannel | null {
  if (typeof window === 'undefined') return null;
  const c = (window as unknown as { CyanGameBridge?: NativeChannel }).CyanGameBridge;
  return c && typeof c.postMessage === 'function' ? c : null;
}

export function hasBridge(): boolean {
  return channel() !== null;
}

function post(type: string, data?: unknown, { final = false } = {}): void {
  const c = channel();
  if (!c || closed) return;
  if (final) closed = true;
  try {
    c.postMessage(JSON.stringify(data === undefined ? { type } : { type, data }));
  } catch {
    // Nothing useful to do if the host channel throws.
  }
}

export const send = {
  gameReady: (gameId: string, locale: string) =>
    post('game_ready', { gameId, protocolVersion: PROTOCOL_VERSION, locale }),
  levelCompleted: (levelId: string, stats: RoundStats) =>
    post('level_completed', { levelId, outcome: 'won', stats }),
  gameFinished: (lastCompletedLevelId: string, stats: RoundStats) =>
    post('game_finished', { lastCompletedLevelId, stats }, { final: true }),
  exitRequested: () => post('game_exit_requested', undefined, { final: true }),
  /** `message` is for logs only and is never rendered (BR-10). */
  error: (code: ErrorCode, message: string) =>
    post('game_error', { code, message }, { final: true }),
};

/** Stop posting after an app-side abort. */
export function closeBridge(): void {
  closed = true;
}

export function isClosed(): boolean {
  return closed;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  // Deliver anything that arrived before the UI subscribed.
  while (pending.length > 0) listener(pending.shift()!);
  return () => {
    listeners.delete(listener);
  };
}

function receive(raw: unknown): void {
  let msg = raw;
  if (typeof msg === 'string') {
    try {
      msg = JSON.parse(msg);
    } catch {
      return;
    }
  }
  if (!msg || typeof msg !== 'object' || typeof (msg as { type?: unknown }).type !== 'string') return;
  const m = msg as AppMessage;
  if (listeners.size === 0) pending.push(m);
  else listeners.forEach((l) => l(m));
}

/** Validates a session_start payload; returns an error code or null. */
export function validateSessionStart(data: unknown): ErrorCode | null {
  if (!data || typeof data !== 'object') return 'invalid_session';
  const d = data as Partial<SessionStart>;
  if (d.protocolVersion !== PROTOCOL_VERSION) return 'protocol_mismatch';
  if (
    typeof d.expectedLocale !== 'string' ||
    !Array.isArray(d.levelIds) ||
    d.levelIds.length === 0 ||
    !d.levelIds.every((id) => typeof id === 'string')
  ) {
    return 'invalid_session';
  }
  return null;
}

// Defined at import time, i.e. before game_ready is ever posted.
if (typeof window !== 'undefined') {
  (window as unknown as { cyanBridge: { receive: (m: unknown) => void } }).cyanBridge = { receive };
}
