import { NextResponse } from "next/server";
import { getProblem } from "@/lib/problems-store";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/problems/[id]">
) {
  const { id } = await ctx.params;
  const problem = await getProblem(id);
  if (!problem) {
    return NextResponse.json({ error: "Unknown problem." }, { status: 404 });
  }
  return NextResponse.json(problem);
}
