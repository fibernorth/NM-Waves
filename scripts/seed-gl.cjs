/**
 * Seed Chart of Accounts and backfill GL entries from existing income/expense records.
 * Usage: node scripts/seed-gl.cjs
 */
const admin = require('firebase-admin');
const path = require('path');
if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

const DEFAULT_ACCOUNTS = [
  { accountNumber: '1000', name: 'Cash - Checking', type: 'asset', subtype: 'current' },
  { accountNumber: '1010', name: 'Cash - Savings', type: 'asset', subtype: 'current' },
  { accountNumber: '1020', name: 'Cash - PayPal/Venmo', type: 'asset', subtype: 'current' },
  { accountNumber: '1100', name: 'Accounts Receivable - Player Balances', type: 'asset', subtype: 'current' },
  { accountNumber: '1200', name: 'Prepaid Expenses', type: 'asset', subtype: 'current' },
  { accountNumber: '1500', name: 'Equipment & Property', type: 'asset', subtype: 'fixed' },
  { accountNumber: '2000', name: 'Accounts Payable', type: 'liability', subtype: 'current' },
  { accountNumber: '2100', name: 'Accrued Expenses', type: 'liability', subtype: 'current' },
  { accountNumber: '2200', name: 'Deferred Revenue (Prepaid Fees)', type: 'liability', subtype: 'current' },
  { accountNumber: '3000', name: 'Net Assets - Unrestricted', type: 'equity', subtype: 'unrestricted' },
  { accountNumber: '3100', name: 'Net Assets - Temporarily Restricted', type: 'equity', subtype: 'restricted' },
  { accountNumber: '3900', name: 'Retained Earnings', type: 'equity', subtype: 'retained' },
  { accountNumber: '4000', name: 'Player Registration & Fees', type: 'revenue', subtype: 'program' },
  { accountNumber: '4100', name: 'Sponsorship Revenue', type: 'revenue', subtype: 'contributions' },
  { accountNumber: '4200', name: 'Fundraising Revenue', type: 'revenue', subtype: 'fundraising' },
  { accountNumber: '4300', name: 'Donation Revenue', type: 'revenue', subtype: 'contributions' },
  { accountNumber: '4400', name: 'Grant Revenue', type: 'revenue', subtype: 'grants' },
  { accountNumber: '4500', name: 'Merchandise Sales', type: 'revenue', subtype: 'sales' },
  { accountNumber: '4600', name: 'Concession Revenue', type: 'revenue', subtype: 'sales' },
  { accountNumber: '4900', name: 'Other Revenue', type: 'revenue', subtype: 'other' },
  { accountNumber: '5000', name: 'Facility Rental & Fees', type: 'expense', subtype: 'program' },
  { accountNumber: '5100', name: 'Equipment & Supplies', type: 'expense', subtype: 'program' },
  { accountNumber: '5200', name: 'Uniforms & Apparel', type: 'expense', subtype: 'program' },
  { accountNumber: '5300', name: 'Tournament Fees & Entry', type: 'expense', subtype: 'program' },
  { accountNumber: '5400', name: 'Travel & Transportation', type: 'expense', subtype: 'program' },
  { accountNumber: '5500', name: 'Insurance', type: 'expense', subtype: 'program' },
  { accountNumber: '5600', name: 'League & Association Fees', type: 'expense', subtype: 'program' },
  { accountNumber: '5700', name: 'Coaching & Training', type: 'expense', subtype: 'program' },
  { accountNumber: '5800', name: 'Processing Fees (Stripe)', type: 'expense', subtype: 'program' },
  { accountNumber: '5900', name: 'Other Program Expenses', type: 'expense', subtype: 'program' },
  { accountNumber: '6000', name: 'Administrative Expenses', type: 'expense', subtype: 'admin' },
  { accountNumber: '6100', name: 'Marketing & Communications', type: 'expense', subtype: 'admin' },
  { accountNumber: '7000', name: 'Fundraising Expenses', type: 'expense', subtype: 'fundraising' },
];

const INCOME_CATEGORY_TO_ACCOUNT = {
  player_payments: '4000',
  sponsorships: '4100',
  fundraisers: '4200',
  donations: '4300',
  grants: '4400',
  merchandise: '4500',
  concessions: '4600',
  other: '4900',
};

const EXPENSE_CATEGORY_TO_ACCOUNT = {
  facilities: '5000',
  equipment: '5100',
  uniforms: '5200',
  tournaments: '5300',
  travel: '5400',
  insurance: '5500',
  league_fees: '5600',
  coaching: '5700',
  processing_fees: '5800',
  administrative: '6000',
  marketing: '6100',
  fundraising: '7000',
  maintenance: '5900',
  other: '5900',
};

