/**
 * POST /api/maintenance/findings/[type]/[id]/triage
 *
 * Workspace-owner-only triage action on a spec_findings or bug_findings row.
 * Accepted actions: approve | reject | snooze | mark_implemented.
 *
 * Phase 2 step A: this route only updates triage_state and emits
 * finding.triaged. Task creation + spec_impl/bug_impl enqueue on approve
 * lands when Phase 3 ships the implementation runners.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { getWorkspaceMemberRole } from "@/lib/db/workspace";
import {
  createQueuedAgentRun,
  insertMaintenanceEvent,
  prepareFindingForImplementation,
  selectRunnerAgentForRepository,
  triageFinding,
  type FindingType,
} from "@/lib/db/maintenance";
import { getMaintenanceQueue } from "@/lib/queue/maintenance.queue";
import type { MaintenanceJobPayload } from "@robin/shared-types";

const triageBodySchema = z
  .object({
    action: z.enum(["approve", "reject", "snooze", "mark_implemented"]),
    note: z.string().max(2000).nullable().optional(),
    snoozed_until: z
      .string()
      .datetime({ message: "snoozed_until must be ISO-8601" })
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action === "snooze" && !value.snoozed_until) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["snoozed_until"],
        message: "snoozed_until is required when action is snooze",
      });
    }
    if (
      value.action === "snooze" &&
      value.snoozed_until &&
      new Date(value.snoozed_until).getTime() <= Date.now()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["snoozed_until"],
        message: "snoozed_until must be in the future",
      });
    }
  });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { userId, workspace } = result;

  const role = await getWorkspaceMemberRole(userId);
  if (role !== "owner") {
    return NextResponse.json(
      { error: "Solo il proprietario del workspace può triage le findings." },
      { status: 403 }
    );
  }

  const { type, id } = await params;
  if (type !== "spec" && type !== "bug") {
    return NextResponse.json(
      { error: "type must be 'spec' or 'bug'" },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = triageBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const finding = await triageFinding({
      workspaceId: workspace.id,
      type: type as FindingType,
      findingId: id,
      patch: {
        action: parsed.data.action,
        ...(parsed.data.note !== undefined && { note: parsed.data.note }),
        ...(parsed.data.snoozed_until !== undefined && {
          snoozedUntil: parsed.data.snoozed_until,
        }),
      },
      triagedBy: userId,
    });

    if (!finding) {
      return NextResponse.json({ error: "Finding non trovata" }, { status: 404 });
    }

    // Approval of either a spec or bug finding enqueues the matching impl
    // capability (spec_impl / bug_impl). No-op if no impl capability is
    // configured or no runner is online — the finding still flips to approved.
    let impl: {
      enqueued: boolean;
      reason?: string;
      agent_run_id?: string;
      task_id?: string;
    } | null = null;
    if (parsed.data.action === "approve") {
      impl = await enqueueImpl({
        type: type as FindingType,
        findingId: id,
        workspaceId: workspace.id,
        userId,
      });
    }

    return NextResponse.json({ finding, impl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[triage route]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function enqueueImpl(args: {
  type: FindingType;
  findingId: string;
  workspaceId: string;
  userId: string;
}): Promise<{
  enqueued: boolean;
  reason?: string;
  agent_run_id?: string;
  task_id?: string;
}> {
  const prepared = await prepareFindingForImplementation({
    workspaceId: args.workspaceId,
    type: args.type,
    findingId: args.findingId,
  });
  if (!prepared) {
    return { enqueued: false, reason: "no_impl_capability_configured" };
  }

  const runner = await selectRunnerAgentForRepository(
    args.workspaceId,
    prepared.repository_id
  );
  if (!runner) {
    return { enqueued: false, reason: "no_online_runner", task_id: prepared.task_id };
  }

  let agentRunId: string;
  try {
    agentRunId = await createQueuedAgentRun({
      workspaceId: args.workspaceId,
      repositoryId: prepared.repository_id,
      workspaceCapabilityConfigId: prepared.workspace_capability_config_id,
      capabilityDefinitionId: prepared.capability_definition_id,
      runnerAgentId: runner.agentId,
      trigger: "manual",
      triggeredBy: args.userId,
    });
  } catch (err) {
    console.error("[triage enqueueImpl agent_runs]", err);
    return { enqueued: false, reason: "agent_run_insert_failed", task_id: prepared.task_id };
  }

  const payload: MaintenanceJobPayload = {
    agentRunId,
    workspaceId: args.workspaceId,
    repositoryId: prepared.repository_id,
    runnerAgentId: runner.agentId,
    capabilityDefinitionId: prepared.capability_definition_id,
    workspaceCapabilityConfigId: prepared.workspace_capability_config_id,
    trigger: "manual",
    findingId: prepared.finding_id,
  };

  try {
    const queue = getMaintenanceQueue();
    await queue.add("maintenance-agents", payload, { jobId: agentRunId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[triage enqueueImpl queue]", message);
    await insertMaintenanceEvent({
      workspaceId: args.workspaceId,
      repositoryId: prepared.repository_id,
      agentRunId,
      eventType: "agent.run.failed",
      actorType: "system",
      actorId: "web/triage",
      payload: { reason: "enqueue_failed", error: message },
    });
    return { enqueued: false, reason: "queue_add_failed", task_id: prepared.task_id };
  }

  await insertMaintenanceEvent({
    workspaceId: args.workspaceId,
    repositoryId: prepared.repository_id,
    agentRunId,
    eventType: "agent.run.scheduled",
    actorType: "human",
    actorId: args.userId,
    payload: {
      trigger: "manual",
      reason: "approve_finding",
      finding_id: prepared.finding_id,
      task_id: prepared.task_id,
      runner_agent_id: runner.agentId,
      capability_definition_id: prepared.capability_definition_id,
    },
  });

  return { enqueued: true, agent_run_id: agentRunId, task_id: prepared.task_id };
}
