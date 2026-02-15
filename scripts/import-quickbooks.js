// QuickBooks CSV Import Script for NM Waves Softball Club
// Usage: node scripts/import-quickbooks.js --type expenses --file ./imports/expenses.csv --season "2025-2026"
// Run with --help for full usage information.

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ============================================
// FIREBASE CONFIGURATION
// ============================================

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

// ============================================
// CONSTANTS
// ============================================

const VALID_TYPES = ['expenses', 'income', 'customers', 'invoices'];
const DEFAULT_SEASON = '2025-2026';
const DEFAULT_RECORDED_BY = 'quickbooks-import';

const EXPENSE_CATEGORIES = [
  'facilities', 'equipment', 'uniforms', 'tournaments', 'travel',
  'insurance', 'league_fees', 'coaching', 'administrative', 'marketing',
  'fundraising', 'maintenance', 'other',
];

const INCOME_CATEGORIES = [
  'player_payments', 'sponsorships', 'fundraisers', 'donations',
  'grants', 'merchandise', 'concessions', 'other',
];

const PAYMENT_METHODS = ['cash', 'check', 'credit_card', 'bank_transfer', 'other'];

// ============================================
// QUICKBOOKS CATEGORY MAPPINGS
// ============================================

// Maps common QuickBooks expense account/category names to app categories.
// Keys are lowercase for case-insensitive matching.
const QB_EXPENSE_CATEGORY_MAP = {
  // Facilities
  'rent': 'facilities',
  'rent or lease': 'facilities',
  'rent expense': 'facilities',
  'facility rental': 'facilities',
  'facility': 'facilities',
  'facilities': 'facilities',
  'field rental': 'facilities',
  'indoor facility': 'facilities',
  'gym rental': 'facilities',
  'venue rental': 'facilities',
  'venue': 'facilities',

  // Equipment
  'equipment': 'equipment',
  'equipment rental': 'equipment',
  'supplies': 'equipment',
  'sporting goods': 'equipment',
  'bats': 'equipment',
  'balls': 'equipment',
  'gear': 'equipment',
  'equipment & supplies': 'equipment',

  // Uniforms
  'uniforms': 'uniforms',
  'uniform': 'uniforms',
  'jerseys': 'uniforms',
  'apparel': 'uniforms',
  'clothing': 'uniforms',
  'team apparel': 'uniforms',

  // Tournaments
  'tournaments': 'tournaments',
  'tournament': 'tournaments',
  'tournament entry': 'tournaments',
  'tournament fees': 'tournaments',
  'entry fees': 'tournaments',
  'registration': 'tournaments',
  'tournament registration': 'tournaments',

  // Travel
  'travel': 'travel',
  'travel expense': 'travel',
  'mileage': 'travel',
  'gas': 'travel',
  'fuel': 'travel',
  'transportation': 'travel',
  'hotel': 'travel',
  'lodging': 'travel',
  'meals & travel': 'travel',

  // Insurance
  'insurance': 'insurance',
  'insurance expense': 'insurance',
  'liability insurance': 'insurance',
  'player insurance': 'insurance',

  // League fees
  'league fees': 'league_fees',
  'league': 'league_fees',
  'league dues': 'league_fees',
  'membership': 'league_fees',
  'membership dues': 'league_fees',
  'association fees': 'league_fees',
  'usssa': 'league_fees',
  'asa': 'league_fees',
  'usa softball': 'league_fees',

  // Coaching
  'coaching': 'coaching',
  'coach': 'coaching',
  'coaching fees': 'coaching',
  'coaching expense': 'coaching',
  'instruction': 'coaching',
  'lessons': 'coaching',
  'training': 'coaching',
  'clinics': 'coaching',
  'pitching lessons': 'coaching',
  'hitting lessons': 'coaching',
  'private lessons': 'coaching',
  'contract labor': 'coaching',
  'contractors': 'coaching',

  // Administrative
  'administrative': 'administrative',
  'admin': 'administrative',
  'office supplies': 'administrative',
  'office expense': 'administrative',
  'postage': 'administrative',
  'printing': 'administrative',
  'bank charges': 'administrative',
  'bank fees': 'administrative',
  'service charges': 'administrative',
  'fees': 'administrative',
  'professional fees': 'administrative',
  'accounting': 'administrative',
  'legal': 'administrative',
  'taxes': 'administrative',
  'licenses': 'administrative',
  'software': 'administrative',
  'website': 'administrative',
  'technology': 'administrative',

  // Marketing
  'marketing': 'marketing',
  'advertising': 'marketing',
  'promotion': 'marketing',
  'promotions': 'marketing',
  'sponsorship expense': 'marketing',
  'signage': 'marketing',
  'banners': 'marketing',

  // Fundraising
  'fundraising': 'fundraising',
  'fundraising expense': 'fundraising',
  'event expense': 'fundraising',
  'raffle': 'fundraising',
  'auction': 'fundraising',

  // Maintenance
  'maintenance': 'maintenance',
  'repairs': 'maintenance',
  'repair': 'maintenance',
  'maintenance & repair': 'maintenance',
  'field maintenance': 'maintenance',
  'upkeep': 'maintenance',
};

