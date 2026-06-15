export type DebtType = "Personal Loan" | "Credit Card" | "Mortgage" | "Auto Finance" | "Other Debt";
export type OfferType =
  | "Debt Transfer"
  | "Refinancing"
  | "Personal Loan"
  | "Mortgage"
  | "Auto Finance"
  | "Credit Card"
  | "Other";
export type GoalType =
  | "Pay Off Credit Card"
  | "Pay Off Debt"
  | "Buy Car"
  | "Buy Home"
  | "Emergency Fund"
  | "School Fees"
  | "Business Fund"
  | "Travel"
  | "Other";
export type GoalPriority = "High" | "Medium" | "Low";
export type IncomeType = "Salary" | "Rent" | "Housing Allowance" | "Business" | "Consulting" | "Commission" | "Bonus" | "Other";
export type MaritalStatus = "Single" | "Married" | "Divorced" | "Widowed" | "Prefer not to say";
export type Country = "Saudi Arabia" | "UAE" | "Kuwait" | "Bahrain" | "Qatar" | "Oman" | "Other";
export type EmploymentSector = "Government" | "Private Sector" | "Military" | "Semi-Government" | "Self-Employed" | "Retired" | "Student" | "Prefer not to say" | "Other";
export type BonusAllocation =
  | "Allocate to financial goals"
  | "Pay off a credit card"
  | "Pay off a loan"
  | "Emergency fund"
  | "School fees / major obligation"
  | "Keep unallocated for now"
  | "Custom allocation";
export type UserStatus = "Active" | "Incomplete" | "Inactive" | "Deleted";
export type LeadStatus = "New" | "Contacted" | "In Progress" | "Closed" | "Rejected";
export type ObligationCategory =
  | "Loan"
  | "Credit Card"
  | "Education"
  | "Housing"
  | "Children"
  | "Domestic Worker"
  | "Vehicle"
  | "Insurance"
  | "Lifestyle"
  | "Other";
export type ObligationFrequency = "Monthly" | "One-Time" | "Annual";
export type ObligationAllocationMethod =
  | "Count full amount only in due month"
  | "Spread amount monthly until due date";

export type UserProfile = {
  fullName: string;
  mobile: string;
  email: string;
  country: Country | "";
  city: string;
  employer: string;
  employmentSector: EmploymentSector | "";
  maritalStatus: MaritalStatus | "";
};

export type Debt = {
  id: string;
  type: DebtType;
  name: string;
  bank: string;
  remainingBalance: number;
  monthlyInstallment: number;
  interestRate: number;
  endDate: string;
  limit?: number;
};

export type IncomeSource = {
  id: string;
  name: string;
  amount: number;
  type: IncomeType;
  expectedMonth?: string;
  guaranteed?: boolean;
  recurring?: boolean;
  notes?: string;
  allocation?: BonusAllocation;
};

export type ObligationEntry = {
  id: string;
  name: string;
  monthlyAmount: number;
  category: ObligationCategory;
  dueDay: number;
  isRecurring: boolean;
  frequency: ObligationFrequency;
  dueDate: string;
  startDate: string;
  endDate?: string;
  allocationMethod: ObligationAllocationMethod;
  savedAmount: number;
  notes: string;
};

export type Offer = {
  id: string;
  type: OfferType;
  title: string;
  bankName: string;
  description: string;
  minSalary: number;
  maxSalary: number;
  minDebt: number;
  maxDebt: number;
  expiryDate: string;
  contactPerson: string;
  contactNumber: string;
  active: boolean;
};

export type Lead = {
  id: string;
  userId?: string;
  userName: string;
  mobile: string;
  email: string;
  offerSelected: string;
  timestamp: string;
  status: LeadStatus;
};

export type Goal = {
  id: string;
  name: string;
  type: GoalType;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  priority: GoalPriority;
  notes: string;
  linkedDebtId?: string;
  linkedCreditCardId?: string;
};

export type CreditCard = {
  id: string;
  cardName: string;
  provider: string;
  creditLimit: number;
  currentBalance: number;
  minimumPaymentDue: number;
  statementTotalDue: number;
  dueDate: string;
  aprOrProfitRate: number;
  notes: string;
};

export type AdminUser = UserProfile & {
  id: string;
  createdAt: string;
  lastLogin: string;
  userType: "Demo" | "Real";
  status: UserStatus;
  profileCompletion: number;
  incomeSourceCount: number;
  obligationCount: number;
  creditCardCount: number;
  goalCount: number;
  leadCount: number;
};
