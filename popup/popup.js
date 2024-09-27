document.addEventListener('DOMContentLoaded', processPage);
document.getElementById('send-btn').addEventListener('click', sendMessage);
document.getElementById('user-input').addEventListener('keypress', checkEnter);
document.getElementById('clear-chat-btn').addEventListener('click', clearChatHistory);
document.getElementById('dark-theme').addEventListener('click', toggleDarkTheme);

async function processPage() {
    // Get the current tab's URL
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab.url;
    document.getElementById('web-link').textContent = url;

    // Load chat history from local storage for the current tab
    loadChatHistory(tab.id);

    // Check for irrelevant URLs
    if (isIrrelevantTab(url)) {
        showError("This is an irrelevant tab. Please open a valid website.");
        return; // Exit if the tab is irrelevant
    }

    // Check if the URL is a PDF
    if (url.endsWith('.pdf')) {
        console.log("Detected a PDF file");

        const payload = {
            url: url,
            text: "PDF file"
        };

        await fetch('http://127.0.0.1:5000/process_page', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        return; // Exit early, no need to fetch page text
    }

    // Inject script to fetch the page's text content for non-PDFs
    const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: fetchPageText
    });

    const pageText = result.result;

    const payload = {
        url: url,
        text: pageText
    };

    // Send the data (URL + page text) to the Flask server
    await fetch('http://127.0.0.1:5000/process_page', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
}

// Function to fetch all visible text from the page
function fetchPageText() {
    return document.body.innerText;
}

// Function to save chat history in chrome storage
function saveChatHistory(tabId, chatHistory) {
    chrome.storage.local.set({ [tabId]: chatHistory }, () => {
        console.log('Chat history saved for tab:', tabId);
    });
}

// Function to load chat history from chrome storage
function loadChatHistory(tabId) {
    chrome.storage.local.get([tabId], (result) => {
        if (result[tabId]) {
            const chatMessages = document.getElementById("chat-messages");
            chatMessages.innerHTML = result[tabId]; // Load chat history into the chat box
            chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll to bottom
        }
    });
}


// Function to save text using File System Access API
async function saveTextToFile(content) {
    try {
        // Request access to a file
        const handle = await window.showSaveFilePicker({
            suggestedName: '/media/junaid-ul-hassan/248ac48e-ccd4-4707-a28b-33cb7a46e6dc/WEB-Programming/WEBPILOT-ChromeExtension/Scraped_data/data.txt',
            types: [{
                description: 'Text file',
                accept: {'text/plain': ['.txt']},
            }],
        });

        // Create a writable stream and write the content
        const writableStream = await handle.createWritable();
        await writableStream.write(content);
        await writableStream.close();

        console.log('File saved successfully!');
    } catch (error) {
        console.error('Error saving the file:', error);
    }
}


function isIrrelevantTab(url) {
    // Check if the URL matches any irrelevant patterns
    return /^(chrome:\/\/|brave:\/\/|about:|data:|file:|extensions:)/.test(url);
}

function showError(message) {
    var chatMessages = document.getElementById("chat-messages");

    // Clear previous error messages, if any
    var existingError = document.querySelector('.message.error');
    if (existingError) {
        existingError.remove();
    }

    // Create error message element
    var errorMessageElement = document.createElement("div");
    errorMessageElement.classList.add("message", "error");

    // // Add custom styling and content
    // errorMessageElement.innerHTML = `
    //     <div class="error-container">
    //         <i class="fa fa-exclamation-triangle" aria-hidden="true"></i>
    //         <span class="error-text">${message}</span>
    //     </div>
    // `;
    chatMessages.appendChild(errorMessageElement);

    // Scroll to the bottom of the chat messages
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Disable user input
    disableChatInput(true);
}

function disableChatInput(disable) {
    var inputField = document.getElementById("user-input");
    var sendButton = document.getElementById("send-btn");

    inputField.disabled = disable;
    sendButton.disabled = disable;

    if (disable) {
        inputField.placeholder = "Chat disabled due to irrelevant tab.";
        sendButton.classList.add("disabled");
    } else {
        inputField.placeholder = "Type your message here...";
        sendButton.classList.remove("disabled");
    }
}

