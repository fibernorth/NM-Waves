import * as admin from 'firebase-admin';

interface ReceiptData {
  email: string;
  amount: number;
  playerName: string;
  teamName: string;
  season: string;
  date: Date;
  sponsorBusinessName?: string;
  isAnonymous?: boolean;
  stripeSessionId?: string;
}

/**
 * Sends a payment receipt email.
 * Uses Firestore 'mail' collection (Firebase Extension: Trigger Email).
 * If that extension isn't set up, this logs the receipt and stores it.
 */
export async function sendPaymentReceipt(receiptData: ReceiptData): Promise<void> {
  const {
    email,
    amount,
    playerName,
    teamName,
    season,
    date,
    sponsorBusinessName,
    stripeSessionId,
  } = receiptData;

  const formattedAmount = `$${amount.toFixed(2)}`;
  const formattedDate = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const subject = `Payment Receipt - TC Waves Ball Club`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #1565c0; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">TC Waves Ball Club</h1>
        <p style="margin: 5px 0 0 0;">Payment Receipt</p>
      </div>

      <div style="padding: 30px; background-color: #f5f5f5;">
        <div style="background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #333; margin-top: 0;">Payment Confirmation</h2>
          <p>Thank you for your payment! Here are the details:</p>

          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666;">Date:</td>
              <td style="padding: 8px 0; font-weight: bold;">${formattedDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Amount:</td>
              <td style="padding: 8px 0; font-weight: bold; color: #2e7d32;">${formattedAmount}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Player:</td>
              <td style="padding: 8px 0; font-weight: bold;">${playerName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Team:</td>
              <td style="padding: 8px 0;">${teamName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Season:</td>
              <td style="padding: 8px 0;">${season}</td>
            </tr>
            ${sponsorBusinessName ? `
            <tr>
              <td style="padding: 8px 0; color: #666;">Sponsor:</td>
              <td style="padding: 8px 0;">${sponsorBusinessName}</td>
            </tr>
            ` : ''}
            ${stripeSessionId ? `
            <tr>
              <td style="padding: 8px 0; color: #666;">Reference:</td>
              <td style="padding: 8px 0; font-size: 12px;">${stripeSessionId}</td>
            </tr>
            ` : ''}
          </table>
        </div>

        <div style="background-color: white; padding: 15px; border-radius: 8px; text-align: center;">
          <p style="margin: 0; color: #666; font-size: 14px;">
            This payment may be tax-deductible. Please consult your tax advisor.
          </p>
        </div>
      </div>

      <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
        <p>TC Waves Ball Club, Inc. &bull; Traverse City, Michigan</p>
        <p>tcwavessoftball@gmail.com</p>
      </div>
    </div>
  `;

  try {
    // Try to use Firebase Trigger Email extension (mail collection)
    await admin.firestore().collection('mail').add({
      to: email,
      message: {
        subject,
        html,
      },
      createdAt: admin.firestore.Timestamp.now(),
    });
    console.log(`Receipt email queued for ${email}`);
  } catch (error) {
    // If mail collection doesn't work, store receipt for later
    console.log(`Receipt stored for ${email} (email service may not be configured)`);
    await admin.firestore().collection('receipts').add({
      email,
      subject,
      html,
      receiptData,
      createdAt: admin.firestore.Timestamp.now(),
      sent: false,
    });
  }
}
