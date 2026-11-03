import { prefersReducedMotion } from '../../utils/dom.js';
import { refs } from './refs.js';

const NEAR_BOTTOM_THRESHOLD_PX = 80;

let followingBottom = true;
let programmaticScroll = false;

function isNearBottom() {
    const { scrollHeight, scrollTop, clientHeight } = refs.chatMessages;
    return scrollHeight - scrollTop - clientHeight < NEAR_BOTTOM_THRESHOLD_PX;
}

function syncButtonVisibility() {
    refs.scrollBottomBtn.classList.toggle('is-visible', !followingBottom);
    refs.scrollBottomBtn.tabIndex = followingBottom ? -1 : 0;
}

export function scrollToBottom({ smooth = false, force = false } = {}) {
    if (!force && !followingBottom) return;

    followingBottom = true;
    syncButtonVisibility();

    const behavior = smooth && !prefersReducedMotion() ? 'smooth' : 'auto';
    programmaticScroll = behavior === 'smooth';
    refs.chatMessages.scrollTo({ top: refs.chatMessages.scrollHeight, behavior });
}

export function resetScrollFollowing() {
    followingBottom = true;
    syncButtonVisibility();
}

export function initScroll() {
    refs.chatMessages.addEventListener(
        'scroll',
        () => {
            if (programmaticScroll) return;
            followingBottom = isNearBottom();
            syncButtonVisibility();
        },
        { passive: true }
    );

    refs.chatMessages.addEventListener('scrollend', () => {
        programmaticScroll = false;
        followingBottom = isNearBottom();
        syncButtonVisibility();
    });

    refs.scrollBottomBtn.addEventListener('click', () => scrollToBottom({ smooth: true, force: true }));
}
