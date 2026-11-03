const API_PREFIX = '/api/v1';

export const ENDPOINTS = Object.freeze({
    health: '/health',
    processPage: `${API_PREFIX}/pages/process`,
    chatStream: `${API_PREFIX}/chat/stream`,
    chatMemory: `${API_PREFIX}/chat/memory`,
    currentModel: `${API_PREFIX}/models/current`,
    currentTone: `${API_PREFIX}/tones/current`,
    currentEmbedding: `${API_PREFIX}/embeddings/current`
});
