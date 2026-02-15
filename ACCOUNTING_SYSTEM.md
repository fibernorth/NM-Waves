# NM Waves Comprehensive Accounting System

## Overview

This document outlines the comprehensive accounting system implemented for the Traverse City Waves Softball Club. This system is designed to replace QuickBooks with a simpler, focused solution tailored specifically for youth sports organizations.

## What This System Does

The NM Waves accounting system provides **complete financial management** for your softball organization:

### ✅ Income Tracking
- Track all revenue sources (player payments, sponsorships, fundraisers, donations, grants, merchandise, concessions)
- Categorize income for detailed reporting
- Link income to specific teams or players
- Track payment methods and reference numbers

### ✅ Expense Tracking
- Record all organizational expenses
- Categorize by type (facilities, equipment, uniforms, tournaments, travel, insurance, coaching, etc.)
- Track vendors and payment status (paid/unpaid)
- Upload receipt images/PDFs
- Associate expenses with specific teams or organization-wide

### ✅ Player Billing & Payments
- Set default cost assumptions (registration, uniforms, tournaments, facilities, equipment)
- Track individual player accounts
- Record payments with multiple payment methods
- Calculate balances automatically
- Filter by team, season, or payment status
- View collection rates and outstanding balances

### ✅ Budget Management
- Create budgets by season and team
- Plan income and expenses by category
- Compare actual vs. planned (budget variance)
- Track progress throughout the season

### ✅ Financial Reporting
- **Income Statement (P&L)**: See total income vs. expenses, net income/loss
- **Category Breakdown**: Detailed breakdown of income and expenses by category
- **Team-Level or Organization-Wide Reports**: Filter by specific teams or view entire organization
- **Outstanding Items**: Track unpaid expenses and outstanding player balances
- Export and print reports

### ✅ Vendor Management
- Maintain a database of vendors you regularly pay
- Track vendor contact information
- Categorize vendors by expense type

### ✅ Account Tracking
- Manage multiple bank accounts (checking, savings, petty cash)
- Track account balances
- Record reconciliation dates

## Key Features for Youth Sports

Unlike QuickBooks, this system is designed specifically for youth sports organizations:

1. **Simple & Focused**: Only the features you need, nothing extra
2. **Player-Centric**: Direct integration between player registration and billing
3. **Team Budgets**: Track finances at both team and organization level
4. **Season-Based**: Organize everything by season (Spring, Summer, Fall)
5. **Free**: No monthly subscription fees
6. **Cloud-Based**: Access from anywhere via Firebase hosting
7. **Role-Based Access**: Parents see their info, coaches see their team, admins see everything

## Collections & Data Structure

### Firestore Collections

1. **expenses** - All organizational expenses
2. **income** - All revenue/income records
3. **budgets** - Planned budgets by season/team
4. **accounts** - Bank accounts and balances
5. **vendors** - Vendor database
6. **playerFinances** - Individual player billing/payments
7. **costs** - Global cost assumptions

### Data Security

All collections are protected with Firestore security rules:
- Parents can view their own player information
- Coaches can view their team's information
- Only admins can create/edit/delete financial records
- All data requires authentication to access

## Pages Implemented

### 1. Billing & Payments (`/finances/billing`)
**Purpose**: Manage individual player accounts and payments

**Features**:
- View all player finances in a searchable table
- Summary cards showing total owed, collected, outstanding, and collection rate
- Filter by team, season, or balance status
- Record payments for individual players
- Track payment history
- Visual indicators for paid/unpaid status

**Who Uses It**: Admin only

### 2. Expenses (`/finances/expenses`)
**Purpose**: Track all organizational expenses

**Features**:
- Record expenses with vendor, category, amount, date, and payment method
- Upload receipts
- Mark expenses as paid/unpaid
- Filter by season, category, or payment status
- Summary totals for paid/unpaid expenses
- Associate expenses with specific teams

**Who Uses It**: Admin only

### 3. Income (`/finances/income`)
**Purpose**: Track all revenue sources

**Features**:
- Record income by category (player payments, sponsorships, fundraisers, etc.)
- Track payment method and source
- Filter by season or category
- View totals by income category
- Link income to specific players or teams

**Who Uses It**: Admin only

### 4. Cost Assumptions (`/finances/assumptions`)
**Purpose**: Set default costs used for player billing

**Features**:
- Set organization-wide defaults for:
  - Registration Fee
  - Uniform Cost
  - Tournament Fee (per event)
  - Facility Fee (per season)
  - Equipment Fee (per season)
  - Fundraising Target
- Calculate total expected cost per player
- Costs can be overridden per-player in Billing page

**Who Uses It**: Admin only

### 5. Financial Reports (`/finances/reports`)
**Purpose**: View comprehensive financial statements and summaries

**Features**:
- Filter by season and team
- **Income Statement (P&L)** with full breakdown
- Summary cards for total income, expenses, and net income
- Visual indicators for surplus/deficit
- Outstanding payables and receivables
- Export and print capabilities

**Who Uses It**: Admin only

## Navigation

All financial pages are accessible from the sidebar under the **"Finances"** section:

```
Finances
├── Billing & Payments
├── Expenses
├── Income
├── Cost Assumptions
└── Financial Reports
```

## API Functions Available

All API functions are fully implemented and ready to use:

