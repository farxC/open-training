import { db } from "./client";
import { createSession, snapshotSessionExercise, updateSession } from "./queries";
import { generateUuid } from "../utils/uuid";
import { dateToISO } from "../utils/cycle";
import { validateFitImport } from "../fit/validate";
import type { FitActivity, FitImport } from "../fit/types";
import type { DbHandle } from "./dbHandle";

export function getFitImport(sessionId: number, handle: DbHandle = db): FitImport | null {
  const row = handle.getFirstSync<{ uuid: string; payload: string }>(
    "SELECT uuid, payload FROM session_fit_imports WHERE session_id = ?", [sessionId]);
  return row ? { uuid: row.uuid, activity: JSON.parse(row.payload) } : null;
}

export function linkedFitSession(activity: FitActivity): number | null {
  return db.getFirstSync<{ session_id: number }>(
    "SELECT session_id FROM session_fit_imports WHERE activity_key = ? OR file_hash = ?",
    [activity.activityKey, activity.fileHash])?.session_id ?? null;
}

/** The surrounding importer owns the transaction. UUIDs are portable, local IDs are not. */
export function writeFitImport(sessionId: number, link: FitImport, handle: DbHandle = db): void {
  validateFitImport(link);
  const session = handle.getFirstSync<{ modality: string }>("SELECT modality FROM sessions WHERE id = ?", [sessionId]);
  if (session?.modality !== "corrida") throw new Error("Vincule o arquivo FIT a uma sessão de corrida.");
  handle.runSync(`INSERT INTO session_fit_imports (session_id, uuid, activity_key, file_hash, payload) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET payload = excluded.payload, file_hash = excluded.file_hash`,
  [sessionId, link.uuid, link.activity.activityKey, link.activity.fileHash, JSON.stringify(link.activity)]);
}

export function importFitActivity(activity: FitActivity, targetSessionId?: number): number {
  validateFitImport({ uuid: "validation", activity });
  let sessionId = 0;
  db.withTransactionSync(() => {
    const linked = linkedFitSession(activity);
    if (linked !== null && targetSessionId !== undefined && linked !== targetSessionId) throw new Error("Este FIT já está vinculado a outra sessão.");
    sessionId = linked ?? targetSessionId ?? 0;
    const previous = sessionId ? getFitImport(sessionId) : null;
    if (previous && previous.activity.activityKey !== activity.activityKey) throw new Error("Esta sessão já tem outro arquivo FIT vinculado.");
    if (!sessionId) {
      const w = activity.workout;
      sessionId = createSession(dateToISO(new Date(w.start)), { modality: "corrida", name: w.title });
      updateSession(sessionId, { start_time: w.start, end_time: w.end,
        duration_seconds: Math.round(activity.timerSeconds ?? activity.elapsedSeconds) });
      const exercise = db.getFirstSync<{ id: number }>(
        "SELECT id FROM exercises WHERE modality = 'corrida' AND is_custom = 0 AND parent_exercise_id IS NULL ORDER BY id LIMIT 1", []);
      if (!exercise) throw new Error("Exercício de corrida não encontrado.");
      db.runSync(`INSERT INTO session_exercises (session_id, exercise_id, "order") VALUES (?, ?, 0)`, [sessionId, exercise.id]);
      snapshotSessionExercise(sessionId, exercise.id);
      // Only a full non-overlapping lap partition can replace the total. Partial
      // or competing lap definitions remain in the snapshot without double counting.
      let cursor = w.start;
      const partition = activity.laps.length > 0 && activity.laps.every((lap) => {
        const contiguous = Date.parse(lap.start) === Date.parse(cursor);
        cursor = lap.end;
        return contiguous;
      }) && Date.parse(cursor) === Date.parse(w.end);
      const segments = partition ? activity.laps : [{ distanceKm: w.distanceKm, timerSeconds: activity.timerSeconds }];
      segments.forEach((segment, index) => {
        const seconds = segment.timerSeconds;
        const pace = seconds !== null && segment.distanceKm !== null && segment.distanceKm > 0 ? Math.round(seconds / segment.distanceKm) : null;
        db.runSync(`INSERT INTO sets (session_id, exercise_id, set_number, reps, weight_kg, distance_km, duration_sec, pace_sec)
          VALUES (?, ?, ?, 0, 0, ?, ?, ?)`, [sessionId, exercise.id, index + 1, segment.distanceKm,
          seconds === null ? null : Math.round(seconds), pace]);
      });
    }
    writeFitImport(sessionId, { uuid: previous?.uuid ?? generateUuid(), activity });
  });
  return sessionId;
}
