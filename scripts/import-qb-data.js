// Import QuickBooks data from CSV exports into Firestore
// Tailored for NM Waves actual export format
//
// Usage:
//   node scripts/import-qb-data.js --dry-run          # Preview what will be imported
//   node scripts/import-qb-data.js                     # Actually import to Firestore
//   node scripts/import-qb-data.js --players-only      # Only import players
//   node scripts/import-qb-data.js --finances-only     # Only import finances
//   node scripts/import-qb-data.js --sponsors-only     # Only import sponsors

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs, query, where } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));

const firebaseConfig = {
  apiKey: "AIzaSyBudHBD7L6rEZCvHJ41QBAnA67Mb_mWIY0",
  authDomain: "tcw-website-builder.firebaseapp.com",
  projectId: "tcw-website-builder",
  storageBucket: "tcw-website-builder.firebasestorage.app",
  messagingSenderId: "110366167929",
  appId: "1:110366167929:web:f0d76d7eea8dee70e755a8",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const authInstance = getAuth(app);

// Prompt for password (hidden input)
function askPassword(prompt) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    process.stdout.write(prompt);
    rl.question('', (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function signInAdmin() {
  const email = 'tcwavessoftball@gmail.com';
  console.log(`Signing in as ${email}...`);

  // Accept password from env var or prompt
  let password = process.env.FB_PASSWORD;
  if (!password) {
    password = await askPassword('Password: ');
  }

  try {
    await signInWithEmailAndPassword(authInstance, email, password);
    console.log('Signed in successfully!\n');
  } catch (error) {
    console.error(`Sign-in failed: ${error.message}`);
    process.exit(1);
  }
}

const SEASON = '2025-2026';
const IMPORTS_DIR = join(__dirname, '..', 'imports');

// Known business/sponsor names (not players)
const BUSINESS_NAMES = new Set([
  'Craig Wealth Advisors',
  'Eising Construction',
  'FiberNorth, Inc.',
  'Kadlec Associates',
  'Molon Excavating',
  'Reichard and Hack',
  'Sample Customer',
  'Stanley Steemer',
  'TBA Credit Union',
  'Torch Riviera',
  'Triston Cole Agency',
]);

// ─── CSV Parsing ──────────────────────────────────────────────

function parseCSV(text) {
  const lines = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '""';
        i++;
      } else {
        inQuotes = !inQuotes;
        current += ch; // preserve quotes for field-level parsing
      }
    } else if (ch === '\n' && !inQuotes) {
      lines.push(current);
      current = '';
    } else if (ch === '\r' && !inQuotes) {
      // skip \r
    } else {
      current += ch;
    }
  }
  if (current.trim()) lines.push(current);

  return lines.map(line => {
    const fields = [];
    let field = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQ = !inQ;
        }
      } else if (ch === ',' && !inQ) {
        fields.push(field.trim());
        field = '';
      } else {
        field += ch;
      }
    }
    fields.push(field.trim());
    return fields;
  });
}

function parseAmount(str) {
  if (!str) return 0;
  const cleaned = str.replace(/[$,]/g, '').replace(/[()]/g, m => m === '(' ? '-' : '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseDate(str) {
  if (!str) return new Date();
  // Handle MM/DD/YYYY
  const parts = str.split('/');
  if (parts.length === 3) {
    return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
  }
  return new Date(str);
}

function splitName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

function parsePhone(phoneStr) {
  if (!phoneStr) return '';
  // Extract first phone number from formats like "Phone:(231) 590-6615 Mobile:(734) 751-6933"
  const match = phoneStr.match(/Phone:\s*([^\s]+(?:\s[^\s]+)?(?:\s[^\s]+)?)/);
  if (match) return match[1];
  // Try Mobile
  const mobileMatch = phoneStr.match(/Mobile:\s*([^\s]+(?:\s[^\s]+)?(?:\s[^\s]+)?)/);
  if (mobileMatch) return mobileMatch[1];
  return phoneStr;
}

// ─── Parse Contact List ──────────────────────────────────────

function parseContactList() {
  const filePath = join(IMPORTS_DIR, 'Northern Michigan Waves Inc_Customer Contact List.csv');
  const text = readFileSync(filePath, 'utf-8');
  const rows = parseCSV(text);

  const contacts = [];
  // Skip header rows (first 3 lines: title, company, blank, then column headers)
  let headerIdx = rows.findIndex(r => r[0] === 'Customer full name');
  if (headerIdx === -1) headerIdx = 3;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0] || row[0].startsWith('"') || row[0].startsWith('Sunday') || row[0].startsWith('Monday')) continue;

    const fullName = row[0];
    if (BUSINESS_NAMES.has(fullName)) continue;

    const { firstName, lastName } = splitName(fullName);
    const phone = parsePhone(row[1] || '');
    const email = row[2] || '';
    const address = row[4] || '';

    contacts.push({
      fullName,
      firstName,
      lastName,
      parentPhone: phone,
      parentEmail: email,
      address,
    });
  }

  return contacts;
}