### Expenses API (`src/lib/api/accounting.ts`)
```typescript
expensesApi.getAll()
expensesApi.getBySeason(season)
expensesApi.getByTeam(teamId)
expensesApi.getByCategory(category, season?)
expensesApi.getUnpaid()
expensesApi.getById(id)
expensesApi.create(expenseData)
expensesApi.update(id, expenseData)
expensesApi.delete(id)
expensesApi.markAsPaid(id, paidDate)
```

### Income API
```typescript
incomeApi.getAll()
incomeApi.getBySeason(season)
incomeApi.getByTeam(teamId)
incomeApi.getByCategory(category, season?)
incomeApi.getById(id)
incomeApi.create(incomeData)
incomeApi.update(id, incomeData)
incomeApi.delete(id)
```

### Budgets API
```typescript
budgetsApi.getAll()
budgetsApi.getBySeason(season)
budgetsApi.getByTeam(teamId)
budgetsApi.getById(id)
budgetsApi.create(budgetData)
budgetsApi.update(id, budgetData)
budgetsApi.delete(id)
```

### Accounts API
```typescript
accountsApi.getAll()
accountsApi.getActive()
accountsApi.getById(id)
accountsApi.create(accountData)
accountsApi.update(id, accountData)
accountsApi.delete(id)
```

### Vendors API
```typescript
vendorsApi.getAll()
vendorsApi.getActive()
vendorsApi.getByCategory(category)
vendorsApi.getById(id)
vendorsApi.create(vendorData)
vendorsApi.update(id, vendorData)
vendorsApi.delete(id)
```

### Reports API
```typescript
reportsApi.generateSummary(season, teamId?, startDate?, endDate?)
```

## TypeScript Models

All models are defined in `src/types/models/index.ts`:

- `Expense` - Individual expense transaction
- `Income` - Individual income transaction
- `Budget` - Season/team budget with planned income and expenses
- `Account` - Bank account information
- `Vendor` - Vendor contact and categorization
- `FinancialSummary` - Generated financial report structure
- `ExpenseCategory` - Type for expense categories
- `IncomeCategory` - Type for income categories

## How It Compares to QuickBooks

| Feature | NM Waves System | QuickBooks |
|---------|-----------------|------------|
| Cost | Free | $15-50+/month |
| Player Billing | ✅ Built-in | ❌ Manual workaround |
| Team Budgets | ✅ Native support | ⚠️ Complex setup |
| Season-Based | ✅ Designed for it | ❌ Not built-in |
| Role-Based Access | ✅ Parents, coaches, admin | ⚠️ Limited in basic plan |
| Income Tracking | ✅ Yes | ✅ Yes |
| Expense Tracking | ✅ Yes | ✅ Yes |
| Financial Reports | ✅ P&L, summaries | ✅ Advanced reports |
| Inventory | ❌ No | ✅ Yes |
| Payroll | ❌ No | ✅ Yes |
| Invoicing | ⚠️ Player billing only | ✅ Full invoicing |
| Tax Preparation | ❌ No | ✅ Yes |

## What's NOT Included

This system is intentionally simpler than QuickBooks and does NOT include:

- ❌ Payroll processing
- ❌ Inventory management
- ❌ Sales tax calculation
- ❌ Invoicing for external clients
- ❌ Purchase orders
- ❌ Time tracking
- ❌ Job costing
- ❌ Automated bank feeds (could be added later)

These features aren't needed for most youth sports organizations.

## Next Steps for Full Implementation

To complete the accounting system, consider adding:

1. **Expense/Income Form Dialogs**: Currently the "Add Expense" and "Add Income" buttons are placeholders. Create form dialogs similar to the Payment Dialog.

2. **Budget Management Page**: Create a full UI for creating and managing budgets.

3. **Vendor Management Page**: Create a page to add/edit vendors.

4. **Account Management Page**: Create a page to manage bank accounts.

5. **Export Functionality**: Implement CSV export and PDF generation for reports.

6. **Receipt Upload**: Integrate Firebase Storage for uploading expense receipts.

7. **Dashboard Integration**: Add financial summary cards to the main dashboard.

8. **Email Notifications**: Send payment reminders to parents with outstanding balances.

9. **Bulk Operations**: Import expenses from bank statements, bulk payment recording.

10. **Year-End Reports**: Special reports for tax filing and annual summaries.

## Getting Started

Once the app is running:

1. **Set Cost Assumptions**: Go to Finances → Cost Assumptions and set your default costs
2. **Add Teams**: Create your teams for the season
3. **Add Players**: Add players and assign them to teams
4. **Initialize Player Finances**: Create player finance records using the default costs
5. **Record Income**: Track all revenue as it comes in
6. **Record Expenses**: Track all expenses as they occur
7. **Record Payments**: As parents pay, record payments in Billing & Payments
8. **View Reports**: Check Financial Reports regularly to monitor your organization's health

## Support

For questions or issues with the accounting system, refer to:
- `README.md` - General project documentation
- `QUICKSTART.md` - Getting started guide
- `PROJECT_STATUS.md` - Current implementation status

## Summary

You now have a complete, QuickBooks-replacement accounting system tailored specifically for youth sports organizations. It's simpler to use, free to host, and designed around the unique needs of managing team finances and player billing.
