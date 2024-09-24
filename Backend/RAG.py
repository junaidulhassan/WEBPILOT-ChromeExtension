import warnings as wn
# Ignore warning messages
wn.filterwarnings('ignore')
import os
import shutil

from langchain.prompts import PromptTemplate
from langchain.callbacks.manager import CallbackManager
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from langchain.embeddings import HuggingFaceEmbeddings
from langchain.vectorstores import FAISS

from langchain.document_loaders import PyPDFLoader, TextLoader,YoutubeLoader

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document

# Define the Retrieval_Augmented_Generation class
class Retrieval_Augmented_Generation:
    
    # Define the path for the database
    __DB_path = "/Docs/Chroma"
    __store_text_file ="/media/junaid-ul-hassan/248ac48e-ccd4-4707-a28b-33cb7a46e6dc/WEB-Programming/WEBPILOT-ChromeExtension/Scraped_data/data.txt"
    
    def __init__(self):
        # Initialize the embedding model
        self.embedding_model = self.__embed()
    
    def __load_docs(self):
        try:
            # Load documents from file path
            loader = TextLoader(
                file_path=self.__store_text_file
            )
            
            # Load documents using the loader
            docs = loader.load()
            print("Docs load from file...")
            return docs
        
        except Exception as e:
            print(f"Error loading documents: {e}")
            return None
    
    def __load_pdf(self,file_path):
        # define the spilter docs properties
        chunks_size = 1000
        chunks_overlap = 40
        
        splitter = RecursiveCharacterTextSplitter(
            # Set a really small chunk size, just to show.
            chunk_size=chunks_size,
            chunk_overlap=chunks_overlap,
            length_function=len,
            is_separator_regex=False
        )
        try:
            loader = PyPDFLoader(
                file_path=file_path,
            )
        except Exception as e:
            print("Error to load pdf files")
            
        docs = loader.load()
        split = splitter.split_documents(
            documents=docs
        )
        return split
    
    
    def __load_text(self,text):
        # define the spilter docs properties
        chunks_size = 1000
        chunks_overlap = 40
        
        splitter = RecursiveCharacterTextSplitter(
            # Set a really small chunk size, just to show.
            chunk_size=chunks_size,
            chunk_overlap=chunks_overlap,
            length_function=len,
            is_separator_regex=False
        )
        try:
            docs = [Document(page_content=x) for x in splitter.split_text(text)]
        except Exception as e:
            print("Error to load files")
            
        split = splitter.split_documents(
            documents=docs
        )
            
        return split

    def __load_youtube_transcript(self,youtube_url):
        # define the spilter docs properties
        chunks_size = 1000
        chunks_overlap = 40
        splitter = RecursiveCharacterTextSplitter(
            # Set a really small chunk size, just to show.
            chunk_size=chunks_size,
            chunk_overlap=chunks_overlap,
            length_function=len,
            is_separator_regex=False
        )
        try:
            loader = YoutubeLoader.from_youtube_url(
                youtube_url=youtube_url
            )
        except Exception as e:
            print("Error to load files")
        
        docs = loader.load()
        split = splitter.split_documents(
            documents=docs
        )
            
        return split
    
    def __text_spliter(self, chunks_size=500, chunks_overlap=50):
        # Define the chunks and overlap
        chunks_size = 1000
        chunks_overlap = 40

        # Use RecursiveCharacterTextSplitter to split documents into chunks
        rec_splitter = RecursiveCharacterTextSplitter(
            separators=["\n\n", "\n", "(?<=\. )", " ", ""],
            chunk_size=chunks_size,
            chunk_overlap=chunks_overlap,
            length_function=len,
            is_separator_regex=False
        )
        
        # Split the loaded documents into chunks
        split = rec_splitter.split_documents(
            self.__load_docs()
        )
        
        return split
    
    def __embed(self):
        # Create an embedding model
        embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
        )
        print("Embedding Runnings...")
        
        return embeddings
    
    def VectorDatabase(self, is_pdf=False,
                       text=None,
                       pdf_file=None, 
                       is_pdf_file=False,
                       youtube_url = None,
                       is_youtube_url = False
        ):
        # Define chunk size and overlap for splitting
        chunk_size = 1000
        chunk_overlap = 50
        
        if is_pdf and is_pdf_file and is_youtube_url:
           raise ValueError("You cannot load two pdf files or Urls. Please specify only one.")
        
        if is_pdf:
            split = self.__load_pdf(
                file_path=pdf_file
            )
            print("Load Pdf data Done...")
        elif is_pdf_file:
            split = self.__load_text(
                text=text
            )
            print("Load File..")
        elif is_youtube_url:
            split = self.__load_youtube_transcript(
                youtube_url=youtube_url
            )
        else:
            split = self.__text_spliter(
                chunks_size=chunk_size,
                chunks_overlap=chunk_overlap
            )
        
        print("Database Running..")
        # Create a vector database using the split documents and embeddings
        db = FAISS.from_documents(
            documents=split,
            embedding=self.embedding_model
        )
        
        return db
    
    def delete_all_in_directory(self):
        # Define the directory path
        directory_path = self.__DB_path
    
        if not os.path.exists(directory_path):
            print(f"The directory {directory_path} does not exist.")
            return
        else:
            # Delete the collection in the vector database
            db = self.VectorDatabase()
            db.delete_collection()
            return "Collection Deleted"