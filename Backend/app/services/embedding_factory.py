from langchain_core.embeddings import Embeddings

from app.core.config import Settings
from app.core.exceptions import ProviderUnavailableError
from app.core.logging import get_logger
from app.domain.registry import EmbeddingSpec, Provider

logger = get_logger("embedding_factory")


def build_embedding_model(spec: EmbeddingSpec, settings: Settings) -> Embeddings:
    try:
        if spec.provider is Provider.GOOGLE:
            if not settings.google_api_key:
                raise ProviderUnavailableError("GOOGLE_API_KEY is not configured on the server.")

            from langchain_google_genai import GoogleGenerativeAIEmbeddings

            return GoogleGenerativeAIEmbeddings(
                model=spec.model_name,
                google_api_key=settings.google_api_key,
            )

        if spec.provider is Provider.LOCAL:
            from langchain_huggingface import HuggingFaceEmbeddings

            return HuggingFaceEmbeddings(model_name=spec.model_name)
    except ProviderUnavailableError:
        raise
    except Exception as exc:
        logger.exception(f"Failed to initialise embedding model {spec.id}")
        raise ProviderUnavailableError(f"Could not load {spec.label}.") from exc

    raise ProviderUnavailableError(f"Unsupported embedding provider: {spec.provider.value}")
