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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlayerFinanceSummary = exports.linkChild = exports.searchLinkablePlayers = exports.updateLinkedPlayerContact = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const getDb = () => admin.firestore();
/**
 * Lets a parent update the contact / emergency / medical fields on a player
 * they are linked to. Parents cannot write the /players collection directly
 * (that is coach-only), so onboarding "Save & Continue" used to always fail
 * with a permissions error. This callable enforces that the caller is a parent
 * linked to the player and writes ONLY the allowed fields — never roster,
 * financial, or team assignment fields.
 */
exports.updateLinkedPlayerContact = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    const { playerId } = data;
    if (!playerId) {
        throw new functions.https.HttpsError('invalid-argument', 'playerId is required');
    }
    const userDoc = await getDb().collection('users').doc(context.auth.uid).get();
    if (!userDoc.exists) {
        throw new functions.https.HttpsError('permission-denied', 'Unknown user');
    }
    const userData = userDoc.data();
    const roles = userData.roles || (userData.role ? [userData.role] : []);
    const linkedPlayerIds = userData.linkedPlayerIds || [];
    const isParent = roles.includes('parent');
    const isLinked = linkedPlayerIds.includes(playerId);
    if (!isParent || !isLinked) {
        throw new functions.https.HttpsError('permission-denied', 'You can only update a child linked to your account');
    }
    // Whitelist of fields a parent may update — nothing else is written.
    const allowed = { updatedAt: admin.firestore.Timestamp.now() };
    if (data.parentName !== undefined)
        allowed.parentName = data.parentName;
    if (data.parentEmail !== undefined)
        allowed.parentEmail = data.parentEmail;
    if (data.parentPhone !== undefined)
        allowed.parentPhone = data.parentPhone;
    if (data.emergencyContact !== undefined)
        allowed.emergencyContact = data.emergencyContact;
    if (data.emergencyPhone !== undefined)
        allowed.emergencyPhone = data.emergencyPhone;
    if (data.medicalNotes !== undefined)
        allowed.medicalNotes = data.medicalNotes;
    if (Array.isArray(data.contacts)) {
        allowed.contacts = data.contacts.map((c) => ({
            name: c.name || '',
            relationship: c.relationship || '',
            email: c.email || '',
            phone: c.phone || '',
            isPrimaryContact: c.isPrimaryContact || false,
            isFinancialParty: c.isFinancialParty || false,
        }));
    }
    await getDb().collection('players').doc(playerId).update(allowed);
    return { success: true };
});
/**
 * Search for players a parent can link, returning ONLY non-sensitive fields
 * (id, name, team) plus a server-computed emailMatch flag. Parents can no
 * longer read the players collection directly, so this replaces the old client
 * roster dump — no DOB, medical notes, contacts, or emails cross the wire.
 * Email matching is done server-side against the caller's own auth email.
 */
/** Last-10-digits phone comparison, tolerant of formatting. */
const phoneDigits = (v) => (v || '').replace(/\D/g, '').slice(-10);
/** Does this player already have a parent/guardian attached? */
const playerHasParent = (p) => !!(p.parentEmail && String(p.parentEmail).trim()) ||
    (Array.isArray(p.contacts) && p.contacts.some((c) => (c.email || '').trim() || (c.phone || '').trim())) ||
    (Array.isArray(p.linkedUserIds) && p.linkedUserIds.length > 0);
