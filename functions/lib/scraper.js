"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeTeamStats = scrapeTeamStats;
exports.scrapeTeamGames = scrapeTeamGames;
const puppeteer_1 = __importDefault(require("puppeteer"));
/**
 * Scrape batting, pitching, and fielding stats from a GameChanger team page.
 * URL pattern: https://web.gc.com/teams/{gcTeamId}/stats
 */
async function scrapeTeamStats(gcTeamId) {
    const browser = await puppeteer_1.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const results = [];
    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        // Navigate to stats page
        const statsUrl = `https://web.gc.com/teams/${gcTeamId}/stats`;
        console.log(`  Loading stats: ${statsUrl}`);
        await page.goto(statsUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        // Wait for stats content to load
        await page.waitForSelector('table, [class*="stat"], [class*="Stats"]', { timeout: 15000 }).catch(() => {
            console.log('  Stats table selector not found, trying alternative approach...');
        });
        // Give React app time to render
        await new Promise(resolve => setTimeout(resolve, 3000));
        // Extract stats tables - GC uses React and tables for stat display
        const statTypes = ['batting', 'pitching', 'fielding'];
        for (const statType of statTypes) {
            try {
                // Try navigating to specific stat type tab if available
                const tabUrl = `https://web.gc.com/teams/${gcTeamId}/stats?category=${statType}`;
                await page.goto(tabUrl, { waitUntil: 'networkidle2', timeout: 20000 });
                await new Promise(resolve => setTimeout(resolve, 2000));
                // Extract table data
                const tableData = await page.evaluate(() => {
                    const tables = document.querySelectorAll('table');
                    const data = [];
                    for (const table of Array.from(tables)) {
                        const headers = [];
                        const headerCells = table.querySelectorAll('thead th, thead td');
                        headerCells.forEach(cell => {
                            headers.push((cell.textContent || '').trim().toLowerCase());
                        });
                        if (headers.length < 2)
                            continue;
                        const rows = table.querySelectorAll('tbody tr');
                        rows.forEach(row => {
                            var _a, _b;
                            const cells = row.querySelectorAll('td');
                            if (cells.length < 2)
                                return;
                            const name = (((_a = cells[0]) === null || _a === void 0 ? void 0 : _a.textContent) || '').trim();
                            if (!name || name === 'Total' || name === 'Totals')
                                return;
                            const stats = {};
                            for (let i = 1; i < cells.length && i < headers.length; i++) {
                                const header = headers[i];
                                const value = (((_b = cells[i]) === null || _b === void 0 ? void 0 : _b.textContent) || '').trim();
                                if (header && value) {
                                    stats[header] = value;
                                }
                            }
                            if (Object.keys(stats).length > 0) {
                                data.push({ name, stats });
                            }
                        });
                    }
                    return data;
                });
                for (const row of tableData) {
                    const numericStats = {};
                    for (const [key, value] of Object.entries(row.stats)) {
                        const num = parseFloat(value);
                        if (!isNaN(num)) {
                            numericStats[key] = num;
                        }
                    }
                    if (Object.keys(numericStats).length > 0) {
                        results.push({
                            playerName: row.name,
                            statType,
                            stats: numericStats,
                        });
                    }
                }
            }
            catch (err) {
                console.log(`  Could not scrape ${statType} stats: ${err}`);
            }
        }
    }
    catch (error) {
        console.error(`Error scraping stats for ${gcTeamId}:`, error);
    }
    finally {
        await browser.close();
    }
    return results;
}
/**
 * Scrape game results from a GameChanger team's schedule page.
 * URL pattern: https://web.gc.com/teams/{gcTeamId}/schedule
 */
async function scrapeTeamGames(gcTeamId) {
    const browser = await puppeteer_1.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const results = [];
    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        const scheduleUrl = `https://web.gc.com/teams/${gcTeamId}/schedule`;
        console.log(`  Loading schedule: ${scheduleUrl}`);
        await page.goto(scheduleUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        // Wait for content
        await new Promise(resolve => setTimeout(resolve, 3000));
        // Extract game data from the schedule page
        const games = await page.evaluate(() => {
            const gameElements = document.querySelectorAll('[class*="game"], [class*="Game"], [class*="event"], [class*="Event"], [class*="schedule-item"], [class*="ScheduleItem"]');
            const data = [];
            // Try to find game cards/rows
            gameElements.forEach(el => {
                var _a, _b, _c;
                const text = el.textContent || '';
                // Look for score patterns like "5-3" or "W 5-3" or "L 3-5"
                const scoreMatch = text.match(/(\d+)\s*[-\u2013]\s*(\d+)/);
                // Try to find opponent name
                const opponentEl = el.querySelector('[class*="opponent"], [class*="Opponent"], [class*="team-name"]');
                const opponent = ((_a = opponentEl === null || opponentEl === void 0 ? void 0 : opponentEl.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || '';
                // Try to find date
                const dateEl = el.querySelector('[class*="date"], [class*="Date"], time');
                const dateStr = ((_b = dateEl === null || dateEl === void 0 ? void 0 : dateEl.textContent) === null || _b === void 0 ? void 0 : _b.trim()) || (dateEl === null || dateEl === void 0 ? void 0 : dateEl.getAttribute('datetime')) || '';
                // Try to find location
                const locationEl = el.querySelector('[class*="location"], [class*="Location"], [class*="venue"]');
                const location = ((_c = locationEl === null || locationEl === void 0 ? void 0 : locationEl.textContent) === null || _c === void 0 ? void 0 : _c.trim()) || '';
                if (opponent && scoreMatch) {
                    data.push({
                        opponent,
                        dateStr,
                        location,
                        scoreUs: scoreMatch[1],
                        scoreThem: scoreMatch[2],
                    });
                }
            });
            // Fallback: try table format
            if (data.length === 0) {
                const rows = document.querySelectorAll('table tbody tr, [class*="schedule"] [class*="row"]');
                rows.forEach(row => {
                    var _a, _b, _c;
                    const cells = row.querySelectorAll('td, [class*="cell"]');
                    const text = row.textContent || '';
                    const scoreMatch = text.match(/(\d+)\s*[-\u2013]\s*(\d+)/);
                    if (cells.length >= 3 && scoreMatch) {
                        data.push({
                            opponent: (((_a = cells[1]) === null || _a === void 0 ? void 0 : _a.textContent) || '').trim(),
                            dateStr: (((_b = cells[0]) === null || _b === void 0 ? void 0 : _b.textContent) || '').trim(),
                            location: cells.length > 3 ? (((_c = cells[3]) === null || _c === void 0 ? void 0 : _c.textContent) || '').trim() : '',
                            scoreUs: scoreMatch[1],
                            scoreThem: scoreMatch[2],
                        });
                    }
                });
            }
            return data;
        });
        for (const game of games) {
            const scoreUs = parseInt(game.scoreUs) || 0;
            const scoreThem = parseInt(game.scoreThem) || 0;
            let result = 'T';
            if (scoreUs > scoreThem)
                result = 'W';
            else if (scoreUs < scoreThem)
                result = 'L';
            let gameDate = new Date();
            if (game.dateStr) {
                const parsed = new Date(game.dateStr);
                if (!isNaN(parsed.getTime())) {
                    gameDate = parsed;
                }
            }
            results.push({
                opponent: game.opponent || 'Unknown',
                date: gameDate,
                location: game.location || '',
                scoreUs,
                scoreThem,
                result,
            });
        }
    }
    catch (error) {
        console.error(`Error scraping games for ${gcTeamId}:`, error);
    }
    finally {
        await browser.close();
    }
    return results;
}
//# sourceMappingURL=scraper.js.map