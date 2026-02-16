import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import cors from 'cors';
import { scrapeTeamStats, scrapeTeamGames } from './scraper';
import { sendParentInvites } from './sendInvites';
import { createCheckoutSession, stripeWebhook } from './stripe';
import { generateInvoiceToken } from './invoiceTokens';
import { moderateMedia } from './moderation';
import { listDrivePhotos } from './googleDrive';

const corsHandler = cors({ origin: true });

admin.initializeApp();

const db = admin.firestore();

interface TeamMapping {
  teamId: string;
  gcTeamId: string;
  season: string;
}

/**
 * Scheduled Cloud Function: runs nightly at 2am EST
 * Scrapes GameChanger for all active teams with gcTeamId
 */
export const scrapeGameChanger = functions.pubsub
  .schedule('0 2 * * *')
  .timeZone('America/New_York')
  .onRun(async () => {
    console.log('Starting GameChanger scrape...');

    // Get all active teams with a gcTeamId
    const teamsSnapshot = await db
      .collection('teams')
      .where('active', '==', true)
      .get();

    const teamMappings: TeamMapping[] = [];
    teamsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.gcTeamId) {
        teamMappings.push({
          teamId: doc.id,
          gcTeamId: data.gcTeamId,
          season: data.season || new Date().getFullYear().toString(),
        });
      }
    });

    console.log(`Found ${teamMappings.length} teams with GameChanger IDs`);

    // Get all players for name mapping
    const playersSnapshot = await db.collection('players').get();
    const playerMap = new Map<string, { id: string; name: string; teamId: string }>();
    playersSnapshot.forEach((doc) => {
      const data = doc.data();
      const fullName = `${data.firstName} ${data.lastName}`.toLowerCase();
      const lastFirst = `${data.lastName}, ${data.firstName}`.toLowerCase();
      playerMap.set(fullName, { id: doc.id, name: `${data.firstName} ${data.lastName}`, teamId: data.teamId || '' });
      playerMap.set(lastFirst, { id: doc.id, name: `${data.firstName} ${data.lastName}`, teamId: data.teamId || '' });
      // Also map by last name only as fallback
      playerMap.set(data.lastName.toLowerCase(), { id: doc.id, name: `${data.firstName} ${data.lastName}`, teamId: data.teamId || '' });
    });

    for (const team of teamMappings) {
      try {
        console.log(`Scraping team ${team.gcTeamId}...`);

        // Scrape stats
        const stats = await scrapeTeamStats(team.gcTeamId);
        for (const stat of stats) {
          // Try to match player name
          const nameLower = stat.playerName.toLowerCase();
          const matched = playerMap.get(nameLower);

          const docId = `${team.gcTeamId}_${matched?.id || nameLower.replace(/\s+/g, '_')}_${stat.statType}_${team.season}`;
          await db.collection('gcStats').doc(docId).set({
            playerId: matched?.id || '',
            playerName: matched?.name || stat.playerName,
            teamId: team.teamId,
            gcTeamId: team.gcTeamId,
            season: team.season,
            statType: stat.statType,
            stats: stat.stats,
            scrapedAt: admin.firestore.Timestamp.now(),
          });
        }
        console.log(`  Wrote ${stats.length} stat records`);

        // Scrape games
        const games = await scrapeTeamGames(team.gcTeamId);
        for (const game of games) {
          const dateStr = game.date.toISOString().split('T')[0];
          const sanitized = game.opponent.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
          const docId = `${team.gcTeamId}_${dateStr}_${sanitized}`;
          await db.collection('gcGames').doc(docId).set({
            gcTeamId: team.gcTeamId,
            teamId: team.teamId,
            opponent: game.opponent,
            date: admin.firestore.Timestamp.fromDate(game.date),
            location: game.location,
            scoreUs: game.scoreUs,
            scoreThem: game.scoreThem,
            result: game.result,
            season: team.season,
            scrapedAt: admin.firestore.Timestamp.now(),
          });
        }
        console.log(`  Wrote ${games.length} game records`);

      } catch (error) {
        console.error(`Error scraping team ${team.gcTeamId}:`, error);
      }
    }

    console.log('GameChanger scrape complete');
    return null;
  });

