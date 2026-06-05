"""initial storage schema

Revision ID: 0001_initial_storage
Revises:
Create Date: 2026-05-29 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "0001_initial_storage"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("email", sa.String(), nullable=False, unique=True),
        sa.Column("passwordHash", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("createdAt", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updatedAt", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "api_keys",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("userId", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(), nullable=False),
        sa.Column("encryptedKey", sa.String(), nullable=False),
        sa.Column("keyHint", sa.String(), nullable=False),
        sa.Column("isValid", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("createdAt", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updatedAt", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("userId", "provider", name="api_keys_user_provider_key"),
    )

    op.create_table(
        "businesses",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("userId", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("tagline", sa.String(), nullable=True),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("location", sa.String(), nullable=True),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("status", sa.String(), server_default=sa.text("'draft'"), nullable=False),
        sa.Column("createdAt", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updatedAt", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "inventory_items",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("businessId", sa.String(), sa.ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("sku", sa.String(), nullable=True),
        sa.Column("price", sa.Float(), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=True),
        sa.Column("category", sa.String(), nullable=True),
        sa.Column("createdAt", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "agent_runs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("businessId", sa.String(), sa.ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(), server_default=sa.text("'pending'"), nullable=False),
        sa.Column("currentStep", sa.String(), nullable=True),
        sa.Column("error", sa.String(), nullable=True),
        sa.Column("createdAt", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("completedAt", sa.DateTime(), nullable=True),
        sa.Column("taskExecutionId", sa.String(), unique=True, nullable=True),
    )

    op.create_table(
        "agent_logs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("runId", sa.String(), sa.ForeignKey("agent_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("agent", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("input", sa.String(), nullable=True),
        sa.Column("output", sa.String(), nullable=True),
        sa.Column("durationMs", sa.Integer(), nullable=True),
        sa.Column("errorCode", sa.String(), nullable=True),
        sa.Column("usedFallback", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("createdAt", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "generated_sites",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("businessId", sa.String(), sa.ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("html", sa.String(), nullable=False),
        sa.Column("css", sa.String(), nullable=False),
        sa.Column("meta", sa.String(), nullable=True),
        sa.Column("status", sa.String(), server_default=sa.text("'draft'"), nullable=False),
        sa.Column("createdAt", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updatedAt", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "marketing_plans",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("businessId", sa.String(), sa.ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("channels", sa.String(), nullable=False),
        sa.Column("content", sa.String(), nullable=False),
        sa.Column("schedule", sa.String(), nullable=True),
        sa.Column("status", sa.String(), server_default=sa.text("'draft'"), nullable=False),
        sa.Column("createdAt", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updatedAt", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "approval_policies",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("businessId", sa.String(), sa.ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("actionType", sa.String(), nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("requiresApproval", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("minRiskLevel", sa.String(), server_default=sa.text("'medium'"), nullable=False),
        sa.Column("createdAt", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updatedAt", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("businessId", "actionType", name="approval_policies_business_action_key"),
    )

    op.create_table(
        "pending_actions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("businessId", sa.String(), sa.ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("runId", sa.String(), sa.ForeignKey("agent_runs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("actionType", sa.String(), nullable=False),
        sa.Column("riskLevel", sa.String(), nullable=False),
        sa.Column("payload", sa.String(), nullable=False),
        sa.Column("status", sa.String(), server_default=sa.text("'pending'"), nullable=False),
        sa.Column("approverUserId", sa.String(), nullable=True),
        sa.Column("decisionReason", sa.String(), nullable=True),
        sa.Column("approvedAt", sa.DateTime(), nullable=True),
        sa.Column("rejectedAt", sa.DateTime(), nullable=True),
        sa.Column("createdAt", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updatedAt", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "scheduled_tasks",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("businessId", sa.String(), sa.ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("agent", sa.String(), nullable=False),
        sa.Column("cadence", sa.String(), nullable=False),
        sa.Column("cronExpr", sa.String(), nullable=True),
        sa.Column("enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("lastRunAt", sa.DateTime(), nullable=True),
        sa.Column("nextRunAt", sa.DateTime(), nullable=True),
        sa.Column("createdAt", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updatedAt", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("businessId", "agent", name="scheduled_tasks_business_agent_key"),
    )

    op.create_table(
        "task_executions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("scheduledTaskId", sa.String(), sa.ForeignKey("scheduled_tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(), server_default=sa.text("'queued'"), nullable=False),
        sa.Column("retryCount", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("maxAttempts", sa.Integer(), server_default=sa.text("3"), nullable=False),
        sa.Column("queuedAt", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("nextAttemptAt", sa.DateTime(), nullable=True),
        sa.Column("startedAt", sa.DateTime(), nullable=True),
        sa.Column("completedAt", sa.DateTime(), nullable=True),
        sa.Column("error", sa.String(), nullable=True),
        sa.Column("deadLetteredAt", sa.DateTime(), nullable=True),
        sa.Column("deadLetterReason", sa.String(), nullable=True),
    )

    op.create_table(
        "activity_events",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("businessId", sa.String(), sa.ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("runId", sa.String(), sa.ForeignKey("agent_runs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("agent", sa.String(), nullable=True),
        sa.Column("eventType", sa.String(), nullable=False),
        sa.Column("level", sa.String(), server_default=sa.text("'info'"), nullable=False),
        sa.Column("message", sa.String(), nullable=False),
        sa.Column("payload", sa.String(), nullable=True),
        sa.Column("createdAt", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
    )

    op.create_index("ix_agent_logs_runId_createdAt", "agent_logs", ["runId", "createdAt"])
    op.create_index("ix_agent_runs_businessId_createdAt", "agent_runs", ["businessId", "createdAt"])
    op.create_index("ix_activity_events_businessId_createdAt", "activity_events", ["businessId", "createdAt"])
    op.create_index("ix_pending_actions_businessId_status_createdAt", "pending_actions", ["businessId", "status", "createdAt"])
    op.create_index("ix_scheduled_tasks_businessId_agent", "scheduled_tasks", ["businessId", "agent"])
    op.create_index("ix_task_executions_scheduledTaskId_queuedAt", "task_executions", ["scheduledTaskId", "queuedAt"])
    op.create_index("ix_task_executions_status_nextAttemptAt", "task_executions", ["status", "nextAttemptAt"])
    op.create_foreign_key(
        "agent_runs_taskExecutionId_fkey",
        "agent_runs",
        "task_executions",
        ["taskExecutionId"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_index("ix_task_executions_status_nextAttemptAt", table_name="task_executions")
    op.drop_index("ix_task_executions_scheduledTaskId_queuedAt", table_name="task_executions")
    op.drop_index("ix_scheduled_tasks_businessId_agent", table_name="scheduled_tasks")
    op.drop_index("ix_pending_actions_businessId_status_createdAt", table_name="pending_actions")
    op.drop_index("ix_activity_events_businessId_createdAt", table_name="activity_events")
    op.drop_index("ix_agent_runs_businessId_createdAt", table_name="agent_runs")
    op.drop_index("ix_agent_logs_runId_createdAt", table_name="agent_logs")
    op.drop_constraint("agent_runs_taskExecutionId_fkey", "agent_runs", type_="foreignkey")

    op.drop_table("activity_events")
    op.drop_table("task_executions")
    op.drop_table("scheduled_tasks")
    op.drop_table("pending_actions")
    op.drop_table("approval_policies")
    op.drop_table("marketing_plans")
    op.drop_table("generated_sites")
    op.drop_table("agent_logs")
    op.drop_table("agent_runs")
    op.drop_table("inventory_items")
    op.drop_table("businesses")
    op.drop_table("api_keys")
    op.drop_table("users")
