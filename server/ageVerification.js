// Server-side age verification module.
// Collects only birthYear and birthMonth (no full date of birth) to minimize personal data.
// Strictly distinguishes COPPA (< 13 restriction) from platform minimum age (18+ per Terms of Service).

export const COPPA_MIN_AGE = 13;
export const PLATFORM_MIN_AGE = 18;

export function verifyMinimumAge({ birthYear, birthMonth, minimumAge = COPPA_MIN_AGE, now = new Date() }) {
  const year = Number(birthYear);
  const month = Number(birthMonth);

  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;

  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return {
      allowed: false,
      code: 'INVALID_AGE_INPUT',
      status: 400,
      message: 'Please provide a valid birth month and birth year.'
    };
  }

  if (month < 1 || month > 12 || year < 1900 || year > currentYear) {
    return {
      allowed: false,
      code: 'INVALID_AGE_INPUT',
      status: 400,
      message: 'Please provide a valid birth month and birth year.'
    };
  }

  // Conservative calculation without collecting exact birth day:
  // If birth month is the current month or later in the calendar year, subtract 1 year
  // so an individual who has not yet reached the threshold age this month cannot slip through.
  let conservativeAge = currentYear - year;
  if (month >= currentMonth) {
    conservativeAge -= 1;
  }

  if (conservativeAge < COPPA_MIN_AGE) {
    return {
      allowed: false,
      code: 'COPPA_UNDER_13',
      status: 403,
      message: 'COPPA Notice: Users under 13 years of age cannot submit personal information or register an account.'
    };
  }

  if (conservativeAge < minimumAge) {
    return {
      allowed: false,
      code: 'MINIMUM_AGE_REQUIRED',
      status: 403,
      message: `You must be at least ${minimumAge} years old to use this feature under our Terms of Service.`
    };
  }

  return {
    allowed: true,
    code: 'AGE_VERIFIED',
    status: 200
  };
}
