import warnings as wn

# Ignore warning messages
wn.filterwarnings('ignore')

from langchain_community.llms import HuggingFaceHub
from dotenv import load_dotenv
from langchain.chains import LLMChain, RetrievalQA
from langchain.prompts import PromptTemplate
from langchain.memory import ConversationBufferWindowMemory, ConversationBufferMemory
from RAG import Retrieval_Augmented_Generation
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.output_parsers import StrOutputParser
import io
import os
from PIL import Image
import requests

# Load environment variables from .env file
load_dotenv()

# Explicitly load keys
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

SUPPORTED_MODELS = {
    # Google
    "gemini-2.5-flash-lite":    "google",
    "gemini-2.0-flash":         "google",
    "gemini-1.5-pro":           "google",
    "gemini-1.5-flash":         "google",
}

DEFAULT_MODEL       = "gemini-2.5-flash-lite"
DEFAULT_TEMPERATURE = 0.2
DEFAULT_MAX_TOKENS  = 4096


# Define RAG_Model class
class RAG_Model: 
    
    def __init__(self):
        # Initialize API tokens from environment variables
        self.api_key = os.getenv('HUGGINGFACE_API_KEY', '')
        self.google_api_key = os.getenv('GOOGLE_API_KEY', '')
        
        # Initialize Retrieval Augmented Generation (RAG)
        self.rag = Retrieval_Augmented_Generation()
        
        # Set up conversation memory
        self.mem = ConversationBufferMemory(
            memory_key='chat_history', 
            return_messages=False, 
            human_prefix='Human',
            ai_prefix='AI',
            input_key='question',
            verbose=False
        )
   
        # Set up window memory for conversation
        self.window_mem = ConversationBufferWindowMemory(
            k=3,  # Number of messages to remember
            memory_key='chat_history', 
            return_messages=False, 
            human_prefix='Question',
            ai_prefix='Answer',
            input_key='question',
            verbose=False
        )
        
        self.Load_llm()
        
    
    def Load_llm(self, model=None, temperature=None, max_tokens=None):    
        # Define filter terms to stop the generation
        self.filter = [
            'Question:', 
            'Human:'
        ]
        
        # Use default values if not provided
        if model is None:
            model = DEFAULT_MODEL
        if temperature is None:
            temperature = DEFAULT_TEMPERATURE
        if max_tokens is None:
            max_tokens = DEFAULT_MAX_TOKENS
        
        print("Model Loading Done..")
        
        self.gpt_llm = ChatGoogleGenerativeAI(
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            google_api_key=GOOGLE_API_KEY,
        )
    
    def load_Database(self,pdf_url=None,is_pdf = False,
                      pdf_text = None, is_pdf_file=False,
                      youtube_url=None, is_youtube_url=False):
        
        # create vector database for fetch knowledge from database
        self.database = self.rag.VectorDatabase(
            text=pdf_text,
            is_pdf_file=is_pdf_file,
            pdf_file=pdf_url,
            is_pdf=is_pdf,
            is_youtube_url=is_youtube_url,
            youtube_url=youtube_url
        ) 
        


    def __PromptEngineering(self):
        # Define the prompt template
        template = """
        Your name is WEB-PILOT(Created by Web-pilot team), a chatbot that answers user questions based on provided scraped context. 
        Keep answers under 100 words, in simple and clear English.
        
        ##Chat History
        
        {chat_history}
        Context: {context}
        Question: {question}
        Answer:
        """
        
        # Create a prompt with the template
        qa_chain_prompt = PromptTemplate.from_template(
            template=template
        )
        
        # Delete all data in the directory and create a vector database
        # self.rag.delete_all_in_directory()
        
        # Create the chain with the prompt and memory
        chain = RetrievalQA.from_chain_type(
            llm=self.gpt_llm,
            chain_type="stuff",
            retriever=self.database.as_retriever(
                search_type="mmr",
                search_kwargs={
                    'k': 10,  # Number of results to return
                    'fetch_k': 50  # Number of results to fetch
                }
            ),
            return_source_documents=False,
            chain_type_kwargs={
                'prompt': qa_chain_prompt,
                'verbose': False,
                'memory': self.window_mem
            }
        )
                
        return chain
    

        
        
    def __clean_string(self, input_text):
        
        # Clean the string from unwanted filter terms
        terms = self.filter
        earliest_position = len(input_text)
        for term in terms:
            position = input_text.find(term)
            if position != -1 and position < earliest_position:
                earliest_position = position
        
        return input_text[:earliest_position].strip()
    
    def remove_unwanted_suffixes(self,text):
        suffixes = ["</s>", "<|eot_id|>"]
        for suffix in suffixes:
            if text.endswith(suffix):
                return text[: -len(suffix)]
        return text    
    
    def generateResponse(self, prompt):
        # check the prompt category
        # category = self.__check_category(
        #     prompt
        # )
        
        # Generate a response using the prompt chain
        chain = self.__PromptEngineering()
        response = chain.invoke({
            'query': prompt
        })
        response = response['result']
        # response = self.remove_unwanted_suffixes(response)
            
        return response
    
    def generateImage(self, prompt):
        # Generate an image using the prompt chain
        API_URL = "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell"
        headers = {
            "Authorization":f"Bearer {self.api_key}"
        }
        def query(payload):
            response = requests.post(API_URL, headers=headers, json=payload)
            return response.content
        
        image_bytes = query({
            "inputs": prompt
        })
        print(prompt)
        new_width = 300
        new_height = 300
        # You can access the image with PIL.Image for example
        img = Image.open(io.BytesIO(image_bytes))
        image = img.resize((new_width, new_height))
        return image
