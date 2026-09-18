const WP_CONVERSATIONS_KEY = 'wp_conversations';
const WP_TAB_MAP_KEY       = 'wp_tab_conversation_map';

function wpGetAllConversations() {
    return new Promise((resolve) => {
        chrome.storage.local.get([WP_CONVERSATIONS_KEY], (result) => {
            resolve(result[WP_CONVERSATIONS_KEY] || {});
        });
    });
}

async function wpSaveConversation(conversation) {
    const all = await wpGetAllConversations();
    all[conversation.id] = conversation;
    return new Promise((resolve) => {
        chrome.storage.local.set({ [WP_CONVERSATIONS_KEY]: all }, resolve);
    });
}

async function wpDeleteConversation(id) {
    const all = await wpGetAllConversations();
    delete all[id];
    await new Promise((resolve) => {
        chrome.storage.local.set({ [WP_CONVERSATIONS_KEY]: all }, resolve);
    });
    await wpUnmapConversationFromAllTabs(id);
}

function wpClearAllConversations() {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [WP_CONVERSATIONS_KEY]: {}, [WP_TAB_MAP_KEY]: {} }, resolve);
    });
}

function wpGetTabMap() {
    return new Promise((resolve) => {
        chrome.storage.local.get([WP_TAB_MAP_KEY], (result) => {
            resolve(result[WP_TAB_MAP_KEY] || {});
        });
    });
}

async function wpSetTabConversation(tabId, conversationId) {
    const map = await wpGetTabMap();
    map[tabId] = conversationId;
    return new Promise((resolve) => {
        chrome.storage.local.set({ [WP_TAB_MAP_KEY]: map }, resolve);
    });
}

async function wpUnmapConversationFromAllTabs(conversationId) {
    const map = await wpGetTabMap();
    let changed = false;
    for (const tabId of Object.keys(map)) {
        if (map[tabId] === conversationId) {
            delete map[tabId];
            changed = true;
        }
    }
    if (!changed) return;
    return new Promise((resolve) => {
        chrome.storage.local.set({ [WP_TAB_MAP_KEY]: map }, resolve);
    });
}