/**
 * HTTP-triggered function for manual scraping (admin use)
 */
export const triggerScrape = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    // Basic auth check - in production, use proper Firebase Auth
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).send('Unauthorized');
      return;
    }

    try {
      // Verify the Firebase ID token
      const token = authHeader.split('Bearer ')[1];
      const decoded = await admin.auth().verifyIdToken(token);

      // Check if user is admin
      const userDoc = await db.collection('users').doc(decoded.uid).get();
      const userData = userDoc.data();
      if (!userData || !(userData.roles?.some((r: string) => ['admin', 'master-admin'].includes(r)) || ['admin', 'master-admin'].includes(userData.role))) {
        res.status(403).send('Forbidden: Admin access required');
        return;
      }

      // Run the scrape (same logic as scheduled function)
      const teamsSnapshot = await db
        .collection('teams')
        .where('active', '==', true)
        .get();

      const results: Array<{ team: string; stats: number; games: number }> = [];

      const playersSnapshot = await db.collection('players').get();
      const playerMap = new Map<string, { id: string; name: string }>();
      playersSnapshot.forEach((doc) => {
        const data = doc.data();
        const fullName = `${data.firstName} ${data.lastName}`.toLowerCase();
        playerMap.set(fullName, { id: doc.id, name: `${data.firstName} ${data.lastName}` });
        playerMap.set(`${data.lastName}, ${data.firstName}`.toLowerCase(), { id: doc.id, name: `${data.firstName} ${data.lastName}` });
      });

      for (const teamDoc of teamsSnapshot.docs) {
        const data = teamDoc.data();
        if (!data.gcTeamId) continue;

        try {
          const stats = await scrapeTeamStats(data.gcTeamId);
          const games = await scrapeTeamGames(data.gcTeamId);

          for (const stat of stats) {
            const nameLower = stat.playerName.toLowerCase();
            const matched = playerMap.get(nameLower);
            const docId = `${data.gcTeamId}_${matched?.id || nameLower.replace(/\s+/g, '_')}_${stat.statType}_${data.season}`;
            await db.collection('gcStats').doc(docId).set({
              playerId: matched?.id || '',
              playerName: matched?.name || stat.playerName,
              teamId: teamDoc.id,
              gcTeamId: data.gcTeamId,
              season: data.season,
              statType: stat.statType,
              stats: stat.stats,
              scrapedAt: admin.firestore.Timestamp.now(),
            });
          }

          for (const game of games) {
            const dateStr = game.date.toISOString().split('T')[0];
            const sanitized = game.opponent.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
            const docId = `${data.gcTeamId}_${dateStr}_${sanitized}`;
            await db.collection('gcGames').doc(docId).set({
              gcTeamId: data.gcTeamId,
              teamId: teamDoc.id,
              opponent: game.opponent,
              date: admin.firestore.Timestamp.fromDate(game.date),
              location: game.location,
              scoreUs: game.scoreUs,
              scoreThem: game.scoreThem,
              result: game.result,
              season: data.season,
              scrapedAt: admin.firestore.Timestamp.now(),
            });
          }

          results.push({ team: data.teamName || teamDoc.id, stats: stats.length, games: games.length });
        } catch (error) {
          results.push({ team: data.teamName || teamDoc.id, stats: -1, games: -1 });
        }
      }

      res.json({ success: true, results });
    } catch (error) {
      console.error('Scrape error:', error);
      res.status(500).json({ error: 'Scrape failed' });
    }
  });
});

export { sendParentInvites };
export { createCheckoutSession, stripeWebhook, generateInvoiceToken };
export { moderateMedia, listDrivePhotos };
