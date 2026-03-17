// Reconcile Open Pledges report against current Firestore data
// Adds missing invoices and fixes balances
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

function parseOpenPledges(csvPath) {
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

    if (cols[0] && cols[0].startsWith('Open Pledges')) continue;
    if (cols[0] && cols[0].startsWith('Northern Michigan')) continue;
    if (cols[0] && cols[0].startsWith('As of')) continue;
    if (cols[0] === '' && cols[1] === 'Date') continue;
    if (cols[0] && cols[0].startsWith('Total for')) continue;
    if (cols[0] && cols[0] === ',TOTAL') continue;
    if (!cols[1] && !cols[2]) {
      if (cols[0] && cols[0].trim() && !cols[0].includes('TOTAL') && !cols[0].includes('Tuesday')) {
        currentCustomer = cols[0].trim();
        if (!customers[currentCustomer]) customers[currentCustomer] = { invoices: [], credits: [] };
      }
      continue;
    }

    if (!currentCustomer) continue;

    const date = cols[1];
    const type = cols[2];
    const num = cols[3] || '';
    const term = cols[4] || '';
    const dueDate = cols[5] || '';
    const amountStr = (cols[6] || '').replace(/,/g, '').replace('$', '');
    const amount = parseFloat(amountStr) || 0;

    if (!date || !type) continue;

    if (type === 'Invoice') {
      customers[currentCustomer].invoices.push({ date, number: num, term, dueDate, amount });
    } else if (type === 'Payment') {
      customers[currentCustomer].credits.push({ date, number: num, amount }); // negative = credit
    }
  }
  return customers;
}

