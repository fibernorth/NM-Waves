// Reconcile QuickBooks Invoices & Payments report against Firestore
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

// Parse the QB CSV
function parseQBReport(csvPath) {
  const raw = fs.readFileSync(csvPath, 'utf8');
  const lines = raw.split('\n');

  const customers = {};
  let currentCustomer = null;

  for (const line of lines) {
    // Split CSV respecting quoted fields
    const cols = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { cols.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    cols.push(current.trim());

    // Skip header rows
    if (cols[0] === 'Invoices and Received Payments' || cols[0] === 'Northern Michigan Waves Inc' || cols[0] === '' && !cols[1]) continue;
    if (cols[0] === '' && cols[1] === 'Date') continue;

    // New customer name (first column has text, other columns empty or minimal)
    if (cols[0] && cols[0] !== '' && !cols[1]) {
      currentCustomer = cols[0].trim();
      if (!customers[currentCustomer]) {
        customers[currentCustomer] = { invoices: [], payments: [], credits: [], journalEntries: [] };
      }
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
      customers[currentCustomer].credits.push({ date, number: txnNum, amount });
    } else if (type === 'Journal Entry') {
      customers[currentCustomer].journalEntries.push({ date, memo, amount });
    }
  }

  return customers;
}

// Normalize name for matching to Firestore player IDs
function nameToId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

async function main() {
  const csvPath = path.resolve('C:\\Users\\bill\\Downloads\\Northern Michigan Waves Inc_Invoices and Received Payments.csv');
  const qb = parseQBReport(csvPath);

  // Load all player finances from Firestore
  const pfSnap = await db.collection('playerFinances').get();
  const firestoreByPlayer = new Map(); // playerName (lower) -> finance data
  const firestoreById = new Map();

  for (const doc of pfSnap.docs) {
    const d = doc.data();
    const payments = d.payments || [];
    const computedPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
    const computedOwed = (d.registrationFee||0)+(d.uniformCost||0)+(d.tournamentFees||0)+(d.facilityFees||0)+(d.equipmentFees||0)+(d.otherFees||0);
    const scholarship = d.scholarshipAmount || 0;
    const balance = computedOwed - computedPaid - scholarship;

    const entry = {
      id: doc.id,
      playerName: d.playerName,
      season: d.season,
      totalOwed: computedOwed,
      totalPaid: computedPaid,
      scholarship,
      balance,
      payments,
      registrationFee: d.registrationFee || 0,
      uniformCost: d.uniformCost || 0,
      tournamentFees: d.tournamentFees || 0,
      facilityFees: d.facilityFees || 0,
      equipmentFees: d.equipmentFees || 0,
      otherFees: d.otherFees || 0,
    };

    firestoreByPlayer.set((d.playerName || '').toLowerCase(), entry);
    firestoreById.set(doc.id, entry);
  }

  console.log('=== QuickBooks vs Firestore Reconciliation ===\n');

  let mismatches = 0;
  let matched = 0;
  const notInFirestore = [];
  const sponsors = [];

  for (const [customerName, data] of Object.entries(qb)) {
    // Skip sponsor/business entries
    if (['FiberNorth, Inc.', 'Feola Holdings', 'Yanska Investments'].includes(customerName)) {
      sponsors.push(customerName);
      continue;
    }

    // QB totals
    const qbInvoiced = data.invoices.filter(i => !i.voided).reduce((s, i) => s + i.amount, 0);
    const qbPaid = data.payments.reduce((s, p) => s + p.amount, 0);
    const qbCredits = data.credits.reduce((s, c) => s + Math.abs(c.amount), 0);
    const qbJournals = data.journalEntries.reduce((s, j) => s + j.amount, 0); // negative = credit
    const qbBalance = qbInvoiced - qbPaid - qbCredits + qbJournals; // journals are already negative

    // Find in Firestore
    const fsEntry = firestoreByPlayer.get(customerName.toLowerCase());

    if (!fsEntry) {
      notInFirestore.push(customerName);
      console.log(`NOT IN FIRESTORE: ${customerName}`);
      console.log(`  QB: invoiced=$${qbInvoiced.toFixed(2)} paid=$${qbPaid.toFixed(2)} credits=$${qbCredits.toFixed(2)} journals=$${qbJournals.toFixed(2)} balance=$${qbBalance.toFixed(2)}`);
      console.log('');
      mismatches++;
      continue;
    }

    // Compare
    const owedMatch = Math.abs(qbInvoiced - fsEntry.totalOwed) < 0.02;
    const paidDiff = qbPaid - fsEntry.totalPaid;
    const paidMatch = Math.abs(paidDiff) < 0.02;

    // For balance comparison, account for QB credits and journal entries (scholarships/sponsorships)
    const qbEffectiveBalance = qbBalance;
    const fsBalance = fsEntry.balance;
    const balanceMatch = Math.abs(qbEffectiveBalance - fsBalance) < 0.02;

    if (!owedMatch || !paidMatch || !balanceMatch) {
      mismatches++;
      console.log(`MISMATCH: ${customerName}`);
      if (!owedMatch) console.log(`  Total Invoiced: QB=$${qbInvoiced.toFixed(2)} vs FS=$${fsEntry.totalOwed.toFixed(2)} (diff: $${(qbInvoiced - fsEntry.totalOwed).toFixed(2)})`);
      if (!paidMatch) console.log(`  Total Paid: QB=$${qbPaid.toFixed(2)} vs FS=$${fsEntry.totalPaid.toFixed(2)} (diff: $${paidDiff.toFixed(2)})`);
      if (!balanceMatch) console.log(`  Balance: QB=$${qbEffectiveBalance.toFixed(2)} vs FS=$${fsBalance.toFixed(2)} (diff: $${(qbEffectiveBalance - fsBalance).toFixed(2)})`);
      if (qbCredits > 0) console.log(`  QB Credits: $${qbCredits.toFixed(2)}`);
      if (qbJournals !== 0) console.log(`  QB Journal Entries: $${qbJournals.toFixed(2)} (sponsorship/credit)`);
      if (fsEntry.scholarship > 0) console.log(`  FS Scholarship: $${fsEntry.scholarship.toFixed(2)}`);

      // Show QB detail
      console.log('  QB Invoices:');
      for (const inv of data.invoices) {
        console.log(`    #${inv.number}: $${inv.amount.toFixed(2)} (${inv.date})${inv.voided ? ' VOIDED' : ''}`);
      }
      console.log('  QB Payments:');
      for (const pay of data.payments) {
        console.log(`    $${pay.amount.toFixed(2)} (${pay.date}) ${pay.memo || ''} ${pay.ref || ''}`);
      }
      console.log('  FS Fees: reg=$' + fsEntry.registrationFee + ' uni=$' + fsEntry.uniformCost + ' tourn=$' + fsEntry.tournamentFees + ' fac=$' + fsEntry.facilityFees + ' equip=$' + fsEntry.equipmentFees + ' other=$' + fsEntry.otherFees);
      console.log('  FS Payments (' + fsEntry.payments.length + '):');
      for (const p of fsEntry.payments) {
        console.log('    $' + p.amount + ' (' + p.method + ') ' + (p.reference || ''));
      }
      console.log('');
    } else {
      matched++;
    }
  }

  // Check for FS players not in QB
  console.log('=== Firestore players not in QB report ===\n');
  const qbNames = new Set(Object.keys(qb).map(n => n.toLowerCase()));
  for (const [name, entry] of firestoreByPlayer) {
    if (!qbNames.has(name)) {
      console.log(`  ${entry.playerName} (${entry.season}): owed=$${entry.totalOwed} paid=$${entry.totalPaid} balance=$${entry.balance}`);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`QB customers (players): ${Object.keys(qb).length - sponsors.length}`);
  console.log(`Firestore records: ${pfSnap.size}`);
  console.log(`Matched perfectly: ${matched}`);
  console.log(`Mismatches: ${mismatches}`);
  console.log(`Not in Firestore: ${notInFirestore.length} (${notInFirestore.join(', ')})`);
  console.log(`Sponsors skipped: ${sponsors.join(', ')}`);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
