importScripts('sidepanel/logger.js');

chrome.runtime.onInstalled.addListener((details) => {
    WPLog.info('extension_installed', { reason: details.reason, previousVersion: details.previousVersion || null });
});

// Makes the toolbar icon open the side panel directly instead of a popup.
chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => WPLog.error('side_panel_behavior_failed', { error: String(error) }));
