import { generateUuid } from "./uuid";

describe("generateUuid", () => {
  it("returns a 32-character lowercase hex string", () => {
    const id = generateUuid();
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it("returns a different value on each call", () => {
    expect(generateUuid()).not.toBe(generateUuid());
  });
});
