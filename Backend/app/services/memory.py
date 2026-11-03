from collections import deque
from collections.abc import Iterable, Mapping


class ConversationWindow:
    def __init__(self, size: int) -> None:
        self._turns: deque[tuple[str, str]] = deque(maxlen=size)

    def add(self, question: str, answer: str) -> None:
        self._turns.append((question, answer))

    def seed(self, history: Iterable[Mapping[str, str]]) -> None:
        for turn in history:
            question = (turn.get("question") or "").strip()
            answer = (turn.get("answer") or "").strip()
            if question and answer:
                self.add(question, answer)

    def clear(self) -> None:
        self._turns.clear()

    def render(self) -> str:
        return "\n".join(f"Question: {question}\nAnswer: {answer}" for question, answer in self._turns)

    def __len__(self) -> int:
        return len(self._turns)
