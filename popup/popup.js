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

    // Check for irrelevant URLs
    if (isIrrelevantTab(url)) {
        showError("This is an irrelevant tab. Please open a valid website.");
        return; // Exit if the tab is irrelevant
    }

    // Inject script to fetch the page's text content
    const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: fetchPageText
    });

    const pageText = result.result;

    // Combine URL and page text into a single payload
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

        // Function to display text character by character in the botMessageElement
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
    }
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

function clearChatHistory() {
    var chatMessages = document.getElementById("chat-messages");
    chatMessages.innerHTML = "";
}

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
    for (let i = 0; i < text.length; i++) {
        element.textContent += text[i];
        await new Promise(resolve => setTimeout(resolve, 10)); // Adjust speed here
        document.getElementById("chat-messages").scrollTop = document.getElementById("chat-messages").scrollHeight; // Scroll to bottom
    }
}
