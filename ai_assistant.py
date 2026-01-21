"""
Foreperson.ai - AI Assistant Module
Handles all AI/LLM interactions for document analysis.
"""

import openai
from typing import List, Dict, Optional
import os

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


class ConstructionAI:
    def __init__(self, api_key: str, model: str = "gpt-4o-mini"):
        """Initialize the AI assistant.
        
        Args:
            api_key: OpenAI API key
            model: Model to use (gpt-4o-mini recommended for cost efficiency)
        """
        self.client = openai.OpenAI(api_key=api_key)
        self.model = model
        self.documents = []
        self.max_context_chars = 12000  # Limit context to avoid token limits

    def load_documents(self, documents: List[Dict]):
        """Load parsed documents into the AI assistant."""
        self.documents = documents
        print(f"AI Assistant: Loaded {len(documents)} documents")

    def _build_context(self, max_chars_per_doc: int = None) -> str:
        """Build context string from loaded documents."""
        if not self.documents:
            return "No documents loaded."
        
        if max_chars_per_doc is None:
            max_chars_per_doc = self.max_context_chars // len(self.documents)
        
        context_parts = []
        for i, doc in enumerate(self.documents):
            text_preview = doc['text_content'][:max_chars_per_doc]
            if len(doc['text_content']) > max_chars_per_doc:
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

    def _handle_api_error(self, e: Exception) -> str:
        """Handle API errors with user-friendly messages."""
        error_msg = str(e)
        
        if "insufficient_quota" in error_msg or "429" in error_msg:
            return """⚠️ **API Quota Exceeded**

Your OpenAI API quota has been exceeded. To resolve:

1. Visit [platform.openai.com/account/billing](https://platform.openai.com/account/billing)
2. Add or update your payment method
3. Check your usage limits

**Tip**: The gpt-4o-mini model is very affordable (~$0.15 per 1M tokens)."""
        
        elif "invalid_api_key" in error_msg:
            return """❌ **Invalid API Key**

The API key appears to be invalid. Please check:
1. The key starts with 'sk-'
2. There are no extra spaces
3. The key hasn't been revoked"""
        
        elif "context_length" in error_msg:
            return """⚠️ **Document Too Large**

The combined document content exceeds the model's context limit. 
Try with fewer or smaller documents."""
        
        else:
            return f"❌ **Error**: {error_msg}"

    def detect_document_type(self, filename: str, text_content: str) -> str:
        """Detect document type using AI analysis based on construction industry standards.
        
        Args:
            filename: Name of the file
            text_content: Extracted text content (first 3000 chars for analysis)
            
        Returns:
            Document type: contract, specification, rfi, submittal, drawing, change_order, 
                          addendum, shop_drawing, as_built, or unknown
        """
        # First try simple filename-based detection
        filename_lower = filename.lower()
        if 'contract' in filename_lower or 'agreement' in filename_lower:
            return 'contract'
        elif 'spec' in filename_lower or 'specification' in filename_lower:
            return 'specification'
        elif 'rfi' in filename_lower or 'request for information' in filename_lower:
            return 'rfi'
        elif 'submittal' in filename_lower:
            return 'submittal'
        elif 'drawing' in filename_lower or 'dwg' in filename_lower or 'plan' in filename_lower:
            return 'drawing'
        elif 'change order' in filename_lower or 'co' in filename_lower:
            return 'change_order'
        elif 'addendum' in filename_lower:
            return 'addendum'
        elif 'shop drawing' in filename_lower:
            return 'shop_drawing'
        elif 'as-built' in filename_lower or 'as built' in filename_lower:
            return 'as_built'
        
        # If filename doesn't give clear indication, use AI to analyze content
        if not text_content or len(text_content.strip()) < 50:
            return 'unknown'
        
        # Analyze first 3000 characters for type detection
        content_sample = text_content[:3000]
        
        prompt = f"""Analyze this construction document and classify its type based on construction industry standards.

**Filename**: {filename}
**Content Sample**:
{content_sample}

**Document Types** (choose ONE that best matches):
- **contract**: Legal agreements, contracts, subcontracts, purchase orders
- **specification**: Technical specs, material specs, performance specs (CSI MasterFormat)
- **rfi**: Request for Information - questions about design/construction
- **submittal**: Product data, material samples, shop drawings submitted for approval
- **drawing**: Architectural drawings, structural drawings, MEP drawings, plans, elevations, sections
- **change_order**: Change orders, modifications to contract scope/cost
- **addendum**: Addenda to contracts or specifications
- **shop_drawing**: Detailed fabrication drawings from contractors/subcontractors
- **as_built**: As-built drawings showing actual constructed conditions
- **unknown**: Cannot determine type

**Classification Rules**:
- Contracts contain legal language, parties, terms, payment clauses
- Specifications contain technical requirements, standards, materials (often CSI format)
- RFIs are questions asking for clarification
- Submittals are submissions for approval (product data, samples)
- Drawings contain graphical/visual information, dimensions, annotations
- Change orders modify contract terms, scope, or cost
- Shop drawings are detailed fabrication drawings
- As-builts document actual constructed conditions

Respond with ONLY the document type (one word, lowercase, underscore for multi-word)."""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a construction document classification expert. Classify documents based on construction industry standards."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=50,
                temperature=0.1  # Low temperature for consistent classification
            )
            detected_type = response.choices[0].message.content.strip().lower()
            
            # Validate the response is one of our known types
            valid_types = ['contract', 'specification', 'rfi', 'submittal', 'drawing', 
                          'change_order', 'addendum', 'shop_drawing', 'as_built', 'unknown']
            
            # Handle multi-word responses
            if ' ' in detected_type:
                detected_type = detected_type.replace(' ', '_')
            
            # Return detected type if valid, otherwise return unknown
            if detected_type in valid_types:
                return detected_type
            else:
                # Try to match partial
                for valid_type in valid_types:
                    if valid_type in detected_type or detected_type in valid_type:
                        return valid_type
                return 'unknown'
                
        except Exception as e:
            # Fallback to filename-based detection on error
            return 'unknown'

    def get_document_summary(self, doc_index: int) -> str:
        """Generate a comprehensive summary of a specific document.
        
        Args:
            doc_index: Index of the document to summarize
            
        Returns:
            Formatted summary string
        """
        if doc_index >= len(self.documents):
            return "Document not found."

        doc = self.documents[doc_index]
        text = doc['text_content'][:8000]  # Increased limit for better summaries

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
- Their roles in the project

