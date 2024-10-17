import warnings as wn
# Ignore warning messages
wn.filterwarnings('ignore')

from langchain_community.llms import HuggingFaceHub
from api_token import LargeLanguageModel
from langchain_huggingface import HuggingFaceEndpoint
from langchain.chains import LLMChain, RetrievalQA
from langchain.prompts import PromptTemplate
from langchain.memory import ConversationBufferWindowMemory, ConversationBufferMemory
from RAG import Retrieval_Augmented_Generation
from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import StrOutputParser
import io
import os
from PIL import Image
import requests
import openai

# Define RAG_Model class
class RAG_Model: 
    
    def __init__(self):
        # Initialize API token for the large language model
        self.token = LargeLanguageModel()
        self.api_key = self.token.get_Key()
        self.gpt_api_key = self.token.get_gpt_key()
        os.environ['OPENAI_API_KEY'] = self.gpt_api_key
        
        # Initialize the open-ai key
        # openai.api_key = os.environ['OPENAI_API_KEY']
        
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
            human_prefix='Human',
            ai_prefix='AI',
            input_key='question',
            verbose=False
        )
        
        self.Load_llm()
        
    
    def Load_llm(self,llm_model = 0):    
        # Set HuggingFace model repository ID
        rep_ids = [
            'meta-llama/Meta-Llama-3-8B-Instruct',
            'mistralai/Mistral-7B-Instruct-v0.3',
            'mistralai/Mixtral-8x7B-Instruct-v0.1'
        ]
        
        # Define filter terms to stop the generation
        self.filter = [
            'Question:', 
            'Human:'
        ]
        
        # Set up the language model endpoint
        self.llm = HuggingFaceEndpoint(
            name="Web-Pilot",
            repo_id= rep_ids[llm_model],
            task="text-generation",
            huggingfacehub_api_token=self.api_key,
            verbose=False,
            # show output in text streaming
            streaming=True,
            temperature=0.9,
            return_full_text=True,
            max_new_tokens=600,
            # Stop sequences is filter for stop criteria
            stop_sequences=self.filter,
            repetition_penalty=1.1
        )
        
        print("Model Loading Done..")
        
        # self.gpt_llm = ChatOpenAI(
        #     model='gpt-4o-mini',
        #     temperature=0.1,
        #     max_tokens=200,
        #     stop_sequences=self.filter,
        # )
    
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
        Your name is **WEB-PILOT**, a chatbot that answers user questions based on provided scraped website context. 
        Keep answers under 60 words, in simple and clear English.
        
        Chat History: {chat_history}
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
            llm=self.llm,
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
    
    def __routing_chain(self,prompt):
    # Create a prompt template for classifying questions
        prompt_template = PromptTemplate.from_template(
        """Given the user question below, classify it as either being about `General` or `University-Related`.
        
        Examples of `General` questions include: 
        - "How are you?"
        - "What is your name?"
        - "Who created you?"
        - "What can you do?"
        
        Examples of `University-Related` questions include:
        - "What is the fee structure at NUML?"
        - "Does this university offer a Master's in AI?"
        - "What is the procedure to apply at NUML University?"
        - "Are there any scholarships available?"
        
        Do not respond with more than one word.
        
        <question>
        {question}
        </question>
        
        Classification:"""
        )
        # Create a chain with the prompt template and the LLM
        chain = LLMChain(
            prompt=prompt_template,
            llm=self.llm,
            output_parser=StrOutputParser()
        )
        
        category = chain.invoke({
            'question': prompt
        })
        
        cat = category['text']
        
        return cat
        
        
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
        # Generate a response using the prompt chain
        chain = self.__PromptEngineering()
        response = chain.invoke({
            'query': prompt
        })
        response = response['result']
        response = self.remove_unwanted_suffixes(response)
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