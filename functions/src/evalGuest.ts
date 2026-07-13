import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const getDb = () => admin.firestore();

/**
 * Guest evaluator access. Evaluators are invited with a tokened link
 * (/evaluate/<token>) and never need an account: the token resolves the
 * event + scoring template + participant list, and scores are submitted
 * through these callables (Admin SDK — client rules stay locked down).
 */

async function resolveInvite(token: string) {
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
  const event = eventDoc.data()!;
  if (event.status !== 'open') {
    throw new functions.https.HttpsError('failed-precondition', 'This evaluation is not open for scoring');
  }
  return { invite, eventId: invite.eventId, event };
}

/** Public: resolve an evaluator link into the event + template + roster. */
export const getEvalEventByToken = functions.https.onCall(async (data) => {
  const { invite, eventId, event } = await resolveInvite(String(data?.token || ''));
  return {
    eventId,
    evaluatorName: invite.evaluatorName || 'Evaluator',
    event: {
      name: event.name || '',
      date: event.date?.toDate?.()?.toISOString?.() || null,
      type: event.type || 'tryout',
      categories: event.categories || [],
      stations: event.stations || [],
      participants: (event.participants || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        number: p.number || '',
        division: p.division || '',
        group: p.group || '',
        checkedIn: p.checkedIn ?? false,
      })),
    },
  };
});

/** Public: submit one skill score through an evaluator link. */
export const submitEvalScoreByToken = functions.https.onCall(async (data) => {
  const { invite, eventId, event } = await resolveInvite(String(data?.token || ''));

  const participantId = String(data?.participantId || '');
  const skillId = String(data?.skillId || '');
  const score = Number(data?.score);
  const comment = String(data?.comment || '').slice(0, 2000);
  const stationId = data?.stationId ? String(data.stationId) : undefined;
  // Guest-uploaded media: accept only Firebase Storage URLs, capped at 10.
  const mediaUrls: string[] = Array.isArray(data?.mediaUrls)
    ? data.mediaUrls
        .map(String)
        .filter((u: string) => u.startsWith('https://firebasestorage.googleapis.com/'))
        .slice(0, 10)
    : [];

  const participant = (event.participants || []).find((p: any) => p.id === participantId);
  if (!participant) {
    throw new functions.https.HttpsError('invalid-argument', 'Unknown participant');
  }
  let skill: any = null;
  let category: any = null;
  for (const c of event.categories || []) {
    const s = (c.skills || []).find((x: any) => x.id === skillId);
    if (s) { skill = s; category = c; break; }
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
