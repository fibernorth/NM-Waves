"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendBroadcastEmail = sendBroadcastEmail;
exports.sendPaymentReceipt = sendPaymentReceipt;
exports.sendInvoiceNotification = sendInvoiceNotification;
exports.sendPlayerStatement = sendPlayerStatement;
exports.sendParentInviteEmail = sendParentInviteEmail;
exports.sendPasswordResetCustomEmail = sendPasswordResetCustomEmail;
exports.sendBatchInvoiceNotifications = sendBatchInvoiceNotifications;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const nodemailer = __importStar(require("nodemailer"));
const getDb = () => admin.firestore();
const ORG_EMAIL = 'tcwavessoftball@gmail.com';
// Prefer env vars (functions/.env); fall back to legacy functions.config()
// so existing deployments keep working until secrets are moved to .env.
const SITE_URL = process.env.SITE_URL || ((_a = functions.config().app) === null || _a === void 0 ? void 0 : _a.site_url) || 'https://nmwaves.com';
/** Escape HTML special characters to prevent XSS in email templates */
function esc(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
// Shared email header/footer for brand consistency
const emailHeader = `
  <div style="background-color: #1565c0; color: white; padding: 20px; text-align: center;">
    <h1 style="margin: 0;">Northern Michigan Waves</h1>
  </div>`;
const emailFooter = `
  <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
    <p>Northern Michigan Waves, Inc. &bull; Traverse City, Michigan</p>
    <p>${ORG_EMAIL}</p>
  </div>`;
/**
 * Creates a Nodemailer transporter using Gmail SMTP.
 * Requires environment variables SMTP_USER and SMTP_PASS (set in functions/.env).
 */
function getTransporter() {
    var _a, _b;
    const user = process.env.SMTP_USER || ((_a = functions.config().smtp) === null || _a === void 0 ? void 0 : _a.user) || ORG_EMAIL;
    const pass = process.env.SMTP_PASS || ((_b = functions.config().smtp) === null || _b === void 0 ? void 0 : _b.pass);
    if (!pass) {
        console.warn('[email] SMTP password not configured. Set SMTP_PASS in functions/.env');
        return null;
    }
    return nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
    });
}
/**
 * Sends an email directly via Gmail SMTP.
 * CC's the org email on all outgoing mail.
 * Falls back to storing in Firestore if SMTP not configured.
 */
async function queueEmail(to, subject, html) {
    const transporter = getTransporter();
    if (transporter) {
        try {
            await transporter.sendMail({
                from: `"Northern Michigan Waves" <${ORG_EMAIL}>`,
                to,
                cc: to !== ORG_EMAIL ? ORG_EMAIL : undefined,
                subject,
                html,
            });
            console.log(`Email sent to ${to}: ${subject}`);
            // Also log to Firestore for record keeping
            await getDb().collection('mail').add({
                to,
                cc: ORG_EMAIL,
                subject,
                sent: true,
                sentAt: admin.firestore.Timestamp.now(),
                createdAt: admin.firestore.Timestamp.now(),
            });
            return;
        }
        catch (error) {
            console.error(`[email] SMTP send failed for ${to}:`, error.message);
        }
    }
    // Fallback: store in Firestore for manual review
    console.log(`Email stored for ${to} (SMTP not configured or send failed)`);
    await getDb().collection('mail').add({
        to,
        cc: ORG_EMAIL,
        message: { subject, html },
        sent: false,
        createdAt: admin.firestore.Timestamp.now(),
    });
}
/**
 * Send one message to many parent recipients via BCC (chunked). Powers the
 * "Email all parents" admin broadcast. The admin's plain-text message is
 * escaped and wrapped in the club's branded email template.
 */
