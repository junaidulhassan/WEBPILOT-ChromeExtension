import { createLogger } from '../core/logger.js';
import { isYouTubeUrl } from '../utils/source.js';

const log = createLogger('tabs');

const SETTLE_DELAY_MS = 150;
const SPA_NAVIGATION_DELAY_MS = 600;

const ACTIVE_TAB_QUERIES = Object.freeze([
    { active: true, currentWindow: true },
    { active: true, lastFocusedWindow: true }
]);

export async function queryActiveTab() {
    for (const query of ACTIVE_TAB_QUERIES) {
        const [tab] = await chrome.tabs.query(query);
        if (tab) return tab;
    }
    log.warn('active_tab_not_found');
    return null;
}

export async function findOpenTabByUrl(url) {
    const tabs = await chrome.tabs.query({}).catch(() => []);
    return tabs.find((tab) => tab.url === url) ?? null;
}

export function watchActiveTab(onTabChange) {
    let windowId = null;
    let settleTimer = null;

    async function resolveWindowId() {
        if (windowId === null) {
            const current = await chrome.windows.getCurrent();
            windowId = current.id;
        }
        return windowId;
    }

    function schedule(tabId, delayMs) {
        clearTimeout(settleTimer);
        settleTimer = setTimeout(async () => {
            const tab = await chrome.tabs.get(tabId).catch(() => null);
            if (!tab?.active) return;

            try {
                await onTabChange(tab);
            } catch (error) {
                log.error('tab_change_handler_failed', { tabId, error });
            }
        }, delayMs);
    }

    chrome.tabs.onActivated.addListener(async ({ tabId, windowId: activatedWindowId }) => {
        if (activatedWindowId !== (await resolveWindowId())) return;
        schedule(tabId, SETTLE_DELAY_MS);
    });

    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
        if (!tab.active || tab.windowId !== (await resolveWindowId())) return;

        if (changeInfo.status === 'complete') {
            schedule(tabId, SETTLE_DELAY_MS);
        } else if (changeInfo.url && isYouTubeUrl(changeInfo.url)) {
            schedule(tabId, SPA_NAVIGATION_DELAY_MS);
        }
    });
}
