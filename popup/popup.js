document.addEventListener('DOMContentLoaded', processURL);
document.getElementById('send-btn').addEventListener('click', sendMessage);
document.getElementById('user-input').addEventListener('keypress', checkEnter);
document.getElementById('clear-chat-btn').addEventListener('click', clearChatHistory);
document.getElementById('dark-theme').addEventListener('click', toggleDarkTheme);

async function processURL() {
    // Get the current tab's URL
    const [tab] = await chrome.tabs.query({
         active: true, currentWindow: true 
    });
    const url = tab.url;

    // Send the URL to the Flask server to process it
    await fetch('http://127.0.0.1:5000/process_url', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            url: url
        })
    });
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

    // Send the user's message to the Flask server for a response
    const response = await fetch('http://127.0.0.1:5000/generate_response', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: userInput
        })
    });

    const result = await response.json();

    // Display the response from the server
    var botMessageElement = document.createElement("div");
    botMessageElement.textContent = result.response || "Error: Unable to get response";
    botMessageElement.classList.add("message", "assistant");
    chatMessages.appendChild(botMessageElement);

    // Clear the input field
    document.getElementById("user-input").value = "";

    // Scroll to the bottom of the chat messages
    chatMessages.scrollTop = chatMessages.scrollHeight;
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

function toggleDarkTheme(){
    console.log("Your message is received");
}
