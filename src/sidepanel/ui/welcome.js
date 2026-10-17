import { animateElement, h, icon } from '../../utils/dom.js';

const ROTATION_INTERVAL_MS = 2800;
const SWAP_DURATION_MS = 220;

const EXAMPLE_PROMPTS = Object.freeze([
    { text: 'Brain Storming', icon: 'fa-solid fa-brain', color: '#A78BFA' },
    { text: 'Video Summarization', icon: 'fa-solid fa-video', color: '#60A5FA' },
    { text: 'Web Content Summarizing', icon: 'fa-solid fa-globe', color: '#34D399' },
    { text: 'Research Article Analysis', icon: 'fa-solid fa-file-alt', color: '#C084FC' },
    { text: 'PDF Document Chat', icon: 'fa-solid fa-file-pdf', color: '#FBBF24' },
    { text: 'Question Answering', icon: 'fa-solid fa-circle-question', color: '#F87171' },
    { text: 'YouTube Video Analysis', icon: 'fa-brands fa-youtube', color: '#F87171' },
    { text: 'Web Content Search', icon: 'fa-solid fa-magnifying-glass', color: '#2DD4BF' },
    { text: 'Chat with Web Pages', icon: 'fa-solid fa-comments', color: '#818CF8' },
    { text: 'Text Content Analysis', icon: 'fa-solid fa-align-left', color: '#FB923C' }
]);

let rotationTimer = null;
let promptIndex = 0;
let swapping = false;

async function rotatePrompt() {
    const pill = document.getElementById('example-prompt-pill');
    if (!pill) {
        stopRotation();
        return;
    }
    if (document.hidden || swapping) return;

    swapping = true;
    try {
        const fadeOut = [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-6px)' }];
        const fadeIn = [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }];
        const timing = { duration: SWAP_DURATION_MS, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' };

        const label = pill.querySelector('#pill-text');
        const pillIcon = pill.querySelector('#pill-icon');
        const parts = [label, pillIcon];

        await Promise.all(parts.map((part) => animateElement(part, fadeOut, timing)));

        const next = EXAMPLE_PROMPTS[promptIndex];
        promptIndex = (promptIndex + 1) % EXAMPLE_PROMPTS.length;
        label.textContent = next.text;
        pillIcon.className = `${next.icon} pill-icon`;
        pillIcon.style.color = next.color;

        await Promise.all(parts.map((part) => animateElement(part, fadeIn, timing)));
        parts.forEach((part) => part.getAnimations?.().forEach((animation) => animation.cancel()));
    } finally {
        swapping = false;
    }
}

function startRotation() {
    if (rotationTimer !== null) return;
    rotationTimer = setInterval(rotatePrompt, ROTATION_INTERVAL_MS);
}

function stopRotation() {
    clearInterval(rotationTimer);
    rotationTimer = null;
    swapping = false;
}

export function buildWelcomeScreen() {
    const screen = h(
        'div',
        { id: 'welcome-screen' },
        h(
            'div',
            { class: 'welcome-icon-wrap' },
            h('img', { src: '../../icons/webpilot-logo-black-theme-148.png', alt: '', class: 'welcome-logo welcome-logo-for-dark' }),
            h('img', { src: '../../icons/webpilot-logo-black-white-theme-148.png', alt: '', class: 'welcome-logo welcome-logo-for-light' }),
            h('div', { class: 'welcome-glow' })
        ),
        h('h2', { class: 'welcome-title' }, 'WebPilot AI'),
        h('p', { class: 'welcome-sub' }, 'Explore large contents in seconds ✨'),
        h(
            'div',
            { id: 'example-prompt-pill', class: 'prompt-pill' },
            icon('fa-regular fa-lightbulb pill-icon'),
            h('span', { id: 'pill-text' }, 'Brain Storming')
        )
    );

    screen.querySelector('.pill-icon').id = 'pill-icon';
    startRotation();
    return screen;
}
