document.addEventListener('DOMContentLoaded', processURL);
document.getElementById('send-btn').addEventListener('click', sendMessage);
document.getElementById('user-input').addEventListener('keypress', checkEnter);
document.getElementById('clear-chat-btn').addEventListener('click', clearChatHistory);
document.getElementById('dark-theme').addEventListener('click', toggleDarkTheme);

async function processURL() {
    // Get the current tab's URL
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab.url;
    document.getElementById('web-link').textContent = url;

    // Send the URL to the Flask server to process it
    await fetch('http://127.0.0.1:5000/process_url', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: url })
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

    // Clear input field
    document.getElementById("user-input").value = "";

    // Show spinner and blur background
    document.getElementById("spinner").classList.remove("hidden");
    document.getElementById("chat-container").classList.add("blur");
    document.getElementById("header-container").classList.add("blur");
    document.querySelector(".input-container").classList.add("blur");

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

        // Hide spinner and remove blur
        document.getElementById("spinner").classList.add("hidden");
        document.getElementById("chat-container").classList.remove("blur");
        document.getElementById("header-container").classList.remove("blur");
        document.querySelector(".input-container").classList.remove("blur");

        // Function to display text character by character in the botMessageElement
        await displayTextCharacterByCharacter(botResponse, botMessageElement);
    } catch (error) {
        console.error('Error:', error);
        var botMessageElement = document.createElement("div");
        botMessageElement.textContent = "Error retrieving response.";
        botMessageElement.classList.add("message", "assistant");
        chatMessages.appendChild(botMessageElement);
    } finally {
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

// Function to display bot's response character by character
async function displayTextCharacterByCharacter(text, element) {
    for (let i = 0; i < text.length; i++) {
        element.textContent += text[i];
        await new Promise(resolve => setTimeout(resolve, 10)); // Adjust speed here
        document.getElementById("chat-messages").scrollTop = document.getElementById("chat-messages").scrollHeight; // Scroll to bottom
    }
}
