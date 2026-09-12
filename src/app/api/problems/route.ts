import { NextResponse } from "next/server";
import { problemSummaries } from "@/lib/problems";

export async function GET() {
  return NextResponse.json({ problems: problemSummaries() });
}