async function main() {
  // Step 1: Seed Chart of Accounts
  const coaSnap = await db.collection('chartOfAccounts').get();
  if (coaSnap.size === 0) {
    console.log('Seeding Chart of Accounts...');
    let created = 0;
    for (const acct of DEFAULT_ACCOUNTS) {
      await db.collection('chartOfAccounts').add({
        ...acct,
        active: true,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });
      created++;
    }
    console.log(`  Created ${created} accounts`);
  } else {
    console.log(`Chart of Accounts already exists (${coaSnap.size} accounts)`);
  }

  // Rebuild account lookup
  const coaRefresh = await db.collection('chartOfAccounts').get();
  const accountMap = {};
  for (const d of coaRefresh.docs) {
    const data = d.data();
    accountMap[data.accountNumber] = { id: d.id, ...data };
  }

  // Step 2: Check existing GL entries
  const glSnap = await db.collection('generalLedger').get();
  const existingSourceIds = new Set();
  for (const d of glSnap.docs) {
    const sid = d.data().sourceId;
    if (sid) existingSourceIds.add(sid);
  }
  console.log(`\nExisting GL entries: ${glSnap.size}`);

  // Step 3: Backfill from income records
  const incSnap = await db.collection('income').get();
  let incPosted = 0, incSkipped = 0;
  for (const d of incSnap.docs) {
    if (existingSourceIds.has(d.id)) { incSkipped++; continue; }
    const data = d.data();
    const amount = data.amount || 0;
    if (amount <= 0) continue;

    const revenueAcctNum = INCOME_CATEGORY_TO_ACCOUNT[data.category] || '4900';
    const debitAcct = accountMap['1000'];
    const creditAcct = accountMap[revenueAcctNum];
    if (!debitAcct || !creditAcct) continue;

    const date = data.date && data.date.toDate ? data.date.toDate() : new Date();
    const base = {
      date: admin.firestore.Timestamp.fromDate(date),
      memo: `${data.source || ''}: ${data.description || ''}`.trim(),
      sourceType: 'income',
      sourceId: d.id,
      season: data.season || '',
      createdBy: 'system_backfill',
      createdAt: admin.firestore.Timestamp.now(),
    };

    await db.collection('generalLedger').add({
      ...base,
      accountId: debitAcct.id,
      accountNumber: '1000',
      accountName: debitAcct.name,
      debit: amount,
      credit: 0,
    });
    await db.collection('generalLedger').add({
      ...base,
      accountId: creditAcct.id,
      accountNumber: revenueAcctNum,
      accountName: creditAcct.name,
      debit: 0,
      credit: amount,
    });
    incPosted++;
  }
  console.log(`Income: posted ${incPosted}, skipped ${incSkipped}`);

  // Step 4: Backfill from expense records
  const expSnap = await db.collection('expenses').get();
  let expPosted = 0, expSkipped = 0;
  for (const d of expSnap.docs) {
    if (existingSourceIds.has(d.id)) { expSkipped++; continue; }
    const data = d.data();
    const amount = data.amount || 0;
    if (amount <= 0) continue;

    const expAcctNum = EXPENSE_CATEGORY_TO_ACCOUNT[data.category] || '5900';
    const creditAcctNum = data.isPaid ? '1000' : '2000';
    const debitAcct = accountMap[expAcctNum];
    const creditAcct = accountMap[creditAcctNum];
    if (!debitAcct || !creditAcct) continue;

    const date = data.date && data.date.toDate ? data.date.toDate() : new Date();
    const base = {
      date: admin.firestore.Timestamp.fromDate(date),
      memo: `${data.vendor || ''}: ${data.description || ''}`.trim(),
      sourceType: 'expense',
      sourceId: d.id,
      season: data.season || '',
      createdBy: 'system_backfill',
      createdAt: admin.firestore.Timestamp.now(),
    };

    await db.collection('generalLedger').add({
      ...base,
      accountId: debitAcct.id,
      accountNumber: expAcctNum,
      accountName: debitAcct.name,
      debit: amount,
      credit: 0,
    });
    await db.collection('generalLedger').add({
      ...base,
      accountId: creditAcct.id,
      accountNumber: creditAcctNum,
      accountName: creditAcct.name,
      debit: 0,
      credit: amount,
    });
    expPosted++;
  }
  console.log(`Expenses: posted ${expPosted}, skipped ${expSkipped}`);

  const finalGl = await db.collection('generalLedger').get();
  console.log(`\nTotal GL entries after backfill: ${finalGl.size}`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
