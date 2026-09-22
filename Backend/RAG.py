import warnings as wn
# Ignore warning messages
wn.filterwarnings('ignore')
import os
import re
import shutil
from urllib.parse import urlparse, parse_qs
from dotenv import load_dotenv

from langchain.prompts import PromptTemplate
from langchain.callbacks.manager import CallbackManager
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_google_genai.embeddings import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import FAISS

from langchain_community.document_loaders import PyPDFLoader, TextLoader

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document

from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable,
)

from logging_config import logger

# Load environment variables
load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# Define the Retrieval_Augmented_Generation class
class Retrieval_Augmented_Generation:
    
    # Define the path for the database
    __PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    __DB_path = os.path.join(__PROJECT_ROOT, "Docs", "Chroma")
    __store_text_file = os.path.join(__PROJECT_ROOT, "Scraped_data", "data.txt")
    
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
            logger.debug("Docs loaded from file")
            return docs

        except Exception:
            logger.exception("Error loading documents")
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
            logger.info("PDF loaded successfully")
        except Exception:
            logger.exception(f"Error loading PDF file: {file_path}")
            docs = [Document(page_content=error_text)]
            return docs

        # Check if the document contains data
        if len(docs) == 0 or not all(doc.page_content.strip() for doc in docs):
            logger.warning(f"PDF file has no readable text or data: {file_path}")
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
        except Exception:
            logger.exception("Error splitting raw text into documents")

        split = splitter.split_documents(
            documents=docs
        )
            
        return split

    @staticmethod
    def __extract_video_id(youtube_url):
        """Extract the 11-character video ID from any common YouTube URL format."""
        parsed = urlparse(youtube_url)
        hostname = (parsed.hostname or "").lower()

        if hostname in ("youtu.be",):
            return parsed.path.lstrip("/").split("/")[0] or None

        if "youtube" in hostname:
            if parsed.path == "/watch":
                return parse_qs(parsed.query).get("v", [None])[0]
            for prefix in ("/embed/", "/v/", "/shorts/", "/live/"):
                if parsed.path.startswith(prefix):
                    return parsed.path[len(prefix):].split("/")[0]

        match = re.search(r"([0-9A-Za-z_-]{11})", youtube_url)
        return match.group(1) if match else None

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

        error_text_3 = """
            Please Show this Error message in easy way to user if user Ask about context or video context.
            Sorry, this YouTube link doesn't look valid, or the video is unavailable/private, so we
            couldn't retrieve its transcript. Please check the link and try again.
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

        def _error_docs(text):
            return splitter.split_documents(
                [Document(page_content=x) for x in splitter.split_text(text)]
            )

        video_id = self.__extract_video_id(youtube_url)
        if not video_id:
            logger.warning(f"Could not extract a YouTube video ID from URL: {youtube_url}")
            return _error_docs(error_text_3)

        try:
            ytt_api = YouTubeTranscriptApi()
            transcript_list = ytt_api.list(video_id)

            try:
                transcript = transcript_list.find_transcript(["en", "en-US", "en-GB"])
            except NoTranscriptFound:
                # Fall back to any available transcript, translating to English if possible.
                transcript = next(iter(transcript_list))
                if transcript.is_translatable:
                    transcript = transcript.translate("en")

            fetched = transcript.fetch()
            text = " ".join(snippet.text for snippet in fetched).strip()

            if not text:
                logger.warning(f"Video transcript was empty: {youtube_url}")
                return _error_docs(error_text_2)

            docs = [Document(page_content=text, metadata={"source": youtube_url})]
            return splitter.split_documents(docs)

        except (TranscriptsDisabled, NoTranscriptFound):
            logger.warning(f"Video does not have an available transcript: {youtube_url}")
            return _error_docs(error_text)
        except VideoUnavailable:
            logger.warning(f"Video is unavailable: {youtube_url}")
            return _error_docs(error_text_3)
        except Exception:
            logger.exception(f"Video transcript error occurred: {youtube_url}")
            return _error_docs(error_text)
    
    def __text_spliter(self, chunks_size=500, chunks_overlap=50):
        # Define the chunks and overlap
        chunks_size = 1500
        chunks_overlap = 40

        # Use RecursiveCharacterTextSplitter to split documents into chunks
        rec_splitter = RecursiveCharacterTextSplitter(
            separators=["\n\n", "\n", r"(?<=\. )", " ", ""],
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
        # Create an embedding model using Google Generative AI
        embeddings = GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-001",
            google_api_key=GOOGLE_API_KEY
        )
        logger.info("Embedding model initialised")

        return embeddings
    
    def VectorDatabase(self, is_pdf=False,
                       text=None,
                       pdf_file=None,
                       is_raw_text=False,
                       youtube_url = None,
                       is_youtube_url = False
        ):
        # Define chunk size and overlap for splitting
        chunk_size = 1500
        chunk_overlap = 50

        if is_pdf and is_raw_text and is_youtube_url:
           raise ValueError("You cannot load two pdf files or Urls. Please specify only one.")

        if is_pdf:
            split = self.__load_pdf(
                file_path=pdf_file
            )
            logger.info("PDF data loaded")
        elif is_raw_text:
            split = self.__load_text(
                text=text
            )
            logger.info("Raw text loaded")
        elif is_youtube_url:
            split = self.__load_youtube_transcript(
                youtube_url=youtube_url
            )
        else:
            split = self.__text_spliter(
                chunks_size=chunk_size,
                chunks_overlap=chunk_overlap
            )

        logger.info(f"Building vector database from {len(split)} chunks")
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
            logger.warning(f"The directory {directory_path} does not exist.")
            return
        else:
            # Delete the collection in the vector database
            db = self.VectorDatabase()
            db.delete_collection()
            return "Collection Deleted"