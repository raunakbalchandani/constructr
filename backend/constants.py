"""Shared constants for the Foreperson backend."""

MAX_CONTEXT_CHARS = 12_000       # Max chars of document text passed to AI
SAMPLE_SIZE = 3_000              # Chars used when sampling doc type
MAX_FILE_SIZE = 50 * 1024 * 1024 # 50 MB upload limit
DEFAULT_AI_MODEL = "gpt-4o-mini"
DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6"
PAGINATION_DEFAULT_LIMIT = 20
PAGINATION_MAX_LIMIT = 100
CHAT_RATE_LIMIT = "10/minute"
CONFLICTS_RATE_LIMIT = "5/minute"
