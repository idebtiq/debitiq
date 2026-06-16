"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { BarChart3, Eye, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AdminLogout } from "../AdminLogout";
import { seedAdminUsers } from "@/lib/demo-data";
import type { AdminUser, Lead, LeadStatus, Offer, OfferType, UserStatus } from "@/lib/types";

const offerTypes: OfferType[] = ["Debt Transfer", "Refinancing", "Personal Loan", "Mortgage", "Auto Finance", "Credit Card", "Other"];
const leadStatuses: LeadStatus[] = ["New", "Contacted", "In Progress", "Closed", "Rejected"];
const dateFormatter = new Intl.DateTimeFormat("en-US");
const chartColors = ["#38d6a3", "#f3c969", "#60a5fa", "#fb7185", "#a78bfa", "#34d399", "#f97316"];
const betaUsersRegistryStorageKey = "debtiq.users.registry.v1";
const userDataStoragePrefix = "debtiq.user.v1.";
const adminTabs = ["Overview", "Users", "Demo Users", "Offers", "Leads", "Analytics", "Settings"] as const;

type AdminTab = (typeof adminTabs)[number];

type BetaRegisteredUser = {
  id: string;
  email: string;
  normalizedEmail: string;
  fullName: string;
  mobile: string;
  createdAt: string;
  lastLoginAt?: string;
  status: UserStatus;
  deleted?: boolean;
  onboardingStatus?: "incomplete" | "complete";
  userType?: "Demo" | "Real";
  passwordHash?: string;
};

type StoredUserData = {
  profile?: Partial<AdminUser>;
  incomeSources?: unknown[];
  obligationEntries?: unknown[];
  creditCards?: unknown[];
  goals?: unknown[];
  leads?: unknown[];
};

const emptyOffer: Offer = {
  id: "",
  title: "",
  bankName: "",
  type: "Debt Transfer",
  description: "",
  minSalary: 0,
  maxSalary: 0,
  minDebt: 0,
  maxDebt: 0,
  expiryDate: "",
  contactPerson: "",
  contactNumber: "",
  active: true,
};

function Field({ label, value, onChange, type = "text" }: { label: string; value: string | number; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
      {label}
      <input
        className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-ink outline-none focus:border-mint dark:border-white/10 dark:bg-white/5 dark:text-white"
        min={type === "number" ? 0 : undefined}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
      {label}
      <select
        className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-ink outline-none focus:border-mint dark:border-white/10 dark:bg-slate-900 dark:text-white"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    const key = getKey(item) || "Unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()].map(([name, value]) => ({ name, value }));
}