## Important Dates & Deadlines
- Contract dates
- Milestone dates
- Submission deadlines

## Scope & Requirements
- Main scope of work
- Key specifications or requirements
- Quality standards mentioned

## Financial Terms
- Contract value (if mentioned)
- Payment terms
- Cost items

## Critical Items & Risks
- Items requiring immediate attention
- Potential risks or issues
- Ambiguities or missing information

## Recommended Actions
- What should the reader do next?"""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=1500,
                temperature=0.3
            )
            return response.choices[0].message.content
        except Exception as e:
            return self._handle_api_error(e)

    def ask_question(self, question: str) -> str:
        """Answer a question as a construction AI assistant.
        Uses uploaded documents as context when available, but can answer general construction questions.
        
        Args:
            question: User's question
            
        Returns:
            AI response string
        """
        # Build context from documents if available
        context = ""
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
- If documents are available but don't contain relevant info, still answer using your expertise
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
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=2000,
                temperature=0.4
            )
            return response.choices[0].message.content
        except Exception as e:
            return self._handle_api_error(e)

    def find_conflicts(self) -> str:
        """Analyze all documents to find conflicts and discrepancies.
        
        Returns:
            Detailed conflict analysis
        """
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
- Impossible scheduling (task B before task A completes)
- Missing milestone dates

## 4. Commercial Conflicts
- Different prices for same items
- Inconsistent payment terms
- Budget discrepancies

## 5. Responsibility Conflicts
- Same task assigned to different parties
- Unclear responsibility assignments
- Missing required approvals

**For each conflict found:**
- Identify the specific documents involved
- Quote the conflicting text
- Explain why it's a conflict
- Suggest resolution approach

If no conflicts are found in a category, state "No conflicts identified."

End with a **Summary** of the most critical conflicts requiring immediate attention."""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=2000,
                temperature=0.3
            )
            return response.choices[0].message.content
        except Exception as e:
            return self._handle_api_error(e)

    def compare_documents(self, doc1_idx: int, doc2_idx: int, comparison_type: str = "conflicts") -> str:
        """Compare two specific documents.
        
        Args:
            doc1_idx: Index of first document
            doc2_idx: Index of second document
            comparison_type: 'conflicts', 'similarities', or 'relationships'
            
        Returns:
            Comparison analysis
        """
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

        else:  # relationships
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
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=1500,
                temperature=0.3
            )
            return response.choices[0].message.content
        except Exception as e:
            return self._handle_api_error(e)

    def extract_key_info(self, info_type: str) -> str:
        """Extract specific types of information from all documents.
        
        Args:
            info_type: 'dates', 'costs', 'parties', 'requirements', or 'risks'
            
        Returns:
            Extracted information
        """
        if not self.documents:
            return "No documents loaded."

        context = self._build_context()

        prompts = {
            "dates": """Extract ALL dates, deadlines, and milestones from these documents:

{context}

Create a chronological timeline with:
- Date/deadline
- Description
- Source document
- Status (if mentioned)""",

            "costs": """Extract ALL financial information from these documents:

{context}

List:
- Contract values and amounts
- Unit prices and rates
- Payment terms and schedules
- Allowances and contingencies
- Change order values""",

            "parties": """Extract ALL parties, companies, and individuals from these documents:

{context}

For each party, provide:
- Name
- Role/title
- Contact info (if available)
- Responsibilities
- Which documents mention them""",

            "requirements": """Extract ALL requirements and specifications from these documents:

{context}

Organize by:
- Technical requirements
- Quality standards
- Compliance requirements
- Performance criteria
- Testing/inspection requirements""",

            "risks": """Identify ALL risks and issues mentioned in these documents:

{context}

For each risk:
- Description
- Source document
- Severity (High/Medium/Low)
- Recommended mitigation
- Owner (who is responsible)"""
        }

        prompt = prompts.get(info_type, prompts["dates"]).format(context=context)

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=2000,
                temperature=0.3
            )
            return response.choices[0].message.content
        except Exception as e:
            return self._handle_api_error(e)
