from flask import Flask, request, jsonify
from RAG_QnA import RAG_Model
from scrap import Scraper
import requests

app = Flask(__name__)

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
        print("Is Doc: ",is_doc)
        return is_doc

    except requests.RequestException as e:
        print(f"Request failed: {e}")
        return False



# Initialize models
scrp = Scraper()
rag = RAG_Model()


@app.route('/process_url', methods=['POST'])
def process_url():
    try:
        flag=False
        data = request.json
        url = data.get('url')
        print(url)
        
        if not url:
            return jsonify({
                'error': 'Missing URL'
            }), 400
        
        if is_pdf_url(url=url):
            flag=True
            
        if flag:
            rag.load_Database(
                is_pdf=True,
                pdf_url=url
            )
        else:
            scrp.scrape_website(url=url)
            rag.load_Database()

        return jsonify({
            'message': 'URL processed successfully'
        }), 200

    except Exception as e:
        return jsonify({
            'error': str(e)
        }), 500

@app.route('/generate_response', methods=['POST'])
def generate_response():
    try:
        data = request.json
        user_input = data.get('message')

        if not user_input:
            return jsonify({
                'error': 'Missing message'
            }), 400

        # Generate response based on user input
        response = rag.generateResponse(user_input)
        
        return jsonify({'response': response}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=False)