// Maps common QuickBooks income account/category names to app categories.
const QB_INCOME_CATEGORY_MAP = {
  // Player payments
  'player payments': 'player_payments',
  'player payment': 'player_payments',
  'registration fees': 'player_payments',
  'registration income': 'player_payments',
  'registration': 'player_payments',
  'player fees': 'player_payments',
  'team fees': 'player_payments',
  'dues': 'player_payments',
  'membership dues': 'player_payments',
  'tuition': 'player_payments',
  'services': 'player_payments',
  'services/fee income': 'player_payments',
  'fee income': 'player_payments',
  'sales': 'player_payments',

  // Sponsorships
  'sponsorships': 'sponsorships',
  'sponsorship': 'sponsorships',
  'sponsor income': 'sponsorships',
  'sponsor': 'sponsorships',
  'corporate sponsorship': 'sponsorships',
  'advertising income': 'sponsorships',

  // Fundraisers
  'fundraisers': 'fundraisers',
  'fundraiser': 'fundraisers',
  'fundraising': 'fundraisers',
  'fundraising income': 'fundraisers',
  'event income': 'fundraisers',
  'raffle income': 'fundraisers',
  'auction income': 'fundraisers',
  'car wash': 'fundraisers',

  // Donations
  'donations': 'donations',
  'donation': 'donations',
  'contribution': 'donations',
  'contributions': 'donations',
  'gifts': 'donations',
  'charitable': 'donations',

  // Grants
  'grants': 'grants',
  'grant': 'grants',
  'grant income': 'grants',

  // Merchandise
  'merchandise': 'merchandise',
  'merch': 'merchandise',
  'merchandise sales': 'merchandise',
  'product sales': 'merchandise',
  'apparel sales': 'merchandise',
  'spirit wear': 'merchandise',

  // Concessions
  'concessions': 'concessions',
  'concession': 'concessions',
  'concession sales': 'concessions',
  'food sales': 'concessions',
  'snack bar': 'concessions',
};

// Maps QuickBooks payment method strings to app payment methods.
const QB_PAYMENT_METHOD_MAP = {
  'cash': 'cash',
  'check': 'check',
  'cheque': 'check',
  'credit card': 'credit_card',
  'credit': 'credit_card',
  'visa': 'credit_card',
  'mastercard': 'credit_card',
  'amex': 'credit_card',
  'american express': 'credit_card',
  'debit card': 'credit_card',
  'debit': 'credit_card',
  'bank transfer': 'bank_transfer',
  'ach': 'bank_transfer',
  'wire': 'bank_transfer',
  'wire transfer': 'bank_transfer',
  'eft': 'bank_transfer',
  'electronic': 'bank_transfer',
  'direct deposit': 'bank_transfer',
  'venmo': 'other',
  'zelle': 'other',
  'paypal': 'other',
  'online': 'other',
  'other': 'other',
};

// ============================================
// CSV PARSER (no external dependencies)
// ============================================

/**
 * Parse a CSV string into an array of objects keyed by header names.
 * Handles quoted fields (including embedded commas, newlines, and escaped quotes).
 */
