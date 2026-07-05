/**
 * Deduplicate exact-duplicate records created by a double-import. Keeps ONE
 * copy of each identical entry and removes the extras. SAFE BY DEFAULT:
 *   - Dry run unless you pass --apply
 *   - Before deleting, writes a full JSON backup of every removed doc
 *   - Idempotent: once duplicates are gone, re-running does nothing
 *
 * "Identical" signature:
 *   expenses      -> date + amount + category + (vendor|description)
 *   generalLedger -> date + accountNumber + debit + credit + (description|memo)
 * Only rows whose ENTIRE signature matches collapse together, so distinct
 * transactions that merely share an amount are never touched.
 *
 * Usage (project root, needs serviceAccountKey.json):
 *   node scripts/dedupe-transactions.cjs generalLedger            # dry run
 *   node scripts/dedupe-transactions.cjs generalLedger --apply    # delete + backup
 *   node scripts/dedupe-transactions.cjs expenses --apply
 */
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

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

function amountOf(d) {
  if (typeof d.amount === 'number') return d.amount;
  if (typeof d.debit === 'number' && d.debit) return d.debit;
  if (typeof d.credit === 'number' && d.credit) return d.credit;
  return 0;
}

function signature(collection, d) {
  if (collection === 'expenses') {
    return `${asDate(d.date)}|${(d.amount || 0).toFixed(2)}|${d.category || ''}|${(d.vendor || d.description || '').trim().toLowerCase()}`;
  }
  // generalLedger
  let dr = 0, cr = 0;
  if (typeof d.debit === 'number' || typeof d.credit === 'number') { dr = d.debit || 0; cr = d.credit || 0; }
  else if (d.type === 'debit') dr = d.amount || 0;
  else if (d.type === 'credit') cr = d.amount || 0;
  return `${asDate(d.date)}|${d.accountNumber || ''}|${dr.toFixed(2)}|${cr.toFixed(2)}|${(d.description || d.memo || '').trim().toLowerCase()}`;
}

// Deterministic "keep" ordering: earliest createdAt, then smallest doc id.
function createdMs(d) {
  const c = d.createdAt;
  if (c?.toDate) return c.toDate().getTime();
  if (c?._seconds) return c._seconds * 1000;
  if (typeof c === 'string') { const t = Date.parse(c); return isNaN(t) ? Infinity : t; }
  return Infinity;
}

async function main() {
  const collection = process.argv[2];
  const apply = process.argv.includes('--apply');
  if (!['expenses', 'generalLedger', 'income'].includes(collection || '')) {
    console.error('Usage: node scripts/dedupe-transactions.cjs <expenses|generalLedger|income> [--apply]');
    process.exit(1);
  }

  console.log(`\n=== Dedupe ${collection} — ${apply ? 'APPLY (will delete + back up)' : 'DRY RUN (no changes)'} ===\n`);

  const snap = await db.collection(collection).get();
  const groups = new Map();
  for (const doc of snap.docs) {
    const d = doc.data();
    const sig = signature(collection, d);
    if (!groups.has(sig)) groups.set(sig, []);
    groups.get(sig).push({ id: doc.id, data: d });
  }

  const toDelete = [];
  let x2 = 0, x3plus = 0, excess = 0;
  for (const [, arr] of groups) {
    if (arr.length < 2) continue;
    if (arr.length === 2) x2++; else x3plus++;
    // Keep the earliest-created (fallback smallest id); delete the rest.
    arr.sort((a, b) => createdMs(a.data) - createdMs(b.data) || a.id.localeCompare(b.id));
    const [, ...extras] = arr;
    for (const e of extras) { toDelete.push(e); excess += Math.abs(amountOf(e.data)); }
  }

  console.log(`Records scanned:        ${snap.size}`);
  console.log(`Duplicate groups:       ${x2 + x3plus}  (x2: ${x2}, 3+ copies: ${x3plus})`);
  console.log(`Extra copies to remove: ${toDelete.length}`);
  console.log(`Value of removed copies:${' '}${money(excess)}\n`);

  if (!apply) {
    console.log('DRY RUN — nothing deleted. Re-run with --apply to remove the extras (a backup is written first).');
    process.exit(0);
  }

  if (toDelete.length === 0) {
    console.log('Nothing to delete. Collection is already clean.');
    process.exit(0);
  }

  // 1) Write backup of every doc we are about to delete.
  const backupPath = path.resolve(__dirname, `dedupe-backup-${collection}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(toDelete.map((e) => ({ id: e.id, data: e.data })), null, 2));
  console.log(`Backup of ${toDelete.length} docs written to: ${backupPath}`);

  // 2) Delete in batches of 400.
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += 400) {
    const batch = db.batch();
    for (const e of toDelete.slice(i, i + 400)) batch.delete(db.collection(collection).doc(e.id));
    await batch.commit();
    deleted += Math.min(400, toDelete.length - i);
    console.log(`  deleted ${deleted}/${toDelete.length}`);
  }

  // 3) For the GL, re-verify debits == credits after cleanup.
  if (collection === 'generalLedger') {
    const after = await db.collection('generalLedger').get();
    let dr = 0, cr = 0;
    for (const doc of after.docs) {
      const d = doc.data();
      if (typeof d.debit === 'number' || typeof d.credit === 'number') { dr += d.debit || 0; cr += d.credit || 0; }
      else if (d.type === 'debit') dr += d.amount || 0;
      else if (d.type === 'credit') cr += d.amount || 0;
    }
    console.log(`\nGL after cleanup: debits ${money(dr)} vs credits ${money(cr)} — ${Math.abs(dr - cr) < 0.02 ? 'BALANCED ✓' : 'OUT OF BALANCE by ' + money(dr - cr)}`);
  }

  console.log(`\nDone. Removed ${deleted} duplicate ${collection} records. Backup: ${backupPath}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
