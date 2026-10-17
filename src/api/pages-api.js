import { TIMEOUTS_MS } from '../core/constants.js';
import { ENDPOINTS } from './endpoints.js';
import { request } from './http-client.js';

export function processPage({ url, text, history = [] }, { signal } = {}) {
    return request(ENDPOINTS.processPage, {
        method: 'POST',
        body: { url, text, history },
        signal,
        timeoutMs: TIMEOUTS_MS.processPage
    });
}
