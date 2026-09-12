import {
  type ChatRequest,
  type LlmProvider,
  type LlmResponse,
  type LlmToolCall,
  LlmError,
  fetchJson,
} from "./provider";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
}

export function createGeminiProvider(apiKey: string, model: string): LlmProvider {
  return {
    id: "gemini",
    model,

    async chat(request: ChatRequest): Promise<LlmResponse> {
      const contents: { role: "user" | "model"; parts: GeminiPart[] }[] = [];

      for (const message of request.messages) {
        if (message.role === "user") {
          contents.push({ role: "user", parts: [{ text: message.content }] });
        } else if (message.role === "assistant") {
          const parts: GeminiPart[] = [];
          if (message.content) parts.push({ text: message.content });
          for (const call of message.toolCalls ?? []) {
            parts.push({ functionCall: { name: call.name, args: call.args } });
          }
          if (parts.length) contents.push({ role: "model", parts });
        } else {
          // v1beta Content.role is only "user" or "model"; functionResponse
          // parts ride along in a user turn.
          contents.push({
            role: "user",
            parts: message.results.map((r) => ({
              functionResponse: {
                name: r.name,
                response: { result: r.result },
              },
            })),
          });
        }
      }

      const body: Record<string, unknown> = {
        systemInstruction: { parts: [{ text: request.system }] },
        contents,
        generationConfig: {
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.maxTokens ?? 1024,
          ...(request.json ? { responseMimeType: "application/json" } : {}),
        },
      };

      if (request.tools?.length) {
        body.tools = [
          {
            functionDeclarations: request.tools.map((t) => ({
              name: t.name,
              description: t.description,
              parameters: t.parameters,
            })),
          },
        ];
      }

      const raw = (await fetchJson(
        `${ENDPOINT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      )) as GeminiResponse;

      if (raw.promptFeedback?.blockReason) {
        throw new LlmError(`Gemini blocked the prompt: ${raw.promptFeedback.blockReason}`);
      }

      const parts = raw.candidates?.[0]?.content?.parts ?? [];
      let text = "";
      const toolCalls: LlmToolCall[] = [];

      parts.forEach((part, i) => {
        if (part.text) text += part.text;
        if (part.functionCall) {
          toolCalls.push({
            id: `${part.functionCall.name}-${i}`,
            name: part.functionCall.name,
            args: part.functionCall.args ?? {},
          });
        }
      });

      return { text: text.trim(), toolCalls };
    },
  };
}
