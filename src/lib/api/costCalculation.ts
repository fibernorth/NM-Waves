import { costItemsApi } from './costItems';
import { playerFinancesApi } from './finances';
import { playersApi } from './players';
import { teamsApi } from './teams';
import type { CostItem, CostFinanceField, PlayerFinance } from '@/types/models';

export interface PlayerCostBreakdown {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  orgCosts: { item: CostItem; perPlayerAmount: number }[];
  teamCosts: { item: CostItem; perPlayerAmount: number }[];
  playerCosts: { item: CostItem; perPlayerAmount: number }[];
  totals: Record<CostFinanceField, number>;
  grandTotal: number;
}

export interface TeamCostSummary {
  teamId: string;
  teamName: string;
  playerCount: number;
  orgCostPerPlayer: number;
  teamCostPerPlayer: number;
  totalPerPlayer: number;
  items: CostItem[];
}

const FINANCE_FIELDS: CostFinanceField[] = [
  'registrationFee',
  'uniformCost',
  'tournamentFees',
  'facilityFees',
  'equipmentFees',
  'otherFees',
];

export const costCalculationApi = {
  /**
   * Calculate per-player breakdown for a given season.
   * Org costs split across all active teams and their players.
   * Team costs split across players on that team.
   * Player costs applied directly.
   */
  calculatePlayerBreakdowns: async (
    season: string
  ): Promise<PlayerCostBreakdown[]> => {
    const [allCostItems, allFinances] = await Promise.all([
      costItemsApi.getBySeason(season),
      playerFinancesApi.getBySeason(season),
    ]);

    const activeCostItems = allCostItems.filter((c) => c.active);

    const orgItems = activeCostItems.filter((c) => c.tier === 'organization');
    const teamItems = activeCostItems.filter((c) => c.tier === 'team');
    const playerItems = activeCostItems.filter((c) => c.tier === 'player');

    // Build team player counts from finances (players who have finance records)
    const teamPlayerMap: Record<string, PlayerFinance[]> = {};
    for (const f of allFinances) {
      if (!teamPlayerMap[f.teamId]) teamPlayerMap[f.teamId] = [];
      teamPlayerMap[f.teamId].push(f);
    }

    const totalPlayersAcrossTeams = Object.values(teamPlayerMap).reduce(
      (sum, players) => sum + players.length,
      0
    );
    const breakdowns: PlayerCostBreakdown[] = [];

    for (const finance of allFinances) {
      const playersOnTeam = teamPlayerMap[finance.teamId]?.length || 1;

      const totals: Record<CostFinanceField, number> = {
        registrationFee: 0,
        uniformCost: 0,
        tournamentFees: 0,
        facilityFees: 0,
        equipmentFees: 0,
        otherFees: 0,
      };

      // Org costs: amount / totalPlayersAcrossTeams
      const orgBreakdown = orgItems.map((item) => {
        const perPlayerAmount =
          totalPlayersAcrossTeams > 0
            ? item.amount / totalPlayersAcrossTeams
            : 0;
        totals[item.financeField] += perPlayerAmount;
        return { item, perPlayerAmount };
      });

      // Team costs: amount / playersOnTeam (only for this player's team)
      const teamCostsForTeam = teamItems.filter(
        (c) => c.teamId === finance.teamId
      );
      const teamBreakdown = teamCostsForTeam.map((item) => {
        const perPlayerAmount = item.amount / playersOnTeam;
        totals[item.financeField] += perPlayerAmount;
        return { item, perPlayerAmount };
      });

      // Player costs: direct
      const playerCostsForPlayer = playerItems.filter(
        (c) => c.playerId === finance.playerId
      );
      const playerBreakdown = playerCostsForPlayer.map((item) => {
        totals[item.financeField] += item.amount;
        return { item, perPlayerAmount: item.amount };
      });

      const grandTotal = FINANCE_FIELDS.reduce(
        (sum, field) => sum + totals[field],
        0
      );

      breakdowns.push({
        playerId: finance.playerId,
        playerName: finance.playerName,
        teamId: finance.teamId,
        teamName: finance.teamName,
        orgCosts: orgBreakdown,
        teamCosts: teamBreakdown,
        playerCosts: playerBreakdown,
        totals,
        grandTotal,
      });
    }

    return breakdowns;
  },

  /**
   * Calculate summary per team
   */
  calculateTeamSummaries: async (
    season: string
  ): Promise<TeamCostSummary[]> => {
    const [allCostItems, allTeams, allFinances] = await Promise.all([
      costItemsApi.getBySeason(season),
      teamsApi.getAll(),
      playerFinancesApi.getBySeason(season),
    ]);

    const activeCostItems = allCostItems.filter((c) => c.active);
    const activeTeams = allTeams.filter((t) => t.status === 'active');

    const orgItems = activeCostItems.filter((c) => c.tier === 'organization');
    const teamItems = activeCostItems.filter((c) => c.tier === 'team');

    const teamPlayerMap: Record<string, number> = {};
    for (const f of allFinances) {
      teamPlayerMap[f.teamId] = (teamPlayerMap[f.teamId] || 0) + 1;
    }

    const totalPlayers = Object.values(teamPlayerMap).reduce(
      (sum, c) => sum + c,
      0
    );
    const orgCostTotal = orgItems.reduce((sum, c) => sum + c.amount, 0);
    const orgPerPlayer = totalPlayers > 0 ? orgCostTotal / totalPlayers : 0;

    return activeTeams.map((team) => {
      const playerCount = teamPlayerMap[team.id] || 0;
      const teamCostsForTeam = teamItems.filter((c) => c.teamId === team.id);
      const teamCostTotal = teamCostsForTeam.reduce(
        (sum, c) => sum + c.amount,
        0
      );
      const teamPerPlayer = playerCount > 0 ? teamCostTotal / playerCount : 0;

      return {
        teamId: team.id,
        teamName: team.name,
        playerCount,
        orgCostPerPlayer: orgPerPlayer,
        teamCostPerPlayer: teamPerPlayer,
        totalPerPlayer: orgPerPlayer + teamPerPlayer,
        items: teamCostsForTeam,
      };
    });
  },

  /**
   * Sync cost breakdowns to PlayerFinance records.
   * Updates the fee fields on each PlayerFinance based on the cost items.
   * Excludes quit players from division counts.
   */
  syncToBilling: async (season: string): Promise<{ updated: number; errors: string[] }> => {
    const breakdowns = await costCalculationApi.calculatePlayerBreakdowns(season);
    const allFinances = await playerFinancesApi.getBySeason(season);

    let updated = 0;
    const errors: string[] = [];

    for (const breakdown of breakdowns) {
      const finance = allFinances.find(
        (f) => f.playerId === breakdown.playerId && f.teamId === breakdown.teamId
      );
      if (!finance) continue;

      try {
        // Round to 2 decimal places
        const updateData: Partial<PlayerFinance> = {};
        for (const field of FINANCE_FIELDS) {
          const rounded = Math.round(breakdown.totals[field] * 100) / 100;
          if (rounded !== (finance as any)[field]) {
            (updateData as any)[field] = rounded;
          }
        }

        if (Object.keys(updateData).length > 0) {
          await playerFinancesApi.update(finance.id, updateData);
          updated++;
        }
      } catch (err: any) {
        errors.push(`Failed to update ${breakdown.playerName}: ${err.message}`);
      }
    }

    return { updated, errors };
  },

  /**
   * Redistribute team fees after a player quits.
   * Only updates remaining active players on the same team — does NOT
   * change the quit player's fees (they still owe what they owed).
   * Does NOT redistribute when a new player is added (they get custom fees).
   */
  redistributeAfterQuit: async (
    teamId: string,
    season: string
  ): Promise<{ updated: number; errors: string[] }> => {
    // Get all active players on this team
    const allPlayers = await playersApi.getByTeam(teamId);
    const activePlayers = allPlayers.filter(
      (p) => p.active && p.status !== 'quit'
    );
    const activePlayerIds = new Set(activePlayers.map((p) => p.id));

    // Get cost items for this team's season
    const allCostItems = await costItemsApi.getBySeason(season);
    const activeCostItems = allCostItems.filter((c) => c.active);
    const teamItems = activeCostItems.filter(
      (c) => c.tier === 'team' && c.teamId === teamId
    );

    // Get all finances for the season (needed for org-level player count)
    const allFinances = await playerFinancesApi.getBySeason(season);

    // Count total active players across all teams (excluding quit)
    const allActivePlayers = await playersApi.getActive();
    const activePlayerIdsAll = new Set(
      allActivePlayers.filter((p) => p.status !== 'quit').map((p) => p.id)
    );
    const totalActivePlayers = allFinances.filter(
      (f) => activePlayerIdsAll.has(f.playerId)
    ).length;

    // Org items split across all active players
    const orgItems = activeCostItems.filter((c) => c.tier === 'organization');

    const playersOnTeam = activePlayers.length;

    let updated = 0;
    const errors: string[] = [];

    // Update only active players on this team
    for (const finance of allFinances) {
      if (finance.teamId !== teamId) continue;
      if (!activePlayerIds.has(finance.playerId)) continue;

      const totals: Record<CostFinanceField, number> = {
        registrationFee: 0,
        uniformCost: 0,
        tournamentFees: 0,
        facilityFees: 0,
        equipmentFees: 0,
        otherFees: 0,
      };

      // Org costs
      for (const item of orgItems) {
        const perPlayer = totalActivePlayers > 0 ? item.amount / totalActivePlayers : 0;
        totals[item.financeField] += perPlayer;
      }

      // Team costs — divided by remaining active players
      for (const item of teamItems) {
        const perPlayer = playersOnTeam > 0 ? item.amount / playersOnTeam : 0;
        totals[item.financeField] += perPlayer;
      }

      // Player-level costs stay the same (direct assignment)
      const playerItems = activeCostItems.filter(
        (c) => c.tier === 'player' && c.playerId === finance.playerId
      );
      for (const item of playerItems) {
        totals[item.financeField] += item.amount;
      }

      try {
        const updateData: Partial<PlayerFinance> = {};
        for (const field of FINANCE_FIELDS) {
          const rounded = Math.round(totals[field] * 100) / 100;
          if (rounded !== (finance as any)[field]) {
            (updateData as any)[field] = rounded;
          }
        }

        if (Object.keys(updateData).length > 0) {
          await playerFinancesApi.update(finance.id, updateData);
          updated++;
        }
      } catch (err: any) {
        errors.push(`Failed to update ${finance.playerName}: ${err.message}`);
      }
    }

    return { updated, errors };
  },
};
