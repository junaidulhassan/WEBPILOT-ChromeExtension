// ─── Theme Management ─────────────────────────────────────────────────────────
function getTheme() {
    return localStorage.getItem('wp-theme') || 'dark';
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('wp-theme', theme);

    // Update theme buttons
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });
}

// ─── Model Management ─────────────────────────────────────────────────────────
const DEFAULT_MODEL_ID = 'gemini';

function getSelectedModel() {
    return localStorage.getItem('wp-model') || DEFAULT_MODEL_ID;
}

function applyModelSelection(modelId) {
    localStorage.setItem('wp-model', modelId);
    document.querySelectorAll('.model-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.model === modelId);
    });
}

// Tells the backend which model to answer with from now on. This only swaps
// the LLM instance — conversation memory and the loaded page's retriever are
// untouched — so switching models never interrupts or resets the ongoing chat.
async function syncModelToBackend(modelId) {
    try {
        await fetch('http://127.0.0.1:8000/set_model', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: modelId })
        });
    } catch (error) {
        WPLog.error('set_model_request_failed', { modelId, error: String(error) });
    }
}

async function selectModel(modelId) {
    const previous = getSelectedModel();
    applyModelSelection(modelId);
    WPLog.info('model_switched', { from: previous, to: modelId });
    await syncModelToBackend(modelId);
}

// ─── Personality / Tone Management ─────────────────────────────────────────────
const DEFAULT_TONE_ID = 'detailed';

function getSelectedTone() {
    return localStorage.getItem('wp-tone') || DEFAULT_TONE_ID;
}

function applyToneSelection(toneId) {
    localStorage.setItem('wp-tone', toneId);
    document.querySelectorAll('.tone-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.tone === toneId);
    });
}

// Tells the backend which response style to use from now on. This only
// changes how the next reply is phrased — conversation memory and the loaded
// page's retriever are untouched — so switching tones never interrupts or
// resets the ongoing chat.
async function syncToneToBackend(toneId) {
    try {
        await fetch('http://127.0.0.1:8000/set_tone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tone: toneId })
        });
    } catch (error) {
        WPLog.error('set_tone_request_failed', { toneId, error: String(error) });
    }
}

async function selectTone(toneId) {
    const previous = getSelectedTone();
    applyToneSelection(toneId);
    WPLog.info('tone_switched', { from: previous, to: toneId });
    await syncToneToBackend(toneId);
}

function openToneDropdown() {
    document.getElementById('tone-dropdown').classList.remove('hidden');
}

function closeToneDropdown() {
    document.getElementById('tone-dropdown').classList.add('hidden');
}

function toggleToneDropdown(event) {
    event.stopPropagation();
    document.getElementById('tone-dropdown').classList.toggle('hidden');
}

// ─── Settings Drawer ──────────────────────────────────────────────────────────
function openSettings() {
    document.getElementById('settings-overlay').classList.remove('hidden');
    document.getElementById('settings-drawer').classList.remove('hidden');
}

function closeSettings() {
    document.getElementById('settings-overlay').classList.add('hidden');
    document.getElementById('settings-drawer').classList.add('hidden');
}

// ─── Event Listeners ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    WPLog.info('popup_opened');
    applyTheme(getTheme());
    applyModelSelection(getSelectedModel());
    syncModelToBackend(getSelectedModel());
    applyToneSelection(getSelectedTone());
    syncToneToBackend(getSelectedTone());
    processPage();
});

document.getElementById('send-btn').addEventListener('click', sendMessage);
document.getElementById('user-input').addEventListener('keypress', checkEnter);
document.getElementById('clear-chat-btn').addEventListener('click', clearChatHistory);
document.getElementById('settings-btn').addEventListener('click', openSettings);
document.getElementById('settings-close-btn').addEventListener('click', closeSettings);
document.getElementById('settings-overlay').addEventListener('click', closeSettings);

document.getElementById('tone-btn').addEventListener('click', toggleToneDropdown);
document.addEventListener('click', (event) => {
    const dropdown = document.getElementById('tone-dropdown');
    const btn = document.getElementById('tone-btn');
    if (!dropdown.contains(event.target) && !btn.contains(event.target)) {
        closeToneDropdown();
    }
});

