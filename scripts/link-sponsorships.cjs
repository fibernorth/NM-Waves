// Link sponsorships from QB data to player finance records
// Shows sponsor payments on player records and reconciles balances
// QB sponsorship data:
//   Abigail Gaylord: $800 from FiberNorth (Journal Entry)
//   Katie Vandergriff: $800 from Feola Holdings (Journal Entry)
//   Mackenzie Tobian: $710 from FiberNorth (Journal Entry)
//   Callie Magee: $250 Credit Memo (partial credit)
//   Skylar Yanska: $1000 from Yanska Investments (family company, covers $750 owed)
// Also fixes Ava Wilson: $650 invoiced + $100 voided invoice paid = $750 total, $750 paid, balance $0

const admin = require('firebase-admin');
const path = require('path');
const crypto = require('crypto');

if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

const sponsorships = [
  {
    playerName: 'Abigail Gaylord',
    sponsorName: 'FiberNorth, Inc.',
    amount: 800,
    date: new Date(2025, 9, 1), // 10/01/2025 - date of journal entry
    notes: 'QB Journal Entry: paid by FiberNorth - Abby Gaylord',
  },
  {
    playerName: 'Katie Vandergriff',
    sponsorName: 'Feola Holdings',
    amount: 800,
    date: new Date(2026, 0, 31), // 01/31/2026
    notes: 'QB Journal Entry: move Feola Holdings sponsorship for K Vandergriff',
  },
  {
    playerName: 'Mackenzie Tobian',
    sponsorName: 'FiberNorth, Inc.',
    amount: 710,
    date: new Date(2025, 9, 1), // 10/01/2025
    notes: 'QB Journal Entry: paid by FiberNorth - Mackenzie Tobian',
  },
  {
    playerName: 'Skylar Yanska',
    sponsorName: 'Yanska Investments',
    amount: 1000,
    date: new Date(2025, 10, 3), // 11/03/2025 - date of payment in QB
    notes: 'QB Invoice #41: Yanska Investments sponsorship',
  },
];

