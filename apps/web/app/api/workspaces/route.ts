import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const CreateWorkspaceSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens"),
});

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateWorkspaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { name, slug } = parsed.data;

  try {
    const workspace = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const ws = await tx.workspaces.create({
        data: { name, slug },
      });

      await tx.workspace_members.create({
        data: {
          workspace_id: ws.id,
          user_id: userId,
          role: "owner",
        },
      });

      return ws;
    });

    return NextResponse.json(workspace, { status: 201 });
  } catch (error: unknown) {
    // Prisma unique constraint violation (slug already taken)
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "This slug is already taken. Please choose a different one." },
        { status: 409 }
      );
    }

    console.error("[POST /api/workspaces]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
