export const API_BASE_URL = 'http://127.0.0.1:8000';

export const STORAGE_KEYS = Object.freeze({
    conversations: 'wp_conversations',
    tabMap: 'wp_tab_conversation_map',
    activityLog: 'wp_activity_log'
});

export const PREFERENCE_KEYS = Object.freeze({
    theme: 'wp-theme',
    model: 'wp-model',
    tone: 'wp-tone',
    embedding: 'wp-embedding'
});

export const PREFERENCE_DEFAULTS = Object.freeze({
    theme: 'dark',
    model: 'gemini',
    tone: 'detailed',
    embedding: 'gemini-embedding'
});

export const TIMEOUTS_MS = Object.freeze({
    default: 15000,
    processPage: 120000,
    embedding: 120000,
    chatConnect: 60000
});

export const LIMITS = Object.freeze({
    maxConversations: 200,
    maxLogEntries: 300,
    maxMessageLength: 8000,
    titleLength: 80,
    snippetLength: 90,
    visibleToasts: 3
});

export const SOURCE_TYPES = Object.freeze({
    website: 'website',
    pdf: 'pdf',
    youtube: 'youtube'
});

export const MESSAGE_ROLES = Object.freeze({
    user: 'user',
    assistant: 'assistant',
    error: 'error'
});

export const PLACEHOLDER_TEXT = Object.freeze({
    ready: 'Ask me anything...',
    loadingPage: 'Loading page content...',
    generating: 'Generating response...',
    reloading: 'Reloading conversation context...',
    unavailable: 'Chat unavailable for this page'
});
