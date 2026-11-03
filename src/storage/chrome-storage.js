import { createLogger } from '../core/logger.js';

const log = createLogger('storage');

const memory = new Map();
let degradedHandler = null;
let degradedReported = false;

function reportDegraded(operation, error) {
    log.error('storage_unavailable', { operation, error });
    if (degradedReported) return;
    degradedReported = true;
    degradedHandler?.(error);
}

export function onStorageDegraded(handler) {
    degradedHandler = handler;
    if (degradedReported) handler(null);
}

async function readValue(key) {
    try {
        const result = await chrome.storage.local.get(key);
        if (key in result) memory.set(key, result[key]);
        return result[key];
    } catch (error) {
        reportDegraded('read', error);
        return memory.get(key);
    }
}

async function writeValue(key, value) {
    memory.set(key, value);
    try {
        await chrome.storage.local.set({ [key]: value });
    } catch (error) {
        reportDegraded('write', error);
    }
}

export function createStore(key, createDefault) {
    let queue = Promise.resolve();

    async function read() {
        return (await readValue(key)) ?? createDefault();
    }

    function update(mutator) {
        const run = queue.then(async () => {
            const current = await read();
            const next = mutator(current) ?? current;
            await writeValue(key, next);
            return next;
        });
        queue = run.catch(() => {});
        return run;
    }

    function replace(value) {
        return update(() => value);
    }

    return { read, update, replace };
}
