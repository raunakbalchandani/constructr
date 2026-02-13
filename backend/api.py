"""FastAPI REST API.

This file focuses on app wiring (FastAPI instance + middleware + router mounting).
Route handlers live under backend/routers/.

Run with: uvicorn backend.api:app --reload
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.database import init_db
from backend.routers import auth, chat, documents, projects


app = FastAPI(
    title="Foreperson.ai API",
    description="Construction Document Intelligence API",
    version="1.0.0",
)


# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    init_db()


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "foreperson-api"}


# Routers
app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(documents.router)
app.include_router(chat.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
