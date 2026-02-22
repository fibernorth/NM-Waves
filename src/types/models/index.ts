// User Roles
export type UserRole = 'visitor' | 'parent' | 'coach' | 'admin' | 'master-admin' | 'sponsor';

// User Model
export interface User {
  uid: string;
  email: string;
  displayName: string;
  roles: UserRole[];
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
  relationship: 'Mother' | 'Father' | 'Stepmother' | 'Stepfather' | 'Guardian' | 'Other' | string;
  email: string;
  phone: string;
  isPrimaryContact?: boolean;
  isFinancialParty?: boolean;
}

// Player Document (birth certificate, etc.)
export type PlayerDocumentType = 'birth_certificate' | 'medical_form' | 'waiver' | 'report_card' | 'other';

export interface PlayerDocument {
  id: string;
  type: PlayerDocumentType;
  label: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  uploadedBy: string;
  uploadedByName?: string;
  uploadedAt: Date;
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
  documents?: PlayerDocument[];
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
  method: 'cash' | 'check' | 'venmo' | 'zelle' | 'card' | 'credit_card' | 'bank_transfer' | 'sponsor' | 'stripe' | 'other';
  reference?: string;
  note?: string;
  notes?: string;
  payerName?: string;
  payerEmail?: string;
  sponsorId?: string;
  sponsorName?: string;
  stripeSessionId?: string;
  isAnonymous?: boolean;
  processingFee?: number;
  reconciled?: boolean;
  reconciledAt?: Date;
  reconciledBy?: string;
  recordedBy: string;
  recordedAt: Date;
}

// Invoice Token Model (for QR code payments)
export interface InvoiceToken {
  id: string;
  financeId: string;
  playerId: string;
  playerName: string;
  teamName: string;
  season: string;
  amountDue: number;
  chargeType?: string;       // e.g. 'registrationFee' or 'full_balance'
  chargeLabel?: string;      // e.g. 'Registration Fee' or 'Full Balance'
  chargeAmount?: number;     // amount for the specific charge (0 for full balance)
  registrationFee?: number;
  uniformCost?: number;
  tournamentFees?: number;
  facilityFees?: number;
  equipmentFees?: number;
  otherFees?: number;
  scholarshipAmount?: number;
  totalPaid?: number;
  token: string;
  expiresAt: Date;
  createdBy: string;
  createdAt: Date;
  used: boolean;
  usedAt?: Date;
  usedBy?: string;
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
  moderationStatus?: 'pending' | 'approved' | 'rejected';
  moderationLabels?: { adult?: string; violence?: string; racy?: string };
  moderationReviewedAt?: Date;
  moderationOverriddenBy?: string;
  source?: 'firebase' | 'google_drive';
  createdAt: Date;
}

// Tournament Workflow Status
export type TournamentWorkflowStatus =
  | 'planning'
  | 'committed'
  | 'signed_up'
  | 'deposit_paid'
  | 'schedule_received'
  | 'accommodations_shared'
  | 'playing'
  | 'completed';

// Tournament Status History Entry
export interface TournamentStatusHistoryEntry {
  from: TournamentWorkflowStatus;
  to: TournamentWorkflowStatus;
  changedBy: string;
  changedAt: Date;
  notes?: string;
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
  workflowStatus?: TournamentWorkflowStatus;
  depositAmount?: number;
  depositPaidDate?: Date;
  balanceDueDate?: Date;
  balancePaid?: boolean;
  registrationUrl?: string;
  accommodationsInfo?: string;
  statusHistory?: TournamentStatusHistoryEntry[];
}

// ============================================
// COST MANAGEMENT SYSTEM
// ============================================

export type CostItemTier = 'organization' | 'team' | 'player';

export type OrgCostCategory = 'waves_fee' | 'insurance' | 'administrative';
export type TeamCostCategory = 'tournament' | 'equipment' | 'special';
export type PlayerCostCategory = 'helmet' | 'bag' | 'uniform_piece' | 'special';
export type CostItemCategory = OrgCostCategory | TeamCostCategory | PlayerCostCategory;

export type CostFinanceField =
  | 'registrationFee'
  | 'uniformCost'
  | 'tournamentFees'
  | 'facilityFees'
  | 'equipmentFees'
  | 'otherFees';

export interface CostItem {
  id: string;
  tier: CostItemTier;
  category: CostItemCategory;
  label: string;
  amount: number;
  season: string;
  teamId?: string;
  teamName?: string;
  playerId?: string;
  playerName?: string;
  tournamentId?: string;
  tournamentName?: string;
  financeField: CostFinanceField;
  notes?: string;
  active: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamInvoiceBatch {
  id: string;
  teamId: string;
  teamName: string;
  season: string;
  amountPerPlayer: number;
  totalAmount: number;
  playerCount: number;
  playerFinanceIds: string[];
  description: string;
  batchDate: Date;
  createdBy: string;
  createdAt: Date;
}

// Category to Finance Field mapping
export const COST_CATEGORY_FINANCE_FIELD_MAP: Record<CostItemCategory, CostFinanceField> = {
  waves_fee: 'registrationFee',
  insurance: 'otherFees',
  administrative: 'otherFees',
  tournament: 'tournamentFees',
  equipment: 'equipmentFees',
  special: 'otherFees',
  helmet: 'equipmentFees',
  bag: 'equipmentFees',
  uniform_piece: 'uniformCost',
};

// Sponsor Model
export interface SponsoredPlayer {
  playerId: string;
  playerName: string;
  amount: number;
  paymentId?: string;
  date: Date;
}

export type SponsorshipType = 'player_sponsor' | 'team_sponsor' | 'general';

export interface Sponsor {
  id: string;
  businessName: string;
  logoUrl?: string;
  websiteUrl?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  level: 'gold' | 'silver' | 'bronze' | 'custom';
  sponsorshipType?: SponsorshipType;
  amount?: number;
  displayOnPublicSite: boolean;
  season: string;
  sponsoredPlayers?: SponsoredPlayer[];
  userId?: string;
  stripeCustomerId?: string;
  totalSponsored?: number;
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
  payerName?: string;
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
// HOMEPAGE POSTS
// ============================================

export type HomepagePostType = 'news' | 'announcement' | 'photo' | 'video' | 'score' | 'highlight';

export interface HomepagePost {
  id: string;
  type: HomepagePostType;
  title: string;
  body?: string;
  imageUrl?: string;
  videoUrl?: string;
  // Score fields
  teamId?: string;
  teamName?: string;
  opponent?: string;
  scoreUs?: number;
  scoreThem?: number;
  gameDate?: Date;
  result?: 'W' | 'L' | 'T';
  // Highlight fields
  statHighlights?: { playerName: string; stat: string; value: string }[];
  pinned: boolean;
  published: boolean;
  createdBy: string;
  createdByName?: string;
  createdAt: Date;
  updatedAt: Date;
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

// ============================================
// GAMECHANGER INTEGRATION
// ============================================

export type GCStatType = 'batting' | 'pitching' | 'fielding';

export interface GCStats {
  id: string;
  playerId: string;
  playerName?: string;
  teamId: string;
  gcTeamId: string;
  season: string;
  statType: GCStatType;
  stats: Record<string, number>;
  scrapedAt: Date;
}

export interface GCGame {
  id: string;
  gcTeamId: string;
  teamId: string;
  opponent: string;
  date: Date;
  location: string;
  scoreUs: number;
  scoreThem: number;
  result: 'W' | 'L' | 'T';
  season: string;
  scrapedAt: Date;
}