exports.searchLinkablePlayers = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    const callerEmail = (context.auth.token.email || '').toLowerCase();
    const search = ((data === null || data === void 0 ? void 0 : data.search) || '').toLowerCase().trim();
    const callerPhone = phoneDigits(data === null || data === void 0 ? void 0 : data.phone);
    const snapshot = await getDb()
        .collection('players')
        .where('active', '==', true)
        .get();
    const results = snapshot.docs
        .map((doc) => {
        const p = doc.data();
        const emailMatch = !!callerEmail &&
            ((p.parentEmail || '').toLowerCase() === callerEmail ||
                (p.contacts || []).some((c) => (c.email || '').toLowerCase() === callerEmail));
        // Phone match against parent/contact phones (server-verified value the
        // parent typed — only actioned for players with no parent yet).
        const phoneMatch = callerPhone.length === 10 &&
            (phoneDigits(p.parentPhone) === callerPhone ||
                (p.contacts || []).some((c) => phoneDigits(c.phone) === callerPhone));
        const hasParent = playerHasParent(p);
        return {
            id: doc.id,
            firstName: p.firstName || '',
            lastName: p.lastName || '',
            teamName: p.teamName || '',
            emailMatch,
            phoneMatch: phoneMatch && !emailMatch,
            // A player with no parent yet can be claimed (writes the parent on).
            claimable: !hasParent,
            _name: `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase(),
        };
    })
        // Always surface email/phone matches. Otherwise only on a 2+ char name
        // search, and unclaimed players are prioritized in the UI.
        .filter((p) => p.emailMatch ||
        p.phoneMatch ||
        (search.length >= 2 && p._name.includes(search)))
        .map(({ _name, ...rest }) => rest);
    return { players: results };
});
/**
 * Link a child to the calling parent account. Access to a player's sensitive
 * data flows entirely from this link, so linking is verified server-side: the
 * caller's auth email must match the player's parentEmail or a contact email.
 * If it does not, the parent must be linked by an administrator. Because the
 * Firestore rules now freeze linkedPlayerIds against client writes, this
 * callable (Admin SDK) is the only self-service path to a link.
 */
exports.linkChild = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    const { playerId } = data;
    if (!playerId) {
        throw new functions.https.HttpsError('invalid-argument', 'playerId is required');
    }
    const callerEmail = (context.auth.token.email || '').toLowerCase();
    const callerPhone = phoneDigits(data === null || data === void 0 ? void 0 : data.phone);
    const playerRef = getDb().collection('players').doc(playerId);
    const playerDoc = await playerRef.get();
    if (!playerDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Player not found');
    }
    const p = playerDoc.data();
    const emailMatch = !!callerEmail &&
        ((p.parentEmail || '').toLowerCase() === callerEmail ||
            (p.contacts || []).some((c) => (c.email || '').toLowerCase() === callerEmail));
    // Phone claim is only allowed for players with no parent attached yet, and
    // only when the parent's typed phone matches a number already on the player
    // record. This lets a family self-attach without an admin, while a player
    // that already has a guardian can never be claimed by phone.
    const hasParent = playerHasParent(p);
    const phoneClaim = !emailMatch &&
        !hasParent &&
        callerPhone.length === 10 &&
        (phoneDigits(p.parentPhone) === callerPhone ||
            (p.contacts || []).some((c) => phoneDigits(c.phone) === callerPhone));
    if (!emailMatch && !phoneClaim) {
        throw new functions.https.HttpsError('permission-denied', "We couldn't verify this player belongs to you. Please ask your club administrator to link your account.");
    }
    // On a phone claim, write the parent's contact details onto the player so
    // the family is properly attached (name/email/phone), mirroring what an
    // admin link would produce. Never overwrite an existing parent.
    if (phoneClaim) {
        const parentName = (data.parentName || context.auth.token.name || '').trim();
        const parentEmail = (data.parentEmail || callerEmail || '').trim().toLowerCase();
        const parentPhone = data.phone || '';
        const playerUpdate = {
            updatedAt: admin.firestore.Timestamp.now(),
        };
        if (!p.parentName && parentName)
            playerUpdate.parentName = parentName;
        if (!p.parentEmail && parentEmail)
            playerUpdate.parentEmail = parentEmail;
        if (!p.parentPhone && parentPhone)
            playerUpdate.parentPhone = parentPhone;
        const contacts = Array.isArray(p.contacts) ? [...p.contacts] : [];
        const alreadyListed = contacts.some((c) => (parentEmail && (c.email || '').toLowerCase() === parentEmail) ||
            (callerPhone && phoneDigits(c.phone) === callerPhone));
        if (!alreadyListed && (parentName || parentEmail || parentPhone)) {
            contacts.push({
                name: parentName,
                relationship: 'Parent/Guardian',
                email: parentEmail,
                phone: parentPhone,
                isPrimaryContact: contacts.length === 0,
                isFinancialParty: contacts.length === 0,
            });
        }
        playerUpdate.contacts = contacts;
        playerUpdate.linkedUserIds = admin.firestore.FieldValue.arrayUnion(context.auth.uid);
        await playerRef.update(playerUpdate);
    }
    else {
        // Email match: still record the link on the player side for consistency.
        await playerRef.update({
            linkedUserIds: admin.firestore.FieldValue.arrayUnion(context.auth.uid),
            updatedAt: admin.firestore.Timestamp.now(),
        });
    }
    await getDb()
        .collection('users')
        .doc(context.auth.uid)
        .update({
        linkedPlayerIds: admin.firestore.FieldValue.arrayUnion(playerId),
        updatedAt: admin.firestore.Timestamp.now(),
    });
    return { success: true, method: phoneClaim ? 'phone' : 'email' };
});
/**
 * Returns a MINIMAL finance summary (name, team, season, balance due) for a
 * player, to any authenticated user. Used by the sponsor "pay a player" flow so
 * a sponsor can see the outstanding balance of the player they want to fund —
 * without granting sponsors read access to the full playerFinances documents
 * (which contain every payer's name/email and the whole payment history).
 */
exports.getPlayerFinanceSummary = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    const { playerId } = data;
    if (!playerId) {
        throw new functions.https.HttpsError('invalid-argument', 'playerId is required');
    }
    const snapshot = await getDb()
        .collection('playerFinances')
        .where('playerId', '==', playerId)
        .orderBy('season', 'desc')
        .get();
    if (snapshot.empty)
        return { summary: null };
    const docSnap = snapshot.docs[0];
    const d = docSnap.data();
    const totalOwed = (d.registrationFee || 0) +
        (d.uniformCost || 0) +
        (d.tournamentFees || 0) +
        (d.facilityFees || 0) +
        (d.equipmentFees || 0) +
        (d.otherFees || 0);
    const totalPaid = (d.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
    const balanceDue = Math.max(0, totalOwed - totalPaid - (d.scholarshipAmount || 0));
    return {
        summary: {
            playerName: d.playerName || '',
            teamName: d.teamName || '',
            season: d.season || '',
            balanceDue,
            financeId: docSnap.id,
        },
    };
});
//# sourceMappingURL=parentActions.js.map