"""Backend core wiring.

This module centralizes a few app-wide globals (storage mode + optional imports)
so routers can access them without creating circular imports.
"""

from __future__ import annotations

import os
import sys


# Allow importing project-root modules like document_parser.py / ai_assistant.py
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


STORAGE_BACKEND = os.environ.get("STORAGE_BACKEND", "local").strip().lower()


# Optional imports (project-root modules)
try:
    from document_parser import ConstructionDocumentParser as DocumentParser  # type: ignore
    from ai_assistant import ConstructionAI  # type: ignore
except ImportError:
    DocumentParser = None
    ConstructionAI = None
