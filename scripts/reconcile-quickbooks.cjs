/**
 * QuickBooks → Firestore Reconciliation Script
 *
 * Imports all financial data from QuickBooks CSV exports into Firestore so the app
 * matches QB exactly. Covers:
 *   1. Player finances (invoices + payments per player)
 *   2. Expenses (vendor payments)
 *   3. Income records (player payments + sponsor payments)
 *
 * Data source: QuickBooks CSV exports from Aug 1, 2025 – Mar 15, 2026
 *
 * Usage:
 *   node scripts/reconcile-quickbooks.cjs --dry-run     (preview changes)
 *   node scripts/reconcile-quickbooks.cjs               (execute changes)
 */

const admin = require('firebase-admin');
const path = require('path');

// Init Firebase Admin
const serviceAccount = require(path.resolve(__dirname, '../serviceAccountKey.json'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

const DRY_RUN = process.argv.includes('--dry-run');
const SEASON = '2025-2026';
const RECORDED_BY = 'qb_reconciliation';

// Bank account balance as of March 15, 2026
const BANK_BALANCE = 2373.94;
const BANK_ACCOUNT_NAME = 'NOWDDA 0001 (8332)';
const BANK_NAME = 'Northpointe Bank';

// ============================================================================
// QB DATA: Player invoices and payments (from Transaction List by Customer CSV)
// Only includes players — sponsors handled separately below
// ============================================================================

const PLAYER_DATA = [
  {
    name: 'Abbygail Mack',
    invoices: [
      { date: '2025-09-14', num: '1224', amount: 100 },
      { date: '2025-09-14', num: '1295', amount: 250 },
      { date: '2025-11-24', num: '1320', amount: 250 },
      { date: '2026-01-13', num: '3', amount: 110 },
    ],
    payments: [
      { date: '2025-08-14', amount: 100, method: 'venmo', reference: 'From Coach' },
    ],
    totalInvoiced: 710,
    outstandingBalance: 610,
  },
  {
    name: 'Abigail Gaylord',
    invoices: [
      { date: '2025-09-14', num: '1238', amount: 100 },
      { date: '2025-09-14', num: '1259', amount: 250 },
      { date: '2025-11-21', num: '1300', amount: 250 },
      { date: '2026-01-13', num: '17', amount: 200 },
    ],
    payments: [
      { date: '2026-01-31', amount: 800, method: 'other', reference: 'QB reconciliation - paid in full' },
    ],
    totalInvoiced: 800,
    outstandingBalance: 0,
  },
  {
    name: 'Alyiah Grody',
    invoices: [
      { date: '2025-09-14', num: '1226', amount: 100 },
      { date: '2025-09-14', num: '1294', amount: 250 },
      { date: '2025-11-24', num: '1321', amount: 250 },
      { date: '2026-01-13', num: '4', amount: 110 },
      { date: '2026-03-08', num: '43', amount: 160 },
    ],
    payments: [
      { date: '2025-08-14', amount: 100, method: 'venmo', reference: 'From Coach' },
      { date: '2025-09-26', amount: 250, method: 'credit_card', reference: 'QB Payments 020311' },
      { date: '2025-12-04', amount: 250, method: 'credit_card', reference: 'QB Payments 064025' },
      { date: '2026-01-14', amount: 110, method: 'credit_card', reference: 'QB Payments 021537' },
      { date: '2026-03-11', amount: 160, method: 'credit_card', reference: 'QB Payments 005602' },
    ],
    totalInvoiced: 870,
    outstandingBalance: 0,
  },
  {
    name: 'Aubrey Milliron',
    invoices: [
      { date: '2025-09-14', num: '1245', amount: 100 },
      { date: '2025-09-14', num: '1268', amount: 250 },
      { date: '2025-11-21', num: '1301', amount: 250 },
      { date: '2026-01-13', num: '18', amount: 200 },
    ],
    payments: [
      { date: '2025-08-15', amount: 100, method: 'bank_transfer', reference: 'Bank deposit' },
      { date: '2025-09-14', amount: 250, method: 'credit_card', reference: 'QB Payments 560-277' },
      { date: '2025-11-24', amount: 250, method: 'credit_card', reference: 'QB Payments 205766' },
      { date: '2026-01-13', amount: 200, method: 'credit_card', reference: 'QB Payments 400215' },
    ],
    totalInvoiced: 800,
    outstandingBalance: 0,
  },
  {
    name: 'Ava Wilson',
    invoices: [
      { date: '2025-09-14', num: '1246', amount: 100 },
      { date: '2025-09-14', num: '1270', amount: 250 },
      { date: '2025-11-24', num: '1313', amount: 250 },
      { date: '2026-01-13', num: '25', amount: 150 },
    ],
    payments: [
      { date: '2025-08-05', amount: 100, method: 'venmo', reference: 'Venmo' },
      { date: '2025-09-14', amount: 250, method: 'credit_card', reference: 'QB Payments 1aribes132137367' },
      { date: '2025-11-24', amount: 250, method: 'credit_card', reference: 'QB Payments 57921Z' },
      { date: '2026-01-13', amount: 150, method: 'credit_card', reference: 'QB Payments 1artun916223' },
    ],
    totalInvoiced: 750,
    outstandingBalance: 0,
  },
  {
    name: 'Callie Magee',
    invoices: [
      { date: '2025-09-14', num: '1241', amount: 100 },
      { date: '2025-09-14', num: '1264', amount: 250 },
      // Credit Memo #42 on 03/08/2026 for -$250 (dropped from team)
    ],
    payments: [
      { date: '2025-08-15', amount: 100, method: 'bank_transfer', reference: 'Bank deposit' },
    ],
    totalInvoiced: 100, // $350 - $250 credit memo = $100 net
    outstandingBalance: 0,
  },
  {
    name: 'Claire Schramski',
    invoices: [
      { date: '2025-09-14', num: '1237', amount: 100 },
      { date: '2025-09-14', num: '1261', amount: 250 },
      { date: '2025-11-21', num: '1298', amount: 250 },
      { date: '2026-01-13', num: '15', amount: 200 },
    ],
    payments: [
      { date: '2025-08-15', amount: 100, method: 'bank_transfer', reference: 'Bank deposit' },
      { date: '2025-09-29', amount: 250, method: 'credit_card', reference: 'QB Payments 05869D' },
      { date: '2025-12-09', amount: 250, method: 'credit_card', reference: 'QB Payments 06371B' },
    ],
    totalInvoiced: 800,
    outstandingBalance: 200,
  },
  {
    name: 'Courtney Hardy',
    invoices: [
      { date: '2025-09-14', num: '1257', amount: 100 },
      { date: '2025-09-14', num: '1282', amount: 250 },
      { date: '2025-11-24', num: '1314', amount: 250 },
      { date: '2026-01-13', num: '26', amount: 150 },
    ],
    payments: [
      { date: '2025-09-14', amount: 800, method: 'check', reference: 'Check #857683' },
      { date: '2024-08-19', amount: 135, method: 'other', reference: 'Prior season credit carry-forward' },
    ],
    totalInvoiced: 750,
    outstandingBalance: -185, // $185 credit (overpaid)
  },
  {
    name: 'Dakota Hall',
    invoices: [
      { date: '2025-09-14', num: '1231', amount: 100 },
      { date: '2025-09-14', num: '1290', amount: 250 },
      { date: '2025-11-24', num: '1322', amount: 250 },
      { date: '2026-01-13', num: '5', amount: 110 },
      { date: '2026-03-08', num: '44', amount: 160 },
    ],
    payments: [
      { date: '2025-08-14', amount: 100, method: 'venmo', reference: 'From Coach' },
      { date: '2025-09-15', amount: 250, method: 'credit_card', reference: 'QB Payments 055111' },
      { date: '2025-12-03', amount: 250, method: 'credit_card', reference: 'QB Payments 012559' },
      { date: '2026-01-24', amount: 110, method: 'credit_card', reference: 'QB Payments 094026' },
      { date: '2026-03-09', amount: 160, method: 'credit_card', reference: 'QB Payments 050653' },
    ],
    totalInvoiced: 870,
    outstandingBalance: 0,
  },
  {
    name: 'Elliott Foerster',
    invoices: [
      { date: '2025-09-14', num: '1251', amount: 100 },
      { date: '2025-09-14', num: '1276', amount: 250 },
      { date: '2025-11-24', num: '1315', amount: 250 },
      { date: '2026-01-13', num: '27', amount: 150 },
    ],
    payments: [
      { date: '2025-08-04', amount: 100, method: 'venmo', reference: 'Venmo' },
      { date: '2025-09-25', amount: 250, method: 'credit_card', reference: 'QB Payments 065306' },
      { date: '2025-12-06', amount: 250, method: 'credit_card', reference: 'QB Payments 084903' },
      { date: '2026-02-12', amount: 150, method: 'credit_card', reference: 'QB Payments 000002' },
    ],
    totalInvoiced: 750,
    outstandingBalance: 0,
  },
  {
    name: 'Emersyn Westphal',
    invoices: [
      { date: '2025-08-05', num: '39', amount: 100 },
    ],
    payments: [
      { date: '2025-08-05', amount: 100, method: 'venmo', reference: 'Venmo' },
    ],
    totalInvoiced: 100,
    outstandingBalance: 0,
  },
  {
    name: 'Emily Jetter',
    invoices: [
      { date: '2025-09-14', num: '1244', amount: 100 },
      { date: '2025-09-14', num: '1267', amount: 250 },
      { date: '2025-11-21', num: '1302', amount: 250 },
      { date: '2026-01-13', num: '19', amount: 200 },
    ],
    payments: [
      { date: '2025-08-15', amount: 100, method: 'bank_transfer', reference: 'Bank deposit' },
      { date: '2025-10-03', amount: 250, method: 'credit_card', reference: 'QB Payments 1arkaump12030968' },
      { date: '2025-12-04', amount: 250, method: 'credit_card', reference: 'QB Payments 1arqkikd9179' },
    ],
    totalInvoiced: 800,
    outstandingBalance: 200,
  },
  {
    name: 'Haven Oliver',
    invoices: [
      { date: '2025-09-14', num: '1249', amount: 100 },
      { date: '2025-09-14', num: '1273', amount: 250 },
      { date: '2025-11-24', num: '1316', amount: 250 },
      { date: '2026-01-13', num: '28', amount: 150 },
    ],
    payments: [
      { date: '2025-08-23', amount: 100, method: 'venmo', reference: 'Venmo' },
      { date: '2025-09-25', amount: 250, method: 'credit_card', reference: 'QB Payments 300383' },
      { date: '2025-12-02', amount: 100, method: 'credit_card', reference: 'QB Payments 777298' },
      { date: '2025-12-13', amount: 150, method: 'credit_card', reference: 'QB Payments 352718' },
    ],
    totalInvoiced: 750,
    outstandingBalance: 150,
  },
  {
    name: 'Kaedynce Lewis',
    invoices: [
      { date: '2025-09-14', num: '1234', amount: 100 },
      { date: '2025-09-14', num: '1285', amount: 250 },
      { date: '2025-11-24', num: '1323', amount: 250 },
      { date: '2026-01-13', num: '6', amount: 110 },
      { date: '2026-03-08', num: '46', amount: 160 },
    ],
    payments: [
      { date: '2025-08-08', amount: 100, method: 'other', reference: '1058 Diggin Designs' },
      { date: '2025-09-18', amount: 250, method: 'credit_card', reference: 'QB Payments 889048' },
      { date: '2025-12-09', amount: 250, method: 'credit_card', reference: 'QB Payments 382357' },
      { date: '2026-02-07', amount: 110, method: 'credit_card', reference: 'QB Payments 353332' },
    ],
    totalInvoiced: 870,
    outstandingBalance: 160,
  },
  {
    name: 'Kallie Keillor',
    invoices: [
      { date: '2025-09-14', num: '1250', amount: 100 },
      // Invoice 1275 voided ($0)
      { date: '2025-09-14', num: '1279', amount: 250 },
      { date: '2025-11-21', num: '1308', amount: 250 },
      { date: '2026-01-13', num: '29', amount: 150 },
    ],
    payments: [
      { date: '2025-08-01', amount: 100, method: 'venmo', reference: 'Venmo' },
      { date: '2025-09-16', amount: 250, method: 'credit_card', reference: 'QB Payments 704-157' },
      { date: '2025-12-01', amount: 250, method: 'credit_card', reference: 'QB Payments 089859' },
      { date: '2026-01-14', amount: 150, method: 'credit_card', reference: 'QB Payments 084256' },
    ],
    totalInvoiced: 750,
    outstandingBalance: 0,
  },
  {
    name: 'Katie Vandergriff',
    invoices: [
      { date: '2025-09-14', num: '1240', amount: 100 },
      { date: '2025-09-14', num: '1263', amount: 250 },
      { date: '2025-11-21', num: '1303', amount: 250 },
      { date: '2026-01-13', num: '20', amount: 200 },
    ],
    payments: [
      { date: '2026-01-31', amount: 800, method: 'other', reference: 'QB reconciliation - paid in full' },
    ],
    totalInvoiced: 800,
    outstandingBalance: 0,
  },
  {
    name: 'Kyli Hellebuyck',
    invoices: [
      { date: '2026-03-08', num: '48', amount: 800 },
    ],
    payments: [],
    totalInvoiced: 800,
    outstandingBalance: 800,
  },
  {
    name: 'Lillian Beaver',
    invoices: [
      { date: '2025-09-14', num: '1254', amount: 100 },
      { date: '2025-09-14', num: '1274', amount: 250 },
      { date: '2025-11-24', num: '1317', amount: 250 },
      { date: '2026-01-13', num: '30', amount: 150 },
    ],
    payments: [
      { date: '2025-08-04', amount: 100, method: 'venmo', reference: 'Venmo' },
      { date: '2025-09-20', amount: 250, method: 'credit_card', reference: 'QB Payments 01025G' },
      { date: '2026-01-21', amount: 150, method: 'credit_card', reference: 'QB Payments 05325G' },
      { date: '2026-01-21', amount: 250, method: 'credit_card', reference: 'QB Payments 09169G' },
    ],
    totalInvoiced: 750,
    outstandingBalance: 0,
  },
  {
    name: 'Lola Schwab',
    invoices: [
      { date: '2025-09-14', num: '1232', amount: 100 },
      { date: '2025-09-14', num: '1286', amount: 250 },
      { date: '2025-11-24', num: '1324', amount: 250 },
      { date: '2026-01-13', num: '7', amount: 110 },
      { date: '2026-03-08', num: '45', amount: 160 },
    ],
    payments: [
      { date: '2025-08-14', amount: 100, method: 'venmo', reference: 'From Coach' },
      { date: '2025-09-15', amount: 250, method: 'credit_card', reference: 'QB Payments 1arig48l72638760' },
      { date: '2025-11-24', amount: 250, method: 'credit_card', reference: 'QB Payments 004289' },
      { date: '2026-01-19', amount: 110, method: 'credit_card', reference: 'QB Payments 009876' },
    ],
    totalInvoiced: 870,
    outstandingBalance: 160,
  },
  {
    name: 'Mackenzie Black',
    invoices: [
      { date: '2025-09-14', num: '1253', amount: 100 },
      { date: '2025-09-14', num: '1278', amount: 250 },
      { date: '2025-11-24', num: '1309', amount: 250 },
      { date: '2026-01-13', num: '31', amount: 150 },
    ],
    payments: [
      { date: '2025-09-21', amount: 250, method: 'credit_card', reference: 'QB Payments 003327' },
      { date: '2025-12-06', amount: 100, method: 'credit_card', reference: 'QB Payments 075059' },
      { date: '2026-02-01', amount: 150, method: 'credit_card', reference: 'QB Payments 080040' },
    ],
    totalInvoiced: 750,
    outstandingBalance: 250,
  },
  {
    name: 'Mackenzie Tobian',
    invoices: [
      { date: '2025-09-14', num: '1229', amount: 100 },
      { date: '2025-09-14', num: '1288', amount: 250 },
      { date: '2025-11-24', num: '1325', amount: 250 },
      { date: '2026-01-13', num: '8', amount: 110 },
    ],
    payments: [
      { date: '2026-01-31', amount: 710, method: 'other', reference: 'QB reconciliation - paid in full' },
    ],
    totalInvoiced: 710,
    outstandingBalance: 0,
  },
  {
    name: 'Maddi Jerzyk',
    invoices: [
      { date: '2025-09-14', num: '1230', amount: 100 },
      { date: '2025-09-14', num: '1289', amount: 250 },
      { date: '2025-11-24', num: '1326', amount: 250 },
      { date: '2026-01-13', num: '9', amount: 110 },
    ],
    payments: [
      { date: '2025-08-14', amount: 100, method: 'venmo', reference: 'From Coach' },
      { date: '2025-09-15', amount: 250, method: 'credit_card', reference: 'QB Payments 481-087' },
      { date: '2025-12-09', amount: 250, method: 'credit_card', reference: 'QB Payments 090406' },
    ],
    totalInvoiced: 710,
    outstandingBalance: 110,
  },
  {
    name: 'Madeline Olds',
    invoices: [
      { date: '2025-09-14', num: '1243', amount: 100 },
      { date: '2025-09-14', num: '1266', amount: 250 },
      { date: '2025-11-21', num: '1304', amount: 250 },
      { date: '2026-01-13', num: '21', amount: 200 },
    ],
    payments: [
      { date: '2025-08-15', amount: 100, method: 'bank_transfer', reference: 'Bank deposit' },
      { date: '2025-09-19', amount: 250, method: 'credit_card', reference: 'QB Payments 305458' },
      { date: '2025-12-02', amount: 250, method: 'credit_card', reference: 'QB Payments 678-497' },
      { date: '2026-02-21', amount: 200, method: 'credit_card', reference: 'QB Payments 109-96m' },
    ],
    totalInvoiced: 800,
    outstandingBalance: 0,
  },
  {
    name: 'Madelyn Stevenson',
    invoices: [
      { date: '2025-09-14', num: '1247', amount: 100 },
      { date: '2025-09-14', num: '1271', amount: 250 },
      { date: '2025-11-24', num: '1318', amount: 250 },
      { date: '2026-01-13', num: '32', amount: 150 },
    ],
    payments: [
      { date: '2025-08-04', amount: 100, method: 'venmo', reference: 'Venmo' },
      { date: '2025-09-16', amount: 250, method: 'credit_card', reference: 'QB Payments 941-827' },
      { date: '2026-01-07', amount: 250, method: 'credit_card', reference: 'QB Payments 072257' },
      { date: '2026-03-05', amount: 150, method: 'credit_card', reference: 'QB Payments 149-o1a' },
    ],
    totalInvoiced: 750,
    outstandingBalance: 0,
  },
  {
    name: 'Maren Boysen',
    invoices: [
      { date: '2025-09-14', num: '1255', amount: 100 },
      { date: '2025-09-14', num: '1280', amount: 250 },
      { date: '2025-11-24', num: '1310', amount: 250 },
      { date: '2026-01-13', num: '33', amount: 150 },
    ],
    payments: [
      { date: '2025-08-07', amount: 100, method: 'venmo', reference: 'Venmo' },
      { date: '2025-09-16', amount: 250, method: 'credit_card', reference: 'QB Payments 09696D' },
      { date: '2025-12-10', amount: 250, method: 'credit_card', reference: 'QB Payments 07539D' },
    ],
    totalInvoiced: 750,
    outstandingBalance: 150,
  },
  {
    name: 'Maren Ludka',
    invoices: [
      { date: '2025-09-14', num: '1227', amount: 100 },
      { date: '2025-09-14', num: '1293', amount: 250 },
      { date: '2025-11-24', num: '1327', amount: 250 },
      { date: '2026-01-13', num: '10', amount: 110 },
    ],
    payments: [
      { date: '2025-08-14', amount: 100, method: 'venmo', reference: 'From Coach' },
      { date: '2025-11-24', amount: 250, method: 'credit_card', reference: 'QB Payments 06593D' },
      { date: '2025-12-10', amount: 250, method: 'credit_card', reference: 'QB Payments 01094Q' },
    ],
    totalInvoiced: 710,
    outstandingBalance: 110,
  },
  {
    name: 'Mariah Gibel',
    invoices: [
      { date: '2025-09-14', num: '1225', amount: 100 },
      { date: '2025-09-14', num: '1283', amount: 250 },
      { date: '2025-11-24', num: '1328', amount: 250 },
      { date: '2026-01-13', num: '11', amount: 110 },
      { date: '2026-03-08', num: '47', amount: 160 },
    ],
    payments: [
      { date: '2025-09-15', amount: 250, method: 'credit_card', reference: 'QB Payments 115899' },
      { date: '2025-12-09', amount: 250, method: 'credit_card', reference: 'QB Payments 044672' },
      { date: '2026-01-23', amount: 110, method: 'credit_card', reference: 'QB Payments 937932' },
    ],
    totalInvoiced: 870,
    outstandingBalance: 260,
  },
  {
    name: 'Maya Dorman',
    invoices: [
      { date: '2025-09-14', num: '1236', amount: 100 },
      { date: '2025-09-14', num: '1260', amount: 250 },
      { date: '2025-11-21', num: '1305', amount: 250 },
      { date: '2026-01-13', num: '22', amount: 200 },
    ],
    payments: [
      { date: '2025-08-15', amount: 100, method: 'bank_transfer', reference: 'Bank deposit' },
      { date: '2025-10-09', amount: 250, method: 'bank_transfer', reference: 'Bank transfer' },
      { date: '2025-11-21', amount: 250, method: 'bank_transfer', reference: 'Bank transfer' },
      { date: '2025-12-12', amount: 250, method: 'venmo', reference: 'Venmo' },
    ],
    totalInvoiced: 800,
    outstandingBalance: -50, // $50 credit (overpaid)
  },
  {
    name: 'Meg Babich',
    invoices: [
      { date: '2025-09-14', num: '1252', amount: 100 },
      { date: '2025-09-14', num: '1277', amount: 250 },
      { date: '2025-11-24', num: '1311', amount: 250 },
      { date: '2026-01-13', num: '34', amount: 150 },
    ],
    payments: [
      { date: '2025-08-04', amount: 100, method: 'venmo', reference: 'Venmo' },
      { date: '2026-01-21', amount: 250, method: 'credit_card', reference: 'QB Payments 06801G' },
    ],
    totalInvoiced: 750,
    outstandingBalance: 400,
  },
  {
    name: 'Paisley Newman',
    invoices: [
      { date: '2025-09-14', num: '1248', amount: 100 },
      { date: '2025-09-14', num: '1272', amount: 250 },
      { date: '2025-11-24', num: '1312', amount: 250 },
      { date: '2026-01-13', num: '35', amount: 150 },
    ],
    payments: [
      { date: '2025-08-09', amount: 100, method: 'venmo', reference: 'Venmo' },
      { date: '2025-09-21', amount: 250, method: 'credit_card', reference: 'QB Payments 692952' },
      { date: '2025-11-27', amount: 250, method: 'credit_card', reference: 'QB Payments 03207C' },
      { date: '2026-01-26', amount: 150, method: 'credit_card', reference: 'QB Payments 852698' },
    ],
    totalInvoiced: 750,
    outstandingBalance: 0,
  },
  {
    name: 'Ruby Gorman',
    invoices: [
      { date: '2025-08-15', num: '1258', amount: 100 },
      { date: '2025-09-14', num: '1269', amount: 250 },
      { date: '2025-11-21', num: '1306', amount: 250 },
      { date: '2026-01-13', num: '23', amount: 200 },
    ],
    payments: [
      { date: '2025-08-15', amount: 100, method: 'bank_transfer', reference: 'Bank deposit' },
      { date: '2025-10-09', amount: 250, method: 'venmo', reference: 'Venmo' },
    ],
    totalInvoiced: 800,
    outstandingBalance: 450,
  },
  {
    name: 'Skylar Yanska',
    invoices: [
      { date: '2025-09-14', num: '1256', amount: 100 },
      { date: '2025-09-14', num: '1281', amount: 250 },
      { date: '2025-11-24', num: '1319', amount: 250 },
      { date: '2026-01-13', num: '36', amount: 150 },
    ],
    payments: [],
    totalInvoiced: 750,
    outstandingBalance: 750,
  },
  {
    name: 'Stephanie Dyke',
    invoices: [
      { date: '2025-09-14', num: '1233', amount: 100 },
      { date: '2025-09-14', num: '1292', amount: 250 },
      { date: '2025-11-24', num: '1329', amount: 250 },
      { date: '2026-01-13', num: '12', amount: 110 },
    ],
    payments: [
      { date: '2025-08-14', amount: 100, method: 'venmo', reference: 'From Coach' },
      { date: '2025-09-15', amount: 250, method: 'credit_card', reference: 'QB Payments 015843' },
      { date: '2025-12-01', amount: 250, method: 'credit_card', reference: 'QB Payments 1arq66tp2720' },
      { date: '2026-01-16', amount: 110, method: 'credit_card', reference: 'QB Payments 1aru65x37771' },
    ],
    totalInvoiced: 710,
    outstandingBalance: 0,
  },
  {
    name: 'Summer Kozlowski',
    invoices: [
      { date: '2025-09-14', num: '1228', amount: 100 },
      { date: '2025-09-14', num: '1284', amount: 250 },
      { date: '2025-11-24', num: '1330', amount: 250 },
      { date: '2026-01-13', num: '13', amount: 110 },
    ],
    payments: [
      { date: '2025-08-14', amount: 100, method: 'venmo', reference: 'From Coach' },
      { date: '2025-09-19', amount: 250, method: 'credit_card', reference: 'QB Payments 1aritd8j35159158' },
      { date: '2025-11-28', amount: 250, method: 'credit_card', reference: 'QB Payments 1arpx1w18711' },
      { date: '2026-01-26', amount: 110, method: 'credit_card', reference: 'QB Payments 1aruur733609' },
    ],
    totalInvoiced: 710,
    outstandingBalance: 0,
  },
  {
    name: 'Tessa Bush',
    invoices: [
      { date: '2025-09-14', num: '1239', amount: 100 },
      { date: '2025-09-14', num: '1262', amount: 250 },
      { date: '2025-11-21', num: '1299', amount: 250 },
      { date: '2026-01-13', num: '16', amount: 200 },
    ],
    payments: [
      { date: '2025-08-15', amount: 100, method: 'bank_transfer', reference: 'Bank deposit' },
      { date: '2025-09-26', amount: 250, method: 'credit_card', reference: 'QB Payments 334131' },
      { date: '2025-11-30', amount: 250, method: 'credit_card', reference: 'QB Payments 857068' },
    ],
    totalInvoiced: 800,
    outstandingBalance: 200,
  },
  {
    name: 'Zoey Willson',
    invoices: [
      { date: '2025-09-14', num: '1235', amount: 100 },
      { date: '2025-09-14', num: '1287', amount: 250 },
      { date: '2025-11-24', num: '1331', amount: 250 },
      { date: '2026-01-13', num: '14', amount: 110 },
    ],
    payments: [
      { date: '2025-08-14', amount: 100, method: 'venmo', reference: 'From Coach' },
      { date: '2025-09-24', amount: 250, method: 'venmo', reference: 'Venmo' },
      { date: '2026-01-12', amount: 250, method: 'credit_card', reference: 'QB Payments 306948' },
    ],
    totalInvoiced: 710,
    outstandingBalance: 110,
  },
  {
    name: 'Zuliette Marsh',
    invoices: [
      { date: '2025-09-14', num: '1242', amount: 100 },
      { date: '2025-09-14', num: '1265', amount: 250 },
      { date: '2025-11-21', num: '1307', amount: 250 },
      { date: '2026-01-13', num: '24', amount: 200 },
    ],
    payments: [
      { date: '2025-08-15', amount: 100, method: 'bank_transfer', reference: 'Bank deposit' },
      { date: '2025-09-27', amount: 250, method: 'credit_card', reference: 'QB Payments 692522' },
    ],
    totalInvoiced: 800,
    outstandingBalance: 450,
  },
];

// ============================================================================
// QB DATA: Sponsor payments
// ============================================================================

const SPONSOR_DATA = [
  {
    name: 'Feola Holdings',
    invoiceDate: '2025-10-01',
    invoiceNum: '40',
    invoiceAmount: 1000,
    paymentDate: '2025-11-26',
    paymentAmount: 1000,
    paymentMethod: 'other',
    reference: 'Undeposited Funds',
  },
  {
    name: 'FiberNorth, Inc.',
    invoiceDate: '2025-10-01',
    invoiceNum: '37',
    invoiceAmount: 750,
    paymentDate: '2025-10-01',
    paymentAmount: 750,
    paymentMethod: 'bank_transfer',
    reference: 'Paid directly to March Mayhem',
  },
  {
    name: 'Yanska Investments',
    invoiceDate: '2025-11-01',
    invoiceNum: '41',
    invoiceAmount: 1000,
    paymentDate: '2025-11-03',
    paymentAmount: 1000,
    paymentMethod: 'check',
    reference: 'Check #674911',
  },
];

// ============================================================================
// QB DATA: Expenses (from Transaction List by Vendor CSV)
// Excludes QB Payment processing fees — those are handled separately
// ============================================================================

const EXPENSE_DATA = [
  {
    vendor: 'ALLSPORTDESIGNS.COM',
    items: [
      { date: '2025-10-06', amount: 288.69, description: 'Custom sports designs order', category: 'uniforms', method: 'credit_card' },
      { date: '2025-10-16', amount: 32.00, description: 'Additional order', category: 'uniforms', method: 'credit_card' },
    ],
  },
  {
    vendor: 'Amanda Gibel',
    items: [
      { date: '2025-09-26', amount: 106.25, description: 'MVP necklaces', category: 'equipment', method: 'venmo' },
    ],
  },
  {
    vendor: 'Anchor Point Athletics',
    items: [
      { date: '2025-12-21', amount: 3000.00, description: 'Indoor facility rental', category: 'facilities', method: 'check', checkNum: '1081' },
    ],
  },
  {
    vendor: 'BCS, LLC',
    items: [
      { date: '2026-02-17', amount: 800.00, description: 'Facility rental', category: 'facilities', method: 'check', checkNum: '1084' },
    ],
  },
  {
    vendor: 'Blue Chip',
    items: [
      { date: '2025-10-28', amount: 78.36, description: 'Team registration', category: 'tournaments', method: 'credit_card' },
    ],
  },
  {
    vendor: 'Byte Productions',
    items: [
      { date: '2025-10-01', amount: 30.00, description: 'Website/production services', category: 'administrative', method: 'credit_card' },
      { date: '2025-11-03', amount: 30.00, description: 'Website/production services', category: 'administrative', method: 'credit_card' },
      { date: '2026-01-20', amount: 60.00, description: 'Website/production services', category: 'administrative', method: 'check' },
      { date: '2026-02-02', amount: 30.00, description: 'Website/production services', category: 'administrative', method: 'check' },
    ],
  },
  {
    vendor: 'Cheboygan Chaos',
    items: [
      { date: '2025-11-29', amount: 1050.00, description: '12u and 13u tournament entry', category: 'tournaments', method: 'check', checkNum: '1078' },
    ],
  },
  {
    vendor: 'Epic Sports',
    items: [
      { date: '2025-09-04', amount: 333.89, description: 'Equipment/supplies order', category: 'equipment', method: 'credit_card' },
    ],
  },
  {
    vendor: 'Kevin Olds',
    items: [
      { date: '2025-10-05', amount: 105.00, description: 'Pizza for scrimmage', category: 'other', method: 'venmo' },
    ],
  },
  {
    vendor: 'Mi Corporations Division',
    items: [
      { date: '2025-11-17', amount: 20.00, description: 'State filing fee', category: 'administrative', method: 'check' },
      { date: '2025-11-17', amount: 20.00, description: 'State filing fee', category: 'administrative', method: 'check' },
    ],
  },
  {
    vendor: 'MI Sports Academy',
    items: [
      { date: '2025-11-25', amount: 572.00, description: 'Indoor training facility', category: 'facilities', method: 'check' },
      { date: '2025-11-25', amount: 572.00, description: 'Indoor training facility', category: 'facilities', method: 'check' },
    ],
  },
  {
    vendor: 'Moth Youth Baseball Softball',
    items: [
      { date: '2025-11-29', amount: 600.00, description: 'June 26-28, 2026 tournament entry', category: 'tournaments', method: 'check', checkNum: '1079' },
    ],
  },
  {
    vendor: 'Superior Fastpitch',
    items: [
      { date: '2025-11-29', amount: 650.00, description: 'Tournament entry', category: 'tournaments', method: 'check', checkNum: '1080' },
    ],
  },
  {
    vendor: 'Taylor Richards',
    items: [
      { date: '2025-10-08', amount: 118.25, description: 'Bag plates', category: 'equipment', method: 'venmo' },
    ],
  },
  {
    vendor: 'Threads Custom Gear',
    items: [
      { date: '2025-10-01', amount: 422.10, description: 'Custom gear order', category: 'uniforms', method: 'credit_card' },
      { date: '2025-10-10', amount: 25.00, description: 'Additional custom gear', category: 'uniforms', method: 'credit_card' },
    ],
  },
  {
    vendor: 'Traverse City Waves',
    items: [
      { date: '2026-01-27', amount: 4165.00, description: '12u x 2, 13u x 4, 14u x 1 tournament entries', category: 'tournaments', method: 'check', checkNum: '1083' },
    ],
  },
  {
    vendor: 'William Gaylord',
    items: [
      { date: '2025-11-29', amount: 625.00, description: 'Reimbursement for 14u Midland tournament', category: 'tournaments', method: 'check', checkNum: '1076' },
      { date: '2025-11-29', amount: 1260.00, description: 'Reimbursement for 12u, 13u, 14u Sault tourney', category: 'tournaments', method: 'check', checkNum: '1077' },
    ],
  },
];

// QB Payment processing fees (aggregated by month for cleaner records)
const PROCESSING_FEE_DATA = [
  // CC processing fees (DiscountRateFee) aggregated by month — $406.14 total
  { date: '2025-09-30', amount: 144.64, description: 'QB Payments processing fees - September 2025' },
  { date: '2025-10-31', amount: 7.48, description: 'QB Payments processing fees - October 2025' },
  { date: '2025-11-30', amount: 52.36, description: 'QB Payments processing fees - November 2025' },
  { date: '2025-12-31', amount: 102.73, description: 'QB Payments processing fees - December 2025' },
  { date: '2026-01-31', amount: 73.60, description: 'QB Payments processing fees - January 2026' },
  { date: '2026-02-28', amount: 14.27, description: 'QB Payments processing fees - February 2026' },
  { date: '2026-03-15', amount: 11.06, description: 'QB Payments processing fees - March 2026' },
  // QB Online subscription fees — $460.00 total
  { date: '2025-10-21', amount: 115.00, description: 'QuickBooks Online subscription - October 2025' },
  { date: '2025-11-21', amount: 115.00, description: 'QuickBooks Online subscription - November 2025' },
  { date: '2026-01-15', amount: 115.00, description: 'QuickBooks Online subscription - January 2026' },
  { date: '2026-02-17', amount: 115.00, description: 'QuickBooks Online subscription - February 2026' },
  // Grand total: $866.14 (matches QB Vendor CSV)
];

// ============================================================================
// TEAM MAPPING: Based on invoice totals ($710=12u, $750=13u, $800=14u)
// ============================================================================

function guessTeamTier(totalInvoiced) {
  if (totalInvoiced <= 100) return 'tryout'; // Emersyn Westphal, Callie Magee
  if (totalInvoiced <= 710 + 160) return '12u'; // $710 base or $870 with extra tournament
  if (totalInvoiced <= 750) return '13u';
  return '14u';
}

// ============================================================================
// HELPERS
// ============================================================================

function toTimestamp(dateStr) {
  return admin.firestore.Timestamp.fromDate(new Date(dateStr + 'T12:00:00'));
}

function generatePaymentId() {
  return 'qb_' + Math.random().toString(36).substr(2, 12);
}

/**
 * Build fee breakdown from actual QB invoice amounts.
 * Uniforms are NOT included (paid directly to uniform company).
 * First $100 invoice = registration fee.
 * All remaining invoices = season fees (stored in otherFees).
 */
function buildFeeBreakdown(totalInvoiced, tier, invoices) {
  if (tier === 'tryout') {
    return { registrationFee: totalInvoiced, uniformCost: 0, tournamentFees: 0, facilityFees: 0, equipmentFees: 0, otherFees: 0 };
  }

  // The first $100 invoice is always registration
  const reg = Math.min(100, totalInvoiced);
  // Everything else is season fees (tournaments, facility, etc.) — tracked as a lump sum
  const seasonFees = totalInvoiced - reg;

  return {
    registrationFee: reg,
    uniformCost: 0,
    tournamentFees: 0,
    facilityFees: 0,
    equipmentFees: 0,
    otherFees: seasonFees,
  };
}

// ============================================================================
// MAIN RECONCILIATION
// ============================================================================

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  QuickBooks → Firestore Reconciliation`);
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE (writing to Firestore)'}`);
  console.log(`  Season: ${SEASON}`);
  console.log(`${'='.repeat(60)}\n`);

  // Step 1: Fetch existing players to match names → IDs
  console.log('1. Fetching existing players from Firestore...');
  const playersSnap = await db.collection('players').get();
  const players = {};
  playersSnap.forEach(doc => {
    const d = doc.data();
    const fullName = `${d.firstName} ${d.lastName}`.trim();
    players[fullName.toLowerCase()] = { id: doc.id, ...d };
  });
  console.log(`   Found ${Object.keys(players).length} players\n`);

  // Step 2: Fetch existing teams
  console.log('2. Fetching existing teams...');
  const teamsSnap = await db.collection('teams').get();
  const teams = {};
  teamsSnap.forEach(doc => {
    const d = doc.data();
    teams[doc.id] = d;
  });
  console.log(`   Found ${Object.keys(teams).length} teams\n`);

  // Step 3: Fetch existing playerFinances for this season
  console.log('3. Fetching existing playerFinances...');
  const pfSnap = await db.collection('playerFinances')
    .where('season', '==', SEASON)
    .get();
  const existingPF = {};
  pfSnap.forEach(doc => {
    const d = doc.data();
    existingPF[d.playerName?.toLowerCase()] = { id: doc.id, ...d };
  });
  console.log(`   Found ${Object.keys(existingPF).length} existing records for ${SEASON}\n`);

  // Step 4: Process each player
  console.log('4. Reconciling player finances...');
  let created = 0, updated = 0, skipped = 0, warnings = [];

  for (const pd of PLAYER_DATA) {
    const nameLower = pd.name.toLowerCase();
    const player = players[nameLower];
    const existing = existingPF[nameLower];

    if (!player) {
      warnings.push(`⚠ Player "${pd.name}" not found in Firestore players collection — creating finance record without playerId`);
    }

    const tier = guessTeamTier(pd.totalInvoiced);
    const fees = buildFeeBreakdown(pd.totalInvoiced, tier, pd.invoices);
    const totalPaid = pd.totalInvoiced - pd.outstandingBalance;
    const balance = totalPaid - pd.totalInvoiced; // negative = owes, positive = credit

    // Determine status
    let status = 'current';
    if (pd.outstandingBalance <= 0) status = 'paid';
    else if (pd.outstandingBalance > 0) {
      // Check if any invoice is overdue (> 30 days past)
      const oldestUnpaid = pd.invoices[pd.invoices.length - 1];
      if (oldestUnpaid) {
        const dueDate = new Date(oldestUnpaid.date);
        dueDate.setDate(dueDate.getDate() + 30);
        if (new Date() > dueDate) status = 'overdue';
      }
    }

    // Build payment records
    const paymentRecords = pd.payments.map(pmt => ({
      id: generatePaymentId(),
      amount: pmt.amount,
      date: toTimestamp(pmt.date),
      method: pmt.method,
      reference: pmt.reference,
      notes: `QB import: ${pmt.reference}`,
      payerName: pd.name,
      recordedBy: RECORDED_BY,
      recordedAt: admin.firestore.Timestamp.now(),
      reconciled: true,
      reconciledAt: admin.firestore.Timestamp.now(),
      reconciledBy: RECORDED_BY,
    }));

    // Find team info
    let teamId = player?.teamId || '';
    let teamName = '';
    if (teamId && teams[teamId]) {
      teamName = teams[teamId].name || '';
    } else if (player?.teamIds?.length > 0) {
      teamId = player.teamIds[0];
      teamName = teams[teamId]?.name || '';
    }

    const financeData = {
      playerId: player?.id || '',
      playerName: pd.name,
      teamId,
      teamName,
      season: SEASON,
      ...fees,
      scholarshipAmount: 0,
      assumedCost: pd.totalInvoiced,
      actualCost: pd.totalInvoiced,
      totalOwed: pd.totalInvoiced,
      totalPaid,
      balance,
      balanceDue: pd.outstandingBalance,
      status,
      payments: paymentRecords,
      updatedAt: admin.firestore.Timestamp.now(),
    };

    if (existing) {
      console.log(`   UPDATE: ${pd.name} — owed: $${pd.totalInvoiced}, paid: $${totalPaid}, balance: $${pd.outstandingBalance}`);
      if (!DRY_RUN) {
        await db.collection('playerFinances').doc(existing.id).update(financeData);
      }
      updated++;
    } else {
      console.log(`   CREATE: ${pd.name} — owed: $${pd.totalInvoiced}, paid: $${totalPaid}, balance: $${pd.outstandingBalance}`);
      financeData.createdAt = admin.firestore.Timestamp.now();
      if (!DRY_RUN) {
        await db.collection('playerFinances').add(financeData);
      }
      created++;
    }
  }

  console.log(`\n   Results: ${created} created, ${updated} updated, ${skipped} skipped`);
  if (warnings.length > 0) {
    console.log(`\n   Warnings:`);
    warnings.forEach(w => console.log(`   ${w}`));
  }

  // Step 5: Create expense records
  console.log('\n5. Importing expense records...');
  let expenseCount = 0;

  // Clear existing QB-imported expenses to avoid duplicates
  if (!DRY_RUN) {
    const existingExpenses = await db.collection('expenses')
      .where('recordedBy', '==', RECORDED_BY)
      .where('season', '==', SEASON)
      .get();
    if (existingExpenses.size > 0) {
      console.log(`   Clearing ${existingExpenses.size} previously imported expenses...`);
      const batch = db.batch();
      existingExpenses.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
  }

  for (const vendor of EXPENSE_DATA) {
    for (const item of vendor.items) {
      console.log(`   EXPENSE: ${vendor.vendor} — $${item.amount} (${item.category}) on ${item.date}`);
      if (!DRY_RUN) {
        await db.collection('expenses').add({
          date: toTimestamp(item.date),
          category: item.category,
          amount: item.amount,
          vendor: vendor.vendor,
          description: item.description,
          paymentMethod: item.method,
          checkNumber: item.checkNum || null,
          season: SEASON,
          isPaid: true,
          paidDate: toTimestamp(item.date),
          notes: 'Imported from QuickBooks',
          reconciled: true,
          reconciledAt: admin.firestore.Timestamp.now(),
          reconciledBy: RECORDED_BY,
          recordedBy: RECORDED_BY,
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
        });
      }
      expenseCount++;
    }
  }

  // Processing fees
  for (const fee of PROCESSING_FEE_DATA) {
    const isSubscription = fee.description.includes('subscription');
    console.log(`   EXPENSE: QuickBooks — $${fee.amount} (${isSubscription ? 'administrative' : 'processing_fees'}) on ${fee.date}`);
    if (!DRY_RUN) {
      await db.collection('expenses').add({
        date: toTimestamp(fee.date),
        category: isSubscription ? 'administrative' : 'processing_fees',
        amount: fee.amount,
        vendor: 'QuickBooks Payments',
        description: fee.description,
        paymentMethod: 'other',
        season: SEASON,
        isPaid: true,
        paidDate: toTimestamp(fee.date),
        notes: 'Imported from QuickBooks',
        reconciled: true,
        reconciledAt: admin.firestore.Timestamp.now(),
        reconciledBy: RECORDED_BY,
        recordedBy: RECORDED_BY,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });
    }
    expenseCount++;
  }

  console.log(`\n   Total expenses imported: ${expenseCount}`);

  // Step 6: Create income records for player payments
  console.log('\n6. Importing income records (player payments)...');
  let incomeCount = 0;

  // Clear existing QB-imported income to avoid duplicates
  if (!DRY_RUN) {
    const existingIncome = await db.collection('income')
      .where('recordedBy', '==', RECORDED_BY)
      .where('season', '==', SEASON)
      .get();
    if (existingIncome.size > 0) {
      console.log(`   Clearing ${existingIncome.size} previously imported income records...`);
      const batch = db.batch();
      existingIncome.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
  }

  for (const pd of PLAYER_DATA) {
    const player = players[pd.name.toLowerCase()];
    for (const pmt of pd.payments) {
      if (pmt.amount <= 0) continue;
      console.log(`   INCOME: ${pd.name} — $${pmt.amount} (${pmt.method}) on ${pmt.date}`);
      if (!DRY_RUN) {
        await db.collection('income').add({
          date: toTimestamp(pmt.date),
          category: 'player_payments',
          amount: pmt.amount,
          source: pd.name,
          description: `Player payment from ${pd.name}`,
          payerName: pd.name,
          paymentMethod: pmt.method,
          referenceNumber: pmt.reference,
          playerId: player?.id || '',
          season: SEASON,
          notes: 'Imported from QuickBooks',
          reconciled: true,
          reconciledAt: admin.firestore.Timestamp.now(),
          reconciledBy: RECORDED_BY,
          recordedBy: RECORDED_BY,
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
        });
      }
      incomeCount++;
    }
  }

  // Sponsor income
  for (const sponsor of SPONSOR_DATA) {
    console.log(`   INCOME: ${sponsor.name} — $${sponsor.paymentAmount} (sponsorship) on ${sponsor.paymentDate}`);
    if (!DRY_RUN) {
      await db.collection('income').add({
        date: toTimestamp(sponsor.paymentDate),
        category: 'sponsorships',
        amount: sponsor.paymentAmount,
        source: sponsor.name,
        description: `Sponsorship payment from ${sponsor.name}`,
        payerName: sponsor.name,
        paymentMethod: sponsor.paymentMethod,
        referenceNumber: sponsor.reference,
        season: SEASON,
        notes: `QB Invoice #${sponsor.invoiceNum}. Imported from QuickBooks`,
        reconciled: true,
        reconciledAt: admin.firestore.Timestamp.now(),
        reconciledBy: RECORDED_BY,
        recordedBy: RECORDED_BY,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });
    }
    incomeCount++;
  }

  console.log(`\n   Total income records imported: ${incomeCount}`);

  // Step 7: Set bank account balance
  console.log('\n7. Setting bank account balance...');
  const accountsSnap = await db.collection('accounts').get();
  let bankAccountId = null;
  accountsSnap.forEach(doc => {
    const d = doc.data();
    if (d.type === 'checking' || d.name?.includes('NOWDDA') || d.name?.includes('Northpointe')) {
      bankAccountId = doc.id;
    }
  });

  const bankData = {
    name: BANK_ACCOUNT_NAME,
    type: 'checking',
    bankName: BANK_NAME,
    balance: BANK_BALANCE,
    active: true,
    lastReconciled: admin.firestore.Timestamp.fromDate(new Date('2026-03-15T12:00:00')),
    notes: `Balance verified from QuickBooks as of March 15, 2026`,
    updatedAt: admin.firestore.Timestamp.now(),
  };

  if (bankAccountId) {
    console.log(`   UPDATE: Bank account "${BANK_ACCOUNT_NAME}" → $${BANK_BALANCE}`);
    if (!DRY_RUN) {
      await db.collection('accounts').doc(bankAccountId).update(bankData);
    }
  } else {
    console.log(`   CREATE: Bank account "${BANK_ACCOUNT_NAME}" → $${BANK_BALANCE}`);
    bankData.createdAt = admin.firestore.Timestamp.now();
    if (!DRY_RUN) {
      await db.collection('accounts').add(bankData);
    }
  }

  // Also create/update Venmo account if not exists
  let venmoId = null;
  accountsSnap.forEach(doc => {
    if (doc.data().name?.toLowerCase().includes('venmo')) venmoId = doc.id;
  });
  if (!venmoId) {
    console.log('   CREATE: Venmo account (secondary payment method)');
    if (!DRY_RUN) {
      await db.collection('accounts').add({
        name: 'Venmo',
        type: 'other',
        bankName: 'PayPal/Venmo',
        balance: 0,
        active: true,
        notes: 'Used for coach collections and some player payments. Funds transferred to checking.',
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });
    }
  }

  // Step 8: Summary
  console.log(`\n  BANK ACCOUNT:`);
  console.log(`    ${BANK_ACCOUNT_NAME}: $${BANK_BALANCE}`);

  const totalInvoiced = PLAYER_DATA.reduce((sum, p) => sum + p.totalInvoiced, 0);
  const totalCollected = PLAYER_DATA.reduce((sum, p) => sum + (p.totalInvoiced - p.outstandingBalance), 0);
  const totalOutstanding = PLAYER_DATA.reduce((sum, p) => sum + Math.max(0, p.outstandingBalance), 0);
  const totalCredits = PLAYER_DATA.reduce((sum, p) => sum + Math.min(0, p.outstandingBalance), 0);
  const totalExpenses = EXPENSE_DATA.reduce((sum, v) => sum + v.items.reduce((s, i) => s + i.amount, 0), 0);
  const totalProcessingFees = PROCESSING_FEE_DATA.reduce((sum, f) => sum + f.amount, 0);
  const totalSponsorIncome = SPONSOR_DATA.reduce((sum, s) => sum + s.paymentAmount, 0);

  console.log(`\n${'='.repeat(60)}`);
  console.log('  RECONCILIATION SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`\n  PLAYER BILLING:`);
  console.log(`    Total Invoiced:     $${totalInvoiced.toLocaleString()}`);
  console.log(`    Total Collected:    $${totalCollected.toLocaleString()}`);
  console.log(`    Outstanding:        $${totalOutstanding.toLocaleString()}`);
  console.log(`    Credits:            $${totalCredits.toLocaleString()}`);
  console.log(`    Players:            ${PLAYER_DATA.length}`);
  console.log(`    Collection Rate:    ${((totalCollected / totalInvoiced) * 100).toFixed(1)}%`);
  console.log(`\n  INCOME:`);
  console.log(`    Player Payments:    $${totalCollected.toLocaleString()}`);
  console.log(`    Sponsor Payments:   $${totalSponsorIncome.toLocaleString()}`);
  console.log(`    Total Income:       $${(totalCollected + totalSponsorIncome).toLocaleString()}`);
  console.log(`\n  EXPENSES:`);
  console.log(`    Vendor Expenses:    $${totalExpenses.toFixed(2)}`);
  console.log(`    Processing Fees:    $${totalProcessingFees.toFixed(2)}`);
  console.log(`    Total Expenses:     $${(totalExpenses + totalProcessingFees).toFixed(2)}`);
  console.log(`\n  NET:`);
  console.log(`    Net Income:         $${(totalCollected + totalSponsorIncome - totalExpenses - totalProcessingFees).toFixed(2)}`);

  if (DRY_RUN) {
    console.log(`\n  ⚠ DRY RUN — no changes were made. Run without --dry-run to apply.`);
  } else {
    console.log(`\n  ✓ All changes applied to Firestore.`);
  }

  console.log(`\n${'='.repeat(60)}\n`);
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
