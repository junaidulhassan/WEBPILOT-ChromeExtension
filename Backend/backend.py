from flask import Flask, request, jsonify
from RAG_QnA import RAG_Model
from scrap import Scraper

app = Flask(__name__)

# Initialize models
scrp = Scraper()
rag = RAG_Model()

@app.route('/process_url', methods=['POST'])
def process_url():
    try:
        data = request.json
        url = data.get('url')
        
        if not url:
            return jsonify({
                'error': 'Missing URL'
            }), 400

        # Scrape the website and load the database
        response = scrp.scrape_website(url=url)
        print(response)
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
        print(user_input)
        response = rag.generateResponse(user_input)
        print(response)
        
        return jsonify({'response': response}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
