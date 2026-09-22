import warnings as wn

# Ignore warning messages
wn.filterwarnings('ignore')

from dotenv import load_dotenv
from langchain.prompts import PromptTemplate
from langchain.memory import ConversationBufferWindowMemory
from RAG import Retrieval_Augmented_Generation
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
import io
import os
from PIL import Image
import requests

from logging_config import logger

# Load environment variables from .env file
load_dotenv()

# Explicitly load keys
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
GROQ_API_KEY   = os.getenv("GROQ_API_KEY")

# Models the user can pick between at chat time. Each entry maps a stable id
# (used by the frontend and the /set_model request) to the provider that
# serves it and the underlying model name.
MODEL_REGISTRY = {
    "gemini": {
        "label":    "Gemini",
        "provider": "google",
        "model":    "gemini-2.5-flash-lite",
    },
    "llama-3.3-70b-versatile": {
        "label":    "Llama 3.3 70B",
        "provider": "groq",
        "model":    "llama-3.3-70b-versatile",
    },
}

DEFAULT_MODEL_KEY   = "gemini"
DEFAULT_TEMPERATURE = 0.2
DEFAULT_MAX_TOKENS  = 4096

# Personality/tone the user can pick between at chat time. The instruction is
# spliced into the prompt on every message, so it only steers phrasing,
# structure, and depth — it never overrides the grounding/honesty rules in
# the base template.
TONE_REGISTRY = {
    "detailed": {
        "label": "Detailed",
        "instruction": "Give thorough, well-explained answers: include relevant context, examples, and edge "
                        "cases where useful. Favor completeness over brevity.",
    },
    "concise": {
        "label": "Concise",
        "instruction": "Give only the essential information. Be as brief as possible and skip explanation that "
                        "isn't necessary to answer the question.",
    },
    "creative": {
        "label": "Creative",
        "instruction": "Be imaginative, expressive, and a little unconventional in phrasing and framing, while "
                        "staying accurate and on-topic.",
    },
    "welcoming": {
        "label": "Welcoming",
        "instruction": "Be warm, friendly, approachable, and conversational — like a helpful friend, not a "
                        "formal system.",
    },
    "professional": {
        "label": "Professional",
        "instruction": "Be formal, structured, and business-oriented. Use polished, precise language suited to "
                        "a workplace setting.",
    },
    "assertive": {
        "label": "Assertive",
        "instruction": "Be direct, confident, and decisive. State the answer plainly and avoid unnecessary "
                        "hedging or qualifiers.",
    },
    "strict_to_data": {
        "label": "Strict to Data",
        "instruction": "Rely only on the provided Context — do not use outside knowledge or inference beyond "
                        "it. Explicitly flag anything that is uncertain or not stated in the Context.",
    },
    "critical": {
        "label": "Critical",
        "instruction": "Take a critical, analytical stance. Question assumptions, and surface weaknesses, "
                        "risks, or gaps instead of simply agreeing.",
    },
}

DEFAULT_TONE_KEY = "detailed"


