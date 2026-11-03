export const ERROR_KINDS = Object.freeze({
    http: 'http',
    network: 'network',
    timeout: 'timeout',
    aborted: 'aborted'
});

export class ApiError extends Error {
    constructor(message, { kind = ERROR_KINDS.http, status = 0, code = 'unknown', requestId = null, cause = null } = {}) {
        super(message);
        this.name = 'ApiError';
        this.kind = kind;
        this.status = status;
        this.code = code;
        this.requestId = requestId;
        this.cause = cause;
    }

    get isAborted() {
        return this.kind === ERROR_KINDS.aborted;
    }

    get isNetwork() {
        return this.kind === ERROR_KINDS.network;
    }

    get isTimeout() {
        return this.kind === ERROR_KINDS.timeout;
    }

    get isServerResponse() {
        return this.kind === ERROR_KINDS.http;
    }
}

export class PageExtractionError extends Error {
    constructor(message, { cause = null } = {}) {
        super(message);
        this.name = 'PageExtractionError';
        this.cause = cause;
    }
}

export function isAbortError(error) {
    return error instanceof ApiError ? error.isAborted : error?.name === 'AbortError';
}

export function toUserMessage(error, fallback = 'Something went wrong. Please try again.') {
    if (error instanceof PageExtractionError) return error.message;
    if (!(error instanceof ApiError)) return error?.message ? `${fallback} (${error.message})` : fallback;
    if (error.isNetwork) return 'Could not connect to the backend. Make sure the server is running.';
    if (error.isTimeout) return 'The server took too long to respond. Please try again.';
    return error.message || fallback;
}

export function serializeError(error) {
    if (!error) return null;
    return {
        name: error.name ?? 'Error',
        message: error.message ?? String(error),
        kind: error.kind,
        status: error.status,
        code: error.code,
        requestId: error.requestId
    };
}
