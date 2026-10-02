/**
 * Phone-number masking utilities — Feature: Agent Privacy (Wati parity).
 *
 * When `maskPhoneNumbers` is enabled on a workspace, AGENT-role users receive
 * masked numbers so that agents cannot harvest customer data externally.
 * Managers, Admins, and Super Admins always see the real number.
 *
 * Mask format: replace the last 4 characters with "****"
 *   +91 9876543210  →  +91 987654****
 *   +1 (555) 867-5309  →  +1 (555) 867-****  (last 4 of digit string)
 */

/** Visible to any role at or above MANAGER. */
const UNMASKED_ROLES = new Set(["MANAGER", "ADMIN", "SUPER_ADMIN"]);

/**
 * Mask the last 4 *digits* of a phone string, preserving non-digit chars.
 *
 * e.g. "+91 9876543210" → "+91 987654****"
 *      "9876543210"     → "987654****"
 */
export function maskPhone(phone: string): string {
  if (!phone) return phone;

  // Count digit positions from the right
  let digitsReplaced = 0;
  const chars = phone.split("");
  for (let i = chars.length - 1; i >= 0 && digitsReplaced < 4; i--) {
    if (/\d/.test(chars[i]!)) {
      chars[i] = "*";
      digitsReplaced++;
    }
  }
  return chars.join("");
}

/**
 * Conditionally mask a contact-like object's phoneNumber field in-place.
 * Returns a shallow copy so the original DB record is not mutated.
 */
export function applyMaskToContact<T extends { phoneNumber: string }>(
  contact: T,
  role: string,
  maskEnabled: boolean
): T {
  if (!maskEnabled || UNMASKED_ROLES.has(role)) return contact;
  return { ...contact, phoneNumber: maskPhone(contact.phoneNumber) };
}

/**
 * Map an array of contacts, masking phones where appropriate.
 */
export function maskContacts<T extends { phoneNumber: string }>(
  contacts: T[],
  role: string,
  maskEnabled: boolean
): T[] {
  if (!maskEnabled || UNMASKED_ROLES.has(role)) return contacts;
  return contacts.map((c) => applyMaskToContact(c, role, maskEnabled));
}
