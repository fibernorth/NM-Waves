// Sync Firestore playerFinances to match QuickBooks report exactly
// Updates otherFees so total charges match QB invoiced amounts
// For sponsored players (journal entries), applies scholarship
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

function parseQBReport(csvPath) {
  const raw = fs.readFileSync(csvPath, 'utf8');
  const lines = raw.split('\n');
  const customers = {};
  let currentCustomer = null;

  for (const line of lines) {
    const cols = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { cols.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    cols.push(current.trim());

    if (cols[0] === 'Invoices and Received Payments' || cols[0] === 'Northern Michigan Waves Inc' || (cols[0] === '' && !cols[1])) continue;
    if (cols[0] === '' && cols[1] === 'Date') continue;

    if (cols[0] && cols[0] !== '' && !cols[1]) {
      currentCustomer = cols[0].trim();
      if (!customers[currentCustomer]) customers[currentCustomer] = { invoices: [], payments: [], credits: [], journalEntries: [] };
      continue;
    }
    if (!currentCustomer) continue;

    const date = cols[1];
    const type = cols[2];
    const memo = cols[3] || '';
    const txnNum = cols[4] || '';
    const amountStr = (cols[5] || '').replace(/,/g, '');
    const amount = parseFloat(amountStr) || 0;
    if (!date || !type) continue;

    if (type === 'Invoice') {
      const voided = memo.toLowerCase().includes('voided');
      customers[currentCustomer].invoices.push({ date, number: txnNum, amount, voided });
    } else if (type === 'Payment') {
      customers[currentCustomer].payments.push({ date, memo, ref: txnNum, amount });
    } else if (type === 'Credit Memo') {
      customers[currentCustomer].credits.push({ date, number: txnNum, amount: Math.abs(amount) });
    } else if (type === 'Journal Entry') {
      customers[currentCustomer].journalEntries.push({ date, memo, amount: Math.abs(amount) });
    }
  }
  return customers;
}

async function main() {
  const csvPath = 'C:\\Users\\bill\\Downloads\\Northern Michigan Waves Inc_Invoices and Received Payments.csv';
  const qb = parseQBReport(csvPath);

  const pfSnap = await db.collection('playerFinances').get();
  const firestoreByName = new Map();
  for (const doc of pfSnap.docs) {
    const d = doc.data();
    firestoreByName.set((d.playerName || '').toLowerCase(), { ref: doc.ref, id: doc.id, data: d });
  }

  const skipCustomers = ['FiberNorth, Inc.', 'Feola Holdings', 'Yanska Investments'];
  let updated = 0;
  let skipped = 0;

  for (const [customerName, qbData] of Object.entries(qb)) {
    if (skipCustomers.includes(customerName)) continue;
    if (customerName.includes('Tuesday') || customerName.includes('GMTZ')) continue;

    const fsEntry = firestoreByName.get(customerName.toLowerCase());
    if (!fsEntry) {
      console.log('SKIP (not in Firestore): ' + customerName);
      skipped++;
      continue;
    }

    const d = fsEntry.data;

    // QB totals
    const qbInvoiced = qbData.invoices.filter(i => !i.voided).reduce((s, i) => s + i.amount, 0);
    const qbPaid = qbData.payments.reduce((s, p) => s + p.amount, 0);
    const qbCredits = qbData.credits.reduce((s, c) => s + c.amount, 0);
    const qbJournals = qbData.journalEntries.reduce((s, j) => s + j.amount, 0); // sponsorship credits

    // Current FS totals
    const fsPaid = (d.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
    const fsOwed = (d.registrationFee||0) + (d.uniformCost||0) + (d.tournamentFees||0) + (d.facilityFees||0) + (d.equipmentFees||0) + (d.otherFees||0);
    const fsScholarship = d.scholarshipAmount || 0;

    // Target: totalOwed should equal QB invoiced total
    // Registration fee stays as-is (always $100 in QB)
    // otherFees = QB invoiced - registrationFee - other named fees
    const regFee = d.registrationFee || 0;
    const namedFees = (d.uniformCost||0) + (d.tournamentFees||0) + (d.facilityFees||0) + (d.equipmentFees||0);
    const targetOtherFees = Math.max(0, qbInvoiced - regFee - namedFees);

    // Scholarship = QB journal entries (sponsorship credits) + QB credit memos
    const targetScholarship = qbJournals + qbCredits;

    // Check if anything needs updating
    const otherFeesChanged = Math.abs(targetOtherFees - (d.otherFees || 0)) > 0.01;
    const scholarshipChanged = Math.abs(targetScholarship - fsScholarship) > 0.01;

    // Also verify payments match
    const paidDiff = Math.abs(qbPaid - fsPaid);
    const paidMatch = paidDiff < 0.02;

    if (!otherFeesChanged && !scholarshipChanged && paidMatch) {
      // Already correct
      continue;
    }

    const newOwed = regFee + namedFees + targetOtherFees;
    const newBalance = newOwed - fsPaid - targetScholarship;

    console.log(customerName + ':');
    if (otherFeesChanged) console.log('  otherFees: $' + (d.otherFees||0) + ' -> $' + targetOtherFees);
    if (scholarshipChanged) console.log('  scholarship: $' + fsScholarship + ' -> $' + targetScholarship);
    if (!paidMatch) console.log('  WARNING: payments differ (QB=$' + qbPaid + ' FS=$' + fsPaid + ') - NOT auto-fixing payments');
    console.log('  New total: owed=$' + newOwed + ' paid=$' + fsPaid + ' scholarship=$' + targetScholarship + ' balance=$' + newBalance);

    const updateData = {
      otherFees: targetOtherFees,
      scholarshipAmount: targetScholarship,
      totalOwed: newOwed,
      totalPaid: fsPaid,
      balanceDue: newBalance,
      updatedAt: admin.firestore.Timestamp.now(),
    };

    await fsEntry.ref.update(updateData);
    updated++;
  }

  console.log('\nUpdated: ' + updated + ' | Skipped: ' + skipped);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
