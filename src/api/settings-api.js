import { TIMEOUTS_MS } from '../core/constants.js';
import { ENDPOINTS } from './endpoints.js';
import { request } from './http-client.js';

const OPTION_REQUESTS = Object.freeze({
    model: { path: ENDPOINTS.currentModel, field: 'model', timeoutMs: TIMEOUTS_MS.default },
    tone: { path: ENDPOINTS.currentTone, field: 'tone', timeoutMs: TIMEOUTS_MS.default },
    embedding: { path: ENDPOINTS.currentEmbedding, field: 'embedding', timeoutMs: TIMEOUTS_MS.embedding }
});

export const BACKEND_OPTION_KINDS = Object.freeze(Object.keys(OPTION_REQUESTS));

export function setCurrentOption(kind, id, { signal } = {}) {
    const config = OPTION_REQUESTS[kind];
    if (!config) throw new Error(`Unknown option kind: ${kind}`);

    return request(config.path, {
        method: 'PUT',
        body: { [config.field]: id },
        signal,
        timeoutMs: config.timeoutMs
    });
}

export function getHealth({ signal } = {}) {
    return request(ENDPOINTS.health, { signal, retries: 2 });
}
