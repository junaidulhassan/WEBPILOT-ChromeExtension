import { API_BASE_URL, TIMEOUTS_MS } from '../core/constants.js';
import { ApiError, ERROR_KINDS } from '../core/errors.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('api');

const RETRY_BASE_DELAY_MS = 300;

function linkSignals(external, controller) {
    if (!external) return () => {};

    if (external.aborted) {
        controller.abort(external.reason);
        return () => {};
    }

    const onAbort = () => controller.abort(external.reason);
    external.addEventListener('abort', onAbort, { once: true });
    return () => external.removeEventListener('abort', onAbort);
}

function normalizeError(error, { timedOut = false, signal = null } = {}) {
    if (error instanceof ApiError) return error;
    if (timedOut) return new ApiError('Request timed out', { kind: ERROR_KINDS.timeout, cause: error });
    if (signal?.aborted || error?.name === 'AbortError') {
        return new ApiError('Request cancelled', { kind: ERROR_KINDS.aborted, cause: error });
    }
    return new ApiError('Network error', { kind: ERROR_KINDS.network, cause: error });
}

async function readApiError(response) {
    let payload = null;
    try {
        payload = await response.json();
    } catch {
        payload = null;
    }

    const detail = payload?.error ?? null;
    return new ApiError(detail?.message ?? payload?.detail ?? `Server error ${response.status}`, {
        kind: ERROR_KINDS.http,
        status: response.status,
        code: detail?.code ?? 'http_error',
        requestId: detail?.request_id ?? response.headers.get('X-Request-ID')
    });
}

async function send(path, { method, body, signal, timeoutMs, stream }) {
    const controller = new AbortController();
    const unlink = linkSignals(signal, controller);
    let timedOut = false;
    const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, timeoutMs);

    try {
        const hasBody = body !== undefined;
        const response = await fetch(`${API_BASE_URL}${path}`, {
            method,
            headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
            body: hasBody ? JSON.stringify(body) : undefined,
            signal: controller.signal
        });

        if (!response.ok) throw await readApiError(response);

        if (stream) {
            clearTimeout(timer);
            return { response };
        }

        const hasContent = response.status !== 204 && response.headers.get('Content-Type')?.includes('json');
        const data = hasContent ? await response.json() : null;
        clearTimeout(timer);
        unlink();
        return { response, data };
    } catch (error) {
        clearTimeout(timer);
        unlink();
        throw normalizeError(error, { timedOut, signal });
    }
}

function isRetryable(error) {
    return error.isNetwork || error.isTimeout || error.status >= 500;
}

function wait(ms, signal) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener(
            'abort',
            () => {
                clearTimeout(timer);
                reject(new ApiError('Request cancelled', { kind: ERROR_KINDS.aborted }));
            },
            { once: true }
        );
    });
}

export async function request(path, { method = 'GET', body, signal, timeoutMs = TIMEOUTS_MS.default, retries = 0 } = {}) {
    for (let attempt = 0; ; attempt += 1) {
        const startedAt = performance.now();

        try {
            const { response, data } = await send(path, { method, body, signal, timeoutMs, stream: false });
            log.debug('request_succeeded', {
                method,
                path,
                status: response.status,
                durationMs: Math.round(performance.now() - startedAt),
                requestId: response.headers.get('X-Request-ID')
            });
            return data;
        } catch (error) {
            const details = {
                method,
                path,
                attempt,
                kind: error.kind,
                status: error.status,
                code: error.code,
                requestId: error.requestId,
                durationMs: Math.round(performance.now() - startedAt)
            };

            if (error.isAborted) {
                log.debug('request_cancelled', details);
                throw error;
            }

            if (attempt < retries && isRetryable(error)) {
                log.warn('request_retrying', details);
                await wait(RETRY_BASE_DELAY_MS * 2 ** attempt, signal);
                continue;
            }

            log.error('request_failed', details);
            throw error;
        }
    }
}

export async function* requestTextStream(path, { method = 'POST', body, signal, timeoutMs = TIMEOUTS_MS.chatConnect } = {}) {
    const startedAt = performance.now();
    let response;

    try {
        ({ response } = await send(path, { method, body, signal, timeoutMs, stream: true }));
    } catch (error) {
        if (!error.isAborted) {
            log.error('stream_failed_to_open', {
                path,
                kind: error.kind,
                status: error.status,
                code: error.code,
                requestId: error.requestId
            });
        }
        throw error;
    }

    if (!response.body) {
        throw new ApiError('The server returned an empty response.', { kind: ERROR_KINDS.http, status: response.status });
    }

    const requestId = response.headers.get('X-Request-ID');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let chunkCount = 0;

    try {
        while (true) {
            let result;
            try {
                result = await reader.read();
            } catch (error) {
                throw normalizeError(error, { signal });
            }

            if (result.done) break;

            const text = decoder.decode(result.value, { stream: true });
            if (text) {
                chunkCount += 1;
                yield text;
            }
        }

        const tail = decoder.decode();
        if (tail) yield tail;

        log.debug('stream_completed', {
            path,
            chunkCount,
            durationMs: Math.round(performance.now() - startedAt),
            requestId
        });
    } finally {
        reader.cancel().catch(() => {});
    }
}
