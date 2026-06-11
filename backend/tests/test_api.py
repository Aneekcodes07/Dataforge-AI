import pytest
from fastapi.testclient import TestClient
from src.main import app
from src.core.database import Base, engine

# Explicitly create tables for integration test environment
Base.metadata.create_all(bind=engine)

client = TestClient(app)


def test_health_check():
    """Verify system health endpoint status."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["version"] == "0.1.0"
    assert data["service"] == "dataforge-ai"


def test_auth_and_project_lifecycle():
    """Verify user registration, login, profile retrieval, and project CRUD."""
    import random
    suffix = random.randint(1000, 9999)
    email = f"test_user_{suffix}@dataforge.ai"
    password = "SecurePassword123!"
    name = "Test Automation Node"

    # 1. Register User
    signup_payload = {
        "name": name,
        "email": email,
        "password": password
    }
    signup_response = client.post("/api/auth/signup", json=signup_payload)
    assert signup_response.status_code == 201
    signup_data = signup_response.json()
    assert signup_data["user"]["email"] == email
    assert "token" in signup_data

    # 2. Login User
    login_payload = {
        "email": email,
        "password": password
    }
    login_response = client.post("/api/auth/login", json=login_payload)
    assert login_response.status_code == 200
    login_data = login_response.json()
    assert "token" in login_data
    token = login_data["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Retrieve Profile
    me_response = client.get("/api/auth/me", headers=headers)
    assert me_response.status_code == 200
    assert me_response.json()["email"] == email

    # 4. Create Project
    project_payload = {
        "name": f"Automated Ingest Dataset {suffix}",
        "sourceType": "csv",
        "config": {"delimiter": ",", "has_headers": True}
    }
    create_response = client.post("/api/projects/", json=project_payload, headers=headers)
    assert create_response.status_code == 201
    project_data = create_response.json()
    assert project_data["name"] == project_payload["name"]
    project_id = project_data["id"]

    # 5. List Projects
    list_response = client.get("/api/projects/", headers=headers)
    assert list_response.status_code == 200
    projects = list_response.json()
    assert len(projects) > 0
    assert any(p["id"] == project_id for p in projects)

    # 6. Delete Project
    delete_response = client.delete(f"/api/projects/{project_id}", headers=headers)
    assert delete_response.status_code == 200
    assert delete_response.json()["status"] == "success"

    # Verify deleted
    list_response_after = client.get("/api/projects/", headers=headers)
    assert not any(p["id"] == project_id for p in list_response_after.json())


def test_notifications_lifecycle():
    """Verify notification creation, listing, and marking as read."""
    import random
    import uuid
    from src.core.database import SessionLocal
    from src.auth.models import User
    from src.monitoring.models import Notification

    suffix = random.randint(1000, 9999)
    email = f"notif_user_{suffix}@dataforge.ai"
    password = "SecurePassword123!"
    name = "Notif Test User"

    # 1. Register User
    signup_payload = {
        "name": name,
        "email": email,
        "password": password
    }
    signup_response = client.post("/api/auth/signup", json=signup_payload)
    assert signup_response.status_code == 201
    
    # 2. Login User
    login_payload = {
        "email": email,
        "password": password
    }
    login_response = client.post("/api/auth/login", json=login_payload)
    assert login_response.status_code == 200
    token = login_response.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Insert a Notification directly into DB
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        
        notification = Notification(
            user_id=user.id,
            type="warning",
            title="Pipeline execution delayed",
            content="Run 42 delayed due to agent scaling",
            link="/history/run42",
            is_read=False
        )
        db.add(notification)
        db.commit()
        db.refresh(notification)
        notif_id = str(notification.id)
    finally:
        db.close()

    # 4. List Notifications
    list_response = client.get("/api/monitoring/notifications", headers=headers)
    assert list_response.status_code == 200
    notifs = list_response.json()
    assert len(notifs) > 0
    test_notif = next((n for n in notifs if n["id"] == notif_id), None)
    assert test_notif is not None
    assert test_notif["isRead"] is False
    assert test_notif["title"] == "Pipeline execution delayed"

    # 5. Mark as read
    read_response = client.post(f"/api/monitoring/notifications/{notif_id}/read", headers=headers)
    assert read_response.status_code == 200
    assert read_response.json()["isRead"] is True

    # 6. Mark again (verify idempotent or already read)
    read_response_again = client.post(f"/api/monitoring/notifications/{notif_id}/read", headers=headers)
    assert read_response_again.status_code == 200
    assert read_response_again.json()["isRead"] is True

    # 7. Try invalid notification UUID format (bad request)
    bad_response = client.post("/api/monitoring/notifications/not-a-uuid/read", headers=headers)
    assert bad_response.status_code == 400

    # 8. Try non-existent notification UUID
    random_uuid = str(uuid.uuid4())
    not_found_response = client.post(f"/api/monitoring/notifications/{random_uuid}/read", headers=headers)
    assert not_found_response.status_code == 404


def test_security_bola_pipeline_trigger():
    """Verify that User B cannot trigger User A's pipeline (BOLA/IDOR protection)."""
    import random
    import uuid
    from src.core.database import SessionLocal
    from src.pipelines.models import Pipeline

    suffix_a = random.randint(1000, 9999)
    suffix_b = random.randint(1000, 9999)

    # 1. Register and Login User A
    signup_a = client.post("/api/auth/signup", json={
        "name": "User A",
        "email": f"usera_{suffix_a}@dataforge.ai",
        "password": "SecurePassword123!"
    })
    assert signup_a.status_code == 201
    token_a = signup_a.json()["token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 2. User A creates a project (this creates a pipeline automatically)
    project_a = client.post("/api/projects/", json={
        "name": "Project A",
        "sourceType": "csv",
        "config": {"delimiter": ","}
    }, headers=headers_a)
    assert project_a.status_code == 201
    project_a_id = project_a.json()["id"]

    # Retrieve User A's pipeline ID from the DB
    db = SessionLocal()
    try:
        pipeline_a = db.query(Pipeline).filter(Pipeline.dataset_id == uuid.UUID(project_a_id)).first()
        assert pipeline_a is not None
        pipeline_a_id = str(pipeline_a.id)
    finally:
        db.close()

    # 3. Register and Login User B
    signup_b = client.post("/api/auth/signup", json={
        "name": "User B",
        "email": f"userb_{suffix_b}@dataforge.ai",
        "password": "SecurePassword123!"
    })
    assert signup_b.status_code == 201
    token_b = signup_b.json()["token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 4. User B attempts to trigger User A's pipeline
    trigger_response = client.post(f"/api/pipelines/{pipeline_a_id}/run", headers=headers_b)
    
    # Assert that User B gets 404 Pipeline Not Found (BOLA remediation success!)
    assert trigger_response.status_code == 404


def test_unauthenticated_websocket_extraction():
    """Verify that connecting to extraction websocket without a token is rejected."""
    import uuid
    random_id = str(uuid.uuid4())
    # FastAPI TestClient websocket connect
    with client.websocket_connect(f"/api/extraction/ws/{random_id}") as websocket:
        msg = websocket.receive_json()
        assert msg["type"] == "failed"
        assert "Authentication token missing" in msg["message"]

