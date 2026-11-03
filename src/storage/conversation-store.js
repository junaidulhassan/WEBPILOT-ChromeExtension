import { LIMITS, STORAGE_KEYS } from '../core/constants.js';
import { createLogger } from '../core/logger.js';
import { createStore } from './chrome-storage.js';

const log = createLogger('storage');

const conversationsStore = createStore(STORAGE_KEYS.conversations, () => ({}));
const tabMapStore = createStore(STORAGE_KEYS.tabMap, () => ({}));

function pruneOldest(conversations) {
    const ids = Object.keys(conversations);
    const overflow = ids.length - LIMITS.maxConversations;
    if (overflow <= 0) return conversations;

    ids.sort((a, b) => conversations[a].updatedAt - conversations[b].updatedAt)
        .slice(0, overflow)
        .forEach((id) => delete conversations[id]);

    log.info('conversations_pruned', { removed: overflow });
    return conversations;
}

export function getAllConversations() {
    return conversationsStore.read();
}

export async function getConversation(id) {
    const all = await conversationsStore.read();
    return all[id] ?? null;
}

export function saveConversation(conversation) {
    return conversationsStore.update((all) => {
        all[conversation.id] = conversation;
        return pruneOldest(all);
    });
}

export async function deleteConversation(id) {
    await conversationsStore.update((all) => {
        delete all[id];
    });
    await unmapConversation(id);
}

export async function clearAllConversations() {
    await conversationsStore.replace({});
    await tabMapStore.replace({});
}

export function getTabMap() {
    return tabMapStore.read();
}

export function setTabConversation(tabId, conversationId) {
    return tabMapStore.update((map) => {
        map[tabId] = conversationId;
    });
}

export async function removeTabMapping(tabId) {
    const map = await tabMapStore.read();
    if (!(tabId in map)) return;
    await tabMapStore.update((current) => {
        delete current[tabId];
    });
}

export function clearTabMap() {
    return tabMapStore.replace({});
}

async function unmapConversation(conversationId) {
    const map = await tabMapStore.read();
    if (!Object.values(map).includes(conversationId)) return;

    await tabMapStore.update((current) => {
        for (const [tabId, mappedId] of Object.entries(current)) {
            if (mappedId === conversationId) delete current[tabId];
        }
    });
}
