const AGE_GROUPS = ['8U', '9U', '10U', '11U', '12U', '13U', '14U', '15U', '16U', '17U', '18U'] as const;

/**
 * Calculate age group based on date of birth and season year.
 * Age is determined as of September 1 of the season year.
 * A player born on or after Sept 1 is one year younger for that season.
 */
export function calculateAgeGroup(dateOfBirth: Date, seasonYear: number): string {
  const birthYear = dateOfBirth.getFullYear();
  const birthMonth = dateOfBirth.getMonth(); // 0-indexed (Aug = 7, Sep = 8)
  const birthDay = dateOfBirth.getDate();

  // Age as of Sept 1 of the season year
  let age = seasonYear - birthYear;
  // If born after Sept 1, they haven't turned that age yet by the cutoff
  if (birthMonth > 8 || (birthMonth === 8 && birthDay > 1)) {
    age -= 1;
  }

  return `${age}U`;
}

/**
 * Get adjacent age groups (one level above and below).
 * Used for jersey number conflict checking.
 */
export function getAdjacentAgeGroups(ageGroup: string): string[] {
  const idx = AGE_GROUPS.indexOf(ageGroup as typeof AGE_GROUPS[number]);
  if (idx === -1) return [ageGroup];

  const result: string[] = [ageGroup];
  if (idx > 0) result.push(AGE_GROUPS[idx - 1]);
  if (idx < AGE_GROUPS.length - 1) result.push(AGE_GROUPS[idx + 1]);
  return result;
}

export { AGE_GROUPS };
