/**
 * READ-ONLY accounting audit. Makes NO writes of any kind — it only reads and
 * totals the app's current data so it can be compared against QuickBooks reports
 * (Trial Balance, Statement of Activity, A/R Aging). Running this cannot double,
 * create, or modify anything.
 *
 * Usage (from project root, in an environment that has serviceAccountKey.json):
 *   node scripts/qb-audit-readonly.cjs
 */
const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

const money = (n) => `$${(Math.round((n + Number.EPSILON) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function sortedEntries(obj) {
  return Object.entries(obj).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
}

async function main() {
  console.log('==================================================================');
  console.log(' NM WAVES — READ-ONLY ACCOUNTING AUDIT (no writes performed)');
  console.log('==================================================================\n');

  // ---- PLAYER FINANCES (billing / A/R) ----
  const pf = await db.collection('playerFinances').get();
  let owed = 0, paid = 0, scholarship = 0;
  let arPositive = 0, arNegative = 0;
  const balances = [];
  for (const doc of pf.docs) {
    const d = doc.data();
    if (d.status === 'quit') continue;
    const o = (d.registrationFee||0)+(d.uniformCost||0)+(d.tournamentFees||0)+(d.facilityFees||0)+(d.equipmentFees||0)+(d.otherFees||0);
    const p = (d.payments||[]).reduce((s, x) => s + (x.amount||0), 0);
    const sch = d.scholarshipAmount||0;
    const bal = o - p - sch;
    owed += o; paid += p; scholarship += sch;
    if (bal > 0.005) arPositive += bal;
    if (bal < -0.005) arNegative += bal;
    if (Math.abs(bal) > 0.005) balances.push({ name: d.playerName || doc.id, season: d.season || '', bal });
  }
  console.log(`PLAYER FINANCES (${pf.size} records, excluding quit)`);
  console.log(`  Total charged (owed):     ${money(owed)}`);
  console.log(`  Total paid:               ${money(paid)}`);
  console.log(`  Total scholarships:       ${money(scholarship)}`);
  console.log(`  A/R — outstanding (>0):   ${money(arPositive)}`);
  console.log(`  Credits/overpaid (<0):    ${money(arNegative)}`);
  console.log(`  A/R net:                  ${money(arPositive + arNegative)}`);
  console.log(`  Players with a balance:   ${balances.length}`);
  balances.sort((a, b) => b.bal - a.bal);
  for (const b of balances) console.log(`     ${b.bal >= 0 ? ' ' : ''}${money(b.bal).padStart(11)}  ${b.name} (${b.season})`);
  console.log('');

  // ---- INCOME ----
  const inc = await db.collection('income').get();
  const incByCat = {};
  let incTotal = 0;
  for (const doc of inc.docs) {
    const d = doc.data();
    const c = d.category || 'uncategorized';
    incByCat[c] = (incByCat[c]||0) + (d.amount||0);
    incTotal += (d.amount||0);
  }
  console.log(`INCOME collection (${inc.size} records)`);
  for (const [c, v] of sortedEntries(incByCat)) console.log(`  ${money(v).padStart(13)}  ${c}`);
  console.log(`  ${money(incTotal).padStart(13)}  TOTAL INCOME\n`);

  // ---- EXPENSES ----
  const exp = await db.collection('expenses').get();
  const expByCat = {};
  let expTotal = 0;
  for (const doc of exp.docs) {
    const d = doc.data();
    const c = d.category || 'uncategorized';
    expByCat[c] = (expByCat[c]||0) + (d.amount||0);
    expTotal += (d.amount||0);
  }
  console.log(`EXPENSES collection (${exp.size} records)`);
  for (const [c, v] of sortedEntries(expByCat)) console.log(`  ${money(v).padStart(13)}  ${c}`);
  console.log(`  ${money(expTotal).padStart(13)}  TOTAL EXPENSES\n`);

  // ---- GENERAL LEDGER (handles both {debit,credit} and {type,amount} shapes) ----
  const gl = await db.collection('generalLedger').get();
  const glByAcct = {}; // key -> {debit, credit}
  let glDebit = 0, glCredit = 0;
  for (const doc of gl.docs) {
    const d = doc.data();
    const key = `${d.accountNumber || '????'} ${d.accountName || ''}`.trim();
    let dr = 0, cr = 0;
    if (typeof d.debit === 'number' || typeof d.credit === 'number') {
      dr = d.debit || 0; cr = d.credit || 0;
    } else if (d.type === 'debit') {
      dr = d.amount || 0;
    } else if (d.type === 'credit') {
      cr = d.amount || 0;
    }
    if (!glByAcct[key]) glByAcct[key] = { debit: 0, credit: 0 };
    glByAcct[key].debit += dr; glByAcct[key].credit += cr;
    glDebit += dr; glCredit += cr;
  }
  console.log(`GENERAL LEDGER (${gl.size} entries)`);
  console.log(`  ${'DEBIT'.padStart(13)}  ${'CREDIT'.padStart(13)}  ACCOUNT`);
  for (const [k, v] of Object.entries(glByAcct).sort((a,b)=>a[0].localeCompare(b[0]))) {
    console.log(`  ${money(v.debit).padStart(13)}  ${money(v.credit).padStart(13)}  ${k}`);
  }
  console.log(`  ${money(glDebit).padStart(13)}  ${money(glCredit).padStart(13)}  TOTALS  (balanced: ${Math.abs(glDebit-glCredit) < 0.02 ? 'YES' : 'NO — off by ' + money(glDebit-glCredit)})\n`);

  // ---- BANK / ACCOUNTS ----
  try {
    const accts = await db.collection('accounts').get();
    if (accts.size) {
      console.log(`ACCOUNTS / BANK (${accts.size})`);
      for (const doc of accts.docs) {
        const d = doc.data();
        console.log(`  ${money(d.balance||0).padStart(13)}  ${d.name || doc.id} ${d.type ? '('+d.type+')' : ''}`);
      }
      console.log('');
    }
  } catch (_) { /* accounts optional */ }

  // ---- SPONSORS ----
  try {
    const sp = await db.collection('sponsors').get();
    let contributed = 0, applied = 0;
    for (const doc of sp.docs) {
      const d = doc.data();
      contributed += d.totalContributed || 0;
      applied += d.totalSponsored || 0;
    }
    console.log(`SPONSORS (${sp.size})`);
    console.log(`  Total contributed:  ${money(contributed)}`);
    console.log(`  Total applied:      ${money(applied)}`);
    console.log(`  Unapplied balance:  ${money(contributed - applied)}\n`);
  } catch (_) { /* sponsors optional */ }

  console.log('==================================================================');
  console.log(' END OF READ-ONLY AUDIT — nothing was written.');
  console.log('==================================================================');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
