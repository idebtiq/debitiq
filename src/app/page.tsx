"use client";

import {
  BarChart3,
  BellRing,
  Calculator,
  CheckCircle2,
  CircleDollarSign,
  CreditCard as CreditCardIcon,
  ChevronRight,
  Eye,
  EyeOff,
  Info,
  Landmark,
  LayoutDashboard,
  LockKeyhole,
  Moon,
  Plus,
  Printer,
  Send,
  Smartphone,
  Sun,
  Target,
  Trash2,
  UserRound,
  WalletCards,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as XLSX from "xlsx";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import {
  isSupabaseConfigured,
  supabase,
  supabaseAnonKeyLoaded,
  supabaseClientCreated,
  supabaseDiagnosticInfo,
  supabaseUrlLoaded,
  testSupabaseAuthConnection,
  type SupabaseHealthCheck,
} from "@/lib/supabase";
import {
  calculateSnapshot,
  getMonthlyObligationImpact,
  getMonthsUntilObligationDue,
  getObligationDueDate,
  getRequiredMonthlySaving,
  scoreLabel,
} from "@/lib/score";
import {
  seedCreditCards,
  seedDebts,
  seedGoals,
  seedIncomeSources,
  seedKarimaCreditCards,
  seedKarimaDebts,
  seedKarimaGoals,
  seedKarimaIncomeSources,
  seedKarimaObligationEntries,
  seedKarimaProfile,
  seedObligationEntries,
  seedOffers,
  seedProfile,
} from "@/lib/demo-data";
import type {
  BonusAllocation,
  Country,
  CreditCard,
  Debt,
  DebtType,
  EmploymentSector,
  Goal,
  GoalPriority,
  GoalType,
  IncomeSource,
  IncomeType,
  Lead,
  MaritalStatus,
  ObligationCategory,
  ObligationAllocationMethod,
  ObligationEntry,
  ObligationFrequency,
  Offer,
  UserProfile,
} from "@/lib/types";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "SAR",
  maximumFractionDigits: 0,
});
const dateFormatter = new Intl.DateTimeFormat("en-US");
const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

const emptyProfile: UserProfile = {
  fullName: "",
  mobile: "",
  email: "",
  country: "",
  city: "",
  employer: "",
  employmentSector: "",
  maritalStatus: "",
};

const maritalStatusOptions: MaritalStatus[] = ["Single", "Married", "Divorced", "Widowed", "Prefer not to say"];
const employmentSectorOptions: EmploymentSector[] = ["Government", "Private Sector", "Military", "Semi-Government", "Self-Employed", "Retired", "Student", "Prefer not to say", "Other"];
const countryOptions: Country[] = ["Saudi Arabia", "UAE", "Kuwait", "Bahrain", "Qatar", "Oman", "Other"];
const cityOptionsByCountry: Record<Country, string[]> = {
  "Saudi Arabia": ["Riyadh", "Jeddah", "Makkah", "Madinah", "Dammam", "Khobar", "Dhahran", "Jubail", "Abha", "Tabuk", "Hail", "Al Ahsa", "Other"],
  UAE: ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Other"],
  Kuwait: ["Kuwait City", "Hawalli", "Salmiya", "Other"],
  Bahrain: ["Manama", "Muharraq", "Riffa", "Other"],
  Qatar: ["Doha", "Al Rayyan", "Lusail", "Other"],
  Oman: ["Muscat", "Salalah", "Sohar", "Other"],
  Other: ["Other"],
};
const debtTypes: DebtType[] = ["Personal Loan", "Credit Card", "Mortgage", "Auto Finance", "Other Debt"];
const allGoalTypes: GoalType[] = ["Pay Off Credit Card", "Pay Off Debt", "Buy Car", "Buy Home", "Emergency Fund", "School Fees", "Business Fund", "Travel", "Other"];
const goalPriorities: GoalPriority[] = ["High", "Medium", "Low"];
const incomeTypes: IncomeType[] = ["Salary", "Rent", "Housing Allowance", "Business", "Consulting", "Commission", "Bonus", "Other"];
const bonusAllocationOptions: BonusAllocation[] = [
  "Allocate to financial goals",
  "Pay off a credit card",
  "Pay off a loan",
  "Emergency fund",
  "School fees / major obligation",
  "Keep unallocated for now",
  "Custom allocation",
];
const obligationCategories: ObligationCategory[] = [
  "Loan",
  "Credit Card",
  "Education",
  "Housing",
  "Children",
  "Domestic Worker",
  "Vehicle",
  "Insurance",
  "Lifestyle",
  "Other",
];
const obligationFrequencies: ObligationFrequency[] = ["Monthly", "One-Time", "Annual"];
const obligationAllocationMethods: ObligationAllocationMethod[] = [
  "Count full amount only in due month",
  "Spread amount monthly until due date",
];
const lifestyleExpenseNames = [
  "Groceries",
  "Fuel / Transportation",
  "Restaurants & Coffee",
  "Entertainment",
  "Internet",
  "Mobile Bills",
  "Utilities",
  "Subscriptions",
  "Other lifestyle expenses",
];
const commonObligationOptions: Array<{ name: string; category: ObligationCategory; amount: number; frequency: ObligationFrequency }> = [
  { name: "Loan", category: "Loan", amount: 0, frequency: "Monthly" },
  { name: "Credit Card", category: "Credit Card", amount: 0, frequency: "Monthly" },
  { name: "School Fees", category: "Education", amount: 0, frequency: "One-Time" },
  { name: "House Rent", category: "Housing", amount: 0, frequency: "Annual" },
  { name: "Car Installment", category: "Vehicle", amount: 0, frequency: "Monthly" },
  { name: "Insurance", category: "Insurance", amount: 0, frequency: "Annual" },
  { name: "Domestic Worker", category: "Domestic Worker", amount: 0, frequency: "Monthly" },
  { name: "Child Support", category: "Children", amount: 0, frequency: "Monthly" },
  { name: "Electricity Bill", category: "Lifestyle", amount: 0, frequency: "Monthly" },
  { name: "Internet Bill", category: "Lifestyle", amount: 0, frequency: "Monthly" },
  { name: "Mobile Bill", category: "Lifestyle", amount: 0, frequency: "Monthly" },
  { name: "Other", category: "Other", amount: 0, frequency: "Monthly" },
];
const starterGoalTypes: GoalType[] = ["Pay Off Credit Card", "Pay Off Debt", "Emergency Fund", "School Fees", "Buy Car", "Buy Home", "Business Fund", "Travel", "Other"];
const translations = {
  en: {
    common: { login: "Login", createAccount: "Create Account", importData: "Import Data", downloadTemplate: "Download DebtIQ Template", cancel: "Cancel", confirm: "Confirm Import", tryDemo: "Try Demo", next: "Next", back: "Back", save: "Save", savedSuccessfully: "Saved successfully", unsavedChanges: "Unsaved changes", income: "Income", lifestyle: "Lifestyle", obligations: "Obligations", goals: "Goals", forecast: "Forecast", bonus: "Bonus", suggestedActions: "Suggested Actions", profile: "Profile", accountAccess: "Account Access", debtCenter: "Debt Center", recommendations: "Recommendations", opportunities: "Potential Opportunities", upcomingExtraIncome: "Upcoming Extra Income", financialGapForecast: "Financial Gap Forecast", goalCompletionForecast: "Goal Completion Forecast", creditCardIntelligence: "Credit Card Intelligence", printReport: "Print Report", printPreview: "Print Preview", executiveSummary: "Executive Financial Summary", actionPlan: "Recommended Actions", profileCompletion: "Financial Profile Completion" },
    landing: {
      headline: "Organize your income, obligations, and financial goals in one place",
      body: "DebtIQ helps you understand your financial position, organize income, track obligations, plan for major expenses, and detect financial gaps before they happen.",
      benefits: [
        "Understand where your salary goes every month",
        "Detect financial gaps before they happen",
        "Track obligations by due date",
        "Monitor credit cards and utilization",
        "Plan for major expenses such as school fees, rent, car, and home",
        "Know how much you need monthly to reach your goals",
        "Know when obligations will end and how much income will be released",
        "Import your data from Excel or enter it manually",
        "Receive future financial opportunity insights when available",
      ],
    },
    dashboard: { monthlyIncome: "Monthly Income", monthlyObligations: "Monthly Obligations", monthlySurplusDeficit: "Monthly Surplus/Deficit", debtScore: "Debt Score", upcomingOneTime: "Upcoming One-Time Obligations", requiredMonthlySavings: "Required Monthly Savings" },
    onboarding: {
      title: "Profile Setup Wizard",
      setupChoice: "How would you like to add your financial data?",
      importExcel: "Import Excel File",
      manualEntry: "Enter Manually",
      whyTitle: "Why complete your data?",
      whyBody: "The more accurate your data is, the more useful DebtIQ becomes. You do not need perfect numbers. Add your best estimate and update it later.",
      whyDetail: "Adding your data helps DebtIQ calculate monthly gaps, track obligations, forecast high-risk months, and guide your financial goals.",
      employerName: "Employer Name",
      skipEmployer: "I prefer not to add employer",
      workIncome: "Work & Income Basics",
      monthlyNetSalary: "Monthly Net Salary",
      incomeMode: "Do you want to enter salary as total net salary or detailed breakdown?",
      totalIncome: "Total monthly net income",
      detailedIncome: "Detailed income breakdown",
      lifestyle: "Monthly Lifestyle Expenses",
      commonObligations: "Do you have any of these?",
      goalsQuestion: "What are your financial goals?",
    },
    income: { title: "Income Sources", name: "Income Name", amount: "Income Amount", type: "Income Type" },
    obligation: { title: "Obligations", amount: "Amount", frequency: "Frequency", dueDate: "Due Date", startDate: "Start Date", endDate: "End Date", allocation: "Allocation Method", savedAmount: "Saved Amount" },
    goal: { title: "Goals" },
    creditCard: { title: "Credit Cards" },
    admin: { title: "Admin" },
    categories: { Loan: "Loan", "Credit Card": "Credit Card", Education: "Education", Housing: "Housing", Children: "Children", "Domestic Worker": "Domestic Worker", Vehicle: "Vehicle", Insurance: "Insurance", Lifestyle: "Lifestyle", Other: "Other" },
    tooltips: {
      frequency: "How often this obligation repeats: monthly, annual, or one-time.",
      dueDate: "The date a payment is due or the final deadline for payment.",
      startDate: "The date this obligation or loan begins.",
      endDate: "The date this obligation ends or the expected final payment.",
      allocationMethod: "Choose whether the full amount is counted in the due month or spread monthly until payment.",
      minimumPaymentDue: "The smallest payment required to avoid late fees or penalties.",
      statementTotalDue: "The total amount due on the latest card statement.",
      creditLimit: "The full credit limit for the card.",
      creditUtilization: "The percentage of your credit limit currently used.",
      annualBonus: "Expected annual bonus. It is saved as an income source and counted only in the expected month.",
      monthlyNetSalary: "The amount deposited into your account each month after deductions.",
      lifestyleExpenses: "Daily or monthly spending that affects cash flow but is not a formal debt.",
    },
  },
  ar: {
    common: { login: "تسجيل الدخول", createAccount: "إنشاء حساب", importData: "استيراد البيانات", downloadTemplate: "تحميل قالب ديبت آي كيو", cancel: "إلغاء", confirm: "تأكيد الاستيراد", tryDemo: "تجربة العرض", next: "التالي", back: "رجوع", save: "حفظ", savedSuccessfully: "تم الحفظ بنجاح", unsavedChanges: "تعديلات غير محفوظة", income: "دخلك الشهري", lifestyle: "مصروفاتك الشهرية", obligations: "التزاماتك القادمة", goals: "أهدافك المالية", forecast: "التوقعات", bonus: "البونص", suggestedActions: "نصائح قد تساعدك", profile: "ملفك الشخصي", accountAccess: "الوصول للحساب", debtCenter: "البطاقات والديون", recommendations: "نصائح قد تساعدك", opportunities: "الفرص المحتملة", upcomingExtraIncome: "دخل إضافي قادم", financialGapForecast: "توقع العجز المالي", goalCompletionForecast: "توقع اكتمال الأهداف", creditCardIntelligence: "تحليل البطاقات الائتمانية", printReport: "طباعة التقرير", printPreview: "معاينة الطباعة", executiveSummary: "التقرير المالي التنفيذي", actionPlan: "خطوات مقترحة", profileCompletion: "اكتمال الملف المالي" },
    landing: {
      headline: "رتب دخلك والتزاماتك وأهدافك المالية في مكان واحد",
      body: "ديبت آي كيو يساعدك على فهم وضعك المالي، ترتيب دخلك، متابعة التزاماتك، التخطيط للمصاريف الكبيرة، واكتشاف العجز المالي قبل حدوثه.",
      benefits: [
        "اعرف أين يذهب راتبك شهرياً",
        "اكتشف العجز المالي قبل حدوثه",
        "رتب التزاماتك حسب تاريخ الاستحقاق",
        "تابع بطاقاتك الائتمانية ونسبة استخدامها",
        "خطط للمصاريف الكبيرة مثل المدارس والإيجار والسيارة والبيت",
        "اعرف كم تحتاج شهرياً للوصول إلى أهدافك",
        "اعرف متى ستنتهي بعض التزاماتك وكم سيتحرر من دخلك مستقبلاً",
        "استورد بياناتك من Excel أو أدخلها يدوياً",
        "احصل مستقبلاً على فرص مالية مناسبة لوضعك عند توفرها",
      ],
    },
    dashboard: { monthlyIncome: "الدخل الشهري", monthlyObligations: "الالتزامات الشهرية", monthlySurplusDeficit: "الفائض/العجز الشهري", debtScore: "ضغط الدين", upcomingOneTime: "الالتزامات القادمة", requiredMonthlySavings: "الادخار الشهري المطلوب" },
    onboarding: {
      title: "إعداد الملف الشخصي",
      setupChoice: "كيف تفضل إضافة بياناتك المالية؟",
      importExcel: "رفع ملف Excel",
      manualEntry: "إدخال البيانات يدوياً",
      whyTitle: "لماذا تكمل بياناتك؟",
      whyBody: "كلما كانت بياناتك أدق، أصبحت توقعات ديبت آي كيو أكثر فائدة. لا نحتاج أرقاماً مثالية، فقط أدخل أفضل تقدير لديك ويمكنك تعديله لاحقاً.",
      whyDetail: "إضافة بياناتك تساعد ديبت آي كيو على حساب العجز الشهري، متابعة الالتزامات، توقع الأشهر عالية الخطورة، وتحديد الأهداف المالية المناسبة لك.",
      employerName: "اسم جهة العمل",
      skipEmployer: "أفضل عدم إضافة جهة العمل",
      workIncome: "العمل والدخل",
      monthlyNetSalary: "صافي الراتب الشهري",
      incomeMode: "هل تريد إدخال الراتب كإجمالي صافي أو كتفصيل؟",
      totalIncome: "إجمالي صافي الدخل الشهري",
      detailedIncome: "تفصيل الدخل",
      lifestyle: "مصاريف نمط الحياة الشهرية",
      commonObligations: "هل لديك أي من هذه الالتزامات؟",
      goalsQuestion: "ما أهدافك المالية؟",
    },
    income: { title: "مصادر الدخل", name: "اسم الدخل", amount: "مبلغ الدخل", type: "نوع الدخل" },
    obligation: { title: "الالتزامات", amount: "المبلغ", frequency: "التكرار", dueDate: "تاريخ الاستحقاق", startDate: "تاريخ البداية", endDate: "تاريخ النهاية", allocation: "طريقة الاحتساب", savedAmount: "المبلغ المدخر" },
    goal: { title: "الأهداف" },
    creditCard: { title: "البطاقات الائتمانية" },
    admin: { title: "الإدارة" },
    categories: { Loan: "قرض", "Credit Card": "بطاقة ائتمانية", Education: "تعليم", Housing: "سكن", Children: "أبناء", "Domestic Worker": "عاملة منزلية", Vehicle: "سيارة", Insurance: "تأمين", Lifestyle: "نمط حياة", Other: "أخرى" },
    tooltips: {
      frequency: "كم مرة يتكرر هذا الالتزام؟ شهري، سنوي، أو مرة واحدة.",
      dueDate: "تاريخ استحقاق الدفع أو آخر موعد للسداد.",
      startDate: "تاريخ بداية الالتزام أو القرض.",
      endDate: "تاريخ انتهاء الالتزام أو آخر دفعة متوقعة.",
      allocationMethod: "اختر هل يتم احتساب المبلغ كاملاً في شهر الاستحقاق أو توزيعه شهرياً حتى موعد السداد.",
      minimumPaymentDue: "أقل مبلغ يجب دفعه لتجنب التأخير أو الرسوم الإضافية.",
      statementTotalDue: "إجمالي المبلغ المستحق في كشف البطاقة الأخير.",
      creditLimit: "الحد الائتماني الكامل للبطاقة.",
      creditUtilization: "النسبة المستخدمة من الحد الائتماني.",
      annualBonus: "بونص سنوي متوقع يحفظ كمصدر دخل ويظهر فقط في شهره المتوقع.",
      monthlyNetSalary: "المبلغ الذي يدخل حسابك شهرياً بعد الخصومات.",
      lifestyleExpenses: "مصاريف يومية أو شهرية غير مرتبطة بعقد، لكنها تؤثر على التدفق النقدي.",
    },
  },
} as const;

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function calculatePayoffMonths(balance: number, monthlyPayment: number, annualRate: number) {
  if (balance <= 0) return 0;
  if (monthlyPayment <= 0) return Number.POSITIVE_INFINITY;

  let remaining = balance;
  let months = 0;
  const monthlyRate = Math.max(annualRate, 0) / 100 / 12;

  while (remaining > 0 && months < 240) {
    remaining = remaining * (1 + monthlyRate) - monthlyPayment;
    months += 1;
  }

  return months >= 240 ? Number.POSITIVE_INFINITY : months;
}

function formatEstimatedMonth(months: number) {
  if (!Number.isFinite(months)) return "Needs higher payment";
  if (months > 120) return "Current contribution is too low to estimate a realistic completion date.";
  return monthFormatter.format(addMonths(new Date(), Math.max(0, months)));
}

function getMonthNumber(monthName: string) {
  const index = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ].indexOf(monthName.trim().toLowerCase());
  return index >= 0 ? index : 11;
}

function isAnnualBonusIncome(income: IncomeSource) {
  return income.type === "Bonus" || income.name.toLowerCase().startsWith("annual bonus:");
}

function getAnnualBonusMonth(income: IncomeSource) {
  if (income.expectedMonth) return getMonthNumber(income.expectedMonth);
  const match = income.name.match(/^Annual bonus:\s*([A-Za-z]+)/i);
  return match ? getMonthNumber(match[1]) : 11;
}

function getBonusAllocation(income: IncomeSource): BonusAllocation {
  return income.allocation || "Keep unallocated for now";
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function readCell(row: Record<string, unknown>, names: string[]) {
  const normalizedNames = names.map(normalizeKey);
  const entry = Object.entries(row).find(([key]) => normalizedNames.includes(normalizeKey(key)));
  return entry?.[1];
}

function parseAmount(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return Number.NaN;
  const unicodeNormalized = value
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0));
  const unicodeIsNegative = /^\s*\(.*\)\s*$/.test(unicodeNormalized) || unicodeNormalized.trim().startsWith("-");
  const unicodeCleaned = unicodeNormalized
    .replace(/\((.*)\)/, "$1")
    .replace(/[\u00a0\s]/g, "")
    .replace(/[\u066c,]/g, "")
    .replace(/[\u066b]/g, ".")
    .replace(/[^0-9.-]/g, "");
  const unicodeAmount = Number(unicodeCleaned);
  if (Number.isFinite(unicodeAmount)) return unicodeIsNegative ? -Math.abs(unicodeAmount) : unicodeAmount;
  const normalizedDigits = value
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[Û°-Û¹]/g, (digit) => String("Û°Û±Û²Û³Û´ÛµÛ¶Û·Û¸Û¹".indexOf(digit)));
  const isNegative = /^\s*\(.*\)\s*$/.test(normalizedDigits) || normalizedDigits.trim().startsWith("-");
  const cleaned = normalizedDigits
    .replace(/\((.*)\)/, "$1")
    .replace(/[\u00a0\s]/g, "")
    .replace(/[٬,]/g, "")
    .replace(/[٫]/g, ".")
    .replace(/[^0-9.-]/g, "");
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? (isNegative ? -Math.abs(amount) : amount) : Number.NaN;
}

function parseDateValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function parseDueDay(value: unknown) {
  const parsed = parseDateValue(value);
  if (parsed) return parsed.getDate();
  const numeric = parseAmount(value);
  return Number.isFinite(numeric) ? Math.min(31, Math.max(1, Math.round(numeric))) : Number.NaN;
}

function getRows(workbook: XLSX.WorkBook, sheetName: string) {
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "", raw: true });
}

function missingColumns(rows: Record<string, unknown>[], required: string[]) {
  const keys = rows[0] ? Object.keys(rows[0]).map(normalizeKey) : [];
  return required.filter((column) => !keys.includes(normalizeKey(column)));
}

function getPasswordChecks(password: string) {
  return [
    { label: "Minimum 8 characters", valid: password.length >= 8 },
    { label: "Uppercase letter", valid: /[A-Z]/.test(password) },
    { label: "Lowercase letter", valid: /[a-z]/.test(password) },
    { label: "Number", valid: /\d/.test(password) },
    { label: "Special character", valid: /[^A-Za-z0-9]/.test(password) },
  ];
}

function isStrongPassword(password: string) {
  return getPasswordChecks(password).every((check) => check.valid);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function betaPasswordHash(password: string) {
  if (typeof window !== "undefined" && "btoa" in window) return window.btoa(unescape(encodeURIComponent(password)));
  return password;
}

function isValidSaudiMobile(value: string) {
  const digits = value.replace(/\D/g, "");
  return /^9665\d{8}$/.test(digits) || /^05\d{8}$/.test(digits) || /^5\d{8}$/.test(digits);
}

function isValidDateString(value: string) {
  if (!value) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

function hasNegativeAmounts(items: Array<Record<string, unknown>>, fields: string[]) {
  return items.some((item) => fields.some((field) => typeof item[field] === "number" && (item[field] as number) < 0));
}

function mapObligationCategory(value: unknown) {
  const raw = String(value || "").trim();
  const direct = obligationCategories.find((category) => normalizeKey(category) === normalizeKey(raw));
  return direct || categoryAliases[normalizeKey(raw)] || "Other";
}

function mapObligationFrequency(value: unknown): ObligationFrequency {
  const normalized = normalizeKey(String(value || ""));
  if (["annual", "yearly", "سنوي"].includes(normalized)) return "Annual";
  if (["onetime", "once", "single", "مرةواحدة", "مرهواحده"].includes(normalized)) return "One-Time";
  return "Monthly";
}

function mapAllocationMethod(value: unknown, frequency: ObligationFrequency): ObligationAllocationMethod {
  const normalized = normalizeKey(String(value || ""));
  if (normalized.includes("spread") || normalized.includes("saving") || normalized.includes("monthly") || normalized.includes("توزيع") || normalized.includes("شهري")) {
    return "Spread amount monthly until due date";
  }
  if (frequency === "Monthly") return "Count full amount only in due month";
  return "Count full amount only in due month";
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dateFromDueDay(dueDay: number, from = new Date()) {
  const normalizedDay = Math.min(28, Math.max(1, Number.isFinite(dueDay) ? dueDay : 1));
  const dueDate = new Date(from.getFullYear(), from.getMonth(), normalizedDay);
  if (dueDate < from) dueDate.setMonth(dueDate.getMonth() + 1);
  return isoDate(dueDate);
}

function normalizeSaudiMobile(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("966")) return `+${digits.slice(0, 12)}`;
  if (digits.startsWith("05")) return `+966${digits.slice(1, 10)}`;
  if (digits.startsWith("5")) return `+966${digits.slice(0, 9)}`;
  return `+966${digits.slice(0, 9)}`;
}

function userIdFromEmail(email: string) {
  const normalized = normalizeKey(email || "local-user");
  return normalized || crypto.randomUUID();
}

function userStorageKey(userId: string) {
  return `${userDataStoragePrefix}${userId}`;
}

function onboardingProgressStorageKey(userId: string) {
  return `${onboardingProgressStoragePrefix}${userId}`;
}

function quickSetupDoneStorageKey(userId: string) {
  return `${quickSetupDoneStoragePrefix}${userId}`;
}

function draftStorageKey(userId: string) {
  return `${draftDataStoragePrefix}${userId}`;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(fallback)) return (Array.isArray(parsed) ? parsed : fallback) as T;
    if (fallback === null || typeof fallback !== "object") return parsed as T;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return ({ ...fallback, ...parsed } as T);
    return fallback;
  } catch (error) {
    console.warn(`Recovered from corrupted localStorage key: ${key}`, error);
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore storage cleanup failures.
    }
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Unable to write localStorage key: ${key}`, error);
  }
}

function removeStoredItem(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn(`Unable to remove localStorage key: ${key}`, error);
  }
}

function createClientId(prefix = "id") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getCheckpointAgeMs(progress: OnboardingProgress | null) {
  if (!progress?.savedAt) return Number.POSITIVE_INFINITY;
  const savedAt = new Date(progress.savedAt).getTime();
  return Number.isFinite(savedAt) ? Date.now() - savedAt : Number.POSITIVE_INFINITY;
}

function isOnboardingProgressOwnedBySession(progress: OnboardingProgress | null, session: StoredSession, data: UserOwnedData) {
  if (!progress || session.mode !== "real") return false;
  const progressEmail = normalizeEmail(progress.email || progress.registration.email);
  const sessionEmail = normalizeEmail(data.profile.email);
  const userMatches = !progress.userId || progress.userId === session.userId;
  const emailMatches = !progressEmail || !sessionEmail || progressEmail === sessionEmail;
  return userMatches && emailMatches && getCheckpointAgeMs(progress) <= 24 * 60 * 60 * 1000;
}

function normalizeUserData(data: UserOwnedData): UserOwnedData {
  return {
    ...emptyUserData,
    ...data,
    profile: {
      ...emptyProfile,
      ...data.profile,
    },
  };
}

function readUserData(userId: string): UserOwnedData {
  return normalizeUserData(readJson<UserOwnedData>(userStorageKey(userId), emptyUserData));
}

function userDataFromProfile(profile: UserProfile): UserOwnedData {
  return {
    ...emptyUserData,
    profile: {
      ...emptyProfile,
      ...profile,
    },
  };
}

function profileFromSupabaseRow(row: SupabaseProfileRow | null | undefined, fallbackEmail: string): UserProfile {
  return {
    ...emptyProfile,
    fullName: row?.full_name || fallbackEmail,
    mobile: row?.mobile || "",
    email: normalizeEmail(row?.email || fallbackEmail),
    country: row?.country || "",
    city: row?.city || "",
    employer: row?.employer || "",
    employmentSector: row?.employment_sector || "",
    maritalStatus: row?.marital_status || "",
  };
}

function parseSupabaseNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function mapSupabaseIncomeSource(row: Record<string, unknown>): IncomeSource {
  return {
    id: String(row.id || createClientId("income")),
    name: String(row.income_name || "Income source"),
    amount: parseSupabaseNumber(row.income_amount),
    type: (row.income_type || "Other") as IncomeType,
    expectedMonth: row.expected_month ? String(row.expected_month) : undefined,
    guaranteed: typeof row.guaranteed === "boolean" ? row.guaranteed : undefined,
    recurring: typeof row.recurring === "boolean" ? row.recurring : undefined,
    allocation: row.allocation ? String(row.allocation) as BonusAllocation : undefined,
    notes: row.notes ? String(row.notes) : undefined,
  };
}

function mapSupabaseObligation(row: Record<string, unknown>): ObligationEntry {
  return {
    id: String(row.id || createClientId("obligation")),
    name: String(row.obligation_name || "Obligation"),
    monthlyAmount: parseSupabaseNumber(row.monthly_amount),
    category: (row.category || "Other") as ObligationCategory,
    dueDay: parseSupabaseNumber(row.due_day) || 1,
    isRecurring: typeof row.is_recurring === "boolean" ? row.is_recurring : true,
    frequency: (row.frequency || "Monthly") as ObligationFrequency,
    dueDate: row.due_date ? String(row.due_date) : dateFromDueDay(parseSupabaseNumber(row.due_day) || 1),
    startDate: row.start_date ? String(row.start_date) : isoDate(new Date()),
    endDate: row.end_date ? String(row.end_date) : undefined,
    allocationMethod: (row.allocation_method || "Count full amount only in due month") as ObligationAllocationMethod,
    savedAmount: parseSupabaseNumber(row.saved_amount),
    notes: String(row.notes || ""),
  };
}

function mapSupabaseCreditCard(row: Record<string, unknown>): CreditCard {
  return {
    id: String(row.id || createClientId("card")),
    cardName: String(row.card_name || "Credit card"),
    provider: String(row.provider || "Card provider"),
    creditLimit: parseSupabaseNumber(row.credit_limit),
    currentBalance: parseSupabaseNumber(row.current_balance),
    minimumPaymentDue: parseSupabaseNumber(row.minimum_payment_due),
    statementTotalDue: parseSupabaseNumber(row.statement_total_due),
    dueDate: row.due_date ? String(row.due_date) : dateFromDueDay(20),
    aprOrProfitRate: parseSupabaseNumber(row.apr_or_profit_rate),
    notes: String(row.notes || ""),
  };
}

function mapSupabaseGoal(row: Record<string, unknown>): Goal {
  return {
    id: String(row.id || createClientId("goal")),
    name: String(row.name || "Goal"),
    type: (row.goal_type || "Other") as GoalType,
    targetAmount: parseSupabaseNumber(row.target_amount),
    currentAmount: parseSupabaseNumber(row.current_amount),
    targetDate: row.target_date ? String(row.target_date) : "2027-12-31",
    priority: (row.priority || "Medium") as GoalPriority,
    notes: String(row.notes || ""),
    linkedDebtId: row.linked_debt_id ? String(row.linked_debt_id) : undefined,
    linkedCreditCardId: row.linked_credit_card_id ? String(row.linked_credit_card_id) : undefined,
  };
}

async function loadSupabaseOwnedData(userId: string, fallbackEmail: string): Promise<SupabaseOwnedDataResult> {
  if (!supabase) {
    return { data: userDataFromProfile({ ...emptyProfile, email: fallbackEmail }), quickSetupCompleted: false, quickSetupSkipped: false };
  }

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle<SupabaseProfileRow>();

  if (profileError || !profileRow) {
    throw profileError || new Error("Supabase profile was not found.");
  }

  const [incomeResponse, obligationsResponse, cardsResponse, goalsResponse] = await Promise.all([
    supabase.from("income_sources").select("*").eq("user_id", userId),
    supabase.from("obligation_entries").select("*").eq("user_id", userId),
    supabase.from("credit_cards").select("*").eq("user_id", userId),
    supabase.from("goals").select("*").eq("user_id", userId),
  ]);

  if (incomeResponse.error) console.warn("Supabase income source load failed", incomeResponse.error);
  if (obligationsResponse.error) console.warn("Supabase obligations load failed", obligationsResponse.error);
  if (cardsResponse.error) console.warn("Supabase credit cards load failed", cardsResponse.error);
  if (goalsResponse.error) console.warn("Supabase goals load failed", goalsResponse.error);

  const data: UserOwnedData = {
    ...userDataFromProfile(profileFromSupabaseRow(profileRow, fallbackEmail)),
    incomeSources: (incomeResponse.data || []).map((row) => mapSupabaseIncomeSource(row as Record<string, unknown>)),
    obligationEntries: (obligationsResponse.data || []).map((row) => mapSupabaseObligation(row as Record<string, unknown>)),
    creditCards: (cardsResponse.data || []).map((row) => mapSupabaseCreditCard(row as Record<string, unknown>)),
    goals: (goalsResponse.data || []).map((row) => mapSupabaseGoal(row as Record<string, unknown>)),
  };

  const quickSetupCompleted = profileRow.quick_setup_completed === true || Boolean(profileRow.quick_setup_completed_at) || hasBasicFinancialPicture(data);
  const quickSetupSkipped = profileRow.quick_setup_skipped === true;
  return { data, quickSetupCompleted, quickSetupSkipped };
}

async function updateSupabaseQuickSetupStatus(userId: string, status: "completed" | "skipped") {
  if (!supabase) return;
  const now = new Date().toISOString();
  const payload =
    status === "completed"
      ? { quick_setup_completed: true, quick_setup_skipped: false, quick_setup_completed_at: now, updated_at: now }
      : { quick_setup_skipped: true, updated_at: now };
  const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
  if (error) console.warn("Supabase quick setup status update failed. Apply the latest schema if quick setup columns are missing.", error);
}

async function saveQuickSetupDataToSupabase(userId: string, data: UserOwnedData) {
  if (!supabase) return;
  const quickIncomeNotes = ["Added from one minute setup."];
  const quickCardNotes = ["Added from one minute setup. Add balance later for better insights."];
  const quickObligationNotes = ["Added from one minute setup."];
  const quickGoalNotes = ["Primary goal from one minute setup.", "Flagged as important during one minute setup."];

  await Promise.all([
    supabase.from("income_sources").delete().eq("user_id", userId).in("notes", quickIncomeNotes),
    supabase.from("credit_cards").delete().eq("user_id", userId).in("notes", quickCardNotes),
    supabase.from("obligation_entries").delete().eq("user_id", userId).in("notes", quickObligationNotes),
    supabase.from("goals").delete().eq("user_id", userId).in("notes", quickGoalNotes),
  ]);

  const quickIncome = data.incomeSources.filter((income) => quickIncomeNotes.includes(income.notes || ""));
  const quickCards = data.creditCards.filter((card) => quickCardNotes.includes(card.notes || ""));
  const quickObligations = data.obligationEntries.filter((obligation) => quickObligationNotes.includes(obligation.notes));
  const quickGoals = data.goals.filter((goal) => quickGoalNotes.includes(goal.notes));

  const insertResults = await Promise.all([
    quickIncome.length
      ? supabase.from("income_sources").insert(quickIncome.map((income) => ({
          user_id: userId,
          income_name: income.name,
          income_amount: income.amount,
          income_type: income.type,
          expected_month: income.expectedMonth || null,
          guaranteed: income.guaranteed ?? null,
          recurring: income.recurring ?? true,
          allocation: income.allocation || null,
          notes: income.notes || null,
        })))
      : Promise.resolve({ error: null }),
    quickCards.length
      ? supabase.from("credit_cards").insert(quickCards.map((card) => ({
          user_id: userId,
          card_name: card.cardName,
          provider: card.provider,
          credit_limit: card.creditLimit,
          current_balance: card.currentBalance,
          minimum_payment_due: card.minimumPaymentDue,
          statement_total_due: card.statementTotalDue,
          due_date: card.dueDate,
          apr_or_profit_rate: card.aprOrProfitRate,
          notes: card.notes,
        })))
      : Promise.resolve({ error: null }),
    quickObligations.length
      ? supabase.from("obligation_entries").insert(quickObligations.map((obligation) => ({
          user_id: userId,
          obligation_name: obligation.name,
          monthly_amount: obligation.monthlyAmount,
          category: obligation.category,
          due_day: obligation.dueDay,
          is_recurring: obligation.isRecurring,
          frequency: obligation.frequency,
          due_date: obligation.dueDate || null,
          start_date: obligation.startDate || null,
          end_date: obligation.endDate || null,
          allocation_method: obligation.allocationMethod,
          saved_amount: obligation.savedAmount,
          notes: obligation.notes,
        })))
      : Promise.resolve({ error: null }),
    quickGoals.length
      ? supabase.from("goals").insert(quickGoals.map((goal) => ({
          user_id: userId,
          name: goal.name,
          goal_type: goal.type,
          target_amount: goal.targetAmount,
          current_amount: goal.currentAmount,
          target_date: goal.targetDate || null,
          priority: goal.priority,
          notes: goal.notes,
        })))
      : Promise.resolve({ error: null }),
  ]);

  insertResults.forEach((result) => {
    if (result.error) console.warn("Supabase quick setup data save failed", result.error);
  });
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

function findRegisteredBetaUser(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const user = readBetaUsersRegistry().find((item) => item.normalizedEmail === normalizedEmail && item.deleted !== true && item.status !== "Deleted");

  if (typeof window !== "undefined") {
    console.info(`duplicate email source = users registry; blocking source = ${user ? "users registry" : "none"}`);
  }

  return user;
}

function upsertRegisteredBetaUser(user: BetaRegisteredUser) {
  const users = readBetaUsersRegistry();
  const normalizedEmail = user.normalizedEmail || normalizeEmail(user.email);
  const nextUser = { ...user, normalizedEmail };
  const existingIndex = users.findIndex((item) => item.normalizedEmail === normalizedEmail);

  if (existingIndex >= 0) {
    users[existingIndex] = nextUser;
  } else {
    users.push(nextUser);
  }

  writeBetaUsersRegistry(users);
}

function hasOwnedData(data: UserOwnedData) {
  return Boolean(
    data.profile.email ||
      data.profile.fullName ||
      data.incomeSources.length ||
      data.obligationEntries.length ||
      data.creditCards.length ||
      data.goals.length ||
      data.debts.length ||
      data.leads.length,
  );
}

function hasBasicFinancialPicture(data: UserOwnedData) {
  return Boolean(data.incomeSources.length || data.obligationEntries.length || data.creditCards.length || data.goals.length);
}

function unknownRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function safeJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function summarizeSupabaseUser(user: unknown) {
  if (!user) return null;
  const record = unknownRecord(user);
  return {
    id: record.id,
    email: record.email,
    role: record.role,
    aud: record.aud,
    created_at: record.created_at,
    confirmed_at: record.confirmed_at,
    email_confirmed_at: record.email_confirmed_at,
    last_sign_in_at: record.last_sign_in_at,
  };
}

function summarizeSupabaseSession(session: unknown) {
  if (!session) return null;
  const record = unknownRecord(session);
  return {
    present: true,
    token_type: record.token_type,
    expires_at: record.expires_at,
    expires_in: record.expires_in,
    user: summarizeSupabaseUser(record.user),
    access_token: record.access_token ? "<redacted>" : null,
    refresh_token: record.refresh_token ? "<redacted>" : null,
  };
}

function summarizeSupabaseError(error: unknown) {
  if (!error) return { code: "", message: "", status: "" };
  const record = unknownRecord(error);
  return {
    code: String(record.code || record.name || ""),
    message: String(record.message || error),
    status: String(record.status || ""),
  };
}

function pickColumn(columns: string[], candidates: string[]) {
  const normalizedCandidates = candidates.map(normalizeKey);
  return columns.find((column) => {
    const normalizedColumn = normalizeKey(column);
    return normalizedCandidates.includes(normalizedColumn) || normalizedCandidates.some((candidate) => normalizedColumn.includes(candidate));
  }) || "";
}

type AppFlow = "app" | "register" | "login" | "onboarding" | "quickSetup";

type RegistrationForm = {
  fullName: string;
  mobile: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type RegistrationDraft = Pick<RegistrationForm, "fullName" | "mobile" | "email"> & {
  registrationSuccess: boolean;
};

type OnboardingForm = {
  existingLoans: number;
  creditCards: number;
  monthlyNetSalary: number;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowance: number;
  otherIncome: number;
  annualBonus: number;
  annualBonusMonth: string;
  annualBonusGuaranteed: boolean;
};

type OnboardingMode = "quick" | "full";

type QuickSetupGoal = "Emergency Fund" | "Pay Off Debt" | "Buy Something Important" | "Travel" | "School Fees" | "Other";

type QuickSetupForm = {
  monthlyIncome: number;
  creditCards: "none" | "one" | "multiple";
  hasMonthlyObligations: boolean;
  monthlyObligationAmount: number;
  importantItems: string[];
  primaryGoal: QuickSetupGoal;
};

type OnboardingProgress = {
  userId?: string;
  email?: string;
  savedAt?: string;
  registration: Pick<RegistrationForm, "fullName" | "mobile" | "email"> & { registrationSuccess: boolean };
  onboarding: OnboardingForm;
  onboardingMode: OnboardingMode;
  onboardingStep: number;
  incomeEntryMode: "total" | "detailed";
  selectedChecklistItems: string[];
  selectedGoalStarters: GoalType[];
  profile: UserProfile;
};

type LoginForm = {
  email: string;
  password: string;
};

type ResetForm = {
  email: string;
};

type ImportPreview = {
  incomeSources: IncomeSource[];
  obligations: ObligationEntry[];
  creditCards: CreditCard[];
  goals: Goal[];
};

type SessionMode = "signedOut" | "real" | "demo";

type StoredSession = {
  mode: Exclude<SessionMode, "signedOut">;
  userId: string;
  authProvider?: "local-registration" | "supabase" | "demo";
  onboardingStatus?: "incomplete" | "complete";
  onboardingStep?: number;
  onboardingMode?: OnboardingMode;
};

type BetaRegisteredUser = {
  id: string;
  email: string;
  normalizedEmail: string;
  fullName: string;
  mobile: string;
  createdAt: string;
  lastLoginAt: string;
  status: "Active" | "Incomplete" | "Inactive" | "Deleted";
  deleted: boolean;
  onboardingStatus: "incomplete" | "complete";
  userType: "Real";
  passwordHash?: string;
};

type UserOwnedData = {
  profile: UserProfile;
  debts: Debt[];
  creditCards: CreditCard[];
  incomeSources: IncomeSource[];
  obligationEntries: ObligationEntry[];
  goals: Goal[];
  leads: Lead[];
};

type SupabaseProfileRow = {
  id: string;
  full_name?: string | null;
  mobile?: string | null;
  email?: string | null;
  country?: Country | null;
  city?: string | null;
  employer?: string | null;
  employment_sector?: EmploymentSector | null;
  marital_status?: MaritalStatus | null;
  quick_setup_completed?: boolean | null;
  quick_setup_skipped?: boolean | null;
  quick_setup_completed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type SupabaseOwnedDataResult = {
  data: UserOwnedData;
  quickSetupCompleted: boolean;
  quickSetupSkipped: boolean;
};

type SignupDiagnostic = {
  status: "idle" | "success" | "failed";
  email: string;
  user: string;
  session: string;
  errorCode: string;
  errorMessage: string;
  errorStatus: string;
  profileInsert: string;
};

type RegistrationClickDebug = {
  clicks: number;
  phase: string;
  lastValidation: string;
  lastError: string;
  timings: string[];
};

type ImportError = {
  section: string;
  message: string;
};

type ImportRawData = {
  incomeSources: Record<string, unknown>[];
  obligations: Record<string, unknown>[];
  creditCards: Record<string, unknown>[];
  goals: Record<string, unknown>[];
  columns: Record<keyof ImportPreview, string[]>;
};

type ImportMappings = {
  incomeSources: { name: string; type: string; amount: string };
  obligations: { name: string; category: string; amount: string; frequency: string; dueDate: string; startDate: string; endDate: string; allocationMethod: string; savedAmount: string; notes: string };
  creditCards: { cardName: string; provider: string; balance: string; limit: string; minimumPayment: string; statementTotal: string; dueDate: string; apr: string; notes: string };
  goals: { name: string; type: string; targetAmount: string; currentAmount: string; targetDate: string; priority: string; notes: string };
};

const emptyRegistration: RegistrationForm = {
  fullName: "",
  mobile: "",
  email: "",
  password: "",
  confirmPassword: "",
};

const emptyOnboarding: OnboardingForm = {
  existingLoans: 0,
  creditCards: 0,
  monthlyNetSalary: 0,
  basicSalary: 0,
  housingAllowance: 0,
  transportAllowance: 0,
  otherAllowance: 0,
  otherIncome: 0,
  annualBonus: 0,
  annualBonusMonth: "December",
  annualBonusGuaranteed: false,
};

const emptyLogin: LoginForm = {
  email: "",
  password: "",
};

const emptyReset: ResetForm = {
  email: "",
};

const emptySignupDiagnostic: SignupDiagnostic = {
  status: "idle",
  email: "",
  user: "Not attempted.",
  session: "Not attempted.",
  errorCode: "",
  errorMessage: "",
  errorStatus: "",
  profileInsert: "Not attempted.",
};

const emptyUserData: UserOwnedData = {
  profile: emptyProfile,
  debts: [],
  creditCards: [],
  incomeSources: [],
  obligationEntries: [],
  goals: [],
  leads: [],
};

const demoUserData: UserOwnedData = {
  profile: seedProfile,
  debts: seedDebts,
  creditCards: seedCreditCards,
  incomeSources: seedIncomeSources,
  obligationEntries: seedObligationEntries,
  goals: seedGoals,
  leads: [],
};

const emptyQuickSetup: QuickSetupForm = {
  monthlyIncome: 0,
  creditCards: "none",
  hasMonthlyObligations: false,
  monthlyObligationAmount: 0,
  importantItems: [],
  primaryGoal: "Emergency Fund",
};

const karimaDemoUserData: UserOwnedData = {
  profile: seedKarimaProfile,
  debts: seedKarimaDebts,
  creditCards: seedKarimaCreditCards,
  incomeSources: seedKarimaIncomeSources,
  obligationEntries: seedKarimaObligationEntries,
  goals: seedKarimaGoals,
  leads: [],
};

function getDemoUserData(persona?: string): UserOwnedData {
  return persona === "demo-karima" || persona === "karima" ? karimaDemoUserData : demoUserData;
}

const sessionStorageKey = "debtiq.session.v1";
const betaUsersRegistryStorageKey = "debtiq.users.registry.v1";
const registrationDraftStorageKey = "debtiq.registration.v1";
const userDataStoragePrefix = "debtiq.user.v1.";
const onboardingProgressStoragePrefix = "debtiq.onboarding.v1.";
const quickSetupDoneStoragePrefix = "debtiq.quickSetup.done.v1.";
const draftDataStoragePrefix = "debtiq.draft.v1.";
const themeStorageKey = "debtiq.theme.v1";
const languageStorageKey = "debtiq.language.v1";
const installDismissedStorageKey = "debtiq.install.dismissed.v1";
const pwaInstallPromptSeenStorageKey = "debtiq.pwa.installPromptSeen.v1";

const emptyImportMappings: ImportMappings = {
  incomeSources: { name: "", type: "", amount: "" },
  obligations: { name: "", category: "", amount: "", frequency: "", dueDate: "", startDate: "", endDate: "", allocationMethod: "", savedAmount: "", notes: "" },
  creditCards: { cardName: "", provider: "", balance: "", limit: "", minimumPayment: "", statementTotal: "", dueDate: "", apr: "", notes: "" },
  goals: { name: "", type: "", targetAmount: "", currentAmount: "", targetDate: "", priority: "", notes: "" },
};

const categoryAliases: Record<string, ObligationCategory> = {
  loan: "Loan",
  "قرض": "Loan",
  creditcard: "Credit Card",
  card: "Credit Card",
  "بطاقة": "Credit Card",
  education: "Education",
  school: "Education",
  "تعليم": "Education",
  housing: "Housing",
  rent: "Housing",
  "سكن": "Housing",
  children: "Children",
  child: "Children",
  "أبناء": "Children",
  "ابناء": "Children",
  domesticworker: "Domestic Worker",
  maid: "Domestic Worker",
  "خادمة": "Domestic Worker",
  vehicle: "Vehicle",
  car: "Vehicle",
  "سيارة": "Vehicle",
  insurance: "Insurance",
  "تأمين": "Insurance",
  "تامين": "Insurance",
  lifestyle: "Lifestyle",
  expenses: "Lifestyle",
  "نمط حياة": "Lifestyle",
  other: "Other",
  "أخرى": "Other",
  "اخرى": "Other",
};

function Field({
  label,
  value,
  onChange,
  type = "text",
  help,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  help?: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
      <span className="flex items-center gap-1.5">
        {label}
        {help && <HelpTip text={help} />}
      </span>
      <input
        className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-ink outline-none transition focus:border-mint dark:border-white/10 dark:bg-white/5 dark:text-white"
        min={type === "number" ? 0 : undefined}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={(event) => {
          if (type === "number" && Number(value) === 0) event.currentTarget.select();
        }}
      />
    </label>
  );
}

function HelpTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <Info size={14} className="text-slate-400" aria-hidden="true" />
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 text-xs font-semibold leading-5 text-slate-700 shadow-lg group-hover:block dark:border-white/10 dark:bg-slate-950 dark:text-slate-200">
        {text}
      </span>
    </span>
  );
}

function SaudiPhoneField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
      {label}
      <span className="flex h-11 items-center overflow-hidden rounded-lg border border-slate-200 bg-white text-ink transition focus-within:border-mint dark:border-white/10 dark:bg-white/5 dark:text-white">
        <span className="grid h-full place-items-center border-r border-slate-200 px-3 text-sm font-black text-slate-500 dark:border-white/10 dark:text-slate-300">+966</span>
        <input
          className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
          inputMode="tel"
          value={value.replace(/^\+966/, "").replace(/^0/, "")}
          onChange={(event) => onChange(normalizeSaudiMobile(event.target.value))}
          placeholder="5xxxxxxxx"
        />
      </span>
    </label>
  );
}

function PasswordField({
  label,
  value,
  visible,
  onChange,
  onToggle,
}: {
  label: string;
  value: string;
  visible: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
      {label}
      <span className="flex h-11 items-center rounded-lg border border-slate-200 bg-white text-ink transition focus-within:border-mint dark:border-white/10 dark:bg-white/5 dark:text-white">
        <input
          className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="grid size-10 place-items-center text-slate-500 dark:text-slate-300"
          onClick={onToggle}
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  help,
  getOptionLabel,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  help?: string;
  getOptionLabel?: (value: string) => string;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
      <span className="flex items-center gap-1.5">
        {label}
        {help && <HelpTip text={help} />}
      </span>
      <select
        className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-ink outline-none transition focus:border-mint dark:border-white/10 dark:bg-slate-900 dark:text-white"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>{getOptionLabel ? getOptionLabel(option) : option}</option>
        ))}
      </select>
    </label>
  );
}

function KpiCard({
  label,
  value,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200"
        : tone === "bad"
          ? "border-red-200 bg-red-50 text-red-800 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200"
          : "border-slate-200 bg-white text-ink dark:border-white/10 dark:bg-white/5 dark:text-white";

  return (
    <div className={`rounded-lg border p-4 shadow-sm ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
        <div className="grid size-9 place-items-center rounded-lg bg-white/70 dark:bg-white/10">{icon}</div>
      </div>
      <p className="mt-3 text-2xl font-bold">{value}</p>
    </div>
  );
}

export default function Home() {
  const pathname = usePathname();
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(true);
  const [language, setLanguage] = useState<"en" | "ar">("ar");
  const [profile, setProfile] = useState<UserProfile>(emptyProfile);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [obligationEntries, setObligationEntries] = useState<ObligationEntry[]>([]);
  const [offers] = useState<Offer[]>(seedOffers);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [active, setActive] = useState("dashboard");
  const [flow, setFlow] = useState<AppFlow>("app");
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingAction, setOnboardingAction] = useState("");
  const [onboardingDebug, setOnboardingDebug] = useState({
    lastAction: "initial",
    lastValidation: "not-run",
    generationStatus: "idle",
  });
  const [lastOnboardingError, setLastOnboardingError] = useState("");
  const [lastOnboardingErrorStack, setLastOnboardingErrorStack] = useState("");
  const [stepOneActionDebug, setStepOneActionDebug] = useState({
    clicked: "no",
    validation: "not-run",
    lastError: "none",
  });
  const [debugOnboarding, setDebugOnboarding] = useState(false);
  const [registration, setRegistration] = useState<RegistrationForm>(emptyRegistration);
  const [login, setLogin] = useState<LoginForm>(emptyLogin);
  const [reset, setReset] = useState<ResetForm>(emptyReset);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [skipEmployer, setSkipEmployer] = useState(false);
  const [incomeEntryMode, setIncomeEntryMode] = useState<"total" | "detailed">("total");
  const [onboardingMode, setOnboardingMode] = useState<"quick" | "full">("quick");
  const [selectedChecklistItems, setSelectedChecklistItems] = useState<string[]>([]);
  const [selectedGoalStarters, setSelectedGoalStarters] = useState<GoalType[]>([]);
  const [onboarding, setOnboarding] = useState<OnboardingForm>(emptyOnboarding);
  const [quickSetup, setQuickSetup] = useState<QuickSetupForm>(emptyQuickSetup);
  const [quickSetupStep, setQuickSetupStep] = useState(0);
  const [quickSetupSummary, setQuickSetupSummary] = useState("");
  const [authError, setAuthError] = useState("");
  const [consentOffer, setConsentOffer] = useState<Offer | null>(null);
  const [consent, setConsent] = useState(false);
  const [scenarioExtraIncome, setScenarioExtraIncome] = useState(0);
  const [scenarioBonus, setScenarioBonus] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importErrors, setImportErrors] = useState<ImportError[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const [importSummary, setImportSummary] = useState("");
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [importRawData, setImportRawData] = useState<ImportRawData | null>(null);
  const [importMappings, setImportMappings] = useState<ImportMappings>(emptyImportMappings);
  const [importMode, setImportMode] = useState<"replace" | "merge">("replace");
  const [importDuplicateWarnings, setImportDuplicateWarnings] = useState<string[]>([]);
  const [sessionMode, setSessionMode] = useState<SessionMode>("signedOut");
  const [currentUserId, setCurrentUserId] = useState("");
  const [hasHydratedSession, setHasHydratedSession] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [showFullForecast, setShowFullForecast] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [showDraftRecovery, setShowDraftRecovery] = useState(false);
  const [draftRecoveryData, setDraftRecoveryData] = useState<UserOwnedData | null>(null);
  const [sessionStatus, setSessionStatus] = useState("Sign in or create an account to use your own DebtIQ workspace.");
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [installNotice, setInstallNotice] = useState("");
  const [pwaInstallPromptSeen, setPwaInstallPromptSeen] = useState(false);
  const [isIosDevice, setIsIosDevice] = useState(false);
  const [isStandaloneApp, setIsStandaloneApp] = useState(false);
  const [supabaseHealth, setSupabaseHealth] = useState<SupabaseHealthCheck>({
    success: false,
    getSession: { success: false, message: "Not checked yet." },
    getUser: { success: false, message: "Not checked yet." },
    request: { endpoint: "Not checked yet.", authMethod: "Not checked yet.", headersSent: [] },
    message: "Not checked yet.",
  });
  const [supabaseHealthChecked, setSupabaseHealthChecked] = useState(false);
  const [signupDiagnostic, setSignupDiagnostic] = useState<SignupDiagnostic>(emptySignupDiagnostic);
  const [registrationAction, setRegistrationAction] = useState("");
  const [registrationSuccessMessage, setRegistrationSuccessMessage] = useState("");
  const [registrationClickDebug, setRegistrationClickDebug] = useState<RegistrationClickDebug>({
    clicks: 0,
    phase: "idle",
    lastValidation: "not-run",
    lastError: "none",
    timings: [],
  });
  const t = translations[language];
  const themeWriteReadyRef = useRef(false);
  const onboardingProcessingRef = useRef(false);
  const registrationProcessingRef = useRef(false);
  const categoryLabel = (category: string) => t.categories[category as ObligationCategory] || category;
  const maritalStatusLabel = (status: string) => {
    if (language !== "ar") return status;
    const labels: Record<MaritalStatus, string> = {
      Single: "أعزب",
      Married: "متزوج",
      Divorced: "مطلق",
      Widowed: "أرمل",
      "Prefer not to say": "لا أرغب بالإجابة",
    };
    return labels[status as MaritalStatus] || status;
  };
  const employmentSectorLabel = (sector: string) => {
    if (language !== "ar") return sector;
    const labels: Record<EmploymentSector, string> = {
      Government: "حكومي",
      "Private Sector": "قطاع خاص",
      Military: "قطاع عسكري",
      "Semi-Government": "شبه حكومي",
      "Self-Employed": "عمل حر",
      Retired: "متقاعد",
      Student: "طالب",
      "Prefer not to say": "لا أرغب بالإجابة",
      Other: "أخرى",
    };
    return labels[sector as EmploymentSector] || sector;
  };
  const countryLabel = (country: string) => {
    if (language !== "ar") return country;
    const labels: Record<Country, string> = {
      "Saudi Arabia": "السعودية",
      UAE: "الإمارات",
      Kuwait: "الكويت",
      Bahrain: "البحرين",
      Qatar: "قطر",
      Oman: "عمان",
      Other: "أخرى",
    };
    return labels[country as Country] || country;
  };
  const cityLabel = (city: string) => {
    if (language !== "ar") return city;
    const labels: Record<string, string> = {
      Riyadh: "الرياض",
      Jeddah: "جدة",
      Makkah: "مكة",
      Madinah: "المدينة",
      Dammam: "الدمام",
      Khobar: "الخبر",
      Dhahran: "الظهران",
      Jubail: "الجبيل",
      Abha: "أبها",
      Tabuk: "تبوك",
      Hail: "حائل",
      "Al Ahsa": "الأحساء",
      Other: "أخرى",
    };
    return labels[city] || city;
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedTheme = window.localStorage.getItem(themeStorageKey);
    if (storedTheme === "light") setDarkMode(false);
    if (storedTheme === "dark") setDarkMode(true);
    const storedLanguage = window.localStorage.getItem(languageStorageKey);
    if (storedLanguage === "en" || storedLanguage === "ar") setLanguage(storedLanguage);
    setPwaInstallPromptSeen(window.localStorage.getItem(pwaInstallPromptSeenStorageKey) === "1");
  }, []);

  useEffect(() => {
    let mounted = true;
    testSupabaseAuthConnection().then((result) => {
      if (!mounted) return;
      setSupabaseHealth(result);
      setSupabaseHealthChecked(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDebugOnboarding(new URLSearchParams(window.location.search).get("debugOnboarding") === "1");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!themeWriteReadyRef.current) {
      themeWriteReadyRef.current = true;
      return;
    }
    window.localStorage.setItem(themeStorageKey, darkMode ? "dark" : "light");
  }, [darkMode]);

  function toggleLanguage() {
    setLanguage((current) => {
      const nextLanguage = current === "en" ? "ar" : "en";
      if (typeof window !== "undefined") window.localStorage.setItem(languageStorageKey, nextLanguage);
      return nextLanguage;
    });
  }
  const bonusAllocationLabel = (allocation: string) => {
    if (language !== "ar") return allocation;
    const labels: Record<BonusAllocation, string> = {
      "Allocate to financial goals": "تخصيصه للأهداف المالية",
      "Pay off a credit card": "سداد بطاقة ائتمانية",
      "Pay off a loan": "سداد قرض",
      "Emergency fund": "صندوق الطوارئ",
      "School fees / major obligation": "رسوم المدارس أو التزامات كبيرة",
      "Keep unallocated for now": "تركه بدون تخصيص الآن",
      "Custom allocation": "تخصيص مخصص",
    };
    return labels[allocation as BonusAllocation] || allocation;
  };
  const skipDirtyRef = useRef(true);
  const pendingActionRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then((registration) => registration.update()).catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsStandaloneApp(standalone);
    setIsIosDevice(isiOS);
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      const dismissed = window.localStorage.getItem(installDismissedStorageKey) === "1" || window.localStorage.getItem(pwaInstallPromptSeenStorageKey) === "1";
      setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
      if (!dismissed && !standalone) setShowInstallPrompt(true);
    };
    const handleAppInstalled = () => {
      setIsStandaloneApp(true);
      setShowInstallPrompt(false);
      setDeferredInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  function applyUserData(data: UserOwnedData) {
    const normalizedData = normalizeUserData(data);
    skipDirtyRef.current = true;
    setProfile(normalizedData.profile);
    setDebts(normalizedData.debts);
    setCreditCards(normalizedData.creditCards);
    setIncomeSources(normalizedData.incomeSources);
    setObligationEntries(normalizedData.obligationEntries);
    setGoals(normalizedData.goals);
    setLeads(normalizedData.leads);
  }

  function currentUserData(): UserOwnedData {
    return {
      profile,
      debts,
      creditCards,
      incomeSources,
      obligationEntries,
      goals,
      leads,
    };
  }

  function validationMessage(english: string, arabic: string) {
    return language === "ar" ? arabic : english;
  }

  function validateFinancialData(data: UserOwnedData) {
    if (data.profile.email && !isValidEmail(data.profile.email)) {
      return validationMessage("Enter a valid email address.", "الرجاء إدخال بريد إلكتروني صحيح.");
    }

    if (data.profile.mobile && !isValidSaudiMobile(data.profile.mobile)) {
      return validationMessage("Enter a valid Saudi mobile number.", "الرجاء إدخال رقم جوال سعودي صحيح.");
    }

    if (hasNegativeAmounts(data.incomeSources as unknown as Array<Record<string, unknown>>, ["amount"])) {
      return validationMessage("Income amounts cannot be negative.", "لا يمكن أن تكون مبالغ الدخل سالبة.");
    }

    const invalidBonus = data.incomeSources.find((income) => isAnnualBonusIncome(income) && income.amount > 0 && !income.expectedMonth);
    if (invalidBonus) {
      return validationMessage("Select an expected month for bonus income.", "اختر الشهر المتوقع للبونص.");
    }

    const invalidObligation = data.obligationEntries.find((obligation) => {
      const frequencyValid = obligation.frequency === "Monthly" || obligation.frequency === "One-Time" || obligation.frequency === "Annual";
      const allocationValid =
        obligation.allocationMethod === "Count full amount only in due month" ||
        obligation.allocationMethod === "Spread amount monthly until due date";
      const needsDueDate = obligation.frequency === "One-Time" || obligation.frequency === "Annual" || obligation.allocationMethod === "Spread amount monthly until due date";
      const dueDateValid = !needsDueDate || isValidDateString(obligation.dueDate);
      const startEndValid = !obligation.startDate || !obligation.endDate || new Date(obligation.endDate) >= new Date(obligation.startDate);
      return obligation.monthlyAmount <= 0 || !frequencyValid || !allocationValid || !dueDateValid || !startEndValid || obligation.savedAmount < 0;
    });
    if (invalidObligation) {
      return validationMessage("Check obligation amount, frequency, dates, and allocation method.", "راجع مبلغ الالتزام والتكرار والتواريخ وطريقة التوزيع.");
    }

    const invalidCard = data.creditCards.find((card) =>
      card.creditLimit <= 0 ||
      card.currentBalance < 0 ||
      card.minimumPaymentDue < 0 ||
      card.statementTotalDue < 0 ||
      card.aprOrProfitRate < 0 ||
      (!!card.dueDate && !isValidDateString(card.dueDate))
    );
    if (invalidCard) {
      return validationMessage("Check credit card limit, balance, payments, and due date.", "راجع حد البطاقة والرصيد والمدفوعات وتاريخ الاستحقاق.");
    }

    const invalidGoal = data.goals.find((goal) => goal.targetAmount <= 0 || goal.currentAmount < 0 || (!!goal.targetDate && !isValidDateString(goal.targetDate)));
    if (invalidGoal) {
      return validationMessage("Goal target amount must be positive and dates must be valid.", "يجب أن يكون مبلغ الهدف أكبر من صفر وأن تكون التواريخ صحيحة.");
    }

    return "";
  }

  function saveUserData(data = currentUserData(), status = "Saved successfully") {
    if (sessionMode !== "real" || !currentUserId) return;
    const validationError = validateFinancialData(data);
    if (validationError) {
      setAuthError(validationError);
      setSaveStatus(validationError);
      return;
    }
    const storedSession = readJson<StoredSession | null>(sessionStorageKey, null);
    const authProvider = storedSession?.mode === "real" && storedSession.userId === currentUserId ? storedSession.authProvider : "local-registration";
    writeJson(userStorageKey(currentUserId), data);
    writeJson(sessionStorageKey, {
      ...storedSession,
      mode: "real",
      userId: currentUserId,
      authProvider: authProvider || "local-registration",
    } satisfies StoredSession);
    removeStoredItem(draftStorageKey(currentUserId));
    skipDirtyRef.current = true;
    setHasUnsavedChanges(false);
    setAuthError("");
    setSaveStatus(status);
    window.setTimeout(() => setSaveStatus(""), 2500);
  }

  function requestUnsavedAction(action: () => void) {
    if (!hasUnsavedChanges) {
      action();
      return;
    }
    pendingActionRef.current = action;
    setShowUnsavedDialog(true);
  }

  function continuePendingActionAfterSave() {
    saveUserData(undefined, t.common.savedSuccessfully);
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setShowUnsavedDialog(false);
    action?.();
  }

  function leavePendingActionAnyway() {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setShowUnsavedDialog(false);
    setHasUnsavedChanges(false);
    action?.();
  }

  async function installApp() {
    if (isStandaloneApp || isIosDevice) return;
    if (typeof window !== "undefined") window.localStorage.setItem(pwaInstallPromptSeenStorageKey, "1");
    setPwaInstallPromptSeen(true);
    setShowInstallPrompt(false);
    setInstallNotice(validationMessage("If DebtIQ is already on your home screen, you do not need to add it again.", "إذا كان التطبيق موجوداً على الشاشة الرئيسية، لا تحتاج لإضافته مرة أخرى."));
    if (!deferredInstallPrompt) {
      return;
    }
    await deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice.catch(() => ({ outcome: "dismissed" as const, platform: "" }));
    setDeferredInstallPrompt(null);
    setShowInstallPrompt(false);
  }

  function dismissInstallPrompt() {
    setShowInstallPrompt(false);
    setInstallNotice(validationMessage("If DebtIQ is already on your home screen, you do not need to add it again.", "إذا كان التطبيق موجوداً على الشاشة الرئيسية، لا تحتاج لإضافته مرة أخرى."));
    if (typeof window !== "undefined") {
      window.localStorage.setItem(installDismissedStorageKey, "1");
      window.localStorage.setItem(pwaInstallPromptSeenStorageKey, "1");
    }
    setPwaInstallPromptSeen(true);
  }

  function navigateActive(nextActive: string) {
    requestUnsavedAction(() => setActive(nextActive));
  }

  function getNextOnboardingStep(step = onboardingStep) {
    if (step <= 0) return 1;
    return Math.min(4, step + 1);
  }

  function getPreviousOnboardingStep(step = onboardingStep) {
    if (step <= 1) return 1;
    return Math.max(1, step - 1);
  }

  function validateStepOne() {
    const amounts = [
      onboarding.monthlyNetSalary,
      onboarding.basicSalary,
      onboarding.housingAllowance,
      onboarding.transportAllowance,
      onboarding.otherAllowance,
      onboarding.otherIncome,
      onboarding.annualBonus,
    ];
    if (amounts.some((amount) => Number.isNaN(amount) || amount < 0)) {
      return validationMessage("Step 1 amounts must be valid and cannot be negative.", "يجب أن تكون مبالغ الخطوة الأولى صحيحة وغير سالبة.");
    }
    return "";
  }

  function writeOnboardingCheckpointSafely(nextStep: number) {
    if (typeof window === "undefined" || sessionMode !== "real" || !currentUserId) return "";
    try {
      const storedSession = readJson<StoredSession | null>(sessionStorageKey, null);
      window.localStorage.setItem(sessionStorageKey, JSON.stringify({
        ...storedSession,
        mode: "real",
        userId: currentUserId,
        authProvider: storedSession?.authProvider || "local-registration",
        onboardingStatus: "incomplete",
        onboardingStep: nextStep,
        onboardingMode,
      } satisfies StoredSession));
      window.localStorage.setItem(onboardingProgressStorageKey(currentUserId), JSON.stringify({
        userId: currentUserId,
        email: normalizeEmail(profile.email || registration.email),
        savedAt: new Date().toISOString(),
        registration: {
          fullName: profile.fullName || registration.fullName,
          mobile: profile.mobile || registration.mobile,
          email: profile.email || registration.email,
          registrationSuccess: true,
        },
        onboarding,
        onboardingMode,
        onboardingStep: nextStep,
        incomeEntryMode,
        selectedChecklistItems,
        selectedGoalStarters,
        profile,
      } satisfies OnboardingProgress));
      return "";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("Recovered while writing onboarding checkpoint", error);
      return validationMessage(`Recovered from local storage issue: ${message}`, `تم تجاوز مشكلة في التخزين المحلي: ${message}`);
    }
  }

  function moveOnboardingStep(step: number, action: string) {
    if (onboardingProcessingRef.current) return;
    const safeStep = Math.max(0, Math.min(4, step));
    setOnboardingAction(action);
    setAuthError("");
    setLastOnboardingError("");
    setOnboardingDebug((current) => ({ ...current, lastAction: action, lastValidation: `next-step:${safeStep}`, generationStatus: "idle" }));
    setOnboardingStep(safeStep);
    window.setTimeout(() => setOnboardingAction(""), 250);
  }

  function handleContinueStep() {
    try {
      if (onboardingStep === 1) {
        setStepOneActionDebug({ clicked: "yes", validation: "running", lastError: "none" });
        setOnboardingAction("continue-step-1");
        const validationError = validateStepOne();
        if (validationError) {
          setAuthError(validationError);
          setStepOneActionDebug({ clicked: "yes", validation: "failed", lastError: validationError });
          setOnboardingDebug((current) => ({ ...current, lastAction: "continue-step-1", lastValidation: "failed-step-1", generationStatus: "idle" }));
          setOnboardingAction("");
          return;
        }
        const storageRecovery = writeOnboardingCheckpointSafely(2);
        setAuthError(storageRecovery);
        setStepOneActionDebug({ clicked: "yes", validation: "passed", lastError: storageRecovery || "none" });
        setOnboardingDebug((current) => ({ ...current, lastAction: "continue-step-1", lastValidation: "passed-step-1", generationStatus: "idle" }));
        setOnboardingStep(2);
        window.setTimeout(() => setOnboardingAction(""), 250);
        return;
      }
      if (onboardingStep >= 4) {
        setAuthError(validationMessage("Use Generate Dashboard to complete setup.", "استخدم إنشاء لوحة التحكم لإكمال الإعداد."));
        setOnboardingDebug((current) => ({ ...current, lastAction: "continue", lastValidation: "blocked-final-step", generationStatus: "idle" }));
        return;
      }
      moveOnboardingStep(getNextOnboardingStep(), "continue");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack || "" : "";
      setLastOnboardingError(message);
      setLastOnboardingErrorStack(stack);
      setAuthError(message);
      setOnboardingAction("");
      onboardingProcessingRef.current = false;
    }
  }

  function handleBackStep() {
    moveOnboardingStep(getPreviousOnboardingStep(), "back");
  }

  function handleSkipOrAddLater() {
    if (onboardingStep >= 4) {
      handleCompleteOnboarding("skip-final");
      return;
    }
    moveOnboardingStep(getNextOnboardingStep(), "skip-add-later");
  }

  function handleCompleteOnboarding(action = "generate") {
    if (onboardingStep < 4) {
      setAuthError(validationMessage("Complete the current step first.", "أكمل الخطوة الحالية أولاً."));
      setOnboardingDebug((current) => ({ ...current, lastAction: action, lastValidation: "blocked-before-final-step", generationStatus: "idle" }));
      return;
    }
    completeOnboarding(action);
  }

  function resetOnboardingForCurrentUser() {
    const identityProfile = {
      ...emptyProfile,
      fullName: profile.fullName || registration.fullName,
      mobile: profile.mobile || registration.mobile,
      email: normalizeEmail(profile.email || registration.email),
    };
    applyUserData({ ...emptyUserData, profile: identityProfile });
    setOnboarding(emptyOnboarding);
    setOnboardingMode("quick");
    setIncomeEntryMode("total");
    setSelectedChecklistItems([]);
    setSelectedGoalStarters([]);
    setAuthError("");
    setLastOnboardingError("");
    setOnboardingDebug({ lastAction: "start-over", lastValidation: "reset", generationStatus: "idle" });
    setOnboardingStep(1);
    if (currentUserId) {
      const storedSession = readJson<StoredSession | null>(sessionStorageKey, null);
      writeJson(sessionStorageKey, {
        ...storedSession,
        mode: "real",
        userId: currentUserId,
        authProvider: storedSession?.authProvider || "local-registration",
        onboardingStatus: "incomplete",
        onboardingStep: 1,
        onboardingMode: "quick",
      } satisfies StoredSession);
      removeStoredItem(onboardingProgressStorageKey(currentUserId));
      removeStoredItem(draftStorageKey(currentUserId));
    }
  }

  function finalizeOnboardingCompletion(action: string) {
    const storedSession = readJson<StoredSession | null>(sessionStorageKey, null);
    const userId = currentUserId || storedSession?.userId || "";
    if (sessionMode === "real" && userId) {
      writeJson(sessionStorageKey, {
        ...storedSession,
        mode: "real",
        userId,
        authProvider: storedSession?.authProvider || "local-registration",
        onboardingStatus: "complete",
        onboardingStep: 4,
        onboardingMode,
      } satisfies StoredSession);
      removeStoredItem(onboardingProgressStorageKey(userId));
      removeStoredItem(draftStorageKey(userId));
      removeStoredItem(registrationDraftStorageKey);
      skipDirtyRef.current = true;
      setHasUnsavedChanges(false);
    }
    setSessionStatus("Onboarding complete: personalized dashboard generated");
    setOnboardingDebug((current) => ({ ...current, lastAction: action, lastValidation: "completion-written", generationStatus: "complete" }));
    setActive("dashboard");
    setFlow("app");
  }

  function forceCompleteOnboarding() {
    try {
      setOnboardingAction("force-complete");
      setLastOnboardingError("");
      finalizeOnboardingCompletion("force-complete");
      window.setTimeout(() => {
        setOnboardingAction("");
        onboardingProcessingRef.current = false;
      }, 100);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack || "" : "";
      setLastOnboardingError(`${message}${stack ? `\n${stack}` : ""}`);
      setAuthError(message);
      setOnboardingAction("");
      onboardingProcessingRef.current = false;
    }
  }

  function clearUserData() {
    applyUserData(emptyUserData);
    setOnboarding(emptyOnboarding);
    setOnboardingStep(0);
    setImportPreview(null);
    setImportErrors([]);
    setImportDuplicateWarnings([]);
    setImportSummary("");
    setImportWizardOpen(false);
  }

  useEffect(() => {
    const storedSession = readJson<StoredSession | null>(sessionStorageKey, null);
    const authMode = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("mode");
    if (authMode === "register") {
      if (storedSession?.mode === "real" && storedSession.userId) {
        removeStoredItem(onboardingProgressStorageKey(storedSession.userId));
        removeStoredItem(draftStorageKey(storedSession.userId));
      }
      removeStoredItem(sessionStorageKey);
      removeStoredItem(registrationDraftStorageKey);
      applyUserData(emptyUserData);
      setOnboarding(emptyOnboarding);
      setOnboardingMode("quick");
      setOnboardingStep(1);
      setImportPreview(null);
      setImportErrors([]);
      setImportDuplicateWarnings([]);
      setImportSummary("");
      setImportWizardOpen(false);
      setCurrentUserId("");
      setSessionMode("signedOut");
      setFlow("register");
      setActive("profile");
      setHasHydratedSession(true);
      return;
    }
    if (storedSession?.mode === "real" && storedSession.userId) {
      const registeredSessionUser = readBetaUsersRegistry().find((user) => user.id === storedSession.userId && user.deleted !== true && user.status !== "Deleted");
      const trustedProvider = storedSession.authProvider === "supabase" || (storedSession.authProvider === "local-registration" && Boolean(registeredSessionUser));
      if (!trustedProvider) {
        removeStoredItem(sessionStorageKey);
        applyUserData(emptyUserData);
        setOnboarding(emptyOnboarding);
        setOnboardingStep(0);
        setImportPreview(null);
        setImportErrors([]);
        setImportDuplicateWarnings([]);
        setImportSummary("");
        setImportWizardOpen(false);
        setCurrentUserId("");
        setSessionMode("signedOut");
        setSessionStatus("User login requires registration. Please register, use Try Demo or contact the DebtiQ team.");
        setFlow(authMode === "register" ? "register" : authMode === "login" ? "login" : "app");
        setActive("profile");
        setHasHydratedSession(true);
        return;
      }
      const data = readUserData(storedSession.userId);
      const draft = readJson<UserOwnedData | null>(draftStorageKey(storedSession.userId), null);
      const onboardingProgress = readJson<OnboardingProgress | null>(onboardingProgressStorageKey(storedSession.userId), null);
      const onboardingIncomplete = storedSession.onboardingStatus === "incomplete";
      const canResumeOnboarding = onboardingIncomplete && isOnboardingProgressOwnedBySession(onboardingProgress, storedSession, data);
      if (onboardingIncomplete && onboardingProgress && !canResumeOnboarding) {
        removeStoredItem(onboardingProgressStorageKey(storedSession.userId));
      }
      applyUserData(data);
      setCurrentUserId(storedSession.userId);
      setSessionMode("real");
      if (onboardingIncomplete) {
        if (canResumeOnboarding && onboardingProgress) {
          setRegistration((current) => ({
            ...current,
            fullName: onboardingProgress.registration.fullName,
            mobile: onboardingProgress.registration.mobile,
            email: onboardingProgress.registration.email,
          }));
          setOnboarding(onboardingProgress.onboarding);
          setOnboardingMode(onboardingProgress.onboardingMode);
          setOnboardingStep(onboardingProgress.onboardingStep);
          setIncomeEntryMode(onboardingProgress.incomeEntryMode);
          setSelectedChecklistItems(onboardingProgress.selectedChecklistItems);
          setSelectedGoalStarters(onboardingProgress.selectedGoalStarters);
          setProfile(onboardingProgress.profile);
        } else {
          setOnboardingMode(storedSession.onboardingMode || "quick");
          setOnboardingStep(1);
        }
        setSessionStatus("Continue setting up your financial profile");
        setFlow("onboarding");
        setActive("profile");
      } else {
        setSessionStatus(`Logged in as ${data.profile.email || storedSession.userId}`);
        if (!hasBasicFinancialPicture(data) && !readJson<boolean>(quickSetupDoneStorageKey(storedSession.userId), false)) {
          setQuickSetup(emptyQuickSetup);
          setQuickSetupStep(0);
          setQuickSetupSummary("");
          setFlow("quickSetup");
        } else {
          setFlow("app");
        }
        setActive("dashboard");
      }
      if (draft && hasOwnedData(draft)) {
        setDraftRecoveryData(draft);
        setShowDraftRecovery(true);
      }
    } else if (storedSession?.mode === "demo") {
      applyUserData(getDemoUserData(storedSession.userId));
      setCurrentUserId("");
      setSessionMode("demo");
      setSessionStatus("Demo Mode \u2014 sample data only");
      setFlow("app");
      setActive("dashboard");
    } else {
      const registrationDraft = readJson<RegistrationDraft | null>(registrationDraftStorageKey, null);
      if (registrationDraft) {
        setRegistration((current) => ({
          ...current,
          fullName: registrationDraft.fullName || "",
          mobile: registrationDraft.mobile || "",
          email: registrationDraft.email || "",
        }));
      }
      applyUserData(emptyUserData);
      setOnboarding(emptyOnboarding);
      setOnboardingStep(0);
      setImportPreview(null);
      setImportErrors([]);
      setImportDuplicateWarnings([]);
      setImportSummary("");
      setImportWizardOpen(false);
      setCurrentUserId("");
      setSessionMode("signedOut");
      setFlow(authMode === "register" ? "register" : authMode === "login" ? "login" : "app");
      setActive("profile");
    }
    setHasHydratedSession(true);
  }, []);

  useEffect(() => {
    if (!hasHydratedSession || sessionMode !== "real" || !currentUserId) return;
    if (skipDirtyRef.current) {
      skipDirtyRef.current = false;
      return;
    }
    setHasUnsavedChanges(true);
    setSaveStatus("");
    writeJson(draftStorageKey(currentUserId), {
      profile,
      debts,
      creditCards,
      incomeSources,
      obligationEntries,
      goals,
      leads,
    } satisfies UserOwnedData);
  }, [creditCards, currentUserId, debts, goals, hasHydratedSession, incomeSources, leads, obligationEntries, profile, sessionMode]);

  useEffect(() => {
    if (!hasHydratedSession || flow !== "register") return;
    writeJson(registrationDraftStorageKey, {
      fullName: registration.fullName,
      mobile: registration.mobile,
      email: registration.email,
      registrationSuccess: false,
    } satisfies RegistrationDraft);
  }, [flow, hasHydratedSession, registration.email, registration.fullName, registration.mobile]);

  useEffect(() => {
    if (!hasHydratedSession || flow !== "register" || registrationProcessingRef.current) return;
    setAuthError("");
    setRegistrationSuccessMessage("");
    setRegistrationClickDebug((current) => ({
      ...current,
      phase: current.phase === "processing" ? "idle" : current.phase,
      lastValidation: current.lastValidation === "failed" ? "corrected" : current.lastValidation,
      lastError: current.lastValidation === "failed" ? "none" : current.lastError,
    }));
  }, [
    flow,
    hasHydratedSession,
    registration.confirmPassword,
    registration.email,
    registration.fullName,
    registration.mobile,
    registration.password,
  ]);

  useEffect(() => {
    if (!hasHydratedSession || sessionMode !== "real" || !currentUserId || flow !== "onboarding") return;
    const storedSession = readJson<StoredSession | null>(sessionStorageKey, null);
    writeJson(sessionStorageKey, {
      mode: "real",
      userId: currentUserId,
      authProvider: storedSession?.authProvider || "local-registration",
      onboardingStatus: "complete",
      onboardingStep,
      onboardingMode,
    } satisfies StoredSession);
    writeJson(onboardingProgressStorageKey(currentUserId), {
      userId: currentUserId,
      email: normalizeEmail(profile.email || registration.email),
      savedAt: new Date().toISOString(),
      registration: {
        fullName: profile.fullName || registration.fullName,
        mobile: profile.mobile || registration.mobile,
        email: profile.email || registration.email,
        registrationSuccess: true,
      },
      onboarding,
      onboardingMode,
      onboardingStep,
      incomeEntryMode,
      selectedChecklistItems,
      selectedGoalStarters,
      profile,
    } satisfies OnboardingProgress);
  }, [
    currentUserId,
    flow,
    hasHydratedSession,
    incomeEntryMode,
    onboarding,
    onboardingMode,
    onboardingStep,
    profile,
    registration.email,
    registration.fullName,
    registration.mobile,
    selectedChecklistItems,
    selectedGoalStarters,
    sessionMode,
  ]);

  useEffect(() => {
    if (!hasHydratedSession || pathname !== "/" || sessionMode === "signedOut") return;
    router.replace("/app");
  }, [hasHydratedSession, pathname, router, sessionMode]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const monthlyIncomeSources = useMemo(
    () => incomeSources.filter((income) => !isAnnualBonusIncome(income) && income.recurring !== false),
    [incomeSources],
  );
  const annualBonusIncomeSources = useMemo(() => incomeSources.filter(isAnnualBonusIncome), [incomeSources]);
  const extraIncomeEvents = useMemo(() => incomeSources.filter((income) => isAnnualBonusIncome(income) || income.recurring === false), [incomeSources]);
  const snapshot = useMemo(() => calculateSnapshot(monthlyIncomeSources, debts, obligationEntries, creditCards), [monthlyIncomeSources, debts, obligationEntries, creditCards]);
  const showBetaSetupCard = sessionMode === "real" && monthlyIncomeSources.length === 0 && obligationEntries.length === 0 && creditCards.length === 0;
  const friendlyReminderExamples = language === "ar"
    ? ["رسوم المدارس؟", "عيد ميلاد الزوجة أو أحد الأبناء؟", "تأمين السيارة؟", "فاتورة الجوال أو الإنترنت؟", "إيجار أو صيانة البيت؟", "راتب العاملة أو تجديد الإقامة؟"]
    : ["School fees?", "Wife's or child's birthday?", "Car insurance?", "Mobile or internet bill?", "Home rent or maintenance?", "Domestic worker salary or renewal?"];
  const friendlyReminderCard = (
    <div className="friendly-reminder-card rounded-lg border border-mint/30 bg-mint/10 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-white text-xl shadow-sm dark:bg-white/10" aria-hidden="true">✨</div>
        <div className="min-w-0">
          <h3 className="text-lg font-black">{language === "ar" ? "هل نسينا شيئاً مهماً؟" : "Did we forget something important?"}</h3>
          <p className="mt-2 text-sm font-semibold leading-7 text-slate-600 dark:text-slate-200">
            {language === "ar"
              ? "أحياناً المشكلة ليست في الراتب، بل في الأشياء الصغيرة التي تفاجئنا آخر الشهر."
              : "Sometimes the issue is not the salary, but the small things that surprise us at the end of the month."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {friendlyReminderExamples.map((item) => (
              <span key={item} className="rounded-lg border border-white/60 bg-white/75 px-3 py-2 text-sm font-black text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-100">
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
  const matches = useMemo(
    () =>
      offers.filter(
        (offer) =>
          snapshot.totalIncome >= offer.minSalary &&
          snapshot.totalIncome <= offer.maxSalary &&
          snapshot.totalDebt >= offer.minDebt &&
          snapshot.totalDebt <= offer.maxDebt,
      ),
    [offers, snapshot.totalDebt, snapshot.totalIncome],
  );

  const scoreTone = snapshot.debtScore === "Green" ? "good" : snapshot.debtScore === "Yellow" ? "warn" : "bad";
  const monthlyGap = snapshot.cashFlow < 0 ? Math.abs(snapshot.cashFlow) : 0;
  const obligationPlan = obligationEntries.map((obligation) => {
    const dueDate = getObligationDueDate(obligation);
    const daysRemaining = Math.ceil((dueDate.getTime() - Date.now()) / 86400000);
    const monthsRemaining = getMonthsUntilObligationDue(obligation);
    const requiredMonthlySaving = getRequiredMonthlySaving(obligation);
    const remainingAmount = Math.max(obligation.monthlyAmount - (obligation.savedAmount || 0), 0);
    const monthlyImpact = getMonthlyObligationImpact(obligation);

    return {
      ...obligation,
      dueDate: isoDate(dueDate),
      daysRemaining,
      monthsRemaining,
      requiredMonthlySaving,
      remainingAmount,
      monthlyImpact,
    };
  });
  const recurringMonthlyObligations = obligationPlan
    .filter((obligation) => obligation.frequency === "Monthly")
    .reduce((total, obligation) => total + obligation.monthlyImpact, 0);
  const requiredMonthlySavings = obligationPlan
    .filter((obligation) => obligation.frequency !== "Monthly" && obligation.allocationMethod === "Spread amount monthly until due date")
    .reduce((total, obligation) => total + obligation.requiredMonthlySaving, 0);
  const upcomingOneTimeObligations = obligationPlan
    .filter((obligation) => obligation.frequency !== "Monthly")
    .sort((first, second) => first.daysRemaining - second.daysRemaining);
  const lifestyleExpenses = obligationEntries.filter((obligation) => obligation.category === "Lifestyle");
  const totalLifestyleExpenses = lifestyleExpenses.reduce((total, obligation) => total + getMonthlyObligationImpact(obligation), 0);
  const profileCompletionItems = [
    Boolean(profile.fullName && profile.mobile && profile.email && profile.country && profile.city && profile.maritalStatus && profile.employmentSector),
    monthlyIncomeSources.length > 0,
    obligationEntries.length > 0,
    creditCards.length > 0,
    goals.length > 0,
    lifestyleExpenses.length > 0,
    annualBonusIncomeSources.length > 0,
  ];
  const profileCompletionScore = Math.round((profileCompletionItems.filter(Boolean).length / profileCompletionItems.length) * 100);
  const lifestyleBudgetGuidance = [
    { name: "Groceries", current: lifestyleExpenses.find((item) => item.name === "Groceries")?.monthlyAmount || 0, suggested: snapshot.totalIncome * 0.12 },
    { name: "Fuel / Transportation", current: lifestyleExpenses.find((item) => item.name === "Fuel" || item.name === "Fuel / Transportation")?.monthlyAmount || 0, suggested: snapshot.totalIncome * 0.08 },
    { name: "Restaurants & Coffee", current: lifestyleExpenses.find((item) => item.name === "Restaurants & Coffee")?.monthlyAmount || 0, suggested: snapshot.totalIncome * 0.06 },
    { name: "Entertainment", current: lifestyleExpenses.find((item) => item.name === "Entertainment")?.monthlyAmount || 0, suggested: snapshot.totalIncome * 0.05 },
    { name: "Savings", current: Math.max(snapshot.availableCashFlow, 0), suggested: snapshot.totalIncome * 0.15 },
  ].filter(() => snapshot.totalIncome > 0).map((item) => {
    const lower = item.name.toLowerCase();
    const recommendation =
      item.current < item.suggested * 0.75
        ? language === "ar" ? `بند ${item.name} أقل من النطاق الإرشادي. ممتاز إذا كان هذا مناسباً لحياتك.` : `Your current ${lower} is below the suggested range. Keep it steady if this feels realistic.`
        : item.current > item.suggested * 1.25
          ? language === "ar" ? `بند ${item.name} أعلى من النطاق الإرشادي. قد يكون من الأفضل تخفيفه قليلاً.` : `Your current ${lower} is above the suggested range. Consider trimming this category gently.`
          : language === "ar" ? `بند ${item.name} ضمن النطاق الإرشادي.` : `Your current ${lower} is within the suggested range.`;

    return { ...item, recommendation };
  });
  const lifestyleWarnings = lifestyleBudgetGuidance
    .filter((item) => item.current > item.suggested * 1.25 && item.name !== "Savings")
    .map((item) => language === "ar" ? `قد يكون من الأفضل تخفيف بند ${item.name} قليلاً حسب دخلك.` : `Based on your income, your ${item.name.toLowerCase()} budget may benefit from a gentle trim.`);
  const topObligations = obligationEntries
    .map((obligation) => ({ label: obligation.name, value: getMonthlyObligationImpact(obligation) }))
    .filter((obligation) => obligation.value > 0)
    .sort((first, second) => second.value - first.value)
    .slice(0, 3);
  const obligationBreakdown = obligationCategories
    .map((category) => ({
      category,
      value: obligationEntries
        .filter((obligation) => obligation.category === category)
        .reduce((total, obligation) => total + getMonthlyObligationImpact(obligation), 0),
    }))
    .filter((item) => item.value > 0);
  const chartData = [
    { name: "Income", value: snapshot.totalIncome },
    { name: "Debt Pay", value: snapshot.debtInstallments },
    { name: "Obligations", value: snapshot.totalMonthlyObligations },
    { name: "Cash Flow", value: snapshot.cashFlow },
  ];
  const upcomingObligations = obligationPlan.sort((first, second) => first.daysRemaining - second.daysRemaining);
  const obligationsDue7 = upcomingObligations.filter((obligation) => obligation.daysRemaining <= 7).reduce((total, obligation) => total + obligation.monthlyImpact, 0);
  const obligationsDue30 = upcomingObligations.filter((obligation) => obligation.daysRemaining <= 30).reduce((total, obligation) => total + obligation.monthlyImpact, 0);
  const releaseInsights = obligationEntries
    .filter((obligation) => obligation.frequency === "Monthly" && obligation.endDate && obligation.monthlyAmount > 0)
    .map((obligation) => {
      const endDate = new Date(`${obligation.endDate}T00:00:00`);
      const today = new Date();
      const monthsRemaining = Math.max(0, (endDate.getFullYear() - today.getFullYear()) * 12 + endDate.getMonth() - today.getMonth());
      return { ...obligation, monthsRemaining };
    })
    .filter((obligation) => obligation.monthsRemaining > 0)
    .sort((first, second) => first.monthsRemaining - second.monthsRemaining)
    .slice(0, 3);
  const canCoverUpcoming = snapshot.availableCashFlow >= obligationsDue30;
  const creditCardStats = creditCards.map((card) => {
    const availableCredit = Math.max(card.creditLimit - card.currentBalance, 0);
    const utilization = card.creditLimit > 0 ? (card.currentBalance / card.creditLimit) * 100 : 0;
    const daysUntilDue = Math.ceil((new Date(card.dueDate).getTime() - Date.now()) / 86400000);
    const risk = utilization > 90 ? "Critical" : utilization >= 70 ? "High" : utilization >= 30 ? "Watch" : "Healthy";

    return { ...card, availableCredit, utilization, daysUntilDue, risk, isMaxedOut: utilization >= 95 };
  });
  const totalCreditCardBalance = creditCardStats.reduce((total, card) => total + card.currentBalance, 0);
  const totalMinimumPaymentsDue = creditCardStats.reduce((total, card) => total + card.minimumPaymentDue, 0);
  const highestUtilizationCard = [...creditCardStats].sort((first, second) => second.utilization - first.utilization)[0];
  const cardsDueSoon = creditCardStats.filter((card) => card.daysUntilDue >= 0 && card.daysUntilDue <= 7);
  const cardsAbove80 = creditCardStats.filter((card) => card.utilization > 80);
  const cardOpportunities = creditCardStats.some((card) => card.utilization > 70)
    ? ["Credit card consolidation", "Balance transfer", "Debt transfer", "Lower installment plan"]
    : [];
  const financialWarnings = [
    ...incomeSources
      .filter((income) => income.amount <= 0)
      .map((income) => `Income source "${income.name}" has ${currency.format(income.amount)} and may be mapped incorrectly.`),
    ...obligationEntries
      .filter((obligation) => obligation.monthlyAmount <= 0)
      .map((obligation) => `Obligation "${obligation.name}" has ${currency.format(obligation.monthlyAmount)} and may be mapped incorrectly.`),
    ...obligationPlan
      .filter((obligation) => obligation.frequency !== "Monthly" && obligation.allocationMethod === "Count full amount only in due month" && obligation.daysRemaining > 30)
      .map((obligation) => `${obligation.name} is a future ${obligation.frequency.toLowerCase()} obligation and is not counted as a monthly obligation until its due month.`),
    ...creditCardStats
      .filter((card) => card.creditLimit > 0 && card.currentBalance > card.creditLimit)
      .map((card) => `${card.cardName} is above its credit limit (${Math.round(card.utilization)}% utilization) and is Critical.`),
    ...creditCardStats
      .filter((card) => card.statementTotalDue > card.currentBalance)
      .map((card) => `${card.cardName} statement due is higher than current balance.`),
    ...creditCardStats
      .filter((card) => card.minimumPaymentDue > card.currentBalance)
      .map((card) => `${card.cardName} minimum payment is higher than current balance.`),
    ...creditCardStats
      .filter((card) => card.creditLimit <= 0)
      .map((card) => `${card.cardName} has an invalid credit limit.`),
    ...goals
      .filter((goal) => goal.currentAmount > goal.targetAmount)
      .map((goal) => `Goal "${goal.name}" current amount exceeds target amount.`),
    ...goals
      .filter((goal) => goal.type === "Pay Off Credit Card" && !goal.linkedCreditCardId)
      .map((goal) => `Goal "${goal.name}" is not linked to a credit card.`),
    ...goals
      .filter((goal) => goal.type === "Pay Off Debt" && !goal.linkedDebtId)
      .map((goal) => `Goal "${goal.name}" is not linked to a debt.`),
  ];
  const monthlyForecast = Array.from({ length: 13 }, (_, index) => {
    const month = addMonths(new Date(), index);
    const bonusesForMonth = annualBonusIncomeSources.filter((income) => getAnnualBonusMonth(income) === month.getMonth());
    const bonusForMonth = bonusesForMonth.reduce((total, income) => total + income.amount, 0);
    const goalBonusAllocation = bonusesForMonth
      .filter((income) => {
        const allocation = getBonusAllocation(income);
        return allocation === "Allocate to financial goals" || allocation === "Emergency fund";
      })
      .reduce((total, income) => total + income.amount, 0);
    const income = snapshot.totalIncome + bonusForMonth + scenarioExtraIncome + (index === 0 ? scenarioBonus : 0);
    const obligations = obligationEntries
      .filter((obligation) => obligation.category !== "Credit Card")
      .reduce((total, obligation) => total + getMonthlyObligationImpact(obligation, month), 0);
    const creditCardPayments = totalMinimumPaymentsDue;
    const availableBeforeGoals = income - obligations - creditCardPayments;
    const goalContributions = goals.length > 0 ? Math.max(0, Math.round(availableBeforeGoals * 0.25)) + goalBonusAllocation : 0;
    const net = availableBeforeGoals - goalContributions;
    const risk = net < 0 ? "Deficit" : net < income * 0.1 ? "Warning" : "Positive";

    return {
      month: monthFormatter.format(month),
      shortMonth: month.toLocaleString("en-US", { month: "short" }),
      income,
      obligations,
      creditCardPayments,
      goalContributions,
      net,
      risk,
      bonusForMonth,
      bonusAllocations: bonusesForMonth.map((income) => getBonusAllocation(income)),
      monthIndex: month.getMonth(),
    };
  });
  const positiveMonths = monthlyForecast.filter((month) => month.net >= 0).length;
  const negativeMonths = monthlyForecast.filter((month) => month.net < 0).length;
  const highRiskMonths = monthlyForecast.filter((month) => month.risk === "Deficit").length;
  const highestRiskMonth = [...monthlyForecast].sort((first, second) => first.net - second.net)[0];
  const largestUpcomingObligation =
    [...upcomingObligations.filter((obligation) => obligation.daysRemaining <= 30)].sort((first, second) => second.monthlyImpact - first.monthlyImpact)[0] ||
    [...upcomingObligations].sort((first, second) => second.monthlyAmount - first.monthlyAmount)[0];
  const averageGoalContribution = goals.length > 0 ? Math.max(0, Math.round(monthlyForecast.reduce((total, month) => total + month.goalContributions, 0) / monthlyForecast.length / goals.length)) : 0;
  const goalCompletionForecast = goals.map((goal) => {
    const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0);
    const bonusShare = goals.length > 0 ? scenarioBonus / goals.length : 0;
    const adjustedRemaining = Math.max(remaining - bonusShare, 0);
    const monthsRemaining = averageGoalContribution > 0 ? Math.ceil(adjustedRemaining / averageGoalContribution) : Number.POSITIVE_INFINITY;

    return {
      ...goal,
      monthlyContribution: averageGoalContribution,
      estimatedCompletion:
        monthsRemaining > 120
          ? language === "ar"
            ? "المساهمة الحالية منخفضة جداً ولا تسمح بتقدير تاريخ واقعي لتحقيق الهدف."
            : "Current contribution is too low to estimate a realistic completion date."
          : formatEstimatedMonth(monthsRemaining),
      monthsRemaining,
    };
  });
  const emergencyFundForecast = goalCompletionForecast.find((goal) => goal.type === "Emergency Fund");
  const cardBonusAllocationTotal = annualBonusIncomeSources
    .filter((income) => getBonusAllocation(income) === "Pay off a credit card")
    .reduce((total, income) => total + income.amount, 0);
  const debtFreeMonthlyPayment = debts.reduce((total, debt) => total + debt.monthlyInstallment, 0) + totalMinimumPaymentsDue + Math.max(0, scenarioExtraIncome * 0.25);
  const monthsUntilDebtFree = calculatePayoffMonths(snapshot.totalDebt, debtFreeMonthlyPayment, 8);
  const debtReductionForecast = monthlyForecast.reduce<{ month: string; debt: number }[]>((items, month, index) => {
    const previousDebt = index === 0 ? snapshot.totalDebt : items[index - 1].debt;
    const bonusDebtPayment = month.bonusAllocations.some((allocation) => allocation === "Pay off a loan" || allocation === "School fees / major obligation")
      ? annualBonusIncomeSources
          .filter((income) => getAnnualBonusMonth(income) === month.monthIndex)
          .filter((income) => {
            const allocation = getBonusAllocation(income);
            return allocation === "Pay off a loan" || allocation === "School fees / major obligation";
          })
          .reduce((total, income) => total + income.amount, 0)
      : 0;
    const payment = debts.reduce((total, debt) => total + debt.monthlyInstallment, 0) + month.creditCardPayments + Math.max(0, month.net * 0.2) + bonusDebtPayment;
    items.push({ month: month.shortMonth, debt: Math.max(0, previousDebt - payment) });
    return items;
  }, []);
  const goalCompletionChart = monthlyForecast.reduce<{ month: string; progress: number }[]>((items, month, index) => {
    const totalTarget = goals.reduce((total, goal) => total + goal.targetAmount, 0);
    const startingProgress = goals.reduce((total, goal) => total + goal.currentAmount, 0);
    const cumulativeContribution = monthlyForecast.slice(0, index + 1).reduce((total, item) => total + item.goalContributions, 0);
    const progress = totalTarget > 0 ? Math.min(100, Math.round(((startingProgress + cumulativeContribution) / totalTarget) * 100)) : 0;
    items.push({ month: month.shortMonth, progress });
    return items;
  }, []);
  const creditCardPayoffForecast = creditCardStats.map((card) => {
    const additionalPayment = creditCardStats.length > 0 ? Math.max(0, Math.round(monthlyForecast[0].net * 0.2 / creditCardStats.length)) : 0;
    const cardBonusShare = creditCardStats.length > 0 ? cardBonusAllocationTotal / creditCardStats.length : 0;
    const adjustedBalance = Math.max(0, card.currentBalance - cardBonusShare);
    const baseMonths = calculatePayoffMonths(adjustedBalance, card.minimumPaymentDue + additionalPayment, card.aprOrProfitRate);
    const extraMonths = calculatePayoffMonths(adjustedBalance, card.minimumPaymentDue + additionalPayment + 500, card.aprOrProfitRate);

    return {
      ...card,
      additionalPayment,
      estimatedPayoff: formatEstimatedMonth(baseMonths),
      monthsEarlierWithExtra500: Number.isFinite(baseMonths) && Number.isFinite(extraMonths) ? Math.max(0, baseMonths - extraMonths) : 0,
    };
  });
  const financialGapForecast = monthlyForecast
    .filter((month) => month.net < 0)
    .map((month) => ({
      ...month,
      largestObligation: largestUpcomingObligation,
      suggestedActions: ["Reduce obligations", "Delay low-priority goals", "Increase income"],
    }));
  const visibleMonthlyForecast = showFullForecast ? monthlyForecast : monthlyForecast.slice(0, 3);
  const recommendedEmergencySaving = Math.max(250, Math.round(Math.max(snapshot.availableCashFlow, snapshot.cashFlow, 0) * 0.2));
  const recommendationCards = [
    {
      title: language === "ar" ? "توصية صندوق الطوارئ" : "Emergency fund recommendation",
      body:
        !emergencyFundForecast
          ? language === "ar" ? "لم نضف صندوق طوارئ بعد. بداية بسيطة قد تكون كافية." : "No emergency fund is set yet. A small start can be enough."
          : snapshot.cashFlow > 0
          ? language === "ar" ? `حاول ادخار ${currency.format(recommendedEmergencySaving)} شهرياً في صندوق الطوارئ.` : `Try saving ${currency.format(recommendedEmergencySaving)} monthly in your emergency fund.`
          : language === "ar" ? "قد يكون من الأفضل ترتيب العجز الشهري أولاً، ثم العودة لصندوق الطوارئ." : "It may help to settle the monthly gap first, then return to emergency fund contributions.",
      tone: !emergencyFundForecast || snapshot.cashFlow <= 0 ? "warn" : "good",
    },
    {
      title: language === "ar" ? "تنبيه التزام قادم" : "Upcoming obligation warning",
      body: largestUpcomingObligation
        ? language === "ar" ? `${largestUpcomingObligation.name} هو أكبر التزام قادم بقيمة ${currency.format(largestUpcomingObligation.monthlyAmount)}.` : `${largestUpcomingObligation.name} is your largest upcoming obligation at ${currency.format(largestUpcomingObligation.monthlyAmount)}.`
        : language === "ar" ? "لا يوجد التزام كبير قادم مسجل حاليا." : "No major upcoming obligation is currently recorded.",
      tone: largestUpcomingObligation ? "warn" : "good",
    },
    {
      title: language === "ar" ? "تنبيه استخدام مرتفع للبطاقة الائتمانية" : "High credit card utilization warning",
      body:
        highestUtilizationCard && highestUtilizationCard.utilization >= 100
          ? language === "ar" ? "هذه البطاقة تحتاج انتباه لأنها مستخدمة بالكامل تقريباً." : "This card needs attention because it is almost or fully utilized."
          : highestUtilizationCard && highestUtilizationCard.utilization > 80
          ? language === "ar" ? `${highestUtilizationCard.cardName} عند استخدام ${Math.round(highestUtilizationCard.utilization)}%. قد يكون من الأفضل تخفيف استخدامها قليلاً.` : `${highestUtilizationCard.cardName} is at ${Math.round(highestUtilizationCard.utilization)}% utilization. It may help to reduce usage gently.`
          : language === "ar" ? "استخدام البطاقات الائتمانية يبدو مستقراً حالياً." : "Credit card utilization looks steady for now.",
      tone: highestUtilizationCard && highestUtilizationCard.utilization > 80 ? "bad" : "good",
    },
    {
      title: language === "ar" ? "توصية مصاريف نمط الحياة" : "Lifestyle spending suggestion",
      body:
        totalLifestyleExpenses > snapshot.totalIncome * 0.35
          ? language === "ar" ? "قد يكون من الأفضل تخفيف بعض بنود نمط الحياة قليلاً، مثل المطاعم أو الاشتراكات، بدون ضغط." : "It may help to trim some lifestyle categories gently, such as restaurants or subscriptions."
          : language === "ar" ? "مصاريف نمط الحياة تبدو ضمن النطاق الإرشادي حالياً." : "Lifestyle spending looks within the soft guidance range for now.",
      tone: totalLifestyleExpenses > snapshot.totalIncome * 0.35 ? "warn" : "good",
    },
    {
      title: language === "ar" ? "توصية سداد الدين" : "Debt payoff suggestion",
      body:
        snapshot.totalDebt > 0 && snapshot.cashFlow > 0
          ? language === "ar" ? `لديك حالياً ${currency.format(snapshot.availableCashFlow)} متاحة شهرياً. فكر في تخصيص جزء منها لأهدافك.` : `You currently have ${currency.format(snapshot.availableCashFlow)} available monthly. Consider allocating part of this amount toward your goals.`
          : snapshot.totalDebt > 0
            ? language === "ar" ? "قبل إضافة دين جديد، قد يكون من الأفضل تحسين التدفق النقدي قليلاً." : "Before adding new debt, it may help to improve cash flow a little."
            : language === "ar" ? "لا يوجد رصيد دين نشط مسجل." : "No active debt balance is recorded.",
      tone: snapshot.totalDebt > 0 && snapshot.cashFlow <= 0 ? "warn" : "good",
    },
  ];
  const salaryDistribution = [
    { label: language === "ar" ? "الالتزامات" : "Obligations", value: snapshot.totalMonthlyObligations },
    { label: language === "ar" ? "نمط الحياة" : "Lifestyle", value: totalLifestyleExpenses },
    { label: language === "ar" ? "مدفوعات الديون" : "Debt Payments", value: snapshot.debtInstallments },
    { label: language === "ar" ? "المتبقي" : "Remaining", value: Math.max(snapshot.cashFlow, 0) },
  ].filter((item) => item.value > 0);
  const salaryDistributionTotal = Math.max(snapshot.totalIncome, salaryDistribution.reduce((total, item) => total + item.value, 0), 1);
  const actionPlan = [
    language === "ar" ? "بناء صندوق الطوارئ" : "Build Emergency Fund",
    language === "ar" ? "خفض استخدام البطاقات الائتمانية" : "Reduce Credit Card Utilization",
    language === "ar" ? "تخصيص جزء من الفائض الشهري للأهداف" : "Allocate Part of Monthly Surplus to Goals",
    language === "ar" ? "الاستعداد للالتزامات الكبيرة القادمة" : "Prepare for Upcoming Major Obligations",
  ];

  function addDebt() {
    setDebts((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        type: "Personal Loan",
        name: "New debt",
        bank: "Bank",
        remainingBalance: 50000,
        monthlyInstallment: 1500,
        interestRate: 5,
        endDate: "2028-12-31",
      },
    ]);
  }

  function deleteDebt(id: string) {
    setDebts((current) => current.filter((debt) => debt.id !== id));
  }

  function addIncomeSource() {
    setIncomeSources((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: "New income",
        amount: 0,
        type: "Other",
      },
    ]);
  }

  function addBonusIncome() {
    setIncomeSources((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: "Annual bonus",
        amount: 0,
        type: "Bonus",
        expectedMonth: "December",
        guaranteed: false,
        allocation: "Keep unallocated for now",
        notes: "",
        recurring: false,
      },
    ]);
  }

  function deleteIncomeSource(id: string) {
    setIncomeSources((current) => current.filter((income) => income.id !== id));
  }

  function addObligationEntry() {
    setObligationEntries((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: "New obligation",
        monthlyAmount: 0,
        category: "Other",
        dueDay: 1,
        isRecurring: true,
        frequency: "Monthly",
        dueDate: dateFromDueDay(1),
        startDate: isoDate(new Date()),
        allocationMethod: "Count full amount only in due month",
        savedAmount: 0,
        notes: "",
      },
    ]);
  }

  function addObligationFromChecklist(option: (typeof commonObligationOptions)[number]) {
    setSelectedChecklistItems((current) => (current.includes(option.name) ? current.filter((item) => item !== option.name) : [...current, option.name]));
    if (selectedChecklistItems.includes(option.name)) return;
    setObligationEntries((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: option.name,
        monthlyAmount: option.amount,
        category: option.category,
        dueDay: 1,
        isRecurring: option.frequency !== "One-Time",
        frequency: option.frequency,
        dueDate: dateFromDueDay(1),
        startDate: isoDate(new Date()),
        allocationMethod: option.frequency === "Monthly" ? "Count full amount only in due month" : "Spread amount monthly until due date",
        savedAmount: 0,
        notes: "Added from onboarding checklist.",
      },
    ]);
  }

  function deleteObligationEntry(id: string) {
    setObligationEntries((current) => current.filter((obligation) => obligation.id !== id));
  }

  function addLifestyleExpense() {
    setObligationEntries((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: "Other",
        monthlyAmount: 0,
        category: "Lifestyle",
        dueDay: 1,
        isRecurring: true,
        frequency: "Monthly",
        dueDate: dateFromDueDay(1),
        startDate: isoDate(new Date()),
        allocationMethod: "Count full amount only in due month",
        savedAmount: 0,
        notes: "",
      },
    ]);
  }

  function addGoal() {
    setGoals((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: "New goal",
        type: "Other",
        targetAmount: 10000,
        currentAmount: 0,
        targetDate: "2027-12-31",
        priority: "Medium",
        notes: "",
      },
    ]);
  }

  function addGoalStarter(type: GoalType) {
    setSelectedGoalStarters((current) => (current.includes(type) ? current.filter((item) => item !== type) : [...current, type]));
    if (selectedGoalStarters.includes(type)) return;
    setGoals((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: type,
        type,
        targetAmount: 10000,
        currentAmount: 0,
        targetDate: "2027-12-31",
        priority: "Medium",
        notes: "Added during onboarding.",
      },
    ]);
  }

  function deleteGoal(id: string) {
    setGoals((current) => current.filter((goal) => goal.id !== id));
  }

  function renderGoalEditor(goal: Goal, index: number) {
    const progress = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0;

    return (
      <div key={goal.id} className="grid gap-3 rounded-lg border border-slate-200 p-4 dark:border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-black">{goal.name || goal.type}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
              {currency.format(goal.currentAmount)} of {currency.format(goal.targetAmount)}
            </p>
          </div>
          <div className="grid gap-2 sm:flex sm:items-center">
            <span className="rounded-lg bg-mint/15 px-2 py-1 text-xs font-black text-emerald-700 dark:text-mint">{progress}%</span>
            <button
              className="flex h-11 w-full shrink-0 items-center justify-center rounded-lg border border-red-200 text-red-600 dark:border-red-400/30 dark:text-red-300 sm:size-10 sm:w-10"
              onClick={() => deleteGoal(goal.id)}
              aria-label="Delete goal"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        <div className="h-3 rounded-full bg-slate-100 dark:bg-white/10">
          <div className="h-3 rounded-full bg-mint" style={{ width: `${progress}%` }} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Goal Name" value={goal.name} onChange={(value) => setGoals((current) => current.map((item, i) => (i === index ? { ...item, name: value } : item)))} />
          <SelectField label="Goal Type" value={goal.type} options={allGoalTypes} onChange={(value) => setGoals((current) => current.map((item, i) => (i === index ? { ...item, type: value as GoalType } : item)))} />
          <Field label="Target Amount" type="number" value={goal.targetAmount} onChange={(value) => setGoals((current) => current.map((item, i) => (i === index ? { ...item, targetAmount: Number(value) } : item)))} />
          <Field label="Current Amount" type="number" value={goal.currentAmount} onChange={(value) => setGoals((current) => current.map((item, i) => (i === index ? { ...item, currentAmount: Number(value) } : item)))} />
          <Field label="Target Date" type="date" value={goal.targetDate} onChange={(value) => setGoals((current) => current.map((item, i) => (i === index ? { ...item, targetDate: value } : item)))} />
          <SelectField label="Priority" value={goal.priority} options={goalPriorities} onChange={(value) => setGoals((current) => current.map((item, i) => (i === index ? { ...item, priority: value as GoalPriority } : item)))} />
          <label className="grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Linked Debt
            <select
              className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-ink outline-none transition focus:border-mint dark:border-white/10 dark:bg-slate-900 dark:text-white"
              value={goal.linkedDebtId || ""}
              onChange={(event) =>
                setGoals((current) =>
                  current.map((item, i) => (i === index ? { ...item, linkedDebtId: event.target.value || undefined } : item)),
                )
              }
            >
              <option value="">None</option>
              {debts.map((debt) => (
                <option key={debt.id} value={debt.id}>
                  {debt.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Linked Credit Card
            <select
              className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-ink outline-none transition focus:border-mint dark:border-white/10 dark:bg-slate-900 dark:text-white"
              value={goal.linkedCreditCardId || ""}
              onChange={(event) =>
                setGoals((current) =>
                  current.map((item, i) => (i === index ? { ...item, linkedCreditCardId: event.target.value || undefined } : item)),
                )
              }
            >
              <option value="">None</option>
              {creditCards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.cardName}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <Field label="Notes" value={goal.notes} onChange={(value) => setGoals((current) => current.map((item, i) => (i === index ? { ...item, notes: value } : item)))} />
          </div>
        </div>
      </div>
    );
  }

  function addCreditCard() {
    setCreditCards((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        cardName: "New credit card",
        provider: "Provider",
        creditLimit: 10000,
        currentBalance: 0,
        minimumPaymentDue: 0,
        statementTotalDue: 0,
        dueDate: "2026-12-31",
        aprOrProfitRate: 18,
        notes: "",
      },
    ]);
  }

  function deleteCreditCard(id: string) {
    setCreditCards((current) => current.filter((card) => card.id !== id));
  }

  function duplicateKey(parts: Array<string | number | undefined>) {
    return parts.map((part) => normalizeKey(String(part ?? ""))).join("|");
  }

  function getImportDuplicateWarnings(preview: ImportPreview) {
    const warnings: string[] = [];
    const currentIncome = new Set(incomeSources.map((income) => duplicateKey([income.name, income.amount, income.type])));
    const currentObligations = new Set(obligationEntries.map((obligation) => duplicateKey([obligation.name, obligation.monthlyAmount, obligation.category])));
    const currentCards = new Set(creditCards.map((card) => duplicateKey([card.cardName, card.currentBalance, card.provider])));
    const currentGoals = new Set(goals.map((goal) => duplicateKey([goal.name, goal.targetAmount, goal.type])));

    preview.incomeSources.forEach((income) => {
      if (currentIncome.has(duplicateKey([income.name, income.amount, income.type]))) warnings.push(`Income duplicate skipped on merge: ${income.name}.`);
    });
    preview.obligations.forEach((obligation) => {
      if (currentObligations.has(duplicateKey([obligation.name, obligation.monthlyAmount, obligation.category]))) warnings.push(`Obligation duplicate skipped on merge: ${obligation.name}.`);
    });
    preview.creditCards.forEach((card) => {
      if (currentCards.has(duplicateKey([card.cardName, card.currentBalance, card.provider]))) warnings.push(`Credit card duplicate skipped on merge: ${card.cardName}.`);
    });
    preview.goals.forEach((goal) => {
      if (currentGoals.has(duplicateKey([goal.name, goal.targetAmount, goal.type]))) warnings.push(`Goal duplicate skipped on merge: ${goal.name}.`);
    });

    return warnings;
  }

  function mergeWithoutDuplicates<T>(current: T[], incoming: T[], getKey: (item: T) => string) {
    const existing = new Set(current.map(getKey));
    return [...current, ...incoming.filter((item) => !existing.has(getKey(item)))];
  }

  function createImportRawData(workbook: XLSX.WorkBook): ImportRawData {
    const firstSheetRows = workbook.SheetNames[0] ? getRows(workbook, workbook.SheetNames[0]) : [];
    const fallbackRows = (sheetName: string, aliases: string[]) => {
      const namedRows = getRows(workbook, sheetName);
      if (namedRows.length > 0) return namedRows;
      return firstSheetRows.filter((row) => aliases.includes(normalizeKey(String(readCell(row, ["Section", "Sheet"]) || ""))));
    };
    const rows = {
      incomeSources: fallbackRows("Income Sources", ["incomesources", "income"]),
      obligations: fallbackRows("Obligations", ["obligations", "obligation"]),
      creditCards: fallbackRows("Credit Cards", ["creditcards", "creditcard", "cards"]),
      goals: fallbackRows("Goals", ["goals", "goal"]),
    };

    return {
      ...rows,
      columns: {
        incomeSources: Object.keys(rows.incomeSources[0] || {}),
        obligations: Object.keys(rows.obligations[0] || {}),
        creditCards: Object.keys(rows.creditCards[0] || {}),
        goals: Object.keys(rows.goals[0] || {}),
      },
    };
  }

  function inferImportMappings(raw: ImportRawData): ImportMappings {
    return {
      incomeSources: {
        name: pickColumn(raw.columns.incomeSources, ["Name", "Income Name", "Source", "مصدر", "الاسم"]),
        type: pickColumn(raw.columns.incomeSources, ["Type", "Income Type", "نوع"]),
        amount: pickColumn(raw.columns.incomeSources, ["Amount", "Income Amount", "مبلغ", "القيمة"]),
      },
      obligations: {
        name: pickColumn(raw.columns.obligations, ["Name", "Obligation Name", "بنك الإمارات", "Bank", "الاسم", "الالتزام"]),
        category: pickColumn(raw.columns.obligations, ["Category", "Loan", "Type", "فئة", "نوع"]),
        amount: pickColumn(raw.columns.obligations, ["Amount", "Monthly Amount", "مبلغ", "القيمة"]),
        frequency: pickColumn(raw.columns.obligations, ["Frequency", "Recurring"]),
        dueDate: pickColumn(raw.columns.obligations, ["Due Date", "Due Day", "تاريخ الاستحقاق", "يوم الاستحقاق"]),
        startDate: pickColumn(raw.columns.obligations, ["Start Date"]),
        endDate: pickColumn(raw.columns.obligations, ["End Date", "تاريخ الانتهاء"]),
        allocationMethod: pickColumn(raw.columns.obligations, ["Allocation Method", "Allocation", "Spread"]),
        savedAmount: pickColumn(raw.columns.obligations, ["Saved Amount", "Saved"]),
        notes: pickColumn(raw.columns.obligations, ["Notes", "ملاحظات"]),
      },
      creditCards: {
        cardName: pickColumn(raw.columns.creditCards, ["Card Name", "Name", "اسم البطاقة"]),
        provider: pickColumn(raw.columns.creditCards, ["Provider", "Bank", "بنك", "مزود"]),
        balance: pickColumn(raw.columns.creditCards, ["Balance", "Current Balance", "الرصيد"]),
        limit: pickColumn(raw.columns.creditCards, ["Limit", "Credit Limit", "الحد"]),
        minimumPayment: pickColumn(raw.columns.creditCards, ["Minimum Payment", "Minimum Payment Due", "الحد الأدنى"]),
        statementTotal: pickColumn(raw.columns.creditCards, ["Statement Total", "Statement Total Due", "المستحق"]),
        dueDate: pickColumn(raw.columns.creditCards, ["Due Date", "تاريخ الاستحقاق"]),
        apr: pickColumn(raw.columns.creditCards, ["APR", "APR / Profit Rate", "Profit Rate", "نسبة"]),
        notes: pickColumn(raw.columns.creditCards, ["Notes", "ملاحظات"]),
      },
      goals: {
        name: pickColumn(raw.columns.goals, ["Goal Name", "Name", "الهدف"]),
        type: pickColumn(raw.columns.goals, ["Type", "Goal Type", "نوع"]),
        targetAmount: pickColumn(raw.columns.goals, ["Target Amount", "المبلغ المستهدف"]),
        currentAmount: pickColumn(raw.columns.goals, ["Current Amount", "المبلغ الحالي"]),
        targetDate: pickColumn(raw.columns.goals, ["Target Date", "تاريخ الهدف"]),
        priority: pickColumn(raw.columns.goals, ["Priority", "الأولوية"]),
        notes: pickColumn(raw.columns.goals, ["Notes", "ملاحظات"]),
      },
    };
  }

  function cellByColumn(row: Record<string, unknown>, column: string) {
    return column ? row[column] : "";
  }

  function buildImportPreviewFromRaw(raw: ImportRawData, mappings: ImportMappings) {
    const errors: ImportError[] = [];
    const preview: ImportPreview = { incomeSources: [], obligations: [], creditCards: [], goals: [] };

    if (raw.incomeSources.length > 0 && (!mappings.incomeSources.name || !mappings.incomeSources.amount)) {
      errors.push({ section: "Income Sources", message: "Map Name and Amount before confirming." });
    }
    if (raw.obligations.length > 0 && (!mappings.obligations.name || !mappings.obligations.amount)) {
      errors.push({ section: "Obligations", message: "Map Obligation Name and Amount before confirming." });
    }
    if (raw.creditCards.length > 0 && (!mappings.creditCards.cardName || !mappings.creditCards.balance || !mappings.creditCards.limit)) {
      errors.push({ section: "Credit Cards", message: "Map Card Name, Balance, and Limit before confirming." });
    }
    if (raw.goals.length > 0 && (!mappings.goals.name || !mappings.goals.targetAmount)) {
      errors.push({ section: "Goals", message: "Map Goal Name and Target Amount before confirming." });
    }

    raw.incomeSources.forEach((row, index) => {
      const name = String(cellByColumn(row, mappings.incomeSources.name) || "").trim();
      const typeValue = String(cellByColumn(row, mappings.incomeSources.type) || "Other").trim() as IncomeType;
      const amount = parseAmount(cellByColumn(row, mappings.incomeSources.amount));
      if (!name) errors.push({ section: "Income Sources", message: `Row ${index + 2}: Name is required.` });
      if (!Number.isFinite(amount) || amount < 0) errors.push({ section: "Income Sources", message: `Row ${index + 2}: Invalid amount.` });
      preview.incomeSources.push({ id: crypto.randomUUID(), name: name || `Income ${index + 1}`, type: incomeTypes.includes(typeValue) ? typeValue : "Other", amount: Number.isFinite(amount) ? amount : 0 });
    });

    raw.obligations.forEach((row, index) => {
      const name = String(cellByColumn(row, mappings.obligations.name) || "").trim();
      const category = mapObligationCategory(cellByColumn(row, mappings.obligations.category));
      const monthlyAmount = parseAmount(cellByColumn(row, mappings.obligations.amount));
      const frequency = mapObligationFrequency(cellByColumn(row, mappings.obligations.frequency) || readCell(row, ["Frequency", "Recurring"]));
      const dueDateValue = parseDateValue(cellByColumn(row, mappings.obligations.dueDate) || readCell(row, ["Due Date", "Due Day"]));
      const dueDay = dueDateValue ? dueDateValue.getDate() : parseDueDay(cellByColumn(row, mappings.obligations.dueDate));
      const startDateValue = parseDateValue(cellByColumn(row, mappings.obligations.startDate) || readCell(row, ["Start Date"]));
      const endDateValue = parseDateValue(cellByColumn(row, mappings.obligations.endDate) || readCell(row, ["End Date"]));
      const savedAmount = parseAmount(cellByColumn(row, mappings.obligations.savedAmount) || readCell(row, ["Saved Amount", "Saved"]));
      const allocationMethod = mapAllocationMethod(cellByColumn(row, mappings.obligations.allocationMethod) || readCell(row, ["Allocation Method", "Allocation", "Spread"]), frequency);
      if (!name) errors.push({ section: "Obligations", message: `Row ${index + 2}: Name is required.` });
      if (!Number.isFinite(monthlyAmount) || monthlyAmount < 0) errors.push({ section: "Obligations", message: `Row ${index + 2}: Invalid amount.` });
      preview.obligations.push({
        id: crypto.randomUUID(),
        name: name || `Obligation ${index + 1}`,
        category,
        monthlyAmount: Number.isFinite(monthlyAmount) ? monthlyAmount : 0,
        dueDay: Number.isFinite(dueDay) ? dueDay : 1,
        isRecurring: frequency !== "One-Time",
        frequency,
        dueDate: dueDateValue ? isoDate(dueDateValue) : dateFromDueDay(Number.isFinite(dueDay) ? dueDay : 1),
        startDate: startDateValue ? isoDate(startDateValue) : isoDate(new Date()),
        endDate: endDateValue ? endDateValue.toISOString().slice(0, 10) : undefined,
        allocationMethod,
        savedAmount: Number.isFinite(savedAmount) ? Math.max(savedAmount, 0) : 0,
        notes: String(cellByColumn(row, mappings.obligations.notes) || "").trim(),
      });
    });

    raw.creditCards.forEach((row, index) => {
      const cardName = String(cellByColumn(row, mappings.creditCards.cardName) || "").trim();
      const provider = String(cellByColumn(row, mappings.creditCards.provider) || "Provider").trim();
      const currentBalance = parseAmount(cellByColumn(row, mappings.creditCards.balance));
      const creditLimit = parseAmount(cellByColumn(row, mappings.creditCards.limit));
      const dueDate = parseDateValue(cellByColumn(row, mappings.creditCards.dueDate));
      const minimumPaymentDue = parseAmount(cellByColumn(row, mappings.creditCards.minimumPayment));
      const statementTotalDue = parseAmount(cellByColumn(row, mappings.creditCards.statementTotal));
      const aprOrProfitRate = parseAmount(cellByColumn(row, mappings.creditCards.apr));
      if (!cardName) errors.push({ section: "Credit Cards", message: `Row ${index + 2}: Card name is required.` });
      if (!Number.isFinite(currentBalance) || currentBalance < 0) errors.push({ section: "Credit Cards", message: `Row ${index + 2}: Invalid balance.` });
      if (!Number.isFinite(creditLimit) || creditLimit <= 0) errors.push({ section: "Credit Cards", message: `Row ${index + 2}: Invalid limit.` });
      preview.creditCards.push({
        id: crypto.randomUUID(),
        cardName: cardName || `Credit Card ${index + 1}`,
        provider: provider || "Provider",
        currentBalance: Number.isFinite(currentBalance) ? currentBalance : 0,
        creditLimit: Number.isFinite(creditLimit) ? creditLimit : 0,
        minimumPaymentDue: Number.isFinite(minimumPaymentDue) ? minimumPaymentDue : 0,
        statementTotalDue: Number.isFinite(statementTotalDue) ? statementTotalDue : 0,
        dueDate: dueDate ? dueDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        aprOrProfitRate: Number.isFinite(aprOrProfitRate) ? aprOrProfitRate : 0,
        notes: String(cellByColumn(row, mappings.creditCards.notes) || "").trim(),
      });
    });

    raw.goals.forEach((row, index) => {
      const name = String(cellByColumn(row, mappings.goals.name) || "").trim();
      const typeValue = String(cellByColumn(row, mappings.goals.type) || "Other").trim() as GoalType;
      const targetAmount = parseAmount(cellByColumn(row, mappings.goals.targetAmount));
      const currentAmount = parseAmount(cellByColumn(row, mappings.goals.currentAmount));
      const targetDate = parseDateValue(cellByColumn(row, mappings.goals.targetDate));
      const priorityValue = String(cellByColumn(row, mappings.goals.priority) || "Medium").trim() as GoalPriority;
      if (!name) errors.push({ section: "Goals", message: `Row ${index + 2}: Goal name is required.` });
      if (!Number.isFinite(targetAmount) || targetAmount <= 0) errors.push({ section: "Goals", message: `Row ${index + 2}: Invalid target amount.` });
      preview.goals.push({
        id: crypto.randomUUID(),
        name: name || `Goal ${index + 1}`,
        type: allGoalTypes.includes(typeValue) ? typeValue : "Other",
        targetAmount: Number.isFinite(targetAmount) ? targetAmount : 0,
        currentAmount: Number.isFinite(currentAmount) ? currentAmount : 0,
        targetDate: targetDate ? targetDate.toISOString().slice(0, 10) : "2027-12-31",
        priority: goalPriorities.includes(priorityValue) ? priorityValue : "Medium",
        notes: String(cellByColumn(row, mappings.goals.notes) || "").trim(),
      });
    });

    if (preview.incomeSources.length + preview.obligations.length + preview.creditCards.length + preview.goals.length === 0) {
      errors.push({ section: "Workbook", message: "No importable records were found." });
    }

    setImportPreview(preview);
    setImportErrors(errors);
    setImportDuplicateWarnings(importMode === "merge" ? getImportDuplicateWarnings(preview) : []);
  }

  function buildImportPreview(workbook: XLSX.WorkBook) {
    if (workbook.SheetNames.length >= 0) {
      const raw = createImportRawData(workbook);
      const mappings = inferImportMappings(raw);
      setImportRawData(raw);
      setImportMappings(mappings);
      buildImportPreviewFromRaw(raw, mappings);
      setImportSummary("");
      setImportWizardOpen(true);
    } else {
    const errors: ImportError[] = [];
    const preview: ImportPreview = {
      incomeSources: [],
      obligations: [],
      creditCards: [],
      goals: [],
    };

    const firstSheetRows = workbook.SheetNames[0] ? getRows(workbook, workbook.SheetNames[0]) : [];
    const fallbackRows = (sheetName: string, aliases: string[]) => {
      const namedRows = getRows(workbook, sheetName);
      if (namedRows.length > 0) return namedRows;
      return firstSheetRows.filter((row) => aliases.includes(normalizeKey(String(readCell(row, ["Section", "Sheet"]) || ""))));
    };
    const incomeRows = fallbackRows("Income Sources", ["incomesources", "income"]);
    const obligationRows = fallbackRows("Obligations", ["obligations", "obligation"]);
    const cardRows = fallbackRows("Credit Cards", ["creditcards", "creditcard", "cards"]);
    const goalRows = fallbackRows("Goals", ["goals", "goal"]);

    [
      { section: "Income Sources", rows: incomeRows, columns: ["Name", "Type", "Amount"] },
      { section: "Obligations", rows: obligationRows, columns: ["Name", "Category", "Amount", "Due Date"] },
      { section: "Credit Cards", rows: cardRows, columns: ["Card Name", "Provider", "Balance", "Limit", "Due Date"] },
      { section: "Goals", rows: goalRows, columns: ["Goal Name", "Target Amount"] },
    ].forEach((sheet) => {
      if (sheet.rows.length === 0) return;
      const missing = missingColumns(sheet.rows, sheet.columns);
      if (missing.length > 0) errors.push({ section: sheet.section, message: `Missing columns: ${missing.join(", ")}.` });
    });

    incomeRows.forEach((row, index) => {
      const name = String(readCell(row, ["Name", "Income Name"]) || "").trim();
      const type = String(readCell(row, ["Type", "Income Type"]) || "Other").trim() as IncomeType;
      const amount = parseAmount(readCell(row, ["Amount", "Income Amount"]));

      if (!name) errors.push({ section: "Income Sources", message: `Row ${index + 2}: Name is required.` });
      if (!incomeTypes.includes(type)) errors.push({ section: "Income Sources", message: `Row ${index + 2}: Invalid type "${type}".` });
      if (!Number.isFinite(amount) || amount < 0) errors.push({ section: "Income Sources", message: `Row ${index + 2}: Invalid amount.` });

      preview.incomeSources.push({ id: crypto.randomUUID(), name: name || `Income ${index + 1}`, type: incomeTypes.includes(type) ? type : "Other", amount: Number.isFinite(amount) ? amount : 0 });
    });

    obligationRows.forEach((row, index) => {
      const name = String(readCell(row, ["Name", "Obligation Name"]) || "").trim();
      const category = String(readCell(row, ["Category"]) || "Other").trim() as ObligationCategory;
      const monthlyAmount = parseAmount(readCell(row, ["Amount", "Monthly Amount"]));
      const dueDay = parseDueDay(readCell(row, ["Due Date", "Due Day"]));
      const endDateValue = parseDateValue(readCell(row, ["End Date"]));
      const notes = String(readCell(row, ["Notes"]) || "").trim();

      if (!name) errors.push({ section: "Obligations", message: `Row ${index + 2}: Name is required.` });
      if (!obligationCategories.includes(category)) errors.push({ section: "Obligations", message: `Row ${index + 2}: Invalid category "${category}".` });
      if (!Number.isFinite(monthlyAmount) || monthlyAmount < 0) errors.push({ section: "Obligations", message: `Row ${index + 2}: Invalid amount.` });
      if (!Number.isFinite(dueDay)) errors.push({ section: "Obligations", message: `Row ${index + 2}: Invalid due date.` });

      preview.obligations.push({
        id: crypto.randomUUID(),
        name: name || `Obligation ${index + 1}`,
        category: obligationCategories.includes(category) ? category : "Other",
        monthlyAmount: Number.isFinite(monthlyAmount) ? monthlyAmount : 0,
        dueDay: Number.isFinite(dueDay) ? dueDay : 1,
        isRecurring: true,
        frequency: "Monthly",
        dueDate: dateFromDueDay(Number.isFinite(dueDay) ? dueDay : 1),
        startDate: isoDate(new Date()),
        endDate: endDateValue ? endDateValue.toISOString().slice(0, 10) : undefined,
        allocationMethod: "Count full amount only in due month",
        savedAmount: 0,
        notes,
      });
    });

    cardRows.forEach((row, index) => {
      const cardName = String(readCell(row, ["Card Name", "Name"]) || "").trim();
      const provider = String(readCell(row, ["Provider", "Bank"]) || "").trim();
      const currentBalance = parseAmount(readCell(row, ["Balance", "Current Balance"]));
      const creditLimit = parseAmount(readCell(row, ["Limit", "Credit Limit"]));
      const dueDate = parseDateValue(readCell(row, ["Due Date"]));
      const minimumPaymentDue = parseAmount(readCell(row, ["Minimum Payment", "Minimum Payment Due"]));
      const statementTotalDue = parseAmount(readCell(row, ["Statement Total", "Statement Total Due"]));
      const aprOrProfitRate = parseAmount(readCell(row, ["APR", "APR / Profit Rate", "Profit Rate"]));
      const notes = String(readCell(row, ["Notes"]) || "").trim();

      if (!cardName) errors.push({ section: "Credit Cards", message: `Row ${index + 2}: Card name is required.` });
      if (!provider) errors.push({ section: "Credit Cards", message: `Row ${index + 2}: Provider is required.` });
      if (!Number.isFinite(currentBalance) || currentBalance < 0) errors.push({ section: "Credit Cards", message: `Row ${index + 2}: Invalid balance.` });
      if (!Number.isFinite(creditLimit) || creditLimit <= 0) errors.push({ section: "Credit Cards", message: `Row ${index + 2}: Invalid limit.` });
      if (!dueDate) errors.push({ section: "Credit Cards", message: `Row ${index + 2}: Invalid due date.` });

      preview.creditCards.push({
        id: crypto.randomUUID(),
        cardName: cardName || `Credit Card ${index + 1}`,
        provider: provider || "Provider",
        currentBalance: Number.isFinite(currentBalance) ? currentBalance : 0,
        creditLimit: Number.isFinite(creditLimit) ? creditLimit : 0,
        minimumPaymentDue: Number.isFinite(minimumPaymentDue) ? minimumPaymentDue : 0,
        statementTotalDue: Number.isFinite(statementTotalDue) ? statementTotalDue : 0,
        dueDate: dueDate ? dueDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        aprOrProfitRate: Number.isFinite(aprOrProfitRate) ? aprOrProfitRate : 0,
        notes,
      });
    });

    goalRows.forEach((row, index) => {
      const name = String(readCell(row, ["Goal Name", "Name"]) || "").trim();
      const type = String(readCell(row, ["Type", "Goal Type"]) || "Other").trim() as GoalType;
      const targetAmount = parseAmount(readCell(row, ["Target Amount"]));
      const currentAmount = parseAmount(readCell(row, ["Current Amount"]));
      const targetDate = parseDateValue(readCell(row, ["Target Date"]));
      const priority = String(readCell(row, ["Priority"]) || "Medium").trim() as GoalPriority;
      const notes = String(readCell(row, ["Notes"]) || "").trim();

      if (!name) errors.push({ section: "Goals", message: `Row ${index + 2}: Goal name is required.` });
      if (!allGoalTypes.includes(type)) errors.push({ section: "Goals", message: `Row ${index + 2}: Invalid goal type "${type}".` });
      if (!Number.isFinite(targetAmount) || targetAmount <= 0) errors.push({ section: "Goals", message: `Row ${index + 2}: Invalid target amount.` });
      if (readCell(row, ["Target Date"]) && !targetDate) errors.push({ section: "Goals", message: `Row ${index + 2}: Invalid target date.` });
      if (!goalPriorities.includes(priority)) errors.push({ section: "Goals", message: `Row ${index + 2}: Invalid priority "${priority}".` });

      preview.goals.push({
        id: crypto.randomUUID(),
        name: name || `Goal ${index + 1}`,
        type: allGoalTypes.includes(type) ? type : "Other",
        targetAmount: Number.isFinite(targetAmount) ? targetAmount : 0,
        currentAmount: Number.isFinite(currentAmount) ? currentAmount : 0,
        targetDate: targetDate ? targetDate.toISOString().slice(0, 10) : "2027-12-31",
        priority: goalPriorities.includes(priority) ? priority : "Medium",
        notes,
      });
    });

    if (preview.incomeSources.length + preview.obligations.length + preview.creditCards.length + preview.goals.length === 0) {
      errors.push({ section: "Workbook", message: "No importable records were found." });
    }

    setImportPreview(preview);
    setImportErrors(errors);
    setImportDuplicateWarnings(importMode === "merge" ? getImportDuplicateWarnings(preview) : []);
    setImportSummary("");
    }
  }

  async function handleImportFile(file: File) {
    setImportFileName(file.name);
    setImportSummary("");
    setImportMode("replace");
    setImportDuplicateWarnings([]);
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    buildImportPreview(workbook);
  }

  function confirmImport() {
    if (!importPreview || importErrors.length > 0) return;
    const linkedGoals = linkImportedGoals(importPreview);
    const nextIncomeSources =
      importMode === "merge"
        ? mergeWithoutDuplicates(incomeSources, importPreview.incomeSources, (income) => duplicateKey([income.name, income.amount, income.type]))
        : importPreview.incomeSources;
    const nextObligations =
      importMode === "merge"
        ? mergeWithoutDuplicates(obligationEntries, importPreview.obligations, (obligation) => duplicateKey([obligation.name, obligation.monthlyAmount, obligation.category]))
        : importPreview.obligations;
    const nextCreditCards =
      importMode === "merge"
        ? mergeWithoutDuplicates(creditCards, importPreview.creditCards, (card) => duplicateKey([card.cardName, card.currentBalance, card.provider]))
        : importPreview.creditCards;
    const nextGoals =
      importMode === "merge"
        ? mergeWithoutDuplicates(goals, linkedGoals, (goal) => duplicateKey([goal.name, goal.targetAmount, goal.type]))
        : linkedGoals;
    const importedCounts = {
      incomeSources: importMode === "merge" ? nextIncomeSources.length - incomeSources.length : nextIncomeSources.length,
      obligations: importMode === "merge" ? nextObligations.length - obligationEntries.length : nextObligations.length,
      creditCards: importMode === "merge" ? nextCreditCards.length - creditCards.length : nextCreditCards.length,
      goals: importMode === "merge" ? nextGoals.length - goals.length : nextGoals.length,
    };

    setIncomeSources(nextIncomeSources);
    setObligationEntries(nextObligations);
    setCreditCards(nextCreditCards);
    setGoals(nextGoals);
    if (sessionMode === "real" && currentUserId) {
      saveUserData(
        {
          profile,
          debts,
          creditCards: nextCreditCards,
          incomeSources: nextIncomeSources,
          obligationEntries: nextObligations,
          goals: nextGoals,
          leads,
        },
        "Imported and saved successfully",
      );
    }
    setImportSummary(
      `Imported Successfully - Income Sources: ${importedCounts.incomeSources}, Obligations: ${importedCounts.obligations}, Credit Cards: ${importedCounts.creditCards}, Goals: ${importedCounts.goals}`,
    );
    setImportPreview(null);
    setImportErrors([]);
    setImportDuplicateWarnings([]);
    setImportFileName("");
    setImportRawData(null);
    setImportWizardOpen(false);
    setActive("dashboard");
    setFlow("app");
  }

  function cancelImport() {
    setImportPreview(null);
    setImportErrors([]);
    setImportDuplicateWarnings([]);
    setImportFileName("");
    setImportRawData(null);
    setImportWizardOpen(false);
  }

  function updateImportMapping(section: keyof ImportMappings, field: string, value: string) {
    setImportMappings((current) => {
      const next = {
        ...current,
        [section]: {
          ...current[section],
          [field]: value,
        },
      } as ImportMappings;
      if (importRawData) buildImportPreviewFromRaw(importRawData, next);
      return next;
    });
  }

  function renderMappingSelect(section: keyof ImportMappings, field: string, label: string, columns: string[]) {
    const value = (importMappings[section] as Record<string, string>)[field] || "";

    return (
      <label className="grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
        {label}
        <select
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-ink outline-none focus:border-mint dark:border-white/10 dark:bg-slate-900 dark:text-white"
          value={value}
          onChange={(event) => updateImportMapping(section, field, event.target.value)}
        >
          <option value="">Not mapped</option>
          {columns.map((column) => (
            <option key={column} value={column}>
              {column}
            </option>
          ))}
        </select>
      </label>
    );
  }

  function linkImportedGoals(preview: ImportPreview) {
    const availableDebts = [...debts];
    const availableCards = [...creditCards, ...preview.creditCards];

    return preview.goals.map((goal) => {
      if (goal.type === "Pay Off Credit Card" && !goal.linkedCreditCardId) {
        const matchingCard =
          availableCards.find((card) => normalizeKey(goal.name).includes(normalizeKey(card.cardName))) ||
          availableCards.find((card) => normalizeKey(card.cardName).includes(normalizeKey(goal.name))) ||
          [...availableCards].sort((first, second) => second.currentBalance - first.currentBalance)[0];
        return matchingCard ? { ...goal, linkedCreditCardId: matchingCard.id } : goal;
      }

      if (goal.type === "Pay Off Debt" && !goal.linkedDebtId) {
        const matchingDebt =
          availableDebts.find((debt) => normalizeKey(goal.name).includes(normalizeKey(debt.name))) ||
          availableDebts.find((debt) => normalizeKey(debt.name).includes(normalizeKey(goal.name))) ||
          [...availableDebts].sort((first, second) => second.remainingBalance - first.remainingBalance)[0];
        return matchingDebt ? { ...goal, linkedDebtId: matchingDebt.id } : goal;
      }

      return goal;
    });
  }

  function downloadTemplate() {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([{ Name: "Monthly salary", Type: "Salary", Amount: 25000 }]),
      "Income Sources",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([
        {
          Name: "School fees",
          Category: "Education",
          Amount: 25000,
          Frequency: "One-Time",
          "Due Date": "2026-08-10",
          "Start Date": "2026-06-01",
          "End Date": "",
          "Allocation Method": "Spread amount monthly until due date",
          "Saved Amount": 0,
          Notes: "",
        },
      ]),
      "Obligations",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([{ "Card Name": "Rewards card", Provider: "Bank", Balance: 5000, Limit: 20000, "Minimum Payment": 500, "Statement Total": 1500, "Due Date": "2026-07-18", APR: 18, Notes: "" }]),
      "Credit Cards",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([{ "Goal Name": "Emergency fund", Type: "Emergency Fund", "Target Amount": 60000, "Current Amount": 5000, "Target Date": "2027-12-31", Priority: "High", Notes: "" }]),
      "Goals",
    );
    XLSX.writeFile(workbook, "DebtIQ-import-template.xlsx");
  }

  function createLead() {
    if (!consentOffer || !consent) return;
    setLeads((current) => [
      {
        id: crypto.randomUUID(),
        userName: profile.fullName,
        mobile: profile.mobile,
        email: profile.email,
        offerSelected: consentOffer.title,
        timestamp: new Date().toISOString(),
        status: "New",
      },
      ...current,
    ]);
    setConsentOffer(null);
    setConsent(false);
  }

  function toggleQuickSetupItem(item: string) {
    setQuickSetup((current) => ({
      ...current,
      importantItems: current.importantItems.includes(item)
        ? current.importantItems.filter((selected) => selected !== item)
        : [...current.importantItems, item],
    }));
  }

  function quickSetupGoalType(goal: QuickSetupForm["primaryGoal"]): GoalType {
    if (goal === "Pay Off Debt" || goal === "Emergency Fund" || goal === "Travel" || goal === "School Fees" || goal === "Other") return goal;
    return "Other";
  }

  function quickSetupGoalLabel(goal: QuickSetupForm["primaryGoal"]) {
    if (language === "ar") {
      const labels: Record<QuickSetupForm["primaryGoal"], string> = {
        "Emergency Fund": "صندوق الطوارئ",
        "Pay Off Debt": "سداد الديون",
        "Buy Something Important": "شراء شيء مهم",
        Travel: "السفر",
        "School Fees": "رسوم المدارس",
        Other: "هدف آخر",
      };
      return labels[goal];
    }
    return goal === "Buy Something Important" ? "Buy something important" : goal;
  }

  async function completeQuickSetup() {
    if (sessionMode !== "real" || !currentUserId) {
      setAuthError(validationMessage("Create or log in to continue.", "أنشئ حساباً أو سجل الدخول للمتابعة."));
      return;
    }

    if (quickSetup.monthlyIncome <= 0) {
      setAuthError(validationMessage("Add your approximate monthly income to continue.", "أضف دخلك الشهري التقريبي للمتابعة."));
      setQuickSetupStep(1);
      return;
    }

    if (quickSetup.hasMonthlyObligations && quickSetup.monthlyObligationAmount <= 0) {
      setAuthError(validationMessage("Add the monthly obligation amount, or choose No.", "أضف مبلغ الالتزامات الشهرية أو اختر لا."));
      setQuickSetupStep(3);
      return;
    }

    const prefix = `quick-setup:${currentUserId}`;
    const now = new Date();
    const nextIncomeSources: IncomeSource[] = [
      {
        id: `${prefix}:income`,
        name: "Approximate monthly income",
        amount: quickSetup.monthlyIncome,
        type: "Salary",
        recurring: true,
        notes: "Added from one minute setup.",
      },
      ...incomeSources.filter((income) => !String(income.id).startsWith(`${prefix}:`)),
    ];

    const starterCards: CreditCard[] =
      quickSetup.creditCards === "none"
        ? []
        : Array.from({ length: quickSetup.creditCards === "multiple" ? 2 : 1 }, (_, index) => ({
            id: `${prefix}:card:${index + 1}`,
            cardName: index === 0 ? "Credit card" : `Credit card ${index + 1}`,
            provider: "Card provider",
            creditLimit: Math.max(10000, Math.round(quickSetup.monthlyIncome * 0.6)),
            currentBalance: 0,
            minimumPaymentDue: 0,
            statementTotalDue: 0,
            dueDate: dateFromDueDay(20),
            aprOrProfitRate: 18,
            notes: "Added from one minute setup. Add balance later for better insights.",
          }));

    const starterObligations: ObligationEntry[] = quickSetup.hasMonthlyObligations
      ? [
          {
            id: `${prefix}:obligation:monthly`,
            name: "Monthly obligations",
            monthlyAmount: quickSetup.monthlyObligationAmount,
            category: "Other",
            dueDay: 1,
            isRecurring: true,
            frequency: "Monthly",
            dueDate: dateFromDueDay(1),
            startDate: isoDate(now),
            allocationMethod: "Count full amount only in due month",
            savedAmount: 0,
            notes: "Added from one minute setup.",
          },
        ]
      : [];

    const importantGoals: Goal[] = quickSetup.importantItems.map((item, index) => ({
      id: `${prefix}:important:${normalizeKey(item) || index}`,
      name: item,
      type: item === "School fees" ? "School Fees" : item === "Travel plans" ? "Travel" : "Other",
      targetAmount: item === "School fees" ? 25000 : item === "Travel plans" ? 12000 : 10000,
      currentAmount: 0,
      targetDate: "2027-12-31",
      priority: item === "School fees" ? "High" : "Medium",
      notes: "Flagged as important during one minute setup.",
    }));

    const primaryGoal: Goal = {
      id: `${prefix}:goal:primary`,
      name: quickSetupGoalLabel(quickSetup.primaryGoal),
      type: quickSetupGoalType(quickSetup.primaryGoal),
      targetAmount:
        quickSetup.primaryGoal === "Emergency Fund"
          ? Math.max(10000, Math.round(quickSetup.monthlyIncome * 3))
          : quickSetup.primaryGoal === "School Fees"
            ? 25000
            : quickSetup.primaryGoal === "Travel"
              ? 12000
              : quickSetup.primaryGoal === "Pay Off Debt"
                ? 20000
                : 15000,
      currentAmount: 0,
      targetDate: "2027-12-31",
      priority: "High",
      notes: "Primary goal from one minute setup.",
    };

    const nextData: UserOwnedData = {
      ...currentUserData(),
      incomeSources: nextIncomeSources,
      creditCards: [...starterCards, ...creditCards.filter((card) => !String(card.id).startsWith(`${prefix}:`))],
      obligationEntries: [...starterObligations, ...obligationEntries.filter((obligation) => !String(obligation.id).startsWith(`${prefix}:`))],
      goals: [primaryGoal, ...importantGoals, ...goals.filter((goal) => !String(goal.id).startsWith(`${prefix}:`))],
    };

    const obligationRatio = quickSetup.hasMonthlyObligations
      ? Math.round((quickSetup.monthlyObligationAmount / quickSetup.monthlyIncome) * 100)
      : 0;
    const surplus = quickSetup.monthlyIncome - (quickSetup.hasMonthlyObligations ? quickSetup.monthlyObligationAmount : 0);
    const suggestedSaving = Math.max(0, Math.round((surplus * 0.2) / 100) * 100);
    const goalMonths = suggestedSaving > 0 ? Math.ceil(primaryGoal.targetAmount / suggestedSaving) : 0;
    const summary = language === "ar"
      ? quickSetup.hasMonthlyObligations
        ? `التزاماتك تستهلك تقريباً ${obligationRatio}% من دخلك. ${suggestedSaving > 0 ? `توفير ${currency.format(suggestedSaving)} شهرياً قد يساعدك على الاقتراب من هدفك خلال ${goalMonths} شهر.` : "ابدأ بإضافة تفاصيل أكثر لتحصل على توصيات أدق."}`
        : `صورتك المالية الأولى جاهزة. يمكنك البدء بتوفير جزء من دخلك لهدف ${quickSetupGoalLabel(quickSetup.primaryGoal)}.`
      : quickSetup.hasMonthlyObligations
        ? `Your obligations consume about ${obligationRatio}% of your income. ${suggestedSaving > 0 ? `Saving ${currency.format(suggestedSaving)} monthly can help you move toward your goal in ${goalMonths} months.` : "Add more details to get sharper recommendations."}`
        : `Your first financial picture is ready. You can start allocating part of your income toward ${quickSetupGoalLabel(quickSetup.primaryGoal)}.`;

    writeJson(userStorageKey(currentUserId), nextData);
    if (isSupabaseConfigured && supabase) {
      await saveQuickSetupDataToSupabase(currentUserId, nextData);
      await updateSupabaseQuickSetupStatus(currentUserId, "completed");
    } else {
      writeJson(quickSetupDoneStorageKey(currentUserId), true);
    }
    applyUserData(nextData);
    setQuickSetupSummary(summary);
    setQuickSetupStep(6);
    setAuthError("");
    setHasUnsavedChanges(false);
    setSaveStatus(t.common.savedSuccessfully);
    window.setTimeout(() => setSaveStatus(""), 2500);
  }

  async function skipQuickSetup() {
    if (currentUserId) {
      if (isSupabaseConfigured && supabase) {
        await updateSupabaseQuickSetupStatus(currentUserId, "skipped");
      } else {
        writeJson(quickSetupDoneStorageKey(currentUserId), true);
      }
    }
    setQuickSetupSummary("");
    setFlow("app");
    setActive("dashboard");
  }

  async function openDashboardFromQuickSetup() {
    if (currentUserId) {
      if (isSupabaseConfigured && supabase) {
        await updateSupabaseQuickSetupStatus(currentUserId, "completed");
      } else {
        writeJson(quickSetupDoneStorageKey(currentUserId), true);
      }
    }
    setFlow("app");
    setActive("dashboard");
  }

  function handleQuickSetupNext() {
    setAuthError("");
    if (quickSetupStep === 0) {
      setQuickSetupStep(1);
      return;
    }
    if (quickSetupStep === 1 && quickSetup.monthlyIncome <= 0) {
      setAuthError(validationMessage("Add your approximate monthly income to continue.", "أضف دخلك الشهري التقريبي للمتابعة."));
      return;
    }
    if (quickSetupStep === 3 && quickSetup.hasMonthlyObligations && quickSetup.monthlyObligationAmount <= 0) {
      setAuthError(validationMessage("Add the monthly obligation amount, or choose No.", "أضف مبلغ الالتزامات الشهرية أو اختر لا."));
      return;
    }
    if (quickSetupStep >= 5) {
      void completeQuickSetup();
      return;
    }
    setQuickSetupStep((current) => Math.min(5, current + 1));
  }

  function handleQuickSetupBack() {
    setAuthError("");
    setQuickSetupStep((current) => Math.max(0, current - 1));
  }

  function startRegistration() {
    const previousSession = readJson<StoredSession | null>(sessionStorageKey, null);
    if (previousSession?.mode === "real" && previousSession.userId) {
      removeStoredItem(onboardingProgressStorageKey(previousSession.userId));
      removeStoredItem(draftStorageKey(previousSession.userId));
    }
    removeStoredItem(sessionStorageKey);
    removeStoredItem(registrationDraftStorageKey);
    clearUserData();
    setRegistration(emptyRegistration);
    setLogin(emptyLogin);
    setCurrentUserId("");
    setSessionMode("signedOut");
    setOnboardingMode("quick");
    setOnboardingStep(1);
    setQuickSetup(emptyQuickSetup);
    setQuickSetupStep(0);
    setQuickSetupSummary("");
    setAuthError("");
    setSignupDiagnostic(emptySignupDiagnostic);
    setLastOnboardingError("");
    setFlow("register");
    setActive("profile");
  }

  function startLogin() {
    setAuthError("");
    setForgotPassword(false);
    setFlow("login");
    setActive("profile");
  }

  function startDemoMode(persona: "karim" | "karima" = "karim") {
    if (sessionMode === "real") return;
    const demoUserId = persona === "karima" ? "demo-karima" : "demo-karim";
    applyUserData(getDemoUserData(demoUserId));
    setCurrentUserId("");
    setSessionMode("demo");
    writeJson(sessionStorageKey, { mode: "demo", userId: demoUserId, authProvider: "demo" } satisfies StoredSession);
    setSessionStatus("Demo Mode \u2014 sample data only");
    setFlow("app");
    setActive("dashboard");
  }

  function openRegistrationFromLanding() {
    if (pathname === "/landing") {
      router.push("/?mode=register");
      return;
    }
    startRegistration();
  }

  function openLoginFromLanding() {
    if (pathname === "/landing") {
      router.push("/?mode=login");
      return;
    }
    startLogin();
  }

  function openDemoFromLanding(persona: "karim" | "karima" = "karim") {
    startDemoMode(persona);
    if (pathname !== "/app") {
      router.push("/app");
    }
  }

  function performLogout() {
    removeStoredItem(sessionStorageKey);
    clearUserData();
    setCurrentUserId("");
    setSessionMode("signedOut");
    setLogin(emptyLogin);
    setReset(emptyReset);
    setAuthError("");
    setSessionStatus("Logged out. Sign in or create an account to continue.");
    setFlow("app");
    setActive("profile");
  }

  function logout() {
    requestUnsavedAction(performLogout);
  }

  async function completeLogin() {
    if (!login.email || !login.password) {
      setAuthError(validationMessage("Enter your email and password.", "أدخل البريد الإلكتروني وكلمة المرور."));
      return;
    }

    if (!isValidEmail(login.email)) {
      setAuthError(validationMessage("Enter a valid email address.", "الرجاء إدخال بريد إلكتروني صحيح."));
      return;
    }

    const normalizedLoginEmail = normalizeEmail(login.email);
    if (isSupabaseConfigured && supabase) {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: normalizedLoginEmail,
        password: login.password,
      });

      if (error || !authData.user) {
        const message = error?.message || "Supabase did not return an authenticated user.";
        setAuthError(message);
        setSessionStatus(`Login source: Supabase. Error: ${message}`);
        setSessionMode("signedOut");
        setCurrentUserId("");
        clearUserData();
        removeStoredItem(sessionStorageKey);
        return;
      }

      const userId = authData.user.id;
      let loadedSupabaseData: SupabaseOwnedDataResult;
      try {
        loadedSupabaseData = await loadSupabaseOwnedData(userId, authData.user.email || normalizedLoginEmail);
      } catch (error) {
        const profileError = summarizeSupabaseError(error);
        setAuthError(validationMessage(
          "Your account exists, but the profile could not be loaded. Please contact the DebtIQ team.",
          "الحساب موجود، لكن تعذر تحميل الملف الشخصي. الرجاء التواصل مع فريق ديبت آي كيو.",
        ));
        setSessionStatus(`Supabase profile load failed: ${profileError.message}. No dashboard session was opened.`);
        setSessionMode("signedOut");
        setCurrentUserId("");
        clearUserData();
        removeStoredItem(sessionStorageKey);
        return;
      }

      const ownedData = loadedSupabaseData.data;
      writeJson(sessionStorageKey, {
        mode: "real",
        userId,
        authProvider: "supabase",
        onboardingStatus: "complete",
        onboardingStep: 4,
        onboardingMode: "quick",
      } satisfies StoredSession);
      writeJson(userStorageKey(userId), ownedData);
      applyUserData(ownedData);
      setCurrentUserId(userId);
      setSessionMode("real");
      setAuthError("");
      setSessionStatus(`Logged in as ${ownedData.profile.email}`);
      if (!loadedSupabaseData.quickSetupCompleted && !loadedSupabaseData.quickSetupSkipped && !hasBasicFinancialPicture(ownedData)) {
        setQuickSetup(emptyQuickSetup);
        setQuickSetupStep(0);
        setQuickSetupSummary("");
        setFlow("quickSetup");
      } else {
        setFlow("app");
      }
      setActive("dashboard");
      return;
    }

    const betaUser = findRegisteredBetaUser(normalizedLoginEmail);
    if (betaUser?.passwordHash && betaUser.passwordHash === betaPasswordHash(login.password)) {
      const lastLoginAt = new Date().toISOString();
      const userData = readUserData(betaUser.id);
      const restoredData: UserOwnedData = {
        ...emptyUserData,
        ...userData,
        profile: {
          ...emptyProfile,
          ...userData.profile,
          fullName: userData.profile.fullName || betaUser.fullName,
          mobile: userData.profile.mobile || betaUser.mobile,
          email: normalizedLoginEmail,
        },
      };
      writeJson(userStorageKey(betaUser.id), restoredData);
      writeJson(sessionStorageKey, {
        mode: "real",
        userId: betaUser.id,
        authProvider: "local-registration",
        onboardingStatus: "complete",
        onboardingStep: 4,
        onboardingMode: "quick",
      } satisfies StoredSession);
      removeStoredItem(onboardingProgressStorageKey(betaUser.id));
      removeStoredItem(draftStorageKey(betaUser.id));
      upsertRegisteredBetaUser({
        ...betaUser,
        status: "Active",
        deleted: false,
        onboardingStatus: "complete",
        userType: "Real",
        lastLoginAt,
      });
      applyUserData(restoredData);
      setCurrentUserId(betaUser.id);
      setSessionMode("real");
      setAuthError("");
      setSessionStatus(`Logged in as ${normalizedLoginEmail}`);
      if (!hasBasicFinancialPicture(restoredData) && !readJson<boolean>(quickSetupDoneStorageKey(betaUser.id), false)) {
        setQuickSetup(emptyQuickSetup);
        setQuickSetupStep(0);
        setQuickSetupSummary("");
        setFlow("quickSetup");
      } else {
        setFlow("app");
      }
      setActive("dashboard");
      return;
    }

    if (!betaUser || betaUser.passwordHash !== betaPasswordHash(login.password)) {
      setAuthError(validationMessage(
        betaUser ? "Invalid email or password. Please check your credentials or use Try Demo." : "This user does not exist in the beta users registry. Please register or use Try Demo.",
        betaUser ? "البريد الإلكتروني أو كلمة المرور غير صحيحة. الرجاء التحقق من البيانات أو استخدام النسخة التجريبية." : "هذا المستخدم غير موجود في سجل مستخدمي بيتا. الرجاء التسجيل أو استخدام النسخة التجريبية.",
      ));
      setSessionStatus(validationMessage(
        "Login source: debtiq.users.registry.v1. No user session was created.",
        "مصدر تسجيل الدخول: debtiq.users.registry.v1. لم يتم إنشاء جلسة مستخدم.",
      ));
      setSessionMode("signedOut");
      setCurrentUserId("");
      clearUserData();
      removeStoredItem(sessionStorageKey);
      return;
    }

  }

  function sendResetLink() {
    if (!reset.email) {
      setAuthError(validationMessage("Enter your email to send a reset link.", "أدخل بريدك الإلكتروني لإرسال رابط إعادة التعيين."));
      return;
    }

    if (!isValidEmail(reset.email)) {
      setAuthError(validationMessage("Enter a valid email address.", "الرجاء إدخال بريد إلكتروني صحيح."));
      return;
    }

    setAuthError("");
    setSessionStatus(validationMessage("If this email exists, a password reset link will be sent.", "إذا كان هذا البريد موجوداً، سيتم إرسال رابط إعادة تعيين كلمة المرور."));
    setForgotPassword(false);
  }

  async function completeRegistration() {
    if (registrationProcessingRef.current) {
      setRegistrationClickDebug((current) => ({
        ...current,
        clicks: current.clicks + 1,
        phase: "already-processing",
        lastError: "Registration is already processing.",
      }));
      setSessionStatus(validationMessage("Processing...", "جاري المعالجة..."));
      return;
    }

    registrationProcessingRef.current = true;
    const startedAt = performance.now();
    const timings: string[] = [];
    const mark = (label: string) => {
      timings.push(`${label}: ${Math.round(performance.now() - startedAt)}ms`);
      setRegistrationClickDebug((current) => ({ ...current, timings: [...timings] }));
      console.info("DebtIQ signup timing", { label, elapsedMs: Math.round(performance.now() - startedAt) });
    };
    const failRegistration = (message: string, validation = "failed") => {
      setAuthError(message);
      setRegistrationClickDebug((current) => ({
        ...current,
        phase: "error",
        lastValidation: validation,
        lastError: message,
        timings: [...timings],
      }));
    };
    let successRedirectQueued = false;
    const routeAfterSuccess = () => {
      successRedirectQueued = true;
      window.setTimeout(() => {
        registrationProcessingRef.current = false;
        setRegistrationAction("");
        setRegistrationSuccessMessage("");
        setFlow("quickSetup");
        setActive("dashboard");
      }, 650);
    };

    setRegistrationAction(validationMessage("Processing...", "جاري المعالجة..."));
    setRegistrationSuccessMessage("");
    setAuthError("");
    setRegistrationClickDebug((current) => ({
      clicks: current.clicks + 1,
      phase: "processing",
      lastValidation: "running",
      lastError: "none",
      timings: [],
    }));
    setSessionStatus(validationMessage("Processing...", "جاري المعالجة..."));

    try {
      mark("signup click");
      writeJson(registrationDraftStorageKey, {
        fullName: registration.fullName,
        mobile: registration.mobile,
        email: registration.email,
        registrationSuccess: false,
      } satisfies RegistrationDraft);

      if (!registration.fullName || !registration.mobile || !registration.email || !registration.password) {
        failRegistration(validationMessage("Complete all registration fields to continue.", "أكمل جميع حقول التسجيل للمتابعة."));
        return;
      }

      if (!isValidEmail(registration.email)) {
        failRegistration(validationMessage("Enter a valid email address.", "الرجاء إدخال بريد إلكتروني صحيح."));
        return;
      }

      if (!isValidSaudiMobile(registration.mobile)) {
        failRegistration(validationMessage("Enter a valid Saudi mobile number.", "الرجاء إدخال رقم جوال سعودي صحيح."));
        return;
      }

      if (!isStrongPassword(registration.password)) {
        failRegistration(validationMessage("Password does not meet the security requirements.", "كلمة المرور لا تحقق متطلبات الأمان."));
        return;
      }

      if (registration.confirmPassword && registration.password !== registration.confirmPassword) {
        failRegistration(validationMessage("Password and confirm password must match.", "كلمة المرور وتأكيد كلمة المرور غير متطابقين."));
        return;
      }
      mark("validation");

      const normalizedEmail = normalizeEmail(registration.email);
      const userId = userIdFromEmail(normalizedEmail);
      if (isSupabaseConfigured && supabase) {
        setSignupDiagnostic({ ...emptySignupDiagnostic, email: normalizedEmail });
        let supabaseUserId = "";
        const { data: existingProfile, error: existingProfileError } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", normalizedEmail)
          .maybeSingle<{ id: string }>();

        if (existingProfileError) {
          setSessionStatus(`Supabase duplicate email check failed: ${existingProfileError.message}`);
          setSignupDiagnostic({
            ...emptySignupDiagnostic,
            status: "failed",
            email: normalizedEmail,
            errorCode: String(existingProfileError.code || ""),
            errorMessage: existingProfileError.message,
            errorStatus: "",
            profileInsert: "Not attempted because duplicate email check failed before signUp.",
          });
          failRegistration(existingProfileError.message, "duplicate-check-failed");
          return;
        }

        if (existingProfile) {
          setSignupDiagnostic({
            ...emptySignupDiagnostic,
            status: "failed",
            email: normalizedEmail,
            errorCode: "duplicate_profile",
            errorMessage: "A profile already exists for this email.",
            profileInsert: "Not attempted because duplicate email check found an existing profile.",
          });
          failRegistration(validationMessage("An account already exists for this email. Please log in instead.", "يوجد حساب بهذا البريد الإلكتروني. الرجاء تسجيل الدخول بدلاً من إنشاء حساب جديد."), "duplicate-email");
          return;
        }
        mark("duplicate check");

        console.info("DebtIQ signup attempt", { email: normalizedEmail });
        const signUpStartedAt = performance.now();
        const signUpResponse = await supabase.auth.signUp({
          email: normalizedEmail,
          password: registration.password,
          options: {
            data: {
              full_name: registration.fullName,
              mobile: normalizeSaudiMobile(registration.mobile),
            },
          },
        });
        mark(`Supabase signup (${Math.round(performance.now() - signUpStartedAt)}ms)`);
        const { data: authData, error } = signUpResponse;
        const signupError = summarizeSupabaseError(error);
        const signupDiagnosticBase: SignupDiagnostic = {
          status: error || !authData.user ? "failed" : "success",
          email: normalizedEmail,
          user: safeJson(summarizeSupabaseUser(authData.user)),
          session: safeJson(summarizeSupabaseSession(authData.session)),
          errorCode: signupError.code,
          errorMessage: signupError.message,
          errorStatus: signupError.status,
          profileInsert: "Not attempted yet.",
        };
        console.info("DebtIQ signup response", {
          email: normalizedEmail,
          data: {
            user: summarizeSupabaseUser(authData.user),
            session: summarizeSupabaseSession(authData.session),
          },
          error: signupError,
        });
        setSignupDiagnostic(signupDiagnosticBase);

        if (error || !authData.user) {
          failRegistration(error?.message || validationMessage("Could not create your account. Please try again.", "تعذر إنشاء الحساب. الرجاء المحاولة مرة أخرى."), "signup-failed");
          return;
        }

        const createdAt = new Date().toISOString();
        supabaseUserId = authData.user.id;
        const profilePayload = {
          id: supabaseUserId,
          email: normalizedEmail,
          full_name: registration.fullName,
          mobile: normalizeSaudiMobile(registration.mobile),
          role: "consumer",
          created_at: createdAt,
          updated_at: createdAt,
        };
        const profileStartedAt = performance.now();
        const profileInsertResponse = await supabase
          .from("profiles")
          .upsert(profilePayload)
          .select("id, full_name, mobile, email, role, created_at, updated_at")
          .maybeSingle();
        mark(`profile creation (${Math.round(performance.now() - profileStartedAt)}ms)`);
        const profileInsertSummary = {
          data: profileInsertResponse.data,
          error: profileInsertResponse.error
            ? {
                code: profileInsertResponse.error.code,
                message: profileInsertResponse.error.message,
                details: profileInsertResponse.error.details,
                hint: profileInsertResponse.error.hint,
              }
            : null,
          status: profileInsertResponse.status,
          statusText: profileInsertResponse.statusText,
        };
        console.info("DebtIQ profile insert response", { email: normalizedEmail, profileInsertResponse: profileInsertSummary });
        setSignupDiagnostic({
          ...signupDiagnosticBase,
          profileInsert: safeJson(profileInsertSummary),
        });
        if (profileInsertResponse.error) {
          failRegistration(profileInsertResponse.error.message || validationMessage("Account created, but profile setup failed. Please contact the DebtIQ team.", "تم إنشاء الحساب، لكن فشل إعداد الملف الشخصي. الرجاء التواصل مع فريق ديبت آي كيو."), "profile-failed");
          return;
        }

        const ownedData = userDataFromProfile({
          ...emptyProfile,
          fullName: registration.fullName,
          mobile: normalizeSaudiMobile(registration.mobile),
          email: normalizedEmail,
        });
        writeJson(sessionStorageKey, {
          mode: "real",
          userId: supabaseUserId,
          authProvider: "supabase",
          onboardingStatus: "complete",
          onboardingStep: 4,
          onboardingMode: "quick",
        } satisfies StoredSession);
        writeJson(userStorageKey(supabaseUserId), ownedData);
        writeJson(registrationDraftStorageKey, {
          fullName: registration.fullName,
          mobile: normalizeSaudiMobile(registration.mobile),
          email: normalizedEmail,
          registrationSuccess: true,
        } satisfies RegistrationDraft);
        removeStoredItem(registrationDraftStorageKey);
        applyUserData(ownedData);
        setCurrentUserId(supabaseUserId);
        setSessionMode("real");
        setAuthError("");
        setSessionStatus(`Logged in as ${normalizedEmail}`);
        setOnboardingMode("quick");
        setOnboardingStep(4);
        setQuickSetup(emptyQuickSetup);
        setQuickSetupStep(0);
        setQuickSetupSummary("");
        setRegistrationSuccessMessage(validationMessage("Welcome to DebtIQ 👋", "✅ تم إنشاء الحساب بنجاح"));
        mark("session creation");
        setRegistrationClickDebug((current) => ({ ...current, phase: "success", lastValidation: "passed", lastError: "none", timings: [...timings] }));
        routeAfterSuccess();
        return;
      }

      const existingUser = findRegisteredBetaUser(normalizedEmail);
      if (existingUser) {
        failRegistration(validationMessage("An account already exists for this email. Please log in instead.", "يوجد حساب بهذا البريد الإلكتروني. الرجاء تسجيل الدخول بدلاً من إنشاء حساب جديد."), "duplicate-email");
        return;
      }
      mark("local duplicate check");

      const ownedData: UserOwnedData = {
        ...emptyUserData,
        profile: {
          ...emptyProfile,
          fullName: registration.fullName,
          mobile: normalizeSaudiMobile(registration.mobile),
          email: normalizedEmail,
        },
      };
      const createdAt = new Date().toISOString();
      removeStoredItem(onboardingProgressStorageKey(userId));
      removeStoredItem(draftStorageKey(userId));
      const initialOnboardingStep = 4;
      const initialOnboardingMode: OnboardingMode = "quick";

      writeJson(sessionStorageKey, {
        mode: "real",
        userId,
        authProvider: "local-registration",
        onboardingStatus: "complete",
        onboardingStep: initialOnboardingStep,
        onboardingMode: initialOnboardingMode,
      } satisfies StoredSession);
      writeJson(userStorageKey(userId), ownedData);
      removeStoredItem(onboardingProgressStorageKey(userId));
      removeStoredItem(draftStorageKey(userId));
      writeJson(registrationDraftStorageKey, {
        fullName: registration.fullName,
        mobile: normalizeSaudiMobile(registration.mobile),
        email: normalizedEmail,
        registrationSuccess: true,
      } satisfies RegistrationDraft);
      removeStoredItem(registrationDraftStorageKey);
      upsertRegisteredBetaUser({
        id: userId,
        email: normalizedEmail,
        normalizedEmail,
        fullName: ownedData.profile.fullName,
        mobile: ownedData.profile.mobile,
        createdAt,
        lastLoginAt: createdAt,
        status: "Active",
        deleted: false,
        onboardingStatus: "complete",
        userType: "Real",
        passwordHash: betaPasswordHash(registration.password),
      });

      applyUserData(ownedData);
      setCurrentUserId(userId);
      setSessionMode("real");
      setAuthError("");
      setSessionStatus(`Logged in as ${normalizedEmail}`);
      setOnboardingMode(initialOnboardingMode);
      setOnboardingStep(initialOnboardingStep);
      setQuickSetup(emptyQuickSetup);
      setQuickSetupStep(0);
      setQuickSetupSummary("");
      setRegistrationSuccessMessage(validationMessage("Welcome to DebtIQ 👋", "✅ تم إنشاء الحساب بنجاح"));
      mark("session creation");
      setRegistrationClickDebug((current) => ({ ...current, phase: "success", lastValidation: "passed", lastError: "none", timings: [...timings] }));
      routeAfterSuccess();
    } catch (error) {
      const signupError = summarizeSupabaseError(error);
      console.error("DebtIQ signup exception", { email: normalizeEmail(registration.email), error });
      setSignupDiagnostic({
        ...emptySignupDiagnostic,
        status: "failed",
        email: normalizeEmail(registration.email),
        errorCode: signupError.code,
        errorMessage: signupError.message,
        errorStatus: signupError.status,
        profileInsert: "Not attempted because registration threw an exception.",
      });
      failRegistration(signupError.message || validationMessage("Could not create your account. Please try again.", "تعذر إنشاء الحساب. الرجاء المحاولة مرة أخرى."), "exception");
    } finally {
      mark("dashboard redirect queued");
      if (!successRedirectQueued) {
        registrationProcessingRef.current = false;
        setRegistrationAction("");
      }
    }
  }

  function completeOnboarding(action = "generate") {
    if (onboardingProcessingRef.current) return;
    onboardingProcessingRef.current = true;
    setOnboardingAction(action);
    setLastOnboardingError("");
    setLastOnboardingErrorStack("");
    setOnboardingDebug((current) => ({ ...current, lastAction: action, generationStatus: "processing" }));

    if (sessionMode === "real") {
      const storedSession = readJson<StoredSession | null>(sessionStorageKey, null);
      if (storedSession?.onboardingStatus === "complete") {
        setOnboardingDebug((current) => ({ ...current, lastValidation: "already-complete", generationStatus: "complete" }));
        setFlow("app");
        setActive("dashboard");
        setOnboardingAction("");
        onboardingProcessingRef.current = false;
        return;
      }
    }

    finalizeOnboardingCompletion(action);

    const onboardingAmounts = [
      onboarding.monthlyNetSalary,
      onboarding.basicSalary,
      onboarding.housingAllowance,
      onboarding.transportAllowance,
      onboarding.otherAllowance,
      onboarding.otherIncome,
      onboarding.annualBonus,
      onboarding.existingLoans,
      onboarding.creditCards,
    ];

    const skipBlockingOnboardingValidation = true;
    if (!skipBlockingOnboardingValidation && onboardingAmounts.some((amount) => amount < 0)) {
      setAuthError(validationMessage("Amounts cannot be negative.", "لا يمكن أن تكون المبالغ سالبة."));
      setOnboardingDebug((current) => ({ ...current, lastValidation: "negative-amount", generationStatus: "error" }));
      setOnboardingAction("");
      onboardingProcessingRef.current = false;
      return;
    }

    if (!skipBlockingOnboardingValidation && onboarding.annualBonus > 0 && !onboarding.annualBonusMonth) {
      setAuthError(validationMessage("Select an expected month for bonus income.", "اختر الشهر المتوقع للبونص."));
      setOnboardingDebug((current) => ({ ...current, lastValidation: "missing-bonus-month", generationStatus: "error" }));
      setOnboardingAction("");
      onboardingProcessingRef.current = false;
      return;
    }

    setAuthError("");
    setOnboardingDebug((current) => ({ ...current, lastValidation: "passed", generationStatus: "generating" }));
    try {
      const generatedDebts: Debt[] = [];
      const generatedPrefix = `onboarding:${currentUserId || "local"}`;
      const salaryTotal =
        incomeEntryMode === "detailed"
          ? onboarding.basicSalary + onboarding.housingAllowance + onboarding.transportAllowance + onboarding.otherAllowance + onboarding.otherIncome
          : onboarding.monthlyNetSalary;
      const withoutGeneratedSalary = incomeSources.filter((income) => income.name !== "Monthly net salary" && income.name !== "Detailed monthly income" && !isAnnualBonusIncome(income));
      const bonusIncome: IncomeSource[] = onboarding.annualBonus > 0
        ? [{
            id: createClientId("bonus"),
            name: "Annual bonus",
            amount: onboarding.annualBonus,
            type: "Bonus",
            expectedMonth: onboarding.annualBonusMonth,
            guaranteed: onboarding.annualBonusGuaranteed,
            allocation: "Keep unallocated for now",
            notes: "",
          }]
        : [];
      const nextIncomeSources =
        salaryTotal > 0
          ? [
              {
                id: createClientId("income"),
                name: incomeEntryMode === "detailed" ? "Detailed monthly income" : "Monthly net salary",
                amount: salaryTotal,
                type: "Salary" as IncomeType,
              },
              ...bonusIncome,
              ...withoutGeneratedSalary,
            ]
          : incomeSources;
      const nextProfile = {
        ...profile,
        employer: skipEmployer ? "" : profile.employer,
      };

    if (onboarding.existingLoans > 0) {
      generatedDebts.push({
        id: `${generatedPrefix}:debt:loans`,
        type: "Personal Loan",
        name: "Existing loans",
        bank: "Multiple providers",
        remainingBalance: onboarding.existingLoans,
        monthlyInstallment: Math.round(onboarding.existingLoans * 0.03),
        interestRate: 5,
        endDate: "2030-12-31",
      });
    }

    if (onboarding.creditCards > 0) {
      generatedDebts.push({
        id: `${generatedPrefix}:debt:cards`,
        type: "Credit Card",
        name: "Credit card balance",
        bank: "Card providers",
        remainingBalance: onboarding.creditCards,
        monthlyInstallment: Math.round(onboarding.creditCards * 0.08),
        interestRate: 18,
        endDate: "2027-12-31",
        limit: Math.max(onboarding.creditCards * 1.5, onboarding.creditCards + 1),
      });
    }

    const debtObligations: ObligationEntry[] = [];

    if (onboarding.existingLoans > 0) {
      debtObligations.push({
        id: `${generatedPrefix}:obligation:loans`,
        name: "Existing loan payment",
        monthlyAmount: Math.round(onboarding.existingLoans * 0.03),
        category: "Loan",
        dueDay: 3,
        isRecurring: true,
        frequency: "Monthly",
        dueDate: dateFromDueDay(3),
        startDate: isoDate(new Date()),
        allocationMethod: "Count full amount only in due month",
        savedAmount: 0,
        notes: "Generated during onboarding.",
      });
    }

    if (onboarding.creditCards > 0) {
      debtObligations.push({
        id: `${generatedPrefix}:obligation:cards`,
        name: "Credit card payment",
        monthlyAmount: Math.round(onboarding.creditCards * 0.08),
        category: "Credit Card",
        dueDay: 18,
        isRecurring: true,
        frequency: "Monthly",
        dueDate: dateFromDueDay(18),
        startDate: isoDate(new Date()),
        allocationMethod: "Count full amount only in due month",
        savedAmount: 0,
        notes: "Generated during onboarding.",
      });
    }

    const preservedDebts = debts.filter((debt) => !debt.id.startsWith(`${generatedPrefix}:debt:`) && !["Existing loans", "Credit card balance"].includes(debt.name));
    const nextDebts = [...preservedDebts, ...generatedDebts];
    const preservedObligations = obligationEntries.filter((obligation) =>
      obligation.monthlyAmount > 0 &&
      !obligation.id.startsWith(`${generatedPrefix}:obligation:`) &&
      obligation.notes !== "Generated during onboarding." &&
      !["Existing loan payment", "Credit card payment"].includes(obligation.name)
    );
    const nextObligations = [...debtObligations, ...preservedObligations];

    setIncomeSources(nextIncomeSources);
    setProfile(nextProfile);
    setDebts(nextDebts);
    setObligationEntries(nextObligations);
    const nextGoals = Array.isArray(goals) ? goals.filter(Boolean) : [];
    setGoals(nextGoals);
    const nextUserData: UserOwnedData = {
      profile: nextProfile,
      debts: nextDebts,
      creditCards,
      incomeSources: nextIncomeSources,
      obligationEntries: nextObligations,
      goals: nextGoals,
      leads,
    };
    const validationError = validateFinancialData(nextUserData);
    if (validationError) {
      throw new Error(`Onboarding validation failed: ${validationError}`);
    }
    if (sessionMode === "real" && currentUserId) {
      const storedSession = readJson<StoredSession | null>(sessionStorageKey, null);
      writeJson(userStorageKey(currentUserId), nextUserData);
      writeJson(sessionStorageKey, {
        ...storedSession,
        mode: "real",
        userId: currentUserId,
        authProvider: storedSession?.authProvider || "local-registration",
        onboardingStatus: "complete",
        onboardingStep: 4,
        onboardingMode,
      } satisfies StoredSession);
      removeStoredItem(onboardingProgressStorageKey(currentUserId));
      removeStoredItem(draftStorageKey(currentUserId));
      removeStoredItem(registrationDraftStorageKey);
      skipDirtyRef.current = true;
      setHasUnsavedChanges(false);
      setSaveStatus(t.common.savedSuccessfully);
      const registeredUser = readBetaUsersRegistry().find((user) => user.id === currentUserId);
      if (registeredUser) {
        upsertRegisteredBetaUser({
          ...registeredUser,
          email: normalizeEmail(nextProfile.email || registeredUser.email),
          normalizedEmail: normalizeEmail(nextProfile.email || registeredUser.email),
          fullName: nextProfile.fullName || registeredUser.fullName,
          mobile: nextProfile.mobile || registeredUser.mobile,
          status: "Active",
        });
      }
    }
    setSessionStatus("Onboarding complete: personalized dashboard generated");
    setOnboardingDebug((current) => ({ ...current, lastValidation: "passed", generationStatus: "complete" }));
    setActive("dashboard");
    setFlow("app");
    window.setTimeout(() => {
      setOnboardingAction("");
      onboardingProcessingRef.current = false;
    }, 250);
    } catch (error) {
      const storedSession = readJson<StoredSession | null>(sessionStorageKey, null);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      const errorDetails = {
        action,
        currentStep: onboardingStep,
        onboardingStatus: storedSession?.onboardingStatus || "none",
        userId: currentUserId || storedSession?.userId || "none",
        sessionMode,
        message: errorMessage,
        stack: errorStack,
      };
      console.error("Onboarding completion failed", errorDetails);
      setLastOnboardingError(errorMessage);
      setLastOnboardingErrorStack(errorStack || "");
      setAuthError(errorMessage || validationMessage("Something went wrong while continuing setup.", "حدث خطأ أثناء متابعة الإعداد."));
      setOnboardingDebug((current) => ({ ...current, lastValidation: "runtime-error", generationStatus: "error" }));
      setOnboardingAction("");
      onboardingProcessingRef.current = false;
    }
  }

  function renderIncomeEditor(income: IncomeSource, index: number) {
    return (
      <div key={income.id} className="grid gap-3 rounded-lg border border-slate-200 p-4 dark:border-white/10">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_3rem] sm:items-end">
          <div className="min-w-0 flex-1">
            <SelectField
              label="Income Type"
              value={income.type}
              options={incomeTypes}
              onChange={(value) =>
                setIncomeSources((current) => current.map((item, i) => (i === index ? { ...item, type: value as IncomeType, recurring: value === "Bonus" ? false : item.recurring } : item)))
              }
            />
          </div>
          <button
            className="flex h-11 w-full items-center justify-center rounded-lg border border-red-200 text-red-600 dark:border-red-400/30 dark:text-red-300 sm:size-11"
            onClick={() => deleteIncomeSource(income.id)}
            aria-label="Delete income source"
          >
            <Trash2 size={17} />
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={income.type === "Bonus" ? "Bonus Name" : "Income Name"} value={income.name} onChange={(value) => setIncomeSources((current) => current.map((item, i) => (i === index ? { ...item, name: value } : item)))} />
          <Field label={income.type === "Bonus" ? "Bonus Amount" : "Income Amount"} type="number" value={income.amount} onChange={(value) => setIncomeSources((current) => current.map((item, i) => (i === index ? { ...item, amount: Number(value) } : item)))} />
          {income.type !== "Bonus" && (
            <label className="flex h-11 items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm font-bold dark:border-white/10">
              <input type="checkbox" checked={income.recurring !== false} onChange={(event) => setIncomeSources((current) => current.map((item, i) => (i === index ? { ...item, recurring: event.target.checked } : item)))} />
              Recurring monthly income
            </label>
          )}
          {income.type === "Bonus" && (
            <>
              <Field label="Expected Month" value={income.expectedMonth || "December"} onChange={(value) => setIncomeSources((current) => current.map((item, i) => (i === index ? { ...item, expectedMonth: value, recurring: false } : item)))} />
              <label className="flex h-11 items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm font-bold dark:border-white/10">
                <input type="checkbox" checked={Boolean(income.guaranteed)} onChange={(event) => setIncomeSources((current) => current.map((item, i) => (i === index ? { ...item, guaranteed: event.target.checked } : item)))} />
                Guaranteed
              </label>
              <SelectField
                label={language === "ar" ? "كيف تفضل استخدام هذا البونص؟" : "How would you like to use this bonus?"}
                value={getBonusAllocation(income)}
                options={bonusAllocationOptions}
                getOptionLabel={bonusAllocationLabel}
                onChange={(value) => setIncomeSources((current) => current.map((item, i) => (i === index ? { ...item, allocation: value as BonusAllocation, recurring: false } : item)))}
              />
              <Field label="Notes" value={income.notes || ""} onChange={(value) => setIncomeSources((current) => current.map((item, i) => (i === index ? { ...item, notes: value } : item)))} />
            </>
          )}
        </div>
      </div>
    );
  }

  const landingPainPoints = language === "ar"
    ? [
        { icon: "💳", text: "كل شهر أقول سأغلق البطاقات... ثم أرجع لنفس النقطة." },
        { icon: "🏠", text: "عندي أهداف كثيرة... لكن لا أعرف من أين أبدأ." },
        { icon: "📅", text: "تفاجئني الالتزامات الكبيرة كل سنة." },
        { icon: "💰", text: "راتبي جيد... لكن لا أعرف أين تذهب أموالي." },
        { icon: "🎯", text: "أريد شراء بيت أو سيارة... لكن لا أعرف كم أحتاج فعلياً." },
      ]
    : [
        { icon: "💳", text: "Every month I say I will close the cards... then I end up in the same place." },
        { icon: "🏠", text: "I have many goals... but I do not know where to start." },
        { icon: "📅", text: "Large yearly obligations surprise me." },
        { icon: "💰", text: "My salary is good... but I do not know where my money goes." },
        { icon: "🎯", text: "I want to buy a home or car... but I do not know what I really need." },
      ];
  const landingBenefits = language === "ar"
    ? [
        { icon: "💰", text: "اعرف أين يذهب راتبك كل شهر." },
        { icon: "📅", text: "اعرف الالتزامات القادمة قبل أن تفاجئك." },
        { icon: "💳", text: "اعرف إذا كانت بطاقاتك أصبحت عبئاً عليك." },
        { icon: "🎯", text: "اعرف متى ستصل إلى أهدافك المالية." },
        { icon: "📈", text: "شاهد كيف سيكون وضعك المالي خلال الأشهر القادمة." },
        { icon: "🖨", text: "اطبع تقريراً واضحاً لوضعك المالي." },
      ]
    : [
        { icon: "💰", text: "Know where your salary goes each month." },
        { icon: "📅", text: "See upcoming obligations before they surprise you." },
        { icon: "💳", text: "Know when your cards are becoming a burden." },
        { icon: "🎯", text: "Know when you can reach your financial goals." },
        { icon: "📈", text: "See what your money may look like in the coming months." },
        { icon: "🖨", text: "Print a clear report of your financial picture." },
      ];
  const landingFlow = language === "ar"
    ? [
        { label: "الراتب", value: "SAR 24,000", tone: "bg-emerald-500" },
        { label: "الالتزامات", value: "- SAR 12,400", tone: "bg-amber-500" },
        { label: "تنبيه البطاقة", value: "استخدام مرتفع", tone: "bg-red-500" },
        { label: "الأهداف", value: "42%", tone: "bg-sky-500" },
        { label: "المتبقي", value: "SAR 4,850", tone: "bg-mint" },
      ]
    : [
        { label: "Salary", value: "SAR 24,000", tone: "bg-emerald-500" },
        { label: "Obligations", value: "- SAR 12,400", tone: "bg-amber-500" },
        { label: "Credit Card Warning", value: "High use", tone: "bg-red-500" },
        { label: "Goals", value: "42%", tone: "bg-sky-500" },
        { label: "Remaining Income", value: "SAR 4,850", tone: "bg-mint" },
      ];

  const renderStoredSession = readJson<StoredSession | null>(sessionStorageKey, null);
  const realOnboardingComplete = sessionMode === "real" && renderStoredSession?.onboardingStatus === "complete";
  const appShellReady = flow === "app" && (sessionMode === "demo" || realOnboardingComplete);
  const shouldShowPublicLanding = pathname === "/landing" || (sessionMode === "signedOut" && flow === "app");
  const userSourceMode = isSupabaseConfigured ? "supabase" : "local-beta";
  const showInstallSurface = shouldShowPublicLanding || appShellReady;
  const showInstallExperience = showInstallSurface && !isStandaloneApp && !isIosDevice && ((showInstallPrompt || Boolean(deferredInstallPrompt)) && !pwaInstallPromptSeen || Boolean(installNotice));
  const registryUsersForDiagnostics = readBetaUsersRegistry().filter((user) => user.deleted !== true && user.status !== "Deleted");
  const registeredUsersCount = registryUsersForDiagnostics.length;
  const loginSourceUsersCount = registryUsersForDiagnostics.length;
  const userStoreMismatch = registeredUsersCount !== loginSourceUsersCount;
  const supabaseDiagnosticsPanel = (
    <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-black text-sky-900 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-100">
      <p>Supabase URL loaded: {supabaseUrlLoaded ? "yes" : "no"}</p>
      <p>Supabase key loaded: {supabaseAnonKeyLoaded ? "yes" : "no"}</p>
      <p>Supabase client created: {supabaseClientCreated ? "yes" : "no"}</p>
      <p>URL host: {supabaseDiagnosticInfo.urlHost}</p>
      <p>URL path: {supabaseDiagnosticInfo.urlPath || "/"}</p>
      <p>URL valid root: {supabaseDiagnosticInfo.urlLooksValid ? "yes" : "no"}</p>
      {supabaseDiagnosticInfo.urlIssue && <p>URL issue: {supabaseDiagnosticInfo.urlIssue}</p>}
      <p>Key length: {supabaseDiagnosticInfo.keyLength}</p>
      <p>Key prefix length: {supabaseDiagnosticInfo.keyPrefixLength}</p>
      <p>Client init: {supabaseDiagnosticInfo.sdkCreateClientUsage}</p>
      <p>Auth endpoint tested: {supabaseHealth.request.endpoint}</p>
      <p>Auth method: {supabaseHealth.request.authMethod}</p>
      <p>Headers sent: {supabaseHealth.request.headersSent.join(", ") || "none"}</p>
      <p>Auth connection test: {!supabaseHealthChecked ? "checking" : supabaseHealth.success ? "success" : "failure"}</p>
      <p>getSession: {supabaseHealth.getSession.success ? "success" : "failure"} - {supabaseHealth.getSession.message}</p>
      <p>getUser: {supabaseHealth.getUser.success ? "success" : "failure"} - {supabaseHealth.getUser.message}</p>
      <p>Error message: {supabaseHealth.success ? "none" : supabaseHealth.message}</p>
    </div>
  );
  const installExperience = showInstallExperience ? (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 shadow-sm dark:border-emerald-400/20 dark:bg-emerald-400/10">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-emerald-700 dark:bg-white/10 dark:text-mint">
          <Smartphone size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-emerald-900 dark:text-emerald-100">
            {isIosDevice
              ? language === "ar"
                ? "لإضافة ديبت آي كيو إلى جهازك:"
                : "Add DebtIQ to your iPhone:"
              : language === "ar"
                ? "أضف ديبت آي كيو إلى الشاشة الرئيسية"
                : "Add DebtIQ to your home screen"}
          </p>
          {isIosDevice ? (
            <ol className="mt-3 list-decimal space-y-1 ps-5 text-sm font-bold leading-6 text-emerald-800 dark:text-emerald-100">
              <li>{language === "ar" ? "اضغط زر المشاركة" : "Tap the Share button"}</li>
              <li>{language === "ar" ? "اختر Add to Home Screen" : "Choose Add to Home Screen"}</li>
              <li>{language === "ar" ? "اضغط إضافة" : "Tap Add"}</li>
            </ol>
          ) : (
            <p className="mt-2 text-sm font-bold text-emerald-800 dark:text-emerald-100">
              {language === "ar" ? "ثبّت التطبيق لتفتحه بسرعة مثل تطبيقات الجوال." : "Install the app for quick access like a mobile app."}
            </p>
          )}
          <p className="mt-2 text-xs font-black text-emerald-800 dark:text-emerald-100">
            {installNotice || validationMessage("If the icon already exists, do not add it again.", "إذا كانت الأيقونة موجودة مسبقاً، لا تضفها مرة أخرى.")}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {isIosDevice ? (
              <button
                className="h-10 rounded-lg bg-emerald-700 px-4 text-sm font-black text-white dark:bg-mint dark:text-ink"
                onClick={installApp}
                type="button"
              >
                {language === "ar" ? "تثبيت التطبيق" : "Install App"}
              </button>
            ) : (
              <>
                <button
                  className="h-10 rounded-lg bg-emerald-700 px-4 text-sm font-black text-white dark:bg-mint dark:text-ink"
                  onClick={installApp}
                  type="button"
                >
                  {language === "ar" ? "إضافة" : "Add"}
                </button>
                <button
                  className="h-10 rounded-lg border border-emerald-200 bg-white px-4 text-sm font-black text-emerald-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  onClick={dismissInstallPrompt}
                  type="button"
                >
                  {language === "ar" ? "لاحقاً" : "Later"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  ) : null;
  const debugCheckpointUserId = currentUserId || renderStoredSession?.userId || "";
  const debugCheckpoint = debugCheckpointUserId ? readJson<OnboardingProgress | null>(onboardingProgressStorageKey(debugCheckpointUserId), null) : null;
  const debugRenderMode = shouldShowPublicLanding ? "publicLanding" : appShellReady ? "appShell" : flow === "register" ? "createAccount" : flow === "onboarding" ? "onboardingIncomplete" : flow;
  const onboardingDebugPanel = debugOnboarding ? (
    <div className="fixed bottom-3 left-3 right-3 z-[80] max-h-[70vh] overflow-auto rounded-lg border border-amber-300 bg-amber-50 p-3 text-left text-xs font-bold text-amber-950 shadow-premium dark:border-amber-300/40 dark:bg-slate-950 dark:text-amber-100 sm:left-auto sm:w-[420px]" dir="ltr">
      <p className="text-sm font-black">Onboarding Debug</p>
      <p>render mode: {debugRenderMode}</p>
      <p>flow: {flow}</p>
      <p>current step: {onboardingStep}</p>
      <p>onboardingStatus: {renderStoredSession?.onboardingStatus || "none"}</p>
      <p>active session: {profile.email || registration.email || "none"} / {currentUserId || renderStoredSession?.userId || "none"}</p>
      <p>checkpoint: {debugCheckpoint?.email || debugCheckpoint?.registration.email || "none"} / {debugCheckpoint?.userId || "none"}</p>
      <p>last action: {onboardingDebug.lastAction}</p>
      <p>processing: {onboardingAction || onboardingProcessingRef.current ? "yes" : "no"}</p>
      <p>last validation: {onboardingDebug.lastValidation}</p>
      <p>last error message: {lastOnboardingError || "none"}</p>
      {lastOnboardingErrorStack && <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap rounded bg-white/80 p-2 text-[11px] dark:bg-black/40">{lastOnboardingErrorStack}</pre>}
      <p className="mt-2">localStorage keys:</p>
      <pre className="mt-1 whitespace-pre-wrap rounded bg-white/80 p-2 text-[11px] dark:bg-black/40">
{[
  sessionStorageKey,
  registrationDraftStorageKey,
  debugCheckpointUserId ? onboardingProgressStorageKey(debugCheckpointUserId) : `${onboardingProgressStoragePrefix}{userId}`,
  debugCheckpointUserId ? draftStorageKey(debugCheckpointUserId) : `${draftDataStoragePrefix}{userId}`,
  debugCheckpointUserId ? userStorageKey(debugCheckpointUserId) : `${userDataStoragePrefix}{userId}`,
].join("\n")}
      </pre>
      {onboardingStep === 4 && (
        <button className="mt-3 h-10 w-full rounded-lg bg-amber-600 px-3 text-sm font-black text-white" type="button" onClick={forceCompleteOnboarding}>
          Force Complete Onboarding
        </button>
      )}
    </div>
  ) : null;

  if (shouldShowPublicLanding) {
    return (
      <main className={darkMode ? "dark" : ""} dir={language === "ar" ? "rtl" : "ltr"} lang={language}>
        {showInstallSurface && <PWAInstallPrompt language={language} />}
        {onboardingDebugPanel}
        <div className="landing-page min-h-screen overflow-hidden bg-[#f6f8fb] text-ink dark:bg-[#07111f] dark:text-white">
          <section className="relative px-4 py-5 sm:px-6 lg:px-8">
            <div className="landing-scene absolute inset-0" aria-hidden="true" />

            <div className="relative z-10 mx-auto flex min-h-[92vh] max-w-7xl flex-col">
              <header className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid size-12 place-items-center rounded-xl border border-mint/30 bg-mint/10 text-mint shadow-[0_18px_50px_rgba(56,214,163,0.22)] sm:size-16">
                    <CircleDollarSign size={30} />
                  </div>
                  <div className="leading-tight">
                    <p className="text-2xl font-black tracking-tight sm:text-4xl">DebtIQ</p>
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-emerald-700 dark:text-mint sm:text-[11px] sm:tracking-[0.18em]">Financial Opportunity Intelligence</p>
                    <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-300">ديبت آي كيو</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="h-10 rounded-lg border border-slate-200 bg-white/85 px-3 text-sm font-bold backdrop-blur dark:border-white/10 dark:bg-white/5"
                    onClick={toggleLanguage}
                  >
                    {language === "en" ? "العربية" : "English"}
                  </button>
                  {sessionMode !== "signedOut" && (
                    <button
                      className="h-10 rounded-lg bg-ink px-3 text-sm font-bold text-white dark:bg-mint dark:text-ink"
                      onClick={() => router.push("/app")}
                    >
                      {language === "ar" ? "اذهب إلى التطبيق" : "Go to App"}
                    </button>
                  )}
                  {sessionMode === "signedOut" && (
                    <button
                      className="hidden h-10 rounded-lg bg-ink px-3 text-sm font-bold text-white dark:bg-mint dark:text-ink sm:block"
                      onClick={openLoginFromLanding}
                    >
                      {language === "ar" ? "تسجيل الدخول" : "Login"}
                    </button>
                  )}
                  {!isStandaloneApp && !isIosDevice && !pwaInstallPromptSeen && (
                    <button
                      className="hidden h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white/85 px-3 text-sm font-bold backdrop-blur dark:border-white/10 dark:bg-white/5 sm:flex"
                      onClick={installApp}
                      type="button"
                    >
                      <Smartphone size={16} />
                      {language === "ar" ? "تثبيت التطبيق" : "Install App"}
                    </button>
                  )}
                  <button
                    aria-label="Toggle dark mode"
                    className="grid size-10 place-items-center rounded-lg border border-slate-200 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-white/5"
                    onClick={() => setDarkMode((value) => !value)}
                  >
                    {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                  </button>
                </div>
              </header>

              <div className="grid flex-1 items-center gap-10 py-14 lg:grid-cols-[1.02fr_0.98fr] lg:py-20">
                <div className="max-w-3xl">
                  <p className="text-sm font-black uppercase tracking-wide text-emerald-700 dark:text-mint">
                    {language === "ar" ? "ديبت آي كيو" : "DebtIQ / ديبت آي كيو"}
                  </p>
                  <h1 className="mt-5 text-5xl font-black leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
                    {language === "ar" ? "هل تعرف فعلاً أين يذهب راتبك كل شهر؟" : "Do you really know where your salary goes every month?"}
                  </h1>
                  <p className="mt-6 max-w-2xl text-lg font-semibold leading-8 text-slate-600 dark:text-slate-200">
                    {language === "ar"
                      ? "أغلب الناس لا تعاني من مشكلة دخل... بل من عدم وضوح الصورة المالية."
                      : "Most people do not have an income problem. They have a visibility problem."}
                  </p>
                  <p className="mt-4 max-w-2xl text-base font-black leading-7 text-emerald-700 dark:text-mint">
                    {language === "ar" ? "ديبت آي كيو يساعدك على رؤية الصورة كاملة." : "DebtIQ helps you see the full picture."}
                  </p>
                  <div className="mt-9 grid gap-3 sm:flex">
                    <button className="h-12 rounded-lg bg-ink px-6 text-sm font-black text-white shadow-premium transition hover:-translate-y-0.5 dark:bg-mint dark:text-ink" onClick={openRegistrationFromLanding}>
                      {language === "ar" ? "ابدأ الآن مجاناً" : "Start free"}
                    </button>
                  </div>
                  <div className="mt-5">{installExperience}</div>
                </div>

                <div className="landing-preview-shell">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-mint">
                        {language === "ar" ? "لمحة مالية" : "Financial Preview"}
                      </p>
                      <h2 className="mt-2 text-2xl font-black">{language === "ar" ? "الصورة الشهرية" : "Monthly picture"}</h2>
                    </div>
                    <div className="rounded-lg border border-emerald-300/25 bg-emerald-400/10 px-3 py-2 text-xs font-black text-mint">
                      {language === "ar" ? "واضح" : "Clear"}
                    </div>
                  </div>
                  <div className="landing-flow-panel">
                    {landingFlow.map((item, index) => (
                      <div key={item.label} className="landing-flow-card" style={{ animationDelay: `${index * 0.3}s` }}>
                        <span className={`h-2.5 w-2.5 rounded-full ${item.tone}`} />
                        <div>
                          <p>{item.label}</p>
                          <strong>{item.value}</strong>
                        </div>
                      </div>
                    ))}
                    <div className="landing-progress">
                      <span />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="px-4 py-10 sm:px-6 lg:px-8">
            <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-emerald-700 dark:text-mint">
                  {language === "ar" ? "مثال من الواقع" : "Example Financial Snapshot"}
                </p>
                <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                  {language === "ar" ? "هكذا تتحول الأرقام إلى قرار واضح" : "This is how numbers become a clear next step"}
                </h2>
              </div>
              <div className="landing-snapshot p-6 sm:p-7">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    [language === "ar" ? "الدخل الشهري" : "Monthly Income", "SAR 42,000"],
                    [language === "ar" ? "الالتزامات الشهرية" : "Monthly Obligations", "SAR 38,000"],
                    [language === "ar" ? "المتبقي" : "Remaining", "SAR 4,000"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-slate-200 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                      <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
                      <p className="mt-2 text-2xl font-black">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg border border-emerald-300/25 bg-emerald-400/10 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-emerald-700 dark:text-mint">
                    {language === "ar" ? "توصية ديبت آي كيو" : "DebtIQ Recommendation"}
                  </p>
                  <p className="mt-2 text-base font-black leading-8">
                    {language === "ar"
                      ? "خصص 2,000 ريال لصندوق الطوارئ و1,500 ريال لتسريع سداد الديون."
                      : "Allocate SAR 2,000 to your emergency fund and SAR 1,500 to accelerate debt payoff."}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="relative z-10 px-4 py-16 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
              <div className="max-w-2xl">
                <p className="text-sm font-black uppercase tracking-wide text-emerald-700 dark:text-mint">{language === "ar" ? "هل هذا يشبهك؟" : "Does this sound like you?"}</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{language === "ar" ? "لحظات بسيطة لكنها تتكرر كل شهر" : "Small money moments that repeat every month"}</h2>
              </div>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {landingPainPoints.map((pain) => (
                  <div key={pain.text} className="landing-soft-card p-5 text-sm font-black leading-7">
                    <span className="mb-3 block text-2xl" aria-hidden="true">{pain.icon}</span>
                    {pain.text}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="px-4 py-12 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
              <div className="max-w-2xl">
                <p className="text-sm font-black uppercase tracking-wide text-emerald-700 dark:text-mint">{language === "ar" ? "ماذا سيساعدك أن ترى؟" : "What will it help you see?"}</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{language === "ar" ? "صورة مالية أوضح بدون تعقيد" : "A clearer money picture without the noise"}</h2>
              </div>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {landingBenefits.map((benefit) => (
                  <div key={benefit.text} className="landing-soft-card p-5">
                    <span className="text-2xl" aria-hidden="true">{benefit.icon}</span>
                    <p className="mt-4 text-base font-black leading-7">{benefit.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="px-4 py-12 sm:px-6 lg:px-8">
            <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-2">
              <div className="landing-soft-card p-6">
                <p className="text-2xl" aria-hidden="true">👨</p>
                <h3 className="mt-2 text-2xl font-black">{language === "ar" ? "كريم" : "Karim"}</h3>
                <p className="mt-3 text-base font-semibold leading-8 text-slate-600 dark:text-slate-200">
                  {language === "ar"
                    ? "راتبه جيد، لكن نهاية الشهر دائماً تضغطه. عنده بطاقة والتزامات، ويريد أن يعرف أين يذهب الراتب بهدوء."
                    : "His salary is good, but the end of the month always feels tight. He has a card, obligations, and wants to understand where his salary goes."}
                </p>
                <button className="mt-4 h-10 rounded-lg border border-mint/40 px-4 text-sm font-black text-emerald-700 dark:text-mint" onClick={() => openDemoFromLanding("karim")} type="button">
                  {language === "ar" ? "شاهد مثال كريم" : "View Karim's example"}
                </button>
              </div>
              <div className="landing-soft-card p-6">
                <p className="text-2xl" aria-hidden="true">👩</p>
                <h3 className="mt-2 text-2xl font-black">{language === "ar" ? "كريمة" : "Karima"}</h3>
                <p className="mt-3 text-base font-semibold leading-8 text-slate-600 dark:text-slate-200">
                  {language === "ar"
                    ? "تبغى ترتب مصاريف البيت والمدارس بدون مفاجآت، وتبني صندوق طوارئ يحمي قرارات العائلة."
                    : "She wants to organize home spending and school fees without surprises, while building an emergency fund for the family."}
                </p>
                <button className="mt-4 h-10 rounded-lg border border-mint/40 px-4 text-sm font-black text-emerald-700 dark:text-mint" onClick={() => openDemoFromLanding("karima")} type="button">
                  {language === "ar" ? "شاهد مثال كريمة" : "View Karima's example"}
                </button>
              </div>
              <div className="lg:col-span-2">
                <button className="h-12 rounded-lg bg-ink px-6 text-sm font-black text-white shadow-premium transition hover:-translate-y-0.5 dark:bg-mint dark:text-ink" onClick={openRegistrationFromLanding}>
                  {language === "ar" ? "اكتشف وضعك المالي مثل كريم وكريمة" : "Discover your financial picture like Karim and Karima"}
                </button>
              </div>
            </div>
          </section>

          <section className="px-4 py-12 sm:px-6 lg:px-8">
            <div className="landing-trust mx-auto max-w-7xl p-6 sm:p-8">
              <p className="text-sm font-black uppercase tracking-wide text-emerald-700 dark:text-mint">
                {language === "ar" ? "لماذا يستخدم الناس ديبت آي كيو؟" : "Why do people use DebtIQ?"}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(language === "ar"
                  ? ["لا تحتاج إلى إدخال كل شيء اليوم.", "ابدأ بما تعرفه الآن.", "أضف البيانات تدريجياً.", "احتفظ بصورة أوضح لوضعك المالي."]
                  : ["You do not need to enter everything today.", "Start with what you know now.", "Add details gradually.", "Keep a clearer picture of your money."]
                ).map((item) => (
                  <div key={item} className="rounded-lg border border-slate-200 bg-white/65 p-4 text-sm font-black leading-7 dark:border-white/10 dark:bg-white/5">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="px-4 pb-20 pt-8 sm:px-6 lg:px-8">
            <div className="landing-final-cta mx-auto max-w-4xl p-8 text-center sm:p-10">
              <h2 className="text-4xl font-black tracking-tight sm:text-5xl">{language === "ar" ? "ابدأ اليوم." : "Start today."}</h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-7 text-slate-600 dark:text-slate-200">
                {language === "ar"
                  ? "وخلال دقائق ستحصل على صورة أوضح لوضعك المالي."
                  : "In a few minutes, you can have a clearer picture of your money."}
              </p>
              <div className="mt-6 grid gap-3 sm:flex sm:justify-center">
                <button className="h-12 rounded-lg bg-ink px-6 text-sm font-black text-white shadow-premium dark:bg-mint dark:text-ink" onClick={openRegistrationFromLanding}>
                  {language === "ar" ? "ابدأ الآن مجاناً" : "Start free"}
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className={darkMode ? "dark" : ""} dir={language === "ar" ? "rtl" : "ltr"} lang={language}>
      {showInstallSurface && <PWAInstallPrompt language={language} />}
      {onboardingDebugPanel}
      <div className="app-shell min-h-screen px-4 pb-32 pt-[calc(env(safe-area-inset-top)+1.25rem)] text-ink dark:text-white sm:px-6 lg:px-8">
        <div className={`mx-auto grid gap-5 ${appShellReady ? "max-w-7xl lg:grid-cols-[280px_1fr]" : "max-w-3xl"}`}>
          {appShellReady && <aside className="rounded-lg border border-white/70 bg-white/80 p-4 shadow-premium backdrop-blur dark:border-white/10 dark:bg-white/5 lg:sticky lg:top-5 lg:h-[calc(100vh-2.5rem)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-lg bg-ink text-mint dark:bg-white dark:text-ink">
                  <CircleDollarSign size={24} />
                </div>
                <div>
                  <h1 className="text-xl font-black">DebtIQ</h1>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Financial Opportunity Intelligence</p>
                </div>
              </div>
              <button
                aria-label="Toggle dark mode"
                className="grid size-10 place-items-center rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5"
                onClick={() => setDarkMode((value) => !value)}
              >
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>

            <a
              href="/landing"
              className="mt-4 flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-700 transition hover:border-mint dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            >
              {language === "ar" ? "العودة للرئيسية" : "Back to Home"}
            </a>

            {!isStandaloneApp && !isIosDevice && !pwaInstallPromptSeen && (
              <button
                className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-ink text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-mint dark:text-ink"
                onClick={installApp}
                type="button"
              >
                <Smartphone size={16} />
                {language === "ar" ? "تثبيت التطبيق" : "Install App"}
              </button>
            )}

            <nav className="mt-6 grid grid-cols-2 gap-2 lg:grid-cols-1">
              {[
                ["dashboard", language === "ar" ? "لوحتك المالية" : "Dashboard", <LayoutDashboard key="i" size={18} />],
                ["income", t.common.income, <CircleDollarSign key="i" size={18} />],
                ["lifestyle", t.common.lifestyle, <Calculator key="i" size={18} />],
                ["obligations", t.common.obligations, <CreditCardIcon key="i" size={18} />],
                ["debts", t.common.debtCenter, <WalletCards key="i" size={18} />],
                ["goals", t.common.goals, <Target key="i" size={18} />],
                ["profile", t.common.profile, <UserRound key="i" size={18} />],
                ["opportunities", t.common.opportunities, <Landmark key="i" size={18} />],
              ].map(([id, label, icon]) => (
                <button
                  key={id as string}
                  className={`flex h-11 items-center gap-2 rounded-lg px-3 text-left text-sm font-bold transition ${
                    active === id
                      ? "bg-ink text-white dark:bg-mint dark:text-ink"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                  }`}
                  onClick={() => navigateActive(id as string)}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </nav>

            <div className="mt-5 rounded-lg border border-mint/30 bg-mint/10 p-4">
              <div className="flex items-center gap-2 text-sm font-black text-emerald-800 dark:text-mint">
                <LockKeyhole size={17} />
                {sessionMode === "demo" ? "Demo Mode \u2014 sample data only" : sessionMode === "real" ? "Secure Session" : "Signed Out"}
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
                {sessionMode === "demo"
                  ? "Sample financial data is isolated from real user accounts."
                  : sessionMode === "real"
                    ? "Your profile and financial data are tied to this logged-in user."
                    : "Sign in, create an account, or explicitly open Demo Mode."}
              </p>
            </div>
          </aside>}

          <section className="grid gap-5">
            {userSourceMode === "local-beta" && flow !== "onboarding" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-900 shadow-sm dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
                {language === "ar" ? "وضع بيتا محلي: المستخدمون محفوظون في هذا المتصفح فقط." : "Local beta mode: users are stored only in this browser."}
              </div>
            )}

            {appShellReady && <div className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-premium backdrop-blur dark:border-white/10 dark:bg-white/5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-mint">Welcome back</p>
                  <h2 className="mt-1 text-2xl font-black sm:text-3xl">{profile.fullName || "DebtIQ"}</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{`${profile.city || "Local"} - ${profile.employer || "Profile"}`}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <input
                    ref={fileInputRef}
                    className="hidden"
                    type="file"
                    accept=".xlsx,.csv"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      handleImportFile(file).catch(() => {
                        setImportPreview(null);
                        setImportWizardOpen(true);
                        setImportErrors([{ section: "File", message: "Unable to read this file. Upload a valid .xlsx or .csv file." }]);
                      });
                      event.target.value = "";
                    }}
                  />
                  {sessionMode === "real" && (
                    <button
                      className={`flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold ${
                        hasUnsavedChanges
                          ? "bg-ink text-white dark:bg-mint dark:text-ink"
                          : "border border-slate-200 bg-white text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                      }`}
                      onClick={() => saveUserData(undefined, t.common.savedSuccessfully)}
                      disabled={!hasUnsavedChanges}
                    >
                      <CheckCircle2 size={18} />
                      {hasUnsavedChanges ? "Save Changes" : t.common.save}
                    </button>
                  )}
                  <button
                    className="flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold dark:border-white/10 dark:bg-white/5"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Plus size={18} />
                    {t.common.importData}
                  </button>
                  <button
                    className="flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold dark:border-white/10 dark:bg-white/5"
                    onClick={downloadTemplate}
                  >
                    <BarChart3 size={18} />
                    {t.common.downloadTemplate}
                  </button>
                  <button
                    className="flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold dark:border-white/10 dark:bg-white/5"
                    onClick={() => window.print()}
                  >
                    <Printer size={18} />
                    {t.common.printReport}
                  </button>
                  <button
                    className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold dark:border-white/10 dark:bg-white/5"
                    onClick={toggleLanguage}
                  >
                    {language === "en" ? "العربية" : "English"}
                  </button>
                  <button
                    className="flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold dark:border-white/10 dark:bg-white/5"
                    onClick={logout}
                  >
                    <LockKeyhole size={18} />
                    Logout
                  </button>
                </div>
              </div>
              <p className="mt-4 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 dark:bg-white/5 dark:text-slate-300">
                {sessionStatus}
                {sessionMode === "real" && hasUnsavedChanges && <span className="ms-2 text-amber-700 dark:text-amber-300">{t.common.unsavedChanges}</span>}
                {sessionMode === "real" && saveStatus && <span className="ms-2 text-emerald-700 dark:text-mint">{saveStatus}</span>}
              </p>
            </div>}

            {appShellReady && installExperience}

            {appShellReady && sessionMode === "demo" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-900 shadow-sm dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
                Demo Mode {"\u2014"} sample data only
              </div>
            )}

            {flow === "quickSetup" && (
              <div className="mx-auto w-full max-w-2xl rounded-lg border border-mint/30 bg-white/90 p-5 shadow-premium dark:border-mint/20 dark:bg-white/5">
                <div className="flex items-start gap-3">
                  <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-mint/20 text-2xl" aria-hidden="true">👋</div>
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase text-mint">
                      {language === "ar" ? "إعداد مالي سريع" : "One minute setup"}
                    </p>
                    <h3 className="mt-2 text-2xl font-black leading-tight">
                      {language === "ar" ? "أهلاً بك في ديبت آي كيو" : "Welcome to DebtIQ"}
                    </h3>
                    <p className="mt-2 text-sm font-bold leading-7 text-slate-600 dark:text-slate-200">
                      {language === "ar"
                        ? "خلّينا نبني صورتك المالية خلال دقيقة واحدة."
                        : "Let's build your financial picture in less than one minute."}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex gap-2">
                  {[1, 2, 3, 4, 5].map((step) => (
                    <span key={step} className={`h-2 flex-1 rounded-full ${step <= Math.min(Math.max(quickSetupStep, 1), 5) ? "bg-mint" : "bg-slate-200 dark:bg-white/10"}`} />
                  ))}
                </div>

                <div className="mt-6">
                  {quickSetupStep === 0 && (
                    <div className="rounded-lg bg-slate-50 p-5 dark:bg-white/5">
                      <h4 className="text-xl font-black">
                        {language === "ar" ? "لن تحتاج للتنقل بين التبويبات الآن." : "No tab-by-tab setup right now."}
                      </h4>
                      <p className="mt-3 text-sm font-semibold leading-7 text-slate-600 dark:text-slate-200">
                        {language === "ar"
                          ? "أجب عن خمسة أسئلة قصيرة، وسنفتح لك لوحة مالية أولية يمكنك تعديلها لاحقاً."
                          : "Answer five short questions, and we will create a starter dashboard you can edit later."}
                      </p>
                    </div>
                  )}

                  {quickSetupStep === 1 && (
                    <div className="grid gap-4">
                      <h4 className="text-xl font-black">{language === "ar" ? "كم دخلك الشهري تقريباً؟" : "What is your monthly income?"}</h4>
                      <Field
                        label={language === "ar" ? "الدخل الشهري" : "Monthly income"}
                        type="number"
                        value={quickSetup.monthlyIncome}
                        onChange={(value) => setQuickSetup((current) => ({ ...current, monthlyIncome: Number(value) }))}
                      />
                    </div>
                  )}

                  {quickSetupStep === 2 && (
                    <div className="grid gap-4">
                      <h4 className="text-xl font-black">{language === "ar" ? "هل لديك بطاقات ائتمانية؟" : "Do you have credit cards?"}</h4>
                      <div className="grid gap-2">
                        {[
                          ["none", language === "ar" ? "لا" : "No"],
                          ["one", language === "ar" ? "نعم، بطاقة واحدة" : "Yes, one card"],
                          ["multiple", language === "ar" ? "نعم، أكثر من بطاقة" : "Yes, multiple cards"],
                        ].map(([value, label]) => (
                          <button
                            key={value}
                            className={`min-h-12 rounded-lg border px-4 text-start text-sm font-black transition ${
                              quickSetup.creditCards === value
                                ? "border-mint bg-mint/15 text-emerald-800 dark:text-mint"
                                : "border-slate-200 bg-white/70 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                            }`}
                            type="button"
                            onClick={() => setQuickSetup((current) => ({ ...current, creditCards: value as QuickSetupForm["creditCards"] }))}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {quickSetupStep === 3 && (
                    <div className="grid gap-4">
                      <h4 className="text-xl font-black">{language === "ar" ? "هل لديك التزامات شهرية ثابتة؟" : "Do you have monthly obligations?"}</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          [false, language === "ar" ? "لا" : "No"],
                          [true, language === "ar" ? "نعم" : "Yes"],
                        ].map(([value, label]) => (
                          <button
                            key={String(value)}
                            className={`h-12 rounded-lg border px-4 text-sm font-black transition ${
                              quickSetup.hasMonthlyObligations === value
                                ? "border-mint bg-mint/15 text-emerald-800 dark:text-mint"
                                : "border-slate-200 bg-white/70 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                            }`}
                            type="button"
                            onClick={() => setQuickSetup((current) => ({ ...current, hasMonthlyObligations: Boolean(value), monthlyObligationAmount: value ? current.monthlyObligationAmount : 0 }))}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {quickSetup.hasMonthlyObligations && (
                        <Field
                          label={language === "ar" ? "المبلغ الشهري التقريبي" : "Approximate monthly amount"}
                          type="number"
                          value={quickSetup.monthlyObligationAmount}
                          onChange={(value) => setQuickSetup((current) => ({ ...current, monthlyObligationAmount: Number(value) }))}
                        />
                      )}
                    </div>
                  )}

                  {quickSetupStep === 4 && (
                    <div className="grid gap-4">
                      <h4 className="text-xl font-black">{language === "ar" ? "✨ هل نسينا شيئاً مهماً؟" : "✨ Did we forget something important?"}</h4>
                      <div className="flex flex-wrap gap-2">
                        {[
                          ["School fees", "🏫", language === "ar" ? "رسوم المدارس" : "School fees"],
                          ["Special occasions", "🎂", language === "ar" ? "مناسبات خاصة" : "Special occasions"],
                          ["Car insurance", "🚗", language === "ar" ? "تأمين السيارة" : "Car insurance"],
                          ["Home expenses", "🏠", language === "ar" ? "مصاريف البيت" : "Home expenses"],
                          ["Domestic worker", "👩‍🍳", language === "ar" ? "عاملة منزلية" : "Domestic worker"],
                          ["Travel plans", "✈️", language === "ar" ? "خطط سفر" : "Travel plans"],
                          ["Other", "📱", language === "ar" ? "أخرى" : "Other"],
                        ].map(([value, icon, label]) => (
                          <button
                            key={value}
                            className={`rounded-lg border px-3 py-2 text-sm font-black transition ${
                              quickSetup.importantItems.includes(value)
                                ? "border-mint bg-mint/15 text-emerald-800 dark:text-mint"
                                : "border-slate-200 bg-white/70 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                            }`}
                            type="button"
                            onClick={() => toggleQuickSetupItem(value)}
                          >
                            <span aria-hidden="true">{icon}</span> {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {quickSetupStep === 5 && (
                    <div className="grid gap-4">
                      <h4 className="text-xl font-black">{language === "ar" ? "ما أهم هدف مالي لك حالياً؟" : "What is your biggest financial goal right now?"}</h4>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {[
                          ["Emergency Fund", language === "ar" ? "صندوق الطوارئ" : "Emergency fund"],
                          ["Pay Off Debt", language === "ar" ? "سداد الديون" : "Pay off debt"],
                          ["Buy Something Important", language === "ar" ? "شراء شيء مهم" : "Buy something important"],
                          ["Travel", language === "ar" ? "السفر" : "Travel"],
                          ["School Fees", language === "ar" ? "رسوم المدارس" : "School fees"],
                          ["Other", language === "ar" ? "أخرى" : "Other"],
                        ].map(([value, label]) => (
                          <button
                            key={value}
                            className={`min-h-12 rounded-lg border px-4 text-start text-sm font-black transition ${
                              quickSetup.primaryGoal === value
                                ? "border-mint bg-mint/15 text-emerald-800 dark:text-mint"
                                : "border-slate-200 bg-white/70 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                            }`}
                            type="button"
                            onClick={() => setQuickSetup((current) => ({ ...current, primaryGoal: value as QuickSetupForm["primaryGoal"] }))}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {quickSetupStep === 6 && (
                    <div className="rounded-lg border border-mint/30 bg-mint/10 p-5">
                      <p className="text-xs font-black uppercase text-emerald-700 dark:text-mint">
                        {language === "ar" ? "ملخص صورتك المالية" : "Financial Picture Summary"}
                      </p>
                      <h4 className="mt-2 text-2xl font-black">{language === "ar" ? "صورتك الأولى جاهزة." : "Your first picture is ready."}</h4>
                      <p className="mt-3 text-sm font-bold leading-7 text-slate-700 dark:text-slate-100">{quickSetupSummary}</p>
                    </div>
                  )}
                </div>

                {authError && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700 dark:bg-red-400/10 dark:text-red-200">{authError}</p>}

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {quickSetupStep < 6 ? (
                    <>
                      <button className="h-11 rounded-lg border border-slate-200 text-sm font-bold dark:border-white/10" type="button" onClick={quickSetupStep === 0 ? skipQuickSetup : handleQuickSetupBack}>
                        {quickSetupStep === 0 ? (language === "ar" ? "لاحقاً" : "Later") : (language === "ar" ? "رجوع" : "Back")}
                      </button>
                      <button className="h-11 rounded-lg border border-dashed border-slate-300 text-sm font-bold dark:border-white/20" type="button" onClick={skipQuickSetup}>
                        {language === "ar" ? "تخطي الآن" : "Skip for now"}
                      </button>
                      <button className="flex h-11 items-center justify-center gap-2 rounded-lg bg-ink text-sm font-bold text-white dark:bg-mint dark:text-ink" type="button" onClick={handleQuickSetupNext}>
                        {quickSetupStep >= 5 ? (language === "ar" ? "إنشاء الصورة المالية" : "Generate picture") : (language === "ar" ? "متابعة" : "Continue")}
                        <ChevronRight size={17} />
                      </button>
                    </>
                  ) : (
                    <button className="h-12 rounded-lg bg-ink px-4 text-sm font-black text-white dark:bg-mint dark:text-ink sm:col-span-3" type="button" onClick={openDashboardFromQuickSetup}>
                      {language === "ar" ? "افتح لوحتي المالية" : "Open My Dashboard"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {flow === "register" && (
              <div className="mx-auto w-full max-w-2xl rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                <p className="text-xs font-black uppercase text-mint">Create Account</p>
                <h3 className="mt-2 text-2xl font-black">Start your DebtIQ profile</h3>
                <div className="mt-5 grid gap-3">
                  <Field label="Full Name" value={registration.fullName} onChange={(value) => setRegistration((current) => ({ ...current, fullName: value }))} />
                  <SaudiPhoneField label="Mobile Number" value={registration.mobile} onChange={(value) => setRegistration((current) => ({ ...current, mobile: value }))} />
                  <Field label="Email" type="email" value={registration.email} onChange={(value) => setRegistration((current) => ({ ...current, email: value }))} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <PasswordField
                      label="Password"
                      value={registration.password}
                      visible={showRegisterPassword}
                      onChange={(value) => setRegistration((current) => ({ ...current, password: value }))}
                      onToggle={() => setShowRegisterPassword((current) => !current)}
                    />
                    <PasswordField
                      label="Confirm Password"
                      value={registration.confirmPassword}
                      visible={showRegisterConfirmPassword}
                      onChange={(value) => setRegistration((current) => ({ ...current, confirmPassword: value }))}
                      onToggle={() => setShowRegisterConfirmPassword((current) => !current)}
                    />
                  </div>
                  <div className="grid gap-1 rounded-lg bg-slate-50 p-3 text-sm font-semibold dark:bg-white/5">
                    {getPasswordChecks(registration.password).map((check) => (
                      <p key={check.label} className={check.valid ? "text-emerald-700 dark:text-mint" : "text-slate-500 dark:text-slate-300"}>
                        {check.valid ? "OK" : "--"} {check.label}
                      </p>
                    ))}
                  </div>
                  {supabaseDiagnosticsPanel}
                  {registrationSuccessMessage && (
                    <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-800 dark:border-emerald-300/30 dark:bg-emerald-300/10 dark:text-emerald-100">
                      {registrationSuccessMessage}
                    </p>
                  )}
                  {signupDiagnostic.status !== "idle" && (
                    <div className={`rounded-lg border px-3 py-3 text-xs font-bold ${
                      signupDiagnostic.status === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-300/30 dark:bg-emerald-300/10 dark:text-emerald-100"
                        : "border-red-200 bg-red-50 text-red-900 dark:border-red-300/30 dark:bg-red-300/10 dark:text-red-100"
                    }`}>
                      <p className="text-sm font-black">{signupDiagnostic.status === "success" ? "SIGNUP SUCCESS" : "SIGNUP FAILED"}</p>
                      <p className="mt-2">email: {signupDiagnostic.email || "none"}</p>
                      <p>error.code: {signupDiagnostic.errorCode || "none"}</p>
                      <p>error.message: {signupDiagnostic.errorMessage || "none"}</p>
                      <p>error.status: {signupDiagnostic.errorStatus || "none"}</p>
                      <p className="mt-2 font-black">data.user</p>
                      <pre className="mt-1 max-h-36 overflow-auto whitespace-pre-wrap rounded bg-white/70 p-2 text-[11px] dark:bg-black/30">{signupDiagnostic.user}</pre>
                      <p className="mt-2 font-black">data.session</p>
                      <pre className="mt-1 max-h-36 overflow-auto whitespace-pre-wrap rounded bg-white/70 p-2 text-[11px] dark:bg-black/30">{signupDiagnostic.session}</pre>
                      <p className="mt-2 font-black">profile insert response</p>
                      <pre className="mt-1 max-h-36 overflow-auto whitespace-pre-wrap rounded bg-white/70 p-2 text-[11px] dark:bg-black/30">{signupDiagnostic.profileInsert}</pre>
                    </div>
                  )}
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                    <p>User source: {userSourceMode === "supabase" ? "Supabase" : "Local beta registry"}</p>
                    <p>Registered users: {registeredUsersCount}</p>
                    <p>Login source users: {loginSourceUsersCount}</p>
                    <p>Signup clicks: {registrationClickDebug.clicks}</p>
                    <p>Signup phase: {registrationClickDebug.phase}</p>
                    <p>Signup validation: {registrationClickDebug.lastValidation}</p>
                    <p>Signup last error: {registrationClickDebug.lastError}</p>
                    {registrationClickDebug.timings.length > 0 && (
                      <p>Signup timings: {registrationClickDebug.timings.join(" | ")}</p>
                    )}
                    {userStoreMismatch && <p className="text-red-600 dark:text-red-300">Warning: user store mismatch.</p>}
                  </div>
                  {authError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700 dark:bg-red-400/10 dark:text-red-200">{authError}</p>}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button className="h-11 rounded-lg border border-slate-200 text-sm font-bold disabled:opacity-50 dark:border-white/10" disabled={Boolean(registrationAction)} onClick={() => setFlow("app")}>
                      Back
                    </button>
                    <button
                      className="flex h-11 items-center justify-center gap-2 rounded-lg bg-ink text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-70 dark:bg-mint dark:text-ink"
                      onClick={completeRegistration}
                      disabled={Boolean(registrationAction)}
                    >
                      {registrationAction || (language === "ar" ? "متابعة" : "Continue")}
                      {!registrationAction && <ChevronRight size={17} />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {flow === "login" && (
              <div className="mx-auto w-full max-w-2xl rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                <p className="text-xs font-black uppercase text-mint">Login</p>
                <h3 className="mt-2 text-2xl font-black">{forgotPassword ? "Reset your password" : "Access your DebtIQ dashboard"}</h3>
                <div className="mt-5 grid gap-3">
                  {!forgotPassword && (
                    <>
                      <Field label="Email" type="email" value={login.email} onChange={(value) => setLogin((current) => ({ ...current, email: value }))} />
                      <PasswordField
                        label="Password"
                        value={login.password}
                        visible={showLoginPassword}
                        onChange={(value) => setLogin((current) => ({ ...current, password: value }))}
                        onToggle={() => setShowLoginPassword((current) => !current)}
                      />
                      {supabaseDiagnosticsPanel}
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                        <p>User source: {userSourceMode === "supabase" ? "Supabase" : "Local beta registry"}</p>
                        <p>Registered users: {registeredUsersCount}</p>
                        <p>Login source users: {loginSourceUsersCount}</p>
                        {userStoreMismatch && <p className="text-red-600 dark:text-red-300">Warning: user store mismatch.</p>}
                      </div>
                      {authError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700 dark:bg-red-400/10 dark:text-red-200">{authError}</p>}
                      <button className="h-11 rounded-lg bg-ink text-sm font-bold text-white dark:bg-mint dark:text-ink" onClick={completeLogin}>
                        Login
                      </button>
                      <button
                        className="h-10 text-left text-sm font-black text-emerald-700 dark:text-mint"
                        onClick={() => {
                          setAuthError("");
                          setReset({ email: login.email || profile.email });
                          setForgotPassword(true);
                        }}
                      >
                        Forgot password?
                      </button>
                    </>
                  )}
                  {forgotPassword && (
                    <>
                      <Field label="Email" type="email" value={reset.email} onChange={(value) => setReset({ email: value })} />
                      {authError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700 dark:bg-red-400/10 dark:text-red-200">{authError}</p>}
                      <button className="h-11 rounded-lg bg-ink text-sm font-bold text-white dark:bg-mint dark:text-ink" onClick={sendResetLink}>
                        Send reset link
                      </button>
                    </>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <button className="h-11 rounded-lg border border-slate-200 text-sm font-bold dark:border-white/10" onClick={() => setFlow("app")}>
                      Back
                    </button>
                    <button className="h-11 rounded-lg border border-slate-200 text-sm font-bold dark:border-white/10" onClick={startRegistration}>
                      Create Account
                    </button>
                  </div>
                </div>
              </div>
            )}

            {flow === "onboarding" && (
              <div className="mx-auto w-full max-w-3xl rounded-lg border border-white/70 bg-white/85 p-4 pt-[calc(env(safe-area-inset-top)+1rem)] shadow-sm dark:border-white/10 dark:bg-white/5 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase text-mint">{t.onboarding.title}</p>
                    <h3 className="mt-2 text-xl font-black leading-tight sm:text-2xl">{onboardingStep === 0 ? "Choose setup method" : `Step ${onboardingStep} of 4`}</h3>
                    {sessionMode === "real" && (
                      <p className="mt-2 text-sm font-bold text-slate-500 dark:text-slate-300">
                        {language === "ar" ? "تابع إعداد ملفك المالي" : "Continue setting up your financial profile"}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {[0, 1, 2, 3, 4].map((step) => (
                      <span key={step} className={`h-2 w-7 rounded-full sm:w-8 ${step <= onboardingStep ? "bg-mint" : "bg-slate-200 dark:bg-white/10"}`} />
                    ))}
                    <button type="button" className="ms-1 text-xs font-black text-emerald-700 underline dark:text-mint" onClick={resetOnboardingForCurrentUser}>
                      {language === "ar" ? "ابدأ من جديد" : "Start over"}
                    </button>
                  </div>
                </div>

                {onboardingStep === 0 && (
                  <div className="mt-5 grid gap-4">
                    <h4 className="font-black">{t.onboarding.setupChoice}</h4>
                    <div className="rounded-lg border border-mint/30 bg-mint/10 p-4 text-sm leading-6 text-slate-700 dark:text-slate-200">
                      <p className="font-black">{t.onboarding.whyTitle}</p>
                      <p className="mt-1">{t.onboarding.whyBody}</p>
                      <p className="mt-1">{t.onboarding.whyDetail}</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        className="rounded-lg border border-slate-200 p-5 text-left transition hover:border-mint dark:border-white/10"
                        type="button"
                        onClick={() => {
                          setFlow("app");
                          setActive("dashboard");
                          setImportWizardOpen(true);
                          setImportSummary("");
                          setTimeout(() => fileInputRef.current?.click(), 0);
                        }}
                      >
                        <p className="text-xs font-black uppercase text-mint">Option 1</p>
                        <p className="mt-2 text-lg font-black">{t.onboarding.importExcel}</p>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">Upload an Excel or CSV file, map columns, preview, then confirm.</p>
                      </button>
                      <button
                        className="rounded-lg border border-slate-200 p-5 text-left transition hover:border-mint dark:border-white/10"
                        type="button"
                        onClick={() => {
                          setOnboardingMode("quick");
                          setOnboardingStep(1);
                        }}
                      >
                        <p className="text-xs font-black uppercase text-mint">Option 2</p>
                        <p className="mt-2 text-lg font-black">Quick Start</p>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">Add salary, main obligations, and a goal. You can add details later.</p>
                      </button>
                      <button
                        className="rounded-lg border border-slate-200 p-5 text-left transition hover:border-mint dark:border-white/10 sm:col-span-2"
                        type="button"
                        onClick={() => {
                          setOnboardingMode("full");
                          setOnboardingStep(1);
                        }}
                      >
                        <p className="text-xs font-black uppercase text-mint">Option 3</p>
                        <p className="mt-2 text-lg font-black">Full Setup</p>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">Detailed income, lifestyle expenses, credit cards, goals, and Excel import remain available.</p>
                      </button>
                    </div>
                  </div>
                )}

                {onboardingStep === 1 && (
                  <div className="mt-5 grid gap-4">
                    <div>
                      <h4 className="font-black">{t.onboarding.workIncome}</h4>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{t.onboarding.whyBody}</p>
                    </div>
                    <div className="grid gap-3 rounded-lg border border-slate-200 p-4 dark:border-white/10">
                      <Field
                        label={t.onboarding.employerName}
                        value={profile.employer}
                        onChange={(value) => {
                          setSkipEmployer(false);
                          setProfile((current) => ({ ...current, employer: value }));
                        }}
                      />
                      <label className="flex items-center gap-3 text-sm font-bold text-slate-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={skipEmployer}
                          onChange={(event) => {
                            setSkipEmployer(event.target.checked);
                            if (event.target.checked) setProfile((current) => ({ ...current, employer: "" }));
                          }}
                        />
                        {t.onboarding.skipEmployer}
                      </label>
                    </div>
                    <div className="grid gap-3 rounded-lg border border-slate-200 p-4 dark:border-white/10">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <SelectField
                          label={language === "ar" ? "الدولة" : "Country"}
                          value={profile.country}
                          options={["", ...countryOptions]}
                          getOptionLabel={(value) => (value ? countryLabel(value) : language === "ar" ? "اختر الدولة" : "Select country")}
                          onChange={(value) =>
                            setProfile((current) => ({
                              ...current,
                              country: value as Country | "",
                              city: "",
                            }))
                          }
                        />
                        <SelectField
                          label={language === "ar" ? "المدينة" : "City"}
                          value={profile.city}
                          options={["", ...(profile.country ? cityOptionsByCountry[profile.country as Country] : ["Other"])]}
                          getOptionLabel={(value) => (value ? cityLabel(value) : language === "ar" ? "اختر المدينة" : "Select city")}
                          onChange={(value) => setProfile((current) => ({ ...current, city: value }))}
                        />
                        {(profile.city === "Other" || profile.country === "Other" || (profile.country && profile.city && !cityOptionsByCountry[profile.country as Country]?.includes(profile.city))) && (
                          <Field label={language === "ar" ? "اكتب المدينة" : "Manual city"} value={profile.city === "Other" ? "" : profile.city} onChange={(value) => setProfile((current) => ({ ...current, city: value }))} />
                        )}
                        <SelectField
                          label={language === "ar" ? "الحالة الاجتماعية" : "Marital Status"}
                          value={profile.maritalStatus}
                          options={["", ...maritalStatusOptions]}
                          getOptionLabel={(value) => (value ? maritalStatusLabel(value) : language === "ar" ? "اختر الحالة" : "Select status")}
                          onChange={(value) => setProfile((current) => ({ ...current, maritalStatus: value as MaritalStatus | "" }))}
                        />
                        <SelectField
                          label={language === "ar" ? "قطاع العمل" : "Employment Sector"}
                          value={profile.employmentSector}
                          options={["", ...employmentSectorOptions]}
                          getOptionLabel={(value) => (value ? employmentSectorLabel(value) : language === "ar" ? "اختر القطاع" : "Select sector")}
                          onChange={(value) => setProfile((current) => ({ ...current, employmentSector: value as EmploymentSector | "" }))}
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <button
                          className={`rounded-lg border p-3 text-left text-sm font-bold ${incomeEntryMode === "total" ? "border-mint bg-mint/10 text-emerald-800 dark:text-mint" : "border-slate-200 dark:border-white/10"}`}
                          onClick={() => setIncomeEntryMode("total")}
                        >
                          {t.onboarding.totalIncome}
                        </button>
                        <button
                          className={`rounded-lg border p-3 text-left text-sm font-bold ${incomeEntryMode === "detailed" ? "border-mint bg-mint/10 text-emerald-800 dark:text-mint" : "border-slate-200 dark:border-white/10"}`}
                          onClick={() => setIncomeEntryMode("detailed")}
                        >
                          {t.onboarding.detailedIncome}
                        </button>
                      </div>
                      {incomeEntryMode === "total" ? (
                        <Field label={t.onboarding.monthlyNetSalary} type="number" value={onboarding.monthlyNetSalary} help={t.tooltips.monthlyNetSalary} onChange={(value) => setOnboarding((current) => ({ ...current, monthlyNetSalary: Number(value) }))} />
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Basic Salary" type="number" value={onboarding.basicSalary} onChange={(value) => setOnboarding((current) => ({ ...current, basicSalary: Number(value) }))} />
                          <Field label="Housing Allowance" type="number" value={onboarding.housingAllowance} onChange={(value) => setOnboarding((current) => ({ ...current, housingAllowance: Number(value) }))} />
                          <Field label="Transport Allowance" type="number" value={onboarding.transportAllowance} onChange={(value) => setOnboarding((current) => ({ ...current, transportAllowance: Number(value) }))} />
                          <Field label="Other Allowance" type="number" value={onboarding.otherAllowance} onChange={(value) => setOnboarding((current) => ({ ...current, otherAllowance: Number(value) }))} />
                          <Field label="Other Income" type="number" value={onboarding.otherIncome} onChange={(value) => setOnboarding((current) => ({ ...current, otherIncome: Number(value) }))} />
                        </div>
                      )}
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Field label="Estimated Annual Bonus" type="number" value={onboarding.annualBonus} help={t.tooltips.annualBonus} onChange={(value) => setOnboarding((current) => ({ ...current, annualBonus: Number(value) }))} />
                        <Field label="Expected Month" value={onboarding.annualBonusMonth} onChange={(value) => setOnboarding((current) => ({ ...current, annualBonusMonth: value }))} />
                        <label className="flex h-11 items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm font-bold dark:border-white/10">
                          <input type="checkbox" checked={onboarding.annualBonusGuaranteed} onChange={(event) => setOnboarding((current) => ({ ...current, annualBonusGuaranteed: event.target.checked }))} />
                          Guaranteed / Variable
                        </label>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="font-black">Income Sources</h4>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Total: {currency.format(snapshot.totalIncome)}</p>
                      </div>
                      <button className="grid size-10 place-items-center rounded-lg bg-ink text-white dark:bg-mint dark:text-ink" onClick={addIncomeSource} aria-label="Add income source">
                        <Plus size={18} />
                      </button>
                    </div>
                    {incomeSources.length === 0 && (
                      <button className="h-11 rounded-lg border border-dashed border-slate-300 text-sm font-bold dark:border-white/20" onClick={addIncomeSource}>
                        Add your first income source
                      </button>
                    )}
                    {incomeSources.map((income, index) => (
                      <div key={income.id} className="grid gap-3 rounded-lg border border-slate-200 p-4 dark:border-white/10">
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_3rem] sm:items-end">
                          <div className="min-w-0 flex-1">
                            <SelectField
                              label="Income Type"
                              value={income.type}
                              options={incomeTypes}
                              onChange={(value) =>
                                setIncomeSources((current) => current.map((item, i) => (i === index ? { ...item, type: value as IncomeType, recurring: value === "Bonus" ? false : item.recurring } : item)))
                              }
                            />
                          </div>
                          <button
                            className="flex h-11 w-full items-center justify-center rounded-lg border border-red-200 text-red-600 dark:border-red-400/30 dark:text-red-300 sm:size-11"
                            onClick={() => deleteIncomeSource(income.id)}
                            aria-label="Delete income source"
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Income Name" value={income.name} onChange={(value) => setIncomeSources((current) => current.map((item, i) => (i === index ? { ...item, name: value } : item)))} />
                          <Field label="Income Amount" type="number" value={income.amount} onChange={(value) => setIncomeSources((current) => current.map((item, i) => (i === index ? { ...item, amount: Number(value) } : item)))} />
                          {income.type !== "Bonus" && (
                            <label className="flex h-11 items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm font-bold dark:border-white/10">
                              <input type="checkbox" checked={income.recurring !== false} onChange={(event) => setIncomeSources((current) => current.map((item, i) => (i === index ? { ...item, recurring: event.target.checked } : item)))} />
                              Recurring monthly income
                            </label>
                          )}
                          {income.type === "Bonus" && (
                            <>
                              <Field label="Expected Month" value={income.expectedMonth || "December"} onChange={(value) => setIncomeSources((current) => current.map((item, i) => (i === index ? { ...item, expectedMonth: value, recurring: false } : item)))} />
                              <label className="flex h-11 items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm font-bold dark:border-white/10">
                                <input type="checkbox" checked={Boolean(income.guaranteed)} onChange={(event) => setIncomeSources((current) => current.map((item, i) => (i === index ? { ...item, guaranteed: event.target.checked } : item)))} />
                                Guaranteed
                              </label>
                              <SelectField
                                label={language === "ar" ? "كيف تفضل استخدام هذا البونص؟" : "How would you like to use this bonus?"}
                                value={getBonusAllocation(income)}
                                options={bonusAllocationOptions}
                                getOptionLabel={bonusAllocationLabel}
                                onChange={(value) => setIncomeSources((current) => current.map((item, i) => (i === index ? { ...item, allocation: value as BonusAllocation, recurring: false } : item)))}
                              />
                              <Field label="Notes" value={income.notes || ""} onChange={(value) => setIncomeSources((current) => current.map((item, i) => (i === index ? { ...item, notes: value } : item)))} />
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {onboardingStep === 2 && (
                  <div className="mt-5 grid gap-4">
                    <div>
                      <h4 className="font-black">{t.onboarding.lifestyle}</h4>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-300">
                        These are not formal debts, but they affect cash flow.
                        <HelpTip text={t.tooltips.lifestyleExpenses} />
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {lifestyleExpenseNames.map((name) => {
                        const existing = obligationEntries.find((obligation) => obligation.category === "Lifestyle" && obligation.name === name);
                        return (
                          <Field
                            key={name}
                            label={name}
                            type="number"
                            value={existing?.monthlyAmount || 0}
                            onChange={(value) => {
                              const amount = Number(value);
                              setObligationEntries((current) => {
                                const match = current.find((obligation) => obligation.category === "Lifestyle" && obligation.name === name);
                                if (match) return current.map((obligation) => (obligation.id === match.id ? { ...obligation, monthlyAmount: amount } : obligation));
                                return [
                                  ...current,
                                  {
                                    id: crypto.randomUUID(),
                                    name,
                                    monthlyAmount: amount,
                                    category: "Lifestyle",
                                    dueDay: 1,
                                    isRecurring: true,
                                    frequency: "Monthly",
                                    dueDate: dateFromDueDay(1),
                                    startDate: isoDate(new Date()),
                                    allocationMethod: "Count full amount only in due month",
                                    savedAmount: 0,
                                    notes: "Lifestyle expense added during onboarding.",
                                  },
                                ];
                              });
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {onboardingStep === 3 && (
                  <div className="mt-5 grid gap-4">
                    <div className="grid gap-3 rounded-lg border border-slate-200 p-4 dark:border-white/10">
                      <h4 className="font-black">{t.onboarding.commonObligations}</h4>
                      <p className="text-sm font-semibold text-slate-500 dark:text-slate-300">
                        Did we miss something? School fees? Wife&apos;s birthday? Car insurance? 😊
                      </p>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {commonObligationOptions.map((option) => (
                          <button
                            key={option.name}
                            className={`rounded-lg border px-3 py-2 text-left text-sm font-bold ${selectedChecklistItems.includes(option.name) ? "border-mint bg-mint/10 text-emerald-800 dark:text-mint" : "border-slate-200 dark:border-white/10"}`}
                            onClick={() => addObligationFromChecklist(option)}
                          >
                            {option.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Field label="Existing Loans" type="number" value={onboarding.existingLoans} onChange={(value) => setOnboarding((current) => ({ ...current, existingLoans: Number(value) }))} />
                    <Field label="Credit Cards" type="number" value={onboarding.creditCards} onChange={(value) => setOnboarding((current) => ({ ...current, creditCards: Number(value) }))} />
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="font-black">Credit Cards</h4>
                      <button className="grid size-10 place-items-center rounded-lg bg-ink text-white dark:bg-mint dark:text-ink" onClick={addCreditCard} aria-label="Add credit card">
                        <Plus size={18} />
                      </button>
                    </div>
                    {creditCards.map((card, index) => (
                      <div key={card.id} className="grid gap-3 rounded-lg border border-slate-200 p-4 dark:border-white/10">
                        <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
                          <p className="min-w-0 truncate font-black">{card.cardName}</p>
                          <button className="flex h-11 w-full shrink-0 items-center justify-center rounded-lg border border-red-200 text-red-600 dark:border-red-400/30 dark:text-red-300 sm:size-10 sm:w-10" onClick={() => deleteCreditCard(card.id)} aria-label="Delete credit card">
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Card Name" value={card.cardName} onChange={(value) => setCreditCards((current) => current.map((item, i) => (i === index ? { ...item, cardName: value } : item)))} />
                          <Field label="Bank / Provider" value={card.provider} onChange={(value) => setCreditCards((current) => current.map((item, i) => (i === index ? { ...item, provider: value } : item)))} />
                          <Field label="Credit Limit" type="number" value={card.creditLimit} help={t.tooltips.creditLimit} onChange={(value) => setCreditCards((current) => current.map((item, i) => (i === index ? { ...item, creditLimit: Number(value) } : item)))} />
                          <Field label="Current Balance" type="number" value={card.currentBalance} onChange={(value) => setCreditCards((current) => current.map((item, i) => (i === index ? { ...item, currentBalance: Number(value) } : item)))} />
                          <Field label="Minimum Payment Due" type="number" value={card.minimumPaymentDue} help={t.tooltips.minimumPaymentDue} onChange={(value) => setCreditCards((current) => current.map((item, i) => (i === index ? { ...item, minimumPaymentDue: Number(value) } : item)))} />
                          <Field label="Statement Total Due" type="number" value={card.statementTotalDue} help={t.tooltips.statementTotalDue} onChange={(value) => setCreditCards((current) => current.map((item, i) => (i === index ? { ...item, statementTotalDue: Number(value) } : item)))} />
                          <Field label="Due Date" type="date" value={card.dueDate} onChange={(value) => setCreditCards((current) => current.map((item, i) => (i === index ? { ...item, dueDate: value } : item)))} />
                          <Field label="APR / Profit Rate" type="number" value={card.aprOrProfitRate} onChange={(value) => setCreditCards((current) => current.map((item, i) => (i === index ? { ...item, aprOrProfitRate: Number(value) } : item)))} />
                          <Field label="Notes" value={card.notes} onChange={(value) => setCreditCards((current) => current.map((item, i) => (i === index ? { ...item, notes: value } : item)))} />
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="font-black">Obligations Module</h4>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Total: {currency.format(snapshot.totalMonthlyObligations)}</p>
                      </div>
                      <button className="grid size-10 place-items-center rounded-lg bg-ink text-white dark:bg-mint dark:text-ink" onClick={addObligationEntry} aria-label="Add obligation">
                        <Plus size={18} />
                      </button>
                    </div>
                    {obligationEntries.length === 0 && (
                      <button className="h-11 rounded-lg border border-dashed border-slate-300 text-sm font-bold dark:border-white/20" onClick={addObligationEntry}>
                        Add your first obligation
                      </button>
                    )}
                    {obligationEntries.map((obligation, index) => (
                      <div key={obligation.id} className="grid gap-3 rounded-lg border border-slate-200 p-4 dark:border-white/10">
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_3rem] sm:items-end">
                          <div className="min-w-0 flex-1">
                            <SelectField
                              label="Category"
                              value={obligation.category}
                              options={obligationCategories}
                              getOptionLabel={categoryLabel}
                              onChange={(value) =>
                                setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, category: value as ObligationCategory } : item)))
                              }
                            />
                          </div>
                          <button
                            className="flex h-11 w-full items-center justify-center rounded-lg border border-red-200 text-red-600 dark:border-red-400/30 dark:text-red-300 sm:size-11"
                            onClick={() => deleteObligationEntry(obligation.id)}
                            aria-label="Delete obligation"
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Obligation Name" value={obligation.name} onChange={(value) => setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, name: value } : item)))} />
                          <Field label="Amount" type="number" value={obligation.monthlyAmount} onChange={(value) => setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, monthlyAmount: Number(value) } : item)))} />
                          <SelectField label="Frequency" value={obligation.frequency} options={obligationFrequencies} help={t.tooltips.frequency} onChange={(value) => setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, frequency: value as ObligationFrequency, isRecurring: value !== "One-Time" } : item)))} />
                          <Field label="Due Day of Month" type="number" value={obligation.dueDay} onChange={(value) => setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, dueDay: Number(value) } : item)))} />
                          <Field label="Due Date" type="date" value={obligation.dueDate} help={t.tooltips.dueDate} onChange={(value) => setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, dueDate: value, dueDay: parseDueDay(value) || item.dueDay } : item)))} />
                          <Field label="Start Date" type="date" value={obligation.startDate} help={t.tooltips.startDate} onChange={(value) => setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, startDate: value } : item)))} />
                          <Field label="Optional End Date" type="date" value={obligation.endDate || ""} help={t.tooltips.endDate} onChange={(value) => setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, endDate: value } : item)))} />
                          <SelectField label="Allocation Method" value={obligation.allocationMethod} options={obligationAllocationMethods} help={t.tooltips.allocationMethod} onChange={(value) => setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, allocationMethod: value as ObligationAllocationMethod } : item)))} />
                          <Field label="Saved Amount" type="number" value={obligation.savedAmount} onChange={(value) => setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, savedAmount: Number(value) } : item)))} />
                          <Field label="Notes" value={obligation.notes} onChange={(value) => setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, notes: value } : item)))} />
                          <label className="flex h-11 items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm font-bold dark:border-white/10">
                            <input type="checkbox" checked={obligation.isRecurring} onChange={(event) => setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, isRecurring: event.target.checked } : item)))} />
                            Is Recurring
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {onboardingStep === 4 && (
                  <div className="mt-5 grid gap-4">
                    <div className="grid gap-3 rounded-lg border border-slate-200 p-4 dark:border-white/10">
                      <h4 className="font-black">{t.onboarding.goalsQuestion}</h4>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {starterGoalTypes.map((type) => (
                          <button
                            key={type}
                            className={`rounded-lg border px-3 py-2 text-left text-sm font-bold ${selectedGoalStarters.includes(type) ? "border-mint bg-mint/10 text-emerald-800 dark:text-mint" : "border-slate-200 dark:border-white/10"}`}
                            onClick={() => addGoalStarter(type)}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="font-black">Goals</h4>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Add one or more goals, or skip and add them later.</p>
                      </div>
                      <button className="grid size-10 place-items-center rounded-lg bg-ink text-white dark:bg-mint dark:text-ink" onClick={addGoal} aria-label="Add goal">
                        <Plus size={18} />
                      </button>
                    </div>
                    {goals.length === 0 && (
                      <div className="rounded-lg border border-mint/30 bg-mint/10 p-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Goal setup is optional. Your dashboard can be generated now and goals can be added from the Goals tab.
                      </div>
                    )}
                    <div className="grid gap-4">
                      {goals.map((goal, index) => renderGoalEditor(goal, index))}
                    </div>
                  </div>
                )}

                {onboardingAction && (
                  <p className="mt-5 rounded-lg bg-mint/10 px-3 py-2 text-sm font-bold text-emerald-800 dark:text-mint">
                    {validationMessage("Processing...", "جاري المعالجة...")}
                  </p>
                )}

                {authError && <p className="mt-5 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700 dark:bg-red-400/10 dark:text-red-200">{authError}</p>}

                {debugOnboarding && (() => {
                  const storedSession = readJson<StoredSession | null>(sessionStorageKey, null);
                  const checkpoint = currentUserId ? readJson<OnboardingProgress | null>(onboardingProgressStorageKey(currentUserId), null) : null;
                  const checkpointAge = checkpoint?.savedAt ? Math.round(getCheckpointAgeMs(checkpoint) / 60000) : null;
                  return (
                    <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs font-bold text-amber-900 dark:border-amber-300/40 dark:bg-amber-300/10 dark:text-amber-100">
                      <p>Onboarding debug</p>
                      <p>render mode: {appShellReady ? "appShell" : "onboarding"}</p>
                      <p>current step: {onboardingStep}</p>
                      <p>next step target: {onboardingStep >= 4 ? "complete" : getNextOnboardingStep()}</p>
                      <p>active user: {profile.email || registration.email || "none"} / {currentUserId || "none"}</p>
                      <p>checkpoint user: {checkpoint?.email || checkpoint?.registration.email || "none"} / {checkpoint?.userId || "none"}</p>
                      <p>checkpoint age: {checkpointAge === null ? "missing" : `${checkpointAge} minutes`}</p>
                      <p>mode: {onboardingMode}</p>
                      <p>flow: {flow}</p>
                      <p>onboardingStatus: {storedSession?.onboardingStatus || "none"}</p>
                      <p>processing: {onboardingAction || onboardingProcessingRef.current ? "yes" : "no"}</p>
                      <p>last action: {onboardingDebug.lastAction}</p>
                      <p>last validation: {onboardingDebug.lastValidation}</p>
                      <p>generation status: {onboardingDebug.generationStatus}</p>
                      {lastOnboardingError && <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-white/80 p-2 text-[11px] dark:bg-black/30">{lastOnboardingError}</pre>}
                    </div>
                  );
                })()}

                {onboardingStep > 0 && <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    className="h-11 rounded-lg border border-slate-200 text-sm font-bold disabled:opacity-40 dark:border-white/10"
                    type="button"
                    disabled={onboardingStep === 1 || Boolean(onboardingAction)}
                    onClick={handleBackStep}
                  >
                    Back
                  </button>
                  <button
                    className="flex h-11 items-center justify-center gap-2 rounded-lg bg-ink text-sm font-bold text-white disabled:opacity-60 dark:bg-mint dark:text-ink"
                    type="button"
                    disabled={Boolean(onboardingAction)}
                    onClick={onboardingStep === 4 ? () => handleCompleteOnboarding("generate") : handleContinueStep}
                  >
                    {onboardingAction ? validationMessage("Processing...", "جاري المعالجة...") : onboardingStep === 4 ? "Generate Dashboard" : t.common.next}
                    <ChevronRight size={17} />
                  </button>
                  <button
                    className="col-span-2 h-10 rounded-lg border border-dashed border-slate-300 text-sm font-bold disabled:opacity-60 dark:border-white/20"
                    type="button"
                    disabled={Boolean(onboardingAction)}
                    onClick={handleSkipOrAddLater}
                  >
                    {onboardingAction ? validationMessage("Processing...", "جاري المعالجة...") : "Skip for now / Add later"}
                  </button>
                  {onboardingStep === 1 && (
                    <div className="col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">
                      <p>Step 1 action debug</p>
                      <p>clicked: {stepOneActionDebug.clicked}</p>
                      <p>validation: {stepOneActionDebug.validation}</p>
                      <p>last error: {stepOneActionDebug.lastError}</p>
                    </div>
                  )}
                </div>}
              </div>
            )}

            {flow === "app" && active === "dashboard" && (
              <div className="grid gap-5">
                {showBetaSetupCard && (
                  <div className="rounded-lg border border-mint/40 bg-gradient-to-br from-mint/15 via-white/85 to-white p-5 shadow-premium dark:from-mint/15 dark:via-white/5 dark:to-white/0">
                    <div className="flex items-start gap-3">
                      <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-mint/20 text-2xl" aria-hidden="true">👋</div>
                      <div className="min-w-0">
                        <h3 className="text-xl font-black">{language === "ar" ? "مرحباً بك في ديبت آي كيو" : "Welcome to DebtIQ"}</h3>
                        <p className="mt-2 text-[15px] font-bold leading-7 text-slate-600 dark:text-slate-200">
                          {language === "ar"
                            ? "خلّينا نبدأ بهدوء. أضف دخلك أولاً، ثم التزاماتك، وبعدها بطاقاتك وأهدافك. كلما أضفت معلومات أكثر، أصبحت صورتك المالية أوضح."
                            : "Let's start gently. Add your income first, then your obligations, cards, and goals. The more you add, the clearer your financial picture becomes."}
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-2 sm:grid-cols-4">
                      {[
                        language === "ar" ? "1 الدخل" : "1 Income",
                        language === "ar" ? "2 الالتزامات" : "2 Obligations",
                        language === "ar" ? "3 بطاقات" : "3 Cards",
                        language === "ar" ? "4 أهداف" : "4 Goals",
                      ].map((step) => (
                        <span key={step} className="rounded-lg border border-mint/30 bg-white/75 px-3 py-2 text-center text-xs font-black text-emerald-700 dark:bg-white/5 dark:text-mint">
                          {step}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-4">
                      <button className="h-11 rounded-lg bg-ink px-3 text-sm font-black text-white dark:bg-mint dark:text-ink" type="button" onClick={() => setActive("income")}>
                        {language === "ar" ? "أضف دخلي" : "Add my income"}
                      </button>
                      <button className="h-11 rounded-lg border border-mint/40 bg-white/70 px-3 text-sm font-black text-ink dark:bg-white/5 dark:text-white" type="button" onClick={() => setActive("obligations")}>
                        {language === "ar" ? "أضف التزاماتي" : "Add my obligations"}
                      </button>
                      <button className="h-11 rounded-lg border border-mint/40 bg-white/70 px-3 text-sm font-black text-ink dark:bg-white/5 dark:text-white" type="button" onClick={() => setActive("debts")}>
                        {language === "ar" ? "أضف بطاقاتي" : "Add my cards"}
                      </button>
                      <button className="h-11 rounded-lg border border-slate-200 bg-white/70 px-3 text-sm font-black text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200" type="button" onClick={() => setActive("goals")}>
                        {language === "ar" ? "أضيف أهدافي لاحقاً" : "Add goals later"}
                      </button>
                    </div>
                  </div>
                )}
                {showBetaSetupCard && friendlyReminderCard}
                {(importWizardOpen || importPreview || importErrors.length > 0 || importSummary) && (
                  <div className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase text-mint">Import Wizard</p>
                        <h3 className="mt-1 font-black">{importPreview ? `Preview: ${importFileName}` : "Import Data"}</h3>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-4">
                        <button className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-bold dark:border-white/10" onClick={() => fileInputRef.current?.click()}>
                          Upload File
                        </button>
                        <button className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-bold dark:border-white/10" onClick={downloadTemplate}>
                          Template
                        </button>
                        <button className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-bold dark:border-white/10" onClick={cancelImport}>
                          Cancel
                        </button>
                        <button
                          className="h-11 rounded-lg bg-ink px-4 text-sm font-bold text-white disabled:opacity-40 dark:bg-mint dark:text-ink"
                          disabled={!importPreview || importErrors.length > 0}
                          onClick={confirmImport}
                        >
                          Confirm Import
                        </button>
                      </div>
                    </div>

                    {!importPreview && importErrors.length === 0 && !importSummary && (
                      <p className="mt-4 rounded-lg border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-500 dark:border-white/20 dark:text-slate-300">
                        Upload a `.xlsx` or `.csv` file. DebtIQ will detect columns first, then let you map them before import.
                      </p>
                    )}

                    {importSummary && <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">{importSummary}</p>}

                    {importRawData && (
                      <div className="mt-4 rounded-lg border border-slate-200 p-4 dark:border-white/10">
                        <h4 className="font-black">Column Mapping</h4>
                        <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
                          Map uploaded columns to DebtIQ fields. Arabic and English category values are supported.
                        </p>
                        <div className="mt-4 grid gap-4 xl:grid-cols-2">
                          {importRawData.columns.incomeSources.length > 0 && (
                            <div className="grid gap-3 rounded-lg bg-slate-50 p-3 dark:bg-white/5">
                              <p className="font-black">Income Sources</p>
                              <div className="grid gap-3 sm:grid-cols-3">
                                {renderMappingSelect("incomeSources", "name", "Name", importRawData.columns.incomeSources)}
                                {renderMappingSelect("incomeSources", "type", "Type", importRawData.columns.incomeSources)}
                                {renderMappingSelect("incomeSources", "amount", "Amount", importRawData.columns.incomeSources)}
                              </div>
                            </div>
                          )}
                          {importRawData.columns.obligations.length > 0 && (
                            <div className="grid gap-3 rounded-lg bg-slate-50 p-3 dark:bg-white/5">
                              <p className="font-black">Obligations</p>
                              <div className="grid gap-3 sm:grid-cols-3">
                                {renderMappingSelect("obligations", "name", "Obligation Name", importRawData.columns.obligations)}
                                {renderMappingSelect("obligations", "category", "Category", importRawData.columns.obligations)}
                                {renderMappingSelect("obligations", "amount", "Amount", importRawData.columns.obligations)}
                                {renderMappingSelect("obligations", "frequency", "Frequency", importRawData.columns.obligations)}
                                {renderMappingSelect("obligations", "dueDate", "Due Date", importRawData.columns.obligations)}
                                {renderMappingSelect("obligations", "startDate", "Start Date", importRawData.columns.obligations)}
                                {renderMappingSelect("obligations", "endDate", "End Date", importRawData.columns.obligations)}
                                {renderMappingSelect("obligations", "allocationMethod", "Allocation Method", importRawData.columns.obligations)}
                                {renderMappingSelect("obligations", "savedAmount", "Saved Amount", importRawData.columns.obligations)}
                                {renderMappingSelect("obligations", "notes", "Notes", importRawData.columns.obligations)}
                              </div>
                            </div>
                          )}
                          {importRawData.columns.creditCards.length > 0 && (
                            <div className="grid gap-3 rounded-lg bg-slate-50 p-3 dark:bg-white/5">
                              <p className="font-black">Credit Cards</p>
                              <div className="grid gap-3 sm:grid-cols-3">
                                {renderMappingSelect("creditCards", "cardName", "Card Name", importRawData.columns.creditCards)}
                                {renderMappingSelect("creditCards", "provider", "Provider", importRawData.columns.creditCards)}
                                {renderMappingSelect("creditCards", "balance", "Balance", importRawData.columns.creditCards)}
                                {renderMappingSelect("creditCards", "limit", "Limit", importRawData.columns.creditCards)}
                                {renderMappingSelect("creditCards", "minimumPayment", "Minimum Payment", importRawData.columns.creditCards)}
                                {renderMappingSelect("creditCards", "statementTotal", "Statement Total", importRawData.columns.creditCards)}
                                {renderMappingSelect("creditCards", "dueDate", "Due Date", importRawData.columns.creditCards)}
                                {renderMappingSelect("creditCards", "apr", "APR", importRawData.columns.creditCards)}
                                {renderMappingSelect("creditCards", "notes", "Notes", importRawData.columns.creditCards)}
                              </div>
                            </div>
                          )}
                          {importRawData.columns.goals.length > 0 && (
                            <div className="grid gap-3 rounded-lg bg-slate-50 p-3 dark:bg-white/5">
                              <p className="font-black">Goals</p>
                              <div className="grid gap-3 sm:grid-cols-3">
                                {renderMappingSelect("goals", "name", "Goal Name", importRawData.columns.goals)}
                                {renderMappingSelect("goals", "type", "Type", importRawData.columns.goals)}
                                {renderMappingSelect("goals", "targetAmount", "Target Amount", importRawData.columns.goals)}
                                {renderMappingSelect("goals", "currentAmount", "Current Amount", importRawData.columns.goals)}
                                {renderMappingSelect("goals", "targetDate", "Target Date", importRawData.columns.goals)}
                                {renderMappingSelect("goals", "priority", "Priority", importRawData.columns.goals)}
                                {renderMappingSelect("goals", "notes", "Notes", importRawData.columns.goals)}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {importErrors.length > 0 && (
                      <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-100">
                        <p className="font-black">Validation issues</p>
                        <div className="mt-2 grid gap-1">
                          {importErrors.map((error, index) => (
                            <p key={`${error.section}-${index}`}>
                              <span className="font-bold">{error.section}:</span> {error.message}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {importPreview && (
                      <div className="mt-4 rounded-lg border border-slate-200 p-4 dark:border-white/10">
                        <p className="font-black">Import Mode</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {(["replace", "merge"] as const).map((mode) => (
                            <button
                              key={mode}
                              className={`rounded-lg border p-3 text-left text-sm font-bold ${importMode === mode ? "border-mint bg-mint/10 text-emerald-800 dark:text-mint" : "border-slate-200 dark:border-white/10"}`}
                              onClick={() => {
                                setImportMode(mode);
                                setImportDuplicateWarnings(mode === "merge" ? getImportDuplicateWarnings(importPreview) : []);
                              }}
                            >
                              {mode === "replace" ? "Replace current data" : "Merge with current data"}
                            </button>
                          ))}
                        </div>
                        {importDuplicateWarnings.length > 0 && (
                          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
                            <p className="font-black">Duplicate warning</p>
                            {importDuplicateWarnings.map((warning) => (
                              <p key={warning}>{warning}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {importPreview && (
                      <div className="mt-4 grid gap-4 xl:grid-cols-2">
                        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-white/10 xl:col-span-2">
                          <table className="min-w-full text-left text-sm">
                            <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500 dark:bg-white/5 dark:text-slate-300">
                              <tr>
                                <th className="px-3 py-3">Type</th>
                                <th className="px-3 py-3">Name</th>
                                <th className="px-3 py-3">Category / Provider</th>
                                <th className="px-3 py-3">Amount / Balance</th>
                                <th className="px-3 py-3">Due / Target</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[
                                ...importPreview.incomeSources.map((income) => ({ type: "Income", name: income.name, meta: income.type, amount: currency.format(income.amount), date: "" })),
                                ...importPreview.obligations.map((obligation) => ({ type: "Obligation", name: obligation.name, meta: `${obligation.category} / ${obligation.frequency}`, amount: currency.format(obligation.monthlyAmount), date: obligation.dueDate })),
                                ...importPreview.creditCards.map((card) => ({ type: "Credit Card", name: card.cardName, meta: card.provider, amount: `${currency.format(card.currentBalance)} / ${currency.format(card.creditLimit)}`, date: card.dueDate })),
                                ...importPreview.goals.map((goal) => ({ type: "Goal", name: goal.name, meta: goal.type, amount: currency.format(goal.targetAmount), date: goal.targetDate })),
                              ].map((row, index) => (
                                <tr key={`${row.type}-${row.name}-${index}`}>
                                  <td className="border-t border-slate-100 px-3 py-3 font-bold dark:border-white/10">{row.type}</td>
                                  <td className="border-t border-slate-100 px-3 py-3 dark:border-white/10">{row.name}</td>
                                  <td className="border-t border-slate-100 px-3 py-3 dark:border-white/10">{row.meta}</td>
                                  <td className="border-t border-slate-100 px-3 py-3 dark:border-white/10">{row.amount}</td>
                                  <td className="border-t border-slate-100 px-3 py-3 dark:border-white/10">{row.date}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="rounded-lg border border-slate-200 p-4 dark:border-white/10">
                          <h4 className="font-black">Income Sources Found: {importPreview.incomeSources.length}</h4>
                          <div className="mt-3 grid gap-2">
                            {importPreview.incomeSources.map((income) => (
                              <div key={income.id} className="flex items-center justify-between gap-3 text-sm">
                                <span className="font-bold">{income.name}</span>
                                <span className="text-slate-500 dark:text-slate-300">{income.type} - {currency.format(income.amount)}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-lg border border-slate-200 p-4 dark:border-white/10">
                          <h4 className="font-black">Obligations Found: {importPreview.obligations.length}</h4>
                          <div className="mt-3 grid gap-2">
                            {importPreview.obligations.map((obligation) => (
                              <div key={obligation.id} className="flex items-center justify-between gap-3 text-sm">
                                <span className="font-bold">{obligation.name}</span>
                                <span className="text-slate-500 dark:text-slate-300">{obligation.category} - {obligation.frequency} - {currency.format(obligation.monthlyAmount)} - {obligation.dueDate}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-lg border border-slate-200 p-4 dark:border-white/10">
                          <h4 className="font-black">Credit Cards Found: {importPreview.creditCards.length}</h4>
                          <div className="mt-3 grid gap-2">
                            {importPreview.creditCards.map((card) => (
                              <div key={card.id} className="flex items-center justify-between gap-3 text-sm">
                                <span className="font-bold">{card.cardName}</span>
                                <span className="text-slate-500 dark:text-slate-300">{currency.format(card.currentBalance)} / {currency.format(card.creditLimit)} - {card.dueDate}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-lg border border-slate-200 p-4 dark:border-white/10">
                          <h4 className="font-black">Goals Found: {importPreview.goals.length}</h4>
                          <div className="mt-3 grid gap-2">
                            {importPreview.goals.map((goal) => (
                              <div key={goal.id} className="flex items-center justify-between gap-3 text-sm">
                                <span className="font-bold">{goal.name}</span>
                                <span className="text-slate-500 dark:text-slate-300">{goal.type} - {currency.format(goal.targetAmount)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <KpiCard label={t.dashboard.monthlyIncome} value={currency.format(snapshot.totalIncome)} icon={<CircleDollarSign size={20} />} />
                  <KpiCard label={t.dashboard.monthlyObligations} value={currency.format(snapshot.totalMonthlyObligations)} icon={<CreditCardIcon size={20} />} />
                  <KpiCard label={t.dashboard.monthlySurplusDeficit} value={currency.format(snapshot.cashFlow)} icon={<Calculator size={20} />} tone={snapshot.cashFlow >= 0 ? "good" : "bad"} />
                  <KpiCard label={t.dashboard.debtScore} value={scoreLabel(snapshot.debtScore)} icon={<CheckCircle2 size={20} />} tone={scoreTone} />
                  <KpiCard label={t.common.profileCompletion} value={`${profileCompletionScore}%`} icon={<UserRound size={20} />} tone={profileCompletionScore >= 80 ? "good" : profileCompletionScore >= 60 ? "warn" : "default"} />
                </div>

                {annualBonusIncomeSources.length > 0 && (
                  <div className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase text-mint">Upcoming Extra Income</p>
                        <h3 className="mt-1 font-black">Bonus and one-time income</h3>
                      </div>
                      <CircleDollarSign size={18} className="text-mint" />
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {annualBonusIncomeSources.map((income) => (
                        <div key={income.id} className="rounded-lg border border-slate-200 p-4 text-sm dark:border-white/10">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-black">{income.name || "Bonus"}</p>
                            <p className="font-black">{currency.format(income.amount)}</p>
                          </div>
                          <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-300">
                            {income.expectedMonth || monthFormatter.format(addMonths(new Date(), getAnnualBonusMonth(income) - new Date().getMonth()))} - {income.guaranteed ? "Guaranteed" : "Variable"}
                          </p>
                          <p className="mt-1 text-xs font-bold text-emerald-700 dark:text-mint">Allocation: {bonusAllocationLabel(getBonusAllocation(income))}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">Appears as an extra income event only in its expected month.</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {showMoreDetails && (
                  <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <KpiCard label="Recurring Monthly Obligations" value={currency.format(recurringMonthlyObligations)} icon={<CreditCardIcon size={18} />} />
                  <KpiCard label={t.dashboard.upcomingOneTime} value={String(upcomingOneTimeObligations.length)} icon={<BellRing size={18} />} />
                  <KpiCard label={t.dashboard.requiredMonthlySavings} value={currency.format(requiredMonthlySavings)} icon={<WalletCards size={18} />} />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <KpiCard label="Total Lifestyle Expenses" value={currency.format(totalLifestyleExpenses)} icon={<Calculator size={18} />} tone={totalLifestyleExpenses > snapshot.totalIncome * 0.35 ? "warn" : "default"} />
                  <KpiCard label="Lifestyle Share of Income" value={snapshot.totalIncome > 0 ? `${Math.round((totalLifestyleExpenses / snapshot.totalIncome) * 100)}%` : "0%"} icon={<BarChart3 size={18} />} />
                </div>

                {lifestyleWarnings.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
                    {lifestyleWarnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                )}

                {financialWarnings.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-sm dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
                    <p className="font-black">Data integrity warnings</p>
                    <div className="mt-2 grid gap-1 text-sm font-semibold">
                      {financialWarnings.map((warning) => (
                        <p key={warning}>{warning}</p>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <KpiCard label="Months Until Debt-Free" value={Number.isFinite(monthsUntilDebtFree) ? String(monthsUntilDebtFree) : "Needs plan"} icon={<WalletCards size={18} />} tone={monthsUntilDebtFree <= 24 ? "good" : monthsUntilDebtFree <= 60 ? "warn" : "bad"} />
                  <KpiCard label="Emergency Fund Complete" value={emergencyFundForecast ? emergencyFundForecast.estimatedCompletion : "Not set"} icon={<Target size={18} />} tone={emergencyFundForecast && emergencyFundForecast.monthsRemaining <= 12 ? "good" : "default"} />
                  <KpiCard label="Highest Risk Month" value={highestRiskMonth ? highestRiskMonth.month : "None"} icon={<BellRing size={18} />} tone={highestRiskMonth && highestRiskMonth.net < 0 ? "bad" : "good"} />
                  <KpiCard label="Largest Upcoming Obligation" value={largestUpcomingObligation ? currency.format(largestUpcomingObligation.monthlyAmount) : "None"} icon={<CreditCardIcon size={18} />} />
                </div>
                  </>
                )}

                <div className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase text-mint">{t.common.suggestedActions}</p>
                      <h3 className="mt-1 font-black">Recommendations</h3>
                    </div>
                    <BellRing size={18} className="text-mint" />
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    {recommendationCards.map((card) => {
                      const tone =
                        card.tone === "bad"
                          ? "border-red-200 bg-red-50 text-red-900 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-100"
                          : card.tone === "warn"
                            ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100"
                            : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100";

                      return (
                        <div key={card.title} className={`rounded-lg border p-4 ${tone}`}>
                          <p className="text-sm font-black">{card.title}</p>
                          <p className="mt-2 text-xs font-semibold leading-5">{card.body}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  className="mx-auto flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-black dark:border-white/10 dark:bg-white/5"
                  onClick={() => setShowMoreDetails((current) => !current)}
                >
                  {showMoreDetails ? "Hide Details" : "Show More Details"}
                </button>

                {showMoreDetails && (
                  <>
                <div className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase text-mint">Scenario Simulator</p>
                      <h3 className="mt-1 font-black">{t.common.forecast} impact</h3>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[520px]">
                      <div>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-300">Extra income</p>
                        <div className="mt-2 grid grid-cols-4 gap-2">
                          {[0, 1000, 5000, 10000].map((amount) => (
                            <button
                              key={amount}
                              className={`h-10 rounded-lg border text-xs font-black ${scenarioExtraIncome === amount ? "border-ink bg-ink text-white dark:border-mint dark:bg-mint dark:text-ink" : "border-slate-200 dark:border-white/10"}`}
                              onClick={() => setScenarioExtraIncome(amount)}
                            >
                              +{currency.format(amount)}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-300">{t.common.bonus}</p>
                        <div className="mt-2 grid grid-cols-4 gap-2">
                          {[0, 25000, 50000, 100000].map((amount) => (
                            <button
                              key={amount}
                              className={`h-10 rounded-lg border text-xs font-black ${scenarioBonus === amount ? "border-ink bg-ink text-white dark:border-mint dark:bg-mint dark:text-ink" : "border-slate-200 dark:border-white/10"}`}
                              onClick={() => setScenarioBonus(amount)}
                            >
                              +{currency.format(amount)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <KpiCard label="Positive Months" value={String(positiveMonths)} icon={<CheckCircle2 size={18} />} tone="good" />
                    <KpiCard label="Warning Months" value={String(Math.max(0, 13 - positiveMonths - negativeMonths))} icon={<BellRing size={18} />} tone="warn" />
                    <KpiCard label="Deficit Months" value={String(highRiskMonths)} icon={<Calculator size={18} />} tone={highRiskMonths > 0 ? "bad" : "good"} />
                  </div>
                </div>

                <div className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="font-black">Monthly Forecast Timeline</h3>
                    <button
                      className="h-10 rounded-lg border border-slate-200 px-3 text-xs font-black dark:border-white/10"
                      onClick={() => setShowFullForecast((current) => !current)}
                    >
                      {showFullForecast ? "Show next 3 months" : "Show full 12-month forecast"}
                    </button>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {visibleMonthlyForecast.map((month) => {
                      const tone =
                        month.risk === "Deficit"
                          ? "border-red-200 bg-red-50 text-red-900 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-100"
                          : month.risk === "Warning"
                            ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100"
                            : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100";

                      return (
                        <div key={month.month} className={`rounded-lg border p-4 ${tone}`}>
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-black">{month.month}</p>
                            <span className="rounded-lg bg-white/60 px-2 py-1 text-xs font-black dark:bg-white/10">{month.risk}</span>
                          </div>
                          <div className="mt-3 grid gap-1 text-sm font-semibold">
                            <p>Income: {currency.format(month.income)}</p>
                            {month.bonusForMonth > 0 && <p>Extra income event: {currency.format(month.bonusForMonth)}</p>}
                            <p>Obligations: {currency.format(month.obligations)}</p>
                            <p>Credit Card Payments: {currency.format(month.creditCardPayments)}</p>
                            <p>Goal Contributions: {currency.format(month.goalContributions)}</p>
                            <p>Net: {month.net >= 0 ? "+" : ""}{currency.format(month.net)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-5 xl:grid-cols-3">
                  <div className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                    <h3 className="font-black">Cash Flow Forecast</h3>
                    <div className="mt-5 h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={monthlyForecast}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="shortMonth" fontSize={11} />
                          <YAxis fontSize={11} />
                          <Tooltip formatter={(value) => currency.format(Number(value))} />
                          <Line type="monotone" dataKey="net" stroke="#38d6a3" strokeWidth={3} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                    <h3 className="font-black">Debt Reduction Forecast</h3>
                    <div className="mt-5 h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={debtReductionForecast}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="month" fontSize={11} />
                          <YAxis fontSize={11} />
                          <Tooltip formatter={(value) => currency.format(Number(value))} />
                          <Line type="monotone" dataKey="debt" stroke="#d8a74f" strokeWidth={3} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                    <h3 className="font-black">Goal Completion Forecast</h3>
                    <div className="mt-5 h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={goalCompletionChart}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="month" fontSize={11} />
                          <YAxis fontSize={11} />
                          <Tooltip formatter={(value) => `${Number(value)}%`} />
                          <Line type="monotone" dataKey="progress" stroke="#0f172a" strokeWidth={3} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 xl:grid-cols-3">
                  <div className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                    <h3 className="font-black">Goal Completion Forecast</h3>
                    <div className="mt-4 grid gap-3">
                      {goalCompletionForecast.map((goal) => (
                        <div key={goal.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10">
                          <p className="font-black">{goal.name}</p>
                          <p className="mt-1 text-slate-500 dark:text-slate-300">{currency.format(goal.currentAmount)} of {currency.format(goal.targetAmount)}</p>
                          <p className="mt-1 font-bold">Monthly Contribution: {currency.format(goal.monthlyContribution)}</p>
                          <p className="mt-1 font-bold">Estimated Completion: {goal.estimatedCompletion}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                    <h3 className="font-black">Credit Card Payoff Forecast</h3>
                    <div className="mt-4 grid gap-3">
                      {creditCardPayoffForecast.map((card) => (
                        <div key={card.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10">
                          <p className="font-black">{card.cardName}</p>
                          <p className="mt-1 text-slate-500 dark:text-slate-300">Balance: {currency.format(card.currentBalance)}</p>
                          <p className="mt-1 font-bold">Minimum Payment: {currency.format(card.minimumPaymentDue)}</p>
                          <p className="mt-1 font-bold">Additional Payment: {currency.format(card.additionalPayment)}</p>
                          <p className="mt-1 font-bold">Estimated Payoff: {card.estimatedPayoff}</p>
                          <p className="mt-1 text-xs font-semibold text-emerald-700 dark:text-mint">If you pay an extra SAR 500/month, you will finish {card.monthsEarlierWithExtra500} months earlier.</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                    <h3 className="font-black">Financial Gap Forecast</h3>
                    <div className="mt-4 grid gap-3">
                      {financialGapForecast.length === 0 && <p className="rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">No forecasted deficits in the next 13 months.</p>}
                      {financialGapForecast.slice(0, 3).map((gap) => (
                        <div key={gap.month} className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-100">
                          <p className="font-black">{gap.month}</p>
                          <p className="mt-1">Expected deficit: {currency.format(Math.abs(gap.net))}</p>
                          {gap.largestObligation && <p className="mt-1">{gap.largestObligation.name} due: {currency.format(gap.largestObligation.monthlyAmount)}</p>}
                          <p className="mt-2 text-xs font-black uppercase opacity-70">Suggested actions</p>
                          <p className="mt-1 font-semibold">{gap.suggestedActions.join(" | ")}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                  <div className={`rounded-lg border p-5 shadow-sm ${monthlyGap > 0 ? "border-red-200 bg-red-50 text-red-900 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-100" : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100"}`}>
                    <p className="text-xs font-black uppercase opacity-70">Financial Gap Intelligence</p>
                    <h3 className="mt-2 text-xl font-black">
                      {monthlyGap > 0
                        ? `You need ${currency.format(monthlyGap)} additional monthly income`
                        : `${currency.format(snapshot.availableCashFlow)} monthly surplus available`}
                    </h3>
                    <p className="mt-2 text-sm leading-6 opacity-75">Based on dynamic income sources and obligation entries.</p>
                  </div>

                  <div className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                    <h3 className="font-black">Top obligations affecting cash flow</h3>
                    <div className="mt-4 grid gap-3">
                      {topObligations.length === 0 && <p className="text-sm text-slate-500">No monthly obligations added yet.</p>}
                      {topObligations.map((obligation) => {
                        const maxValue = topObligations[0]?.value || 1;
                        const width = Math.max(8, Math.round((obligation.value / maxValue) * 100));

                        return (
                          <div key={obligation.label}>
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <span className="font-bold">{obligation.label}</span>
                              <span className="text-slate-500 dark:text-slate-300">{currency.format(obligation.value)}</span>
                            </div>
                            <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-white/10">
                              <div className="h-2 rounded-full bg-gold" style={{ width: `${width}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-5 border-t border-slate-200 pt-4 dark:border-white/10">
                      <h4 className="text-sm font-black">Obligation Breakdown</h4>
                      <div className="mt-3 grid gap-2">
                        {obligationBreakdown.length === 0 && <p className="text-sm text-slate-500">No obligation categories yet.</p>}
                        {obligationBreakdown.map((item) => {
                          const width = snapshot.totalMonthlyObligations > 0 ? Math.max(8, Math.round((item.value / snapshot.totalMonthlyObligations) * 100)) : 0;

                          return (
                            <div key={item.category}>
                              <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-500 dark:text-slate-300">
                                <span>{item.category}</span>
                                <span>{currency.format(item.value)}</span>
                              </div>
                              <div className="mt-1 h-2 rounded-full bg-slate-100 dark:bg-white/10">
                                <div className="h-2 rounded-full bg-mint" style={{ width: `${width}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-black">Cash Flow Intelligence</h3>
                      <BarChart3 size={18} className="text-mint" />
                    </div>
                    <div className="mt-5 h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" fontSize={11} />
                          <YAxis fontSize={11} />
                          <Tooltip formatter={(value) => currency.format(Number(value))} />
                          <Bar dataKey="value" fill="#38d6a3" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                    <h3 className="font-black">Potential Opportunities</h3>
                    <div className="mt-4 grid gap-3">
                      {matches.map((offer) => (
                        <div key={offer.id} className="rounded-lg border border-mint/30 bg-mint/10 p-4">
                          <p className="text-xs font-black uppercase text-emerald-700 dark:text-mint">Potential Opportunity</p>
                          <h4 className="mt-1 font-black">{offer.title}</h4>
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{offer.bankName}</p>
                          <button
                            className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-ink text-sm font-bold text-white dark:bg-mint dark:text-ink"
                            onClick={() => setConsentOffer(offer)}
                          >
                            <Send size={16} />
                            I am Interested
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                  </>
                )}

                <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
                  <div className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                    <h3 className="font-black">Upcoming Obligations</h3>
                    <div className="mt-4 grid gap-3">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <KpiCard label="Due in 7 Days" value={currency.format(obligationsDue7)} icon={<CreditCardIcon size={18} />} tone={obligationsDue7 > 0 ? "bad" : "good"} />
                        <KpiCard label="Due in 30 Days" value={currency.format(obligationsDue30)} icon={<CreditCardIcon size={18} />} />
                        <KpiCard label="Coverage" value={canCoverUpcoming ? "Covered" : "Gap"} icon={<CheckCircle2 size={18} />} tone={canCoverUpcoming ? "good" : "bad"} />
                      </div>
                      {upcomingObligations.slice(0, 5).map((obligation) => {
                        const tone =
                          obligation.daysRemaining <= 7
                            ? "border-red-200 bg-red-50 text-red-900 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-100"
                            : obligation.daysRemaining <= 14
                              ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100"
                              : "border-slate-200 bg-white dark:border-white/10 dark:bg-white/5";

                        return (
                          <div key={obligation.id} className={`rounded-lg border p-3 text-sm ${tone}`}>
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-black">{obligation.name}</p>
                              <p className="font-bold">{currency.format(obligation.monthlyAmount)}</p>
                            </div>
                            <p className="mt-1 text-xs opacity-75">
                              {dateFormatter.format(new Date(obligation.dueDate))} - {obligation.daysRemaining} days remaining - {obligation.category}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {showMoreDetails && (
                  <div className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                    <h3 className="font-black">Future Cash Flow Release</h3>
                    <div className="mt-4 grid gap-3">
                      {releaseInsights.length === 0 && (
                        <p className="text-sm text-slate-500 dark:text-slate-300">
                          {language === "ar"
                            ? "أضف تواريخ انتهاء الالتزامات لمعرفة متى سيتحرر جزء من دخلك مستقبلاً."
                            : "Add end dates to obligations to unlock future cash flow insights."}
                        </p>
                      )}
                      {releaseInsights.map((obligation) => (
                        <div key={obligation.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10">
                          <p className="font-black">{obligation.name}</p>
                          <p className="mt-1 text-slate-500 dark:text-slate-300">
                            This obligation ends in {obligation.monthsRemaining} months and will release {currency.format(obligation.monthlyAmount)}/month.
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  )}

                  {showMoreDetails && (
                  <div className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                    <h3 className="font-black">Sinking Fund Plan</h3>
                    <div className="mt-4 grid gap-3">
                      {upcomingOneTimeObligations.length === 0 && <p className="text-sm text-slate-500">No one-time or annual obligations added.</p>}
                      {upcomingOneTimeObligations.slice(0, 5).map((obligation) => (
                        <div key={obligation.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-black">{obligation.name}</p>
                            <p className="font-bold">{currency.format(obligation.monthlyAmount)}</p>
                          </div>
                          <div className="mt-2 grid gap-1 text-xs font-semibold text-slate-500 dark:text-slate-300 sm:grid-cols-2">
                            <p>Due date: {dateFormatter.format(new Date(obligation.dueDate))}</p>
                            <p>Months remaining: {obligation.monthsRemaining}</p>
                            <p>Saved: {currency.format(obligation.savedAmount || 0)}</p>
                            <p>Remaining: {currency.format(obligation.remainingAmount)}</p>
                            <p>Required monthly saving: {currency.format(obligation.requiredMonthlySaving)}</p>
                            <p>Allocation: {obligation.allocationMethod}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  )}

                  <div className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                    <h3 className="font-black">Credit Card Intelligence</h3>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <KpiCard label="Card Balance" value={currency.format(totalCreditCardBalance)} icon={<CreditCardIcon size={18} />} />
                      <KpiCard label="Min Payments" value={currency.format(totalMinimumPaymentsDue)} icon={<Calculator size={18} />} />
                      <KpiCard label="Highest Utilization" value={highestUtilizationCard ? `${Math.round(highestUtilizationCard.utilization)}%` : "0%"} icon={<BarChart3 size={18} />} tone={highestUtilizationCard && highestUtilizationCard.utilization > 80 ? "bad" : "default"} />
                      <KpiCard label="Due Soon" value={String(cardsDueSoon.length)} icon={<CreditCardIcon size={18} />} tone={cardsDueSoon.length > 0 ? "warn" : "good"} />
                    </div>
                    <div className="mt-4 grid gap-3">
                      {creditCardStats.map((card) => (
                        <div key={card.id} className={`rounded-lg border p-3 text-sm ${card.daysUntilDue <= 7 && card.daysUntilDue >= 0 ? "border-red-200 bg-red-50 dark:border-red-400/20 dark:bg-red-400/10" : "border-slate-200 dark:border-white/10"}`}>
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-black">{card.cardName}</p>
                            <p className="font-bold">{card.risk}</p>
                          </div>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                            {card.provider} - {Math.round(card.utilization)}% used - {currency.format(card.availableCredit)} available
                          </p>
                        </div>
                      ))}
                      {cardsAbove80.length > 0 && <p className="text-sm font-bold text-red-600 dark:text-red-300">{cardsAbove80.length} card(s) above 80% utilization.</p>}
                      {cardOpportunities.length > 0 && <p className="text-sm font-bold text-emerald-700 dark:text-mint">Relevant opportunities: {cardOpportunities.join(", ")}.</p>}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-black">Goal Tracker</h3>
                    <Target size={18} className="text-mint" />
                  </div>
                  <p className={`mt-3 rounded-lg px-3 py-2 text-sm font-bold ${snapshot.cashFlow >= 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200" : "bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-200"}`}>
                    {snapshot.cashFlow >= 0 ? "You can allocate part of your monthly surplus toward your goals." : "Pause non-essential goals until the monthly gap is fixed."}
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {goals.map((goal) => {
                      const progress = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0;
                      const linkedDebt = goal.linkedDebtId ? debts.find((debt) => debt.id === goal.linkedDebtId) : undefined;
                      const linkedCard = goal.linkedCreditCardId ? creditCards.find((card) => card.id === goal.linkedCreditCardId) : undefined;

                      return (
                        <div key={goal.id} className="rounded-lg border border-slate-200 p-4 dark:border-white/10">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-black">{goal.name}</p>
                              <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                {goal.type} - {currency.format(goal.currentAmount)} of {currency.format(goal.targetAmount)}
                              </p>
                              <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{goal.targetDate} - {goal.priority}</p>
                              {(linkedDebt || linkedCard) && (
                                <p className="mt-1 text-xs font-bold text-emerald-700 dark:text-mint">
                                  Linked to {linkedCard?.cardName || linkedDebt?.name}
                                </p>
                              )}
                            </div>
                            <span className="rounded-lg bg-mint/15 px-2 py-1 text-xs font-black text-emerald-700 dark:text-mint">
                              {progress}%
                            </span>
                          </div>
                          <div className="mt-4 h-3 rounded-full bg-slate-100 dark:bg-white/10">
                            <div className="h-3 rounded-full bg-mint" style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                        );
                      })}
                      {goals.length === 0 && (
                        <div className="rounded-lg border border-dashed border-mint/40 bg-mint/10 p-4 text-sm font-semibold leading-7 text-slate-600 dark:text-slate-200">
                          {language === "ar"
                            ? "لا تحتاج هدفاً كبيراً من البداية. مبلغ بسيط شهرياً قد يساعدك تبني صندوق طوارئ أو تسدد بطاقة أسرع."
                            : "You do not need a big goal to start. A small monthly amount can help build an emergency fund or pay a card faster."}
                        </div>
                      )}
                    </div>
                  </div>
              </div>
            )}

            {flow === "app" && active === "debts" && (
              <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black">Debt Center</h3>
                    <button className="grid size-10 place-items-center rounded-lg bg-ink text-white dark:bg-mint dark:text-ink" onClick={addDebt} aria-label="Add debt">
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="mt-4 grid gap-4">
                    {debts.map((debt, index) => (
                      <div key={debt.id} className="grid gap-3 rounded-lg border border-slate-200 p-4 dark:border-white/10">
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_3rem] sm:items-end">
                          <div className="min-w-0 flex-1">
                            <SelectField
                              label="Debt Type"
                              value={debt.type}
                              options={debtTypes}
                              onChange={(value) =>
                                setDebts((current) => current.map((item, i) => (i === index ? { ...item, type: value as DebtType } : item)))
                              }
                            />
                          </div>
                          <button
                            className="flex h-11 w-full items-center justify-center rounded-lg border border-red-200 text-red-600 dark:border-red-400/30 dark:text-red-300 sm:size-11"
                            onClick={() => deleteDebt(debt.id)}
                            aria-label="Delete debt"
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Debt Name" value={debt.name} onChange={(value) => setDebts((current) => current.map((item, i) => (i === index ? { ...item, name: value } : item)))} />
                          <Field label="Bank" value={debt.bank} onChange={(value) => setDebts((current) => current.map((item, i) => (i === index ? { ...item, bank: value } : item)))} />
                          <Field label="Remaining Balance" type="number" value={debt.remainingBalance} onChange={(value) => setDebts((current) => current.map((item, i) => (i === index ? { ...item, remainingBalance: Number(value) } : item)))} />
                          <Field label="Monthly Installment" type="number" value={debt.monthlyInstallment} onChange={(value) => setDebts((current) => current.map((item, i) => (i === index ? { ...item, monthlyInstallment: Number(value) } : item)))} />
                          <Field label="Interest Rate" type="number" value={debt.interestRate} onChange={(value) => setDebts((current) => current.map((item, i) => (i === index ? { ...item, interestRate: Number(value) } : item)))} />
                          <Field label="End Date" type="date" value={debt.endDate} onChange={(value) => setDebts((current) => current.map((item, i) => (i === index ? { ...item, endDate: value } : item)))} />
                        </div>
                      </div>
                    ))}
                    {debts.length === 0 && (
                      <div className="rounded-lg border border-dashed border-mint/40 bg-mint/10 p-4 text-sm font-semibold leading-7 text-slate-600 dark:text-slate-200">
                        {language === "ar"
                          ? "إذا عندك قرض أو تمويل، أضفه هنا بهدوء. الهدف ليس الحكم عليك، بل توضيح الصورة."
                          : "If you have a loan or financing, add it here gently. The goal is not judgment, it is clarity."}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black">Credit Cards</h3>
                    <button className="grid size-10 place-items-center rounded-lg bg-ink text-white dark:bg-mint dark:text-ink" onClick={addCreditCard} aria-label="Add credit card">
                      <Plus size={18} />
                    </button>
                  </div>
                    <div className="mt-4 grid gap-4">
                      {creditCards.map((card, index) => (
                      <div key={card.id} className="grid gap-3 rounded-lg border border-slate-200 p-4 dark:border-white/10">
                        <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="font-black">{card.cardName}</p>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                              {currency.format(Math.max(card.creditLimit - card.currentBalance, 0))} available
                            </p>
                          </div>
                          <button className="flex h-11 w-full shrink-0 items-center justify-center rounded-lg border border-red-200 text-red-600 dark:border-red-400/30 dark:text-red-300 sm:size-10 sm:w-10" onClick={() => deleteCreditCard(card.id)} aria-label="Delete credit card">
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Card Name" value={card.cardName} onChange={(value) => setCreditCards((current) => current.map((item, i) => (i === index ? { ...item, cardName: value } : item)))} />
                          <Field label="Bank / Provider" value={card.provider} onChange={(value) => setCreditCards((current) => current.map((item, i) => (i === index ? { ...item, provider: value } : item)))} />
                          <Field label="Credit Limit" type="number" value={card.creditLimit} help={t.tooltips.creditLimit} onChange={(value) => setCreditCards((current) => current.map((item, i) => (i === index ? { ...item, creditLimit: Number(value) } : item)))} />
                          <Field label="Current Balance" type="number" value={card.currentBalance} onChange={(value) => setCreditCards((current) => current.map((item, i) => (i === index ? { ...item, currentBalance: Number(value) } : item)))} />
                          <Field label="Minimum Payment Due" type="number" value={card.minimumPaymentDue} help={t.tooltips.minimumPaymentDue} onChange={(value) => setCreditCards((current) => current.map((item, i) => (i === index ? { ...item, minimumPaymentDue: Number(value) } : item)))} />
                          <Field label="Statement Total Due" type="number" value={card.statementTotalDue} help={t.tooltips.statementTotalDue} onChange={(value) => setCreditCards((current) => current.map((item, i) => (i === index ? { ...item, statementTotalDue: Number(value) } : item)))} />
                          <Field label="Due Date" type="date" value={card.dueDate} onChange={(value) => setCreditCards((current) => current.map((item, i) => (i === index ? { ...item, dueDate: value } : item)))} />
                          <Field label="APR / Profit Rate" type="number" value={card.aprOrProfitRate} onChange={(value) => setCreditCards((current) => current.map((item, i) => (i === index ? { ...item, aprOrProfitRate: Number(value) } : item)))} />
                          <Field label="Notes" value={card.notes} onChange={(value) => setCreditCards((current) => current.map((item, i) => (i === index ? { ...item, notes: value } : item)))} />
                        </div>
                      </div>
                    ))}
                    {creditCards.length === 0 && (
                      <div className="rounded-lg border border-dashed border-mint/40 bg-mint/10 p-4 text-sm font-semibold leading-7 text-slate-600 dark:text-slate-200">
                        {language === "ar"
                          ? "إذا عندك بطاقة ائتمانية، أضفها هنا. سنساعدك تعرف هل استخدامها آمن أو يحتاج انتباه."
                          : "If you have a credit card, add it here. We will help you see whether its usage looks comfortable or needs attention."}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-black">Obligations Module</h3>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Total: {currency.format(snapshot.totalMonthlyObligations)}</p>
                    </div>
                    <button className="grid size-10 place-items-center rounded-lg bg-ink text-white dark:bg-mint dark:text-ink" onClick={addObligationEntry} aria-label="Add obligation">
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="mt-4 grid gap-4">
                    {obligationEntries.map((obligation, index) => (
                      <div key={obligation.id} className="grid gap-3 rounded-lg border border-slate-200 p-4 dark:border-white/10">
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_3rem] sm:items-end">
                          <div className="min-w-0 flex-1">
                            <SelectField
                              label="Category"
                              value={obligation.category}
                              options={obligationCategories}
                              getOptionLabel={categoryLabel}
                              onChange={(value) =>
                                setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, category: value as ObligationCategory } : item)))
                              }
                            />
                          </div>
                          <button
                            className="flex h-11 w-full items-center justify-center rounded-lg border border-red-200 text-red-600 dark:border-red-400/30 dark:text-red-300 sm:size-11"
                            onClick={() => deleteObligationEntry(obligation.id)}
                            aria-label="Delete obligation"
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Obligation Name" value={obligation.name} onChange={(value) => setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, name: value } : item)))} />
                          <Field label="Amount" type="number" value={obligation.monthlyAmount} onChange={(value) => setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, monthlyAmount: Number(value) } : item)))} />
                          <SelectField label="Frequency" value={obligation.frequency} options={obligationFrequencies} help={t.tooltips.frequency} onChange={(value) => setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, frequency: value as ObligationFrequency, isRecurring: value !== "One-Time" } : item)))} />
                          <Field label="Due Day of Month" type="number" value={obligation.dueDay} onChange={(value) => setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, dueDay: Number(value) } : item)))} />
                          <Field label="Due Date" type="date" value={obligation.dueDate} help={t.tooltips.dueDate} onChange={(value) => setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, dueDate: value, dueDay: parseDueDay(value) || item.dueDay } : item)))} />
                          <Field label="Start Date" type="date" value={obligation.startDate} help={t.tooltips.startDate} onChange={(value) => setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, startDate: value } : item)))} />
                          <Field label="Optional End Date" type="date" value={obligation.endDate || ""} help={t.tooltips.endDate} onChange={(value) => setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, endDate: value } : item)))} />
                          <SelectField label="Allocation Method" value={obligation.allocationMethod} options={obligationAllocationMethods} help={t.tooltips.allocationMethod} onChange={(value) => setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, allocationMethod: value as ObligationAllocationMethod } : item)))} />
                          <Field label="Saved Amount" type="number" value={obligation.savedAmount} onChange={(value) => setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, savedAmount: Number(value) } : item)))} />
                          <Field label="Notes" value={obligation.notes} onChange={(value) => setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, notes: value } : item)))} />
                          <label className="flex h-11 items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm font-bold dark:border-white/10">
                            <input type="checkbox" checked={obligation.isRecurring} onChange={(event) => setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, isRecurring: event.target.checked } : item)))} />
                            Is Recurring
                          </label>
                        </div>
                      </div>
                    ))}
                    {obligationEntries.length === 0 && (
                      <div className="rounded-lg border border-dashed border-mint/40 bg-mint/10 p-4 text-sm font-semibold leading-7 text-slate-600 dark:text-slate-200">
                        {language === "ar"
                          ? "أضف التزاماتك الشهرية أو السنوية. حتى الالتزامات الصغيرة تستحق أن تكون واضحة."
                          : "Add your monthly or annual obligations. Even small commitments deserve to be visible."}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {flow === "app" && active === "income" && (
              <div className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-black">Income Sources</h3>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Monthly recurring total: {currency.format(snapshot.totalIncome)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="h-10 rounded-lg border border-slate-200 px-3 text-xs font-black dark:border-white/10" onClick={addBonusIncome}>
                      Add Bonus
                    </button>
                    <button className="grid size-10 place-items-center rounded-lg bg-ink text-white dark:bg-mint dark:text-ink" onClick={addIncomeSource} aria-label="Add income source">
                      <Plus size={18} />
                    </button>
                  </div>
                </div>
                <div className="mt-5 grid gap-5">
                  <div>
                    <h4 className="font-black">Recurring Monthly Income</h4>
                    <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">Used for monthly obligations and pressure calculations.</p>
                    <div className="mt-3 grid gap-4 md:grid-cols-2">
                      {incomeSources.map((income, index) => (!isAnnualBonusIncome(income) && income.recurring !== false ? renderIncomeEditor(income, index) : null))}
                      {monthlyIncomeSources.length === 0 && (
                        <div className="rounded-lg border border-dashed border-mint/40 bg-mint/10 p-4 text-sm font-semibold leading-7 text-slate-600 dark:text-slate-200">
                          {language === "ar"
                            ? "ابدأ بإضافة دخلك الشهري. هذه أول خطوة لفهم وضعك المالي."
                            : "Start by adding your monthly income. This is the first step toward understanding your financial picture."}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-black">Extra Income Events</h4>
                    <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">Bonuses and one-time income appear only in their expected month.</p>
                    <div className="mt-3 grid gap-4 md:grid-cols-2">
                      {incomeSources.map((income, index) => (isAnnualBonusIncome(income) || income.recurring === false ? renderIncomeEditor(income, index) : null))}
                      {extraIncomeEvents.length === 0 && (
                        <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm font-semibold leading-7 text-slate-500 dark:border-white/20 dark:text-slate-300">
                          {language === "ar" ? "إذا عندك بونص أو دخل إضافي قادم، أضفه هنا وقت ما تكون جاهز." : "If you expect a bonus or extra income event, add it here whenever you are ready."}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {flow === "app" && active === "lifestyle" && (
              <div className="grid gap-5">
                <div className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-black">Lifestyle Expenses</h3>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Total: {currency.format(totalLifestyleExpenses)}</p>
                    </div>
                    <button className="grid size-10 place-items-center rounded-lg bg-ink text-white dark:bg-mint dark:text-ink" onClick={addLifestyleExpense} aria-label="Add lifestyle expense">
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="mt-4">{friendlyReminderCard}</div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {lifestyleExpenses.map((expense) => (
                      <div key={expense.id} className="grid gap-3 rounded-lg border border-slate-200 p-4 dark:border-white/10">
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_3rem] sm:items-end">
                          <div className="min-w-0 flex-1">
                            <Field label="Expense Name" value={expense.name} onChange={(value) => setObligationEntries((current) => current.map((item) => (item.id === expense.id ? { ...item, name: value } : item)))} />
                          </div>
                          <button className="flex h-11 w-full items-center justify-center rounded-lg border border-red-200 text-red-600 dark:border-red-400/30 dark:text-red-300 sm:size-11" onClick={() => deleteObligationEntry(expense.id)} aria-label="Delete lifestyle expense">
                            <Trash2 size={17} />
                          </button>
                        </div>
                        <Field label="Monthly Amount" type="number" value={expense.monthlyAmount} help={t.tooltips.lifestyleExpenses} onChange={(value) => setObligationEntries((current) => current.map((item) => (item.id === expense.id ? { ...item, monthlyAmount: Number(value) } : item)))} />
                        <Field label="Notes" value={expense.notes} onChange={(value) => setObligationEntries((current) => current.map((item) => (item.id === expense.id ? { ...item, notes: value } : item)))} />
                      </div>
                    ))}
                    {lifestyleExpenses.length === 0 && (
                      <button className="min-h-20 rounded-lg border border-dashed border-mint/40 bg-mint/10 px-4 py-3 text-start text-sm font-bold leading-7 text-slate-600 dark:text-slate-200" onClick={addLifestyleExpense}>
                        {language === "ar"
                          ? "أضف مصاريفك الشهرية مثل المقاضي، البنزين، القهوة، الاشتراكات، أو الفواتير. التفاصيل الصغيرة تساعد الصورة تكمل."
                          : "Add monthly spending like groceries, fuel, coffee, subscriptions, or bills. Small details help complete the picture."}
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                  <h3 className="font-black">Suggested Lifestyle Budget</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Guidance only. DebtIQ does not force these ranges.</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {lifestyleBudgetGuidance.map((item) => (
                      <div key={item.name} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-black">{item.name}</span>
                          <span className="font-bold">{currency.format(item.suggested)}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">Current: {currency.format(item.current)}</p>
                        <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">{item.recommendation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {flow === "app" && active === "obligations" && (
              <div className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-black">Obligations</h3>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Total: {currency.format(snapshot.totalMonthlyObligations)}</p>
                  </div>
                  <button className="grid size-10 place-items-center rounded-lg bg-ink text-white dark:bg-mint dark:text-ink" onClick={addObligationEntry} aria-label="Add obligation">
                    <Plus size={18} />
                  </button>
                </div>
                <div className="mt-4">{friendlyReminderCard}</div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {obligationEntries.map((obligation, index) => (
                    <div key={obligation.id} className="grid gap-3 rounded-lg border border-slate-200 p-4 dark:border-white/10">
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_3rem] sm:items-end">
                        <div className="min-w-0 flex-1">
                          <SelectField
                            label="Category"
                            value={obligation.category}
                            options={obligationCategories}
                            getOptionLabel={categoryLabel}
                            onChange={(value) =>
                              setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, category: value as ObligationCategory } : item)))
                            }
                          />
                        </div>
                        <button
                          className="flex h-11 w-full items-center justify-center rounded-lg border border-red-200 text-red-600 dark:border-red-400/30 dark:text-red-300 sm:size-11"
                          onClick={() => deleteObligationEntry(obligation.id)}
                          aria-label="Delete obligation"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Obligation Name" value={obligation.name} onChange={(value) => setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, name: value } : item)))} />
                        <Field label="Amount" type="number" value={obligation.monthlyAmount} onChange={(value) => setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, monthlyAmount: Number(value) } : item)))} />
                        <SelectField label="Frequency" value={obligation.frequency} options={obligationFrequencies} help={t.tooltips.frequency} onChange={(value) => setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, frequency: value as ObligationFrequency, isRecurring: value !== "One-Time" } : item)))} />
                        <Field label="Due Day of Month" type="number" value={obligation.dueDay} onChange={(value) => setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, dueDay: Number(value) } : item)))} />
                        <Field label="Due Date" type="date" value={obligation.dueDate} help={t.tooltips.dueDate} onChange={(value) => setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, dueDate: value, dueDay: parseDueDay(value) || item.dueDay } : item)))} />
                        <Field label="Start Date" type="date" value={obligation.startDate} help={t.tooltips.startDate} onChange={(value) => setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, startDate: value } : item)))} />
                        <Field label="Optional End Date" type="date" value={obligation.endDate || ""} help={t.tooltips.endDate} onChange={(value) => setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, endDate: value } : item)))} />
                        <SelectField label="Allocation Method" value={obligation.allocationMethod} options={obligationAllocationMethods} help={t.tooltips.allocationMethod} onChange={(value) => setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, allocationMethod: value as ObligationAllocationMethod } : item)))} />
                        <Field label="Saved Amount" type="number" value={obligation.savedAmount} onChange={(value) => setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, savedAmount: Number(value) } : item)))} />
                        <Field label="Notes" value={obligation.notes} onChange={(value) => setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, notes: value } : item)))} />
                        <label className="flex h-11 items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm font-bold dark:border-white/10">
                          <input type="checkbox" checked={obligation.isRecurring} onChange={(event) => setObligationEntries((current) => current.map((item, i) => (i === index ? { ...item, isRecurring: event.target.checked } : item)))} />
                          Is Recurring
                        </label>
                      </div>
                    </div>
                  ))}
                  {obligationEntries.length === 0 && (
                    <button className="min-h-20 rounded-lg border border-dashed border-mint/40 bg-mint/10 px-4 py-3 text-start text-sm font-bold leading-7 text-slate-600 dark:text-slate-200" onClick={addObligationEntry}>
                      {language === "ar"
                        ? "أضف التزاماتك الشهرية أو السنوية. حتى الالتزامات الصغيرة تستحق أن تكون واضحة."
                        : "Add your monthly or annual obligations. Even small commitments deserve to be visible."}
                    </button>
                  )}
                </div>
              </div>
            )}

            {flow === "app" && active === "goals" && (
              <div className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-black">Goals</h3>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Track payoff, savings, and major purchase targets.</p>
                  </div>
                  <button className="grid size-10 place-items-center rounded-lg bg-ink text-white dark:bg-mint dark:text-ink" onClick={addGoal} aria-label="Add goal">
                    <Plus size={18} />
                  </button>
                </div>
                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  {goals.length === 0 && (
                    <button className="min-h-20 rounded-lg border border-dashed border-mint/40 bg-mint/10 px-4 py-3 text-start text-sm font-bold leading-7 text-slate-600 dark:text-slate-200" onClick={addGoal}>
                      {language === "ar"
                        ? "اختر هدفاً بسيطاً. صندوق طوارئ، سداد بطاقة، أو رسوم مدارس. خطوة صغيرة تكفي للبداية."
                        : "Choose one simple goal. Emergency fund, card payoff, or school fees. One small step is enough to begin."}
                    </button>
                  )}
                  {goals.map((goal, index) => renderGoalEditor(goal, index))}
                </div>
              </div>
            )}

            {flow === "app" && active === "profile" && (
              <div className="grid gap-5 xl:grid-cols-2">
                <div className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                  <h3 className="font-black">{t.common.accountAccess}</h3>
                  <div className="mt-4 grid gap-3">
                    <Field label="Full Name" value={profile.fullName} onChange={(value) => setProfile((current) => ({ ...current, fullName: value }))} />
                    <SaudiPhoneField label="Mobile Number" value={profile.mobile} onChange={(value) => setProfile((current) => ({ ...current, mobile: value }))} />
                    <Field label="Email" value={profile.email} onChange={(value) => setProfile((current) => ({ ...current, email: value }))} />
                    <div className="grid grid-cols-2 gap-3">
                      <button className="h-11 rounded-lg bg-ink text-sm font-bold text-white dark:bg-mint dark:text-ink" onClick={startRegistration}>
                        Create Account
                      </button>
                      <button className="h-11 rounded-lg border border-slate-200 text-sm font-bold dark:border-white/10" onClick={startLogin}>
                        Login
                      </button>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                  <h3 className="font-black">{t.common.profile}</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <SelectField
                      label={language === "ar" ? "الدولة" : "Country"}
                      value={profile.country}
                      options={["", ...countryOptions]}
                      getOptionLabel={(value) => (value ? countryLabel(value) : language === "ar" ? "اختر الدولة" : "Select country")}
                      onChange={(value) =>
                        setProfile((current) => ({
                          ...current,
                          country: value as Country | "",
                          city: "",
                        }))
                      }
                    />
                    <SelectField
                      label={language === "ar" ? "المدينة" : "City"}
                      value={profile.city}
                      options={["", ...(profile.country ? cityOptionsByCountry[profile.country as Country] : ["Other"])]}
                      getOptionLabel={(value) => (value ? cityLabel(value) : language === "ar" ? "اختر المدينة" : "Select city")}
                      onChange={(value) => setProfile((current) => ({ ...current, city: value }))}
                    />
                    {(profile.city === "Other" || profile.country === "Other" || (profile.country && profile.city && !cityOptionsByCountry[profile.country as Country]?.includes(profile.city))) && (
                      <Field label={language === "ar" ? "اكتب المدينة" : "Manual city"} value={profile.city === "Other" ? "" : profile.city} onChange={(value) => setProfile((current) => ({ ...current, city: value }))} />
                    )}
                    <Field label={language === "ar" ? "جهة العمل" : "Employer"} value={profile.employer} onChange={(value) => setProfile((current) => ({ ...current, employer: value }))} />
                    <SelectField
                      label={language === "ar" ? "الحالة الاجتماعية" : "Marital Status"}
                      value={profile.maritalStatus}
                      options={["", ...maritalStatusOptions]}
                      getOptionLabel={(value) => (value ? maritalStatusLabel(value) : language === "ar" ? "اختر الحالة" : "Select status")}
                      onChange={(value) => setProfile((current) => ({ ...current, maritalStatus: value as MaritalStatus | "" }))}
                    />
                    <SelectField
                      label={language === "ar" ? "قطاع العمل" : "Employment Sector"}
                      value={profile.employmentSector}
                      options={["", ...employmentSectorOptions]}
                      getOptionLabel={(value) => (value ? employmentSectorLabel(value) : language === "ar" ? "اختر القطاع" : "Select sector")}
                      onChange={(value) => setProfile((current) => ({ ...current, employmentSector: value as EmploymentSector | "" }))}
                    />
                  </div>
                  <div className="mt-6 flex items-center justify-between">
                    <div>
                      <h4 className="font-black">{language === "ar" ? "مصاريف نمط الحياة" : "Lifestyle Expenses"}</h4>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Total: {currency.format(totalLifestyleExpenses)}</p>
                    </div>
                    <button className="grid size-10 place-items-center rounded-lg bg-ink text-white dark:bg-mint dark:text-ink" onClick={addLifestyleExpense} aria-label="Add lifestyle expense">
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {lifestyleExpenses.slice(0, 4).map((expense) => (
                      <div key={expense.id} className="grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10 sm:grid-cols-[minmax(0,1fr)_140px_96px] sm:items-end">
                        <Field label="Name" value={expense.name} onChange={(value) => setObligationEntries((current) => current.map((item) => (item.id === expense.id ? { ...item, name: value } : item)))} />
                        <Field label="Amount" type="number" value={expense.monthlyAmount} onChange={(value) => setObligationEntries((current) => current.map((item) => (item.id === expense.id ? { ...item, monthlyAmount: Number(value) } : item)))} />
                        <button className="h-11 w-full rounded-lg border border-red-200 px-3 text-sm font-bold text-red-600 dark:border-red-400/30 dark:text-red-300" onClick={() => deleteObligationEntry(expense.id)}>
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 flex items-center justify-between">
                    <div>
                      <h4 className="font-black">{t.income.title}</h4>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Total: {currency.format(snapshot.totalIncome)}</p>
                    </div>
                    <button className="grid size-10 place-items-center rounded-lg bg-ink text-white dark:bg-mint dark:text-ink" onClick={addIncomeSource} aria-label="Add income source">
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="mt-4 grid gap-4">
                    {incomeSources.map((income, index) => renderIncomeEditor(income, index))}
                  </div>
                </div>
              </div>
            )}

            {flow === "app" && active === "opportunities" && (
              <div className="grid gap-4">
                {offers.map((offer) => (
                  <div key={offer.id} className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase text-mint">{offer.type}</p>
                        <h3 className="mt-1 text-lg font-black">{offer.title}</h3>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{offer.description}</p>
                      </div>
                      <button className="flex h-10 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-bold text-white dark:bg-mint dark:text-ink" onClick={() => setConsentOffer(offer)}>
                        <Send size={16} />
                        I am Interested
                      </button>
                    </div>
                    <div className="mt-4 grid gap-2 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-3">
                      <span>{offer.bankName}</span>
                      <span>Salary {currency.format(offer.minSalary)} - {currency.format(offer.maxSalary)}</span>
                      <span>Expires {offer.expiryDate}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </section>
        </div>
      </div>

      {sessionMode === "real" && flow !== "onboarding" && (
        <div className={`fixed bottom-4 z-40 ${language === "ar" ? "left-4" : "right-4"} grid gap-2`}>
          <div className="rounded-lg border border-white/70 bg-white/95 px-3 py-2 text-xs font-black shadow-premium backdrop-blur dark:border-white/10 dark:bg-slate-950/95">
            {hasUnsavedChanges
              ? language === "ar"
                ? "● لديك تعديلات غير محفوظة"
                : "● Unsaved changes"
              : language === "ar"
                ? "✓ جميع التعديلات محفوظة"
                : "✓ All changes saved"}
          </div>
          <button
            className={`h-12 rounded-lg px-5 text-sm font-black shadow-premium ${
              hasUnsavedChanges
                ? "bg-emerald-600 text-white dark:bg-mint dark:text-ink"
                : "border border-slate-200 bg-white text-slate-500 dark:border-white/10 dark:bg-white/10 dark:text-slate-300"
            }`}
            onClick={() => saveUserData(undefined, t.common.savedSuccessfully)}
          >
            {language === "ar" ? "حفظ التعديلات" : "Save Changes"}
          </button>
        </div>
      )}

      <section className="print-report" dir={language === "ar" ? "rtl" : "ltr"}>
        <header>
          <p className="report-kicker">DebtIQ</p>
          <h1>{t.common.executiveSummary}</h1>
          <p>{profile.fullName || "DebtIQ User"}</p>
          <p>{[profile.country ? countryLabel(profile.country) : "", profile.city ? cityLabel(profile.city) : "", profile.employer].filter(Boolean).join(" / ")}</p>
          <p>{dateFormatter.format(new Date())}</p>
        </header>

        <div className="report-grid">
          <div>
            <span>{language === "ar" ? "الدخل الشهري" : "Monthly income"}</span>
            <strong>{currency.format(snapshot.totalIncome)}</strong>
          </div>
          <div>
            <span>{language === "ar" ? "الالتزامات الشهرية" : "Monthly obligations"}</span>
            <strong>{currency.format(snapshot.totalMonthlyObligations)}</strong>
          </div>
          <div>
            <span>{language === "ar" ? "مصاريف نمط الحياة" : "Lifestyle expenses"}</span>
            <strong>{currency.format(totalLifestyleExpenses)}</strong>
          </div>
          <div>
            <span>{language === "ar" ? "الفائض أو العجز" : "Surplus / deficit"}</span>
            <strong>{currency.format(snapshot.cashFlow)}</strong>
          </div>
          <div>
            <span>{language === "ar" ? "ضغط الدين" : "Debt pressure"}</span>
            <strong>{scoreLabel(snapshot.debtScore)}</strong>
          </div>
          <div>
            <span>{language === "ar" ? "استخدام البطاقات" : "Credit card utilization"}</span>
            <strong>{highestUtilizationCard ? `${Math.round(highestUtilizationCard.utilization)}%` : "0%"}</strong>
          </div>
          <div>
            <span>{t.dashboard.upcomingOneTime}</span>
            <strong>{currency.format(upcomingOneTimeObligations[0]?.monthlyAmount || 0)}</strong>
          </div>
          <div>
            <span>{t.common.upcomingExtraIncome}</span>
            <strong>{currency.format(extraIncomeEvents[0]?.amount || 0)}</strong>
          </div>
          <div>
            <span>{t.common.profileCompletion}</span>
            <strong>{profileCompletionScore}%</strong>
          </div>
        </div>

        <section>
          <h2>{language === "ar" ? "ملخص تنفيذي" : "Executive Summary"}</h2>
          <p>{language === "ar" ? `دخلك الشهري ${currency.format(snapshot.totalIncome)}، والتزاماتك الشهرية ${currency.format(snapshot.totalMonthlyObligations)}، ومصاريف نمط الحياة ${currency.format(totalLifestyleExpenses)}.` : `Your monthly income is ${currency.format(snapshot.totalIncome)}, monthly obligations are ${currency.format(snapshot.totalMonthlyObligations)}, and lifestyle expenses are ${currency.format(totalLifestyleExpenses)}.`}</p>
          <p>{language === "ar" ? `المتبقي من الراتب حالياً ${currency.format(snapshot.cashFlow)}. أكبر المخاطر تظهر في ضغط الدين واستخدام البطاقات والالتزامات القادمة.` : `Your current remaining salary position is ${currency.format(snapshot.cashFlow)}. The main risks are debt pressure, credit utilization, and upcoming obligations.`}</p>
        </section>

        <section>
          <h2>{language === "ar" ? "توزيع الراتب" : "Salary Distribution"}</h2>
          <p>{language === "ar" ? "الدخل الشهري" : "Monthly Income"}: {currency.format(snapshot.totalIncome)}</p>
          <div className="report-bars">
            {salaryDistribution.map((item) => (
              <div key={item.label}>
                <p><span>{item.label}</span><strong>{currency.format(item.value)}</strong></p>
                <div><span style={{ width: `${Math.min(100, Math.round((item.value / salaryDistributionTotal) * 100))}%` }} /></div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2>{language === "ar" ? "أكبر الالتزامات المؤثرة على التدفق النقدي" : "Top obligations affecting cash flow"}</h2>
          {topObligations.length === 0 && <p>{language === "ar" ? "لا توجد التزامات شهرية بعد." : "No monthly obligations added yet."}</p>}
          {topObligations.map((obligation) => (
            <p key={obligation.label}>{obligation.label}: {currency.format(obligation.value)}</p>
          ))}
        </section>

        <section>
          <h2>{language === "ar" ? "الالتزامات القادمة" : "Upcoming obligations"}</h2>
          {upcomingObligations.slice(0, 5).map((obligation) => (
            <p key={obligation.id}>{obligation.name}: {currency.format(obligation.monthlyAmount)} - {dateFormatter.format(new Date(obligation.dueDate))}</p>
          ))}
        </section>

        <section>
          <h2>{language === "ar" ? "ملخص الأهداف" : "Goals summary"}</h2>
          {goals.length === 0 && <p>{language === "ar" ? "لم تتم إضافة أهداف بعد." : "No goals added yet."}</p>}
          {goals.map((goal) => (
            <p key={goal.id}>{goal.name}: {currency.format(goal.currentAmount)} / {currency.format(goal.targetAmount)}</p>
          ))}
        </section>

        {annualBonusIncomeSources.length > 0 && (
          <section>
            <h2>{t.common.upcomingExtraIncome}</h2>
            {annualBonusIncomeSources.map((income) => (
              <p key={income.id}>
                <strong>{income.name || (language === "ar" ? "بونص" : "Bonus")}</strong>: {currency.format(income.amount)} - {income.expectedMonth || (language === "ar" ? "شهر متوقع" : "Expected month")} - {bonusAllocationLabel(getBonusAllocation(income))}
              </p>
            ))}
          </section>
        )}

        <section>
          <h2>{t.common.actionPlan}</h2>
          {actionPlan.map((action, index) => (
            <p key={action}><strong>{language === "ar" ? `الأولوية ${index + 1}` : `Priority ${index + 1}`}:</strong> {action}</p>
          ))}
        </section>

        <section>
          <h2>{t.common.recommendations}</h2>
          {recommendationCards.map((card) => (
            <p key={card.title}><strong>{card.title}:</strong> {card.body}</p>
          ))}
        </section>
      </section>

      {showUnsavedDialog && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-ink/55 p-4 sm:place-items-center">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-premium dark:bg-slate-950">
            <h3 className="text-xl font-black">{language === "ar" ? "لديك تعديلات غير محفوظة." : "You have unsaved changes."}</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">{language === "ar" ? "ماذا تريد أن تفعل؟" : "What would you like to do?"}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <button className="h-11 rounded-lg bg-emerald-600 text-sm font-black text-white dark:bg-mint dark:text-ink" onClick={continuePendingActionAfterSave}>
                {language === "ar" ? "حفظ التعديلات" : "Save Changes"}
              </button>
              <button className="h-11 rounded-lg border border-red-200 text-sm font-black text-red-700 dark:border-red-400/30 dark:text-red-300" onClick={leavePendingActionAnyway}>
                {language === "ar" ? "متابعة الخروج" : "Leave Anyway"}
              </button>
              <button className="h-11 rounded-lg border border-slate-200 text-sm font-black dark:border-white/10" onClick={() => setShowUnsavedDialog(false)}>
                {language === "ar" ? "إلغاء" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDraftRecovery && draftRecoveryData && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-ink/55 p-4 sm:place-items-center">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-premium dark:bg-slate-950">
            <h3 className="text-xl font-black">{language === "ar" ? "تم العثور على تعديلات غير مكتملة." : "Unsaved draft found."}</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">{language === "ar" ? "هل ترغب في استعادتها؟" : "Would you like to restore it?"}</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                className="h-11 rounded-lg bg-ink text-sm font-black text-white dark:bg-mint dark:text-ink"
                onClick={() => {
                  applyUserData(draftRecoveryData);
                  setHasUnsavedChanges(true);
                  setShowDraftRecovery(false);
                }}
              >
                {language === "ar" ? "استعادة" : "Restore"}
              </button>
              <button
                className="h-11 rounded-lg border border-slate-200 text-sm font-black dark:border-white/10"
                onClick={() => {
                  if (currentUserId) removeStoredItem(draftStorageKey(currentUserId));
                  setDraftRecoveryData(null);
                  setShowDraftRecovery(false);
                }}
              >
                {language === "ar" ? "تجاهل" : "Ignore"}
              </button>
            </div>
          </div>
        </div>
      )}

      {consentOffer && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-ink/55 p-4 sm:place-items-center">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-premium dark:bg-slate-950">
            <p className="text-xs font-black uppercase text-mint">Consent Notice</p>
            <h3 className="mt-2 text-xl font-black">{consentOffer.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              I agree to share my contact information with the offer provider.
            </p>
            <label className="mt-4 flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm font-semibold dark:border-white/10">
              <input className="mt-1" type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
              Share my name, mobile number, email, selected offer, and timestamp with {consentOffer.bankName}.
            </label>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button className="h-11 rounded-lg border border-slate-200 font-bold dark:border-white/10" onClick={() => setConsentOffer(null)}>
                Cancel
              </button>
              <button
                className="h-11 rounded-lg bg-ink font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-mint dark:text-ink"
                disabled={!consent}
                onClick={createLead}
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
