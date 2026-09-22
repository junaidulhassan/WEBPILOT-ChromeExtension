importScripts('popup/logger.js');

chrome.runtime.onInstalled.addListener((details) => {
    WPLog.info('extension_installed', { reason: details.reason, previousVersion: details.previousVersion || null });
});
