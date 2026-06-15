import type { CreditCard, Debt, IncomeSource, ObligationEntry } from "./types";

export type ScoreBand = "Green" | "Yellow" | "Red";

export type FinancialSnapshot = {
  totalIncome: number;
  totalDebt: number;
  debtInstallments: number;
  totalMonthlyObligations: number;
  cashFlow: number;
  availableCashFlow: number;
  debtToIncomeRatio: number;
  creditCardUsage: number;
  debtScore: ScoreBand;
  pressureScore: number;
};

const sum = (values: number[]) => values.reduce((total, value) => total + Number(value || 0), 0);

const spreadAllocation = "Spread amount monthly until due date";

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function parseLocalDate(value?: string) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function monthsBetweenInclusive(from: Date, to: Date) {
  const fromMonth = monthStart(from);
  const toMonth = monthStart(to);
  const diff = (toMonth.getFullYear() - fromMonth.getFullYear()) * 12 + toMonth.getMonth() - fromMonth.getMonth();
  return Math.max(1, diff + 1);
}

function isSameMonth(first: Date, second: Date) {
  return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth();
}

function isActiveInMonth(obligation: ObligationEntry, month: Date) {
  const startDate = parseLocalDate(obligation.startDate);
  const endDate = parseLocalDate(obligation.endDate);
  const monthDate = monthStart(month);
  if (startDate && monthStart(startDate) > monthDate) return false;
  if (endDate && monthStart(endDate) < monthDate) return false;
  return true;
}

export function getObligationDueDate(obligation: ObligationEntry, from = new Date()) {
  const explicitDueDate = parseLocalDate(obligation.dueDate);
  if (explicitDueDate && obligation.frequency !== "Monthly") {
    if (obligation.frequency === "Annual" && explicitDueDate < from) {
      const nextAnnualDate = new Date(explicitDueDate);
      while (nextAnnualDate < from) nextAnnualDate.setFullYear(nextAnnualDate.getFullYear() + 1);
      return nextAnnualDate;
    }
    return explicitDueDate;
  }

  const day = obligation.dueDay || explicitDueDate?.getDate() || 1;
  const dueDate = new Date(from.getFullYear(), from.getMonth(), Math.min(28, Math.max(1, day)));
  if (dueDate < from) dueDate.setMonth(dueDate.getMonth() + 1);
  return dueDate;
}

export function getMonthsUntilObligationDue(obligation: ObligationEntry, from = new Date()) {
  return monthsBetweenInclusive(from, getObligationDueDate(obligation, from));
}

export function getRequiredMonthlySaving(obligation: ObligationEntry, from = new Date()) {
  if (obligation.frequency === "Monthly") return 0;
  if (obligation.allocationMethod !== spreadAllocation) return 0;
  const dueDate = getObligationDueDate(obligation, from);
  if (monthStart(dueDate) < monthStart(from)) return 0;
  const remainingAmount = Math.max((obligation.monthlyAmount || 0) - (obligation.savedAmount || 0), 0);
  return remainingAmount / monthsBetweenInclusive(from, dueDate);
}

export function getMonthlyObligationImpact(obligation: ObligationEntry, month = new Date()) {
  if (!isActiveInMonth(obligation, month)) return 0;
  if (obligation.frequency === "Monthly") return obligation.monthlyAmount || 0;
  if (obligation.allocationMethod === spreadAllocation) return getRequiredMonthlySaving(obligation, month);
  return isSameMonth(getObligationDueDate(obligation, month), month) ? obligation.monthlyAmount || 0 : 0;
}

export function calculateSnapshot(
  incomeSources: IncomeSource[],
  debts: Debt[],
  obligations: ObligationEntry[],
  creditCards: CreditCard[] = [],
): FinancialSnapshot {
  const totalIncome = sum(incomeSources.map((income) => income.amount));
  const totalCreditCardBalance = sum(creditCards.map((card) => card.currentBalance));
  const totalDebt = sum(debts.map((debt) => debt.remainingBalance)) + totalCreditCardBalance;
  const monthlyObligationImpacts = obligations.map((obligation) => getMonthlyObligationImpact(obligation));
  const debtInstallments = sum(
    obligations
      .filter((obligation) => obligation.category === "Loan" || obligation.category === "Credit Card")
      .map((obligation) => getMonthlyObligationImpact(obligation)),
  );
  const totalMonthlyObligations = sum(monthlyObligationImpacts);
  const cashFlow = totalIncome - totalMonthlyObligations;
  const availableCashFlow = Math.max(cashFlow, 0);
  const debtToIncomeRatio = totalIncome > 0 ? debtInstallments / totalIncome : 0;
  const cardBalance = totalCreditCardBalance;
  const cardLimit = sum(creditCards.map((card) => card.creditLimit));
  const creditCardUsage = cardLimit > 0 ? cardBalance / cardLimit : 0;
  const nearDueCards = creditCards.filter((card) => {
    const days = Math.ceil((new Date(card.dueDate).getTime() - Date.now()) / 86400000);
    return days >= 0 && days <= 7;
  }).length;

  let pressureScore = 20;
  pressureScore += debtToIncomeRatio * 80;
  pressureScore += totalIncome > 0 ? (totalMonthlyObligations / totalIncome) * 55 : 35;
  pressureScore += creditCardUsage * 35;
  pressureScore += nearDueCards * 8;
  pressureScore += cashFlow < 0 ? 25 : cashFlow < totalIncome * 0.15 ? 12 : 0;
  pressureScore = Math.min(100, Math.round(pressureScore));

  const debtScore: ScoreBand = pressureScore >= 70 ? "Red" : pressureScore >= 45 ? "Yellow" : "Green";

  return {
    totalIncome,
    totalDebt,
    debtInstallments,
    totalMonthlyObligations,
    cashFlow,
    availableCashFlow,
    debtToIncomeRatio,
    creditCardUsage,
    debtScore,
    pressureScore,
  };
}

export function scoreLabel(score: ScoreBand) {
  if (score === "Green") return "Healthy";
  if (score === "Yellow") return "Needs Attention";
  return "High Pressure";
}
