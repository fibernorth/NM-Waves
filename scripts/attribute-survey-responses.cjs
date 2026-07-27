/**
 * READ-ONLY: best-effort attribution of survey responses.
 *
 * Attribution sources, in order of confidence:
 *   1. surveyResponseIdentities — definitive (recorded at submit; new responses)
 *   2. A "Player Name" answer the parent typed themselves, matched against the
 *      player roster and its parent contacts.
 * Responses with neither stay unattributed — they were submitted under the
 * anonymity promise and carry no identifying data.
 *
 * Usage (project root, needs serviceAccountKey.json):
 *   node scripts/attribute-survey-responses.cjs
 */
const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

const norm = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ');

async function main() {
  const [surveysSnap, responsesSnap, identitiesSnap, playersSnap] = await Promise.all([
    db.collection('surveys').get(),
    db.collection('surveyResponses').get(),
    db.collection('surveyResponseIdentities').get().catch(() => ({ docs: [] })),
    db.collection('players').get(),
  ]);

  const surveys = new Map(surveysSnap.docs.map((d) => [d.id, d.data()]));
  const identities = new Map(
    identitiesSnap.docs.map((d) => [d.data().responseId || d.id, d.data()])
  );

  // Roster lookup: full name / first name -> player + parent contacts
  const players = playersSnap.docs.map((d) => {
    const p = d.data();
    const contacts = (p.contacts || [])
      .map((c) => `${c.name || ''} <${c.email || ''}>`.trim())
      .filter((c) => c !== '<>');
    if (p.parentEmail) contacts.push(`${p.parentName || 'parent'} <${p.parentEmail}>`);
    return {
      id: d.id,
      first: norm(p.firstName),
      last: norm(p.lastName),
      full: norm(`${p.firstName} ${p.lastName}`),
      label: `${p.firstName} ${p.lastName}${p.teamName ? ` (${p.teamName})` : ''}`,
      contacts: [...new Set(contacts)],
    };
  });

  const bySurvey = new Map();
  for (const doc of responsesSnap.docs) {
    const r = doc.data();
    if (!bySurvey.has(r.surveyId)) bySurvey.set(r.surveyId, []);
    bySurvey.get(r.surveyId).push({ id: doc.id, ...r });
  }

  for (const [surveyId, responses] of bySurvey) {
    const survey = surveys.get(surveyId);
    console.log('\n==============================================================');
    console.log(` SURVEY: ${survey?.title || surveyId}  (${responses.length} responses)`);
    console.log('==============================================================');

    responses.sort((a, b) => (a.submittedAt?.toMillis?.() || 0) - (b.submittedAt?.toMillis?.() || 0));

    let attributed = 0;
    responses.forEach((r, i) => {
      const when = r.submittedAt?.toDate?.()
        ? r.submittedAt.toDate().toLocaleString('en-US')
        : 'unknown time';
      console.log(`\n#${i + 1} — ${when}  [${r.id}]`);

      // Source 1: definitive identity record
      const ident = identities.get(r.id);
      if (ident) {
        console.log(`  ✔ IDENTIFIED (recorded at submit): ${ident.submittedByName || '?'} <${ident.submittedByEmail || '?'}>`);
        attributed++;
        return;
      }

      // Source 2: the parent typed a player name into the optional name question
      const nameAnswer = (r.answers || []).find((a) =>
        /player.?s?\s*name/i.test(a.questionText || '')
      );
      const typed = norm(nameAnswer?.value);
      if (!typed) {
        console.log('  ✖ Unattributed — no identity record and the name question was left blank.');
        return;
      }

      const exact = players.filter((p) => p.full === typed || (typed.includes(p.first) && typed.includes(p.last)));
      const firstOnly = exact.length ? [] : players.filter((p) => p.first && typed.split(' ').includes(p.first));

      if (exact.length === 1) {
        const p = exact[0];
        console.log(`  ✔ NAME MATCH (they wrote "${nameAnswer.value}"): ${p.label}`);
        p.contacts.forEach((c) => console.log(`      parent: ${c}`));
        attributed++;
      } else if (exact.length > 1) {
        console.log(`  ~ Wrote "${nameAnswer.value}" — matches ${exact.length} players:`);
        exact.forEach((p) => console.log(`      ${p.label}`));
      } else if (firstOnly.length > 0 && firstOnly.length <= 3) {
        console.log(`  ~ Wrote "${nameAnswer.value}" — possible (first-name) matches:`);
        firstOnly.forEach((p) => console.log(`      ${p.label} — ${p.contacts.join('; ')}`));
      } else {
        console.log(`  ✖ Wrote "${nameAnswer.value}" — no roster match.`);
      }
    });

    console.log(`\n  >> ${attributed}/${responses.length} attributed with confidence.`);
  }

  console.log('\nDone. Read-only — nothing was written.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