function parseCSV(csvText) {
  const rows = [];
  let current = '';
  let inQuotes = false;
  const lines = [];

  // Split into logical rows, respecting quoted fields that contain newlines.
  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    if (ch === '"') {
      // Handle escaped quotes ("")
      if (inQuotes && i + 1 < csvText.length && csvText[i + 1] === '"') {
        current += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      // End of logical row
      if (ch === '\r' && i + 1 < csvText.length && csvText[i + 1] === '\n') {
        i++; // skip \n after \r
      }
      if (current.trim().length > 0) {
        lines.push(current);
      }
      current = '';
    } else {
      current += ch;
    }
  }
  // Don't forget the last line
  if (current.trim().length > 0) {
    lines.push(current);
  }

  if (lines.length === 0) {
    return [];
  }

  // Parse a single CSV row string into field values.
  function parseRow(line) {
    const fields = [];
    let field = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (insideQuotes && i + 1 < line.length && line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (ch === ',' && !insideQuotes) {
        fields.push(field.trim());
        field = '';
      } else {
        field += ch;
      }
    }
    fields.push(field.trim());
    return fields;
  }

  // First line is headers
  const headers = parseRow(lines[0]).map(h => h.replace(/^\uFEFF/, '')); // Strip BOM if present

  // Remaining lines are data rows
  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = j < values.length ? values[j] : '';
    }
    rows.push(obj);
  }

  return rows;
}

// ============================================
// PARSING UTILITIES
// ============================================

/**
 * Parse a date string in common US formats.
 * Supports: MM/DD/YYYY, M/D/YYYY, MM-DD-YYYY, M-D-YYYY, YYYY-MM-DD
 * Returns a Date object or null if unparseable.
 */
function parseDate(str) {
  if (!str || typeof str !== 'string') return null;
  str = str.trim();

  // ISO format: YYYY-MM-DD
  let match = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const [, y, m, d] = match;
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (!isNaN(date.getTime())) return date;
  }

  // US format with slashes: M/D/YYYY or MM/DD/YYYY
  match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (match) {
    let [, m, d, y] = match;
    if (y.length === 2) y = (parseInt(y) > 50 ? '19' : '20') + y;
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (!isNaN(date.getTime())) return date;
  }

  // US format with dashes: M-D-YYYY or MM-DD-YYYY
  match = str.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (match) {
    let [, m, d, y] = match;
    if (y.length === 2) y = (parseInt(y) > 50 ? '19' : '20') + y;
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (!isNaN(date.getTime())) return date;
  }

  return null;
}

/**
 * Parse a monetary amount string.
 * Handles: $1,234.56  -$500.00  ($500.00)  1234.56  -1234
 * Returns a number or null if unparseable.
 */
function parseAmount(str) {
  if (!str || typeof str !== 'string') return null;
  str = str.trim();
  if (str === '' || str === '-') return null;

  // Detect negative from parentheses: ($500.00) -> -500.00
  let negative = false;
  if (str.startsWith('(') && str.endsWith(')')) {
    negative = true;
    str = str.slice(1, -1);
  }

  // Detect negative from leading minus
  if (str.startsWith('-')) {
    negative = true;
    str = str.slice(1);
  }

  // Remove dollar sign and commas
  str = str.replace(/[$,]/g, '').trim();

  const num = parseFloat(str);
  if (isNaN(num)) return null;

  return negative ? -num : num;
}

/**
 * Map a QuickBooks category string to an app expense category.
 * Falls back to 'other' if no match is found.
 */
function mapExpenseCategory(qbCategory) {
  if (!qbCategory) return 'other';
  const key = qbCategory.toLowerCase().trim();
  // Direct match
  if (QB_EXPENSE_CATEGORY_MAP[key]) return QB_EXPENSE_CATEGORY_MAP[key];
  // Partial match: check if the QB category contains a known key
  for (const [mapKey, value] of Object.entries(QB_EXPENSE_CATEGORY_MAP)) {
    if (key.includes(mapKey) || mapKey.includes(key)) {
      return value;
    }
  }
  return 'other';
}

/**
 * Map a QuickBooks category string to an app income category.
 * Falls back to 'other' if no match is found.
 */
function mapIncomeCategory(qbCategory) {
  if (!qbCategory) return 'other';
  const key = qbCategory.toLowerCase().trim();
  if (QB_INCOME_CATEGORY_MAP[key]) return QB_INCOME_CATEGORY_MAP[key];
  for (const [mapKey, value] of Object.entries(QB_INCOME_CATEGORY_MAP)) {
    if (key.includes(mapKey) || mapKey.includes(key)) {
      return value;
    }
  }
  return 'other';
}

/**
 * Map a QuickBooks payment method string to an app payment method.
 * Falls back to 'other' if no match is found.
 */
