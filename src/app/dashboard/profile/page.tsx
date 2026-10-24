import { DeletionRequest, ProfileForm } from "@/components/dashboard/profile-forms";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser("/dashboard/profile");
  const profile = await db.userProfile.findUnique({ where: { userId: user.id } });
  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <section className="rounded-xl border bg-card p-6">
        <h2 className="mb-4 font-semibold">Personal details</h2>
        <ProfileForm name={user.name} email={user.email} countryCode={profile?.countryCode ?? null} />
      </section>
      <section className="rounded-xl border border-destructive/30 bg-card p-6">
        <h2 className="mb-2 font-semibold">Delete account</h2>
        <DeletionRequest requestedAt={profile?.deletionRequestedAt?.toISOString() ?? null} />
      </section>
    </div>
  );
}
