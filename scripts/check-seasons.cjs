const admin = require('firebase-admin');
const path = require('path');
if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function main() {
  // Check income seasons
  const incSnap = await db.collection('income').limit(5).get();
  console.log('=== INCOME SEASONS ===');
  console.log('Total income records:', (await db.collection('income').get()).size);
  for (const d of incSnap.docs) console.log(d.data().season, '|', d.data().category, '|', d.data().amount);

  // Check expense seasons
  const expSnap = await db.collection('expenses').limit(5).get();
  console.log('\n=== EXPENSE SEASONS ===');
  console.log('Total expense records:', (await db.collection('expenses').get()).size);
  for (const d of expSnap.docs) console.log(d.data().season, '|', d.data().category, '|', d.data().amount);

  // Check GL entries
  const glSnap = await db.collection('generalLedger').limit(5).get();
  console.log('\n=== GL ENTRY SEASONS ===');
  console.log('Total GL entries:', (await db.collection('generalLedger').get()).size);
  for (const d of glSnap.docs) console.log(d.data().season, '|', d.data().accountNumber, '|', 'Dr:', d.data().debit, 'Cr:', d.data().credit);

  // Check budgets
  const budSnap = await db.collection('budgets').get();
  console.log('\n=== BUDGETS ===');
  console.log('Total budgets:', budSnap.size);
  for (const d of budSnap.docs) console.log(d.data().season);

  // Check chart of accounts
  const coaSnap = await db.collection('chartOfAccounts').get();
  console.log('\n=== CHART OF ACCOUNTS ===');
  console.log('Total accounts:', coaSnap.size);
  for (const d of coaSnap.docs) console.log(d.data().accountNumber, '|', d.data().name, '|', d.data().type);

  // Unique seasons across income
  const allInc = await db.collection('income').get();
  const incSeasons = new Set();
  for (const d of allInc.docs) incSeasons.add(d.data().season || '(none)');
  console.log('\n=== UNIQUE INCOME SEASONS ===');
  console.log([...incSeasons].sort().join(', '));

  // Unique seasons across expenses
  const allExp = await db.collection('expenses').get();
  const expSeasons = new Set();
  for (const d of allExp.docs) expSeasons.add(d.data().season || '(none)');
  console.log('\n=== UNIQUE EXPENSE SEASONS ===');
  console.log([...expSeasons].sort().join(', '));

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
