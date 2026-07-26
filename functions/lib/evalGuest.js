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
exports.getEvalUploadUrl = exports.submitEvalScoreByToken = exports.getEvalEventByToken = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const getDb = () => admin.firestore();
/**
 * Guest evaluator access. Evaluators are invited with a tokened link
 * (/evaluate/<token>) and never need an account: the token resolves the
 * event + scoring template + participant list, and scores are submitted
 * through these callables (Admin SDK — client rules stay locked down).
 */
async function resolveInvite(token) {
    if (!token) {
        throw new functions.https.HttpsError('invalid-argument', 'token is required');
    }
    const snap = await getDb().collection('evalInvites').where('token', '==', token).limit(1).get();
    if (snap.empty) {
        throw new functions.https.HttpsError('not-found', 'Invalid evaluator link');
    }
    const invite = snap.docs[0].data();
    if (!invite.active) {
        throw new functions.https.HttpsError('permission-denied', 'This evaluator link has been disabled');
    }
    const eventDoc = await getDb().collection('evalEvents').doc(invite.eventId).get();
    if (!eventDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Evaluation event not found');
    }
    const event = eventDoc.data();
    if (event.status !== 'open') {
        throw new functions.https.HttpsError('failed-precondition', 'This evaluation is not open for scoring');
    }
    return { invite, eventId: invite.eventId, event };
}
/** Public: resolve an evaluator link into the event + template + roster. */
exports.getEvalEventByToken = functions.https.onCall(async (data) => {
    var _a, _b, _c, _d;
    const { invite, eventId, event } = await resolveInvite(String((data === null || data === void 0 ? void 0 : data.token) || ''));
    return {
        eventId,
        evaluatorName: invite.evaluatorName || 'Evaluator',
        event: {
            name: event.name || '',
            date: ((_d = (_c = (_b = (_a = event.date) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) === null || _c === void 0 ? void 0 : _c.toISOString) === null || _d === void 0 ? void 0 : _d.call(_c)) || null,
            type: event.type || 'tryout',
            categories: event.categories || [],
            stations: event.stations || [],
            participants: (event.participants || []).map((p) => {
                var _a;
                return ({
                    id: p.id,
                    name: p.name,
                    number: p.number || '',
                    division: p.division || '',
                    group: p.group || '',
                    checkedIn: (_a = p.checkedIn) !== null && _a !== void 0 ? _a : false,
                });
            }),
        },
    };
});
/** Public: submit one skill score through an evaluator link. */
exports.submitEvalScoreByToken = functions.https.onCall(async (data) => {
    const { invite, eventId, event } = await resolveInvite(String((data === null || data === void 0 ? void 0 : data.token) || ''));
    const participantId = String((data === null || data === void 0 ? void 0 : data.participantId) || '');
    const skillId = String((data === null || data === void 0 ? void 0 : data.skillId) || '');
    const score = Number(data === null || data === void 0 ? void 0 : data.score);
    const comment = String((data === null || data === void 0 ? void 0 : data.comment) || '').slice(0, 2000);
    const stationId = (data === null || data === void 0 ? void 0 : data.stationId) ? String(data.stationId) : undefined;
    // Guest-uploaded media: accept only Firebase Storage URLs, capped at 10.
    const mediaUrls = Array.isArray(data === null || data === void 0 ? void 0 : data.mediaUrls)
        ? data.mediaUrls
            .map(String)
            .filter((u) => u.startsWith('https://firebasestorage.googleapis.com/'))
            .slice(0, 10)
        : [];
    const participant = (event.participants || []).find((p) => p.id === participantId);
    if (!participant) {
        throw new functions.https.HttpsError('invalid-argument', 'Unknown participant');
    }
    let skill = null;
    let category = null;
    for (const c of event.categories || []) {
        const s = (c.skills || []).find((x) => x.id === skillId);
        if (s) {
            skill = s;
            category = c;
            break;
        }
    }
    if (!skill) {
        throw new functions.https.HttpsError('invalid-argument', 'Unknown skill');
    }
    const maxScore = skill.scale || 5;
    if (!Number.isFinite(score) || score < 0 || score > maxScore) {
        throw new functions.https.HttpsError('invalid-argument', `Score must be between 0 and ${maxScore}`);
    }
    await getDb().collection('evalScores').add({
        eventId,
        participantId,
        participantName: participant.name || '',
        ...(participant.playerId ? { playerId: participant.playerId } : {}),
        skillId,
        skillName: skill.name || '',
        categoryId: category.id || '',
        categoryName: category.name || '',
        ...(stationId ? { stationId } : {}),
        score,
        maxScore,
        weight: skill.weight || 1,
        ...(comment ? { comment } : {}),
        ...(mediaUrls.length ? { mediaUrls } : {}),
        evaluatorName: invite.evaluatorName || 'Evaluator',
        createdAt: admin.firestore.Timestamp.now(),
    });
    return { ok: true };
});
/**
 * Public: issue a short-lived, single-object signed upload URL for guest media.
 * The invite token is validated here (active invite + open event) BEFORE any
 * upload is possible, so Storage no longer needs an open write rule — the
 * evalMedia path is set to deny direct client writes and all guest uploads
 * flow through a URL minted here. Reads stay public so URLs work in report cards.
 */
exports.getEvalUploadUrl = functions.https.onCall(async (data) => {
    const { eventId } = await resolveInvite(String((data === null || data === void 0 ? void 0 : data.token) || ''));
    const contentType = String((data === null || data === void 0 ? void 0 : data.contentType) || '');
    if (!/^(image|video)\//.test(contentType)) {
        throw new functions.https.HttpsError('invalid-argument', 'Only image or video uploads are allowed');
    }
    const safeName = String((data === null || data === void 0 ? void 0 : data.filename) || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60);
    const path = `evalMedia/${data.token}/${eventId}-${Date.now()}-${safeName}`;
    const bucket = admin.storage().bucket();
    const [uploadUrl] = await bucket.file(path).getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000,
        contentType,
    });
    // evalMedia read is public, so the Firebase download endpoint serves it
    // without a token.
    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media`;
    return { uploadUrl, downloadUrl, path, contentType };
});
//# sourceMappingURL=evalGuest.js.map