import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getWorkspaceForUser, getWorkspaceMemberRole } from "@/lib/db/workspace";
import { getRepositoriesForWorkspace } from "@/lib/db/github";
import { listInboxFindings } from "@/lib/db/maintenance";
import { InboxClient } from "./InboxClient";

export const metadata = { title: "Maintenance · Inbox — Robin.dev" };

type Params = {
  repository_id?: string;
  type?: string;
  state?: string;
};

export default async function MaintenanceInboxPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) redirect("/onboarding/workspace");

  const [repositories, role, params] = await Promise.all([
    getRepositoriesForWorkspace(workspace.id),
    getWorkspaceMemberRole(userId),
    searchParams,
  ]);

  const enabledRepos = repositories.filter((r) => r.is_enabled && r.is_available);

  const VALID_STATES = new Set([
    "pending",
    "approved",
    "rejected",
    "snoozed",
    "implemented",
  ]);
  const type =
    params.type === "spec" || params.type === "bug"
      ? (params.type as "spec" | "bug")
      : undefined;
  const state =
    params.state && VALID_STATES.has(params.state) ? params.state : "pending";

  const findings = await listInboxFindings(workspace.id, {
    ...(params.repository_id ? { repositoryId: params.repository_id } : {}),
    ...(type ? { type } : {}),
    triageState: state,
    limit: 100,
  });

  return (
    <InboxClient
      isOwner={role === "owner"}
      repositories={enabledRepos.map((r) => ({ id: r.id, full_name: r.full_name }))}
      selectedRepositoryId={params.repository_id ?? null}
      selectedType={type ?? null}
      selectedState={state}
      findings={findings}
    />
  );
}
