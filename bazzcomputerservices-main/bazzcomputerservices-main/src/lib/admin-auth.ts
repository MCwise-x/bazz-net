export const ADMIN_USER = "ADMIN";
export const ADMIN_PASSWORD = "PrintMaster2025";

export function checkAdmin(user: string, pass: string): boolean {
  return user.trim() === ADMIN_USER && pass === ADMIN_PASSWORD;
}