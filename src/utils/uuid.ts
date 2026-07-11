/**
 * Locally-unique identifier used as the merge key for export/import — not
 * cryptographically secure, just needs to not collide across two devices.
 */
export function generateUuid(): string {
  let out = "";
  for (let i = 0; i < 32; i++) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
}
