chrome.runtime.onInstalled.addListener(() => {
    console.log('Web Pilot extension installed');
});

chrome.action.onClicked.addListener((tab) => {
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['popup.js']
    });
});
//

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            let activeTab = tabs[0];
            let activeTabId = activeTab.id;
            chrome.tabs.sendMessage(activeTabId, { message: "Tab updated", url: activeTab.url });
        });
    }
});
