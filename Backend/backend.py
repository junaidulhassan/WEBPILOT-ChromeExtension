from flask import Flask, request, jsonify
from RAG_QnA import RAG_Model
from scrap import Scraper
import requests
import re
import json

app = Flask(__name__)

# Utility functions to validate URLs
def is_valid_url(url):
    regex = re.compile(
        r'^(?:http|ftp)s?://'  # http:// or https://
        r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+(?:[A-Z]{2,6}\.?|[A-Z0-9-]{2,}\.?)|'  # domain...
        r'localhost|'  # localhost...
        r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|'  # ...or ipv4
        r'\[?[A-F0-9]*:[A-F0-9:]+\]?)'  # ...or ipv6
        r'(?::\d+)?'  # optional port
        r'(?:/?|[/?]\S+)$', re.IGNORECASE)
    return re.match(regex, url) is not None

def is_pdf_url(url):
    if url.lower().endswith('.pdf'):
        return True
    try:
        response = requests.head(
            url=url, 
            allow_redirects=True
        )
        content_type = response.headers.get('Content-Type', '')
        is_doc = content_type.lower() == 'application/pdf'
        print("Is Doc: ", is_doc)
        return is_doc

    except requests.RequestException as e:
        print(f"Request failed: {e}")
        return False

def is_youtube_url(url):
    youtube_regex = re.compile(
        r'(https?://)?(www\.)?(youtube|youtu|youtube-nocookie)\.(com|be)/.+',
        re.IGNORECASE
    )
    return re.match(youtube_regex, url) is not None

# Initialize models
scrp = Scraper()
rag = RAG_Model()

@app.route('/process_page', methods=['POST'])
def process_page():
    try:
        # Fetch URL and text from the request
        data = request.json
        url = data.get('url')
        text = data.get('text')
        
        if not url:
            return jsonify({'error': 'Missing URL'}), 400
        
        if not text:
            return jsonify({'error': 'Missing text'}), 400
        
        print(f"URL: {url}")

        # Check if the URL is a PDF or a YouTube link
        if is_pdf_url(url):
            # Process PDF
            rag.load_Database(is_pdf=True, pdf_url=url)
        elif is_youtube_url(url):
            # Process YouTube video
            rag.load_Database(is_youtube_url=True, youtube_url=url)
        else:
            # Process standard web page text
            scrp.Tab_data(text=text)
            rag.load_Database()

        return jsonify({'message': 'Page processed successfully'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/generate_response', methods=['POST'])
def generate_response():
    try:
        data = request.json
        user_input = data.get('message')

        if not user_input:
            return jsonify({'error': 'Missing message'}), 400

        # Generate response based on user input
        response = rag.generateResponse(user_input)
        
        return jsonify({'response': response}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=False)
