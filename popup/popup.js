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
    applyTheme(getTheme());
    processPage();
});

document.getElementById('send-btn').addEventListener('click', sendMessage);
document.getElementById('user-input').addEventListener('keypress', checkEnter);
document.getElementById('clear-chat-btn').addEventListener('click', clearChatHistory);
document.getElementById('settings-btn').addEventListener('click', openSettings);
document.getElementById('settings-close-btn').addEventListener('click', closeSettings);
document.getElementById('settings-overlay').addEventListener('click', closeSettings);

document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
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
async function processPage() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url   = tab.url;
    document.getElementById('web-link').textContent = url;

    if (isIrrelevantTab(url)) {
        showError("This tab can't be analysed. Please open a website, PDF, or YouTube video.");
        return;
    }

    showLoading(true);
    disableChatInput(true, "Loading page content...");

    try {
        let payload;

        if (url.endsWith('.pdf')) {
            payload = { url, text: "PDF file" };
        } else if (isYouTubeUrl(url)) {
            payload = { url, text: "YouTube video" };
        } else {
            const [result] = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => document.body.innerText
            });
            payload = { url, text: result.result };
        }

        const response = await fetch('http://127.0.0.1:8000/process_page', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.detail || `Server error ${response.status}`);
        }

        disableChatInput(false, "");

    } catch (error) {
        console.error('processPage error:', error);
        showError("Could not connect to backend. Make sure the server is running.");
    } finally {
        showLoading(false);
    }
}

function isIrrelevantTab(url) {
    return /^(chrome:\/\/|chrome-extension:\/\/|brave:\/\/|edge:\/\/|about:|data:|file:\/\/(?!.*\.pdf))/.test(url);
}

function isYouTubeUrl(url) {
    return /^https?:\/\/(www\.)?(youtube|youtu|youtube-nocookie)\.(com|be)\/.+/i.test(url);
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

    // Reset input
    const inputEl = document.getElementById("user-input");
    inputEl.value = "";
    inputEl.style.height = 'auto';

    disableChatInput(true, "Generating response...");
    showLoading(true);
    showTypingDots();
    scrollToBottom();

    try {
        const response = await fetch('http://127.0.0.1:8000/generate_response', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userInput })
        });

        if (!response.ok) throw new Error(`Server error ${response.status}`);

        const result      = await response.json();
        const botResponse = result.response || "Sorry, I couldn't generate a response. Please try again.";

        removeTypingDots();
        const botEl = createBotMessage();
        chatMessages.appendChild(botEl);
        await typewriterRender(botResponse, botEl.querySelector('.message-bubble'));

    } catch (error) {
        console.error('sendMessage error:', error);
        removeTypingDots();
        chatMessages.appendChild(createErrorMessage("Error retrieving response. Please check your connection."));
    } finally {
        showLoading(false);
        disableChatInput(false, "Ask me anything...");
        scrollToBottom();

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        saveChatHistory(tab.id, chatMessages.innerHTML);
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
function saveChatHistory(tabId, html) {
    chrome.storage.local.set({ [tabId]: html }, () => {
        console.log('Chat history saved for tab:', tabId);
    });
}

function loadChatHistory(tabId) {
    chrome.storage.local.get([String(tabId)], (result) => {
        if (result[String(tabId)]) {
            const chatMessages = document.getElementById("chat-messages");
            chatMessages.innerHTML = result[String(tabId)];
            scrollToBottom();
            isFirstMessage = false;
        }
    });
}

function clearChatHistory() {
    const chatMessages = document.getElementById("chat-messages");
    chatMessages.innerHTML = '';
    isFirstMessage = true;

    // Re-inject welcome screen
    const welcome = buildWelcomeScreen();
    chatMessages.appendChild(welcome);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.storage.local.remove([String(tabs[0].id)], () => {
            console.log("Chat history cleared for tab:", tabs[0].id);
        });
    });
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

function showTypingDots() {
    const chatMessages = document.getElementById("chat-messages");
    const indicator = document.createElement('div');
    indicator.classList.add('typing-indicator');
    indicator.innerHTML = `
        <div class="bot-avatar"><i class="fa-solid fa-atom"></i></div>
        <div class="typing-bubble">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
        </div>
    `;
    chatMessages.appendChild(indicator);
    scrollToBottom();
}

function removeTypingDots() {
    document.querySelector('.typing-indicator')?.remove();
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

// ─── Typewriter Effect ────────────────────────────────────────────────────────
// Strategy: parse the markdown into real HTML, then animate each text node
// word-by-word so HTML structure is always valid and never shows raw tags.
async function typewriterRender(text, element) {
    const chatMessages = document.getElementById("chat-messages");

    // 1. Render markdown into a detached container
    const rendered = convertToMarkdown(text);
    const temp = document.createElement('div');
    temp.innerHTML = rendered;

    // 2. Clone the structure into the target but hide all text nodes
    element.innerHTML = '';
    const clone = temp.cloneNode(true);
    element.appendChild(clone);

    // 3. Collect every text node inside the bubble
    const textNodes = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
        textNodes.push(node);
    }

    // 4. Hide all text by replacing each text node with a span-wrapped version
    //    where words start invisible and reveal one by one
    const wordSpans = [];
    for (const tn of textNodes) {
        const words = tn.textContent.split(/(\s+)/); // keep whitespace tokens
        const frag = document.createDocumentFragment();
        for (const word of words) {
            const span = document.createElement('span');
            span.textContent = word;
            span.style.opacity = '0';
            span.style.transition = 'opacity 0.12s ease';
            frag.appendChild(span);
            if (word.trim()) wordSpans.push(span); // only animate non-whitespace
            else span.style.opacity = '1'; // show whitespace immediately
        }
        tn.parentNode.replaceChild(frag, tn);
    }

    // 5. Reveal words with a small stagger
    for (let i = 0; i < wordSpans.length; i++) {
        wordSpans[i].style.opacity = '1';
        if (i % 4 === 0) {
            scrollToBottom();
            await new Promise(resolve => setTimeout(resolve, 18));
        }
    }

    scrollToBottom();
}