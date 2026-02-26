import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getWorkspaceForUser } from "@/lib/db/workspace";

export default async function SettingsPage() {
  const { userId } = await auth();

  if (!userId) redirect("/sign-in");

  const workspace = await getWorkspaceForUser(userId);

  if (!workspace) redirect("/onboarding/workspace");

  const createdAt = new Date(workspace.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="max-w-xl space-y-8">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="space-y-4 rounded-lg border border-border p-6">
        <h2 className="text-base font-semibold">Workspace</h2>

        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Name</dt>
            <dd className="font-medium">{workspace.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Slug</dt>
            <dd className="font-mono">{workspace.slug}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Created</dt>
            <dd>{createdAt}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Workspace ID</dt>
            <dd className="font-mono text-xs">{workspace.id}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