document.getElementById('history-btn').addEventListener('click', openHistoryDrawer);
document.getElementById('history-close-btn').addEventListener('click', closeHistoryDrawer);
document.getElementById('history-overlay').addEventListener('click', closeHistoryDrawer);
document.getElementById('history-clear-all-btn').addEventListener('click', async () => {
    if (confirm('Clear all saved conversations? This cannot be undone.')) {
        await wpClearAllConversations();
        WPLog.info('history_cleared_all');
        renderHistoryList();
    }
});

document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        WPLog.info('theme_changed', { theme: btn.dataset.theme });
        applyTheme(btn.dataset.theme);
    });
});

document.querySelectorAll('.model-btn').forEach(btn => {
    btn.addEventListener('click', () => selectModel(btn.dataset.model));
});

document.querySelectorAll('.tone-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        selectTone(chip.dataset.tone);
        closeToneDropdown();
    });
});

// Auto-resize textarea
document.getElementById('user-input').addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
});

// ─── Animated Example Prompts ─────────────────────────────────────────────────
const wordsAndIcons = [
    { text: "Brain Storming",               icon: "fa-solid fa-brain",           color: "#A78BFA" },
    { text: "Video Summarization",          icon: "fa-solid fa-video",           color: "#60A5FA" },
    { text: "Web Content Summarizing",      icon: "fa-solid fa-globe",           color: "#34D399" },
    { text: "Research Article Analysis",    icon: "fa-solid fa-file-alt",        color: "#C084FC" },
    { text: "PDF Document Chat",            icon: "fa-solid fa-file-pdf",        color: "#FBBF24" },
    { text: "Question Answering",           icon: "fa-solid fa-circle-question", color: "#F87171" },
    { text: "YouTube Video Analysis",       icon: "fa-brands fa-youtube",        color: "#F87171" },
    { text: "Web Content Search",           icon: "fa-solid fa-magnifying-glass",color: "#2DD4BF" },
    { text: "Chat with Web Pages",          icon: "fa-solid fa-comments",        color: "#818CF8" },
    { text: "Text Content Analysis",        icon: "fa-solid fa-align-left",      color: "#FB923C" },
];

let currentIndex = 0;
const pillText = document.getElementById('pill-text');
const pillIcon = document.getElementById('pill-icon');

function updatePromptPill() {
    pillText.style.opacity = '0';
    pillIcon.style.opacity = '0';

    setTimeout(() => {
        const item = wordsAndIcons[currentIndex];
        pillText.textContent = item.text;
        pillIcon.className   = item.icon + ' pill-icon';
        pillIcon.style.color = item.color;

        pillText.style.opacity = '1';
        pillIcon.style.opacity = '1';

        currentIndex = (currentIndex + 1) % wordsAndIcons.length;
    }, 350);
}

setInterval(updatePromptPill, 2800);

// ─── Page Processing ──────────────────────────────────────────────────────────
let currentTab = null;
let currentConversation = null;

async function processPage() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;
    const url  = tab.url;
    document.getElementById('web-link').textContent = url;

    if (isIrrelevantTab(url)) {
        WPLog.warn('page_irrelevant_tab', { url });
        showError("This tab can't be analysed. Please open a website, PDF, or YouTube video.");
        return;
    }

    const sourceType = detectSourceType(url);
    WPLog.info('page_process_start', { url, sourceType });

    // Resume the conversation already tied to this tab if it's still the same page.
    const tabMap   = await wpGetTabMap();
    const allConvs = await wpGetAllConversations();
    const mappedId = tabMap[tab.id];
    const resuming = !!(mappedId && allConvs[mappedId] && allConvs[mappedId].url === url);

    currentConversation = resuming ? allConvs[mappedId] : createConversation(tab, sourceType);
    renderConversationMessages(currentConversation);

    showLoading(true);
    showUrlLoading(true);
    disableChatInput(true, "Loading page content...");

    try {
        let payload;

        if (sourceType === 'pdf') {
            payload = { url, text: "PDF file" };
        } else if (sourceType === 'youtube') {
            payload = { url, text: "YouTube video" };
        } else {
            const [result] = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => document.body.innerText
            });
            payload = { url, text: result.result };
        }

        payload.history = resuming ? toBackendHistory(currentConversation.messages) : [];

        await postProcessPage(payload);
        WPLog.info('page_process_success', { url, sourceType, resuming });
        disableChatInput(false, "");

    } catch (error) {
        WPLog.error('page_process_failed', { url, sourceType, error: String(error) });
        showError("Could not connect to backend. Make sure the server is running.");
    } finally {
        showLoading(false);
        showUrlLoading(false);
    }
}

