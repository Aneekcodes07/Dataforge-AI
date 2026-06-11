# DataForge AI — Deployment Manual

This document details the step-by-step procedures for deploying the DataForge AI platform in local development setups and production environments.

---

## 💻 Local Development Deployment

Local development requires running backend services (Python FastAPI, Postgres, Redis) and frontend services (React HMR) independently.

### Prerequisites
* **Python**: `3.11` or higher.
* **Node.js**: `20.x` or higher (with `npm`).
* **PostgreSQL**: Local instance running on port `5432`.
* **Redis**: Local instance running on port `6379`.

---

### 1. Setup Environment Configuration
Duplicate the configuration template at the repository root and update values matching your local database installation credentials:

```bash
cp .env.example .env
```

Ensure `DATABASE_URL` and `REDIS_URL` point to `localhost`:
```ini
DATABASE_URL=postgresql://dataforge:secure_pass@localhost:5432/dataforge_ai
REDIS_URL=redis://localhost:6379/0
```

---

### 2. Backend Installation & Server Launch
Activate a virtual python environment in the backend folder, install libraries, run database schema updates, and start the FastAPI uvicorn daemon:

```bash
# 1. Navigate to backend
cd backend

# 2. Virtual environment setup
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate

# 3. Install packages
pip install --upgrade pip
pip install -r requirements.txt
pip install -r requirements-dev.txt

# 4. Apply database schema migrations
alembic upgrade head

# 5. Populate initial project seed metadata
python -m src.core.seed

# 6. Launch FastAPI server
uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```

---

### 3. Background Workers Setup
Celery background workers require a separate process. With the same virtual environment active in the backend directory:

#### Run Celery Worker Nodes:
```bash
celery -A src.celery_app worker --loglevel=info
```

#### Run Celery Beat Scheduler:
```bash
celery -A src.celery_app beat --loglevel=info
```

---

### 4. Frontend Launch
In a new shell terminal, navigate to the frontend directory, install npm packages, and start the hot-module-reloading development server:

```bash
# 1. Navigate to frontend
cd frontend

# 2. Install dependencies
npm install

# 3. Run development web server
npm run dev
```

The React dashboard will be accessible at `http://localhost:5173/dashboard`.

---

## 🐳 Docker Production-Ready Orchestration

Deploying with Docker Compose builds optimized images and packages networking interfaces, volumes, and metrics scraper setups automatically.

### Single-Command Start
Navigate to the root directory containing `docker-compose.yml` and run:

```bash
docker compose up --build -d
```

### Verification Checks

1. **Containers Health**: Verify that all 10 containers are running and marked healthy:
   ```bash
   docker compose ps
   ```
2. **Access Interfaces**:
   - **Frontend App**: `http://localhost/`
   - **Swagger Docs**: `http://localhost/api/docs`
   - **Prometheus UI**: `http://localhost:9090`
   - **Grafana UI**: `http://localhost:3000` (Login: `admin` / your custom password)

---

## 🔒 Production Security Recommendations

To transition this docker-compose configuration to a live production cluster (e.g., AWS ECS, Kubernetes, or VPS), execute the following security guidelines:

### 1. Hardened Key Rotation
Do not launch the platform using default secrets. Generate secure random base64 strings and inject them via host environment profiles:

```bash
# Generate secure keys
openssl rand -hex 32
```

Inject unique values in production:
```ini
SECRET_KEY=y0ur_h4rd3n3d_r4ndom_s3cr3t_k3y_h3r3
JWT_SECRET=y0ur_h4rd3n3d_jwt_k3y_s3cr3t_s1gn1ng
```

### 2. Force Production Debug Flags
Set `DEBUG=false` in your production environments. This prevents FastAPI from rendering detailed interactive traceback stacks to public users on errors.

### 3. SSL Configuration
The default `nginx.conf` handles port `80` traffic. For production:
- Obtain an SSL certificate using Let's Encrypt (Certbot).
- Modify the Nginx configuration to listen on port `443`, bind the SSL certificates, and redirect port `80` HTTP calls to HTTPS.
- Enable HTTP/2 and configure safe cipher suites.

### 4. Database Hardening & Backups
- **Postgres Volume**: Backup the Docker volume (`postgres-data`) using cron scheduled dump tasks (`pg_dump`).
- **Network Access**: Ensure the database port `5432` is not bound to public host interfaces (`0.0.0.0`) in the production compose file. It should remain internal to the docker bridge network.

### 5. CORS Restrictions
In `backend/src/core/config.py`, replace wildcard CORS hosts with your actual registered system domain name:

```python
CORS_ORIGINS = [
    "https://dataforge.yourdomain.com",
    "https://api.yourdomain.com"
]
```
