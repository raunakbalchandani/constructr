"""
Foreperson.ai - AI Assistant Module
Handles all AI/LLM interactions for document analysis.

Provider priority: OpenAI → Anthropic (automatic failover on quota/rate errors).
Vision: drawings/images are passed directly to vision-capable models at query time.
"""

from typing import List, Dict, Optional, Tuple
import base64
import os
import re
import logging
from pathlib import Path
from backend.constants import MAX_CONTEXT_CHARS, DEFAULT_AI_MODEL, DEFAULT_ANTHROPIC_MODEL, CHAT_HISTORY_WINDOW
from backend.ai_provider import AIProvider, OpenAIProvider, AnthropicProvider

logger = logging.getLogger(__name__)

try:
    from vision_counter import count_objects_in_image, format_count_for_ai
    _VISION_COUNTER_AVAILABLE = True
except ImportError:
    _VISION_COUNTER_AVAILABLE = False
    logger.warning("AI: vision_counter not available — YOLO/CV counting disabled")

# System prompt for construction expertise
SYSTEM_PROMPT = """You are Foreperson — a sharp, experienced AI built for project managers. You think before you answer. You have deep expertise in construction (AIA contracts, CSI specs, RFIs, submittals, schedules, budgets, MEP, structural) and you're also broadly knowledgeable across any topic.

How you think and respond:
- Work through the question in your head before writing. Don't just pattern-match to a template.
- If asked who you are, who made you, or who built you: you are Foreperson, built by Foreperson.ai. You are not made by OpenAI or Anthropic — those are the underlying model providers, but Foreperson.ai is who created this product. Say what you can help with. Keep it natural and brief. Do NOT list document contents or project context.
- If asked a general question unrelated to construction or documents: answer it from real knowledge, like a smart person would.
- If asked about uploaded documents: dig into them, cite by filename, be specific.
- Match tone: casual → casual, technical → precise, frustrated → direct and calm.
- Never open with filler ("Sure!", "Great question!", "Of course!", "Certainly!"). Just answer.
- Don't pad. Don't repeat the question back. Don't summarize what you're about to do — just do it.
- When something is a risk, conflict, or red flag: name it plainly.
- If a COMPUTER VISION RESULT is in the prompt, treat it as authoritative. Don't contradict it.
- Numbers, dates, dollar amounts: be specific. Vague is useless."""

# Questions that should bypass document context entirely
_CONVERSATIONAL_PREFIXES = (
    "who are you", "what are you", "tell me about yourself",
    "what can you do", "what do you do", "how are you",
    "hello", "hi ", "hey ", "good morning", "good afternoon", "good evening",
    "introduce yourself", "what's your name", "whats your name",
    "what is your name", "are you an ai", "are you a bot",
    "what's up", "whats up", "sup",
)


def _is_quota_error(e: Exception) -> bool:
    """Return True if this error is a transient quota/rate-limit error that warrants fallback."""
    msg = str(e).lower()
    keywords = [
        "insufficient_quota", "rate_limit", "rate limit", "ratelimit",
        "overloaded", "quota exceeded", "too many requests",
        "credit balance", "billing", "capacity",
    ]
    return any(kw in msg for kw in keywords)


OPENAI_MODELS = {
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-3.5-turbo",
}

ANTHROPIC_MODELS = {
    "claude-opus-4-6",
    "claude-sonnet-4-6",
    "claude-haiku-4-5-20251001",
}

# Document types that contain visual/spatial information worth sending to vision API
VISUAL_DOC_TYPES = {"drawing", "floor_plan", "site_plan", "unknown"}

# Image file extensions that can be passed directly to the vision API
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".tiff", ".tif", ".webp", ".bmp"}

# Cap images per request to keep token usage sane
MAX_IMAGES_PER_REQUEST = 6
MAX_PDF_PAGES = 10


