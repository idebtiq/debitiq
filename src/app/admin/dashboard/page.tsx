import { cookies } from "next/headers";
import { AdminDashboardClient } from "./AdminDashboardClient";
import { adminCookieName, verifyAdminSessionValue } from "@/lib/admin-auth";
import { seedAdminLeads, seedAdminUsers, seedOffers } from "@/lib/demo-data";
import { supabase } from "@/lib/supabase";
import type { AdminUser, MaritalStatus } from "@/lib/types";

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

  let initialUsers = seedAdminUsers;
  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, mobile, email, country, city, employer, marital_status, created_at")
      .order("created_at", { ascending: false });

    if (data) {
      initialUsers = data.map((profile): AdminUser => ({
        id: String(profile.id),
        fullName: String(profile.full_name || "Supabase User"),
        email: String(profile.email || ""),
        mobile: String(profile.mobile || ""),
        country: profile.country || "",
        city: String(profile.city || ""),
        employer: String(profile.employer || ""),
        employmentSector: "",
        maritalStatus: (profile.marital_status || "") as MaritalStatus | "",
        createdAt: String(profile.created_at || new Date().toISOString()),
        lastLogin: String(profile.created_at || new Date().toISOString()),
        userType: "Real",
        status: "Active",
        profileCompletion: 25,
        incomeSourceCount: 0,
        obligationCount: 0,
        creditCardCount: 0,
        goalCount: 0,
        leadCount: 0,
      }));
    }
  }

  return (
    <AdminDashboardClient
      initialUsers={initialUsers}
      initialOffers={seedOffers}
      initialLeads={seedAdminLeads}
      isDemoData={!isSupabaseConfigured}
    />
  );
}
