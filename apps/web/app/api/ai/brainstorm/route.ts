import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { getContextDocumentsByIds } from "@/lib/db/context";
import { BRAINSTORM_SYSTEM_PROMPT, buildContextBlock } from "@/lib/ai/brainstorm";

const anthropic = new Anthropic({
  apiKey: process.env["ANTHROPIC_API_KEY"],
});

type TextBlock = { type: "text"; text: string };
type ImageBlock = {
  type: "image";
  source: { type: "base64"; media_type: string; data: string };
};
type ContentBlock = TextBlock | ImageBlock;

type IncomingMessage = {
  role: "user" | "assistant";
  content: string;
  images?: string[]; // base64 data URLs: "data:image/png;base64,..."
};

type AnthropicMessage = {
  role: "user" | "assistant";
  content: string | ContentBlock[];
};

function buildAnthropicContent(
  msg: IncomingMessage,
  prependText?: string
): string | ContentBlock[] {
  const text = prependText
    ? `${prependText}\n\n---\n\n${msg.content}`
    : msg.content;

  if (!msg.images?.length) {
    return text;
  }

  const blocks: ContentBlock[] = msg.images.flatMap((dataUrl): ImageBlock[] => {
    const commaIdx = dataUrl.indexOf(",");
    if (commaIdx === -1) return [];
    const header = dataUrl.slice(0, commaIdx);
    const data = dataUrl.slice(commaIdx + 1);
    const mediaType = header.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
    return [{ type: "image", source: { type: "base64", media_type: mediaType, data } }];
  });

  blocks.push({ type: "text", text });
  return blocks;
}

export async function POST(request: Request) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { workspace } = result;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { messages, contextDocIds } = body as {
    messages: IncomingMessage[];
    contextDocIds: string[];
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  // Load context docs and inject as first user message if any selected
  const contextDocs = await getContextDocumentsByIds(workspace.id, contextDocIds ?? []);
  const contextBlock = buildContextBlock(contextDocs);

  // Build Anthropic messages, prepending context block to the first user message if present
  const anthropicMessages: AnthropicMessage[] = messages.map((msg, i) => {
    const isFirstUser = i === 0 && msg.role === "user";
    const prependText = isFirstUser && contextBlock ? contextBlock : undefined;
    return { role: msg.role, content: buildAnthropicContent(msg, prependText) };
  });

  // Set up SSE streaming response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          system: BRAINSTORM_SYSTEM_PROMPT,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          messages: anthropicMessages as any,
        });

        for await (const event of anthropicStream) {
          if (event.type === "message_start") {
            const meta = JSON.stringify({
              model: event.message.model,
              inputTokens: event.message.usage.input_tokens,
            });
            controller.enqueue(encoder.encode(`data: ${meta}\n\n`));
          } else if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const chunk = JSON.stringify({ text: event.delta.text });
            controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
          } else if (event.type === "message_delta") {
            const usage = JSON.stringify({ outputTokens: event.usage.output_tokens });
            controller.enqueue(encoder.encode(`data: ${usage}\n\n`));
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
