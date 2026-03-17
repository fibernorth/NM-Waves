// Final reconciliation: compare ALL Firestore playerFinances against both QB reports
// - Invoices and Received Payments (shows invoiced totals, payments, journal entries)
// - Open Pledges (shows outstanding balances)
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

function parseCSV(csvPath) {
  const raw = fs.readFileSync(csvPath, 'utf8');
  const lines = raw.split('\n');
  const result = [];
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
    result.push(cols);
  }
  return result;
}

function parseInvoicesAndPayments(csvPath) {
  const lines = parseCSV(csvPath);
  const customers = {};
  let currentCustomer = null;

  for (const cols of lines) {
    if (cols[0] && (cols[0].startsWith('Invoices and Received') || cols[0].startsWith('Northern Michigan') || cols[0].startsWith('As of'))) continue;
    if (cols[0] === '' && cols[1] === 'Type') continue;
    if (cols[0] && cols[0].startsWith('Total for')) continue;
    if (cols[0] === ',TOTAL') continue;

    if (!cols[1] && !cols[2]) {
      if (cols[0] && cols[0].trim() && !cols[0].includes('TOTAL') && !cols[0].includes('Tuesday') && !cols[0].includes('GMTZ')) {
        currentCustomer = cols[0].trim();
        if (!customers[currentCustomer]) customers[currentCustomer] = { invoiced: 0, paid: 0, credits: 0, journalEntries: 0 };
      }
      continue;
    }
    if (!currentCustomer) continue;

    const type = cols[1];
    const amountStr = (cols[5] || '').replace(/,/g, '').replace('$', '');
    const amount = parseFloat(amountStr) || 0;

    if (type === 'Invoice') customers[currentCustomer].invoiced += amount;
    else if (type === 'Payment') customers[currentCustomer].paid += Math.abs(amount);
    else if (type === 'Credit Memo') customers[currentCustomer].credits += Math.abs(amount);
    else if (type === 'Journal Entry') customers[currentCustomer].journalEntries += Math.abs(amount);
  }
  return customers;
}

function parseOpenPledges(csvPath) {
  const lines = parseCSV(csvPath);
  const customers = {};
  let currentCustomer = null;

  for (const cols of lines) {
    if (cols[0] && (cols[0].startsWith('Open Pledges') || cols[0].startsWith('Northern Michigan') || cols[0].startsWith('As of'))) continue;
    if (cols[0] === '' && cols[1] === 'Date') continue;
    if (cols[0] && cols[0].startsWith('Total for')) continue;
    if (cols[0] === ',TOTAL') continue;

    if (!cols[1] && !cols[2]) {
      if (cols[0] && cols[0].trim() && !cols[0].includes('TOTAL') && !cols[0].includes('Tuesday') && !cols[0].includes('GMTZ')) {
        currentCustomer = cols[0].trim();
        if (!customers[currentCustomer]) customers[currentCustomer] = { openBalance: 0, invoices: [] };
      }
      continue;
    }
    if (!currentCustomer) continue;

    const type = cols[2];
    const amountStr = (cols[6] || '').replace(/,/g, '').replace('$', '');
    const amount = parseFloat(amountStr) || 0;

    if (type === 'Invoice') {
      customers[currentCustomer].openBalance += amount;
      customers[currentCustomer].invoices.push({ num: cols[3], amount });
    } else if (type === 'Payment') {
      customers[currentCustomer].openBalance += amount; // negative
    }
  }
  return customers;
}