async function sendMessage() {
    var userInput = document.getElementById("user-input").value;
    if (userInput.trim() === "") return;

    var chatMessages = document.getElementById("chat-messages");

    // Display user's message
    var userMessageElement = document.createElement("div");
    userMessageElement.textContent = userInput;
    userMessageElement.classList.add("message", "user");
    chatMessages.appendChild(userMessageElement);

    // Clear input field
    document.getElementById("user-input").value = "";

    // Save chat history
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    saveChatHistory(tab.id, chatMessages.innerHTML);

    // Show spinner in place of Conversify AI icon
    showSpinner();

    try {
        // Send the user's message to the Flask server for a response
        const response = await fetch('http://127.0.0.1:5000/generate_response', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userInput })
        });

        const result = await response.json();
        const botResponse = result.response || "Please check your URL link or Internet connection";

        // Create a container for the bot's response
        var botMessageElement = document.createElement("div");
        botMessageElement.classList.add("message", "assistant");
        chatMessages.appendChild(botMessageElement);

        // Display bot response character by character
        await displayTextCharacterByCharacter(botResponse, botMessageElement);

    } catch (error) {
        console.error('Error:', error);
        var botMessageElement = document.createElement("div");
        botMessageElement.textContent = "Error retrieving response.";
        botMessageElement.classList.add("message", "assistant");
        chatMessages.appendChild(botMessageElement);
    } finally {
        // Remove spinner and restore Conversify AI icon
        hideSpinner();

        // Scroll to the bottom of the chat messages
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Save updated chat history
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        saveChatHistory(tab.id, chatMessages.innerHTML);
    }
}

function clearChatHistory() {
    var chatMessages = document.getElementById("chat-messages");
    chatMessages.innerHTML = "";

    // Clear saved chat history for the current tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.storage.local.remove([tabs[0].id], () => {
            console.log("Chat history cleared for tab:", tabs[0].id);
        });
    });
}

function checkEnter(event) {
    if (event.key === "Enter" && !event.shiftKey) {
        sendMessage();
        event.preventDefault();
    } else if (event.key === "Enter" && event.shiftKey) {
        // Allow line break
        event.stopPropagation();
    }
}

function convertToMarkdown(text) {
    let converted = text;

    // Convert headings
    // converted = converted.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    // converted = converted.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    converted = converted.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    converted = converted.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
    converted = converted.replace(/^##### (.*$)/gim, '<h5>$1</h5>');
    converted = converted.replace(/^###### (.*$)/gim, '<h6>$1</h6>');

    // Convert bold
    converted = converted.replace(/\*\*(.*)\*\*/gim, '<b>$1</b>');

    // Convert italics
    converted = converted.replace(/\*(.*)\*/gim, '<i>$1</i>');

    // Convert code blocks
    converted = converted.replace(/```([a-z]*)([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

    // Convert inline code
    converted = converted.replace(/`(.*?)`/gim, '<code>$1</code>');

    // // Convert unordered lists
    // converted = converted.replace(/^\s*[\*\-]\s(.*$)/gim, '<ul><li>$1</li></ul>');

    // Convert ordered lists
    converted = converted.replace(/^\s*[0-9]+\.\s(.*$)/gim, '<ol><li>$1</li></ol>');

    // Convert horizontal rule
    // converted = converted.replace(/^\-{3,}$/gim, '<hr />');

    return converted.trim(); // Return the converted markdown as HTML
}


// function clearChatHistory() {
//     var chatMessages = document.getElementById("chat-messages");
//     chatMessages.innerHTML = "";
// }

function toggleDarkTheme() {
    console.log("Your message is received");
}

// Function to show the spinner in place of the Conversify AI icon
function showSpinner() {
    const modelDropdownBtn = document.getElementById("model-dropdown-btn");
    const icon = modelDropdownBtn.querySelector("i");
    icon.classList.add("fa-spinner", "fa-spin");
    icon.classList.remove("fa-atom");
}

// Function to hide the spinner and restore the Conversify AI icon
function hideSpinner() {
    const modelDropdownBtn = document.getElementById("model-dropdown-btn");
    const icon = modelDropdownBtn.querySelector("i");
    icon.classList.remove("fa-spinner", "fa-spin");
    icon.classList.add("fa-atom");
}

// Function to display bot's response character by character
async function displayTextCharacterByCharacter(text, element) {
    console.log(text);
    for (let i = 0; i < text.length; i++) {
        element.innerText += text[i];
        await new Promise(resolve => setTimeout(resolve, 10)); // Adjust speed here
        document.getElementById("chat-messages").scrollTop = document.getElementById("chat-messages").scrollHeight; // Scroll to bottom
    }
}