async function postProcessPage(payload) {
    const response = await fetch('http://127.0.0.1:8000/process_page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `Server error ${response.status}`);
    }

    return response;
}

function isIrrelevantTab(url) {
    return /^(chrome:\/\/|chrome-extension:\/\/|brave:\/\/|edge:\/\/|about:|data:|file:\/\/(?!.*\.pdf))/.test(url);
}

function isYouTubeUrl(url) {
    return /^https?:\/\/(www\.)?(youtube|youtu|youtube-nocookie)\.(com|be)\/.+/i.test(url);
}

function detectSourceType(url) {
    if (url.endsWith('.pdf')) return 'pdf';
    if (isYouTubeUrl(url)) return 'youtube';
    return 'website';
}

function sourceIcon(sourceType) {
    return {
        pdf: 'fa-solid fa-file-pdf',
        youtube: 'fa-brands fa-youtube',
        website: 'fa-solid fa-globe'
    }[sourceType] || 'fa-solid fa-globe';
}

function deriveTitle(tabTitle, url) {
    if (tabTitle && tabTitle.trim()) return tabTitle.trim().slice(0, 80);
    try { return new URL(url).hostname; } catch { return url.slice(0, 80); }
}

function createConversation(tab, sourceType) {
    return {
        id: crypto.randomUUID(),
        url: tab.url,
        sourceType,
        title: deriveTitle(tab.title, tab.url),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: []
    };
}

// Convert stored {role, text} messages into oldest-first {question, answer}
// pairs the backend can replay into its conversational memory.
function toBackendHistory(messages) {
    const pairs = [];
    let pendingQuestion = null;
    for (const msg of messages) {
        if (msg.role === 'user') {
            pendingQuestion = msg.text;
        } else if (msg.role === 'assistant' && pendingQuestion !== null) {
            pairs.push({ question: pendingQuestion, answer: msg.text });
            pendingQuestion = null;
        }
    }
    return pairs;
}

function appendMessageToConversation(role, text) {
    if (!currentConversation) return;
    currentConversation.messages.push({ role, text, timestamp: Date.now() });
    currentConversation.updatedAt = Date.now();
}

async function persistCurrentConversation() {
    if (!currentConversation || !currentTab) return;
    await wpSaveConversation(currentConversation);
    await wpSetTabConversation(currentTab.id, currentConversation.id);
}

function renderConversationMessages(conversation) {
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML = '';

    if (!conversation.messages.length) {
        chatMessages.appendChild(buildWelcomeScreen());
        isFirstMessage = true;
        return;
    }

    isFirstMessage = false;
    for (const msg of conversation.messages) {
        if (msg.role === 'user') {
            chatMessages.appendChild(createUserMessage(msg.text));
        } else if (msg.role === 'assistant') {
            const botEl = createBotMessage();
            botEl.querySelector('.message-bubble').innerHTML = convertToMarkdown(msg.text);
            chatMessages.appendChild(botEl);
        } else if (msg.role === 'error') {
            chatMessages.appendChild(createErrorMessage(msg.text));
        }
    }
    scrollToBottom();
}

// ─── Messaging ────────────────────────────────────────────────────────────────
let isFirstMessage = true;

