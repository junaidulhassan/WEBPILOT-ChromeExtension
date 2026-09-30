const WP_LOG_KEY = 'wp_activity_log';
const WP_LOG_MAX_ENTRIES = 300;

function wpLogEntry(level, event, data) {
    const entry = { level, event, data: data ?? null, timestamp: Date.now() };
    const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
    consoleFn(`[WebPilot] ${event}`, data ?? '');

    try {
        chrome.storage.local.get([WP_LOG_KEY], (result) => {
            const log = result[WP_LOG_KEY] || [];
            log.push(entry);
            if (log.length > WP_LOG_MAX_ENTRIES) {
                log.splice(0, log.length - WP_LOG_MAX_ENTRIES);
            }
            chrome.storage.local.set({ [WP_LOG_KEY]: log });
        });
    } catch (error) {
        console.error('[WebPilot] failed to persist log entry', error);
    }
}

const WPLog = {
    info(event, data)  { wpLogEntry('info', event, data); },
    warn(event, data)  { wpLogEntry('warn', event, data); },
    error(event, data) { wpLogEntry('error', event, data); }
};

function wpGetActivityLog() {
    return new Promise((resolve) => {
        chrome.storage.local.get([WP_LOG_KEY], (result) => {
            resolve(result[WP_LOG_KEY] || []);
        });
    });
}

function wpClearActivityLog() {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [WP_LOG_KEY]: [] }, resolve);
    });
}
