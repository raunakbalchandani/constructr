"""
Foreperson.ai - AI Assistant Module
Handles all AI/LLM interactions for document analysis.

Provider priority: OpenAI → Anthropic (automatic failover on quota/rate errors).
"""

from typing import List, Dict, Optional
import os
import logging
from backend.constants import MAX_CONTEXT_CHARS, DEFAULT_AI_MODEL, DEFAULT_ANTHROPIC_MODEL
from backend.ai_provider import AIProvider, OpenAIProvider, AnthropicProvider

logger = logging.getLogger(__name__)

# System prompt for construction expertise
SYSTEM_PROMPT = """You are an expert construction project consultant and AI assistant with deep knowledge of:

**Core Expertise:**
- Construction contracts (AIA, ConsensusDocs, EJCDC)
- Project specifications (CSI MasterFormat)
- RFIs, submittals, and change orders
- Building codes and standards (IBC, NEC, OSHA, etc.)
- Project scheduling and management (CPM, Gantt charts)
- Cost estimation and budgeting
- Quality control and inspections
- Safety regulations and best practices
- Material specifications and standards
- Construction methods and techniques

**Your Role:**
- Answer questions as a knowledgeable construction professional
- Provide practical, actionable advice
- Use construction industry terminology appropriately
- When documents are provided, use them as context but don't limit yourself to only what's in them
- For general construction questions, draw from your expertise even without document context
- Be helpful, clear, and professional

**Response Style:**
- Format responses clearly with headers and bullet points when appropriate
- Cite specific documents when referencing uploaded project documents
- Provide examples and real-world context when helpful
- Highlight critical items that need attention
- Note any missing information or ambiguities when relevant"""


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

    def ask_question(self, question: str) -> str:
        """Answer a construction question, optionally grounded in uploaded documents."""
        if self.documents:
            context = self._build_context()
            prompt = f"""You are an expert construction consultant. Answer this question using your construction expertise.

**Question**: {question}

**Available Project Documents** (use these as context if relevant):
{context}

**Instructions**:
- Answer as a construction expert with deep knowledge of contracts, specifications, codes, scheduling, and project management
- If the question relates to the uploaded documents, reference them specifically
- If the question is general construction knowledge, provide expert guidance even without document context
- Be practical, actionable, and use construction industry terminology
- Format your response clearly with headers and bullet points when helpful"""
        else:
            prompt = f"""You are an expert construction consultant. Answer this question using your construction expertise.

**Question**: {question}

**Instructions**:
- Answer as a construction expert with deep knowledge of:
  * Construction contracts (AIA, ConsensusDocs, EJCDC)
  * Project specifications (CSI MasterFormat)
  * RFIs, submittals, and change orders
  * Building codes and standards (IBC, NEC, etc.)
  * Project scheduling and management
  * Cost estimation and budgeting
  * Safety regulations (OSHA)
  * Quality control and inspections
- Be practical, actionable, and use construction industry terminology
- Provide specific examples when helpful
- Format your response clearly with headers and bullet points when appropriate"""

        try:
            return self._complete(
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=2000,
                temperature=0.4,
            )
        except Exception as e:
            return self._handle_api_error(e)

    def find_conflicts(self) -> str:
        if len(self.documents) < 2:
            return "Need at least 2 documents to analyze conflicts."

        context = self._build_context(max_chars_per_doc=2500)

        prompt = f"""Perform a thorough conflict analysis of these construction documents:

{context}

**Analyze for the following types of conflicts:**

## 1. Specification Conflicts
- Different materials specified for same item
- Conflicting dimensions or quantities
- Incompatible products or systems

## 2. Scope Conflicts
- Overlapping responsibilities
- Gaps in scope (work not assigned to anyone)
- Contradictory scope descriptions

## 3. Timeline Conflicts
- Inconsistent dates between documents
- Impossible scheduling dependencies
- Missing milestone dates

## 4. Commercial Conflicts
- Different prices for same items
- Inconsistent payment terms
- Budget discrepancies

## 5. Responsibility Conflicts
- Same task assigned to different parties
- Unclear responsibility assignments

**For each conflict found:**
- Identify the specific documents involved
- Quote the conflicting text
- Explain why it's a conflict
- Suggest resolution approach

If no conflicts are found in a category, state "No conflicts identified."

End with a **Summary** of the most critical conflicts requiring immediate attention."""

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
