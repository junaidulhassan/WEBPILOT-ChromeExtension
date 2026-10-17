from dataclasses import dataclass
from enum import Enum


class Provider(str, Enum):
    GOOGLE = "google"
    GROQ = "groq"
    LOCAL = "local"


@dataclass(frozen=True)
class ModelSpec:
    id: str
    label: str
    provider: Provider
    model_name: str


@dataclass(frozen=True)
class ToneSpec:
    id: str
    label: str
    instruction: str


@dataclass(frozen=True)
class EmbeddingSpec:
    id: str
    label: str
    provider: Provider
    model_name: str


MODEL_REGISTRY: dict[str, ModelSpec] = {
    spec.id: spec
    for spec in (
        ModelSpec("gemini", "Gemini", Provider.GOOGLE, "gemini-2.5-flash-lite"),
        ModelSpec("gpt-oss-120b", "GPT-OSS 120B", Provider.GROQ, "openai/gpt-oss-120b"),
    )
}

TONE_REGISTRY: dict[str, ToneSpec] = {
    spec.id: spec
    for spec in (
        ToneSpec(
            "detailed",
            "Detailed",
            "Give thorough, well-explained answers: include relevant context, examples, and edge "
            "cases where useful. Favor completeness over brevity.",
        ),
        ToneSpec(
            "concise",
            "Concise",
            "Give only the essential information. Be as brief as possible and skip explanation that "
            "isn't necessary to answer the question.",
        ),
        ToneSpec(
            "creative",
            "Creative",
            "Be imaginative, expressive, and a little unconventional in phrasing and framing, while "
            "staying accurate and on-topic.",
        ),
        ToneSpec(
            "welcoming",
            "Welcoming",
            "Be warm, friendly, approachable, and conversational — like a helpful friend, not a "
            "formal system.",
        ),
        ToneSpec(
            "professional",
            "Professional",
            "Be formal, structured, and business-oriented. Use polished, precise language suited to "
            "a workplace setting.",
        ),
        ToneSpec(
            "assertive",
            "Assertive",
            "Be direct, confident, and decisive. State the answer plainly and avoid unnecessary "
            "hedging or qualifiers.",
        ),
        ToneSpec(
            "strict_to_data",
            "Strict to Data",
            "Rely only on the provided Context — do not use outside knowledge or inference beyond "
            "it. Explicitly flag anything that is uncertain or not stated in the Context.",
        ),
        ToneSpec(
            "critical",
            "Critical",
            "Take a critical, analytical stance. Question assumptions, and surface weaknesses, "
            "risks, or gaps instead of simply agreeing.",
        ),
    )
}

EMBEDDING_REGISTRY: dict[str, EmbeddingSpec] = {
    spec.id: spec
    for spec in (
        EmbeddingSpec("gemini-embedding", "Gemini Embedding", Provider.GOOGLE, "models/gemini-embedding-001"),
        EmbeddingSpec("local-embedding", "Local Embedding", Provider.LOCAL, "BAAI/bge-small-en-v1.5"),
    )
}

DEFAULT_MODEL_KEY = "gemini"
DEFAULT_TONE_KEY = "detailed"
DEFAULT_EMBEDDING_KEY = "gemini-embedding"
