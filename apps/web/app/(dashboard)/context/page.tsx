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
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contesto</h1>
          <p className="text-sm text-muted-foreground">
            Documenti usati dall&apos;AI per generare task più accurate.
          </p>
        </div>
      </div>

      <ContextPageClient
        initialDocs={docs}
        repositories={repositories.filter((r) => r.is_enabled)}
      />
    </div>
  );
}
