import { MESSAGE_ROLES } from '../core/constants.js';
import { deriveTitle } from './format.js';

export function createConversation(tab, sourceType, now = Date.now()) {
    return {
        id: crypto.randomUUID(),
        url: tab.url,
        favIconUrl: tab.favIconUrl || null,
        sourceType,
        title: deriveTitle(tab.title, tab.url),
        createdAt: now,
        updatedAt: now,
        messages: []
    };
}

export function appendMessage(conversation, role, text, now = Date.now()) {
    conversation.messages.push({ role, text, timestamp: now });
    conversation.updatedAt = now;
}

export function toBackendHistory(messages) {
    const turns = [];
    let pendingQuestion = null;

    for (const message of messages) {
        if (message.role === MESSAGE_ROLES.user) {
            pendingQuestion = message.text;
        } else if (message.role === MESSAGE_ROLES.assistant && pendingQuestion !== null) {
            turns.push({ question: pendingQuestion, answer: message.text });
            pendingQuestion = null;
        }
    }

    return turns;
}
