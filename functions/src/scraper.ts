import puppeteer from 'puppeteer';

interface ScrapedStat {
  playerName: string;
  statType: 'batting' | 'pitching' | 'fielding';
  stats: Record<string, number>;
}

interface ScrapedGame {
  opponent: string;
  date: Date;
  location: string;
  scoreUs: number;
  scoreThem: number;
  result: 'W' | 'L' | 'T';
}

/**
 * Scrape batting, pitching, and fielding stats from a GameChanger team page.
 * URL pattern: https://web.gc.com/teams/{gcTeamId}/stats
 */
export async function scrapeTeamStats(gcTeamId: string): Promise<ScrapedStat[]> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const results: ScrapedStat[] = [];

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

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
    const statTypes: Array<'batting' | 'pitching' | 'fielding'> = ['batting', 'pitching', 'fielding'];

    for (const statType of statTypes) {
      try {
        // Try navigating to specific stat type tab if available
        const tabUrl = `https://web.gc.com/teams/${gcTeamId}/stats?category=${statType}`;
        await page.goto(tabUrl, { waitUntil: 'networkidle2', timeout: 20000 });
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Extract table data
        const tableData = await page.evaluate(() => {
          const tables = document.querySelectorAll('table');
          const data: Array<{ name: string; stats: Record<string, string> }> = [];

          for (const table of Array.from(tables)) {
            const headers: string[] = [];
            const headerCells = table.querySelectorAll('thead th, thead td');
            headerCells.forEach(cell => {
              headers.push((cell.textContent || '').trim().toLowerCase());
            });

            if (headers.length < 2) continue;

            const rows = table.querySelectorAll('tbody tr');
            rows.forEach(row => {
              const cells = row.querySelectorAll('td');
              if (cells.length < 2) return;

              const name = (cells[0]?.textContent || '').trim();
              if (!name || name === 'Total' || name === 'Totals') return;

              const stats: Record<string, string> = {};
              for (let i = 1; i < cells.length && i < headers.length; i++) {
                const header = headers[i];
                const value = (cells[i]?.textContent || '').trim();
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
          const numericStats: Record<string, number> = {};
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
      } catch (err) {
        console.log(`  Could not scrape ${statType} stats: ${err}`);
      }
    }
  } catch (error) {
    console.error(`Error scraping stats for ${gcTeamId}:`, error);
  } finally {
    await browser.close();
  }

  return results;
}

/**
 * Scrape game results from a GameChanger team's schedule page.
 * URL pattern: https://web.gc.com/teams/{gcTeamId}/schedule
 */
export async function scrapeTeamGames(gcTeamId: string): Promise<ScrapedGame[]> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const results: ScrapedGame[] = [];

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    const scheduleUrl = `https://web.gc.com/teams/${gcTeamId}/schedule`;
    console.log(`  Loading schedule: ${scheduleUrl}`);
    await page.goto(scheduleUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for content
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Extract game data from the schedule page
    const games = await page.evaluate(() => {
      const gameElements = document.querySelectorAll(
        '[class*="game"], [class*="Game"], [class*="event"], [class*="Event"], [class*="schedule-item"], [class*="ScheduleItem"]'
      );

      const data: Array<{
        opponent: string;
        dateStr: string;
        location: string;
        scoreUs: string;
        scoreThem: string;
      }> = [];

      // Try to find game cards/rows
      gameElements.forEach(el => {
        const text = el.textContent || '';
        // Look for score patterns like "5-3" or "W 5-3" or "L 3-5"
        const scoreMatch = text.match(/(\d+)\s*[-\u2013]\s*(\d+)/);

        // Try to find opponent name
        const opponentEl = el.querySelector('[class*="opponent"], [class*="Opponent"], [class*="team-name"]');
        const opponent = opponentEl?.textContent?.trim() || '';

        // Try to find date
        const dateEl = el.querySelector('[class*="date"], [class*="Date"], time');
        const dateStr = dateEl?.textContent?.trim() || dateEl?.getAttribute('datetime') || '';

        // Try to find location
        const locationEl = el.querySelector('[class*="location"], [class*="Location"], [class*="venue"]');
        const location = locationEl?.textContent?.trim() || '';

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
          const cells = row.querySelectorAll('td, [class*="cell"]');
          const text = row.textContent || '';
          const scoreMatch = text.match(/(\d+)\s*[-\u2013]\s*(\d+)/);

          if (cells.length >= 3 && scoreMatch) {
            data.push({
              opponent: (cells[1]?.textContent || '').trim(),
              dateStr: (cells[0]?.textContent || '').trim(),
              location: cells.length > 3 ? (cells[3]?.textContent || '').trim() : '',
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
      let result: 'W' | 'L' | 'T' = 'T';
      if (scoreUs > scoreThem) result = 'W';
      else if (scoreUs < scoreThem) result = 'L';

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
  } catch (error) {
    console.error(`Error scraping games for ${gcTeamId}:`, error);
  } finally {
    await browser.close();
  }

  return results;
}