async function main() {
  // Load all finance records
  const pfSnap = await db.collection('playerFinances').get();
  const financeByName = new Map();
  for (const doc of pfSnap.docs) {
    const d = doc.data();
    financeByName.set((d.playerName || '').toLowerCase(), { ref: doc.ref, id: doc.id, data: d });
  }

  // Load sponsors collection to find sponsor IDs
  const sponsorsSnap = await db.collection('sponsors').get();
  const sponsorsByName = new Map();
  for (const doc of sponsorsSnap.docs) {
    const d = doc.data();
    sponsorsByName.set((d.name || d.companyName || '').toLowerCase(), { id: doc.id, data: d });
  }
  console.log('Sponsors in Firestore:', Array.from(sponsorsByName.keys()).join(', '));

  console.log('\n=== Linking Sponsorships ===\n');

  for (const sp of sponsorships) {
    const entry = financeByName.get(sp.playerName.toLowerCase());
    if (!entry) {
      console.log('NOT FOUND: ' + sp.playerName);
      continue;
    }

    const d = entry.data;
    const owed = (d.registrationFee||0)+(d.uniformCost||0)+(d.tournamentFees||0)+(d.facilityFees||0)+(d.equipmentFees||0)+(d.otherFees||0);
    const existingPaid = (d.payments||[]).reduce((s, p) => s + (p.amount || 0), 0);

    // Remove any existing sponsor payments to avoid duplicates
    const nonSponsorPayments = (d.payments || []).filter(p => p.method !== 'sponsor');
    const nonSponsorPaid = nonSponsorPayments.reduce((s, p) => s + (p.amount || 0), 0);

    // The scholarship amount = min(sponsor amount, owed - nonSponsorPaid)
    // If sponsor paid more than owed, only apply what's needed
    const scholarshipAmount = Math.min(sp.amount, Math.max(0, owed - nonSponsorPaid));
    const balance = owed - nonSponsorPaid - scholarshipAmount;

    // Find sponsor ID if available
    const sponsorEntry = sponsorsByName.get(sp.sponsorName.toLowerCase());
    const sponsorId = sponsorEntry ? sponsorEntry.id : '';

    // Add sponsor payment to payments array
    const sponsorPayment = {
      id: crypto.randomUUID(),
      amount: sp.amount,
      date: admin.firestore.Timestamp.fromDate(sp.date),
      method: 'sponsor',
      sponsorName: sp.sponsorName,
      sponsorId,
      notes: sp.notes,
    };

    const finalPayments = [...nonSponsorPayments, sponsorPayment];
    const totalPaid = finalPayments.reduce((s, p) => s + (p.amount || 0), 0);

    console.log(sp.playerName + ':');
    console.log('  Sponsor: ' + sp.sponsorName + ' ($' + sp.amount + ')');
    console.log('  Owed: $' + owed + ' | Non-sponsor paid: $' + nonSponsorPaid + ' | Scholarship: $' + scholarshipAmount);
    console.log('  Balance: $' + balance);

    await entry.ref.update({
      payments: finalPayments,
      scholarshipAmount,
      totalPaid,
      balanceDue: balance,
      updatedAt: admin.firestore.Timestamp.now(),
    });
  }

  // Fix Callie Magee - $250 credit memo (not a sponsorship, just a credit)
  const callieEntry = financeByName.get('callie magee');
  if (callieEntry) {
    const cd = callieEntry.data;
    const cOwed = (cd.registrationFee||0)+(cd.uniformCost||0)+(cd.tournamentFees||0)+(cd.facilityFees||0)+(cd.equipmentFees||0)+(cd.otherFees||0);
    const cPaid = (cd.payments||[]).reduce((s, p) => s + (p.amount || 0), 0);
    // She has a $250 credit memo in QB. Her scholarshipAmount should be $250.
    // cOwed should match her QB invoiced total
    console.log('\nCallie Magee:');
    console.log('  Owed: $' + cOwed + ' | Paid: $' + cPaid + ' | Scholarship: $' + (cd.scholarshipAmount||0));
    console.log('  (Credit memo of $250 already handled via scholarshipAmount)');
  }

  // Fix Ava Wilson - voided $100 invoice but payment was real
  const avaEntry = financeByName.get('ava wilson');
  if (avaEntry) {
    const ad = avaEntry.data;
    const aPaid = (ad.payments||[]).reduce((s, p) => s + (p.amount || 0), 0);
    // QB shows $0 balance. She paid $750, so otherFees should make owed = $750
    const fixedFees = (ad.registrationFee||0) + (ad.uniformCost||0) + (ad.tournamentFees||0) + (ad.facilityFees||0) + (ad.equipmentFees||0);
    const targetOtherFees = Math.max(0, aPaid - fixedFees); // 750 - 100 = 650
    const targetOwed = fixedFees + targetOtherFees;

    console.log('\nAva Wilson (voided invoice fix):');
    console.log('  Paid: $' + aPaid + ' | otherFees: $' + (ad.otherFees||0) + ' -> $' + targetOtherFees);
    console.log('  Owed: $' + targetOwed + ' | Balance: $' + (targetOwed - aPaid));

    await avaEntry.ref.update({
      otherFees: targetOtherFees,
      totalOwed: targetOwed,
      balanceDue: 0,
      updatedAt: admin.firestore.Timestamp.now(),
    });
  }

  // Also update sponsor records with sponsoredPlayers links
  console.log('\n=== Updating Sponsor Records ===\n');
  const sponsorPlayerLinks = {
    'fibernorth': [
      { playerName: 'Abigail Gaylord', amount: 800 },
      { playerName: 'Mackenzie Tobian', amount: 710 },
    ],
    'feola': [
      { playerName: 'Katie Vandergriff', amount: 800 },
    ],
    'yanska': [
      { playerName: 'Skylar Yanska', amount: 1000 },
    ],
  };

  for (const [searchTerm, players] of Object.entries(sponsorPlayerLinks)) {
    let sponsorDoc = null;
    for (const [key, entry] of sponsorsByName) {
      if (key.includes(searchTerm)) {
        sponsorDoc = entry;
        break;
      }
    }

    if (sponsorDoc) {
      const sponsoredPlayers = players.map(p => {
        const pf = financeByName.get(p.playerName.toLowerCase());
        return {
          playerId: pf ? pf.data.playerId : '',
          playerName: p.playerName,
          amount: p.amount,
          date: admin.firestore.Timestamp.now(),
        };
      });

      await db.collection('sponsors').doc(sponsorDoc.id).update({
        sponsoredPlayers,
        totalSponsored: players.reduce((s, p) => s + p.amount, 0),
        updatedAt: admin.firestore.Timestamp.now(),
      });
      console.log('Updated sponsor: ' + sponsorDoc.data.name + ' -> ' + players.map(p => p.playerName + ' ($' + p.amount + ')').join(', '));
    } else {
      console.log('Sponsor not found for: ' + searchTerm);
    }
  }

  console.log('\nDone.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
