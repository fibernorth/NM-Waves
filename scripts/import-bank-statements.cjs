/**
 * Import bank statement transactions as the source of truth for income/expenses.
 * Clears existing income, expense, and GL records first.
 * Usage: node scripts/import-bank-statements.cjs
 */
const admin = require('firebase-admin');
const path = require('path');
if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();
const { Timestamp } = admin.firestore;

const SEASON = '2025-2026';
const BATCH_SIZE = 500;

const deposits = [
  { date: '2025-08-15', amount: 1877.43, desc: 'Venmo cashout - William Gaylord', category: 'player_payments', method: 'venmo' },
  { date: '2025-08-15', amount: 900.00, desc: 'Deposit/Credit', category: 'player_payments', method: 'check' },
  { date: '2025-08-22', amount: 350.00, desc: 'Deposit/Credit', category: 'player_payments', method: 'check' },
  { date: '2025-09-03', amount: 800.00, desc: 'Deposit/Credit', category: 'player_payments', method: 'check' },
  { date: '2025-09-16', amount: 1500.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2025-09-17', amount: 1000.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2025-09-19', amount: 250.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2025-09-22', amount: 250.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2025-09-22', amount: 500.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2025-09-22', amount: 500.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2025-09-26', amount: 500.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2025-09-29', amount: 250.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2025-09-29', amount: 500.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2025-09-30', amount: 250.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2025-10-06', amount: 250.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2025-11-25', amount: 500.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2025-11-26', amount: 500.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2025-11-26', amount: 2636.05, desc: 'Deposit/Credit (checks/cash)', category: 'player_payments', method: 'check' },
  { date: '2025-11-28', amount: 250.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2025-12-01', amount: 250.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2025-12-01', amount: 250.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2025-12-02', amount: 500.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2025-12-03', amount: 350.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2025-12-04', amount: 250.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2025-12-05', amount: 500.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2025-12-08', amount: 350.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2025-12-10', amount: 250.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2025-12-11', amount: 750.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2025-12-12', amount: 500.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2025-12-15', amount: 150.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2026-01-08', amount: 250.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2026-01-13', amount: 250.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2026-01-14', amount: 350.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2026-01-15', amount: 150.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2026-01-16', amount: 110.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2026-01-20', amount: 110.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2026-01-20', amount: 110.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2026-01-22', amount: 650.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2026-01-26', amount: 110.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2026-01-26', amount: 110.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2026-01-27', amount: 260.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2026-02-02', amount: 150.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2026-02-09', amount: 110.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2026-02-09', amount: 699.10, desc: 'Venmo cashout - William Gaylord', category: 'player_payments', method: 'venmo' },
  { date: '2026-02-17', amount: 150.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
  { date: '2026-02-23', amount: 200.00, desc: 'Intuit/QB payment deposit', category: 'player_payments', method: 'online' },
];

const interestDeposits = [
  { date: '2025-09-01', amount: 0.11 },
  { date: '2025-09-30', amount: 0.08 },
  { date: '2025-11-02', amount: 0.12 },
  { date: '2025-11-30', amount: 0.10 },
  { date: '2025-12-31', amount: 0.16 },
  { date: '2026-02-01', amount: 0.14 },
  { date: '2026-03-01', amount: 0.08 },
];

const withdrawals = [
  { date: '2025-08-01', amount: 30.00, desc: 'Byte Productions - website hosting', vendor: 'Byte Productions', category: 'administrative' },
  { date: '2025-08-21', amount: 115.00, desc: 'Intuit QuickBooks Online subscription', vendor: 'Intuit', category: 'administrative' },
  { date: '2025-08-26', amount: 375.00, desc: 'Venmo payment out', vendor: 'Venmo', category: 'other' },
  { date: '2025-09-02', amount: 30.00, desc: 'Byte Productions - website hosting', vendor: 'Byte Productions', category: 'administrative' },
  { date: '2025-09-02', amount: 400.00, desc: 'Venmo payment out', vendor: 'Venmo', category: 'other' },
  { date: '2025-09-02', amount: 400.00, desc: 'Venmo payment out', vendor: 'Venmo', category: 'other' },
  { date: '2025-09-03', amount: 1229.89, desc: 'PayPal transfer', vendor: 'PayPal', category: 'other' },
  { date: '2025-09-04', amount: 29.00, desc: 'Byte Productions', vendor: 'Byte Productions', category: 'administrative' },
  { date: '2025-09-04', amount: 1127.03, desc: 'SP TCK Sports - equipment/gear', vendor: 'TCK Sports', category: 'equipment' },
  { date: '2025-09-04', amount: 333.89, desc: 'Epic Sports - equipment/gear', vendor: 'Epic Sports', category: 'equipment' },
  { date: '2025-09-10', amount: 244.20, desc: 'Threads LLC - apparel', vendor: 'Threads LLC', category: 'uniforms' },
  { date: '2025-09-15', amount: 600.00, desc: 'Venmo payment out', vendor: 'Venmo', category: 'other' },
  { date: '2025-09-16', amount: 34.92, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2025-09-17', amount: 19.96, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2025-09-19', amount: 2109.26, desc: 'Boombah Inc - uniforms/equipment', vendor: 'Boombah', category: 'uniforms' },
  { date: '2025-09-19', amount: 7.48, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2025-09-22', amount: 7.48, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2025-09-22', amount: 14.96, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2025-09-22', amount: 14.96, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2025-09-24', amount: 115.00, desc: 'Intuit QuickBooks Online subscription', vendor: 'Intuit', category: 'administrative' },
  { date: '2025-09-26', amount: 14.96, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2025-09-29', amount: 7.48, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2025-09-29', amount: 14.96, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2025-09-30', amount: 7.48, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2025-10-01', amount: 422.10, desc: 'Threads LLC - apparel', vendor: 'Threads LLC', category: 'uniforms' },
  { date: '2025-10-01', amount: 30.00, desc: 'Byte Productions - website hosting', vendor: 'Byte Productions', category: 'administrative' },
  { date: '2025-10-06', amount: 288.69, desc: 'AllSportDesigns.com - apparel', vendor: 'AllSportDesigns', category: 'uniforms' },
  { date: '2025-10-06', amount: 7.48, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2025-10-10', amount: 25.00, desc: 'Threads LLC - apparel', vendor: 'Threads LLC', category: 'uniforms' },
  { date: '2025-10-16', amount: 32.00, desc: 'AllSportDesigns.com - apparel', vendor: 'AllSportDesigns', category: 'uniforms' },
  { date: '2025-10-21', amount: 115.00, desc: 'Intuit QuickBooks Online subscription', vendor: 'Intuit', category: 'administrative' },
  { date: '2025-10-28', amount: 78.36, desc: 'Blue Chip team registration', vendor: 'Blue Chip', category: 'tournaments' },
  { date: '2025-11-03', amount: 30.00, desc: 'Byte Productions - website hosting', vendor: 'Byte Productions', category: 'administrative' },
  { date: '2025-11-17', amount: 20.00, desc: 'MI Corporations Division - state filing', vendor: 'MI Corporations Division', category: 'administrative' },
  { date: '2025-11-17', amount: 20.00, desc: 'MI Corporations Division - state filing', vendor: 'MI Corporations Division', category: 'administrative' },
  { date: '2025-11-21', amount: 115.00, desc: 'Intuit QuickBooks Online subscription', vendor: 'Intuit', category: 'administrative' },
  { date: '2025-11-25', amount: 572.00, desc: 'MI Sports Academy - tournament/facility', vendor: 'MI Sports Academy', category: 'tournaments' },
  { date: '2025-11-25', amount: 572.00, desc: 'MI Sports Academy - tournament/facility', vendor: 'MI Sports Academy', category: 'tournaments' },
  { date: '2025-11-25', amount: 14.96, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2025-11-26', amount: 14.96, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2025-11-28', amount: 7.48, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2025-12-01', amount: 7.48, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2025-12-01', amount: 7.48, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2025-12-01', amount: 625.00, desc: 'Check #1076', vendor: 'Check 1076', category: 'other' },
  { date: '2025-12-01', amount: 1260.00, desc: 'Check #1077', vendor: 'Check 1077', category: 'other' },
  { date: '2025-12-02', amount: 14.96, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2025-12-03', amount: 5.49, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2025-12-04', amount: 7.48, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2025-12-05', amount: 14.96, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2025-12-08', amount: 10.47, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2025-12-10', amount: 7.48, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2025-12-11', amount: 22.44, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2025-12-12', amount: 14.96, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2025-12-12', amount: 650.00, desc: 'Check #1080', vendor: 'Check 1080', category: 'other' },
  { date: '2025-12-15', amount: 4.49, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2025-12-16', amount: 1050.00, desc: 'Check #1078', vendor: 'Check 1078', category: 'other' },
  { date: '2025-12-23', amount: 3000.00, desc: 'Check #1081', vendor: 'Check 1081', category: 'other' },
  { date: '2026-01-08', amount: 7.48, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2026-01-13', amount: 7.48, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2026-01-14', amount: 10.47, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2026-01-15', amount: 4.49, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2026-01-16', amount: 3.29, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2026-01-20', amount: 60.00, desc: 'Byte Productions - website hosting', vendor: 'Byte Productions', category: 'administrative' },
  { date: '2026-01-20', amount: 3.29, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2026-01-20', amount: 115.00, desc: 'Intuit QuickBooks Online subscription', vendor: 'Intuit', category: 'administrative' },
  { date: '2026-01-21', amount: 3.29, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2026-01-22', amount: 19.45, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2026-01-26', amount: 3.29, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2026-01-26', amount: 3.29, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2026-01-27', amount: 7.78, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2026-02-02', amount: 30.00, desc: 'Byte Productions - website hosting', vendor: 'Byte Productions', category: 'administrative' },
  { date: '2026-02-02', amount: 4.49, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2026-02-09', amount: 3.29, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2026-02-10', amount: 4165.00, desc: 'Check #1083', vendor: 'Check 1083', category: 'other' },
  { date: '2026-02-17', amount: 4.49, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
  { date: '2026-02-17', amount: 115.00, desc: 'Intuit QuickBooks Online subscription', vendor: 'Intuit', category: 'administrative' },
  { date: '2026-02-18', amount: 775.00, desc: 'Check #1084', vendor: 'Check 1084', category: 'other' },
  { date: '2026-02-23', amount: 2.00, desc: 'Intuit transaction fee', vendor: 'Intuit', category: 'processing_fees' },
];

const INCOME_CATEGORY_TO_ACCOUNT = {
  player_payments: '4000', sponsorships: '4100', fundraisers: '4200',
  donations: '4300', grants: '4400', merchandise: '4500',
  concessions: '4600', other: '4900',
};
const EXPENSE_CATEGORY_TO_ACCOUNT = {
  facilities: '5000', equipment: '5100', uniforms: '5200',
  tournaments: '5300', travel: '5400', insurance: '5500',
  league_fees: '5600', coaching: '5700', processing_fees: '5800',
  administrative: '6000', marketing: '6100', fundraising: '7000',
  maintenance: '5900', other: '5900',
};

async function deleteCollection(name) {
  const snap = await db.collection(name).get();
  if (snap.size === 0) return 0;
  let deleted = 0;
  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = snap.docs.slice(i, i + BATCH_SIZE);
    for (const d of chunk) batch.delete(d.ref);
    await batch.commit();
    deleted += chunk.length;
  }
  return deleted;
}

async function main() {
  console.log('=== CLEARING EXISTING FINANCIAL RECORDS ===');
  console.log('  Deleted income:', await deleteCollection('income'));
  console.log('  Deleted expenses:', await deleteCollection('expenses'));
  console.log('  Deleted GL entries:', await deleteCollection('generalLedger'));

  const coaSnap = await db.collection('chartOfAccounts').get();
  const acctMap = {};
  for (const d of coaSnap.docs) { const data = d.data(); acctMap[data.accountNumber] = { id: d.id, ...data }; }
  console.log('Chart of Accounts:', Object.keys(acctMap).length, 'accounts');

  let incCount = 0, totalInc = 0;
  console.log('\n=== IMPORTING DEPOSITS ===');
  for (const dep of deposits) {
    const date = new Date(dep.date + 'T12:00:00');
    const ref = await db.collection('income').add({
      date: Timestamp.fromDate(date), category: dep.category, amount: dep.amount,
      source: dep.desc, payerName: '', description: dep.desc, paymentMethod: dep.method,
      season: SEASON, reconciled: true, reconciledAt: Timestamp.now(),
      reconciledBy: 'bank_import', recordedBy: 'bank_import',
      notes: 'From bank statement', createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    });
    const rAcct = INCOME_CATEGORY_TO_ACCOUNT[dep.category] || '4900';
    if (acctMap['1000'] && acctMap[rAcct]) {
      const base = { date: Timestamp.fromDate(date), memo: dep.desc, sourceType: 'income',
        sourceId: ref.id, season: SEASON, createdBy: 'bank_import', createdAt: Timestamp.now() };
      await db.collection('generalLedger').add({ ...base, accountId: acctMap['1000'].id,
        accountNumber: '1000', accountName: acctMap['1000'].name, debit: dep.amount, credit: 0 });
      await db.collection('generalLedger').add({ ...base, accountId: acctMap[rAcct].id,
        accountNumber: rAcct, accountName: acctMap[rAcct].name, debit: 0, credit: dep.amount });
    }
    incCount++; totalInc += dep.amount;
  }
  for (const int of interestDeposits) {
    const date = new Date(int.date + 'T12:00:00');
    await db.collection('income').add({
      date: Timestamp.fromDate(date), category: 'other', amount: int.amount,
      source: 'Bank interest', payerName: 'Honor Bank', description: 'Interest deposit',
      paymentMethod: 'other', season: SEASON, reconciled: true, reconciledAt: Timestamp.now(),
      reconciledBy: 'bank_import', recordedBy: 'bank_import',
      notes: 'Bank interest', createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    });
    incCount++; totalInc += int.amount;
  }
  console.log('  Income records:', incCount, '| Total: $' + totalInc.toFixed(2));

  let expCount = 0, totalExp = 0;
  console.log('\n=== IMPORTING WITHDRAWALS ===');
  for (const w of withdrawals) {
    const date = new Date(w.date + 'T12:00:00');
    const ref = await db.collection('expenses').add({
      date: Timestamp.fromDate(date), category: w.category, amount: w.amount,
      vendor: w.vendor, description: w.desc, paymentMethod: 'debit_card',
      season: SEASON, isPaid: true, paidDate: Timestamp.fromDate(date),
      reconciled: true, reconciledAt: Timestamp.now(), reconciledBy: 'bank_import',
      recordedBy: 'bank_import', notes: 'From bank statement',
      createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    });
    const eAcct = EXPENSE_CATEGORY_TO_ACCOUNT[w.category] || '5900';
    if (acctMap[eAcct] && acctMap['1000']) {
      const base = { date: Timestamp.fromDate(date), memo: w.desc, sourceType: 'expense',
        sourceId: ref.id, season: SEASON, createdBy: 'bank_import', createdAt: Timestamp.now() };
      await db.collection('generalLedger').add({ ...base, accountId: acctMap[eAcct].id,
        accountNumber: eAcct, accountName: acctMap[eAcct].name, debit: w.amount, credit: 0 });
      await db.collection('generalLedger').add({ ...base, accountId: acctMap['1000'].id,
        accountNumber: '1000', accountName: acctMap['1000'].name, debit: 0, credit: w.amount });
    }
    expCount++; totalExp += w.amount;
  }
  console.log('  Expense records:', expCount, '| Total: $' + totalExp.toFixed(2));

  const net = totalInc - totalExp;
  console.log('\n=== SUMMARY ===');
  console.log('Total Income:   $' + totalInc.toFixed(2));
  console.log('Total Expenses: $' + totalExp.toFixed(2));
  console.log('Net Income:     $' + net.toFixed(2));
  console.log('Opening (8/1/25): $2,810.13');
  console.log('Expected balance: $' + (2810.13 + net).toFixed(2));
  console.log('Actual (3/1/26):  $2,545.00');

  const gl = await db.collection('generalLedger').get();
  console.log('GL entries:', gl.size);
  process.exit(0);
}
main().catch(function(e) { console.error(e); process.exit(1); });