async function sendBroadcastEmail(recipients, subject, plainMessage) {
    const bodyHtml = esc(plainMessage).replace(/\n/g, '<br>');
    const html = `${emailHeader}<div style="padding: 20px; color: #333; font-size: 15px; line-height: 1.6;">${bodyHtml}</div>${emailFooter}`;
    const transporter = getTransporter();
    if (!transporter) {
        await getDb().collection('mail').add({
            to: ORG_EMAIL,
            bccCount: recipients.length,
            message: { subject, html },
            sent: false,
            broadcast: true,
            createdAt: admin.firestore.Timestamp.now(),
        });
        return { sent: 0, queued: true };
    }
    // Chunk the BCC list so no single message has an unwieldy recipient count.
    const CHUNK = 90;
    let sent = 0;
    for (let i = 0; i < recipients.length; i += CHUNK) {
        const batch = recipients.slice(i, i + CHUNK);
        await transporter.sendMail({
            from: `"Northern Michigan Waves" <${ORG_EMAIL}>`,
            to: ORG_EMAIL,
            bcc: batch,
            subject,
            html,
        });
        sent += batch.length;
    }
    await getDb().collection('mail').add({
        to: ORG_EMAIL,
        bccCount: sent,
        subject,
        sent: true,
        broadcast: true,
        sentAt: admin.firestore.Timestamp.now(),
        createdAt: admin.firestore.Timestamp.now(),
    });
    return { sent, queued: false };
}
async function sendPaymentReceipt(receiptData) {
    const { email, amount, playerName, teamName, season, date, sponsorBusinessName, stripeSessionId, balanceDue, paymentUrl, } = receiptData;
    const formattedAmount = `$${amount.toFixed(2)}`;
    const formattedDate = date.toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
    });
    const hasBalance = typeof balanceDue === 'number';
    const owes = hasBalance && balanceDue > 0.005;
    const subject = `Payment Receipt - Northern Michigan Waves`;
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      ${emailHeader}
      <div style="padding: 30px; background-color: #f5f5f5;">
        <div style="background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #333; margin-top: 0;">Payment Confirmation</h2>
          <p>Thank you for your payment! Here are the details:</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #666;">Date:</td><td style="padding: 8px 0; font-weight: bold;">${formattedDate}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Amount Paid:</td><td style="padding: 8px 0; font-weight: bold; color: #2e7d32;">${formattedAmount}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Player:</td><td style="padding: 8px 0; font-weight: bold;">${esc(playerName)}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Team:</td><td style="padding: 8px 0;">${esc(teamName)}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Season:</td><td style="padding: 8px 0;">${esc(season)}</td></tr>
            ${sponsorBusinessName ? `<tr><td style="padding: 8px 0; color: #666;">Sponsor:</td><td style="padding: 8px 0;">${esc(sponsorBusinessName)}</td></tr>` : ''}
            ${stripeSessionId ? `<tr><td style="padding: 8px 0; color: #666;">Reference:</td><td style="padding: 8px 0; font-size: 12px;">${esc(stripeSessionId)}</td></tr>` : ''}
            ${hasBalance ? `
            <tr style="border-top: 2px solid #ddd; background-color: ${owes ? '#fff3e0' : '#e8f5e9'};">
              <td style="padding: 10px 0; font-weight: bold; font-size: 16px;">Remaining Balance:</td>
              <td style="padding: 10px 0; font-weight: bold; font-size: 16px; color: ${owes ? '#e65100' : '#2e7d32'};">$${balanceDue.toFixed(2)}</td>
            </tr>` : ''}
          </table>
          ${!hasBalance ? '' : owes ? `
          ${paymentUrl ? `
          <div style="text-align: center; margin: 24px 0;">
            <a href="${paymentUrl}" style="display: inline-block; background-color: #1565c0; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
              Pay Remaining Balance
            </a>
          </div>` : ''}
          <p style="text-align: center; color: #666; font-size: 13px;">Log in to your parent account at <a href="${SITE_URL}">${SITE_URL.replace('https://', '')}</a> to view details and pay the balance.</p>
          ` : `
          <p style="text-align: center; color: #2e7d32; font-weight: bold; margin: 16px 0 0;">Your account is paid in full — thank you! 🎉</p>`}
        </div>
        <div style="background-color: white; padding: 15px; border-radius: 8px; text-align: center;">
          <p style="margin: 0; color: #666; font-size: 14px;">
            This payment may be tax-deductible. Please consult your tax advisor.
          </p>
        </div>
      </div>
      ${emailFooter}
    </div>`;
    await queueEmail(email, subject, html);
}
async function sendInvoiceNotification(data) {
    const { email, parentName, playerName, teamName, season, totalOwed, totalPaid, balanceDue, feeBreakdown, scholarshipAmount, paymentUrl, dueDate, } = data;
    const feeRows = [
        feeBreakdown.registrationFee ? `<tr><td style="padding: 6px 0; color: #666;">Registration Fee</td><td style="padding: 6px 0; text-align: right;">$${feeBreakdown.registrationFee.toFixed(2)}</td></tr>` : '',
        feeBreakdown.uniformCost ? `<tr><td style="padding: 6px 0; color: #666;">Uniform Cost</td><td style="padding: 6px 0; text-align: right;">$${feeBreakdown.uniformCost.toFixed(2)}</td></tr>` : '',
        feeBreakdown.tournamentFees ? `<tr><td style="padding: 6px 0; color: #666;">Tournament Fees</td><td style="padding: 6px 0; text-align: right;">$${feeBreakdown.tournamentFees.toFixed(2)}</td></tr>` : '',
        feeBreakdown.facilityFees ? `<tr><td style="padding: 6px 0; color: #666;">Facility Fees</td><td style="padding: 6px 0; text-align: right;">$${feeBreakdown.facilityFees.toFixed(2)}</td></tr>` : '',
        feeBreakdown.equipmentFees ? `<tr><td style="padding: 6px 0; color: #666;">Equipment Fees</td><td style="padding: 6px 0; text-align: right;">$${feeBreakdown.equipmentFees.toFixed(2)}</td></tr>` : '',
        feeBreakdown.otherFees ? `<tr><td style="padding: 6px 0; color: #666;">Other Fees</td><td style="padding: 6px 0; text-align: right;">$${feeBreakdown.otherFees.toFixed(2)}</td></tr>` : '',
    ].filter(Boolean).join('');
    const subject = `Invoice Notice: ${playerName} - Northern Michigan Waves`;
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      ${emailHeader}
      <div style="padding: 30px; background-color: #f5f5f5;">
        <div style="background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #333; margin-top: 0;">Invoice Notice</h2>
          <p>Hi ${esc(parentName || 'Parent/Guardian')},</p>
          <p>This is a billing notice for <strong>${esc(playerName)}</strong> on the <strong>${esc(teamName)}</strong> team for the <strong>${esc(season)}</strong> season.</p>

          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            ${feeRows}
            <tr style="border-top: 2px solid #ddd;">
              <td style="padding: 8px 0; font-weight: bold;">Total Charges</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold;">$${totalOwed.toFixed(2)}</td>
            </tr>
            ${scholarshipAmount ? `
            <tr>
              <td style="padding: 6px 0; color: #1976d2;">Scholarship / Financial Aid</td>
              <td style="padding: 6px 0; text-align: right; color: #1976d2;">-$${scholarshipAmount.toFixed(2)}</td>
            </tr>` : ''}
            <tr>
              <td style="padding: 6px 0; color: #2e7d32;">Payments Received</td>
              <td style="padding: 6px 0; text-align: right; color: #2e7d32;">-$${totalPaid.toFixed(2)}</td>
            </tr>
            <tr style="border-top: 2px solid #ddd; background-color: ${balanceDue > 0 ? '#fff3e0' : '#e8f5e9'};">
              <td style="padding: 10px 0; font-weight: bold; font-size: 16px;">Balance Due</td>
              <td style="padding: 10px 0; text-align: right; font-weight: bold; font-size: 16px; color: ${balanceDue > 0 ? '#e65100' : '#2e7d32'};">$${balanceDue.toFixed(2)}</td>
            </tr>
          </table>

          ${dueDate ? `<p style="color: #e65100; font-weight: bold;">Payment due by: ${dueDate}</p>` : ''}

          ${paymentUrl ? `
          <div style="text-align: center; margin: 24px 0;">
            <a href="${paymentUrl}" style="display: inline-block; background-color: #1565c0; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
              Pay Now
            </a>
          </div>
          <p style="text-align: center; color: #666; font-size: 13px;">
            Or log in to your parent account at <a href="${SITE_URL}">${SITE_URL.replace('https://', '')}</a> to view details and make a payment.
          </p>` : `
          <p style="text-align: center; color: #666;">
            Log in to your parent account at <a href="${SITE_URL}">${SITE_URL.replace('https://', '')}</a> to view details and make a payment.
          </p>`}
        </div>

        <div style="background-color: white; padding: 15px; border-radius: 8px; text-align: center;">
          <p style="margin: 0; color: #666; font-size: 13px;">
            Questions? Reply to this email or contact us at tcwavessoftball@gmail.com
          </p>
        </div>
      </div>
      ${emailFooter}
    </div>`;
    await queueEmail(email, subject, html);
}
/**
 * Sends a full account STATEMENT: every charge line, every payment received
 * (with date and method), and the running balance — a transaction-history
 * document, distinct from the invoice notice (which shows only the balance and
 * a pay button). Used by the per-player "Email Statement" action.
 */