function mapPaymentMethod(qbMethod) {
  if (!qbMethod) return 'other';
  const key = qbMethod.toLowerCase().trim();
  if (QB_PAYMENT_METHOD_MAP[key]) return QB_PAYMENT_METHOD_MAP[key];
  for (const [mapKey, value] of Object.entries(QB_PAYMENT_METHOD_MAP)) {
    if (key.includes(mapKey)) {
      return value;
    }
  }
  return 'other';
}

/**
 * Find a column value from a row given a list of possible column name variants.
 * Case-insensitive matching. Returns the first match found or ''.
 */
function getField(row, ...possibleNames) {
  const rowKeys = Object.keys(row);
  for (const name of possibleNames) {
    // Exact case-insensitive
    const found = rowKeys.find(k => k.toLowerCase().trim() === name.toLowerCase().trim());
    if (found && row[found] !== undefined && row[found] !== '') {
      return row[found];
    }
  }
  return '';
}

// ============================================
// IMPORT HANDLERS
// ============================================

/**
 * Import expenses from a QuickBooks expense/bill export CSV.
 * Expected columns (flexible naming):
 *   Date, Vendor/Payee, Category/Account, Amount, Payment Method/Type, Check #/Num, Memo/Description
 */
async function importExpenses(rows, season, dryRun) {
  const results = { imported: 0, skipped: 0, errors: [] };
  const total = rows.length;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +2 because row 1 is headers, data starts at 2

    try {
      const dateStr = getField(row, 'Date', 'Txn Date', 'Transaction Date', 'Bill Date', 'Payment Date');
      const vendor = getField(row, 'Vendor', 'Payee', 'Name', 'Vendor/Payee', 'Paid To');
      const category = getField(row, 'Category', 'Account', 'Expense Account', 'Account Name', 'Type', 'Class');
      const amountStr = getField(row, 'Amount', 'Total', 'Debit', 'Amount (Debit)', 'Payment Amount', 'Total Amount');
      const paymentMethod = getField(row, 'Payment Method', 'Type', 'Pay Method', 'Payment Type', 'Method');
      const checkNumber = getField(row, 'Check #', 'Check No', 'Num', 'Check Number', 'Ref #', 'Reference');
      const description = getField(row, 'Memo', 'Description', 'Memo/Description', 'Notes', 'Line Memo', 'Memo/Note');

      const date = parseDate(dateStr);
      const amount = parseAmount(amountStr);

      // Validate required fields
      if (!date) {
        results.errors.push(`Row ${rowNum}: Invalid or missing date "${dateStr}"`);
        results.skipped++;
        continue;
      }
      if (amount === null || amount === 0) {
        results.errors.push(`Row ${rowNum}: Invalid or missing amount "${amountStr}"`);
        results.skipped++;
        continue;
      }

      const expenseData = {
        date: Timestamp.fromDate(date),
        category: mapExpenseCategory(category),
        amount: Math.abs(amount), // Expenses stored as positive
        vendor: vendor || 'Unknown Vendor',
        description: description || `QuickBooks import - ${vendor || 'expense'}`,
        paymentMethod: mapPaymentMethod(paymentMethod),
        checkNumber: checkNumber || null,
        receiptUrl: null,
        teamId: null,
        season,
        isPaid: true, // QuickBooks exports are typically already-paid transactions
        paidDate: Timestamp.fromDate(date),
        notes: `Imported from QuickBooks CSV`,
        recordedBy: DEFAULT_RECORDED_BY,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      if (dryRun) {
        console.log(`  [DRY RUN] Row ${rowNum}: ${date.toLocaleDateString()} | ${expenseData.vendor} | ${expenseData.category} | $${expenseData.amount.toFixed(2)}`);
      } else {
        await addDoc(collection(db, 'expenses'), expenseData);
      }
      results.imported++;
      logProgress(i + 1, total, 'expenses');
    } catch (err) {
      results.errors.push(`Row ${rowNum}: ${err.message}`);
      results.skipped++;
    }
  }

  return results;
}

/**
 * Import income from a QuickBooks income/deposit export CSV.
 * Expected columns (flexible naming):
 *   Date, Source/Customer, Category/Account, Amount, Payment Method/Type, Reference #, Memo
 */
