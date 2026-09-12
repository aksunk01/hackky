import { NextResponse } from "next/server";
import { getProblem } from "@/lib/problems";
import { generateText, type ChatTurn } from "@/lib/gemini";

const MOCK_REPLIES = [
  "Sounds good — before you dive into code, can you walk me through your approach and its time complexity?",
  "Okay, I like that direction. Go ahead and start coding it up — talk me through any tricky parts as you go.",
  "Good progress. What happens with your current approach on an edge case, like an empty input or duplicate values?",
  "Nice, that handles it. Once you think you're done, hit Run to check it against the test cases.",
  "Makes sense. Is there anything you'd change about the time or space complexity if the input were much larger?",
];

function buildSystemInstruction(problem: ReturnType<typeof getProblem>, code: string) {
  return `You are Alex, a friendly but rigorous AI technical interviewer conducting a live coding interview.

Problem: ${problem?.title} (${problem?.difficulty})
${problem?.description}

The candidate's current code:
\`\`\`python
${code || "(no code written yet)"}
\`\`\`

Guidelines:
- Keep replies short and conversational (2-4 sentences), like a real spoken interview.
- Ask the candidate to explain their approach before or while they code.
- Probe on edge cases, time/space complexity, and reasoning.
- Give a gentle nudge if they seem stuck, but don't just hand them the answer.
- Do not repeat the full problem statement back to them.`;
}

export async function POST(request: Request) {
  const body = await request.json();
  const { problemId, history, code } = body as {
    problemId?: string;
    history?: ChatTurn[];
    code?: string;
  };

  if (!problemId) {
    return NextResponse.json({ error: "problemId is required." }, { status: 400 });
  }

  const problem = getProblem(problemId);
  if (!problem) {
    return NextResponse.json({ error: "Unknown problem." }, { status: 404 });
  }

  const turns = history ?? [];

  try {
    const reply = await generateText(
      buildSystemInstruction(problem, code ?? ""),
      turns.length > 0
        ? turns
        : [{ role: "user", text: "The interview is starting. Greet the candidate and introduce the problem briefly." }]
    );
    if (reply) {
      return NextResponse.json({ reply, mocked: false });
    }
  } catch (err) {
    console.error("Gemini interview call failed, falling back to mock:", err);
  }

  const turnCount = turns.filter((t) => t.role === "user").length;
  const mockIndex = Math.min(turnCount, MOCK_REPLIES.length - 1);
  const reply =
    turnCount === 0
      ? `Hi, I'm Alex, your interviewer today. Let's look at "${problem.title}". Take a look at the problem and tell me how you'd approach it.`
      : MOCK_REPLIES[mockIndex];

  return NextResponse.json({ reply, mocked: true });
}
