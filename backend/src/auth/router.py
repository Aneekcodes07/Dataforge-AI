"""
Auth router — sign up, login, refresh, and profile endpoints.
Production-ready SQLAlchemy integration.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import jwt

from src.core.database import get_db
from src.core.config import get_settings
from src.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from src.auth.models import User, Workspace, WorkspaceMembership
from src.auth.schemas import LoginRequest, SignupRequest, AuthResponse, UserResponse

settings = get_settings()
router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    """Dependency validator resolving token payload to active User model."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    try:
        payload = decode_token(token)
        sub = payload.get("sub")
        token_type = payload.get("type")
        if not isinstance(sub, str) or token_type != "access":
            raise credentials_exception
        user_id = sub
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        raise credentials_exception

    import uuid

    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_uuid).first()
    if user is None:
        raise credentials_exception
    return user


@router.post(
    "/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED
)
def signup(request: SignupRequest, db: Session = Depends(get_db)):
    """Create a new user, a default workspace, and an Owner membership."""
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == request.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists",
        )

    # 1. Create user
    hashed = hash_password(request.password)
    user = User(
        name=request.name,
        email=request.email,
        hashed_password=hashed,
    )
    db.add(user)
    db.flush()  # Populate user.id

    # 2. Create workspace
    workspace = Workspace(name=f"{request.name}'s Workspace")
    db.add(workspace)
    db.flush()  # Populate workspace.id

    # 3. Map user as Owner of this workspace
    membership = WorkspaceMembership(
        workspace_id=workspace.id,
        user_id=user.id,
        role="Owner",
    )
    db.add(membership)

    db.commit()

    # Generate token
    token = create_access_token(data={"sub": str(user.id)})

    return AuthResponse(
        user=UserResponse(
            id=str(user.id),
            name=user.name,
            email=user.email,
            role="Owner",
        ),
        token=token,
        message="Account created successfully",
    )


@router.post("/login", response_model=AuthResponse)
def login(request: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """Verify credentials and return access JWT + set refresh token cookie."""
    user = db.query(User).filter(User.email == request.email).first()
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Resolve active workspace membership role
    membership = (
        db.query(WorkspaceMembership)
        .filter(WorkspaceMembership.user_id == user.id)
        .first()
    )
    role = membership.role if membership else "Viewer"

    # Access Token
    access_token = create_access_token(data={"sub": str(user.id)})

    # Refresh Token (HTTP-Only Cookie)
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        max_age=60 * 60 * 24 * 7,  # 7 days
        secure=True,
        samesite="lax",
    )

    return AuthResponse(
        user=UserResponse(
            id=str(user.id),
            name=user.name,
            email=user.email,
            role=role,
        ),
        token=access_token,
        message="Login successful",
    )


@router.post("/refresh")
def refresh(refresh_token: str = Cookie(None), db: Session = Depends(get_db)):
    """Verify refresh cookie and return fresh access JWT."""
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is missing",
        )
    try:
        payload = decode_token(refresh_token)
        sub = payload.get("sub")
        token_type = payload.get("type")
        if not isinstance(sub, str) or token_type != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token payload",
            )
        user_id = sub
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Expired or invalid refresh token",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    # Generate fresh access token
    access_token = create_access_token(data={"sub": str(user.id)})
    return {"token": access_token}


@router.get("/me", response_model=UserResponse)
def get_me(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Retrieve details of the authenticated caller."""
    membership = (
        db.query(WorkspaceMembership)
        .filter(WorkspaceMembership.user_id == current_user.id)
        .first()
    )
    role = membership.role if membership else "Viewer"

    return UserResponse(
        id=str(current_user.id),
        name=current_user.name,
        email=current_user.email,
        role=role,
    )
