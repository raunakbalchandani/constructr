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
from backend.constants import MAX_CONTEXT_CHARS, DEFAULT_AI_MODEL, DEFAULT_ANTHROPIC_MODEL
from backend.ai_provider import AIProvider, OpenAIProvider, AnthropicProvider

logger = logging.getLogger(__name__)

# System prompt for construction expertise
SYSTEM_PROMPT = """You are Foreperson — an AI assistant built for construction project managers with 20+ years of field experience baked in. You think like a senior PM or superintendent who has run jobs from groundbreaking to closeout: AIA contracts, CSI specs (all 50 divisions), subcontracts, RFI logs, shop drawings, pay apps, punch lists, site plans, structural drawings, MEP coordination, schedules, budgets — you know all of it cold.

How you respond:
- Match the tone to the question. Simple question → short direct answer. Complex analysis → structured breakdown.
- Never open with "Certainly!", "Great question!", "Of course!" or any filler. Just answer.
- Use bullet points or headers only when they genuinely help (lists of items, step-by-step processes, comparisons). Not for every single response.
- Numbers, dates, and dollar amounts should be specific. Vague ranges are useless on a job site.
- When something is a risk, a conflict, or a red flag, say so clearly — don't soften it.
- When referencing an uploaded document, cite it by name.
- If you don't know something or the documents don't cover it, say so plainly.
- For field questions, give answers a superintendent can act on immediately.
- For contract/legal questions, flag when an attorney should be involved.

You are talking to people who have no patience for fluff. Be the smartest person in the trailer."""


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
MAX_PDF_PAGES = 5


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
            mat = fitz.Matrix(150 / 72, 150 / 72)
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

    if ext == ".pdf" and doc.get("document_type") in VISUAL_DOC_TYPES:
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
        **kwargs,
    ) -> str:
        """Send a vision request via OpenAI (gpt-4o / gpt-4o-mini support vision)."""
        content: List[dict] = [{"type": "text", "text": text_prompt}]
        for _doc_name, images in images_by_doc:
            for img_b64 in images:
                content.append({
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/png;base64,{img_b64}",
                        "detail": "high",
                    },
                })

        vision_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        if history:
            for h in history[-20:]:
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
        **kwargs,
    ) -> str:
        """Send a vision request via Anthropic (claude-3 / claude-4 support vision)."""
        content: List[dict] = []
        for _doc_name, images in images_by_doc:
            for img_b64 in images:
                content.append({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": img_b64,
                    },
                })
        history_text = ""
        if history:
            history_text = "Prior conversation:\n"
            for h in history[-20:]:
                history_text += f"{h['role'].upper()}: {h['content']}\n"
            history_text += "\n"
        content.append({"type": "text", "text": history_text + text_prompt})

        response = provider._client.messages.create(
            model=provider._model,
            max_tokens=kwargs.get("max_tokens", 2000),
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": content}],
        )
        return response.content[0].text

    def _complete_with_vision(
        self,
        text_prompt: str,
        images_by_doc: List[Tuple[str, List[str]]],
        history=None,
        **kwargs,
    ) -> str:
        """Try each provider in order using vision API; fall back on quota errors."""
        last_err: Optional[Exception] = None
        for provider in self._providers:
            try:
                if isinstance(provider, OpenAIProvider):
                    return self._vision_openai(provider, text_prompt, images_by_doc, history=history, **kwargs)
                elif isinstance(provider, AnthropicProvider):
                    return self._vision_anthropic(provider, text_prompt, images_by_doc, history=history, **kwargs)
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

    def _build_messages(self, system: str, prompt: str, history: list = None) -> list:
        """Build the messages array with optional conversation history.

        history: list of {"role": "user"|"assistant", "content": str}
        """
        msgs = [{"role": "system", "content": system}]
        if history:
            for h in history[-20:]:
                msgs.append({"role": h["role"], "content": h["content"]})
        msgs.append({"role": "user", "content": prompt})
        return msgs

    def ask_question(self, question: str, history: list = None) -> str:
        """Answer a construction question, optionally grounded in uploaded documents."""
        try:
            if self.documents:
                # Parse @mentions to prioritize specific docs / search for entities
                mentioned_docs, search_terms = self._parse_mentions(question)

                if mentioned_docs:
                    context = self._build_context_prioritized(mentioned_docs)
                    focus = (
                        f"The user specifically referenced: "
                        f"{', '.join(d['filename'] for d in mentioned_docs)}. "
                        "Prioritize those documents in your answer."
                    )
                    # Vision: try mentioned docs first, then all docs if under limit
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
                        f"\nThe user also referenced: {', '.join('@' + t for t in search_terms)}. "
                        "Search all documents for mentions of these terms and include relevant findings."
                    )

                prompt = f"""Question: {question}
{focus}{entity_note}

Project documents:
{context}

Answer using the documents where relevant. Where drawings or images are provided, examine them carefully — look for callouts, annotations, colored markings, dimensions, sheet references, symbols, and spatial relationships. If the question isn't covered by the documents, answer from your construction expertise. Be direct."""

                if images_by_doc:
                    try:
                        return self._complete_with_vision(
                            prompt, images_by_doc, history=history, max_tokens=2000, temperature=0.4
                        )
                    except Exception as e:
                        logger.warning(
                            "Vision path failed (%s); falling back to text-only.", e
                        )

                return self._complete(
                    messages=self._build_messages(SYSTEM_PROMPT, prompt, history),
                    max_tokens=2000,
                    temperature=0.4,
                )
            else:
                return self._complete(
                    messages=self._build_messages(
                        SYSTEM_PROMPT,
                        f"Question: {question}\n\nAnswer from your construction expertise. Be direct and specific.",
                        history,
                    ),
                    max_tokens=2000,
                    temperature=0.4,
                )
        except Exception as e:
            return self._handle_api_error(e)

    def find_conflicts(self) -> str:
        if len(self.documents) < 2:
            return "Need at least 2 documents to analyze conflicts."

        context = self._build_context(max_chars_per_doc=2500)

        prompt = f"""Review these construction documents and find every conflict, gap, and contradiction:

{context}

Look for:
- Spec conflicts (same item specified differently in two places)
- Scope gaps (work that needs to happen but no one owns it)
- Scope overlaps (same work assigned to multiple parties)
- Dimension or quantity discrepancies
- Timeline inconsistencies
- Payment or commercial conflicts
- Responsibility conflicts

For each issue: name the documents involved, quote the conflicting language, say why it's a problem, and suggest how to resolve it.

Rank conflicts by severity. Lead with the ones that will cause change orders or delays if not resolved."""

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

    def compare_documents(self, doc1_idx: int, doc2_idx: int, comparison_type: str = "conflicts") -> str:
        if doc1_idx >= len(self.documents) or doc2_idx >= len(self.documents):
            return "Document not found."
        if doc1_idx == doc2_idx:
            return "Please select two different documents to compare."

        doc1 = self.documents[doc1_idx]
        doc2 = self.documents[doc2_idx]

        if comparison_type == "conflicts":
            prompt = f"""Compare these two documents and identify all conflicts and discrepancies:

DOCUMENT 1: {doc1['filename']} ({doc1['document_type']})
{doc1['text_content'][:4000]}

DOCUMENT 2: {doc2['filename']} ({doc2['document_type']})
{doc2['text_content'][:4000]}

For each conflict:
1. Quote the conflicting information from each document
2. Explain why it's a conflict
3. Recommend which document should take precedence
4. Suggest how to resolve"""
        elif comparison_type == "similarities":
            prompt = f"""Analyze these two documents and identify what they have in common:

DOCUMENT 1: {doc1['filename']} ({doc1['document_type']})
{doc1['text_content'][:4000]}

DOCUMENT 2: {doc2['filename']} ({doc2['document_type']})
{doc2['text_content'][:4000]}

Identify:
1. Common parties or stakeholders
2. Shared scope items
3. Related dates and timelines
4. Connected financial terms
5. How the documents complement each other"""
        else:
            prompt = f"""Analyze the relationship between these two documents:

DOCUMENT 1: {doc1['filename']} ({doc1['document_type']})
{doc1['text_content'][:4000]}

DOCUMENT 2: {doc2['filename']} ({doc2['document_type']})
{doc2['text_content'][:4000]}

Explain:
1. How do these documents relate to each other?
2. Does one reference or depend on the other?
3. What is the hierarchy between them?
4. Are there cross-references?
5. How should they be used together?"""

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