async function sendMessage() {
    const userInput = document.getElementById("user-input").value.trim();
    if (!userInput) return;

    const chatMessages = document.getElementById("chat-messages");

    if (isFirstMessage) {
        chatMessages.innerHTML = "";
        isFirstMessage = false;
    }

    // Render user message
    chatMessages.appendChild(createUserMessage(userInput));
    appendMessageToConversation('user', userInput);
    WPLog.info('message_sent', { length: userInput.length, model: getSelectedModel(), tone: getSelectedTone() });

    // Reset input
    const inputEl = document.getElementById("user-input");
    inputEl.value = "";
    inputEl.style.height = 'auto';

    disableChatInput(true, "Generating response...");
    showLoading(true);

    // Show the bot's reply bubble right away with a pulsing "Thinking…"
    // placeholder, so the slot is never left blank while the model works —
    // it gets overwritten by the real answer as soon as it starts streaming in.
    const botEl = createBotMessage();
    chatMessages.appendChild(botEl);
    const bubble = botEl.querySelector('.message-bubble');
    bubble.innerHTML = '<span class="thinking-text">Thinking…</span>';
    scrollToBottom();

    try {
        const response = await fetch('http://127.0.0.1:8000/generate_response', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userInput })
        });

        if (!response.ok || !response.body) throw new Error(`Server error ${response.status}`);

        const botResponse = await streamRenderResponse(response.body, bubble);
        appendMessageToConversation('assistant', botResponse || "Sorry, I couldn't generate a response. Please try again.");
        WPLog.info('message_response_success', { responseLength: botResponse.length });

    } catch (error) {
        WPLog.error('message_response_failed', { error: String(error) });
        botEl.remove();
        chatMessages.appendChild(createErrorMessage("Error retrieving response. Please check your connection."));
        appendMessageToConversation('error', "Error retrieving response. Please check your connection.");
    } finally {
        showLoading(false);
        disableChatInput(false, "Ask me anything...");
        scrollToBottom();
        await persistCurrentConversation();
    }
}

