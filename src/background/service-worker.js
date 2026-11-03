import { createLogger, flushLogs } from '../core/logger.js';
import { clearTabMap, removeTabMapping } from '../storage/conversation-store.js';

const log = createLogger('background');

async function configureSidePanel() {
    try {
        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    } catch (error) {
        log.error('side_panel_behavior_failed', { error });
    }
}

chrome.runtime.onInstalled.addListener((details) => {
    log.info('extension_installed', { reason: details.reason, previousVersion: details.previousVersion ?? null });
    flushLogs();
});

chrome.runtime.onStartup.addListener(async () => {
    log.info('browser_started');
    await clearTabMap().catch((error) => log.error('tab_map_reset_failed', { error }));
    flushLogs();
});

chrome.tabs.onRemoved.addListener((tabId) => {
    removeTabMapping(tabId).catch((error) => log.error('tab_mapping_cleanup_failed', { tabId, error }));
});

configureSidePanel();
