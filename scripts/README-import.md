# QuickBooks CSV Import Guide

Import financial data from QuickBooks into the NM Waves Softball Club app.

## Prerequisites

- Node.js v20+
- Project dependencies installed (`npm install` from project root)
- Network access to Firebase (the script uses the client SDK)

## Quick Start

```bash
# Preview what would be imported (recommended first step)
node scripts/import-quickbooks.js --type expenses --file ./imports/expenses.csv --dry-run

# Run the actual import
node scripts/import-quickbooks.js --type expenses --file ./imports/expenses.csv --season "2025-2026"
```

## Exporting Data from QuickBooks

### Expenses / Bills

1. In QuickBooks, go to **Reports > Expenses and Vendors > Transaction List by Vendor** (or similar expense report)
2. Set the date range for the season you want to import
3. Click **Export** (or the spreadsheet icon) and choose **Export to Excel** or **Export to CSV**
4. If exported as Excel (.xlsx), open in Excel/Google Sheets and re-save as CSV

The export should contain columns like: Date, Vendor, Category/Account, Amount, Payment Method, Check #, Memo

### Income / Deposits

1. Go to **Reports > Sales and Customers > Transaction List by Customer** or **Banking > Deposit Detail**
2. Set the appropriate date range
3. Export to CSV

Expected columns: Date, Source/Customer, Category/Account, Amount, Payment Method, Reference #, Memo

### Customer List

1. Go to **Reports > Customers & Receivables > Customer Contact List** or **Customers > Customer Center**
2. Export the list to CSV

Expected columns: Name, Email, Phone, Address, Balance

### Invoice List

1. Go to **Reports > Customers & Receivables > Open Invoices** or **Invoice List**
2. Export to CSV

Expected columns: Customer, Date, Amount/Total, Status, Balance Due, Invoice #

## Commands

```bash
# Import expenses
node scripts/import-quickbooks.js --type expenses --file ./imports/expenses.csv --season "2025-2026"

# Import income/deposits
node scripts/import-quickbooks.js --type income --file ./imports/income.csv --season "2025-2026"

# Import customers as players
node scripts/import-quickbooks.js --type customers --file ./imports/customers.csv --season "2025-2026"

# Import invoices as player finance records
node scripts/import-quickbooks.js --type invoices --file ./imports/invoices.csv --season "2025-2026"

# Dry run (preview without writing to database)
node scripts/import-quickbooks.js --type expenses --file ./imports/expenses.csv --dry-run

# Show help
node scripts/import-quickbooks.js --help
```

## Command-Line Options

| Option | Required | Description |
|--------|----------|-------------|
| `--type` | Yes | Import type: `expenses`, `income`, `customers`, `invoices` |
| `--file` | Yes | Path to the CSV file |
| `--season` | No | Season identifier (default: `2025-2026`) |
| `--dry-run` | No | Preview import without writing to Firestore |
| `--help` | No | Show usage information |

## Expected CSV Column Formats

The script matches columns flexibly (case-insensitive, with support for common QuickBooks naming variants). You do not need to rename columns from a standard QuickBooks export.

### Expenses

| Column | Variants Accepted |
|--------|-------------------|
| Date | `Date`, `Txn Date`, `Transaction Date`, `Bill Date`, `Payment Date` |
| Vendor | `Vendor`, `Payee`, `Name`, `Vendor/Payee`, `Paid To` |
| Category | `Category`, `Account`, `Expense Account`, `Account Name`, `Type`, `Class` |
| Amount | `Amount`, `Total`, `Debit`, `Amount (Debit)`, `Payment Amount` |
| Payment Method | `Payment Method`, `Type`, `Pay Method`, `Payment Type`, `Method` |
| Check # | `Check #`, `Check No`, `Num`, `Check Number`, `Ref #` |
| Memo | `Memo`, `Description`, `Memo/Description`, `Notes`, `Line Memo` |

### Income

| Column | Variants Accepted |
|--------|-------------------|
| Date | `Date`, `Txn Date`, `Transaction Date`, `Deposit Date`, `Payment Date` |
| Source | `Source`, `Customer`, `Name`, `From`, `Received From`, `Payer` |
| Category | `Category`, `Account`, `Income Account`, `Account Name`, `Type`, `Item` |
| Amount | `Amount`, `Total`, `Credit`, `Amount (Credit)`, `Deposit Amount` |
| Payment Method | `Payment Method`, `Type`, `Pay Method`, `Payment Type`, `Method` |
| Reference # | `Reference #`, `Ref #`, `Reference`, `Num`, `Check #`, `Transaction #` |
| Memo | `Memo`, `Description`, `Memo/Description`, `Notes` |

### Customers

