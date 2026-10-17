import threading
from collections.abc import AsyncIterator, Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from langchain_core.embeddings import Embeddings
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.vectorstores import VectorStoreRetriever

from app.core.config import Settings
from app.core.exceptions import (
    AppError,
    NoPageLoadedError,
    ProviderUnavailableError,
    RetrievalError,
    SourceProcessingError,
    UnknownOptionError,
)
from app.core.logging import get_logger
from app.domain.registry import (
    DEFAULT_EMBEDDING_KEY,
    DEFAULT_MODEL_KEY,
    DEFAULT_TONE_KEY,
    EMBEDDING_REGISTRY,
    MODEL_REGISTRY,
    TONE_REGISTRY,
)
from app.domain.source import LoadedSource, SourceType
from app.services.embedding_factory import build_embedding_model
from app.services.llm_factory import build_chat_model
from app.services.loaders import load_documents
from app.services.memory import ConversationWindow
from app.services.prompts import build_qa_prompt
from app.services.source_resolver import resolve_pdf_location
from app.services.vector_store import build_retriever

logger = get_logger("rag_service")


@dataclass
class ChatSession:
    url: str
    source_type: SourceType
    retriever: VectorStoreRetriever
    memory: ConversationWindow


@dataclass(frozen=True)
class PreparedAnswer:
    question: str
    prompt: str
    llm: BaseChatModel
    session: ChatSession


def _chunk_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            part if isinstance(part, str) else str(part.get("text", ""))
            for part in content
            if isinstance(part, (str, dict))
        )
    return ""


class RAGService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._prompt = build_qa_prompt()
        self._load_lock = threading.Lock()

        self._llm: BaseChatModel | None = None
        self._model_key: str | None = None
        self._embeddings: Embeddings | None = None
        self._embedding_key: str = DEFAULT_EMBEDDING_KEY
        self._tone_key: str = DEFAULT_TONE_KEY
        self._session: ChatSession | None = None

    def initialize(self) -> None:
        try:
            self.set_embedding(DEFAULT_EMBEDDING_KEY)
        except AppError as exc:
            logger.error(f"Default embedding model unavailable: {exc.message}")

        try:
            self.set_model(DEFAULT_MODEL_KEY)
        except AppError as exc:
            logger.error(f"Default chat model unavailable: {exc.message}")

        logger.info(f"RAG service ready (llm={self.llm_ready}, embedding={self.embedding_ready})")

    @property
    def model_key(self) -> str | None:
        return self._model_key

    @property
    def tone_key(self) -> str:
        return self._tone_key

    @property
    def embedding_key(self) -> str:
        return self._embedding_key

    @property
    def llm_ready(self) -> bool:
        return self._llm is not None

    @property
    def embedding_ready(self) -> bool:
        return self._embeddings is not None

    @property
    def page_loaded(self) -> bool:
        return self._session is not None

    @staticmethod
    def list_models() -> list[dict[str, str]]:
        return [{"id": spec.id, "label": spec.label} for spec in MODEL_REGISTRY.values()]

    @staticmethod
    def list_tones() -> list[dict[str, str]]:
        return [{"id": spec.id, "label": spec.label} for spec in TONE_REGISTRY.values()]

    @staticmethod
    def list_embeddings() -> list[dict[str, str]]:
        return [{"id": spec.id, "label": spec.label} for spec in EMBEDDING_REGISTRY.values()]

    def set_model(self, model_key: str) -> str:
        spec = MODEL_REGISTRY.get(model_key)
        if spec is None:
            raise UnknownOptionError(f"Unknown model: {model_key}")

        self._llm = build_chat_model(spec, self._settings)
        self._model_key = model_key
        logger.info(f"Model loaded: {spec.label} ({spec.model_name})")
        return model_key

    def set_tone(self, tone_key: str) -> str:
        spec = TONE_REGISTRY.get(tone_key)
        if spec is None:
            raise UnknownOptionError(f"Unknown tone: {tone_key}")

        self._tone_key = tone_key
        logger.info(f"Tone set: {spec.label}")
        return tone_key

    def set_embedding(self, embedding_key: str) -> str:
        spec = EMBEDDING_REGISTRY.get(embedding_key)
        if spec is None:
            raise UnknownOptionError(f"Unknown embedding model: {embedding_key}")

        if embedding_key == self._embedding_key and self._embeddings is not None:
            logger.info(f"Embedding model already set: {spec.label}")
            return embedding_key

        self._embeddings = build_embedding_model(spec, self._settings)
        self._embedding_key = embedding_key
        logger.info(f"Embedding model set: {spec.label}")
        return embedding_key

    def load_source(
        self,
        source_type: SourceType,
        *,
        url: str,
        text: str,
        history: Sequence[Mapping[str, str]],
    ) -> LoadedSource:
        embeddings = self._embeddings
        if embeddings is None:
            raise ProviderUnavailableError("The embedding model is not available. Check the server configuration.")

        pdf_location = resolve_pdf_location(url) if source_type is SourceType.PDF else None

        with self._load_lock:
            try:
                loaded = load_documents(
                    source_type,
                    url=url,
                    text=text,
                    settings=self._settings,
                    pdf_location=pdf_location,
                )
                retriever = build_retriever(loaded.documents, embeddings, self._settings)
            except AppError:
                raise
            except Exception as exc:
                logger.exception(f"Unexpected failure while processing {source_type.value} source {url}")
                raise SourceProcessingError("Failed to process this page. Please try again.") from exc

            memory = ConversationWindow(self._settings.memory_window)
            memory.seed(history)
            self._session = ChatSession(url=url, source_type=source_type, retriever=retriever, memory=memory)

        return loaded

    def reset_memory(self) -> None:
        if self._session is not None:
            self._session.memory.clear()
            logger.info("Conversation memory cleared")

    async def prepare_answer(self, question: str) -> PreparedAnswer:
        session = self._session
        if session is None:
            raise NoPageLoadedError()

        llm = self._llm
        if llm is None:
            raise ProviderUnavailableError("No chat model is available. Check the server's API keys.")

        try:
            documents = await session.retriever.ainvoke(question)
        except Exception as exc:
            logger.exception("Retrieval failed")
            raise RetrievalError("Could not search this page's content. Please try again.") from exc

        prompt = self._prompt.format(
            chat_history=session.memory.render(),
            context="\n\n".join(document.page_content for document in documents),
            question=question,
            tone_instruction=TONE_REGISTRY[self._tone_key].instruction,
        )
        return PreparedAnswer(question=question, prompt=prompt, llm=llm, session=session)

    @staticmethod
    async def stream_answer(prepared: PreparedAnswer) -> AsyncIterator[str]:
        pieces: list[str] = []

        async for chunk in prepared.llm.astream(prepared.prompt):
            piece = _chunk_text(chunk.content)
            if piece:
                pieces.append(piece)
                yield piece

        answer = "".join(pieces).strip()
        if answer:
            prepared.session.memory.add(prepared.question, answer)