async function importIncome(rows, season, dryRun) {
  const results = { imported: 0, skipped: 0, errors: [] };
  const total = rows.length;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    try {
      const dateStr = getField(row, 'Date', 'Txn Date', 'Transaction Date', 'Deposit Date', 'Payment Date');
      const source = getField(row, 'Source', 'Customer', 'Name', 'From', 'Received From', 'Payer', 'Customer/Job');
      const category = getField(row, 'Category', 'Account', 'Income Account', 'Account Name', 'Type', 'Class', 'Item');
      const amountStr = getField(row, 'Amount', 'Total', 'Credit', 'Amount (Credit)', 'Payment Amount', 'Deposit Amount', 'Total Amount');
      const paymentMethod = getField(row, 'Payment Method', 'Type', 'Pay Method', 'Payment Type', 'Method');
      const referenceNumber = getField(row, 'Reference #', 'Ref #', 'Reference', 'Num', 'Check #', 'Check No', 'Transaction #');
      const description = getField(row, 'Memo', 'Description', 'Memo/Description', 'Notes', 'Line Memo', 'Memo/Note');

      const date = parseDate(dateStr);
      const amount = parseAmount(amountStr);

      if (!date) {
        results.errors.push(`Row ${rowNum}: Invalid or missing date "${dateStr}"`);
        results.skipped++;
        continue;
      }
      if (amount === null || amount === 0) {
        results.errors.push(`Row ${rowNum}: Invalid or missing amount "${amountStr}"`);
        results.skipped++;
        continue;
      }

      const incomeData = {
        date: Timestamp.fromDate(date),
        category: mapIncomeCategory(category),
        amount: Math.abs(amount),
        source: source || 'Unknown Source',
        description: description || `QuickBooks import - ${source || 'income'}`,
        paymentMethod: mapPaymentMethod(paymentMethod),
        checkNumber: referenceNumber && mapPaymentMethod(paymentMethod) === 'check' ? referenceNumber : null,
        referenceNumber: referenceNumber || null,
        teamId: null,
        playerId: null,
        season,
        notes: `Imported from QuickBooks CSV`,
        recordedBy: DEFAULT_RECORDED_BY,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      if (dryRun) {
        console.log(`  [DRY RUN] Row ${rowNum}: ${date.toLocaleDateString()} | ${incomeData.source} | ${incomeData.category} | $${incomeData.amount.toFixed(2)}`);
      } else {
        await addDoc(collection(db, 'income'), incomeData);
      }
      results.imported++;
      logProgress(i + 1, total, 'income');
    } catch (err) {
      results.errors.push(`Row ${rowNum}: ${err.message}`);
      results.skipped++;
    }
  }

  return results;
}

/**
 * Import customers from a QuickBooks customer list export CSV.
 * Creates player records in the players collection.
 * Expected columns (flexible naming):
 *   Name/Customer, Email, Phone, Address, Balance
 */