# Define RAG_Model class
class RAG_Model: 
    
    def __init__(self):
        # Initialize API tokens from environment variables
        self.api_key = os.getenv('HUGGINGFACE_API_KEY', '')
        self.google_api_key = os.getenv('GOOGLE_API_KEY', '')
        
        # Initialize Retrieval Augmented Generation (RAG)
        self.rag = Retrieval_Augmented_Generation()

        # database / retriever populated once a page is loaded
        self.database = None
        self._retriever = None

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

        # Prompt template is fixed for the lifetime of the process, so build
        # it once instead of on every message.
        self._qa_prompt = self.__build_prompt_template()

        self.current_model_key = None
        self.Load_llm(DEFAULT_MODEL_KEY)

        # Response tone/personality. Purely a prompt-time setting — swapping
        # it never touches window_mem or the retriever, so it can change
        # mid-conversation without resetting or affecting chat history.
        self.current_tone_key = DEFAULT_TONE_KEY

    @staticmethod
    def list_models():
        """Models the frontend can offer the user, in display order."""
        return [
            {"id": key, "label": cfg["label"]}
            for key, cfg in MODEL_REGISTRY.items()
        ]

    @staticmethod
    def list_tones():
        """Personality/tone modes the frontend can offer, in display order."""
        return [
            {"id": key, "label": cfg["label"]}
            for key, cfg in TONE_REGISTRY.items()
        ]

    def set_tone(self, tone_key):
        if tone_key not in TONE_REGISTRY:
            raise ValueError(f"Unknown tone: {tone_key}")
        self.current_tone_key = tone_key
        logger.info(f"Tone set: {TONE_REGISTRY[tone_key]['label']}")

    def Load_llm(self, model_key, temperature=None, max_tokens=None):
        # Swaps out the chat model only. Conversation memory (window_mem) and
        # the loaded document retriever are untouched, so switching models
        # mid-conversation never interrupts or resets the ongoing chat.
        config = MODEL_REGISTRY.get(model_key)
        if config is None:
            raise ValueError(f"Unknown model: {model_key}")

        temperature = DEFAULT_TEMPERATURE if temperature is None else temperature
        max_tokens  = DEFAULT_MAX_TOKENS if max_tokens is None else max_tokens

        if config["provider"] == "google":
            self.gpt_llm = ChatGoogleGenerativeAI(
                model=config["model"],
                temperature=temperature,
                max_tokens=max_tokens,
                google_api_key=GOOGLE_API_KEY,
            )
        elif config["provider"] == "groq":
            self.gpt_llm = ChatGroq(
                model=config["model"],
                temperature=temperature,
                max_tokens=max_tokens,
                groq_api_key=GROQ_API_KEY,
            )
        else:
            raise ValueError(f"Unsupported provider: {config['provider']}")

        self.current_model_key = model_key
        logger.info(f"Model loaded: {config['label']} ({config['model']})")

    def load_Database(self,pdf_url=None,is_pdf = False,
                      text = None, is_raw_text=False,
                      youtube_url=None, is_youtube_url=False):

        # create vector database for fetch knowledge from database
        self.database = self.rag.VectorDatabase(
            text=text,
            is_raw_text=is_raw_text,
            pdf_file=pdf_url,
            is_pdf=is_pdf,
            is_youtube_url=is_youtube_url,
            youtube_url=youtube_url
        )

        # Build the retriever once per loaded source instead of on every
        # message — the search settings never change between messages.
        self._retriever = self.database.as_retriever(
            search_type="mmr",
            search_kwargs={
                'k': 10,      # Number of results to return
                'fetch_k': 50  # Number of results to fetch
            }
        )

    def reset_memory(self):
        # Wipe conversational memory so a newly loaded source starts with a
        # clean slate and never bleeds context from a previous conversation.
        self.window_mem.clear()

    def seed_memory(self, history):
        # Replay a previously saved conversation's turns into memory so the
        # LLM has continuity when the user resumes an old chat. `history` is
        # a list of {"question": ..., "answer": ...} dicts, oldest first.
        self.reset_memory()
        for turn in history:
            question = (turn.get('question') or '').strip()
            answer = (turn.get('answer') or '').strip()
            if question and answer:
                self.window_mem.save_context({'question': question}, {'result': answer})


    @staticmethod
    def __build_prompt_template():
        # Define the prompt template
        template = """
        Your name is WEB-PILOT (created by the WebPilot team). You help the user chat about a webpage, PDF, or
        YouTube video they have loaded, and you can also hold a normal conversation with them. Keep answers under
        100 words, in simple and clear English, unless a shorter reply fits better.

        How to decide what kind of reply to give:
        - If the message is small talk, a greeting, thanks, or an acknowledgement (e.g. "okay", "thanks", "hello",
          "got it", "cool") or a general question that isn't about the loaded content, reply naturally like a normal
          assistant would. Do not mention "the content" or "the context" for these, and never say the information
          is unavailable for a message like this.
        - If the message is about the loaded content, answer it using the Context below as your primary source.
        - If the Context doesn't explicitly say the answer but the question is clearly still about the loaded
          content, use sensible reasoning and general knowledge to give the most helpful answer you can — but make
          it clear that this part is inferred/general knowledge rather than stated in the content. Never present
          inferred or general-knowledge information as if it were directly written in the content.
        - Only say a question can't be answered, or is unrelated to the loaded content, when it truly cannot be
          answered from the Context and reasoning about it does not help either. When you do say this, phrase it
          naturally instead of a canned refusal.
        - Never invent facts and attribute them to the content. If you are unsure whether something is in the
          content, say so honestly instead of guessing.
        - Use the chat history to follow the conversation naturally, including follow-up questions that refer back
          to earlier turns.

        Response style for this reply (affects tone, structure, and depth only — it never overrides the rules
        above): {tone_instruction}

        ##Chat History

        {chat_history}
        Context: {context}
        Question: {question}
        Answer:
        """
        return PromptTemplate.from_template(template=template)

    async def astream_response(self, prompt):

        docs = await self._retriever.ainvoke(prompt)
        context = "\n\n".join(doc.page_content for doc in docs)
        chat_history = self.window_mem.load_memory_variables({}).get('chat_history', '')
        tone_instruction = TONE_REGISTRY[self.current_tone_key]["instruction"]

        final_prompt = self._qa_prompt.format(
            chat_history=chat_history,
            context=context,
            question=prompt,
            tone_instruction=tone_instruction,
        )

        full_response = []
        async for chunk in self.gpt_llm.astream(final_prompt):
            piece = chunk.content or ""
            if piece:
                full_response.append(piece)
                yield piece

        self.window_mem.save_context({'question': prompt}, {'result': ''.join(full_response).strip()})
    
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
        logger.debug(f"generateImage prompt: {prompt}")
        new_width = 300
        new_height = 300
        # You can access the image with PIL.Image for example
        img = Image.open(io.BytesIO(image_bytes))
        image = img.resize((new_width, new_height))
        return image
