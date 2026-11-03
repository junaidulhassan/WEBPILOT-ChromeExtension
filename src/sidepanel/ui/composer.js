import { PLACEHOLDER_TEXT } from '../../core/constants.js';
import { refs } from './refs.js';

const MAX_INPUT_HEIGHT_PX = 100;

const composerState = { locked: false, lockedPlaceholder: '', generating: false };

function render() {
    const { locked, lockedPlaceholder, generating } = composerState;

    refs.userInput.disabled = locked || generating;
    refs.sendBtn.disabled = locked && !generating;
    refs.sendBtn.classList.toggle('is-stop', generating);

    const label = generating ? 'Stop generating' : 'Send message';
    refs.sendBtn.title = label;
    refs.sendBtn.setAttribute('aria-label', label);

    if (generating) refs.userInput.placeholder = PLACEHOLDER_TEXT.generating;
    else if (locked) refs.userInput.placeholder = lockedPlaceholder;
    else refs.userInput.placeholder = PLACEHOLDER_TEXT.ready;
}

function autosize() {
    refs.userInput.style.height = 'auto';
    refs.userInput.style.height = `${Math.min(refs.userInput.scrollHeight, MAX_INPUT_HEIGHT_PX)}px`;
}

export function initComposer({ onSend, onStop }) {
    refs.userInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
        event.preventDefault();
        if (!composerState.generating) onSend();
    });

    refs.userInput.addEventListener('input', autosize);
    refs.sendBtn.addEventListener('click', () => (composerState.generating ? onStop() : onSend()));
    render();
}

export function getComposerValue() {
    return refs.userInput.value.trim();
}

export function clearComposer() {
    refs.userInput.value = '';
    refs.userInput.style.height = 'auto';
}

export function lockComposer(placeholder = '') {
    composerState.locked = true;
    composerState.lockedPlaceholder = placeholder;
    render();
}

export function unlockComposer({ focus = false } = {}) {
    composerState.locked = false;
    composerState.lockedPlaceholder = '';
    render();
    if (focus && !refs.userInput.disabled) refs.userInput.focus({ preventScroll: true });
}

export function setGenerating(generating) {
    composerState.generating = generating;
    render();
}
