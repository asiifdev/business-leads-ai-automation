/**
 * The public half of the key that signs licence documents. Verifying needs nothing secret, so it lives in the open.
 * The private half is held only by the licence server (alatpintar.id). If it is ever rotated, replace this value.
 */
export const LICENSE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAB82CiBoAf0y6YTsPkTiegHpL1z+YM5z38mtJBXimthc=
-----END PUBLIC KEY-----`;
