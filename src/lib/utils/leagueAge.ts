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
 * The club plays two-year divisions (bands), not single years:
 *   8U  = age 8 and under
 *   10U = ages 9–10
 *   12U = ages 11–12
 *   14U = ages 13–14
 *   16U = ages 15–16
 *   18U = ages 17–18
 * Represented by the "U" number of each band.
 */
export const DIVISION_BANDS = [8, 10, 12, 14, 16, 18] as const;

/** The band (U-number) a given league age falls into. */
export const bandForAge = (age: number): number => {
  for (const b of DIVISION_BANDS) {
    if (age <= b) return b;
  }
  return 18; // anything over 18 tops out at 18U
};

/** The next band up, or null if already at the top (18U). */
export const nextBand = (band: number): number | null => {
  const i = DIVISION_BANDS.indexOf(band as (typeof DIVISION_BANDS)[number]);
  if (i === -1 || i >= DIVISION_BANDS.length - 1) return null;
  return DIVISION_BANDS[i + 1];
};

/**
 * Pull the band number out of a free-text age-group / team label. Grabs the
 * first 1–2 digit number ("14U" → 14, "13/14" → 13, "12U Blue" → 12) and snaps
 * it to the band it belongs to, so team labels normalize to a real division.
 * Returns null when no age can be read.
 */
export const bandFromLabel = (label: string | undefined | null): number | null => {
  if (!label) return null;
  const m = String(label).match(/\d{1,2}/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  if (isNaN(n)) return null;
  return bandForAge(n);
};

/**
 * Division band label from date of birth, e.g. "12U". Two-year bands per the
 * club's structure (see DIVISION_BANDS). Returns "" if the DOB is unknown.
 */
export const computeDivision = (dob: string | Date | undefined | null): string => {
  const age = computeLeagueAge(dob);
  if (age == null) return '';
  const band = bandForAge(age <= 8 ? 8 : age);
  return `${band}U`;
};