async function importCustomers(rows, season, dryRun) {
  const results = { imported: 0, skipped: 0, errors: [] };
  const total = rows.length;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    try {
      const fullName = getField(row, 'Name', 'Customer', 'Customer Name', 'Display Name', 'Full Name', 'Customer/Job');
      const email = getField(row, 'Email', 'Main Email', 'Email Address', 'E-mail', 'Primary Email');
      const phone = getField(row, 'Phone', 'Main Phone', 'Phone Number', 'Primary Phone', 'Mobile', 'Cell Phone');
      const address = getField(row, 'Address', 'Billing Address', 'Street', 'Mailing Address');
      const balanceStr = getField(row, 'Balance', 'Balance Due', 'Open Balance', 'Amount Due', 'Total Balance');

      if (!fullName) {
        results.errors.push(`Row ${rowNum}: Missing customer name`);
        results.skipped++;
        continue;
      }

      // Parse name into first/last. QuickBooks often uses "Last, First" format.
      let firstName = '';
      let lastName = '';
      if (fullName.includes(',')) {
        const parts = fullName.split(',').map(s => s.trim());
        lastName = parts[0] || '';
        firstName = parts.slice(1).join(' ').trim() || '';
      } else {
        const parts = fullName.trim().split(/\s+/);
        if (parts.length === 1) {
          firstName = parts[0];
          lastName = '';
        } else {
          firstName = parts.slice(0, -1).join(' ');
          lastName = parts[parts.length - 1];
        }
      }

      const balance = parseAmount(balanceStr);

      const playerData = {
        firstName,
        lastName,
        teamId: null,
        teamName: null,
        jerseyNumber: null,
        gradYear: null,
        positions: [],
        bats: null,
        throws: null,
        contacts: [],
        parentName: fullName, // Customer in QB is typically the parent/family
        parentEmail: email || '',
        parentPhone: phone || '',
        emergencyContact: '',
        emergencyPhone: '',
        medicalNotes: null,
        notes: [
          `Imported from QuickBooks CSV`,
          address ? `Address: ${address}` : '',
          balance !== null ? `QB Balance: $${balance.toFixed(2)}` : '',
        ].filter(Boolean).join('. '),
        dateOfBirth: null,
        active: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      if (dryRun) {
        console.log(`  [DRY RUN] Row ${rowNum}: ${firstName} ${lastName} | ${email || 'no email'} | ${phone || 'no phone'}${balance !== null ? ` | Balance: $${balance.toFixed(2)}` : ''}`);
      } else {
        const docRef = await addDoc(collection(db, 'players'), playerData);

        // If a balance exists, create a playerFinances record too.
        if (balance !== null && balance > 0) {
          const financeData = {
            playerId: docRef.id,
            playerName: `${firstName} ${lastName}`.trim(),
            teamId: '',
            teamName: '',
            season,
            assumedCost: 0,
            actualCost: 0,
            scholarshipAmount: 0,
            registrationFee: 0,
            uniformCost: 0,
            tournamentFees: 0,
            facilityFees: 0,
            equipmentFees: 0,
            otherFees: balance,
            totalPaid: 0,
            payments: [],
            totalOwed: balance,
            balance: -balance,
            balanceDue: balance,
            status: 'current',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };
          await addDoc(collection(db, 'playerFinances'), financeData);
        }
      }
      results.imported++;
      logProgress(i + 1, total, 'customers');
    } catch (err) {
      results.errors.push(`Row ${rowNum}: ${err.message}`);
      results.skipped++;
    }
  }

  return results;
}

/**
 * Import invoices from a QuickBooks invoice list export CSV.
 * Creates playerFinances records (and income records for paid amounts).
 * Expected columns (flexible naming):
 *   Customer, Date, Amount/Total, Status, Balance Due, Invoice #
 */