async function main() {
  const invPayPath = 'C:\\Users\\bill\\Downloads\\Northern Michigan Waves Inc_Invoices and Received Payments.csv';
  const openPledgesPath = 'C:\\Users\\bill\\Downloads\\Northern Michigan Waves Inc_Open Pledges Report.csv';

  const invPay = parseInvoicesAndPayments(invPayPath);
  const openPledges = parseOpenPledges(openPledgesPath);

  // Merge: QB truth = open pledges balance (if exists), otherwise invoiced - paid - credits - journalEntries
  const qbCustomers = new Map();
  for (const [name, data] of Object.entries(invPay)) {
    const op = openPledges[name];
    const balance = op ? op.openBalance : (data.invoiced - data.paid - data.credits - data.journalEntries);
    const scholarship = data.journalEntries || 0;
    qbCustomers.set(name.toLowerCase(), {
      name,
      invoiced: data.invoiced,
      paid: data.paid,
      credits: data.credits,
      scholarship,
      openBalance: balance,
    });
  }
  // Add open-pledges-only customers
  for (const [name, data] of Object.entries(openPledges)) {
    if (!qbCustomers.has(name.toLowerCase())) {
      qbCustomers.set(name.toLowerCase(), {
        name,
        invoiced: data.openBalance,
        paid: 0,
        credits: 0,
        scholarship: 0,
        openBalance: data.openBalance,
      });
    }
  }

  // Load Firestore
  const pfSnap = await db.collection('playerFinances').get();
  const fsByName = new Map();
  for (const doc of pfSnap.docs) {
    const d = doc.data();
    const key = (d.playerName || '').toLowerCase();
    const owed = (d.registrationFee||0)+(d.uniformCost||0)+(d.tournamentFees||0)+(d.facilityFees||0)+(d.equipmentFees||0)+(d.otherFees||0);
    const paid = (d.payments||[]).reduce((s, p) => s + (p.amount || 0), 0);
    const scholarship = d.scholarshipAmount || 0;
    const balance = owed - paid - scholarship;
    fsByName.set(key, { id: doc.id, playerName: d.playerName, owed, paid, scholarship, balance, data: d });
  }

  // Load invoice tokens
  const tokSnap = await db.collection('invoiceTokens').get();
  const tokensByPlayer = new Map();
  for (const doc of tokSnap.docs) {
    const d = doc.data();
    const key = (d.playerName || '').toLowerCase();
    if (!tokensByPlayer.has(key)) tokensByPlayer.set(key, []);
    tokensByPlayer.get(key).push({ id: doc.id, ...d });
  }

  console.log('=== FINAL RECONCILIATION ===\n');

  let matches = 0;
  let mismatches = 0;
  const issues = [];

  for (const [key, qb] of qbCustomers) {
    const fs = fsByName.get(key);
    if (!fs) {
      issues.push('NOT IN FIRESTORE: ' + qb.name + ' (QB balance: $' + qb.openBalance.toFixed(2) + ')');
      mismatches++;
      continue;
    }

    // Only compare balances - scholarship tracking differs between QB (journal entries) and FS (payments)
    const fsBalance = Math.max(0, fs.balance); // treat negative balance as $0 (credit/overpayment)
    const qbBalance = Math.max(0, qb.openBalance);
    const balanceDiff = Math.abs(fsBalance - qbBalance);

    if (balanceDiff > 0.02) {
      issues.push(
        'MISMATCH: ' + qb.name +
        '\n  QB: invoiced=$' + qb.invoiced.toFixed(2) + ' paid=$' + qb.paid.toFixed(2) + ' scholarship=$' + qb.scholarship.toFixed(2) + ' balance=$' + qb.openBalance.toFixed(2) +
        '\n  FS: owed=$' + fs.owed.toFixed(2) + ' paid=$' + fs.paid.toFixed(2) + ' scholarship=$' + fs.scholarship.toFixed(2) + ' balance=$' + fs.balance.toFixed(2)
      );
      mismatches++;
    } else {
      matches++;
      console.log('OK: ' + qb.name + ' ($' + qb.openBalance.toFixed(2) + ')');
    }

    // Check invoice token count for players in open pledges
    const op = openPledges[qb.name];
    if (op && op.invoices.length > 0) {
      const tokens = tokensByPlayer.get(key) || [];
      const outstandingTokens = tokens.filter(t => !t.used);
      // Check that open QB invoices have corresponding tokens
      for (const inv of op.invoices) {
        const hasToken = tokens.some(t => t.qbInvoiceNumber === inv.num);
        if (!hasToken) {
          issues.push('  MISSING TOKEN: ' + qb.name + ' QB #' + inv.num + ' $' + inv.amount);
        }
      }
    }
  }

  // Check for FS records not in QB (orphans)
  for (const [key, fs] of fsByName) {
    if (!qbCustomers.has(key) && fs.balance !== 0) {
      // Only flag if they have a non-zero balance
      console.log('NOTE: ' + fs.playerName + ' in FS but not in QB (balance=$' + fs.balance.toFixed(2) + ')');
    }
  }

  if (issues.length > 0) {
    console.log('\n=== ISSUES ===\n');
    for (const issue of issues) {
      console.log(issue);
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log('Matched: ' + matches);
  console.log('Mismatches: ' + mismatches);
  console.log('Total QB customers: ' + qbCustomers.size);
  console.log('Total FS records: ' + fsByName.size);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
