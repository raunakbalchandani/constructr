"""AI provider abstraction — swap LLM backends without touching business logic."""
from abc import ABC, abstractmethod
from typing import List


class AIProvider(ABC):
    @abstractmethod
    def complete(self, messages: List[dict], **kwargs) -> str:
        """Send messages and return the assistant's reply as a string."""
        ...


class OpenAIProvider(AIProvider):
    def __init__(self, api_key: str, model: str) -> None:
        from openai import OpenAI
        self._client = OpenAI(api_key=api_key)
        self._model = model

    def complete(self, messages: List[dict], **kwargs) -> str:
        response = self._client.chat.completions.create(
            model=self._model,
            messages=messages,
            **kwargs,
        )
        return response.choices[0].message.content