async function main() {
  const csvPath = 'C:\\Users\\bill\\Downloads\\Northern Michigan Waves Inc_Open Pledges Report.csv';
  const pledges = parseOpenPledges(csvPath);

  console.log('=== Open Pledges from QB ===\n');
  for (const [name, data] of Object.entries(pledges)) {
    const invTotal = data.invoices.reduce((s, i) => s + i.amount, 0);
    const creditTotal = data.credits.reduce((s, c) => s + c.amount, 0);
    console.log(name + ': ' + data.invoices.length + ' invoices ($' + invTotal.toFixed(2) + ') + credits ($' + creditTotal.toFixed(2) + ') = $' + (invTotal + creditTotal).toFixed(2));
  }

  // Load Firestore finance records
  const pfSnap = await db.collection('playerFinances').get();
  const financeByName = new Map();
  for (const doc of pfSnap.docs) {
    const d = doc.data();
    financeByName.set((d.playerName || '').toLowerCase(), { ref: doc.ref, id: doc.id, data: d });
  }

  // Load existing invoice tokens to avoid duplicates
  const tokSnap = await db.collection('invoiceTokens').get();
  const existingQBNums = new Set();
  for (const doc of tokSnap.docs) {
    const d = doc.data();
    if (d.qbInvoiceNumber) existingQBNums.add(d.qbInvoiceNumber);
  }

  // Get current invoice counter
  const counterRef = db.collection('appSettings').doc('invoiceCounter');
  const counterDoc = await counterRef.get();
  let invoiceSeq = counterDoc.exists ? (counterDoc.data().count || 0) : 0;

  console.log('\n=== Syncing to Firestore ===\n');
  let invoicesCreated = 0;
  let financesUpdated = 0;

  for (const [customerName, qbData] of Object.entries(pledges)) {
    if (customerName.includes('Tuesday') || customerName.includes('GMTZ')) continue;

    const fsEntry = financeByName.get(customerName.toLowerCase());
    if (!fsEntry) {
      console.log('SKIP (not in Firestore): ' + customerName);
      continue;
    }

    const d = fsEntry.data;
    const qbOpenBalance = qbData.invoices.reduce((s, i) => s + i.amount, 0) + qbData.credits.reduce((s, c) => s + c.amount, 0);

    // Current FS balance
    const payments = d.payments || [];
    const fsPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
    const fsOwed = (d.registrationFee||0)+(d.uniformCost||0)+(d.tournamentFees||0)+(d.facilityFees||0)+(d.equipmentFees||0)+(d.otherFees||0);
    const fsScholarship = d.scholarshipAmount || 0;
    const fsBalance = fsOwed - fsPaid - fsScholarship;

    // The QB open balance should match: totalOwed - totalPaid - scholarship = qbOpenBalance
    // So: totalOwed = qbOpenBalance + totalPaid + scholarship
    const targetOwed = qbOpenBalance + fsPaid + fsScholarship;
    const targetOtherFees = Math.max(0, targetOwed - (d.registrationFee||0) - (d.uniformCost||0) - (d.tournamentFees||0) - (d.facilityFees||0) - (d.equipmentFees||0));

    if (Math.abs(fsBalance - qbOpenBalance) > 0.02 || Math.abs((d.otherFees||0) - targetOtherFees) > 0.02) {
      console.log(customerName + ':');
      console.log('  QB open balance: $' + qbOpenBalance.toFixed(2) + ' | FS balance: $' + fsBalance.toFixed(2));
      console.log('  otherFees: $' + (d.otherFees||0) + ' -> $' + targetOtherFees);
      console.log('  New total: owed=$' + targetOwed + ' paid=$' + fsPaid + ' scholarship=$' + fsScholarship + ' balance=$' + qbOpenBalance);

      await fsEntry.ref.update({
        otherFees: targetOtherFees,
        totalOwed: targetOwed,
        balanceDue: qbOpenBalance,
        updatedAt: admin.firestore.Timestamp.now(),
      });
      financesUpdated++;
    }

    // Create invoice tokens for outstanding QB invoices not already in Firestore
    for (const inv of qbData.invoices) {
      if (existingQBNums.has(inv.number)) continue;

      invoiceSeq++;
      const invoiceNumber = 'INV-2026-' + String(invoiceSeq).padStart(4, '0');
      const token = crypto.randomUUID();

      const [mm, dd, yyyy] = inv.date.split('/');
      const invDate = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));

      let dueDateObj = new Date(2026, 11, 31);
      if (inv.dueDate) {
        const [dmm, ddd, dyyyy] = inv.dueDate.split('/');
        dueDateObj = new Date(parseInt(dyyyy), parseInt(dmm) - 1, parseInt(ddd));
      }

      const expiresAt = new Date(2026, 11, 31, 23, 59, 59);

      await db.collection('invoiceTokens').add({
        financeId: fsEntry.id,
        playerId: d.playerId,
        playerName: d.playerName,
        teamName: d.teamName || '',
        season: d.season || '2025-2026',
        amountDue: inv.amount,
        chargeType: 'per_invoice',
        chargeLabel: 'QB Invoice #' + inv.number,
        chargeAmount: inv.amount,
        registrationFee: d.registrationFee || 0,
        uniformCost: d.uniformCost || 0,
        tournamentFees: d.tournamentFees || 0,
        facilityFees: d.facilityFees || 0,
        equipmentFees: d.equipmentFees || 0,
        otherFees: targetOtherFees,
        scholarshipAmount: d.scholarshipAmount || 0,
        totalPaid: fsPaid,
        token,
        invoiceNumber,
        qbInvoiceNumber: inv.number,
        dueDate: admin.firestore.Timestamp.fromDate(dueDateObj),
        paymentTerms: inv.term || 'Net 30',
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        createdBy: 'qb_import',
        createdAt: admin.firestore.Timestamp.fromDate(invDate),
        used: false,
      });

      existingQBNums.add(inv.number);
      invoicesCreated++;
      console.log('  + Invoice ' + invoiceNumber + ' (QB #' + inv.number + ') $' + inv.amount + ' due ' + (inv.dueDate || 'N/A'));
    }
  }

  // Update counter
  await counterRef.set({ year: 2026, count: invoiceSeq }, { merge: true });

  // Fix Skylar Yanska - she has $750 open, so she's NOT fully sponsored
  const skylarEntry = financeByName.get('skylar yanska');
  if (skylarEntry && skylarEntry.data.scholarshipAmount > 0) {
    console.log('\nFixing Skylar Yanska: removing incorrect scholarship of $' + skylarEntry.data.scholarshipAmount);
    const sd = skylarEntry.data;
    const sOwed = (sd.registrationFee||0)+(sd.uniformCost||0)+(sd.tournamentFees||0)+(sd.facilityFees||0)+(sd.equipmentFees||0)+(sd.otherFees||0);
    const sPaid = (sd.payments||[]).reduce((s, p) => s + (p.amount || 0), 0);
    await skylarEntry.ref.update({
      scholarshipAmount: 0,
      balanceDue: sOwed - sPaid,
      updatedAt: admin.firestore.Timestamp.now(),
    });
    console.log('  Skylar: owed=$' + sOwed + ' paid=$' + sPaid + ' scholarship=$0 balance=$' + (sOwed - sPaid));
  }

  console.log('\n=== Summary ===');
  console.log('Finance records updated: ' + financesUpdated);
  console.log('Invoice tokens created: ' + invoicesCreated);
  console.log('Invoice counter now at: ' + invoiceSeq);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
