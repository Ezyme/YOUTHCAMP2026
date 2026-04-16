/** Camp team login (per-team accounts). Separate from admin. */

export const CAMP_AUTH_COOKIE = "youthcamp_camp_auth";
export const CAMP_TEAM_COOKIE = "youthcamp_team_id";

const CAMP_REQUIRE_LOGIN_DISABLED = new Set(["0", "false", "no", "off", ""]);

/**
 * Whether camp routes should require team login (middleware + `/api/camp/login`).
 * - Legacy: non-empty `CAMP_LOGIN_PASSWORD` enables the gate.
 * - `CAMP_REQUIRE_LOGIN`: empty/unset disables; any other non-disabled value enables
 *   (e.g. `1`, `6`, `true`, `yes`). Use explicit `0`/`false`/`no`/`off` to disable.
 */
export function isCampGateEnabled(): boolean {
  if ((process.env.CAMP_LOGIN_PASSWORD?.trim().length ?? 0) > 0) return true;
  const req = process.env.CAMP_REQUIRE_LOGIN?.trim().toLowerCase() ?? "";
  if (!req) return false;
  if (CAMP_REQUIRE_LOGIN_DISABLED.has(req)) return false;
  return true;
}

/** @deprecated Use isCampGateEnabled */
export function isCampLoginEnforced(): boolean {
  return isCampGateEnabled();
}