def _build_providers(model: Optional[str] = None) -> List[AIProvider]:
    """Build the ordered list of AI providers.

    If *model* is specified, only the matching provider is returned (pinned).
    Otherwise the full fallback chain is returned: OpenAI → Anthropic.
    """
    openai_key = os.environ.get("OPENAI_API_KEY")
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    providers: List[AIProvider] = []

    if model:
        # Pinned model — use the appropriate provider exclusively
        if model in OPENAI_MODELS:
            if not openai_key:
                raise RuntimeError("OPENAI_API_KEY is not set.")
            providers.append(OpenAIProvider(api_key=openai_key, model=model))
            logger.info("AI: pinned to OpenAI %s", model)
        elif model in ANTHROPIC_MODELS:
            if not anthropic_key:
                raise RuntimeError("ANTHROPIC_API_KEY is not set.")
            providers.append(AnthropicProvider(api_key=anthropic_key, model=model))
            logger.info("AI: pinned to Anthropic %s", model)
        else:
            logger.warning("AI: unknown model '%s', falling back to default chain", model)
            # Fall through to build the default chain
            model = None

    if not model:
        # Default fallback chain: OpenAI first, then Anthropic
        if openai_key:
            try:
                providers.append(OpenAIProvider(api_key=openai_key, model=DEFAULT_AI_MODEL))
                logger.info("AI: OpenAI provider registered (model=%s)", DEFAULT_AI_MODEL)
            except Exception as e:
                logger.warning("AI: Failed to initialise OpenAI provider: %s", e)

        if anthropic_key:
            try:
                providers.append(AnthropicProvider(api_key=anthropic_key, model=DEFAULT_ANTHROPIC_MODEL))
                logger.info("AI: Anthropic provider registered (model=%s)", DEFAULT_ANTHROPIC_MODEL)
            except Exception as e:
                logger.warning("AI: Failed to initialise Anthropic provider: %s", e)

    return providers


# ── Vision helpers ─────────────────────────────────────────────────────────────

def _load_image_b64(file_path: str) -> Optional[str]:
    """Load an image file and return its base64-encoded contents, or None on error."""
    try:
        with open(file_path, "rb") as f:
            return base64.b64encode(f.read()).decode()
    except Exception as e:
        logger.warning("Vision: failed to read image %s: %s", file_path, e)
        return None


def _detect_mime_type(data: bytes) -> str:
    """Detect image MIME type from raw bytes using magic bytes."""
    if data[:2] == b'\xff\xd8':
        return "image/jpeg"
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return "image/png"
    if data[:6] in (b'GIF87a', b'GIF89a'):
        return "image/gif"
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return "image/webp"
    return "image/png"  # safe default


def _pdf_to_images(file_path: str) -> List[str]:
    """Render PDF pages to base64-encoded PNG images (requires pymupdf)."""
    try:
        import fitz  # pymupdf
    except ImportError:
        logger.warning("Vision: pymupdf not installed; PDF pages won't be passed to vision API")
        return []

    images: List[str] = []
    try:
        pdf = fitz.open(file_path)
        pages = min(len(pdf), MAX_PDF_PAGES)
        for page_num in range(pages):
            page = pdf.load_page(page_num)
            # 150 DPI — good balance of quality vs token cost for construction drawings
            mat = fitz.Matrix(250 / 72, 250 / 72)
            pix = page.get_pixmap(matrix=mat)
            images.append(base64.b64encode(pix.tobytes("png")).decode())
        pdf.close()
        logger.info("Vision: rendered %d page(s) from %s", pages, Path(file_path).name)
    except Exception as e:
        logger.warning("Vision: failed to render PDF %s: %s", file_path, e)

    return images


def _docx_to_images(file_path: str) -> List[str]:
    """Extract embedded images from a DOCX file as base64 strings."""
    import zipfile

    images: List[str] = []
    try:
        with zipfile.ZipFile(file_path, "r") as z:
            media = [n for n in z.namelist() if n.startswith("word/media/")]
            for img_name in media:
                ext = Path(img_name).suffix.lower()
                if ext in (".wmf", ".emf") or ext not in IMAGE_EXTENSIONS:
                    continue
                try:
                    img_data = z.read(img_name)
                    images.append(base64.b64encode(img_data).decode())
                    if len(images) >= MAX_IMAGES_PER_REQUEST:
                        break
                except Exception as e:
                    logger.warning("Vision: failed to read DOCX image %s: %s", img_name, e)
    except Exception as e:
        logger.warning("Vision: failed to open DOCX %s: %s", file_path, e)

    if images:
        logger.info("Vision: extracted %d image(s) from DOCX %s", len(images), Path(file_path).name)
    return images


