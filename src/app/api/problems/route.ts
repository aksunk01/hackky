import { NextResponse } from "next/server";
import { getAllProblems } from "@/lib/problems-store";

export async function GET() {
  const problems = await getAllProblems();
  return NextResponse.json(problems);
}
