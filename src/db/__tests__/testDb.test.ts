import { createInMemoryDb } from "./testDb";

describe("createInMemoryDb", () => {
  it("supports execSync, runSync, getAllSync, getFirstSync, and prepareSync", async () => {
    const db = await createInMemoryDb();

    db.execSync(
      "CREATE TABLE exercises (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE)"
    );
    db.runSync("INSERT INTO exercises (name) VALUES (?)", ["Supino reto"]);

    expect(db.getAllSync<{ id: number; name: string }>("SELECT * FROM exercises", [])).toEqual([
      { id: 1, name: "Supino reto" },
    ]);
    expect(
      db.getFirstSync<{ id: number; name: string }>("SELECT * FROM exercises WHERE id = ?", [1])
    ).toEqual({ id: 1, name: "Supino reto" });

    const stmt = db.prepareSync("INSERT INTO exercises (name) VALUES (?)");
    stmt.executeSync(["Agachamento"]);
    stmt.finalizeSync();

    expect(db.getAllSync<{ id: number; name: string }>("SELECT * FROM exercises", [])).toHaveLength(2);
  });
});
