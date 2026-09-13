import { redirect } from "next/navigation";
import { SiteHeader, UnavailableNotice } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { getUserSettings } from "@/lib/users";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const selfUrl = next ? `/settings?next=${encodeURIComponent(next)}` : "/settings";

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(selfUrl)}`);

  let settings;
  try {
    settings = await getUserSettings(user.uid);
  } catch {
    return (
      <>
        <SiteHeader />
        <UnavailableNotice
          title="Settings"
          message="Settings are unavailable. Check the Firestore connection and refresh this page."
        />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-14 sm:py-16">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted">Manage your profile, AI keys, and privacy.</p>
        </div>
        <SettingsForm email={user.email} initial={settings} next={next ?? null} />
      </main>
    </>
  );
}
