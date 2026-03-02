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


class AnthropicProvider(AIProvider):
    def __init__(self, api_key: str, model: str) -> None:
        import anthropic
        self._client = anthropic.Anthropic(api_key=api_key)
        self._model = model

    def complete(self, messages: List[dict], **kwargs) -> str:
        import anthropic
        # Anthropic separates system prompt from the messages array
        system = None
        chat_messages = []
        for m in messages:
            if m["role"] == "system":
                system = m["content"]
            else:
                chat_messages.append({"role": m["role"], "content": m["content"]})

        create_kwargs = {
            "model": self._model,
            "max_tokens": kwargs.get("max_tokens", 2000),
            "messages": chat_messages,
        }
        if system:
            create_kwargs["system"] = system

        response = self._client.messages.create(**create_kwargs)
        return response.content[0].text
