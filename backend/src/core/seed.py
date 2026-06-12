"""
Database seeding script — Populates standard workspace and user configurations.
"""

import sys
import os
from datetime import datetime, timedelta

# Add workspace directory to path so we can import src modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from src.core.database import SessionLocal, Base
from src.core.security import hash_password
from src.auth.models import (
    User,
    Workspace,
    WorkspaceMembership,
    Team,
    APIKey,
    CopilotSession,
    CopilotMessage,
)
from src.datasets.models import Dataset
from src.pipelines.models import Pipeline, PipelineRun
from src.monitoring.models import AgentMetrics, Notification, ActivityLog, AuditEvent


def seed_db():
    print("Starting database seeding...")
    db = SessionLocal()
    try:
        # Clear existing data in dependency order
        print("Clearing existing data...")
        db.query(AgentMetrics).delete()
        db.query(PipelineRun).delete()
        db.query(Pipeline).delete()
        db.query(Dataset).delete()
        db.query(ActivityLog).delete()
        db.query(Notification).delete()
        db.query(AuditEvent).delete()
        db.query(APIKey).delete()
        db.query(CopilotMessage).delete()
        db.query(CopilotSession).delete()
        db.execute(Base.metadata.tables["team_memberships"].delete())
        db.query(Team).delete()
        db.query(WorkspaceMembership).delete()
        db.query(Workspace).delete()
        db.query(User).delete()
        db.commit()

        # 1. Create users
        print("Creating users...")
        admin_pass = hash_password("AdminSecurePass123!")
        member_pass = hash_password("MemberSecurePass123!")

        admin_user = User(
            name="Admin Operator",
            email="admin@dataforge.ai",
            hashed_password=admin_pass,
            email_verified=True,
        )
        member_user = User(
            name="Data Engineer",
            email="engineer@dataforge.ai",
            hashed_password=member_pass,
            email_verified=True,
        )
        db.add_all([admin_user, member_user])
        db.flush()  # Populate IDs

        # 2. Create workspace
        print("Creating workspace...")
        workspace = Workspace(name="DataForge Development Workspace")
        db.add(workspace)
        db.flush()

        # 3. Create memberships
        print("Creating memberships...")
        admin_membership = WorkspaceMembership(
            workspace_id=workspace.id, user_id=admin_user.id, role="Owner"
        )
        member_membership = WorkspaceMembership(
            workspace_id=workspace.id, user_id=member_user.id, role="Editor"
        )
        db.add_all([admin_membership, member_membership])

        # 4. Create team
        print("Creating team...")
        dev_team = Team(workspace_id=workspace.id, name="Engineering Operations")
        db.add(dev_team)
        db.flush()

        # Add member to team
        db.execute(
            Base.metadata.tables["team_memberships"]
            .insert()
            .values(team_id=dev_team.id, user_id=member_user.id)
        )

        # 5. Create datasets
        print("Creating datasets...")
        dataset_1 = Dataset(
            workspace_id=workspace.id,
            name="Customer Transactions Ingest",
            source_type="csv",
            description="Transaction event log stream collected from Stripe API.",
            s3_path="s3://dataforge-vault/stripe/transactions_v1.csv",
            schema_config={
                "fields": [
                    {"name": "transaction_id", "type": "string", "nullable": False},
                    {"name": "amount_cents", "type": "integer", "nullable": False},
                    {"name": "currency", "type": "string", "nullable": False},
                    {"name": "status", "type": "string", "nullable": False},
                    {"name": "timestamp", "type": "timestamp", "nullable": False},
                ]
            },
            record_count=154200,
            column_count=5,
            quality_score=98.50,
            status="Processed",
            owner_id=member_user.id,
        )
        dataset_2 = Dataset(
            workspace_id=workspace.id,
            name="Web Traffic Clickstream",
            source_type="json",
            description="Raw web traffic logs from Google Analytics export.",
            s3_path="s3://dataforge-vault/analytics/clickstream.json",
            schema_config={
                "fields": [
                    {"name": "session_id", "type": "string", "nullable": False},
                    {"name": "url_path", "type": "string", "nullable": False},
                    {"name": "referrer", "type": "string", "nullable": True},
                    {"name": "visitor_ip", "type": "string", "nullable": False},
                ]
            },
            record_count=0,
            column_count=0,
            quality_score=0.00,
            status="Empty",
            owner_id=member_user.id,
        )
        db.add_all([dataset_1, dataset_2])
        db.flush()

        # 6. Create pipeline
        print("Creating pipeline...")
        pipeline_1 = Pipeline(
            workspace_id=workspace.id,
            dataset_id=dataset_1.id,
            name="Stripe Ingestion ETL",
            description="Automated Stripe ingestion pipeline executing validations.",
            status="Active",
            cron_schedule="0 * * * *",
            run_configuration={
                "steps": [
                    {"name": "OCR", "enabled": False},
                    {"name": "Extraction", "enabled": True},
                    {"name": "Validation", "enabled": True},
                    {"name": "Cleaning", "enabled": True},
                    {"name": "EDA", "enabled": False},
                    {"name": "Export", "enabled": True},
                ],
                "export_target": "s3://dataforge-clean/stripe/",
            },
            owner_id=member_user.id,
        )
        db.add(pipeline_1)
        db.flush()

        # 7. Create runs
        print("Creating pipeline runs...")
        run_1 = PipelineRun(
            pipeline_id=pipeline_1.id,
            status="completed",
            triggered_by=member_user.id,
            duration_seconds=342,
            records_processed=154200,
            logs_path="/logs/stripe_etl_run_01.log",
            created_at=datetime.utcnow() - timedelta(hours=2),
            started_at=datetime.utcnow() - timedelta(hours=2, minutes=5),
            finished_at=datetime.utcnow() - timedelta(hours=2),
        )
        run_2 = PipelineRun(
            pipeline_id=pipeline_1.id,
            status="failed",
            triggered_by=member_user.id,
            duration_seconds=12,
            records_processed=125,
            error_message="ValidationFailed: 'amount_cents' contains invalid values on line 126",
            logs_path="/logs/stripe_etl_run_02.log",
            created_at=datetime.utcnow() - timedelta(hours=1),
            started_at=datetime.utcnow() - timedelta(hours=1, minutes=1),
            finished_at=datetime.utcnow() - timedelta(hours=1),
        )
        db.add_all([run_1, run_2])
        db.flush()

        # 8. Create agent metrics
        print("Creating agent metrics...")
        metrics = [
            AgentMetrics(
                run_id=run_1.id,
                agent_type="Extraction",
                status="Completed",
                throughput=450.50,
                queue_size=0,
                cpu_percentage=45.20,
                memory_bytes=1024 * 1024 * 150,
                runtime_seconds=120,
            ),
            AgentMetrics(
                run_id=run_1.id,
                agent_type="Validation",
                status="Completed",
                throughput=820.00,
                queue_size=0,
                cpu_percentage=60.50,
                memory_bytes=1024 * 1024 * 220,
                runtime_seconds=90,
            ),
            AgentMetrics(
                run_id=run_1.id,
                agent_type="Cleaning",
                status="Completed",
                throughput=1200.00,
                queue_size=0,
                cpu_percentage=35.00,
                memory_bytes=1024 * 1024 * 110,
                runtime_seconds=132,
            ),
        ]
        db.add_all(metrics)

        # 9. Create notifications
        print("Creating notifications...")
        notifications = [
            Notification(
                user_id=admin_user.id,
                type="success",
                title="System health online",
                content="All agent nodes verified and active.",
                link="/monitoring/agents",
                is_read=True,
            ),
            Notification(
                user_id=member_user.id,
                type="error",
                title="Stripe ETL Run Failed",
                content="Pipeline failed validation rules. Check run logs.",
                link=f"/pipelines/{pipeline_1.id}/runs/{run_2.id}",
                is_read=False,
            ),
        ]
        db.add_all(notifications)

        # 10. Create activity logs
        print("Creating activity logs...")
        activities = [
            ActivityLog(
                workspace_id=workspace.id,
                user_id=member_user.id,
                event_type="PIPELINE_RUN",
                description=f"Pipeline '{pipeline_1.name}' run completed successfully.",
                ip_address="192.168.1.50",
            ),
            ActivityLog(
                workspace_id=workspace.id,
                user_id=member_user.id,
                event_type="PIPELINE_RUN_FAILURE",
                description=f"Pipeline '{pipeline_1.name}' run failed validation rules.",
                ip_address="192.168.1.50",
            ),
        ]
        db.add_all(activities)

        # 11. Create audit events
        print("Creating audit events...")
        audit = AuditEvent(
            workspace_id=workspace.id,
            entity_type="Pipeline",
            entity_id=pipeline_1.id,
            action="CREATE",
            details={
                "name": pipeline_1.name,
                "cron_schedule": pipeline_1.cron_schedule,
            },
            performer_id=member_user.id,
            ip_address="192.168.1.50",
        )
        db.add(audit)

        # 12. Create API key
        print("Creating API Key...")
        api_key = APIKey(
            workspace_id=workspace.id,
            name="Default Ingestion Key",
            hashed_key="df_sha256_hash_mock_value_for_seeding",
            prefix="df_key_xyz",
            is_active=True,
            owner_id=member_user.id,
            expires_at=datetime.utcnow() + timedelta(days=365),
        )
        db.add(api_key)

        # 13. Create Copilot session & messages
        print("Creating Copilot session...")
        session = CopilotSession(
            user_id=member_user.id, title="Ingesting Clickstream JSON"
        )
        db.add(session)
        db.flush()

        messages = [
            CopilotMessage(
                session_id=session.id,
                sender="user",
                text="How do I clean visitor_ip fields in my Web Traffic Clickstream?",
            ),
            CopilotMessage(
                session_id=session.id,
                sender="ai",
                text="You can use the 'Cleaning' agent in your pipeline to mask or convert IPs. Would you like me to generate a configuration for you?",
                card_type="recommendation",
                card_data={"step": "Cleaning", "rule": "mask_ip"},
            ),
        ]
        db.add_all(messages)

        db.commit()
        print("Seeding database completed successfully!")
    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {e}")
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    seed_db()
