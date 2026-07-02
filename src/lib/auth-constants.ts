/** Edge-safe auth constants (no DB/Prisma imports — safe for middleware). */
export const COOKIE_NAME = "bizweave_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
