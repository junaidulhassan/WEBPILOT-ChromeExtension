import { h, icon } from '../../utils/dom.js';
import { showToast } from './toast.js';
import { renderMarkdown } from './markdown.js';

const COPY_FEEDBACK_MS = 1600;

export function createUserMessage(text) {
    return h('div', { class: 'message user' }, h('div', { class: 'message-bubble' }, text));
}

export function createTypingIndicator() {
    return h(
        'span',
        { class: 'typing-indicator', role: 'status', 'aria-label': 'Thinking' },
        h('span', { class: 'typing-dot' }),
        h('span', { class: 'typing-dot' }),
        h('span', { class: 'typing-dot' })
    );
}

export function createBotMessage() {
    const bubble = h('div', { class: 'message-bubble' });
    return h(
        'div',
        { class: 'message assistant' },
        h('div', { class: 'bot-avatar' }, icon('fa-solid fa-atom')),
        h('div', { class: 'message-content' }, bubble)
    );
}

export function getBubble(messageElement) {
    return messageElement.querySelector('.message-bubble');
}

export function showThinking(messageElement) {
    const bubble = getBubble(messageElement);
    bubble.replaceChildren(createTypingIndicator());
}

export function setMarkdown(messageElement, text) {
    getBubble(messageElement).innerHTML = renderMarkdown(text);
}

async function copyText(text, button) {
    try {
        await navigator.clipboard.writeText(text);
        button.classList.add('is-copied');
        button.title = 'Copied';
        setTimeout(() => {
            button.classList.remove('is-copied');
            button.title = 'Copy response';
        }, COPY_FEEDBACK_MS);
    } catch {
        showToast('Could not copy to the clipboard.', { type: 'warning' });
    }
}

export function addMessageActions(messageElement, text) {
    const content = messageElement.querySelector('.message-content');
    if (!content || content.querySelector('.message-actions') || !text) return;

    const copyButton = h(
        'button',
        { class: 'message-action', type: 'button', title: 'Copy response', 'aria-label': 'Copy response' },
        icon('fa-regular fa-copy action-icon-copy'),
        icon('fa-solid fa-check action-icon-done')
    );
    copyButton.addEventListener('click', () => copyText(text, copyButton));

    content.append(h('div', { class: 'message-actions' }, copyButton));
}

export function createErrorMessage(text, { onRetry } = {}) {
    const bubble = h('div', { class: 'message-bubble' }, icon('fa-solid fa-triangle-exclamation'), h('span', null, text));

    if (onRetry) {
        bubble.append(
            h('button', { class: 'retry-btn', type: 'button', onClick: onRetry }, icon('fa-solid fa-rotate-right'), ' Try again')
        );
    }

    return h('div', { class: 'message error', role: 'alert' }, bubble);
}