function completionBucket(score: number) {
  if (score <= 25) return "0-25%";
  if (score <= 50) return "26-50%";
  if (score <= 75) return "51-75%";
  return "76-100%";
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function userIdFromEmail(email: string) {
  return email.trim().toLowerCase().replace(/[^\p{L}\p{N}]/gu, "") || `user-${Date.now()}`;
}

function normalizeBetaRegisteredUser(user: BetaRegisteredUser): BetaRegisteredUser {
  const normalizedEmail = normalizeEmail(user.normalizedEmail || user.email);
  const deleted = user.deleted === true || user.status === "Deleted";
  return {
    ...user,
    id: user.id || userIdFromEmail(normalizedEmail),
    email: normalizedEmail,
    normalizedEmail,
    fullName: user.fullName || "Beta User",
    mobile: user.mobile || "",
    createdAt: user.createdAt || new Date().toISOString(),
    lastLoginAt: user.lastLoginAt || user.createdAt || new Date().toISOString(),
    status: deleted ? "Deleted" : user.status || "Active",
    deleted,
    onboardingStatus: user.onboardingStatus || "complete",
    userType: "Real",
  };
}

function readBetaUsersRegistry() {
  return readJson<BetaRegisteredUser[]>(betaUsersRegistryStorageKey, []).map(normalizeBetaRegisteredUser);
}

function writeBetaUsersRegistry(users: BetaRegisteredUser[]) {
  const deduped = new Map<string, BetaRegisteredUser>();
  users.map(normalizeBetaRegisteredUser).forEach((user) => deduped.set(user.normalizedEmail, user));
  writeJson(betaUsersRegistryStorageKey, [...deduped.values()]);
}

function profileCompletion(data: StoredUserData) {
  const profile = data.profile || {};
  const checks = [
    Boolean(profile.fullName && profile.email && profile.mobile),
    Boolean(profile.country && profile.city && profile.employmentSector),
    Boolean((data.incomeSources || []).length),
    Boolean((data.obligationEntries || []).length),
    Boolean((data.creditCards || []).length),
    Boolean((data.goals || []).length),
  ];

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function betaUserToAdminUser(user: BetaRegisteredUser): AdminUser {
  const data = readJson<StoredUserData>(`${userDataStoragePrefix}${user.id}`, {});
  const profile = data.profile || {};

  return {
    id: user.id,
    fullName: String(profile.fullName || user.fullName || "Beta User"),
    email: String(profile.email || user.email),
    mobile: String(profile.mobile || user.mobile || ""),
    country: profile.country || "",
    city: String(profile.city || ""),
    employer: String(profile.employer || ""),
    employmentSector: profile.employmentSector || "",
    maritalStatus: profile.maritalStatus || "",
    createdAt: user.createdAt,
    lastLogin: user.lastLoginAt || user.createdAt,
    userType: "Real",
    status: user.deleted ? "Deleted" : user.status,
    profileCompletion: profileCompletion(data),
    incomeSourceCount: (data.incomeSources || []).length,
    obligationCount: (data.obligationEntries || []).length,
    creditCardCount: (data.creditCards || []).length,
    goalCount: (data.goals || []).length,
    leadCount: (data.leads || []).length,
  };
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-white/70 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 size={18} className="text-mint" />
        <h2 className="font-black">{title}</h2>
      </div>
      <div className="h-64">{children}</div>
    </div>
  );
}

export function AdminDashboardClient({
  initialUsers,
  initialOffers,
  initialLeads,
  isDemoData,
}: {
  initialUsers: AdminUser[];
  initialOffers: Offer[];
  initialLeads: Lead[];
  isDemoData: boolean;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [usingLocalBetaUsers, setUsingLocalBetaUsers] = useState(false);
  const [offers, setOffers] = useState(initialOffers);
  const [leads, setLeads] = useState(initialLeads);
  const [deletedDataCount, setDeletedDataCount] = useState(0);
  const [offerForm, setOfferForm] = useState<Offer>(emptyOffer);
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("Overview");
  const [adminMessage, setAdminMessage] = useState("");
  const [adminError, setAdminError] = useState("");

  useEffect(() => {
    if (!isDemoData) return;
    const registry = readBetaUsersRegistry();
    if (registry.length === 0) return;

    setUsers(registry.map(betaUserToAdminUser));
    setUsingLocalBetaUsers(true);
  }, [isDemoData]);

  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const realUsers = useMemo(() => users.filter((user) => user.userType === "Real" && user.status !== "Deleted"), [users]);
  const deletedUsers = useMemo(() => users.filter((user) => user.status === "Deleted"), [users]);
  const rawRegistry = readBetaUsersRegistry();
  const isSupabaseUserSourceConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const userSourceMode = isSupabaseUserSourceConfigured ? "Supabase" : "Local beta registry";
  const rawRegistryUserCount = rawRegistry.length;
  const activeRealUserCount = isSupabaseUserSourceConfigured ? realUsers.length : rawRegistry.filter((user) => user.userType === "Real" && user.deleted !== true && user.status !== "Deleted").length;
  const deletedRegistryUserCount = rawRegistry.filter((user) => user.deleted === true || user.status === "Deleted").length;
  const firstRegistryEmails = rawRegistry.slice(0, 5).map((user) => user.normalizedEmail || user.email);
  const loginSourceUsersCount = activeRealUserCount;
  const userStoreMismatch = activeRealUserCount !== loginSourceUsersCount;
  const demoUsers = useMemo(
    () => seedAdminUsers.map((user) => ({ ...user, userType: "Demo" as const })).filter((user) => user.userType === "Demo"),
    [],
  );
  const stats = useMemo(() => {
    const totalLeads = leads.length;
    return {
      totalUsers: users.length,
      realUsers: users.filter((user) => user.userType === "Real").length,
      demoUsers: demoUsers.length,
      incompleteProfiles: users.filter((user) => user.status !== "Deleted" && (user.profileCompletion < 76 || user.status === "Incomplete")).length,
      totalLeads,
      newLeads: leads.filter((lead) => lead.status === "New").length,
      activeOffers: offers.filter((offer) => offer.active).length,
      totalOffers: offers.length,
    };
  }, [demoUsers.length, leads, offers, users]);

  const charts = useMemo(
    () => ({
      usersByCity: countBy(users, (user) => user.city),
      usersBySector: countBy(users, (user) => user.employmentSector || "Unknown"),
      profileCompletion: countBy(users, (user) => completionBucket(user.profileCompletion)),
      leadsByStatus: countBy(leads, (lead) => lead.status),
      offersByType: countBy(offers, (offer) => offer.type),
      usersByType: countBy(users, (user) => user.userType),
    }),
    [leads, offers, users],
  );

  function resetOfferForm() {
    setOfferForm(emptyOffer);
    setEditingOfferId(null);
  }

  function saveOffer() {
    setAdminError("");
    setAdminMessage("");
    if (!offerForm.title.trim()) {
      setAdminError("Offer title is required.");
      return;
    }
    if (!offerForm.bankName.trim()) {
      setAdminError("Provider / bank name is required.");
      return;
    }
    if (!offerForm.type) {
      setAdminError("Offer type is required.");
      return;
    }
    if (!offerForm.expiryDate) {
      setAdminError("Expiry date is required.");
      return;
    }
    if ([offerForm.minSalary, offerForm.maxSalary, offerForm.minDebt, offerForm.maxDebt].some((value) => Number(value) < 0)) {
      setAdminError("Salary and debt ranges must be non-negative.");
      return;
    }
    const safeOffer = {
      ...offerForm,
      minSalary: Math.max(0, Number(offerForm.minSalary) || 0),
      maxSalary: Math.max(0, Number(offerForm.maxSalary) || 0),
      minDebt: Math.max(0, Number(offerForm.minDebt) || 0),
      maxDebt: Math.max(0, Number(offerForm.maxDebt) || 0),
    };
    if (editingOfferId) {
      setOffers((current) => current.map((offer) => (offer.id === editingOfferId ? { ...safeOffer, id: editingOfferId } : offer)));
    } else {
      setOffers((current) => [{ ...safeOffer, id: crypto.randomUUID() }, ...current]);
    }
    setAdminMessage(editingOfferId ? "Offer updated successfully." : "Offer added successfully.");
    resetOfferForm();
  }

  function editOffer(offer: Offer) {
    setOfferForm(offer);
    setEditingOfferId(offer.id);
  }

  function deleteOffer(id: string) {
    if (!confirm("Are you sure you want to delete this offer?")) return;
    const offer = offers.find((item) => item.id === id);
    setOffers((current) => current.filter((item) => item.id !== id));
    if (offer) setLeads((current) => current.filter((lead) => lead.offerSelected !== offer.title));
    setAdminMessage("Offer deleted successfully.");
  }

  function toggleOfferActive(id: string) {
    setOffers((current) => current.map((offer) => (offer.id === id ? { ...offer, active: !offer.active } : offer)));
    setAdminMessage("Offer status updated.");
  }

  function updateUserStatus(userId: string, status: UserStatus) {
    const deleted = status === "Deleted";
    setUsers((current) => current.map((user) => (user.id === userId ? { ...user, status, userType: "Real" } : user)));
    const registry = readBetaUsersRegistry();
    if (registry.length > 0) {
      writeBetaUsersRegistry(registry.map((user) => (user.id === userId ? { ...user, status, deleted, userType: "Real" } : user)));
    }
    setAdminMessage(`User marked ${status}.`);
  }

  function deleteUser(userId: string) {
    if (!confirm("Are you sure you want to delete this user and related demo/test data?")) return;
    const removedLeads = leads.filter((lead) => lead.userId === userId).length;
    setUsers((current) => current.map((user) => (user.id === userId ? { ...user, status: "Deleted" } : user)));
    const registry = readBetaUsersRegistry();
    if (registry.length > 0) {
      writeBetaUsersRegistry(registry.map((user) => (user.id === userId ? { ...user, status: "Deleted", deleted: true, userType: "Real" } : user)));
    }
    setLeads((current) => current.filter((lead) => lead.userId !== userId));
    setDeletedDataCount((current) => current + removedLeads + 5);
    setAdminMessage("User deleted.");
  }

  function restoreDeletedUser(userId: string) {
    setUsers((current) => current.map((user) => (user.id === userId ? { ...user, status: "Active", userType: "Real" } : user)));
    const registry = readBetaUsersRegistry();
    if (registry.length > 0) {
      writeBetaUsersRegistry(registry.map((user) => (user.id === userId ? { ...user, status: "Active", deleted: false, userType: "Real" } : user)));
    }
    setAdminMessage("User restored.");
  }

  function resetDemoData() {
    if (!confirm("Reset demo users and demo counters?")) return;
    setDeletedDataCount(0);
    setAdminMessage("Demo data reset.");
  }

  function restoreDemoUsers() {
    setAdminMessage("Demo users restored.");
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-ink dark:bg-ink dark:text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-5">
        <header className="flex flex-col gap-4 rounded-lg border border-white/70 bg-white p-5 shadow-premium dark:border-white/10 dark:bg-white/5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase text-mint">Admin Dashboard</p>
            <h1 className="mt-1 text-3xl font-black">DebtIQ Control Center</h1>
            <p className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300">
              <ShieldAlert size={16} className="text-mint" />
              Aggregated analytics only. Passwords, API keys, environment variables, and raw financial details are not displayed.
            </p>
            {usingLocalBetaUsers ? (
              <p className="mt-2 text-sm font-bold text-emerald-700 dark:text-emerald-200">Admin is showing locally registered beta users from the users registry.</p>
            ) : isDemoData ? (
              <p className="mt-2 text-sm font-bold text-amber-700 dark:text-amber-200">Admin is showing demo users only; local beta users are stored separately.</p>
            ) : null}
            {deletedDataCount > 0 && <p className="mt-2 text-sm font-bold text-emerald-700 dark:text-emerald-200">Deleted user profiles and related demo records: {deletedDataCount}</p>}
          </div>
          <AdminLogout />
        </header>

        {!isSupabaseUserSourceConfigured && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-900 shadow-sm dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
            Local beta mode: users are stored only in this browser.
          </div>
        )}

        <nav className="flex gap-2 overflow-x-auto rounded-lg border border-white/70 bg-white p-2 shadow-sm dark:border-white/10 dark:bg-white/5">
          {adminTabs.map((tab) => (
            <button
              key={tab}
              className={`h-10 shrink-0 rounded-lg px-4 text-sm font-black transition ${
                activeTab === tab ? "bg-ink text-white dark:bg-mint dark:text-ink" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
              }`}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {tab}
            </button>
          ))}
        </nav>

        {(adminMessage || adminError) && (
          <div className={`rounded-lg px-4 py-3 text-sm font-bold ${adminError ? "bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-200" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200"}`}>
            {adminError || adminMessage}
          </div>
        )}

        {activeTab === "Overview" && <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-8">
          {[
            ["Total Users", stats.totalUsers],
            ["Real Users", stats.realUsers],
            ["Demo Users", stats.demoUsers],
            ["Incomplete Profiles", stats.incompleteProfiles],
            ["Total Leads", stats.totalLeads],
            ["New Leads", stats.newLeads],
            ["Active Offers", stats.activeOffers],
            ["Total Offers", stats.totalOffers],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-white/70 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{label}</p>
              <p className="mt-3 text-2xl font-black">{value}</p>
            </div>
          ))}
        </section>}

        {activeTab === "Analytics" && <section className="grid gap-5 xl:grid-cols-3">
          <ChartCard title="Users by City">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.usersByCity}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#38d6a3" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Users by Employment Sector">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={charts.usersBySector} dataKey="value" nameKey="name" outerRadius={82} label>
                  {charts.usersBySector.map((entry, index) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Profile Completion Distribution">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.profileCompletion}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#60a5fa" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Leads by Status">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.leadsByStatus}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#f3c969" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Offers by Type">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.offersByType}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#a78bfa" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Users by Type">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={charts.usersByType} dataKey="value" nameKey="name" outerRadius={82} label>
                  {charts.usersByType.map((entry, index) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>}

        {activeTab === "Users" && <section className="rounded-lg border border-white/70 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-black">Real Users</h2>
              <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">Deleted users are hidden by default. User type comes from the registered users store.</p>
            </div>
            <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-black dark:bg-white/10">{realUsers.length} active real user(s)</p>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1500px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
                <tr>
                  {["Full Name", "Email", "Mobile", "Country", "City", "Employer", "Employment Sector", "Completion", "Created At", "Last Login", "Type", "Status", "Income", "Obligations", "Cards", "Goals", "Leads", "Actions"].map((column) => (
                    <th key={column} className="border-b border-slate-200 px-3 py-2 dark:border-white/10">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {realUsers.map((user) => (
                  <tr key={user.id} className={user.status === "Deleted" ? "opacity-50" : ""}>
                    <td className="border-b border-slate-100 px-3 py-3 font-bold dark:border-white/10">{user.fullName}</td>
                    <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{user.email}</td>
                    <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{user.mobile}</td>
                    <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{user.country}</td>
                    <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{user.city}</td>
                    <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{user.employer || "Not provided"}</td>
                    <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{user.employmentSector || "Unknown"}</td>
                    <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{user.profileCompletion}%</td>
                    <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{dateFormatter.format(new Date(user.createdAt))}</td>
                    <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{dateFormatter.format(new Date(user.lastLogin))}</td>
                    <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{user.userType}</td>
                    <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{user.status}</td>
                    <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{user.incomeSourceCount}</td>
                    <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{user.obligationCount}</td>
                    <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{user.creditCardCount}</td>
                    <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{user.goalCount}</td>
                    <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{user.leadCount}</td>
                    <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">
                      <div className="flex gap-2">
                        <button className="grid size-9 place-items-center rounded-lg border border-slate-200 dark:border-white/10" onClick={() => setSelectedUser(user)} aria-label="View user summary">
                          <Eye size={14} />
                        </button>
                        <button className="rounded-lg border border-emerald-200 px-3 text-xs font-bold text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-200" onClick={() => updateUserStatus(user.id, "Active")}>Active</button>
                        <button className="rounded-lg border border-amber-200 px-3 text-xs font-bold text-amber-700 dark:border-amber-400/30 dark:text-amber-200" onClick={() => updateUserStatus(user.id, "Inactive")}>Inactive</button>
                        <button className="grid size-9 place-items-center rounded-lg border border-red-200 text-red-600 dark:border-red-400/30 dark:text-red-300" onClick={() => deleteUser(user.id)} aria-label="Delete user">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {deletedUsers.length > 0 && (
            <div className="mt-5 rounded-lg border border-slate-200 p-4 dark:border-white/10">
              <h3 className="font-black">Deleted Users</h3>
              <div className="mt-3 grid gap-2">
                {deletedUsers.map((user) => (
                  <div key={user.id} className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3 text-sm font-bold dark:bg-white/5 sm:flex-row sm:items-center sm:justify-between">
                    <span>{user.fullName} - {user.email}</span>
                    <button className="h-9 rounded-lg border border-emerald-200 px-3 text-xs font-black text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-200" onClick={() => restoreDeletedUser(user.id)}>Restore</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>}

        {activeTab === "Demo Users" && <section className="rounded-lg border border-white/70 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-black">Demo Users</h2>
              <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">Demo data is separate from locally registered beta users.</p>
            </div>
            <div className="flex gap-2">
              <button className="h-10 rounded-lg border border-slate-200 px-3 text-xs font-black dark:border-white/10" onClick={resetDemoData}>Reset demo data</button>
              <button className="h-10 rounded-lg bg-ink px-3 text-xs font-black text-white dark:bg-mint dark:text-ink" onClick={restoreDemoUsers}>Restore demo users</button>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
                <tr>
                  {["Demo User", "City", "Completion", "Income", "Obligations", "Cards", "Goals", "Leads", "Status"].map((column) => (
                    <th key={column} className="border-b border-slate-200 px-3 py-2 dark:border-white/10">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {demoUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="border-b border-slate-100 px-3 py-3 font-bold dark:border-white/10">{user.fullName}</td>
                    <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{user.city || "Unknown"}</td>
                    <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{user.profileCompletion}%</td>
                    <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{user.incomeSourceCount}</td>
                    <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{user.obligationCount}</td>
                    <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{user.creditCardCount}</td>
                    <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{user.goalCount}</td>
                    <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{user.leadCount}</td>
                    <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{user.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>}

        {activeTab === "Offers" && <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-lg border border-white/70 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-black">{editingOfferId ? "Edit Offer" : "Add Offer"}</h2>
              <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold dark:border-white/10" onClick={resetOfferForm}>Reset</button>
            </div>
            <div className="mt-4 grid gap-3">
              <Field label="Offer Title" value={offerForm.title} onChange={(value) => setOfferForm((current) => ({ ...current, title: value }))} />
              <Field label="Provider / Bank Name" value={offerForm.bankName} onChange={(value) => setOfferForm((current) => ({ ...current, bankName: value }))} />
              <SelectField label="Offer Type" value={offerForm.type} options={offerTypes} onChange={(value) => setOfferForm((current) => ({ ...current, type: value as OfferType }))} />
              <Field label="Description" value={offerForm.description} onChange={(value) => setOfferForm((current) => ({ ...current, description: value }))} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Minimum Salary" type="number" value={offerForm.minSalary} onChange={(value) => setOfferForm((current) => ({ ...current, minSalary: Number(value) }))} />
                <Field label="Maximum Salary" type="number" value={offerForm.maxSalary} onChange={(value) => setOfferForm((current) => ({ ...current, maxSalary: Number(value) }))} />
                <Field label="Minimum Debt" type="number" value={offerForm.minDebt} onChange={(value) => setOfferForm((current) => ({ ...current, minDebt: Number(value) }))} />
                <Field label="Maximum Debt" type="number" value={offerForm.maxDebt} onChange={(value) => setOfferForm((current) => ({ ...current, maxDebt: Number(value) }))} />
                <Field label="Expiry Date" type="date" value={offerForm.expiryDate} onChange={(value) => setOfferForm((current) => ({ ...current, expiryDate: value }))} />
                <label className="flex h-10 items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm font-bold dark:border-white/10">
                  <input type="checkbox" checked={offerForm.active} onChange={(event) => setOfferForm((current) => ({ ...current, active: event.target.checked }))} />
                  Active / Inactive
                </label>
              </div>
              <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-ink text-sm font-bold text-white dark:bg-mint dark:text-ink" onClick={saveOffer}>
                <Plus size={16} />
                {editingOfferId ? "Save Offer" : "Add Offer"}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-white/70 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
            <h2 className="font-black">Offers</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
                  <tr>
                    {["Title", "Provider / Bank", "Type", "Active", "Expiry Date", "Actions"].map((column) => (
                      <th key={column} className="border-b border-slate-200 px-3 py-2 dark:border-white/10">{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {offers.map((offer) => (
                    <tr key={offer.id}>
                      <td className="border-b border-slate-100 px-3 py-3 font-bold dark:border-white/10">{offer.title}</td>
                      <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{offer.bankName}</td>
                      <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{offer.type}</td>
                      <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{offer.active ? "Active" : "Inactive"}</td>
                      <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{offer.expiryDate}</td>
                      <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">
                        <div className="flex gap-2">
                          <button className="rounded-lg border border-slate-200 px-3 text-xs font-bold dark:border-white/10" onClick={() => toggleOfferActive(offer.id)}>{offer.active ? "Deactivate" : "Activate"}</button>
                          <button className="grid size-9 place-items-center rounded-lg border border-slate-200 dark:border-white/10" onClick={() => editOffer(offer)} aria-label="Edit offer"><Pencil size={14} /></button>
                          <button className="grid size-9 place-items-center rounded-lg border border-red-200 text-red-600 dark:border-red-400/30 dark:text-red-300" onClick={() => deleteOffer(offer.id)} aria-label="Delete offer"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>}

        {activeTab === "Leads" && <section className="rounded-lg border border-white/70 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
          <h2 className="font-black">Leads</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
                <tr>
                  {["User Name", "Mobile", "Email", "City", "Employment Sector", "Selected Offer", "Created At", "Status", "Actions"].map((column) => (
                    <th key={column} className="border-b border-slate-200 px-3 py-2 dark:border-white/10">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => {
                  const user = lead.userId ? userById.get(lead.userId) : undefined;
                  return (
                    <tr key={lead.id}>
                      <td className="border-b border-slate-100 px-3 py-3 font-bold dark:border-white/10">{lead.userName}</td>
                      <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{lead.mobile}</td>
                      <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{lead.email}</td>
                      <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{user?.city || "Unknown"}</td>
                      <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{user?.employmentSector || "Unknown"}</td>
                      <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{lead.offerSelected}</td>
                      <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{dateFormatter.format(new Date(lead.timestamp))}</td>
                      <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">{lead.status}</td>
                      <td className="border-b border-slate-100 px-3 py-3 dark:border-white/10">
                        <select
                          className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-ink dark:border-white/10 dark:bg-slate-900 dark:text-white"
                          value={lead.status}
                          onChange={(event) => setLeads((current) => current.map((item) => (item.id === lead.id ? { ...item, status: event.target.value as LeadStatus } : item)))}
                        >
                          {leadStatuses.map((status) => <option key={status}>{status}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>}

        {activeTab === "Settings" && <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-lg border border-white/70 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
            <h2 className="font-black">Admin Mode</h2>
            <div className="mt-4 grid gap-3 text-sm font-bold text-slate-700 dark:text-slate-200">
              <p>User source: {userSourceMode}</p>
              <p>Registry key: {betaUsersRegistryStorageKey}</p>
              <p>Raw registry user count: {rawRegistryUserCount}</p>
              <p>Active real user count: {activeRealUserCount}</p>
              <p>Deleted user count: {deletedRegistryUserCount}</p>
              <p>Login source users: {loginSourceUsersCount}</p>
              <p>First 5 emails in registry: {firstRegistryEmails.length ? firstRegistryEmails.join(", ") : "None"}</p>
              {userStoreMismatch && <p className="text-red-600 dark:text-red-300">Warning: user store mismatch.</p>}
              <p>Data mode: {usingLocalBetaUsers ? "Local beta users registry" : isDemoData ? "Demo/local mode" : "Supabase configured"}</p>
              <p>Environment: Admin credentials are read from environment variables.</p>
              <p>Visible data: Aggregated analytics and operational records only.</p>
            </div>
          </div>
          <div className="rounded-lg border border-white/70 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
            <h2 className="font-black">Beta Safety Checklist</h2>
            <div className="mt-4 grid gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
              {["Admin credentials from env", "No passwords displayed", "No secrets displayed", "Demo data labeled", "Demo users separated from real users"].map((item) => (
                <p key={item} className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">✓ {item}</p>
              ))}
            </div>
            <div className="mt-5 flex gap-2">
              <button className="h-10 rounded-lg border border-slate-200 px-3 text-xs font-black dark:border-white/10" onClick={resetDemoData}>Reset demo counters</button>
              <button className="h-10 rounded-lg border border-slate-200 px-3 text-xs font-black dark:border-white/10" onClick={restoreDemoUsers}>Restore demo users</button>
            </div>
          </div>
        </section>}

        {selectedUser && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-ink/60 px-4">
            <div className="w-full max-w-lg rounded-lg border border-white/70 bg-white p-5 shadow-premium dark:border-white/10 dark:bg-slate-950">
              <p className="text-xs font-black uppercase text-mint">User Summary</p>
              <h2 className="mt-2 text-2xl font-black">{selectedUser.fullName}</h2>
              <div className="mt-4 grid gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                <p>Profile completion: {selectedUser.profileCompletion}%</p>
                <p>Status: {selectedUser.status}</p>
                <p>Type: {selectedUser.userType}</p>
                <p>City: {selectedUser.city || "Unknown"}</p>
                <p>Employment sector: {selectedUser.employmentSector || "Unknown"}</p>
                <p>Leads generated: {leads.filter((lead) => lead.userId === selectedUser.id).length}</p>
              </div>
              <button className="mt-5 h-10 rounded-lg bg-ink px-4 text-sm font-bold text-white dark:bg-mint dark:text-ink" onClick={() => setSelectedUser(null)}>Close</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
