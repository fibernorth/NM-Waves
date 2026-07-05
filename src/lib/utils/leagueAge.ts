/**
 * Softball "league age": the player's age as of the upcoming Sept 1 cutoff,
 * where turning that age exactly ON Sept 1 does NOT count yet (a player who
 * turns 9 on Sept 1 is age 8 → 8U). Implemented as age as of Aug 31 of the
 * upcoming season year. Accepts a date string (YYYY-MM-DD) or a Date.
 */
export const computeLeagueAge = (dob: string | Date | undefined | null): number | null => {
  if (!dob) return null;
  const d = dob instanceof Date ? dob : new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let seasonYear = now.getFullYear();
  if (now > new Date(seasonYear, 8, 1)) seasonYear += 1; // Sept = month index 8
  const cutoff = new Date(seasonYear, 7, 31); // Aug 31
  let age = cutoff.getFullYear() - d.getFullYear();
  const m = cutoff.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && cutoff.getDate() < d.getDate())) age--;
  return age;
};

/**
 * Division from league age: one division per single year (8U–14U), except the
 * top two brackets are combined — 16U covers ages 15 & 16, 18U covers 17 & 18.
 * Anything 8 or under is 8U. Returns e.g. "10U" or "" if unknown.
 */
export const computeDivision = (dob: string | Date | undefined | null): string => {
  const age = computeLeagueAge(dob);
  if (age == null) return '';
  let div = age;
  if (div <= 8) div = 8;
  else if (div === 15) div = 16;
  else if (div === 17 || div > 18) div = 18;
  return `${div}U`;
};