async function sendPlayerStatement(data) {
    const { email, parentName, playerName, teamName, season, feeBreakdown, totalOwed, scholarshipAmount, payments, totalPaid, balanceDue, paymentUrl, statementDate, } = data;
    const feeItems = [
        ['Registration Fee', feeBreakdown.registrationFee || 0],
        ['Uniform Cost', feeBreakdown.uniformCost || 0],
        ['Tournament Fees', feeBreakdown.tournamentFees || 0],
        ['Facility Fees', feeBreakdown.facilityFees || 0],
        ['Equipment Fees', feeBreakdown.equipmentFees || 0],
        ['Other Fees', feeBreakdown.otherFees || 0],
    ];
    const feeRows = feeItems
        .filter(([, amt]) => amt > 0)
        .map(([label, amt]) => `<tr><td style="padding: 6px 0; color: #666;">${esc(label)}</td><td style="padding: 6px 0; text-align: right;">$${amt.toFixed(2)}</td></tr>`)
        .join('');
    const paymentRows = payments.length
        ? payments
            .map((p) => `<tr>
              <td style="padding: 6px 0; color: #666;">${esc(p.date)}</td>
              <td style="padding: 6px 0; color: #666;">${esc(p.method)}${p.reference ? ` <span style="color:#999;">(${esc(p.reference)})</span>` : ''}</td>
              <td style="padding: 6px 0; text-align: right; color: #2e7d32;">-$${p.amount.toFixed(2)}</td>
            </tr>`)
            .join('')
        : `<tr><td colspan="3" style="padding: 8px 0; color: #999; text-align: center;">No payments recorded yet</td></tr>`;
    const subject = `Account Statement: ${playerName} - Northern Michigan Waves`;
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      ${emailHeader}
      <div style="padding: 30px; background-color: #f5f5f5;">
        <div style="background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <h2 style="color: #333; margin-top: 0;">Account Statement</h2>
            <div style="text-align:right; color:#999; font-size:13px;">As of ${esc(statementDate)}</div>
          </div>
          <p>Hi ${esc(parentName || 'Parent/Guardian')},</p>
          <p>Here is the account statement for <strong>${esc(playerName)}</strong> on the <strong>${esc(teamName)}</strong> team for the <strong>${esc(season)}</strong> season.</p>

          <h3 style="color:#555; font-size:15px; margin: 20px 0 4px;">Charges</h3>
          <table style="width: 100%; border-collapse: collapse;">
            ${feeRows || '<tr><td style="padding:6px 0;color:#999;">No charges on file</td></tr>'}
            <tr style="border-top: 2px solid #ddd;">
              <td style="padding: 8px 0; font-weight: bold;">Total Charges</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold;">$${totalOwed.toFixed(2)}</td>
            </tr>
            ${scholarshipAmount ? `<tr><td style="padding: 6px 0; color: #1976d2;">Scholarship / Financial Aid</td><td style="padding: 6px 0; text-align: right; color: #1976d2;">-$${scholarshipAmount.toFixed(2)}</td></tr>` : ''}
          </table>

          <h3 style="color:#555; font-size:15px; margin: 24px 0 4px;">Payments</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom:1px solid #eee;">
              <td style="padding: 4px 0; color:#999; font-size:12px;">Date</td>
              <td style="padding: 4px 0; color:#999; font-size:12px;">Method</td>
              <td style="padding: 4px 0; color:#999; font-size:12px; text-align:right;">Amount</td>
            </tr>
            ${paymentRows}
            <tr style="border-top: 2px solid #ddd;">
              <td style="padding: 8px 0; font-weight: bold;" colspan="2">Total Paid</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold; color:#2e7d32;">-$${totalPaid.toFixed(2)}</td>
            </tr>
          </table>

          <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
            <tr style="border-top: 2px solid #ddd; background-color: ${balanceDue > 0 ? '#fff3e0' : '#e8f5e9'};">
              <td style="padding: 10px 0; font-weight: bold; font-size: 16px;">Balance Due</td>
              <td style="padding: 10px 0; text-align: right; font-weight: bold; font-size: 16px; color: ${balanceDue > 0 ? '#e65100' : '#2e7d32'};">$${balanceDue.toFixed(2)}</td>
            </tr>
          </table>

          ${balanceDue > 0 && paymentUrl ? `
          <div style="text-align: center; margin: 24px 0;">
            <a href="${paymentUrl}" style="display: inline-block; background-color: #1565c0; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
              Pay Balance
            </a>
          </div>` : ''}
          <p style="text-align: center; color: #666; font-size: 13px;">
            Log in to your parent account at <a href="${SITE_URL}">${SITE_URL.replace('https://', '')}</a> to view details and make a payment.
          </p>
        </div>

        <div style="background-color: white; padding: 15px; border-radius: 8px; text-align: center;">
          <p style="margin: 0; color: #666; font-size: 13px;">
            Questions? Reply to this email or contact us at ${ORG_EMAIL}
          </p>
        </div>
      </div>
      ${emailFooter}
    </div>`;
    await queueEmail(email, subject, html);
}
async function sendParentInviteEmail(data) {
    const { email, parentName, playerNames, resetLink } = data;
    const playerList = playerNames.length > 0
        ? playerNames.map(n => `<li><strong>${esc(n)}</strong></li>`).join('')
        : '<li>Your child</li>';
    const subject = `You're Invited - Northern Michigan Waves Parent Portal`;
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      ${emailHeader}
      <div style="padding: 30px; background-color: #f5f5f5;">
        <div style="background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #333; margin-top: 0;">Welcome to Northern Michigan Waves!</h2>
          <p>Hi ${esc(parentName || 'Parent/Guardian')},</p>
          <p>An account has been created for you on the Northern Michigan Waves parent portal. You can use it to:</p>
          <ul style="color: #555;">
            <li>View invoices and payment history</li>
            <li>Make payments online</li>
            <li>Access team schedules and announcements</li>
            <li>View your child's profile and documents</li>
          </ul>

          <p>Your linked player(s):</p>
          <ul style="color: #555;">${playerList}</ul>

          <div style="text-align: center; margin: 24px 0;">
            <a href="${resetLink}" style="display: inline-block; background-color: #1565c0; color: white; padding: 14px 36px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
              Set Your Password & Log In
            </a>
          </div>

          <p style="color: #666; font-size: 13px;">
            This link is valid for 30 days and can be used once to set your password.
            If it has expired or you have any issues, visit
            <a href="${SITE_URL}/login">${SITE_URL.replace('https://', '')}/login</a>
            and click "Forgot Password" to get a new link.
          </p>
        </div>
      </div>
      ${emailFooter}
    </div>`;
    await queueEmail(email, subject, html);
}
async function sendPasswordResetCustomEmail(data) {
    const { email, resetLink } = data;
    const subject = `Password Reset - Northern Michigan Waves`;
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      ${emailHeader}
      <div style="padding: 30px; background-color: #f5f5f5;">
        <div style="background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #333; margin-top: 0;">Password Reset Request</h2>
          <p>Hi,</p>
          <p>We received a request to reset the password for your Northern Michigan Waves account. Click the button below to set a new password:</p>

          <div style="text-align: center; margin: 24px 0;">
            <a href="${resetLink}" style="display: inline-block; background-color: #1565c0; color: white; padding: 14px 36px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
              Reset Your Password
            </a>
          </div>

          <p style="color: #666; font-size: 13px;">
            This link will expire in 48 hours. If you did not request a password reset,
            you can safely ignore this email.
          </p>
        </div>
      </div>
      ${emailFooter}
    </div>`;
    await queueEmail(email, subject, html);
}
async function sendBatchInvoiceNotifications(params) {
    let sent = 0;
    let skipped = 0;
    const errors = [];
    for (const f of params.finances) {
        if (!f.parentEmail) {
            skipped++;
            continue;
        }
        if (f.balanceDue <= 0) {
            skipped++;
            continue;
        }
        try {
            await sendInvoiceNotification({
                email: f.parentEmail,
                parentName: f.parentName,
                playerName: f.playerName,
                teamName: f.teamName,
                season: f.season,
                totalOwed: f.totalOwed,
                totalPaid: f.totalPaid,
                balanceDue: f.balanceDue,
                feeBreakdown: f.feeBreakdown,
                scholarshipAmount: f.scholarshipAmount,
                paymentUrl: f.paymentUrl,
                dueDate: params.dueDate,
            });
            sent++;
        }
        catch (err) {
            errors.push(`${f.parentEmail}: ${err.message}`);
        }
    }
    return { sent, skipped, errors };
}
//# sourceMappingURL=emails.js.map