async function importInvoices(rows, season, dryRun) {
  const results = { imported: 0, skipped: 0, errors: [] };
  const total = rows.length;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    try {
      const customer = getField(row, 'Customer', 'Name', 'Customer Name', 'Customer/Job', 'Bill To');
      const dateStr = getField(row, 'Date', 'Txn Date', 'Invoice Date', 'Transaction Date');
      const amountStr = getField(row, 'Amount', 'Total', 'Invoice Total', 'Total Amount', 'Original Amount');
      const statusStr = getField(row, 'Status', 'Invoice Status', 'State');
      const balanceDueStr = getField(row, 'Balance Due', 'Balance', 'Open Balance', 'Amount Due', 'Remaining');
      const invoiceNum = getField(row, 'Invoice #', 'Num', 'Number', 'Invoice Number', 'Ref #', 'Doc Number');
      const description = getField(row, 'Memo', 'Description', 'Memo/Description', 'Notes', 'Line Memo');

      if (!customer) {
        results.errors.push(`Row ${rowNum}: Missing customer name`);
        results.skipped++;
        continue;
      }

      const date = parseDate(dateStr);
      const amount = parseAmount(amountStr);
      const balanceDue = parseAmount(balanceDueStr);

      if (amount === null || amount === 0) {
        results.errors.push(`Row ${rowNum}: Invalid or missing amount "${amountStr}"`);
        results.skipped++;
        continue;
      }

      const invoiceAmount = Math.abs(amount);
      const remaining = balanceDue !== null ? Math.abs(balanceDue) : invoiceAmount;
      const paidAmount = invoiceAmount - remaining;

      // Determine status
      let status = 'current';
      const statusLower = (statusStr || '').toLowerCase();
      if (statusLower.includes('paid') || statusLower.includes('closed') || remaining === 0) {
        status = 'paid';
      } else if (statusLower.includes('overdue') || statusLower.includes('past due')) {
        status = 'overdue';
      }

      // Build payments array from already-paid portion
      const payments = [];
      if (paidAmount > 0) {
        payments.push({
          id: `qb_import_${Date.now()}_${i}`,
          amount: paidAmount,
          date: date ? Timestamp.fromDate(date) : Timestamp.now(),
          method: 'other',
          reference: invoiceNum || null,
          notes: `Imported from QuickBooks invoice${invoiceNum ? ` #${invoiceNum}` : ''}`,
          recordedBy: DEFAULT_RECORDED_BY,
          recordedAt: Timestamp.now(),
        });
      }

      const financeData = {
        playerId: '', // Will need to be linked manually
        playerName: customer,
        teamId: '',
        teamName: '',
        season,
        assumedCost: invoiceAmount,
        actualCost: invoiceAmount,
        scholarshipAmount: 0,
        registrationFee: 0,
        uniformCost: 0,
        tournamentFees: 0,
        facilityFees: 0,
        equipmentFees: 0,
        otherFees: invoiceAmount, // Put full amount in other until manually categorized
        totalPaid: paidAmount,
        payments,
        totalOwed: invoiceAmount,
        balance: paidAmount - invoiceAmount,
        balanceDue: remaining,
        status,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      if (dryRun) {
        console.log(`  [DRY RUN] Row ${rowNum}: ${customer} | ${date ? date.toLocaleDateString() : 'no date'} | Total: $${invoiceAmount.toFixed(2)} | Paid: $${paidAmount.toFixed(2)} | Due: $${remaining.toFixed(2)} | ${status}`);
      } else {
        await addDoc(collection(db, 'playerFinances'), financeData);

        // Also create an income record for the paid portion
        if (paidAmount > 0) {
          const incomeData = {
            date: date ? Timestamp.fromDate(date) : Timestamp.now(),
            category: 'player_payments',
            amount: paidAmount,
            source: customer,
            description: description || `Invoice payment${invoiceNum ? ` #${invoiceNum}` : ''} from ${customer}`,
            paymentMethod: 'other',
            checkNumber: null,
            referenceNumber: invoiceNum || null,
            teamId: null,
            playerId: null,
            season,
            notes: `Imported from QuickBooks invoice CSV`,
            recordedBy: DEFAULT_RECORDED_BY,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };
          await addDoc(collection(db, 'income'), incomeData);
        }
      }
      results.imported++;
      logProgress(i + 1, total, 'invoices');
    } catch (err) {
      results.errors.push(`Row ${rowNum}: ${err.message}`);
      results.skipped++;
    }
  }

  return results;
}

// ============================================
// CLI UTILITIES
// ============================================

/**
 * Log progress every 10 rows or on the last row.
 */
function logProgress(current, total, label) {
  if (current % 10 === 0 || current === total) {
    console.log(`  Processing ${label}: ${current}/${total}`);
  }
}

/**
 * Print the help/usage message and exit.
 */
function printHelp() {
  console.log(`
NM Waves Softball Club - QuickBooks CSV Import Script
=====================================================

Usage:
  node scripts/import-quickbooks.js --type <type> --file <path> [options]

Required:
  --type <type>     Import type: expenses, income, customers, invoices
  --file <path>     Path to the CSV file to import

Options:
  --season <season> Season identifier (default: "${DEFAULT_SEASON}")
  --dry-run         Preview what would be imported without writing to Firestore
  --help            Show this help message

Examples:
  node scripts/import-quickbooks.js --type expenses --file ./imports/expenses.csv
  node scripts/import-quickbooks.js --type income --file ./imports/deposits.csv --season "2024-2025"
  node scripts/import-quickbooks.js --type customers --file ./imports/customers.csv --dry-run
  node scripts/import-quickbooks.js --type invoices --file ./imports/invoices.csv --season "2025-2026"

Import Types:
  expenses    QuickBooks expense/bill reports
              Columns: Date, Vendor, Category, Amount, Payment Method, Check #, Memo
              -> Creates records in the "expenses" Firestore collection

  income      QuickBooks income/deposit reports
              Columns: Date, Source, Category, Amount, Payment Method, Reference #, Memo
              -> Creates records in the "income" Firestore collection

  customers   QuickBooks customer list export
              Columns: Name, Email, Phone, Address, Balance
              -> Creates records in "players" (and "playerFinances" if balance > 0)

  invoices    QuickBooks invoice list export
              Columns: Customer, Date, Amount, Status, Balance Due, Invoice #
              -> Creates records in "playerFinances" (and "income" for paid amounts)

Notes:
  - Column names are matched flexibly (case-insensitive, multiple common variants)
  - QuickBooks categories are automatically mapped to app categories
  - Unmapped categories default to "other"
  - Amounts handle $, commas, and parenthetical negatives: ($500.00) = -500.00
  - Dates accept MM/DD/YYYY, M/D/YYYY, MM-DD-YYYY, and YYYY-MM-DD
  - The --dry-run flag is recommended before your first real import
  - recordedBy is set to "${DEFAULT_RECORDED_BY}" for all imported records
`);
}

