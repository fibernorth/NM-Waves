import type { InvoiceToken } from '@/types/models';

interface LineItem {
  label: string;
  amount: number;
}

const fmt = (n: number) => `$${n.toFixed(2)}`;

const fmtDate = (d: Date | undefined) =>
  d
    ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '';

function getLineItems(token: InvoiceToken): LineItem[] {
  const items: LineItem[] = [];
  if (token.registrationFee && token.registrationFee > 0) items.push({ label: 'Registration Fee', amount: token.registrationFee });
  if (token.uniformCost && token.uniformCost > 0) items.push({ label: 'Uniform Cost', amount: token.uniformCost });
  if (token.tournamentFees && token.tournamentFees > 0) items.push({ label: 'Tournament Fees', amount: token.tournamentFees });
  if (token.facilityFees && token.facilityFees > 0) items.push({ label: 'Facility Fees', amount: token.facilityFees });
  if (token.equipmentFees && token.equipmentFees > 0) items.push({ label: 'Equipment Fees', amount: token.equipmentFees });
  if (token.otherFees && token.otherFees > 0) items.push({ label: 'Other Fees', amount: token.otherFees });
  return items;
}

/**
 * Generates a full HTML document string for a professional, printable invoice.
 * Use with: window.open('', '_blank').document.write(html)
 */
