const CROCKFORD_BASE32 = "0123456789abcdefghjkmnpqrstvwxyz";

function encodeTimestamp(timestamp: number): string {
  let value = Math.floor(timestamp);
  let encoded = "";

  do {
    encoded = CROCKFORD_BASE32[value % 32] + encoded;
    value = Math.floor(value / 32);
  } while (value > 0);

  return encoded.padStart(10, "0");
}

function randomChars(length: number): string {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.getRandomValues) {
    const bytes = new Uint8Array(length);
    globalThis.crypto.getRandomValues(bytes);

    return Array.from(bytes, (byte) => CROCKFORD_BASE32[byte % CROCKFORD_BASE32.length]).join("");
  }

  let output = "";

  for (let index = 0; index < length; index += 1) {
    output += CROCKFORD_BASE32[Math.floor(Math.random() * CROCKFORD_BASE32.length)];
  }

  return output;
}

export function generateImmutableUsername(): string {
  return `lc_${encodeTimestamp(Date.now())}${randomChars(12)}`;
}
