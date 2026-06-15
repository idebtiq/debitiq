"use client";

export function AdminLogout() {
  return (
    <form action="/api/admin/logout" method="post">
      <button className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-ink dark:border-white/10 dark:bg-white/5 dark:text-white">
        Logout
      </button>
    </form>
  );
}