// ─── Parse Balance Summary ───────────────────────────────────

function parseBalanceSummary() {
  const filePath = join(IMPORTS_DIR, 'Northern Michigan Waves Inc_Customer Balance Summary.csv');
  const text = readFileSync(filePath, 'utf-8');
  const rows = parseCSV(text);

  const balances = {};
  let headerIdx = rows.findIndex(r => r[0] === 'Customer');
  if (headerIdx === -1) headerIdx = 3;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0] || row[0] === 'TOTAL' || row[0].startsWith('"') || row[0].startsWith('Sunday')) continue;
    if (BUSINESS_NAMES.has(row[0])) continue;

    balances[row[0]] = parseAmount(row[1]);
  }

  return balances;
}

// ─── Parse Sales Detail ──────────────────────────────────────

function parseSalesDetail() {
  const filePath = join(IMPORTS_DIR, 'Northern Michigan Waves Inc_Sales by Customer Detail.csv');
  const text = readFileSync(filePath, 'utf-8');
  const rows = parseCSV(text);

  const playerInvoices = {};
  let currentPlayer = null;

  // Find header row
  let headerIdx = rows.findIndex(r => r[1] === 'Transaction date');
  if (headerIdx === -1) headerIdx = 4;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];

    // Skip empty, total, and timestamp rows
    if (row.every(c => !c)) continue;
    if (row[0]?.startsWith('Accrual') || row[1] === 'TOTAL') continue;

    // Player name row (non-empty first column, no transaction date)
    if (row[0] && !row[0].startsWith('Total for') && !row[1]) {
      currentPlayer = row[0];
      if (BUSINESS_NAMES.has(currentPlayer)) {
        currentPlayer = null;
        continue;
      }
      if (!playerInvoices[currentPlayer]) {
        playerInvoices[currentPlayer] = { invoices: [], totalInvoiced: 0 };
      }
      continue;
    }

    // Total row for a player
    if (row[0]?.startsWith('Total for')) {
      if (currentPlayer && playerInvoices[currentPlayer]) {
        playerInvoices[currentPlayer].totalInvoiced = parseAmount(row[8]);
      }
      currentPlayer = null;
      continue;
    }

    // Invoice row
    if (currentPlayer && row[1]) {
      const amount = parseAmount(row[8]);
      if (amount === 0) continue; // Skip zero-amount rows

      const invoice = {
        date: parseDate(row[1]),
        type: row[2], // Invoice
        num: row[3],
        product: row[4],
        description: row[5],
        quantity: parseFloat(row[6]) || 0,
        price: parseAmount(row[7]),
        amount,
        balance: parseAmount(row[9]),
      };
      playerInvoices[currentPlayer].invoices.push(invoice);
    }
  }

  return playerInvoices;
}

// ─── Extract Sponsors ────────────────────────────────────────

function parseSponsors() {
  const filePath = join(IMPORTS_DIR, 'Northern Michigan Waves Inc_Customer Contact List.csv');
  const text = readFileSync(filePath, 'utf-8');
  const rows = parseCSV(text);

  const sponsors = [];
  let headerIdx = rows.findIndex(r => r[0] === 'Customer full name');
  if (headerIdx === -1) headerIdx = 3;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue;

    const name = row[0];
    if (!BUSINESS_NAMES.has(name)) continue;
    if (name === 'Sample Customer') continue;

    sponsors.push({
      businessName: name,
      contactEmail: row[2] || '',
      contactPhone: parsePhone(row[1] || ''),
      contactName: row[3] || '',
      address: row[4] || '',
    });
  }

  return sponsors;
}

