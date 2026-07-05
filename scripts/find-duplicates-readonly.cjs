/**
 * READ-ONLY duplicate hunter. Makes NO writes. Scans expenses, income, and the
 * general ledger for likely duplicate entries (same date + amount + account/
 * category + description) and prints candidate groups plus the excess dollars.
 * Nothing is deleted or modified — this only reports so a human can review
 * before any cleanup.
 *
 * Usage (project root, needs serviceAccountKey.json):
 *   node scripts/find-duplicates-readonly.cjs
 */
const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

const money = (n) => `$${(Math.round((n + Number.EPSILON) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const asDate = (v) => {
  try {
    if (!v) return '';
    if (v.toDate) return v.toDate().toISOString().slice(0, 10);
    if (typeof v === 'string') return v.slice(0, 10);
    if (v._seconds) return new Date(v._seconds * 1000).toISOString().slice(0, 10);
  } catch (_) {}
  return '';
};

async function scanCollection(name, signatureFn, describeFn) {
  const snap = await db.collection(name).get();
  const groups = new Map(); // signature -> [{id, ...}]
  for (const doc of snap.docs) {
    const d = doc.data();
    const sig = signatureFn(d);
    if (sig == null) continue;
    if (!groups.has(sig)) groups.set(sig, []);
    groups.get(sig).push({ id: doc.id, data: d });
  }

  const dupes = [...groups.entries()].filter(([, arr]) => arr.length > 1);
  let excess = 0;
  let excessCount = 0;

  console.log(`\n========================================================`);
  console.log(` ${name.toUpperCase()} — ${snap.size} records, ${dupes.length} duplicate group(s)`);
  console.log(`========================================================`);
  // Sort groups by excess dollars descending
  dupes.sort((a, b) => {
    const av = Math.abs(amountOf(a[1][0].data)) * (a[1].length - 1);
    const bv = Math.abs(amountOf(b[1][0].data)) * (b[1].length - 1);
    return bv - av;
  });
  for (const [, arr] of dupes) {
    const amt = amountOf(arr[0].data);
    const dupExtra = arr.length - 1;
    excess += Math.abs(amt) * dupExtra;
    excessCount += dupExtra;
    console.log(`\n  x${arr.length}  ${describeFn(arr[0].data)}`);
    for (const item of arr) {
      console.log(`        id=${item.id}  ${money(amountOf(item.data))}`);
    }
  }
  console.log(`\n  >> ${name}: ${excessCount} extra copies, ${money(excess)} of likely duplicate value`);
  return { excess, excessCount };
}

function amountOf(d) {
  if (typeof d.amount === 'number') return d.amount;
  if (typeof d.debit === 'number' && d.debit) return d.debit;
  if (typeof d.credit === 'number' && d.credit) return d.credit;
  return 0;
}

async function main() {
  console.log('==================================================================');
  console.log(' NM WAVES — READ-ONLY DUPLICATE HUNT (no writes performed)');
  console.log('==================================================================');

  // EXPENSES: same date + amount + category + vendor/description
  const exp = await scanCollection(
    'expenses',
    (d) => `${asDate(d.date)}|${(d.amount||0).toFixed(2)}|${d.category||''}|${(d.vendor||d.description||'').trim().toLowerCase()}`,
    (d) => `${asDate(d.date)}  ${money(d.amount||0)}  [${d.category||'?'}]  ${d.vendor||d.description||''}`
  );

  // INCOME: same date + amount + category + source/payer
  const inc = await scanCollection(
    'income',
    (d) => `${asDate(d.date)}|${(d.amount||0).toFixed(2)}|${d.category||''}|${(d.source||d.payerName||d.description||'').trim().toLowerCase()}`,
    (d) => `${asDate(d.date)}  ${money(d.amount||0)}  [${d.category||'?'}]  ${d.source||d.payerName||d.description||''}`
  );

  // GENERAL LEDGER: same date + account + debit/credit amount + description
  const gl = await scanCollection(
    'generalLedger',
    (d) => {
      let dr = 0, cr = 0;
      if (typeof d.debit === 'number' || typeof d.credit === 'number') { dr = d.debit||0; cr = d.credit||0; }
      else if (d.type === 'debit') dr = d.amount||0;
      else if (d.type === 'credit') cr = d.amount||0;
      return `${asDate(d.date)}|${d.accountNumber||''}|${dr.toFixed(2)}|${cr.toFixed(2)}|${(d.description||d.memo||'').trim().toLowerCase()}`;
    },
    (d) => `${asDate(d.date)}  ${d.accountNumber||'?'} ${d.accountName||''}  ${money(amountOf(d))}  ${d.description||d.memo||''}`
  );

  console.log('\n==================================================================');
  console.log(' SUMMARY (candidates for review — NOT auto-removed)');
  console.log('==================================================================');
  console.log(`  Expenses excess:       ${money(exp.excess)} (${exp.excessCount} extra copies)`);
  console.log(`  Income excess:         ${money(inc.excess)} (${inc.excessCount} extra copies)`);
  console.log(`  General Ledger excess: ${money(gl.excess)} (${gl.excessCount} extra copies)`);
  console.log('\n  Nothing was written. Review the groups above before any cleanup.');
  console.log('==================================================================');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