export function generateInvoiceHTML(token: InvoiceToken, qrDataUrl: string): string {
  const invoiceNumber = token.invoiceNumber || token.token.substring(0, 8).toUpperCase();
  const issueDate = fmtDate(token.createdAt);
  const dueDate = fmtDate(token.dueDate) || fmtDate(token.expiresAt);
  const paymentTerms = token.paymentTerms || 'Due upon receipt';
  const isPerCharge = token.chargeType && token.chargeType !== 'full_balance';
  const payUrl = `${window.location.origin}/pay/${token.token}`;

  // Build line items table rows
  let lineItemsHTML = '';
  let subtotal = 0;

  if (isPerCharge) {
    // Single charge invoice
    lineItemsHTML = `
      <tr>
        <td class="item-cell">${token.chargeLabel || token.chargeType}</td>
        <td class="amount-cell">${fmt(token.amountDue)}</td>
      </tr>`;
    subtotal = token.amountDue;
  } else {
    // Full balance — itemized
    const items = getLineItems(token);
    items.forEach((item) => {
      lineItemsHTML += `
        <tr>
          <td class="item-cell">${item.label}</td>
          <td class="amount-cell">${fmt(item.amount)}</td>
        </tr>`;
    });
    subtotal = items.reduce((s, i) => s + i.amount, 0);
  }

  const scholarship = token.scholarshipAmount || 0;
  const totalPaid = token.totalPaid || 0;

  // Deductions rows
  let deductionsHTML = '';

  if (!isPerCharge) {
    deductionsHTML += `
      <tr class="subtotal-row">
        <td class="item-cell"><strong>Subtotal</strong></td>
        <td class="amount-cell"><strong>${fmt(subtotal)}</strong></td>
      </tr>`;

    if (scholarship > 0) {
      deductionsHTML += `
        <tr class="deduction-row">
          <td class="item-cell">Less: Scholarship</td>
          <td class="amount-cell">-${fmt(scholarship)}</td>
        </tr>`;
    }

    if (totalPaid > 0) {
      deductionsHTML += `
        <tr class="deduction-row">
          <td class="item-cell">Less: Payments Made</td>
          <td class="amount-cell">-${fmt(totalPaid)}</td>
        </tr>`;
    }
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${invoiceNumber} - ${token.playerName}</title>
  <style>
    @page {
      size: letter;
      margin: 0.75in;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
      color: #333;
      line-height: 1.5;
      max-width: 680px;
      margin: 0 auto;
      padding: 40px 24px;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 32px;
      padding-bottom: 20px;
      border-bottom: 3px solid #001f5b;
    }
    .brand h1 {
      font-size: 22px;
      color: #001f5b;
      margin-bottom: 2px;
      letter-spacing: -0.5px;
    }
    .brand p {
      font-size: 12px;
      color: #666;
      line-height: 1.4;
    }
    .invoice-title {
      text-align: right;
    }
    .invoice-title h2 {
      font-size: 28px;
      color: #001f5b;
      text-transform: uppercase;
      letter-spacing: 3px;
      margin-bottom: 4px;
    }
    .invoice-title .invoice-num {
      font-size: 14px;
      color: #666;
      font-weight: 600;
    }

    /* Meta grid */
    .meta-grid {
      display: flex;
      justify-content: space-between;
      margin-bottom: 28px;
    }
    .meta-left, .meta-right {
      width: 48%;
    }
    .meta-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #999;
      margin-bottom: 2px;
    }
    .meta-value {
      font-size: 13px;
      color: #333;
      margin-bottom: 12px;
    }
    .meta-right {
      text-align: right;
    }

    /* Bill To */
    .bill-to {
      margin-bottom: 24px;
      padding: 16px;
      background: #f8f9fa;
      border-radius: 6px;
      border-left: 4px solid #001f5b;
    }
    .bill-to .meta-label { margin-bottom: 6px; }
    .bill-to .name {
      font-size: 16px;
      font-weight: 600;
      color: #001f5b;
    }
    .bill-to .detail {
      font-size: 13px;
      color: #666;
    }

    /* Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 0;
    }
    .items-table thead th {
      background: #001f5b;
      color: #fff;
      padding: 10px 16px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .items-table thead th:first-child {
      text-align: left;
      border-radius: 4px 0 0 0;
    }
    .items-table thead th:last-child {
      text-align: right;
      border-radius: 0 4px 0 0;
    }
    .item-cell {
      padding: 10px 16px;
      font-size: 13px;
      border-bottom: 1px solid #eee;
    }
    .amount-cell {
      padding: 10px 16px;
      font-size: 13px;
      text-align: right;
      border-bottom: 1px solid #eee;
      white-space: nowrap;
    }
    .subtotal-row td {
      border-top: 2px solid #ccc;
      border-bottom: 1px solid #eee;
    }
    .deduction-row td {
      color: #2e7d32;
    }
    .total-row td {
      border-top: 2px solid #001f5b;
      padding: 12px 16px;
      font-size: 16px;
      font-weight: 700;
    }
    .total-row .amount-cell {
      color: #c62828;
      font-size: 18px;
    }

    /* QR Section */
    .qr-section {
      text-align: center;
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #eee;
    }
    .qr-section p {
      font-size: 12px;
      color: #666;
      margin-bottom: 12px;
    }
    .qr-section img {
      width: 180px;
      height: 180px;
    }
    .qr-url {
      font-size: 10px;
      color: #999;
      word-break: break-all;
      margin-top: 8px;
    }

    /* Footer */
    .footer {
      text-align: center;
      margin-top: 28px;
      padding-top: 16px;
      border-top: 1px solid #eee;
      font-size: 12px;
      color: #999;
    }
    .footer .thanks {
      font-size: 14px;
      color: #001f5b;
      font-weight: 600;
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div class="brand">
      <h1>TC Waves Ball Club</h1>
      <p>Traverse City, Michigan<br>tcwavessoftball@gmail.com</p>
    </div>
    <div class="invoice-title">
      <h2>Invoice</h2>
      <div class="invoice-num">${invoiceNumber}</div>
    </div>
  </div>

  <!-- Meta Grid -->
  <div class="meta-grid">
    <div class="meta-left">
      <div class="meta-label">Invoice Date</div>
      <div class="meta-value">${issueDate}</div>
      <div class="meta-label">Due Date</div>
      <div class="meta-value">${dueDate}</div>
    </div>
    <div class="meta-right">
      <div class="meta-label">Payment Terms</div>
      <div class="meta-value">${paymentTerms}</div>
      <div class="meta-label">Invoice Number</div>
      <div class="meta-value">${invoiceNumber}</div>
    </div>
  </div>

  <!-- Bill To -->
  <div class="bill-to">
    <div class="meta-label">Bill To</div>
    <div class="name">${token.playerName}</div>
    <div class="detail">${token.teamName} &mdash; ${token.season}</div>
  </div>

  <!-- Line Items Table -->
  <table class="items-table">
    <thead>
      <tr>
        <th>Description</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      ${lineItemsHTML}
      ${deductionsHTML}
      <tr class="total-row">
        <td class="item-cell">AMOUNT DUE</td>
        <td class="amount-cell">${fmt(token.amountDue)}</td>
      </tr>
    </tbody>
  </table>

  <!-- QR Code -->
  <div class="qr-section">
    <p>Scan to pay online:</p>
    ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR Code" />` : ''}
    <div class="qr-url">${payUrl}</div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="thanks">Thank you for your prompt payment!</div>
    <p>TC Waves Ball Club &bull; Traverse City, Michigan</p>
  </div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
}
