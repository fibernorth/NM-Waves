// Delete all existing invoice tokens and recreate from QuickBooks data
// Each QB invoice becomes an invoice token with exact date & amount
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

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
      if (!customers[currentCustomer]) customers[currentCustomer] = { invoices: [], payments: [] };
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
      if (!voided) {
        customers[currentCustomer].invoices.push({ date, number: txnNum, amount });
      }
    } else if (type === 'Payment') {
      customers[currentCustomer].payments.push({ date, amount });
    }
  }
  return customers;
}

async function main() {
  const csvPath = 'C:\\Users\\bill\\Downloads\\Northern Michigan Waves Inc_Invoices and Received Payments.csv';
  const qb = parseQBReport(csvPath);
  const skipCustomers = ['FiberNorth, Inc.', 'Feola Holdings', 'Yanska Investments'];

  // Load player finances for financeId/playerId lookup
  const pfSnap = await db.collection('playerFinances').get();
  const financeByName = new Map();
  for (const doc of pfSnap.docs) {
    const d = doc.data();
    financeByName.set((d.playerName || '').toLowerCase(), {
      financeId: doc.id,
      playerId: d.playerId,
      playerName: d.playerName,
      teamName: d.teamName || '',
      season: d.season || '2025-2026',
      registrationFee: d.registrationFee || 0,
      uniformCost: d.uniformCost || 0,
      tournamentFees: d.tournamentFees || 0,
      facilityFees: d.facilityFees || 0,
      equipmentFees: d.equipmentFees || 0,
      otherFees: d.otherFees || 0,
      scholarshipAmount: d.scholarshipAmount || 0,
      totalPaid: (d.payments || []).reduce((s, p) => s + (p.amount || 0), 0),
    });
  }

  // 1. Delete all existing invoice tokens
  console.log('=== Deleting existing invoice tokens ===');
  const existingSnap = await db.collection('invoiceTokens').get();
  const batch1Size = existingSnap.size;
  // Delete in batches of 500
  let delBatch = db.batch();
  let delCount = 0;
  for (const doc of existingSnap.docs) {
    delBatch.delete(doc.ref);
    delCount++;
    if (delCount % 400 === 0) {
      await delBatch.commit();
      delBatch = db.batch();
    }
  }
  if (delCount % 400 !== 0) await delBatch.commit();
  console.log('Deleted ' + batch1Size + ' existing tokens');

  // Reset invoice counter
  await db.collection('appSettings').doc('invoiceCounter').set({ year: 2026, count: 0 });
  let invoiceSeq = 0;

  // 2. Create new invoice tokens from QB data
  console.log('\n=== Creating invoice tokens from QB ===');
  let created = 0;

  for (const [customerName, qbData] of Object.entries(qb)) {
    if (skipCustomers.includes(customerName)) continue;
    if (customerName.includes('Tuesday') || customerName.includes('GMTZ')) continue;

    const fs = financeByName.get(customerName.toLowerCase());
    if (!fs) {
      console.log('SKIP (no finance record): ' + customerName);
      continue;
    }

    // Sort invoices by date
    const invoices = qbData.invoices.sort((a, b) => new Date(a.date) - new Date(b.date));
    // Sort payments by date
    const payments = qbData.payments.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Track remaining payments to apply against invoices
    let paymentPool = [...payments];

    for (const inv of invoices) {
      invoiceSeq++;
      const invoiceNumber = 'INV-2026-' + String(invoiceSeq).padStart(4, '0');
      const token = crypto.randomUUID();

      // Determine if this invoice is paid
      let remainingAmount = inv.amount;
      let paid = false;

      // Try to apply payments to this invoice
      for (let i = 0; i < paymentPool.length && remainingAmount > 0.01; i++) {
        const pmtDate = new Date(paymentPool[i].date);
        if (paymentPool[i].amount <= 0) continue;

        const applyAmount = Math.min(paymentPool[i].amount, remainingAmount);
        remainingAmount -= applyAmount;
        paymentPool[i] = { ...paymentPool[i], amount: paymentPool[i].amount - applyAmount };
      }

      if (remainingAmount < 0.01) paid = true;

      // Parse invoice date (MM/DD/YYYY format from QB)
      const [mm, dd, yyyy] = inv.date.split('/');
      const invDate = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
      const expiresAt = new Date(2026, 11, 31, 23, 59, 59);

      const tokenDoc = {
        financeId: fs.financeId,
        playerId: fs.playerId,
        playerName: fs.playerName,
        teamName: fs.teamName,
        season: fs.season,
        amountDue: inv.amount,
        chargeType: 'per_invoice',
        chargeLabel: 'QB Invoice #' + inv.number,
        chargeAmount: inv.amount,
        registrationFee: fs.registrationFee,
        uniformCost: fs.uniformCost,
        tournamentFees: fs.tournamentFees,
        facilityFees: fs.facilityFees,
        equipmentFees: fs.equipmentFees,
        otherFees: fs.otherFees,
        scholarshipAmount: fs.scholarshipAmount,
        totalPaid: fs.totalPaid,
        token,
        invoiceNumber,
        qbInvoiceNumber: inv.number,
        dueDate: admin.firestore.Timestamp.fromDate(invDate),
        paymentTerms: 'Net 30',
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        createdBy: 'qb_import',
        createdAt: admin.firestore.Timestamp.fromDate(invDate),
        used: paid,
        usedAt: paid ? admin.firestore.Timestamp.now() : null,
        usedBy: paid ? 'qb_import' : null,
      };

      // Remove null fields
      for (const [k, v] of Object.entries(tokenDoc)) {
        if (v === null) delete tokenDoc[k];
      }

      await db.collection('invoiceTokens').add(tokenDoc);
      created++;
      console.log('  ' + customerName + ': ' + invoiceNumber + ' (QB #' + inv.number + ') $' + inv.amount + ' [' + inv.date + ']' + (paid ? ' PAID' : ' OUTSTANDING'));
    }
  }

  // Update the counter
  await db.collection('appSettings').doc('invoiceCounter').set({ year: 2026, count: invoiceSeq });

  console.log('\nCreated ' + created + ' invoice tokens (counter at ' + invoiceSeq + ')');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
