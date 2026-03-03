import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { getContextDocumentsByIds } from "@/lib/db/context";
import { BRAINSTORM_SYSTEM_PROMPT, buildContextBlock } from "@/lib/ai/brainstorm";

const anthropic = new Anthropic({
  apiKey: process.env["ANTHROPIC_API_KEY"],
});

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { messages, contextDocIds } = body as {
    messages: { role: "user" | "assistant"; content: string }[];
    contextDocIds: string[];
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  // Load context docs and inject as first user message if any selected
  const contextDocs = await getContextDocumentsByIds(workspace.id, contextDocIds ?? []);
  const contextBlock = buildContextBlock(contextDocs);

  // Prepend context block to the first user message if we have context
  const anthropicMessages: { role: "user" | "assistant"; content: string }[] = [...messages];
  if (contextBlock && anthropicMessages[0]?.role === "user") {
    anthropicMessages[0] = {
      role: "user",
      content: `${contextBlock}\n\n---\n\n${anthropicMessages[0].content}`,
    };
  }

  // Set up SSE streaming response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          system: BRAINSTORM_SYSTEM_PROMPT,
          messages: anthropicMessages,
        });

        for await (const event of anthropicStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const chunk = JSON.stringify({ text: event.delta.text });
            controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Stream error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
