import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { generateMonthlyReport } from "@/lib/db/metrics";

export async function GET(request: Request) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { workspace } = result;

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: "Invalid month. Use format YYYY-MM." },
      { status: 400 }
    );
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
