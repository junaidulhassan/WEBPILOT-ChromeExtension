// Import the markdown it library

import MarkdownIt from 'markdown-it';

// Initialize markdown-it
const md = new MarkdownIt();
// Get references to the textarea and preview div
const markdownInput = document.getElementById('markdown-input');
const preview = document.getElementById('preview');

// Function to convert markdown to HTML and display it
function updatePreview() {
    const markdownText = markdownInput.value;
    const html = md.render(markdownText);
    preview.innerHTML = html;
}
// markdown
// Add an event listener to update the preview when the user t
markdownInput.addEventListener('input', updatePreview);

// Initial render 
updatePreview();
