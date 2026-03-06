"""
Database models and connection - SQLite version
"""
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, ForeignKey, Boolean, Index, UniqueConstraint
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
    memberships = relationship("ProjectMember", back_populates="user")
    notifications = relationship("Notification", back_populates="user")


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
    rfis = relationship("RFI", back_populates="project", cascade="all, delete-orphan")
    daily_reports = relationship("DailyReport", back_populates="project", cascade="all, delete-orphan")
    action_items = relationship("ActionItem", back_populates="project", cascade="all, delete-orphan")
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")


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
    parse_quality = Column(String(20), default="good")  # 'good', 'low', 'empty'
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (Index('ix_document_project_id', 'project_id'),)

    # Relationships
    project = relationship("Project", back_populates="documents")
    annotations = relationship("Annotation", back_populates="document", cascade="all, delete-orphan")


class Chat(Base):
    __tablename__ = "chats"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=True)
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
    source_thread_id = Column(Integer, ForeignKey("chats.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index('ix_projectmemory_project_id', 'project_id'),
        UniqueConstraint('project_id', 'fact_key', name='uq_projectmemory_project_fact_key'),
    )

    project = relationship("Project", back_populates="memories")


class ConflictStatus(Base):
    __tablename__ = "conflict_statuses"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    conflict_hash = Column(String(64), nullable=False)  # derived from conflict title
    status = Column(String(20), default="open")  # 'open', 'resolved', 'dismissed'
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index('ix_conflictstatus_project_id', 'project_id'),
        UniqueConstraint('project_id', 'conflict_hash', name='uq_conflictstatus_project_conflict'),
    )


class RFI(Base):
    __tablename__ = "rfis"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    number = Column(Integer, nullable=False)
    subject = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String(20), default="open")
    response = Column(Text, nullable=True)
    due_date = Column(String(20), nullable=True)
    created_by = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (Index('ix_rfi_project_id', 'project_id'),)
    project = relationship("Project", back_populates="rfis")


class DailyReport(Base):
    __tablename__ = "daily_reports"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    report_date = Column(String(20), nullable=False)
    weather = Column(String(100), nullable=True)
    crew_count = Column(Integer, nullable=True)
    work_performed = Column(Text, nullable=False)
    issues = Column(Text, nullable=True)
    created_by = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (Index('ix_dailyreport_project_id', 'project_id'),)
    project = relationship("Project", back_populates="daily_reports")


class ActionItem(Base):
    __tablename__ = "action_items"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    description = Column(Text, nullable=False)
    assigned_to = Column(String(255), nullable=True)
    due_date = Column(String(20), nullable=True)
    status = Column(String(20), default="open")
    created_by = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (Index('ix_actionitem_project_id', 'project_id'),)
    project = relationship("Project", back_populates="action_items")


class ProjectMember(Base):
    __tablename__ = "project_members"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # null if invite pending
    invited_email = Column(String(255), nullable=False)
    role = Column(String(20), default="editor")  # owner, editor, viewer
    status = Column(String(20), default="pending")  # pending, active
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (Index('ix_member_project_id', 'project_id'),)
    project = relationship("Project", back_populates="members")
    user = relationship("User", back_populates="memberships")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    type = Column(String(50), nullable=False)
    message = Column(Text, nullable=False)
    link_tab = Column(String(50), nullable=True)
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (Index('ix_notification_user_id', 'user_id'),)
    user = relationship("User", back_populates="notifications")


class Annotation(Base):
    __tablename__ = "annotations"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user_name = Column(String(255))
    type = Column(String(20), nullable=False)  # pin, box, line, text
    data = Column(Text, nullable=False)  # JSON
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (Index('ix_annotation_document_id', 'document_id'),)
    document = relationship("Document", back_populates="annotations")


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