function checkEnter(event) {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// ─── Message Builders ─────────────────────────────────────────────────────────
function createUserMessage(text) {
    const wrapper = document.createElement('div');
    wrapper.classList.add('message', 'user');
    const bubble = document.createElement('div');
    bubble.classList.add('message-bubble');
    bubble.textContent = text;
    wrapper.appendChild(bubble);
    return wrapper;
}

function createBotMessage() {
    const wrapper = document.createElement('div');
    wrapper.classList.add('message', 'assistant');

    const avatar = document.createElement('div');
    avatar.classList.add('bot-avatar');
    avatar.innerHTML = '<i class="fa-solid fa-atom"></i>';

    const bubble = document.createElement('div');
    bubble.classList.add('message-bubble');

    wrapper.appendChild(avatar);
    wrapper.appendChild(bubble);
    return wrapper;
}

function createErrorMessage(text) {
    const wrapper = document.createElement('div');
    wrapper.classList.add('message', 'error');
    const bubble = document.createElement('div');
    bubble.classList.add('message-bubble');
    bubble.innerHTML = `<i class="fa fa-triangle-exclamation"></i>${text}`;
    wrapper.appendChild(bubble);
    return wrapper;
}

// ─── Chat History ─────────────────────────────────────────────────────────────
// Starts a fresh conversation thread for the current tab. The old thread is
// NOT deleted — it stays saved and browsable from the History drawer.
async function clearChatHistory() {
    if (!currentTab) return;

    currentConversation = createConversation(currentTab, detectSourceType(currentTab.url));
    renderConversationMessages(currentConversation);
}

// ─── Conversation History Drawer ───────────────────────────────────────────────
async function renderHistoryList() {
    const listEl  = document.getElementById('history-list');
    const emptyEl = document.getElementById('history-empty');
    const all     = await wpGetAllConversations();
    const items   = Object.values(all).sort((a, b) => b.updatedAt - a.updatedAt);

    listEl.innerHTML = '';

    if (!items.length) {
        emptyEl.classList.remove('hidden');
        return;
    }
    emptyEl.classList.add('hidden');

    for (const conv of items) {
        listEl.appendChild(buildHistoryItem(conv));
    }
}

function buildHistoryItem(conv) {
    const item = document.createElement('div');
    item.classList.add('history-item');

    const lastMsg = [...conv.messages].reverse().find((m) => m.role !== 'error');
    let hostname = conv.url;
    try { hostname = new URL(conv.url).hostname; } catch { /* keep raw url */ }

    item.innerHTML = `
        <div class="history-item-icon"><i class="${sourceIcon(conv.sourceType)}"></i></div>
        <div class="history-item-body">
            <div class="history-item-title">${escapeHtml(conv.title)}</div>
            <div class="history-item-meta">
                <span>${formatHistoryDate(conv.updatedAt)}</span>
                <span class="history-item-dot">•</span>
                <span class="history-item-source">${escapeHtml(hostname)}</span>
            </div>
            ${lastMsg ? `<div class="history-item-snippet">${escapeHtml(lastMsg.text.slice(0, 90))}</div>` : ''}
        </div>
        <button class="history-item-delete" title="Delete conversation"><i class="fa-solid fa-trash"></i></button>
    `;

    item.querySelector('.history-item-body').addEventListener('click', () => openConversationFromHistory(conv.id));
    item.querySelector('.history-item-delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Delete "${conv.title}"? This can't be undone.`)) {
            await wpDeleteConversation(conv.id);
            WPLog.info('history_conversation_deleted', { id: conv.id });
            renderHistoryList();
        }
    });

    return item;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
}

function formatHistoryDate(ts) {
    const d   = new Date(ts);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return `Today, ${time}`;
    if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;

    const dateOpts = { month: 'short', day: 'numeric' };
    if (d.getFullYear() !== now.getFullYear()) dateOpts.year = 'numeric';
    return `${d.toLocaleDateString([], dateOpts)}, ${time}`;
}

function openHistoryDrawer() {
    renderHistoryList();
    document.getElementById('history-overlay').classList.remove('hidden');
    document.getElementById('history-drawer').classList.remove('hidden');
}

function closeHistoryDrawer() {
    document.getElementById('history-overlay').classList.add('hidden');
    document.getElementById('history-drawer').classList.add('hidden');
}

// Reopens a saved conversation: restores its messages instantly, then tries
// to reload its source content into the backend (re-fetching PDF/YouTube by
// URL, or re-scraping the matching open tab for a website) so the model has
// the right context and the chat can continue naturally.
async function openConversationFromHistory(id) {
    const all = await wpGetAllConversations();
    const conversation = all[id];
    if (!conversation) return;

    WPLog.info('history_conversation_opened', { id, sourceType: conversation.sourceType });
    closeHistoryDrawer();

    currentConversation = conversation;
    document.getElementById('web-link').textContent = conversation.url;
    renderConversationMessages(conversation);

    if (currentTab) {
        await wpSetTabConversation(currentTab.id, conversation.id);
    }

    showLoading(true);
    showUrlLoading(true);
    disableChatInput(true, "Reloading conversation context...");

    try {
        const history = toBackendHistory(conversation.messages);

        if (conversation.sourceType === 'pdf') {
            await postProcessPage({ url: conversation.url, text: "PDF file", history });
            disableChatInput(false, "");
        } else if (conversation.sourceType === 'youtube') {
            await postProcessPage({ url: conversation.url, text: "YouTube video", history });
            disableChatInput(false, "");
        } else {
            const matchTabs = await chrome.tabs.query({ url: conversation.url }).catch(() => []);
            const matchTab  = matchTabs && matchTabs[0];

            if (matchTab) {
                const [result] = await chrome.scripting.executeScript({
                    target: { tabId: matchTab.id },
                    func: () => document.body.innerText
                });
                await postProcessPage({ url: conversation.url, text: result.result, history });
                disableChatInput(false, "");
            } else {
                let hostname = conversation.url;
                try { hostname = new URL(conversation.url).hostname; } catch { /* keep raw url */ }
                disableChatInput(true, `Open ${hostname} in a tab to continue this conversation`);
            }
        }
    } catch (error) {
        WPLog.error('history_reload_failed', { id, error: String(error) });
        disableChatInput(true, "Could not reload this conversation's content.");
    } finally {
        showLoading(false);
        showUrlLoading(false);
    }
}

function buildWelcomeScreen() {
    const div = document.createElement('div');
    div.id = 'welcome-screen';
    div.innerHTML = `
        <div class="welcome-icon-wrap">
            <i class="fa-solid fa-atom welcome-icon"></i>
            <div class="welcome-glow"></div>
        </div>
        <h2 class="welcome-title">WebPilot AI</h2>
        <p class="welcome-sub">Explore large contents in seconds ✨</p>
        <div id="example-prompt-pill" class="prompt-pill">
            <i class="fa-regular fa-lightbulb pill-icon" id="pill-icon"></i>
            <span id="pill-text">Brain Storming</span>
        </div>
    `;
    return div;
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────
function showError(message) {
    const chatMessages = document.getElementById("chat-messages");
    document.querySelector('.message.error')?.remove();
    chatMessages.appendChild(createErrorMessage(message));
    scrollToBottom();
    disableChatInput(true, message);
}

function disableChatInput(disable, placeholder) {
    const inputField = document.getElementById("user-input");
    const sendButton = document.getElementById("send-btn");
    inputField.disabled = disable;
    sendButton.disabled = disable;
    if (placeholder !== undefined) {
        inputField.placeholder = disable ? (placeholder || "") : (placeholder || "Ask me anything...");
    }
}

function showLoading(on) {
    const icon = document.querySelector('#brand-atom');
    if (!icon) return;
    if (on) {
        icon.classList.add('spinning');
    } else {
        icon.classList.remove('spinning');
    }
}

function showUrlLoading(on) {
    document.getElementById('url-bar')?.classList.toggle('loading', on);
}

function scrollToBottom() {
    const chatMessages = document.getElementById("chat-messages");
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ─── Markdown Rendering ───────────────────────────────────────────────────────
function convertToMarkdown(text) {
    let html = text;

    // Code blocks first (before other replacements mess up content)
    html = html.replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    html = html.replace(/`([^`]+)`/gim, '<code>$1</code>');

    // Headings
    html = html.replace(/^#{6}\s(.+)$/gim, '<h6>$1</h6>');
    html = html.replace(/^#{5}\s(.+)$/gim, '<h5>$1</h5>');
    html = html.replace(/^#{4}\s(.+)$/gim, '<h4>$1</h4>');
    html = html.replace(/^#{3}\s(.+)$/gim, '<h3>$1</h3>');
    html = html.replace(/^#{2}\s(.+)$/gim, '<h2>$1</h2>');
    html = html.replace(/^#{1}\s(.+)$/gim, '<h1>$1</h1>');

    // Bold & italic
    html = html.replace(/\*\*\*(.*?)\*\*\*/gim, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.*?)\*\*/gim,     '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/gim,          '<em>$1</em>');

    // Unordered lists — group consecutive items
    html = html.replace(/((?:^\s*[-*]\s.+$\n?)+)/gim, (match) => {
        const items = match.trim().split('\n').map(line =>
            `<li>${line.replace(/^\s*[-*]\s/, '')}</li>`
        ).join('');
        return `<ul>${items}</ul>`;
    });

    // Ordered lists
    html = html.replace(/((?:^\s*\d+\.\s.+$\n?)+)/gim, (match) => {
        const items = match.trim().split('\n').map(line =>
            `<li>${line.replace(/^\s*\d+\.\s/, '')}</li>`
        ).join('');
        return `<ol>${items}</ol>`;
    });

    // HR
    html = html.replace(/^---+$/gim, '<hr>');

    // Paragraphs: wrap double newlines
    html = html.replace(/\n{2,}/g, '</p><p>');
    html = '<p>' + html + '</p>';

    // Clean up <p> around block elements
    html = html.replace(/<p>(<(?:h[1-6]|ul|ol|pre|hr)[^>]*>)/g, '$1');
    html = html.replace(/(<\/(?:h[1-6]|ul|ol|pre|hr)>)<\/p>/g, '$1');
    html = html.replace(/<p>\s*<\/p>/g, '');

    return html.trim();
}

// ─── Streaming Render ─────────────────────────────────────────────────────────
// Reads the response body as it arrives from the backend and renders it into
// the bubble progressively, so the answer appears as soon as the model
// produces it instead of waiting for the whole response then faking a delay.
async function streamRenderResponse(body, bubble) {
    const reader  = body.getReader();
    const decoder = new TextDecoder();
    let fullText  = '';
    let chunkCount = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        fullText += decoder.decode(value, { stream: true });
        chunkCount++;

        // Render on the very first chunk so the "Thinking…" placeholder is
        // replaced the instant real content starts arriving; after that,
        // re-parsing markdown on every single chunk is wasted work once
        // chunks arrive in a tight burst, so throttle the DOM update.
        if (chunkCount === 1 || chunkCount % 3 === 0) {
            bubble.innerHTML = convertToMarkdown(fullText);
            scrollToBottom();
        }
    }

    fullText += decoder.decode();
    bubble.innerHTML = convertToMarkdown(fullText);
    scrollToBottom();

    return fullText.trim();
}