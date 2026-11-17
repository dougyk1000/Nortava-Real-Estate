import { verifyAdminSession, logoutUser } from '../api/api.js';

// Admin verification is strictly server-side via Supabase JWT + /api/admin/session.
// No hardcoded credentials or localStorage bypasses exist.

export async function requireAdminAccess() {
  const session = await verifyAdminSession();
  if (!session?.isAdmin) {
    window.location.href = '/auth/login.html';
    return false;
  }
  return true;
}

export async function clearAdminSession() {
  await logoutUser();
}
