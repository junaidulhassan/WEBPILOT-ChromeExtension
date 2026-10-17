import { LIMITS } from '../../core/constants.js';
import { animateElement, h, icon } from '../../utils/dom.js';
import { formatHistoryDate, truncate } from '../../utils/format.js';
import { hostnameOf, sourceIcon } from '../../utils/source.js';
import { bindConfirmClick } from './confirm.js';
import { refs } from './refs.js';

const MAX_STAGGERED_ITEMS = 10;
const REMOVE_DURATION_MS = 240;

function lastReadableMessage(conversation) {
    return [...conversation.messages].reverse().find((message) => message.role !== 'error');
}

async function removeWithAnimation(element) {
    const height = element.offsetHeight;
    await animateElement(
        element,
        [
            { height: `${height}px`, opacity: 1, marginBottom: '0.5rem' },
            { height: '0px', opacity: 0, marginBottom: '0px', paddingTop: '0px', paddingBottom: '0px', borderWidth: '0px' }
        ],
        { duration: REMOVE_DURATION_MS, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' }
    );
    element.remove();
}

function buildHistoryItem(conversation, index, { onOpen, onDelete }) {
    const lastMessage = lastReadableMessage(conversation);

    const deleteButton = h(
        'button',
        { class: 'history-item-delete', type: 'button', title: 'Delete conversation', 'aria-label': 'Delete conversation' },
        icon('fa-solid fa-trash')
    );

    const body = h(
        'div',
        { class: 'history-item-body', tabindex: '0', role: 'button' },
        h('div', { class: 'history-item-title' }, conversation.title),
        h(
            'div',
            { class: 'history-item-meta' },
            h('span', null, formatHistoryDate(conversation.updatedAt)),
            h('span', { class: 'history-item-dot' }, '•'),
            h('span', { class: 'history-item-source' }, hostnameOf(conversation.url))
        ),
        lastMessage ? h('div', { class: 'history-item-snippet' }, truncate(lastMessage.text, LIMITS.snippetLength)) : null
    );

    const item = h(
        'div',
        { class: 'history-item', style: `--i: ${Math.min(index, MAX_STAGGERED_ITEMS)}` },
        h('div', { class: 'history-item-icon' }, icon(sourceIcon(conversation.sourceType))),
        body,
        deleteButton
    );

    body.addEventListener('click', () => onOpen(conversation.id));
    body.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onOpen(conversation.id);
        }
    });

    bindConfirmClick(deleteButton, async () => {
        await onDelete(conversation.id);
        await removeWithAnimation(item);
        syncEmptyState();
    });

    return item;
}

function syncEmptyState() {
    const isEmpty = refs.historyList.children.length === 0;
    refs.historyEmpty.classList.toggle('hidden', !isEmpty);
}

export function renderHistoryList(conversations, handlers) {
    const sorted = Object.values(conversations).sort((a, b) => b.updatedAt - a.updatedAt);
    refs.historyList.replaceChildren(...sorted.map((conversation, index) => buildHistoryItem(conversation, index, handlers)));
    syncEmptyState();
}