| Column | Variants Accepted |
|--------|-------------------|
| Name | `Name`, `Customer`, `Customer Name`, `Display Name`, `Full Name` |
| Email | `Email`, `Main Email`, `Email Address`, `E-mail`, `Primary Email` |
| Phone | `Phone`, `Main Phone`, `Phone Number`, `Primary Phone`, `Mobile` |
| Address | `Address`, `Billing Address`, `Street`, `Mailing Address` |
| Balance | `Balance`, `Balance Due`, `Open Balance`, `Amount Due` |

### Invoices

| Column | Variants Accepted |
|--------|-------------------|
| Customer | `Customer`, `Name`, `Customer Name`, `Customer/Job`, `Bill To` |
| Date | `Date`, `Txn Date`, `Invoice Date`, `Transaction Date` |
| Amount | `Amount`, `Total`, `Invoice Total`, `Original Amount` |
| Status | `Status`, `Invoice Status`, `State` |
| Balance Due | `Balance Due`, `Balance`, `Open Balance`, `Amount Due`, `Remaining` |
| Invoice # | `Invoice #`, `Num`, `Number`, `Invoice Number`, `Doc Number` |

## Category Mapping

QuickBooks categories are automatically mapped to the app's category system.

### Expense Categories

| QuickBooks Category | App Category |
|---------------------|-------------|
| Rent, Facility Rental, Field Rental, Gym Rental | `facilities` |
| Equipment, Supplies, Sporting Goods, Bats, Balls | `equipment` |
| Uniforms, Jerseys, Apparel | `uniforms` |
| Tournament, Entry Fees, Tournament Registration | `tournaments` |
| Travel, Mileage, Gas, Hotel, Lodging | `travel` |
| Insurance, Liability Insurance | `insurance` |
| League Fees, League Dues, Membership, USSSA, ASA | `league_fees` |
| Coaching, Instruction, Lessons, Training, Clinics | `coaching` |
| Office Supplies, Bank Fees, Professional Fees | `administrative` |
| Marketing, Advertising, Promotion | `marketing` |
| Fundraising Expense, Event Expense | `fundraising` |
| Maintenance, Repairs, Field Maintenance | `maintenance` |
| *(anything unrecognized)* | `other` |

### Income Categories

| QuickBooks Category | App Category |
|---------------------|-------------|
| Registration Fees, Player Fees, Team Fees, Dues | `player_payments` |
| Sponsorship, Sponsor Income, Corporate Sponsorship | `sponsorships` |
| Fundraiser, Fundraising Income, Event Income | `fundraisers` |
| Donations, Contributions, Gifts | `donations` |
| Grants, Grant Income | `grants` |
| Merchandise, Merch Sales, Spirit Wear | `merchandise` |
| Concessions, Snack Bar, Food Sales | `concessions` |
| *(anything unrecognized)* | `other` |

## What Gets Created

| Import Type | Firestore Collection(s) | Notes |
|-------------|------------------------|-------|
| `expenses` | `expenses` | Each CSV row becomes one expense document |
| `income` | `income` | Each CSV row becomes one income document |
| `customers` | `players`, `playerFinances` | Each customer becomes a player; if they have a balance, a finance record is also created |
| `invoices` | `playerFinances`, `income` | Each invoice becomes a finance record; paid amounts also create income records |

## Data Handling

- **Dates**: Accepts `MM/DD/YYYY`, `M/D/YYYY`, `MM-DD-YYYY`, `YYYY-MM-DD`, and two-digit years
- **Amounts**: Handles `$1,234.56`, `-$500.00`, `($500.00)`, plain numbers
- **Quoted fields**: CSV fields with commas inside quotes are handled correctly
- **BOM**: UTF-8 BOM characters are stripped automatically
- **recordedBy**: All records are tagged with `quickbooks-import`
- **isPaid**: Expense records default to `isPaid: true` (QuickBooks exports are typically settled transactions)

## Troubleshooting

### "Error: File not found"
Make sure the file path is correct. Use a relative path from where you run the command, or an absolute path.

### "Invalid or missing date"
The CSV row has a date that could not be parsed. Check that dates are in a standard US format (MM/DD/YYYY). Rows with bad dates are skipped but other rows continue to import.

### "Invalid or missing amount"
The amount field is empty or contains non-numeric text. Check the CSV for formatting issues.

### Categories showing as "other"
The QuickBooks category name was not recognized. You can manually update the category in the app after import, or add a mapping to the `QB_EXPENSE_CATEGORY_MAP` / `QB_INCOME_CATEGORY_MAP` objects in the script.

### Permission denied / Firebase errors
The script uses the Firebase client SDK without authentication. Make sure your Firestore security rules allow unauthenticated writes, or temporarily relax the rules for the import. After importing, restore your security rules.

### Duplicate records after re-running
The script does not check for duplicates. If you run it twice with the same file, you will get duplicate records. Delete the duplicates from Firestore or use a fresh collection.

### Large files running slowly
The script writes one document at a time to avoid overwhelming Firestore. For very large files (1000+ rows), expect the import to take a few minutes. Progress is logged every 10 rows.
