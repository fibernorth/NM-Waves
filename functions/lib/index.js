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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendCustomPasswordReset = exports.setAccountPassword = exports.listDrivePhotos = exports.batchAnalyzeMedia = exports.analyzeMedia = exports.moderateMedia = exports.batchGenerateInvoices = exports.generateInvoiceToken = exports.stripeWebhook = exports.createCheckoutSession = exports.sendInvoiceEmails = exports.sendParentInvites = exports.triggerScrape = exports.scrapeGameChanger = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const cors_1 = __importDefault(require("cors"));
const scraper_1 = require("./scraper");
const sendInvites_1 = require("./sendInvites");
Object.defineProperty(exports, "sendParentInvites", { enumerable: true, get: function () { return sendInvites_1.sendParentInvites; } });
Object.defineProperty(exports, "sendInvoiceEmails", { enumerable: true, get: function () { return sendInvites_1.sendInvoiceEmails; } });
const stripe_1 = require("./stripe");
Object.defineProperty(exports, "createCheckoutSession", { enumerable: true, get: function () { return stripe_1.createCheckoutSession; } });
Object.defineProperty(exports, "stripeWebhook", { enumerable: true, get: function () { return stripe_1.stripeWebhook; } });
const invoiceTokens_1 = require("./invoiceTokens");
Object.defineProperty(exports, "generateInvoiceToken", { enumerable: true, get: function () { return invoiceTokens_1.generateInvoiceToken; } });
Object.defineProperty(exports, "batchGenerateInvoices", { enumerable: true, get: function () { return invoiceTokens_1.batchGenerateInvoices; } });
const moderation_1 = require("./moderation");
Object.defineProperty(exports, "moderateMedia", { enumerable: true, get: function () { return moderation_1.moderateMedia; } });
const analyzeMedia_1 = require("./analyzeMedia");
Object.defineProperty(exports, "analyzeMedia", { enumerable: true, get: function () { return analyzeMedia_1.analyzeMedia; } });
Object.defineProperty(exports, "batchAnalyzeMedia", { enumerable: true, get: function () { return analyzeMedia_1.batchAnalyzeMedia; } });
const googleDrive_1 = require("./googleDrive");
Object.defineProperty(exports, "listDrivePhotos", { enumerable: true, get: function () { return googleDrive_1.listDrivePhotos; } });
const accountSetup_1 = require("./accountSetup");
Object.defineProperty(exports, "setAccountPassword", { enumerable: true, get: function () { return accountSetup_1.setAccountPassword; } });
Object.defineProperty(exports, "sendCustomPasswordReset", { enumerable: true, get: function () { return accountSetup_1.sendCustomPasswordReset; } });
const corsHandler = (0, cors_1.default)({ origin: true });
admin.initializeApp();
const db = admin.firestore();
/**
 * Scheduled Cloud Function: runs nightly at 2am EST
 * Scrapes GameChanger for all active teams with gcTeamId
 */
exports.scrapeGameChanger = functions.pubsub
    .schedule('0 2 * * *')
    .timeZone('America/New_York')
    .onRun(async () => {
    console.log('Starting GameChanger scrape...');
    // Get all active teams with a gcTeamId
    const teamsSnapshot = await db
        .collection('teams')
        .where('active', '==', true)
        .get();
    const teamMappings = [];
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
    const playerMap = new Map();
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
            const stats = await (0, scraper_1.scrapeTeamStats)(team.gcTeamId);
            for (const stat of stats) {
                // Try to match player name
                const nameLower = stat.playerName.toLowerCase();
                const matched = playerMap.get(nameLower);
                const docId = `${team.gcTeamId}_${(matched === null || matched === void 0 ? void 0 : matched.id) || nameLower.replace(/\s+/g, '_')}_${stat.statType}_${team.season}`;
                await db.collection('gcStats').doc(docId).set({
                    playerId: (matched === null || matched === void 0 ? void 0 : matched.id) || '',
                    playerName: (matched === null || matched === void 0 ? void 0 : matched.name) || stat.playerName,
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
            const games = await (0, scraper_1.scrapeTeamGames)(team.gcTeamId);
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
        }
        catch (error) {
            console.error(`Error scraping team ${team.gcTeamId}:`, error);
        }
    }
    console.log('GameChanger scrape complete');
    return null;
});
/**
 * HTTP-triggered function for manual scraping (admin use)
 */
exports.triggerScrape = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        var _a;
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
            if (!userData || !(((_a = userData.roles) === null || _a === void 0 ? void 0 : _a.some((r) => ['admin', 'master-admin'].includes(r))) || ['admin', 'master-admin'].includes(userData.role))) {
                res.status(403).send('Forbidden: Admin access required');
                return;
            }
            // Run the scrape (same logic as scheduled function)
            const teamsSnapshot = await db
                .collection('teams')
                .where('active', '==', true)
                .get();
            const results = [];
            const playersSnapshot = await db.collection('players').get();
            const playerMap = new Map();
            playersSnapshot.forEach((doc) => {
                const data = doc.data();
                const fullName = `${data.firstName} ${data.lastName}`.toLowerCase();
                playerMap.set(fullName, { id: doc.id, name: `${data.firstName} ${data.lastName}` });
                playerMap.set(`${data.lastName}, ${data.firstName}`.toLowerCase(), { id: doc.id, name: `${data.firstName} ${data.lastName}` });
            });
            for (const teamDoc of teamsSnapshot.docs) {
                const data = teamDoc.data();
                if (!data.gcTeamId)
                    continue;
                try {
                    const stats = await (0, scraper_1.scrapeTeamStats)(data.gcTeamId);
                    const games = await (0, scraper_1.scrapeTeamGames)(data.gcTeamId);
                    for (const stat of stats) {
                        const nameLower = stat.playerName.toLowerCase();
                        const matched = playerMap.get(nameLower);
                        const docId = `${data.gcTeamId}_${(matched === null || matched === void 0 ? void 0 : matched.id) || nameLower.replace(/\s+/g, '_')}_${stat.statType}_${data.season}`;
                        await db.collection('gcStats').doc(docId).set({
                            playerId: (matched === null || matched === void 0 ? void 0 : matched.id) || '',
                            playerName: (matched === null || matched === void 0 ? void 0 : matched.name) || stat.playerName,
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
                }
                catch (error) {
                    results.push({ team: data.teamName || teamDoc.id, stats: -1, games: -1 });
                }
            }
            res.json({ success: true, results });
        }
        catch (error) {
            console.error('Scrape error:', error);
            res.status(500).json({ error: 'Scrape failed' });
        }
    });
});
//# sourceMappingURL=index.js.map