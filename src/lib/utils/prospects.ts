import type { Team } from '@/types/models';
import type { TryoutApplicant } from '@/lib/api/tryoutApplicants';
import { computeLeagueAge, bandForAge, nextBand, bandFromLabel } from './leagueAge';

/**
 * Prospect assignment: a tryout applicant is a prospect for teams in their own
 * division band AND the next band up (a player may "play up" one division).
 * The club's bands are two-year (8U, 10U, 12U, 14U, 16U, 18U), so a 12-year-old
 * is 12U and is also eligible for the 14U team — see leagueAge.ts.
 *
 * Matching is scoped to a season: an applicant only becomes a prospect for teams
 * whose season matches the season they tried out for.
 */

/** Normalize a season label for tolerant comparison (trim + lowercase). */
export const normalizeSeason = (s: string | undefined | null): string =>
  (s || '').trim().toLowerCase();

/**
 * The band numbers an applicant is eligible for: their own band and one up.
 * Uses date of birth when available, else falls back to the age group they
 * registered with. Returns [] when neither yields an age.
 */
export const eligibleBandsForApplicant = (a: {
  dateOfBirth?: string;
  ageGroup?: string;
  season?: string;
}): number[] => {
  // Age is computed relative to the applicant's SEASON (not today) so a band
  // doesn't drift a year once the clock passes Sept 1.
  const age = computeLeagueAge(a.dateOfBirth, a.season);
  const ownBand = age != null ? bandForAge(age <= 8 ? 8 : age) : bandFromLabel(a.ageGroup);
  if (ownBand == null) return [];
  const up = nextBand(ownBand);
  return up == null ? [ownBand] : [ownBand, up];
};

/** Minimal shape needed to match an applicant (works pre- or post-create). */
export interface ProspectLike {
  season?: string;
  dateOfBirth?: string;
  ageGroup?: string;
}

/** Does this applicant belong as a prospect on this team (age band + season)? */
export const applicantMatchesTeam = (a: ProspectLike, team: Team): boolean => {
  if (normalizeSeason(a.season) !== normalizeSeason(team.season)) return false;
  const teamBand = bandFromLabel(team.ageGroup);
  if (teamBand == null) return false;
  return eligibleBandsForApplicant(a).includes(teamBand);
};

/** Team ids an applicant should be a prospect for, from a pool of teams. */
export const eligibleTeamIdsForApplicant = (a: ProspectLike, teams: Team[]): string[] =>
  teams.filter((t) => applicantMatchesTeam(a, t)).map((t) => t.id);

/** Applicants who should be prospects for a given team, from a pool. */
export const eligibleApplicantsForTeam = (
  team: Team,
  applicants: TryoutApplicant[]
): TryoutApplicant[] => applicants.filter((a) => applicantMatchesTeam(a, team));
