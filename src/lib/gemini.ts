import { GoogleGenAI } from "@google/genai";

let cachedClient: GoogleGenAI | null = null;

export function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function getClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!cachedClient) cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

export type ChatTurn = { role: "user" | "model"; text: string };

export async function generateText(
  systemInstruction: string,
  history: ChatTurn[]
): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  const response = await client.models.generateContent({
    model: "gemini-3.6-flash",
    contents: history.map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    })),
    config: { systemInstruction },
  });

  return response.text ?? null;
}

export async function generateJson<T>(
  systemInstruction: string,
  history: ChatTurn[]
): Promise<T | null> {
  const client = getClient();
  if (!client) return null;

  const response = await client.models.generateContent({
    model: "gemini-3.6-flash",
    contents: history.map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    })),
    config: {
      systemInstruction,
      responseMimeType: "application/json",
    },
  });

  const text = response.text;
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
