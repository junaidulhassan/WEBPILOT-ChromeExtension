import { LIMITS, STORAGE_KEYS } from './constants.js';
import { serializeError } from './errors.js';

const FLUSH_DELAY_MS = 400;
const CONSOLE_METHODS = Object.freeze({ debug: 'debug', info: 'info', warn: 'warn', error: 'error' });

let pendingEntries = [];
let flushTimer = null;

function normalizeData(data) {
    if (data === undefined || data === null) return null;
    if (data instanceof Error) return serializeError(data);

    return Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, value instanceof Error ? serializeError(value) : value])
    );
}

async function flushEntries() {
    flushTimer = null;
    if (!pendingEntries.length) return;

    const batch = pendingEntries;
    pendingEntries = [];

    try {
        const stored = (await chrome.storage.local.get(STORAGE_KEYS.activityLog))[STORAGE_KEYS.activityLog] ?? [];
        const merged = stored.concat(batch).slice(-LIMITS.maxLogEntries);
        await chrome.storage.local.set({ [STORAGE_KEYS.activityLog]: merged });
    } catch (error) {
        console.error('[WebPilot] failed to persist log entries', error);
    }
}

function scheduleFlush() {
    if (flushTimer === null) {
        flushTimer = setTimeout(flushEntries, FLUSH_DELAY_MS);
    }
}

function write(scope, level, event, data) {
    const payload = normalizeData(data);
    console[CONSOLE_METHODS[level]](`[WebPilot:${scope}] ${event}`, payload ?? '');

    if (level === 'debug') return;

    pendingEntries.push({ level, scope, event, data: payload, timestamp: Date.now() });
    scheduleFlush();
}

export function createLogger(scope) {
    return {
        debug: (event, data) => write(scope, 'debug', event, data),
        info: (event, data) => write(scope, 'info', event, data),
        warn: (event, data) => write(scope, 'warn', event, data),
        error: (event, data) => write(scope, 'error', event, data)
    };
}

export function flushLogs() {
    return flushEntries();
}

export async function getActivityLog() {
    const result = await chrome.storage.local.get(STORAGE_KEYS.activityLog);
    return result[STORAGE_KEYS.activityLog] ?? [];
}

export function clearActivityLog() {
    pendingEntries = [];
    return chrome.storage.local.set({ [STORAGE_KEYS.activityLog]: [] });
}
