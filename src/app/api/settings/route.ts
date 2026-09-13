import { NextResponse } from "next/server";
import { checkOrigin, requireCurrentUser } from "@/lib/api-guards";
import {
  API_KEY_PROVIDERS,
  getUserSettings,
  updateUserSettings,
  type ApiKeyProvider,
} from "@/lib/users";
import { describeDatabaseError } from "@/lib/firestore";

export async function GET() {
  const user = await requireCurrentUser();
  if (user instanceof NextResponse) return user;

  try {
    const settings = await getUserSettings(user.uid);
    return NextResponse.json(settings, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: describeDatabaseError(err) }, { status: 500 });
  }
}

type PatchBody = {
  displayName?: string | null;
  shareScoresPublicly?: boolean;
  apiKeys?: Partial<Record<ApiKeyProvider, string | null>>;
};

export async function PATCH(request: Request) {
  const originError = checkOrigin(request);
  if (originError) return originError;

  const user = await requireCurrentUser();
  if (user instanceof NextResponse) return user;

  const body = (await request.json()) as PatchBody;

  if (body.displayName !== undefined && typeof body.displayName !== "string" && body.displayName !== null) {
    return NextResponse.json({ error: "displayName must be a string or null." }, { status: 400 });
  }
  if (body.shareScoresPublicly !== undefined && typeof body.shareScoresPublicly !== "boolean") {
    return NextResponse.json({ error: "shareScoresPublicly must be a boolean." }, { status: 400 });
  }
  if (body.apiKeys) {
    for (const [provider, value] of Object.entries(body.apiKeys)) {
      if (!API_KEY_PROVIDERS.includes(provider as ApiKeyProvider)) {
        return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
      }
      if (value !== null && typeof value !== "string") {
        return NextResponse.json({ error: `Invalid value for ${provider}.` }, { status: 400 });
      }
    }
  }

  try {
    await updateUserSettings(user.uid, {
      displayName: body.displayName,
      shareScoresPublicly: body.shareScoresPublicly,
      apiKeys: body.apiKeys,
    });
    const settings = await getUserSettings(user.uid);
    return NextResponse.json(settings);
  } catch (err) {
    return NextResponse.json({ error: describeDatabaseError(err) }, { status: 500 });
  }
}