/**
 * Parse command-line arguments into a key-value object.
 */
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--type' && i + 1 < argv.length) {
      args.type = argv[++i];
    } else if (arg === '--file' && i + 1 < argv.length) {
      args.file = argv[++i];
    } else if (arg === '--season' && i + 1 < argv.length) {
      args.season = argv[++i];
    } else {
      console.error(`Unknown argument: ${arg}`);
      console.error('Run with --help for usage information.');
      process.exit(1);
    }
  }
  return args;
}

// ============================================
// MAIN
// ============================================

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // Validate arguments
  if (!args.type) {
    console.error('Error: --type is required.');
    console.error('Valid types: ' + VALID_TYPES.join(', '));
    console.error('Run with --help for usage information.');
    process.exit(1);
  }

  if (!VALID_TYPES.includes(args.type)) {
    console.error(`Error: Invalid type "${args.type}".`);
    console.error('Valid types: ' + VALID_TYPES.join(', '));
    process.exit(1);
  }

  if (!args.file) {
    console.error('Error: --file is required.');
    console.error('Run with --help for usage information.');
    process.exit(1);
  }

  const filePath = resolve(args.file);
  if (!existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  const season = args.season || DEFAULT_SEASON;
  const dryRun = args.dryRun || false;

  // Read and parse CSV
  console.log('');
  console.log('='.repeat(60));
  console.log('NM Waves - QuickBooks CSV Import');
  console.log('='.repeat(60));
  console.log(`  Type:    ${args.type}`);
  console.log(`  File:    ${filePath}`);
  console.log(`  Season:  ${season}`);
  console.log(`  Mode:    ${dryRun ? 'DRY RUN (no data will be written)' : 'LIVE IMPORT'}`);
  console.log('='.repeat(60));
  console.log('');

  let csvText;
  try {
    csvText = readFileSync(filePath, 'utf-8');
  } catch (err) {
    console.error(`Error reading file: ${err.message}`);
    process.exit(1);
  }

  let rows;
  try {
    rows = parseCSV(csvText);
  } catch (err) {
    console.error(`Error parsing CSV: ${err.message}`);
    process.exit(1);
  }

  if (rows.length === 0) {
    console.log('No data rows found in CSV file.');
    process.exit(0);
  }

  console.log(`Found ${rows.length} data row(s) in CSV.`);

  // Show detected columns
  const columns = Object.keys(rows[0]);
  console.log(`Detected columns: ${columns.join(', ')}`);
  console.log('');

  // Run the appropriate importer
  let results;
  const startTime = Date.now();

  switch (args.type) {
    case 'expenses':
      results = await importExpenses(rows, season, dryRun);
      break;
    case 'income':
      results = await importIncome(rows, season, dryRun);
      break;
    case 'customers':
      results = await importCustomers(rows, season, dryRun);
      break;
    case 'invoices':
      results = await importInvoices(rows, season, dryRun);
      break;
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Print summary
  console.log('');
  console.log('='.repeat(60));
  console.log('IMPORT SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Type:      ${args.type}`);
  console.log(`  Mode:      ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`  Total rows:  ${rows.length}`);
  console.log(`  Imported:    ${results.imported}`);
  console.log(`  Skipped:     ${results.skipped}`);
  console.log(`  Errors:      ${results.errors.length}`);
  console.log(`  Time:        ${elapsed}s`);

  if (results.errors.length > 0) {
    console.log('');
    console.log('ERRORS:');
    for (const err of results.errors) {
      console.log(`  - ${err}`);
    }
  }

  console.log('='.repeat(60));

  if (dryRun) {
    console.log('');
    console.log('This was a dry run. No data was written to Firestore.');
    console.log('Remove --dry-run to perform the actual import.');
  }

  console.log('');
  process.exit(results.errors.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
