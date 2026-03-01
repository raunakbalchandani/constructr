"""
Database models and connection - SQLite version
"""
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, ForeignKey, Boolean, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os

# Database path
DATABASE_PATH = os.environ.get('DATABASE_PATH', 'foreperson.db')
DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

# Create engine - SQLite specific settings
engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False},  # Required for SQLite with FastAPI
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# Models
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255))
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (Index('ix_project_owner_id', 'owner_id'),)

    # Relationships
    owner = relationship("User", back_populates="projects")
    documents = relationship("Document", back_populates="project", cascade="all, delete-orphan")
    chats = relationship("Chat", back_populates="project", cascade="all, delete-orphan")
    memories = relationship("ProjectMemory", back_populates="project", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=False)  # Local file path
    file_size = Column(Integer)  # Size in bytes
    mime_type = Column(String(100))
    document_type = Column(String(50))  # contract, specification, rfi, submittal, drawing
    extracted_text = Column(Text)  # Parsed text content
    summary = Column(Text)  # AI-generated summary
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (Index('ix_document_project_id', 'project_id'),)

    # Relationships
    project = relationship("Project", back_populates="documents")


class Chat(Base):
    __tablename__ = "chats"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    project = relationship("Project", back_populates="chats")
    messages = relationship("ChatMessage", back_populates="chat", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("chats.id"), nullable=False)
    role = Column(String(20), nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (Index('ix_chatmessage_chat_id', 'chat_id'),)

    # Relationships
    chat = relationship("Chat", back_populates="messages")


class ProjectMemory(Base):
    __tablename__ = "project_memories"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    fact_key = Column(String(255), nullable=False)
    fact_value = Column(Text, nullable=False)
    confidence = Column(String(20), default="medium")  # "high" or "medium"
    source_thread_id = Column(Integer, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (Index('ix_projectmemory_project_id', 'project_id'),)

    project = relationship("Project", back_populates="memories")


# Database dependency for FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Create all tables
def init_db():
    Base.metadata.create_all(bind=engine)


# Initialize database on import
if __name__ == "__main__":
    init_db()
    print(f"Database initialized at {DATABASE_PATH}")
