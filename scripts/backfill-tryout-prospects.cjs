/**
 * Backfill season + prospect assignments for EXISTING tryout applicants.
 *
 * For every tryout-applicant with no season set, stamps the given season
 * (default "2026-2027"), then assigns each applicant as a prospect to the teams
 * in their division band and one band up (per the club's two-year divisions:
 * 8U, 10U, 12U, 14U, 16U, 18U) for that same season. Idempotent — prospect team
 * ids are unioned, seasons only filled when blank.
 *
 * Usage (project root, needs serviceAccountKey.json):
 *   node scripts/backfill-tryout-prospects.cjs                 # dry run
 *   node scripts/backfill-tryout-prospects.cjs --apply         # write
 *   node scripts/backfill-tryout-prospects.cjs --season "2026-2027" --apply
 */
const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

const APPLY = process.argv.includes('--apply');
const seasonArgIdx = process.argv.indexOf('--season');
const SEASON = seasonArgIdx !== -1 ? process.argv[seasonArgIdx + 1] : '2026-2027';

const BANDS = [8, 10, 12, 14, 16, 18];
const bandForAge = (age) => {
  for (const b of BANDS) if (age <= b) return b;
  return 18;
};
const nextBand = (b) => {
  const i = BANDS.indexOf(b);
  return i !== -1 && i < BANDS.length - 1 ? BANDS[i + 1] : null;
};
const bandFromLabel = (label) => {
  if (!label) return null;
  const m = String(label).match(/\d{1,2}/);
  if (!m) return null;
  return bandForAge(parseInt(m[0], 10));
};
const normSeason = (s) => (s || '').trim().toLowerCase();

const seasonCutoffYear = (season) => {
  const m = String(season || '').match(/\b(20\d{2})\b/);
  return m ? parseInt(m[1], 10) : null;
};

// League age as of Sept 1 of the season's start year (Aug 31 cutoff). Uses the
// season year, not "today", so a band doesn't drift once the clock passes Sept 1.
const computeLeagueAge = (dobStr, season) => {
  if (!dobStr) return null;
  const d = new Date(dobStr);
  if (isNaN(d.getTime())) return null;
  let seasonYear = seasonCutoffYear(season);
  if (seasonYear == null) {
    const now = new Date();
    seasonYear = now.getFullYear();
    if (now > new Date(seasonYear, 8, 1)) seasonYear += 1;
  }
  const cutoff = new Date(seasonYear, 7, 31);
  let age = cutoff.getFullYear() - d.getFullYear();
  const m = cutoff.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && cutoff.getDate() < d.getDate())) age--;
  return age;
};

const eligibleBands = (a, season) => {
  const age = computeLeagueAge(a.dateOfBirth, season);
  const own = age != null ? bandForAge(age <= 8 ? 8 : age) : bandFromLabel(a.ageGroup);
  if (own == null) return [];
  const up = nextBand(own);
  return up == null ? [own] : [own, up];
};

async function main() {
  console.log(`Season: "${SEASON}"  |  mode: ${APPLY ? 'APPLY' : 'dry run'}\n`);

  const teamsSnap = await db.collection('teams').get();
  const teams = teamsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((t) => t.active !== false);
  console.log(`Active teams: ${teams.length}`);
  for (const t of teams) {
    console.log(`  - ${t.name} [${t.ageGroup} · ${t.season}] band=${bandFromLabel(t.ageGroup)}`);
  }
  console.log('');

  const appsSnap = await db.collection('tryout-applicants').get();
  console.log(`Applicants: ${appsSnap.size}\n`);

  let seasonWrites = 0;
  let prospectWrites = 0;

  for (const doc of appsSnap.docs) {
    const a = doc.data();
    const effectiveSeason = a.season && a.season.trim() ? a.season : SEASON;
    const bands = eligibleBands(a, effectiveSeason);
    const matchTeams = teams.filter(
      (t) => normSeason(t.season) === normSeason(effectiveSeason) && bands.includes(bandFromLabel(t.ageGroup))
    );
    const matchIds = matchTeams.map((t) => t.id);
    const existing = Array.isArray(a.prospectTeamIds) ? a.prospectTeamIds : [];
    const newIds = matchIds.filter((id) => !existing.includes(id));

    const needSeason = !a.season || !a.season.trim();
    if (!needSeason && newIds.length === 0) continue;

    const label = `${a.playerFirstName || ''} ${a.playerLastName || ''}`.trim() || doc.id;
    const parts = [];
    if (needSeason) parts.push(`season -> "${SEASON}"`);
    if (newIds.length) parts.push(`+${newIds.length} team(s): ${matchTeams.filter((t) => newIds.includes(t.id)).map((t) => t.name).join(', ')}`);
    console.log(`  ${label} (bands ${bands.join('/')}): ${parts.join('  |  ')}`);

    if (APPLY) {
      const update = { updatedAt: admin.firestore.Timestamp.now() };
      if (needSeason) { update.season = SEASON; seasonWrites++; }
      if (newIds.length) {
        update.prospectTeamIds = admin.firestore.FieldValue.arrayUnion(...newIds);
        prospectWrites++;
      }
      await doc.ref.update(update);
    } else {
      if (needSeason) seasonWrites++;
      if (newIds.length) prospectWrites++;
    }
  }

  console.log(`\n${seasonWrites} applicant(s) get a season; ${prospectWrites} get prospect teams.`);
  if (!APPLY) console.log('\nDry run — nothing written. Re-run with --apply to commit.');
  else console.log('\nApplied.');
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
