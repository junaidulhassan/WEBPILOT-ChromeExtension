from langchain_core.language_models.chat_models import BaseChatModel

from app.core.config import Settings
from app.core.exceptions import ProviderUnavailableError
from app.core.logging import get_logger
from app.domain.registry import ModelSpec, Provider

logger = get_logger("llm_factory")


def _require_key(value: str, name: str) -> str:
    if not value:
        raise ProviderUnavailableError(f"{name} is not configured on the server.")
    return value


def build_chat_model(
    spec: ModelSpec,
    settings: Settings,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> BaseChatModel:
    temperature = settings.default_temperature if temperature is None else temperature
    max_tokens = settings.default_max_tokens if max_tokens is None else max_tokens

    try:
        if spec.provider is Provider.GOOGLE:
            from langchain_google_genai import ChatGoogleGenerativeAI

            return ChatGoogleGenerativeAI(
                model=spec.model_name,
                temperature=temperature,
                max_tokens=max_tokens,
                google_api_key=_require_key(settings.google_api_key, "GOOGLE_API_KEY"),
            )

        if spec.provider is Provider.GROQ:
            from langchain_groq import ChatGroq

            return ChatGroq(
                model=spec.model_name,
                temperature=temperature,
                max_tokens=max_tokens,
                groq_api_key=_require_key(settings.groq_api_key, "GROQ_API_KEY"),
            )
    except ProviderUnavailableError:
        raise
    except Exception as exc:
        logger.exception(f"Failed to initialise chat model {spec.id}")
        raise ProviderUnavailableError(f"Could not initialise {spec.label}.") from exc

    raise ProviderUnavailableError(f"Unsupported provider: {spec.provider.value}")