// ─── Import Players ──────────────────────────────────────────

async function importPlayers(dryRun) {
  console.log('\n━━━ Importing Players ━━━');

  const contacts = parseContactList();
  console.log(`Found ${contacts.length} player contacts`);

  let created = 0;
  let skipped = 0;

  for (const contact of contacts) {
    const playerId = contact.fullName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const playerData = {
      firstName: contact.firstName,
      lastName: contact.lastName,
      parentName: '', // QB doesn't have separate parent name
      parentEmail: contact.parentEmail,
      parentPhone: contact.parentPhone,
      emergencyContact: '',
      emergencyPhone: '',
      positions: [],
      contacts: [{
        name: contact.fullName,
        relationship: 'self',
        email: contact.parentEmail,
        phone: contact.parentPhone,
      }],
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (dryRun) {
      console.log(`  [DRY RUN] Would create player: ${contact.firstName} ${contact.lastName} (${contact.parentEmail})`);
    } else {
      await setDoc(doc(db, 'players', playerId), playerData);
      console.log(`  Created player: ${contact.firstName} ${contact.lastName}`);
    }
    created++;
  }

  console.log(`Players: ${created} created, ${skipped} skipped`);
  return created;
}

// ─── Import Finances ─────────────────────────────────────────

async function importFinances(dryRun) {
  console.log('\n━━━ Importing Player Finances ━━━');

  const salesData = parseSalesDetail();
  const balances = parseBalanceSummary();
  const contacts = parseContactList();

  const contactMap = {};
  for (const c of contacts) {
    contactMap[c.fullName] = c;
  }

  let created = 0;

  for (const [playerName, data] of Object.entries(salesData)) {
    const playerId = playerName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const balance = balances[playerName] || 0;
    const totalInvoiced = data.totalInvoiced || 0;
    const totalPaid = totalInvoiced - balance;

    // Map invoices to fee categories
    let acceptanceFee = 0;
    let firstInstallment = 0;
    let secondInstallment = 0;
    let finalInstallment = 0;

    const payments = [];

    for (const inv of data.invoices) {
      if (inv.product?.includes('Acceptance Fee')) {
        acceptanceFee += inv.amount;
      } else if (inv.product?.includes('First Installment')) {
        firstInstallment += inv.amount;
      } else if (inv.product?.includes('Second Installment')) {
        secondInstallment += inv.amount;
      } else if (inv.product?.includes('Final Installment')) {
        finalInstallment += inv.amount;
      }
    }

    // Put installments into fee fields so the app's totalOwed calculation works:
    // totalOwed = registrationFee + uniformCost + tournamentFees + facilityFees + equipmentFees + otherFees
    const otherFees = firstInstallment + secondInstallment + finalInstallment;

    // Create a payment record if anything has been paid
    if (totalPaid > 0) {
      payments.push({
        id: `qb-import-${playerId}`,
        amount: totalPaid,
        date: new Date(),
        method: 'other',
        notes: 'Imported from QuickBooks',
        recordedBy: 'quickbooks-import',
        recordedAt: new Date(),
      });
    }

    const financeData = {
      playerId,
      playerName,
      teamId: '',
      teamName: '',
      season: SEASON,
      assumedCost: totalInvoiced,
      actualCost: totalInvoiced,
      scholarshipAmount: 0,
      registrationFee: acceptanceFee,
      uniformCost: 0,
      tournamentFees: 0,
      facilityFees: 0,
      equipmentFees: 0,
      otherFees,
      totalPaid,
      payments,
      totalOwed: totalInvoiced,
      balance,
      balanceDue: balance,
      status: balance <= 0 ? 'paid' : 'current',
      notes: `Acceptance: $${acceptanceFee} | 1st: $${firstInstallment} | 2nd: $${secondInstallment} | Final: $${finalInstallment}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const financeId = `${playerId}-${SEASON}`;

    if (dryRun) {
      console.log(`  [DRY RUN] ${playerName}: Invoiced $${totalInvoiced}, Paid $${totalPaid}, Balance $${balance}`);
    } else {
      await setDoc(doc(db, 'playerFinances', financeId), financeData);
      console.log(`  Saved finance: ${playerName} — Invoiced $${totalInvoiced}, Balance $${balance}`);
    }
    created++;
  }

  console.log(`Finances: ${created} records created`);
  return created;
}

// ─── Import Income Records ───────────────────────────────────

async function importIncome(dryRun) {
  console.log('\n━━━ Importing Income Records (from Sales Detail) ━━━');

  const salesData = parseSalesDetail();
  let created = 0;

  for (const [playerName, data] of Object.entries(salesData)) {
    const playerId = playerName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    for (const inv of data.invoices) {
      if (inv.amount <= 0) continue;

      const incomeId = `inv-${inv.num}-${playerId}`;
      const incomeData = {
        date: inv.date,
        category: 'player_payments',
        amount: inv.amount,
        source: playerName,
        description: inv.description || inv.product,
        paymentMethod: 'other',
        referenceNumber: inv.num,
        playerId,
        season: SEASON,
        notes: `QB Invoice #${inv.num}`,
        recordedBy: 'quickbooks-import',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (dryRun) {
        console.log(`  [DRY RUN] Invoice #${inv.num}: ${playerName} — $${inv.amount} (${inv.product})`);
      } else {
        await setDoc(doc(db, 'income', incomeId), incomeData);
      }
      created++;
    }
  }

  console.log(`Income: ${created} records created`);
  return created;
}

// ─── Import Sponsors ─────────────────────────────────────────

async function importSponsors(dryRun) {
  console.log('\n━━━ Importing Sponsors ━━━');

  const sponsors = parseSponsors();
  let created = 0;

  for (const sponsor of sponsors) {
    const sponsorId = sponsor.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');

    const sponsorData = {
      businessName: sponsor.businessName,
      contactName: sponsor.contactName,
      contactEmail: sponsor.contactEmail,
      contactPhone: sponsor.contactPhone,
      level: 'bronze', // Default; can be updated in the app
      displayOnPublicSite: true,
      season: SEASON,
      createdAt: new Date(),
    };

    if (dryRun) {
      console.log(`  [DRY RUN] Sponsor: ${sponsor.businessName} (${sponsor.contactEmail})`);
    } else {
      await setDoc(doc(db, 'sponsors', sponsorId), sponsorData);
      console.log(`  Created sponsor: ${sponsor.businessName}`);
    }
    created++;
  }

  console.log(`Sponsors: ${created} created`);
  return created;
}

// ─── Main ────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const playersOnly = args.includes('--players-only');
  const financesOnly = args.includes('--finances-only');
  const sponsorsOnly = args.includes('--sponsors-only');
  const doAll = !playersOnly && !financesOnly && !sponsorsOnly;

  console.log('╔════════════════════════════════════════════╗');
  console.log('║   NM Waves - QuickBooks Data Import       ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log(`Season: ${SEASON}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE IMPORT'}`);
  console.log(`Imports dir: ${IMPORTS_DIR}`);

  // Sign in as admin (required for Firestore writes)
  if (!dryRun) {
    await signInAdmin();
  }

  if (args.includes('--help')) {
    console.log(`
Usage:
  node scripts/import-qb-data.js [options]

Options:
  --dry-run         Preview what will be imported without writing to Firestore
  --players-only    Only import player records from Contact List
  --finances-only   Only import finances from Sales Detail + Balance Summary
  --sponsors-only   Only import sponsor records
  --help            Show this help

Expected files in ./imports/:
  Northern Michigan Waves Inc_Customer Contact List.csv
  Northern Michigan Waves Inc_Sales by Customer Detail.csv
  Northern Michigan Waves Inc_Customer Balance Summary.csv
`);
    process.exit(0);
  }

  let totalRecords = 0;

  try {
    if (doAll || playersOnly) {
      totalRecords += await importPlayers(dryRun);
    }

    if (doAll || financesOnly) {
      totalRecords += await importFinances(dryRun);
      totalRecords += await importIncome(dryRun);
    }

    if (doAll || sponsorsOnly) {
      totalRecords += await importSponsors(dryRun);
    }

    console.log('\n════════════════════════════════════════════');
    console.log(`Total: ${totalRecords} records ${dryRun ? 'would be' : ''} imported`);

    if (dryRun) {
      console.log('\nThis was a dry run. Run without --dry-run to actually import.');
    } else {
      console.log('\nImport complete! Check the app to verify data.');
    }
  } catch (error) {
    console.error('\nError during import:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

main();
