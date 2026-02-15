// User Roles
export type UserRole = 'visitor' | 'parent' | 'coach' | 'admin' | 'master-admin';

// User Model
export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  teamIds: string[];
  linkedPlayerIds: string[];
  permissions: {
    canEditRosters: boolean;
    canViewFinancials: boolean;
    canManageSchedules: boolean;
    canUploadMedia: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Team Model
export interface Team {
  id: string;
  name: string;
  ageGroup: string;
  season: string;
  coachIds: string[];
  playerIds: string[];
  coachId?: string;
  coachName?: string;
  gcTeamId?: string;
  active: boolean;
  status: 'active' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

// Player Contact
export interface PlayerContact {
  name: string;
  relationship: string;
  email: string;
  phone: string;
}

// Player Model
export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  teamId?: string;
  teamName?: string;
  jerseyNumber?: number;
  gradYear?: number;
  positions: string[];
  bats?: 'L' | 'R' | 'S';
  throws?: 'L' | 'R';
  contacts: PlayerContact[];
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  emergencyContact: string;
  emergencyPhone: string;
  medicalNotes?: string;
  notes?: string;
  dateOfBirth?: Date;
  playingUpFrom?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Global Cost Assumptions (single document)
export interface GlobalCostAssumptions {
  id: 'global';
  uniformCost: number;
  tournamentCost: number;
  indoorFacilityCost: number;
  insurance: number;
  adminFee: number;
  otherCosts: { label: string; amount: number }[];
  registrationFee: number;
  tournamentFeePerEvent: number;
  facilityFeePerSeason: number;
  equipmentFeePerSeason: number;
  fundraisingTarget: number;
  season: string;
  updatedAt: Date;
  updatedBy: string;
}

// Player Finance Model
export interface PlayerFinance {
  id: string;
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  season: string;
  assumedCost: number;
  actualCost: number;
  scholarshipAmount: number;
  registrationFee: number;
  uniformCost: number;
  tournamentFees: number;
  facilityFees: number;
  equipmentFees: number;
  otherFees: number;
  totalPaid: number;
  payments: Payment[];
  totalOwed: number;
  balance: number;
  balanceDue: number;
  status: 'current' | 'overdue' | 'paid';
  createdAt: Date;
  updatedAt: Date;
}

export interface Payment {
  id: string;
  amount: number;
  date: Date;
  method: 'cash' | 'check' | 'venmo' | 'zelle' | 'card' | 'credit_card' | 'bank_transfer' | 'sponsor' | 'other';
  reference?: string;
  note?: string;
  notes?: string;
  sponsorId?: string;
  sponsorName?: string;
  reconciled?: boolean;
  reconciledAt?: Date;
  reconciledBy?: string;
  recordedBy: string;
  recordedAt: Date;
}

// Announcement Model
export interface Announcement {
  id: string;
  title: string;
  body: string;
  teamId: string; // "all" for org-wide
  priority: 'normal' | 'urgent';
  createdBy: string;
  createdByName?: string;
  createdAt: Date;
  pinned: boolean;
}

// Conversation Model
export interface Conversation {
  id: string;
  type: 'team' | 'direct';
  teamId: string | null;
  teamName?: string;
  participantIds: string[];
  lastMessage: string;
  lastMessageAt: Date;
}

// Message Model
export interface Message {
  id: string;
  senderId: string;
  senderName?: string;
  text: string;
  sentAt: Date;
}

// Schedule Event Model
export interface ScheduleEvent {
  id: string;
  eventType: 'game' | 'practice' | 'tournament' | 'meeting' | 'other';
  teamId: string; // "all" for org-wide
  teamName?: string;
  title: string;
  location: string;
  startTime: Date;
  endTime: Date;
  notes?: string;
  createdBy: string;
}

// Document Model
export interface AppDocument {
  id: string;
  title: string;
  description?: string;
  fileURL: string;
  fileName?: string;
  fileSize?: number;
  teamId: string; // "all" for org-wide
  visibility: 'public' | 'parent' | 'coach' | 'team' | 'admin';
  uploadedBy: string;
  uploadedByName?: string;
  category?: string;
  createdAt: Date;
}

// Volunteer Model
export interface Volunteer {
  id: string;
  eventId: string;
  eventTitle?: string;
  teamId: string;
  teamName?: string;
  role: string;
  assignedTo: string;
  assignedToName?: string;
  status: 'assigned' | 'confirmed' | 'completed';
  createdAt?: Date;
}

// Media Model
export interface MediaItem {
  id: string;
  fileUrl: string;
  thumbnailUrl?: string;
  fileName?: string;
  teamId: string;
  teamName?: string;
  uploadedBy: string;
  uploadedByName?: string;
  tags: string[];
  caption?: string;
  mediaType?: 'image' | 'video';
  createdAt: Date;
}

// Tournament Model
export interface Tournament {
  id: string;
  name: string;
  location: string;
  startDate: Date;
  endDate: Date;
  teamIds: string[];
  contact?: string;
  notes?: string;
  cost: number;
  status?: 'upcoming' | 'in_progress' | 'completed';
}

// Sponsor Model
export interface SponsoredPlayer {
  playerId: string;
  playerName: string;
  amount: number;
  paymentId?: string;
  date: Date;
}

export interface Sponsor {
  id: string;
  businessName: string;
  logoUrl?: string;
  websiteUrl?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  level: 'gold' | 'silver' | 'bronze' | 'custom';
  amount?: number;
  displayOnPublicSite: boolean;
  season: string;
  sponsoredPlayers?: SponsoredPlayer[];
  createdAt?: Date;
}

// Fundraiser Model
export interface Fundraiser {
  id: string;
  name: string;
  description?: string;
  goal: number;
  currentAmount: number;
  teamId: string; // "all" for org-wide
  status: 'active' | 'completed';
  donations: FundraiserDonation[];
  startDate?: Date;
  endDate?: Date;
  createdAt?: Date;
}

export interface FundraiserDonation {
  payerName: string;
  amount: number;
  method: string;
  date: Date;
}

// Player Metrics Model
export interface PlayerMetric {
  id: string;
  playerId: string;
  playerName?: string;
  metricType: string;
  value: number;
  unit: string;
  date: Date;
  recordedBy: string;
}

// Scholarship Model
export interface Scholarship {
  id: string;
  playerId: string;
  playerName?: string;
  amount: number;
  reason: string;
  approvedBy: string;
  approvedAt: Date;
}

// ============================================
// COMPREHENSIVE ACCOUNTING SYSTEM
// ============================================

export type ExpenseCategory =
  | 'facilities'
  | 'equipment'
  | 'uniforms'
  | 'tournaments'
  | 'travel'
  | 'insurance'
  | 'league_fees'
  | 'coaching'
  | 'administrative'
  | 'marketing'
  | 'fundraising'
  | 'maintenance'
  | 'other';

export type IncomeCategory =
  | 'player_payments'
  | 'sponsorships'
  | 'fundraisers'
  | 'donations'
  | 'grants'
  | 'merchandise'
  | 'concessions'
  | 'other';

export interface Expense {
  id: string;
  date: Date;
  category: ExpenseCategory;
  amount: number;
  vendor: string;
  description: string;
  paymentMethod: 'cash' | 'check' | 'credit_card' | 'bank_transfer' | 'venmo' | 'zelle' | 'other';
  checkNumber?: string;
  receiptUrl?: string;
  teamId?: string;
  season: string;
  isPaid: boolean;
  paidDate?: Date;
  notes?: string;
  reconciled?: boolean;
  reconciledAt?: Date;
  reconciledBy?: string;
  recordedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Income {
  id: string;
  date: Date;
  category: IncomeCategory;
  amount: number;
  source: string;
  description: string;
  paymentMethod: 'cash' | 'check' | 'credit_card' | 'bank_transfer' | 'venmo' | 'zelle' | 'other';
  checkNumber?: string;
  referenceNumber?: string;
  teamId?: string;
  playerId?: string;
  season: string;
  notes?: string;
  reconciled?: boolean;
  reconciledAt?: Date;
  reconciledBy?: string;
  recordedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Budget {
  id: string;
  season: string;
  teamId?: string;
  teamName?: string;
  plannedIncome: {
    playerPayments: number;
    sponsorships: number;
    fundraisers: number;
    donations: number;
    grants: number;
    merchandise: number;
    concessions: number;
    other: number;
  };
  plannedExpenses: {
    facilities: number;
    equipment: number;
    uniforms: number;
    tournaments: number;
    travel: number;
    insurance: number;
    leagueFees: number;
    coaching: number;
    administrative: number;
    marketing: number;
    fundraising: number;
    maintenance: number;
    other: number;
  };
  actualIncome?: number;
  actualExpenses?: number;
  variance?: number;
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'petty_cash' | 'credit_card' | 'other';
  accountNumber?: string;
  bankName?: string;
  balance: number;
  lastReconciled?: Date;
  active: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Vendor {
  id: string;
  name: string;
  category: ExpenseCategory;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  notes?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FinancialSummary {
  season: string;
  teamId?: string;
  startDate: Date;
  endDate: Date;
  income: {
    playerPayments: number;
    sponsorships: number;
    fundraisers: number;
    donations: number;
    grants: number;
    merchandise: number;
    concessions: number;
    other: number;
    total: number;
  };
  expenses: {
    facilities: number;
    equipment: number;
    uniforms: number;
    tournaments: number;
    travel: number;
    insurance: number;
    leagueFees: number;
    coaching: number;
    administrative: number;
    marketing: number;
    fundraising: number;
    maintenance: number;
    other: number;
    total: number;
  };
  netIncome: number;
  outstandingPayables: number;
  outstandingReceivables: number;
}

// ============================================
// EQUIPMENT MANAGEMENT
// ============================================

export type EquipmentType = 'jersey' | 'pants' | 'helmet' | 'bag' | 'belt' | 'socks' | 'guest_jersey';
export type EquipmentStatus = 'available' | 'assigned' | 'damaged' | 'retired';

export interface Equipment {
  id: string;
  type: EquipmentType;
  number?: number;
  size: string;
  assignedTo?: string;
  assignedToName?: string;
  teamId?: string;
  season: string;
  condition: 'new' | 'good' | 'fair' | 'poor';
  cost: number;
  status: EquipmentStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
