import { MESSAGE_ROLES } from '../../core/constants.js';
import { replayAnimation } from '../../utils/dom.js';
import { addMessageActions, createBotMessage, createErrorMessage, createUserMessage, setMarkdown } from './messages.js';
import { refs } from './refs.js';
import { resetScrollFollowing, scrollToBottom } from './scroll.js';
import { buildWelcomeScreen } from './welcome.js';

function buildHistoryMessage(message) {
    if (message.role === MESSAGE_ROLES.user) return createUserMessage(message.text);

    if (message.role === MESSAGE_ROLES.assistant) {
        const element = createBotMessage();
        setMarkdown(element, message.text);
        addMessageActions(element, message.text);
        return element;
    }

    if (message.role === MESSAGE_ROLES.error) return createErrorMessage(message.text);
    return null;
}

export function renderConversation(conversation) {
    refs.chatMessages.replaceChildren();
    resetScrollFollowing();
    replayAnimation(refs.chatMessages, 'is-swapping');

    if (!conversation.messages.length) {
        refs.chatMessages.append(buildWelcomeScreen());
        return;
    }

    const fragment = document.createDocumentFragment();
    for (const message of conversation.messages) {
        const element = buildHistoryMessage(message);
        if (!element) continue;
        element.classList.add('is-restored');
        fragment.append(element);
    }

    refs.chatMessages.append(fragment);
    scrollToBottom({ force: true });
}

export function clearMessages() {
    refs.chatMessages.replaceChildren();
}

export function removeWelcome() {
    refs.chatMessages.querySelector('#welcome-screen')?.remove();
}

export function appendUserMessage(text) {
    removeWelcome();
    const element = createUserMessage(text);
    refs.chatMessages.append(element);
    scrollToBottom({ smooth: true, force: true });
    return element;
}

export function appendBotMessage() {
    const element = createBotMessage();
    refs.chatMessages.append(element);
    scrollToBottom({ force: true });
    return element;
}

export function appendError(text, options) {
    removeErrors();
    const element = createErrorMessage(text, options);
    refs.chatMessages.append(element);
    scrollToBottom({ smooth: true, force: true });
    return element;
}

export function removeErrors() {
    refs.chatMessages.querySelectorAll('.message.error').forEach((element) => element.remove());
}
