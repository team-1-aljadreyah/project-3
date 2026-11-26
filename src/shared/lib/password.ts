// Passwords: the one rule every form and the demo backend check the same way, and a readable random one for a new
// account. The shortest allowed length is the CEO's setting (advanced settings: security.password_min, 6–32, 8 by
// default), sent to every page in /site/live. The real server checks it again and keeps only a hash.

export const PASSWORD_MIN_DEFAULT = 8;
export const PASSWORD_MAX = 128;

/** What is wrong with a new password, in both languages; null when it is fine. */
export function passwordProblem(password: string, min = PASSWORD_MIN_DEFAULT): { ar: string; en: string } | null {
  if (!password) return { ar: "اكتب كلمة مرور.", en: "Enter a password." };
  if (password.length < min) return { ar: `كلمة المرور قصيرة: ${arN(min, W.letter)} على الأقل.`, en: `The password is too short: at least ${min} characters.` };
  if (password.length > PASSWORD_MAX) return { ar: "كلمة المرور أطول من المسموح.", en: "The password is too long." };
  if (!password.trim()) return { ar: "لا يمكن أن تتكون كلمة المرور من مسافات فقط.", en: "The password can't be only spaces." };
  return null;
}

// No look-alike letters (l, 1, I, O, 0), so a password read out or copied by hand is typed right.
const LETTERS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A random password to give a new account (the person changes it from their profile). */
export function makePassword(length = 12) {
  const bytes = new Uint32Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => LETTERS[b % LETTERS.length]).join("");
}import { arN, W } from "@/shared/lib/count-words";

