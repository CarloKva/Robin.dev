import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTaskTimeline, projectTaskState } from "@/lib/db/events";
import { getTaskIterations } from "@/lib/db/iterations";
import type { Agent, Sprint, Task } from "@robin/shared-types";
import { TaskDetailClient } from "./TaskDetailClient";

interface TaskDetailPageProps {
  params: Promise<{ taskId: string }>;
}

export default async function TaskDetailPage({ params }: TaskDetailPageProps) {
  const { taskId } = await params;

  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = await createSupabaseServerClient();

  const { data: task, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .single();

  if (error || !task) {
    notFound();
  }

  const typedTask = task as Task;

  // Load event history, iteration history, agent data, and sprint data server-side for SSR
  const [initialEvents, initialIterations, agentResult, sprintResult] = await Promise.all([
    getTaskTimeline(taskId),
    getTaskIterations(taskId),
    typedTask.assigned_agent_id
      ? supabase
          .from("agents")
          .select("*")
          .eq("id", typedTask.assigned_agent_id)
          .single()
      : Promise.resolve({ data: null }),
    typedTask.sprint_id
      ? supabase
          .from("sprints")
          .select("id, name, status")
          .eq("id", typedTask.sprint_id)
          .single()
      : Promise.resolve({ data: null }),
  ]);

  const agent = (agentResult.data as Agent | null) ?? null;
  const sprint = (sprintResult.data as Pick<Sprint, "id" | "name" | "status"> | null) ?? null;

  const projectedState = projectTaskState(
    initialEvents.map((e) => ({
      id: e.id,
      task_id: taskId,
      workspace_id: typedTask.workspace_id,
      event_type: e.event_type,
      actor_type: e.actor_type,
      actor_id: e.actor_id,
      payload: e.payload,
      created_at: e.created_at,
    }))
  );

  return (
    <TaskDetailClient
      task={typedTask}
      initialEvents={initialEvents}
      initialProjectedState={projectedState}
      initialIterations={initialIterations}
      agent={agent}
      sprint={sprint}
    />
  );
}