def _get_doc_images(doc: Dict) -> List[str]:
    """Return base64-encoded images for a document, or [] if none are available.

    - Image files (jpg, png, etc.) → load directly.
    - DOCX files → extract embedded images from word/media/.
    - PDFs typed as drawings/plans → render pages via pymupdf.
    - Everything else → no images.
    """
    file_path = doc.get("file_path", "")
    if not file_path or not os.path.exists(file_path):
        return []

    ext = Path(file_path).suffix.lower()

    if ext in IMAGE_EXTENSIONS:
        b64 = _load_image_b64(file_path)
        return [b64] if b64 else []

    if ext in (".docx", ".doc"):
        return _docx_to_images(file_path)

    if ext == ".pdf":
        return _pdf_to_images(file_path)

    return []


class ConstructionAI:
    def __init__(self, model: Optional[str] = None) -> None:
        self._providers = _build_providers(model)
        if not self._providers:
            raise RuntimeError(
                "No AI providers configured. Set OPENAI_API_KEY and/or ANTHROPIC_API_KEY."
            )
        self.documents: list = []
        self.max_context_chars = MAX_CONTEXT_CHARS

    # ── Provider dispatch ────────────────────────────────────────

    def _complete(self, messages: List[dict], **kwargs) -> str:
        """Try each provider in order; fall back on quota/rate errors."""
        last_err: Optional[Exception] = None
        for provider in self._providers:
            try:
                return provider.complete(messages, **kwargs)
            except Exception as e:
                if _is_quota_error(e):
                    logger.warning(
                        "AI: %s quota/rate error (%s), trying next provider.",
                        type(provider).__name__, e,
                    )
                    last_err = e
                    continue
                # Non-quota errors propagate immediately (bad key, context overflow, etc.)
                raise
        # All providers exhausted
        raise RuntimeError(
            f"All AI providers are unavailable (quota exceeded). Last error: {last_err}"
        )

    def _vision_openai(
        self,
        provider: OpenAIProvider,
        text_prompt: str,
        images_by_doc: List[Tuple[str, List[str]]],
        history=None,
        system_prompt=None,
        **kwargs,
    ) -> str:
        """Send a vision request via OpenAI (gpt-4o / gpt-4o-mini support vision)."""
        content: List[dict] = [{"type": "text", "text": text_prompt}]
        for _doc_name, images in images_by_doc:
            for img_b64 in images:
                img_bytes = base64.b64decode(img_b64)
                mime = _detect_mime_type(img_bytes)
                content.append({
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{mime};base64,{img_b64}",
                        "detail": "high",
                    },
                })

        vision_messages = [{"role": "system", "content": system_prompt or SYSTEM_PROMPT}]
        if history:
            for h in history[-CHAT_HISTORY_WINDOW:]:
                vision_messages.append({"role": h["role"], "content": h["content"]})
        vision_messages.append({"role": "user", "content": content})

        response = provider._client.chat.completions.create(
            model=provider._model,
            messages=vision_messages,
            max_tokens=kwargs.get("max_tokens", 2000),
            temperature=kwargs.get("temperature", 0.4),
        )
        return response.choices[0].message.content

    def _vision_anthropic(
        self,
        provider: AnthropicProvider,
        text_prompt: str,
        images_by_doc: List[Tuple[str, List[str]]],
        history=None,
        system_prompt=None,
        **kwargs,
    ) -> str:
        """Send a vision request via Anthropic (claude-3 / claude-4 support vision)."""
        content: List[dict] = []
        for _doc_name, images in images_by_doc:
            for img_b64 in images:
                img_bytes = base64.b64decode(img_b64)
                mime = _detect_mime_type(img_bytes)
                content.append({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": mime,
                        "data": img_b64,
                    },
                })
        content.append({"type": "text", "text": text_prompt})

        # Build proper multi-turn messages
        chat_messages = []
        if history:
            for h in history[-CHAT_HISTORY_WINDOW:]:
                chat_messages.append({"role": h["role"], "content": h["content"]})
        # Current user turn with images + text
        chat_messages.append({"role": "user", "content": content})

        response = provider._client.messages.create(
            model=provider._model,
            max_tokens=kwargs.get("max_tokens", 2000),
            system=system_prompt or SYSTEM_PROMPT,
            messages=chat_messages,
        )
        return response.content[0].text

    def _complete_with_vision(
        self,
        text_prompt: str,
        images_by_doc: List[Tuple[str, List[str]]],
        history=None,
        system_prompt=None,
        **kwargs,
    ) -> str:
        """Try each provider in order using vision API; fall back on quota errors."""
        last_err: Optional[Exception] = None
        for provider in self._providers:
            try:
                if isinstance(provider, OpenAIProvider):
                    return self._vision_openai(provider, text_prompt, images_by_doc, history=history, system_prompt=system_prompt, **kwargs)
                elif isinstance(provider, AnthropicProvider):
                    return self._vision_anthropic(provider, text_prompt, images_by_doc, history=history, system_prompt=system_prompt, **kwargs)
            except Exception as e:
                if _is_quota_error(e):
                    logger.warning(
                        "AI: %s vision quota/rate error (%s), trying next provider.",
                        type(provider).__name__, e,
                    )
                    last_err = e
                    continue
                raise
        raise RuntimeError(
            f"All AI providers are unavailable for vision (quota exceeded). Last error: {last_err}"
        )

    # ── Document context ─────────────────────────────────────────

    def load_documents(self, documents: List[Dict]):
        """Load parsed documents into the AI assistant."""
        self.documents = documents
        logger.info("AI Assistant: Loaded %d documents", len(documents))

    def _build_context(self, max_chars_per_doc: int = None) -> str:
        """Build context string from loaded documents."""
        if not self.documents:
            return "No documents loaded."

        if max_chars_per_doc is None:
            max_chars_per_doc = self.max_context_chars // len(self.documents)

        context_parts = []
        for i, doc in enumerate(self.documents):
            text_preview = doc["text_content"][:max_chars_per_doc]
            if len(doc["text_content"]) > max_chars_per_doc:
                text_preview += "\n[...content truncated...]"

            context_parts.append(f"""
---
DOCUMENT {i+1}: {doc['filename']}
Type: {doc['document_type']}
Words: {doc['word_count']:,}

Content:
{text_preview}
---""")

        return "\n".join(context_parts)

    def _parse_mentions(self, question: str) -> Tuple[List[Dict], List[str]]:
        """Extract @mentions from the question.

        Returns (matched_docs, unmatched_terms):
        - matched_docs: doc dicts whose filename matched an @mention
        - unmatched_terms: @terms that didn't match any doc (entity references)
        """
        raw = re.findall(r'@([\w.\-]+)', question)
        matched_docs: List[Dict] = []
        unmatched_terms: List[str] = []

        for mention in raw:
            mention_lower = mention.lower().rstrip('.,!?;:')
            found = None

            # Exact match first (filename with or without extension)
            for doc in self.documents:
                fname = doc['filename'].lower()
                stem = Path(doc['filename']).stem.lower()
                if mention_lower in (fname, stem):
                    found = doc
                    break

            # Substring match if no exact match
            if not found:
                for doc in self.documents:
                    stem = Path(doc['filename']).stem.lower()
                    if mention_lower in stem or stem in mention_lower:
                        found = doc
                        break

            if found:
                if found not in matched_docs:
                    matched_docs.append(found)
            else:
                unmatched_terms.append(mention_lower)

        return matched_docs, unmatched_terms

    def _build_context_prioritized(self, priority_docs: List[Dict]) -> str:
        """Build context with priority (mentioned) docs at full length, others briefly."""
        parts = []
        priority_ids = {id(d) for d in priority_docs}
        PRIORITY_CHARS = 20_000

        # Mentioned docs: generous limit
        for doc in priority_docs:
            text = doc['text_content'][:PRIORITY_CHARS]
            if len(doc['text_content']) > PRIORITY_CHARS:
                text += '\n[...content truncated...]'
            parts.append(f"""
---
DOCUMENT: {doc['filename']} ← REFERENCED
Type: {doc['document_type']}
Words: {doc['word_count']:,}

Content:
{text}
---""")

        # Other docs: brief
        others = [d for d in self.documents if id(d) not in priority_ids]
        if others:
            budget = max(800, (self.max_context_chars - PRIORITY_CHARS * len(priority_docs)) // len(others))
            for doc in others:
                text = doc['text_content'][:budget]
                if len(doc['text_content']) > budget:
                    text += '\n[...truncated...]'
                parts.append(f"""
---
DOCUMENT: {doc['filename']}
Type: {doc['document_type']}
Words: {doc['word_count']:,}

Content:
{text}
---""")

        return '\n'.join(parts)

    def _collect_visual_images(self, docs: List[Dict] = None) -> List[Tuple[str, List[str]]]:
        """Gather images from documents, capped at MAX_IMAGES_PER_REQUEST total.

        If *docs* is given, only those docs are checked (e.g. mentioned docs first).
        Falls back to all self.documents when docs is None.
        """
        source = docs if docs is not None else self.documents
        result: List[Tuple[str, List[str]]] = []
        total = 0
        for doc in source:
            if total >= MAX_IMAGES_PER_REQUEST:
                break
            images = _get_doc_images(doc)
            if images:
                take = min(len(images), MAX_IMAGES_PER_REQUEST - total)
                result.append((doc["filename"], images[:take]))
                total += take
                logger.info(
                    "Vision: queued %d image(s) from '%s'", take, doc["filename"]
                )
        return result

    def _run_vision_counter(self, images_by_doc: list, question: str) -> str:
        """Run YOLO/CV counting on images if the question involves counting.

        Returns a string to prepend to the AI prompt, or "" if not applicable.
        """
        if not _VISION_COUNTER_AVAILABLE or not images_by_doc:
            return ""

        count_keywords = [
            "how many", "count", "number of", "total", "how much",
            "quantity", "tally", "enumerate",
        ]
        if not any(kw in question.lower() for kw in count_keywords):
            return ""

        # Run counter on the first available image
        for _doc_name, images in images_by_doc:
            if images:
                try:
                    result = count_objects_in_image(images[0])
                    note = format_count_for_ai(result)
                    if note:
                        logger.info("AI: vision counter result prepended to prompt")
                        return note
                except Exception as e:
                    logger.warning("AI: vision counter failed: %s", e)
        return ""

    def extract_facts(self, question: str, answer: str) -> list:
        """Extract key facts from a Q&A exchange for cross-thread memory.

        Returns list of {"key": str, "value": str, "confidence": "high"|"medium"} dicts.
        Returns [] on failure or if nothing important found.
        """
        prompt = f"""Extract important facts from this exchange. Return ONLY a JSON array — nothing else.

User: {question[:2000]}
Assistant: {answer[:2000]}

Extract:
- User corrections ("actually there are 40 buildings" → key: "building_count", value: "40", confidence: "high")
- Confirmed numbers/values ("contract is $2.5M" → key: "contract_value", value: "$2.5M", confidence: "medium")
- Named entities ("Building A is the main structure" → key: "building_a_description", value: "main structure", confidence: "medium")
- Deadlines/dates ("completion is March 2026" → key: "completion_date", value: "March 2026", confidence: "medium")

If the user corrects the AI, use confidence "high". Otherwise "medium".
If no important facts, return [].

Return format (JSON array only, no markdown, no explanation):
[{{"key": "snake_case_key", "value": "the value", "confidence": "high"}}]"""

        try:
            import json
            raw = self._complete(
                messages=[{"role": "user", "content": prompt}],
                max_tokens=500,
                temperature=0.1,
            )
            raw = raw.strip()
            # Strip markdown code fences if present
            if raw.startswith("```"):
                parts = raw.split("```")
                raw = parts[1] if len(parts) > 1 else raw
                if raw.lower().startswith("json"):
                    raw = raw[len("json"):]
            raw = raw.strip()
            if not raw or raw == "[]":
                return []
            facts = json.loads(raw)
            if isinstance(facts, list):
                return [f for f in facts if isinstance(f, dict) and "key" in f and "value" in f]
        except Exception as e:
            logger.warning("Memory: fact extraction failed: %s", e)
        return []

    # ── Error formatting ─────────────────────────────────────────

    def _handle_api_error(self, e: Exception) -> str:
        """Turn an exception into a user-friendly markdown message."""
        error_msg = str(e)

        if "insufficient_quota" in error_msg or "quota" in error_msg.lower() or "All AI providers" in error_msg:
            return (
                "⚠️ **AI Quota Exceeded**\n\n"
                "Both OpenAI and Claude API quotas are currently exhausted.\n\n"
                "**To resolve:**\n"
                "- OpenAI: visit [platform.openai.com/account/billing](https://platform.openai.com/account/billing)\n"
                "- Anthropic: visit [console.anthropic.com](https://console.anthropic.com)\n\n"
                "Add credits to either account and the assistant will resume automatically."
            )
        elif "invalid_api_key" in error_msg or "authentication" in error_msg.lower():
            return "❌ **Invalid API Key** — please check your API key configuration."
        elif "context_length" in error_msg or "max_tokens" in error_msg.lower():
            return "⚠️ **Document Too Large** — try with fewer or smaller documents."
        else:
            return f"❌ **Error**: {error_msg}"

    # ── Public methods ───────────────────────────────────────────

    def get_document_summary(self, doc_index: int) -> str:
        if doc_index >= len(self.documents):
            return "Document not found."

        doc = self.documents[doc_index]
        text = doc["text_content"][:8000]

        prompt = f"""Analyze this {doc['document_type']} document and provide a comprehensive summary:

**Document**: {doc['filename']}
**Type**: {doc['document_type']}
**Size**: {doc['word_count']:,} words

---
{text}
---

Provide a structured summary with:

## Overview
Brief description of the document's purpose

## Key Parties
- List all parties, companies, or individuals mentioned

## Important Dates & Deadlines
- Contract dates, milestone dates, submission deadlines

## Scope & Requirements
- Main scope of work, key specifications

## Financial Terms
- Contract value, payment terms, cost items

## Critical Items & Risks
- Items requiring immediate attention, potential risks

## Recommended Actions
- What should the reader do next?"""

        try:
            return self._complete(
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=1500,
                temperature=0.3,
            )
        except Exception as e:
            return self._handle_api_error(e)

    def _build_system_prompt(self, project_memory: list = None) -> str:
        """Build system prompt, optionally injecting known project facts."""
        if not project_memory:
            return SYSTEM_PROMPT
        facts_text = "\n".join(f"- {m['fact_key']}: {m['fact_value']}" for m in project_memory)
        return SYSTEM_PROMPT + f"\n\nKnown project facts (verified across conversations):\n{facts_text}"

    def _build_messages(self, system: str, prompt: str, history: list = None) -> list:
        """Build the messages array with optional conversation history.

        history: list of {"role": "user"|"assistant", "content": str}
        """
        msgs = [{"role": "system", "content": system}]
        if history:
            for h in history[-CHAT_HISTORY_WINDOW:]:
                msgs.append({"role": h["role"], "content": h["content"]})
        msgs.append({"role": "user", "content": prompt})
        return msgs

    def _is_conversational(self, question: str) -> bool:
        """Return True if this question should bypass document context."""
        q = question.lower().strip().rstrip("?! ")
        return any(q == p.strip() or q.startswith(p) for p in _CONVERSATIONAL_PREFIXES)

    def ask_question(self, question: str, history: list = None, project_memory: list = None) -> str:
        """Answer any question, routing to doc-grounded or general path as appropriate."""
        try:
            system = self._build_system_prompt(project_memory)

            # Conversational / identity questions — skip document context entirely
            if self._is_conversational(question):
                return self._complete(
                    messages=self._build_messages(system, question, history),
                    max_tokens=500,
                    temperature=0.7,
                )

            if self.documents:
                mentioned_docs, search_terms = self._parse_mentions(question)

                if mentioned_docs:
                    context = self._build_context_prioritized(mentioned_docs)
                    focus = (
                        f"The user specifically referenced: "
                        f"{', '.join(d['filename'] for d in mentioned_docs)}. "
                        "Prioritize those documents."
                    )
                    images_by_doc = self._collect_visual_images(docs=mentioned_docs)
                    if len(images_by_doc) < MAX_IMAGES_PER_REQUEST:
                        remaining = [d for d in self.documents if d not in mentioned_docs]
                        images_by_doc += self._collect_visual_images(docs=remaining)
                        images_by_doc = images_by_doc[:MAX_IMAGES_PER_REQUEST]
                else:
                    context = self._build_context()
                    focus = ""
                    images_by_doc = self._collect_visual_images()

                entity_note = ""
                if search_terms:
                    entity_note = (
                        f"\nThe user referenced: {', '.join('@' + t for t in search_terms)}. "
                        "Find relevant mentions in the documents."
                    )

                cv_note = self._run_vision_counter(images_by_doc, question)

                prompt = f"""{cv_note}{question}
{focus}{entity_note}

Project documents:
{context}

Use the documents if the question relates to them. If it doesn't, answer from your knowledge and ignore the document context. For drawings/images: look for callouts, dimensions, annotations, symbols. If a COMPUTER VISION RESULT is above, it is authoritative — cite it.

CITATION RULE: Whenever you state a fact that comes from a specific document, append a citation immediately after the statement using this exact format: [src:FILENAME] — for example: [src:contract.pdf] or [src:specifications.docx]. Cite the most specific document. If a fact spans multiple documents, cite each with a separate marker. Do not cite for general knowledge or conversational responses."""

                if images_by_doc:
                    try:
                        return self._complete_with_vision(
                            prompt, images_by_doc,
                            history=history,
                            system_prompt=system,
                            max_tokens=2000, temperature=0.5
                        )
                    except Exception as e:
                        logger.warning("Vision path failed (%s); falling back to text-only.", e)

                return self._complete(
                    messages=self._build_messages(system, prompt, history),
                    max_tokens=2000,
                    temperature=0.5,
                )
            else:
                return self._complete(
                    messages=self._build_messages(system, question, history),
                    max_tokens=2000,
                    temperature=0.6,
                )
        except Exception as e:
            return self._handle_api_error(e)

    def find_conflicts(self) -> list:
        """Return a list of conflict dicts: {title, severity, description, resolution, documents}."""
        if len(self.documents) < 2:
            return []

        context = self._build_context(max_chars_per_doc=2500)
        doc_names = [d['filename'] for d in self.documents]

        prompt = f"""You are reviewing construction project documents for conflicts, gaps, and contradictions.

Documents under review:
{context}

Find every conflict. Look for:
- Spec conflicts (same item specified differently in two documents)
- Scope gaps (work needed but unassigned)
- Scope overlaps (same work assigned to multiple parties)
- Dimension or quantity discrepancies
- Timeline inconsistencies
- Payment or commercial conflicts
- Responsibility conflicts

Return ONLY a JSON array. Each element must be:
{{
  "title": "Short conflict title (max 80 chars)",
  "severity": "high" | "medium" | "low",
  "description": "What the conflict is, quoting the specific conflicting language from each document",
  "resolution": "Concrete recommendation to resolve this",
  "documents": ["exact filename 1", "exact filename 2"]
}}

Severity guide:
- high: will cause change orders, delays, or legal disputes if unresolved
- medium: needs resolution before construction proceeds
- low: minor discrepancy, worth noting but not urgent

Document filenames available: {doc_names}

Return ONLY the JSON array, no markdown, no explanation."""

        try:
            import json
            raw = self._complete(
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=3000,
                temperature=0.2,
            )
            raw = raw.strip()
            if raw.startswith("```"):
                parts = raw.split("```")
                raw = parts[1] if len(parts) > 1 else raw
                if raw.lower().startswith("json"):
                    raw = raw[4:]
            raw = raw.strip()
            conflicts = json.loads(raw)
            if isinstance(conflicts, list):
                # Sort: high → medium → low
                order = {"high": 0, "medium": 1, "low": 2}
                conflicts.sort(key=lambda c: order.get(c.get("severity", "medium"), 1))
                return conflicts
        except Exception as e:
            logger.warning("find_conflicts: JSON parse failed (%s) — returning empty", e)
        return []

    def compare_documents(self, doc1_idx: int, doc2_idx: int, comparison_type: str = "conflicts") -> dict:
        if doc1_idx >= len(self.documents) or doc2_idx >= len(self.documents):
            return {"summary": "Document not found.", "conflicts": [], "gaps": [], "agreements": [], "risks": []}
        if doc1_idx == doc2_idx:
            return {"summary": "Select two different documents.", "conflicts": [], "gaps": [], "agreements": [], "risks": []}

        doc1 = self.documents[doc1_idx]
        doc2 = self.documents[doc2_idx]

        prompt = f"""Compare these two project documents.

**{doc1['filename']}** ({doc1['document_type']}, {doc1['word_count']:,} words)
{doc1['text_content'][:4000]}

---

**{doc2['filename']}** ({doc2['document_type']}, {doc2['word_count']:,} words)
{doc2['text_content'][:4000]}

---

Return ONLY a JSON object with this exact structure:
{{
  "summary": "One concise paragraph on how these documents relate and whether they are compatible.",
  "conflicts": [
    {{
      "title": "Short conflict title (max 60 chars)",
      "doc_a": "Exact quote or key text from {doc1['filename']}",
      "doc_b": "Exact quote or key text from {doc2['filename']}",
      "impact": "What happens if this conflict is unresolved",
      "recommendation": "Which takes precedence and what action to take"
    }}
  ],
  "gaps": ["Work or obligation in one doc but not the other — be specific, max 5 items"],
  "agreements": ["Key area where both documents agree or align, max 5 items"],
  "risks": [
    {{
      "title": "Risk title (max 50 chars)",
      "description": "What a project manager must address, and how"
    }}
  ]
}}

Return ONLY the JSON. No markdown fences, no explanation."""

        try:
            import json
            raw = self._complete(
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=2500,
                temperature=0.2,
            )
            raw = raw.strip()
            if raw.startswith("```"):
                parts = raw.split("```")
                raw = parts[1] if len(parts) > 1 else raw
                if raw.lower().startswith("json"):
                    raw = raw[4:]
            raw = raw.strip()
            data = json.loads(raw)
            if isinstance(data, dict):
                return data
        except Exception as e:
            logger.warning("compare_documents: JSON parse failed (%s)", e)
        return {
            "summary": "Comparison completed but could not be structured. Please try again.",
            "conflicts": [], "gaps": [], "agreements": [], "risks": []
        }

    def extract_key_info(self, info_type: str) -> str:
        if not self.documents:
            return "No documents loaded."

        context = self._build_context()

        prompts = {
            "dates": "Extract ALL dates, deadlines, and milestones from these documents:\n\n{context}\n\nCreate a chronological timeline with date, description, source document, and status.",
            "costs": "Extract ALL financial information from these documents:\n\n{context}\n\nList contract values, unit prices, payment terms, allowances, and change order values.",
            "parties": "Extract ALL parties, companies, and individuals from these documents:\n\n{context}\n\nFor each: name, role, contact info, responsibilities, which documents mention them.",
            "requirements": "Extract ALL requirements and specifications from these documents:\n\n{context}\n\nOrganize by technical, quality, compliance, performance, and testing requirements.",
            "risks": "Identify ALL risks and issues in these documents:\n\n{context}\n\nFor each: description, source document, severity (High/Medium/Low), mitigation, owner.",
        }

        prompt = prompts.get(info_type, prompts["dates"]).format(context=context)

        try:
            return self._complete(
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=2000,
                temperature=0.3,
            )
        except Exception as e:
            return self._handle_api_error(e)
