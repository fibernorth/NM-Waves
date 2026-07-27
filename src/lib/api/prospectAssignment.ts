import { teamsApi } from '@/lib/api/teams';
import { appSettingsApi } from '@/lib/api/appSettings';
import {
  tryoutApplicantsApi,
  type TryoutApplicantData,
} from '@/lib/api/tryoutApplicants';
import { eligibleTeamIdsForApplicant } from '@/lib/utils/prospects';

/**
 * Ties a tryout registration to a season and to the teams the player is a
 * prospect for. Lives in its own module so teams.ts and tryoutApplicants.ts
 * stay free of each other (no import cycle) while both are composed here.
 */

/** The season new tryout registrations are filed under. */
export const resolveTryoutSeason = async (): Promise<string> => {
  const s = await appSettingsApi.getSeason();
  return s.tryoutSeason || s.currentSeason || '';
};

/**
 * Team ids an applicant should be a prospect for: their division band and one
 * up, among ACTIVE teams matching the season. Empty when no teams exist yet —
 * those get attached later when their team is created (teamsApi.create).
 */
export const computeProspectTeamIds = async (
  applicant: { season?: string; dateOfBirth?: string; ageGroup?: string }
): Promise<string[]> => {
  const teams = await teamsApi.getActive();
  return eligibleTeamIdsForApplicant(applicant, teams);
};

/**
 * Create a tryout registration with the current tryout season stamped on and
 * prospect teams pre-computed. Used by both the parent portal and the public
 * registration page so every new applicant lands correctly assigned.
 */
export const createTryoutRegistration = async (
  data: TryoutApplicantData
): Promise<string> => {
  const season = data.season || (await resolveTryoutSeason());
  let prospectTeamIds: string[] = [];
  try {
    prospectTeamIds = await computeProspectTeamIds({ ...data, season });
  } catch (err) {
    // Never block a family's registration on prospect matching.
    console.warn('Prospect matching at registration failed:', err);
  }
  return tryoutApplicantsApi.create({ ...data, season, prospectTeamIds });
};

/**
 * Recompute an existing applicant's prospect teams from the current active
 * roster (e.g. after an admin edits their DOB/age group or season). Replaces
 * the set. Returns the new list.
 */
export const resyncApplicantProspects = async (
  applicant: { id: string; season?: string; dateOfBirth?: string; ageGroup?: string }
): Promise<string[]> => {
  const ids = await computeProspectTeamIds(applicant);
  await tryoutApplicantsApi.setProspectTeams(applicant.id, ids);
  return ids;
};
