import { db } from "./client";
import { snapshotSessionExercise, createSession, updateSession } from "./queries";
import { generateUuid } from "../utils/uuid";
import { dateToISO } from "../utils/cycle";
import { mergeWorkout, validateHealthImport } from "../health/model";
import type { HealthImport, HealthRun, HealthWorkout } from "../health/types";
import type { DbHandle } from "./dbHandle";

export function healthSourceScope(): string {
  const key = "health_connect_scope";
  const current = db.getFirstSync<{ value: string }>("SELECT value FROM user_meta WHERE key = ?", [key]);
  if (current) return current.value;
  const scope = generateUuid();
  db.runSync("INSERT INTO user_meta (key, value) VALUES (?, ?)", [key, scope]);
  return scope;
}

export function getHealthImport(sessionId: number, handle: DbHandle = db): HealthImport | null {
  const row = handle.getFirstSync<{ uuid: string; source_scope: string; payload: string }>(
    "SELECT uuid, source_scope, payload FROM session_health_connect WHERE session_id = ?", [sessionId]);
  return row ? { uuid: row.uuid, sourceScope: row.source_scope, workout: JSON.parse(row.payload) } : null;
}

export function linkedHealthSession(run: HealthRun, scope: string): number | null {
  return db.getFirstSync<{ session_id: number }>(
    "SELECT session_id FROM session_health_connect WHERE source_scope = ? AND origin_app = ? AND external_id = ?",
    [scope, run.origin, run.externalId])?.session_id ?? null;
}

/** Caller owns the transaction. Shared with backup restore; local ids never travel. */
export function writeHealthImport(sessionId: number, link: HealthImport, handle: DbHandle = db): void {
  validateHealthImport(link);
  const session = handle.getFirstSync<{ modality: string }>("SELECT modality FROM sessions WHERE id = ?", [sessionId]);
  if (session?.modality !== "corrida") throw new Error("Vincule os dados a uma sessão de corrida.");
  handle.runSync(
    `INSERT INTO session_health_connect (session_id, uuid, source_scope, origin_app, external_id, payload)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(session_id) DO UPDATE SET uuid = excluded.uuid, source_scope = excluded.source_scope,
       origin_app = excluded.origin_app, external_id = excluded.external_id, payload = excluded.payload`,
    [sessionId, link.uuid, link.sourceScope, link.workout.origin, link.workout.externalId, JSON.stringify(link.workout)]);
}

/** Explicit selection only: never match a workout by date/distance heuristics. */
export function importHealthWorkout(workout: HealthWorkout, scope: string, targetSessionId?: number): number {
  let sessionId = 0;
  db.withTransactionSync(() => {
    const linkedId = linkedHealthSession(workout, scope);
    if (linkedId !== null && targetSessionId !== undefined && targetSessionId !== linkedId) {
      throw new Error("Esta corrida já está vinculada a outra sessão.");
    }
    sessionId = linkedId ?? targetSessionId ?? 0;
    const previous = sessionId ? getHealthImport(sessionId) : null;
    // A restored backup keeps the old provider namespace. Moving it to this
    // installation requires explicit selection; never infer identity by time.
    const rebind = targetSessionId !== undefined && previous && previous.sourceScope !== scope && previous.workout.origin === workout.origin;
    if (previous && !rebind && (previous.sourceScope !== scope || previous.workout.externalId !== workout.externalId || previous.workout.origin !== workout.origin)) {
      throw new Error("Esta sessão já tem outra corrida vinculada.");
    }
    const link: HealthImport = { uuid: previous?.uuid ?? generateUuid(), sourceScope: scope,
      workout: mergeWorkout(rebind ? null : previous?.workout ?? null, workout) };
    validateHealthImport(link);
    if (!sessionId) {
      sessionId = createSession(dateToISO(new Date(workout.start)), { modality: "corrida", name: workout.title });
      const duration = Math.round((Date.parse(workout.end) - Date.parse(workout.start)) / 1000);
      updateSession(sessionId, { start_time: workout.start, end_time: workout.end, duration_seconds: duration });
      const exercise = db.getFirstSync<{ id: number }>(
        "SELECT id FROM exercises WHERE modality = 'corrida' AND is_custom = 0 AND parent_exercise_id IS NULL ORDER BY id LIMIT 1", []);
      if (!exercise) throw new Error("Exercício de corrida não encontrado.");
      db.runSync(`INSERT INTO session_exercises (session_id, exercise_id, "order") VALUES (?, ?, 0)`, [sessionId, exercise.id]);
      snapshotSessionExercise(sessionId, exercise.id);
      // Elapsed time can include pauses; do not fabricate moving pace. Keep this
      // in the import transaction rather than calling helpers that open their own.
      db.runSync(`INSERT INTO sets (session_id, exercise_id, set_number, reps, weight_kg, distance_km, duration_sec)
        VALUES (?, ?, 1, 0, 0, ?, ?)`, [sessionId, exercise.id, workout.distanceKm, duration]);
    }
    writeHealthImport(sessionId, link);
  });
  return sessionId;
}
