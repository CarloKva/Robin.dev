import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTaskTimeline, projectTaskState } from "@/lib/db/events";
import type { Task } from "@robin/shared-types";
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

  // Load event history server-side for SSR
  const initialEvents = await getTaskTimeline(taskId);
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
    />
  );
}
