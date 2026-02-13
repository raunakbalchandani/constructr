from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db, User
from backend.auth import (
    authenticate_user,
    create_access_token,
    get_current_user,
    register_user,
)
from backend.schemas import APIKeyUpdate, TokenResponse, UserCreate, UserLogin, UserResponse


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user."""
    user = register_user(db, user_data.email, user_data.password, user_data.name)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """Login and get access token."""
    user = authenticate_user(db, user_data.email, user_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    access_token = create_access_token(data={"sub": user.id})
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user info."""
    return current_user


@router.put("/api-key")
async def update_api_key(
    data: APIKeyUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update user's OpenAI API key."""
    current_user.openai_api_key = data.openai_api_key
    db.commit()
    return {"message": "API key updated"}
