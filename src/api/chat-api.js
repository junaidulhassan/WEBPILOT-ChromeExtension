import { ENDPOINTS } from './endpoints.js';
import { request, requestTextStream } from './http-client.js';

export function streamAnswer(message, { signal } = {}) {
    return requestTextStream(ENDPOINTS.chatStream, { body: { message }, signal });
}

export function resetChatMemory({ signal } = {}) {
    return request(ENDPOINTS.chatMemory, { method: 'DELETE', signal });
}
