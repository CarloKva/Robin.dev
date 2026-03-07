import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { TaskAttachment } from "@robin/shared-types";

/**
 * POST /api/tasks/attachments
 *
 * Uploads images to Supabase Storage and patches all specified tasks with
 * attachment metadata. Called after task creation via /api/backlog/import.
 *
 * Body: multipart/form-data
 *   - taskIds: JSON-encoded string[] of task UUIDs
 *   - file_0, file_1, …: image File objects
 */
export async function POST(request: Request) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { workspace } = result;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const taskIdsRaw = formData.get("taskIds");
  if (!taskIdsRaw || typeof taskIdsRaw !== "string") {
    return NextResponse.json({ error: "taskIds is required" }, { status: 400 });
  }

  let taskIds: string[];
  try {
    taskIds = JSON.parse(taskIdsRaw) as string[];
  } catch {
    return NextResponse.json({ error: "taskIds must be a JSON array" }, { status: 400 });
  }

  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return NextResponse.json({ error: "taskIds must be a non-empty array" }, { status: 400 });
  }

  // Collect files from form data (file_0, file_1, …)
  const files: File[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("file_") && value instanceof File && value.size > 0) {
      files.push(value);
    }
  }

  if (files.length === 0) {
    return NextResponse.json({ ok: true, uploaded: 0 });
  }

  const adminSupabase = createSupabaseAdminClient();

  for (const taskId of taskIds) {
    const attachments: TaskAttachment[] = [];
    const now = new Date().toISOString();

    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      // Prefix with index to avoid filename collisions
      const storagePath = `${workspace.id}/${taskId}/${i}_${file.name}`;

      const { error: uploadError } = await adminSupabase.storage
        .from("task-attachments")
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        console.error(
          `[POST /api/tasks/attachments] upload error for task ${taskId}, file ${file.name}:`,
          uploadError.message
        );
        continue;
      }

      attachments.push({
        name: file.name,
        storage_path: storagePath,
        mime_type: file.type,
        size_bytes: file.size,
        uploaded_at: now,
      });
    }

    if (attachments.length > 0) {
      const { error: updateError } = await adminSupabase
        .from("tasks")
        .update({ attachments })
        .eq("id", taskId)
        .eq("workspace_id", workspace.id);

      if (updateError) {
        console.error(
          `[POST /api/tasks/attachments] DB update error for task ${taskId}:`,
          updateError.message
        );
      }
    }
  }

  return NextResponse.json({ ok: true, uploaded: files.length });
}
