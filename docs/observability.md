# DataForge AI — Observability Manual

This manual details the monitoring stack, custom application metrics, preconfigured alerting limits, Grafana dashboard panels, and exception tracking configs.

---

## 📈 Metric Collection Workflow

DataForge AI uses a metrics pipeline where Prometheus scrapes application telemetry. The workflow follows:

```
FastAPI Server                        Prometheus Scraping                      Grafana Dashboards
┌──────────────────────┐              ┌──────────────────────┐                 ┌──────────────────────┐
│ Tracks HTTP / Celery │              │ Scrapes /metrics     │                 │ Queries Prometheus   │
│ DB queries, Cache    │ ───────────> │ at 10-second         │ ──────────────> │ renders real-time    │
│ and websocket counts │              │ intervals            │                 │ visual charts        │
└──────────────────────┘              └──────────────────────┘                 └──────────────────────┘
                                                  │
                                                  ▼
                                      Triggers alert.rules.yml
                                      evaluations on thresholds
```

---

## ⚙️ Custom Telemetry Metrics

Custom Prometheus metrics are defined in `backend/src/core/observability.py` and served via `/api/monitoring/metrics`:

| Metric Name | Type | Labels | Description |
|---|---|---|---|
| `http_requests_total` | `Counter` | `method`, `endpoint`, `status` | Total HTTP requests handled |
| `http_request_duration_seconds` | `Histogram` | `method`, `endpoint` | End-to-end request latencies |
| `websocket_connections_active` | `Gauge` | `room` | Active WebSocket sessions count |
| `database_query_duration_seconds` | `Histogram` | `statement_type` | SQLAlchemy query execution time |
| `redis_operations_total` | `Counter` | `operation_type` | Cache read, write, delete counts |
| `celery_tasks_total` | `Counter` | `task_name`, `status` | Total tasks ran and execution outcomes |
| `pipeline_runs_total` | `Counter` | `pipeline_id`, `status` | Total pipeline run starts & ends |
| `agent_telemetry_metrics` | `Gauge` | `agent_type`, `metric_type` | Agent discovery and health rates |
| `service_health_status` | `Gauge` | `service_name` | downstream system health (1=OK, 0=Fail) |

---

## 🚨 Preconfigured Prometheus Alerts

Alerting expressions are configured in `prometheus/alert.rules.yml`. Prometheus continuously evaluates these rules against scraped values:

### 1. High API Error Rate (`HighErrorRate`)
* **Expression**: `sum(rate(http_requests_total{status=~"5.."}[2m])) / sum(rate(http_requests_total[2m])) * 100 > 5`
* **Trigger Window**: Evaluates for 1 minute before generating alarm state.
* **Severity**: `critical`
* **Condition**: Fired if more than 5% of web requests fail with HTTP 5xx responses.

### 2. Services Offline Alerts (`BackendOffline`, `DatabaseOffline`, `RedisOffline`)
* **Expressions**:
  - Backend Exporter: `up{job="backend"} == 0`
  - PostgreSQL Health Gauge: `service_health_status{service_name="database"} == 0`
  - Redis Health Gauge: `service_health_status{service_name="redis"} == 0`
* **Severity**: `critical`
* **Condition**: Active if network checks to downstream dependencies fail or if target endpoints stop responding.

### 3. Worker Inactivity (`WorkerOffline`)
* **Expression**: `service_health_status{service_name="celery"} == 0`
* **Severity**: `warning`
* **Condition**: Triggers warning if backend cannot retrieve active pings from Celery worker nodes.

---

## 📊 Pre-provisioned Grafana Dashboards

Grafana loads settings from the `grafana/provisioning/` directory at startup.

### Dashboards Provisioned:
1. **System Health (`system_health.json`)**:
   - Displays CPU & Memory usage graphs (via `node-exporter` queries).
   - Monitors active WebSockets count.
   - Plots API HTTP response code distributions.
2. **Pipelines & Workers (`pipelines_workers.json`)**:
   - Tracks active Celery task throughput.
   - Summarizes total extraction pipelines processed vs failed runs.
   - Plots SQLAlchemy database query execution latencies.

To browse preconfigured charts, open Grafana at `http://localhost:3000` and navigate to the **DataForge AI** dashboard folder.

---

## 🪓 Sentry Error Reporting Integration

The Sentry SDK collects exception trace logs.

### Backend Setup:
FastAPI automatically initializes Sentry at launch if the `SENTRY_DSN` variable is provided. Inside `backend/src/core/observability.py`:
- Configured using Pydantic Settings parameters.
- Integrates `FastAPIIntegration` and `CeleryIntegration` to trace crashes automatically across HTTP contexts and background queues.
- Utilizes `traces_sample_rate` to capture performance transaction logs:

```python
sentry_sdk.init(
    dsn=sENTRY_DSN,
    integrations=[FastAPIIntegration(), CeleryIntegration()],
    traces_sample_rate=0.1,  # Record 10% of transaction profiles
    environment="production"
)
```

### Frontend Setup:
The React client hooks into the Vite environment variable `VITE_SENTRY_DSN` to register runtime error handlers:
- Catches unhandled browser crashes.
- Maps JavaScript source maps to production bundle traces for detailed debugging.
