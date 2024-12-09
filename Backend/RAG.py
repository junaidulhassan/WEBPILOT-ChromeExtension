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
from langchain_openai.embeddings import OpenAIEmbeddings

# Define the Retrieval_Augmented_Generation class
class Retrieval_Augmented_Generation:
    
    # Define the path for the database
    __DB_path = "/Docs/Chroma"
    __store_text_file ="/media/junaid-ul-hassan/248ac48e-ccd4-4707-a28b-33cb7a46e6dc1/WEB-Programming/WEBPILOT-ChromeExtension/Scraped_data/data.txt"
    
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
        # error message
        error_text = """
            Please Show this Error message in easy way to user if user Ask any question about context.
            Sorry cannot Load PDF File because of Invalid PDF file Location format or non-pdf file. 
            Please Try again with different pdf file.
        """
        error_text_2 = """
            Please Show this Error message in easy way to user if user Ask any question about context.
            This file may be a scanned PDF or it could be empty, meaning there is no data available. 
            Please try again with a PDF that contains text data and is not just a scanned image.
        """
        
        # define the spilter docs properties
        chunks_size = 1500
        chunks_overlap = 40
        
        splitter = RecursiveCharacterTextSplitter(
            # Set a really small chunk size, just to show.
            chunk_size=chunks_size,
            chunk_overlap=chunks_overlap,
            length_function=len,
            is_separator_regex=False
        )
        try:
            # Attempt to load the PDF
            loader = PyPDFLoader(file_path=file_path)
            docs = loader.load()
            print("PDF loaded successfully!")
        except Exception as e:
            print(f"Error loading PDF file")
            # Return error_text in a Document object
            docs = [Document(page_content=error_text)]
            return docs

        # Check if the document contains data
        if len(docs) == 0 or not all(doc.page_content.strip() for doc in docs):
            print("PDF file has no readable text or data...")
            docs = [Document(page_content=error_text_2)]
    
        # Split documents into chunks
        split_docs = splitter.split_documents(docs)
    
        return split_docs

    
    
    def __load_text(self,text):
        # define the spilter docs properties
        chunks_size = 1500
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
        
        error_text = """
            Please Show this Error message in easy way to user if user Ask about context or video context.
            We could not retrieve a transcript for the requested video URL. This is likely due to the following reasons:
            No transcripts were found for any of the requested language codes: ['english'].
            As a result, this video does not have an English transcript. To chat about the video, you must have a transcript available in English.
        """
        
        error_text_2 ="""
            Please Show this Error message in easy way to user if user Ask about context or video context.
            Sorry I can't describe this video because We couldn't retrieve the transcript for this video.This might be because the video doesn't have subtitles or transcripts in English. 
            Please check if the video includes an English transcript and try again.
        """
        
        # define the spilter docs properties
        chunks_size = 1500
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
            docs = loader.load()
        except Exception as e:
            # if error occure then this code with run
            print("Video Transcript Error Occure....")
            docs = [Document(page_content=x) for x in splitter.split_text(error_text)]
            split = splitter.split_documents(
                documents=docs
            )
        
        if len(docs) == 0:
            # if no transcript found then this code will run
            print("Video Don't have Transcript")
            docs = [Document(page_content=x) for x in splitter.split_text(error_text_2)]
            split = splitter.split_documents(
                documents=docs
            )
        else:
            # if transcript found then this code will run
            split = splitter.split_documents(
                documents=docs
            )
            
        return split
    
    def __text_spliter(self, chunks_size=500, chunks_overlap=50):
        # Define the chunks and overlap
        chunks_size = 1500
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
        embeddings = OpenAIEmbeddings()
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
        chunk_size = 1500
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