import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { generateMonthlyReport } from "@/lib/db/metrics";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: "Invalid month. Use format YYYY-MM." },
      { status: 400 }
    );
  }

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  try {
    const markdown = await generateMonthlyReport(workspace.id, month);

    return new Response(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="robindev-report-${month}.md"`,
      },
    });
  } catch (err) {
    console.error("[GET /api/reports/monthly] error:", err);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
