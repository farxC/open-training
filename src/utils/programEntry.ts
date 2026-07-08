import type { ProgramEntry, RoutineUnitExercise } from "@/types";

/** Overlays a week's entry override (if any) onto a unit's fixed exercise targets. */
export function mergedTarget(ex: RoutineUnitExercise, entry: ProgramEntry | undefined) {
  return {
    target_sets: entry ? entry.target_sets : ex.target_sets,
    target_reps: entry ? entry.target_reps : ex.target_reps,
    target_reps_max: entry ? entry.target_reps_max : ex.target_reps_max,
    target_weight_kg: entry ? entry.target_weight_kg : ex.target_weight_kg,
    target_distance_km: entry ? entry.target_distance_km : ex.target_distance_km,
    target_duration_min: entry ? entry.target_duration_min : ex.target_duration_min,
    run_type: entry ? entry.run_type : ex.run_type,
    target_pace_sec: entry ? entry.target_pace_sec : ex.target_pace_sec,
    interval_reps: entry ? entry.interval_reps : ex.interval_reps,
    interval_work_sec: entry ? entry.interval_work_sec : ex.interval_work_sec,
    interval_work_km: entry ? entry.interval_work_km : ex.interval_work_km,
    interval_rest_sec: entry ? entry.interval_rest_sec : ex.interval_rest_sec,
  };
}
