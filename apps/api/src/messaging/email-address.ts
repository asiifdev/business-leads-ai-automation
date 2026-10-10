/** Deliberately simple: one "@", no spaces, a dotted domain. A mail server has the last word on whether a mailbox exists. */
export function isValidEmail(v: string): boolean {
  return v.length <= 254 && /^[^\s@]{1,64}@[^\s@]{1,190}\.[A-Za-z]{2,24}$/.test(v);
}
