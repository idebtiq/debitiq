import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminCookieName, verifyAdminSessionValue } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function AdminLogin({ unauthorized }: { unauthorized: boolean }) {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-ink dark:bg-ink dark:text-white">
      <div className="mx-auto max-w-md rounded-lg border border-white/70 bg-white p-5 shadow-premium dark:border-white/10 dark:bg-white/5">
        <p className="text-xs font-black uppercase text-mint">Admin Login</p>
        <h1 className="mt-2 text-2xl font-black">DebtIQ Admin</h1>
        {unauthorized && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700 dark:bg-red-400/10 dark:text-red-200">403 Unauthorized</p>}
        <form className="mt-5 grid gap-3" action="/api/admin/login" method="post">
          <label className="grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Username
            <input name="username" className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-ink outline-none focus:border-mint dark:border-white/10 dark:bg-white/5 dark:text-white" />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Password
            <input name="password" type="password" className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-ink outline-none focus:border-mint dark:border-white/10 dark:bg-white/5 dark:text-white" />
          </label>
          <button className="h-11 rounded-lg bg-ink text-sm font-bold text-white dark:bg-mint dark:text-ink">Login</button>
        </form>
      </div>
    </main>
  );
}

export default async function AdminPage({ searchParams }: { searchParams?: Promise<{ unauthorized?: string }> }) {
  const cookieStore = await cookies();
  const session = cookieStore.get(adminCookieName)?.value;
  const isAdmin = verifyAdminSessionValue(session);
  const params = searchParams ? await searchParams : {};

  if (!isAdmin) {
    return <AdminLogin unauthorized={params.unauthorized === "1"} />;
  }

  redirect("/admin/dashboard");
}
