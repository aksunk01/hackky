import {
  type ChatRequest,
  type LlmProvider,
  type LlmResponse,
  type LlmToolCall,
  fetchJson,
} from "./provider";

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

interface AnthropicBlock {
  type: "text" | "tool_use" | string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface AnthropicResponse {
  content?: AnthropicBlock[];
}

export function createAnthropicProvider(apiKey: string, model: string): LlmProvider {
  return {
    id: "anthropic",
    model,

    async chat(request: ChatRequest): Promise<LlmResponse> {
      const messages: { role: "user" | "assistant"; content: unknown }[] = [];

      for (const message of request.messages) {
        if (message.role === "user") {
          messages.push({ role: "user", content: message.content });
        } else if (message.role === "assistant") {
          const blocks: unknown[] = [];
          if (message.content) blocks.push({ type: "text", text: message.content });
          for (const call of message.toolCalls ?? []) {
            blocks.push({
              type: "tool_use",
              id: call.id,
              name: call.name,
              input: call.args,
            });
          }
          if (blocks.length) messages.push({ role: "assistant", content: blocks });
        } else {
          messages.push({
            role: "user",
            content: message.results.map((r) => ({
              type: "tool_result",
              tool_use_id: r.id,
              content: JSON.stringify(r.result),
            })),
          });
        }
      }

      const body: Record<string, unknown> = {
        model,
        max_tokens: request.maxTokens ?? 1024,
        temperature: request.temperature ?? 0.7,
        system: request.system,
        messages,
      };

      if (request.tools?.length) {
        body.tools = request.tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.parameters,
        }));
      }

      const raw = (await fetchJson(ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": API_VERSION,
        },
        body: JSON.stringify(body),
      })) as AnthropicResponse;

      let text = "";
      const toolCalls: LlmToolCall[] = [];

      for (const block of raw.content ?? []) {
        if (block.type === "text" && block.text) text += block.text;
        if (block.type === "tool_use" && block.name) {
          toolCalls.push({
            id: block.id ?? block.name,
            name: block.name,
            args: block.input ?? {},
          });
        }
      }

      return { text: text.trim(), toolCalls };
    },
  };
}
