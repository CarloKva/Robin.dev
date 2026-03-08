/**
 * DB queries for context_documents table.
 * All queries use the user-scoped Supabase client — RLS enforced.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ContextDocument } from "@robin/shared-types";

export async function getContextDocuments(workspaceId: string): Promise<ContextDocument[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("context_documents")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("[getContextDocuments]", error.message);
    return [];
  }
  return (data ?? []) as ContextDocument[];
}

export async function getContextDocumentsByIds(
  workspaceId: string,
  ids: string[]
): Promise<ContextDocument[]> {
  if (ids.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("context_documents")
    .select("*")
    .eq("workspace_id", workspaceId)
    .in("id", ids);
  if (error) {
    console.error("[getContextDocumentsByIds]", error.message);
    return [];
  }
  return (data ?? []) as ContextDocument[];
}

export async function createContextDocument(
  workspaceId: string,
  data: { title: string; content: string }
): Promise<ContextDocument> {
  const supabase = await createSupabaseServerClient();
  const { data: row, error } = await supabase
    .from("context_documents")
    .insert({ workspace_id: workspaceId, title: data.title, content: data.content })
    .select()
    .single();
  if (error || !row) throw new Error(`Failed to create context document: ${error?.message}`);
  return row as ContextDocument;
}

export async function updateContextDocument(
  workspaceId: string,
  docId: string,
  data: { title?: string | undefined; content?: string | undefined }
): Promise<ContextDocument> {
  const supabase = await createSupabaseServerClient();
  const { data: row, error } = await supabase
    .from("context_documents")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", docId)
    .eq("workspace_id", workspaceId)
    .select()
    .single();
  if (error || !row) throw new Error(`Failed to update context document: ${error?.message}`);
  return row as ContextDocument;
}

export async function deleteContextDocument(workspaceId: string, docId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("context_documents")
    .delete()
    .eq("id", docId)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(`Failed to delete context document: ${error.message}`);
}

export async function deleteContextDocuments(workspaceId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("context_documents")
    .delete()
    .eq("workspace_id", workspaceId)
    .in("id", ids);
  if (error) throw new Error(`Failed to delete context documents: ${error.message}`);
}

export async function upsertContextDocumentFromGitHub(
  workspaceId: string,
  doc: {
    title: string;
    content: string;
    source_repo_full_name: string;
    source_path: string;
    source_sha: string;
  }
): Promise<ContextDocument> {
  const supabase = await createSupabaseServerClient();

  // Try to find an existing doc for this repo+path
  const { data: existing } = await supabase
    .from("context_documents")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("source_repo_full_name", doc.source_repo_full_name)
    .eq("source_path", doc.source_path)
    .maybeSingle();

  const now = new Date().toISOString();

  if (existing) {
    const { data: row, error } = await supabase
      .from("context_documents")
      .update({
        title: doc.title,
        content: doc.content,
        source_sha: doc.source_sha,
        last_synced_at: now,
        updated_at: now,
      })
      .eq("id", (existing as { id: string }).id)
      .select()
      .single();
    if (error || !row) throw new Error(`Failed to upsert context document: ${error?.message}`);
    return row as ContextDocument;
  }

  const { data: row, error } = await supabase
    .from("context_documents")
    .insert({
      workspace_id: workspaceId,
      title: doc.title,
      content: doc.content,
      source_repo_full_name: doc.source_repo_full_name,
      source_path: doc.source_path,
      source_sha: doc.source_sha,
      last_synced_at: now,
    })
    .select()
    .single();
  if (error || !row) throw new Error(`Failed to insert context document: ${error?.message}`);
  return row as ContextDocument;
}
