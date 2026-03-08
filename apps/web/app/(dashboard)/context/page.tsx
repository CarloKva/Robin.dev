import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { getContextDocuments } from "@/lib/db/context";
import { getRepositoriesForWorkspace } from "@/lib/db/github";
import { ContextPageClient } from "./ContextPageClient";

export default async function ContextPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) redirect("/onboarding/workspace");

  const [docs, repositories] = await Promise.all([
    getContextDocuments(workspace.id),
    getRepositoriesForWorkspace(workspace.id),
  ]);

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <ContextPageClient
        initialDocs={docs}
        repositories={repositories.filter((r) => r.is_enabled)}
      />
    </div>
  );
}
