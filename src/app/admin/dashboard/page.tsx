import { cookies } from "next/headers";
import { AdminDashboardClient } from "./AdminDashboardClient";
import { adminCookieName, verifyAdminSessionValue } from "@/lib/admin-auth";
import { seedAdminLeads, seedAdminUsers, seedOffers } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

function Unauthorized() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4 text-ink dark:bg-ink dark:text-white">
      <div className="w-full max-w-md rounded-lg border border-red-200 bg-white p-5 shadow-premium dark:border-red-400/20 dark:bg-white/5">
        <p className="text-xs font-black uppercase text-red-600 dark:text-red-300">403 Unauthorized</p>
        <h1 className="mt-2 text-2xl font-black">Admin access required</h1>
        <a className="mt-5 inline-flex h-11 items-center rounded-lg bg-ink px-4 text-sm font-bold text-white dark:bg-mint dark:text-ink" href="/admin">
          Go to Admin Login
        </a>
      </div>
    </main>
  );
}

export default async function AdminDashboardPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(adminCookieName)?.value;
  const isAdmin = verifyAdminSessionValue(session);
  const isSupabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!isAdmin) return <Unauthorized />;

  return (
    <AdminDashboardClient
      initialUsers={seedAdminUsers}
      initialOffers={seedOffers}
      initialLeads={seedAdminLeads}
      isDemoData={!isSupabaseConfigured}
    />
  );
}
