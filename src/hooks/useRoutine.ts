import { useCallback, useState } from "react";
import {
  getSplits,
  createSplit,
  updateSplit,
  deleteSplit,
  moveSplit,
  getUnits,
  createUnit,
  updateUnitLabel,
  deleteUnit,
  moveUnit,
  getUnitExercises,
  addUnitExercise,
  updateUnitExerciseTargets,
  removeUnitExercise,
  reorderUnitExercises,
  getExercises,
  getOverridesInRange,
  setOverride as setOverrideQuery,
  clearOverride as clearOverrideQuery,
  getProgramsForSplit,
  createProgram,
  updateProgram,
  deleteProgram,
  setActiveProgram as setActiveProgramQuery,
  getProgramWeeks,
  addProgramWeek as addProgramWeekQuery,
  deleteProgramWeek as deleteProgramWeekQuery,
  updateProgramWeekLabel,
  updateProgramSetupProgress,
  getWeekEntries,
  upsertProgramEntry,
  deleteProgramEntry as deleteProgramEntryQuery,
} from "@/db/queries";
import { cyclicSlotIndex, weekday, weekIndexSince } from "@/utils/cycle";
import type {
  Exercise,
  Modality,
  RoutineSplit,
  RoutineUnit,
  RoutineUnitExercise,
  OverrideStatus,
  SplitMode,
  TrainingProgram,
  ProgramEntry,
} from "@/types";

export type TargetPatch = {
  target_sets?: number;
  target_reps?: number;
  target_reps_max?: number | null;
  target_weight_kg?: number | null;
  target_distance_km?: number | null;
  target_duration_min?: number | null;
  run_type?: "continuous" | "interval" | null;
  target_pace_sec?: number | null;
  interval_reps?: number | null;
  interval_work_sec?: number | null;
  interval_work_km?: number | null;
  interval_rest_sec?: number | null;
};

export interface DayScheduleEntry {
  split: RoutineSplit;
  unit: RoutineUnit | null; // the unit to perform that day (null when resting)
  status: "workout" | "rest";
}

function buildUnits(splits: RoutineSplit[]): Record<number, RoutineUnit[]> {
  const m: Record<number, RoutineUnit[]> = {};
  for (const s of splits) m[s.id] = getUnits(s.id);
  return m;
}

function buildExercises(unitsBySplit: Record<number, RoutineUnit[]>): Record<number, RoutineUnitExercise[]> {
  const m: Record<number, RoutineUnitExercise[]> = {};
  for (const units of Object.values(unitsBySplit)) {
    for (const u of units) m[u.id] = getUnitExercises(u.id);
  }
  return m;
}

function buildOverrides(): Record<string, OverrideStatus> {
  const m: Record<string, OverrideStatus> = {};
  for (const o of getOverridesInRange("0000-01-01", "9999-12-31")) m[o.date] = o.status;
  return m;
}

function buildPrograms(splits: RoutineSplit[]): Record<number, TrainingProgram[]> {
  const m: Record<number, TrainingProgram[]> = {};
  for (const s of splits) m[s.id] = getProgramsForSplit(s.id);
  return m;
}

/** Every corrida unit gets exactly one auto-provisioned "Correr" exercise — there's no per-exercise picker for corrida. */
function provisionCorridaExercise(unitId: number): void {
  const corridas = getExercises({ modality: "corrida" });
  const defaultEx = corridas.find((e) => e.name === "Correr") ?? corridas[0];
  if (!defaultEx) return;
  addUnitExercise({
    unit_id: unitId,
    exercise_id: defaultEx.id,
    order: 0,
    target_sets: 0,
    target_reps: 0,
    target_reps_max: null,
    target_weight_kg: null,
    target_distance_km: null,
    target_duration_min: null,
    run_type: "continuous",
    target_pace_sec: null,
    interval_reps: null,
    interval_work_sec: null,
    interval_work_km: null,
    interval_rest_sec: null,
  });
}

/** Overlays an active program's week-specific overrides onto a unit's fixed exercise targets. */
function applyProgramEntries(
  exercises: RoutineUnitExercise[],
  entries: ProgramEntry[]
): RoutineUnitExercise[] {
  if (entries.length === 0) return exercises;
  const byExercise = new Map(entries.map((e) => [e.exercise_id, e]));
  return exercises.map((ex) => {
    const entry = byExercise.get(ex.exercise_id);
    if (!entry) return ex;
    return {
      ...ex,
      target_sets: entry.target_sets ?? ex.target_sets,
      target_reps: entry.target_reps ?? ex.target_reps,
      target_reps_max: entry.target_reps_max,
      target_weight_kg: entry.target_weight_kg,
      target_distance_km: entry.target_distance_km,
      target_duration_min: entry.target_duration_min,
      run_type: entry.run_type,
      target_pace_sec: entry.target_pace_sec,
      interval_reps: entry.interval_reps,
      interval_work_sec: entry.interval_work_sec,
      interval_work_km: entry.interval_work_km,
      interval_rest_sec: entry.interval_rest_sec,
    };
  });
}

export function useRoutine() {
  const [splits, setSplits] = useState<RoutineSplit[]>(() => getSplits());
  const [unitsBySplit, setUnitsBySplit] = useState<Record<number, RoutineUnit[]>>(() =>
    buildUnits(getSplits())
  );
  const [exercisesByUnit, setExercisesByUnit] = useState<Record<number, RoutineUnitExercise[]>>(
    () => buildExercises(buildUnits(getSplits()))
  );
  const [overrides, setOverrides] = useState<Record<string, OverrideStatus>>(() => buildOverrides());
  const [programsBySplit, setProgramsBySplit] = useState<Record<number, TrainingProgram[]>>(() =>
    buildPrograms(getSplits())
  );

  const refreshAll = useCallback(() => {
    const s = getSplits();
    const u = buildUnits(s);
    setSplits(s);
    setUnitsBySplit(u);
    setExercisesByUnit(buildExercises(u));
    setOverrides(buildOverrides());
    setProgramsBySplit(buildPrograms(s));
  }, []);

  // ── Split mutators ────────────────────────────────────────────────
  const addSplit = useCallback(
    (name: string, mode: SplitMode, modality: Modality): number => {
      const id = createSplit({ name, mode, modality });
      refreshAll();
      return id;
    },
    [refreshAll]
  );
  const renameSplit = useCallback((id: number, name: string) => {
    updateSplit(id, { name });
    setSplits((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
  }, []);
  const removeSplit = useCallback((id: number) => { deleteSplit(id); refreshAll(); }, [refreshAll]);
  const reorderSplit = useCallback(
    (id: number, dir: "up" | "down") => { moveSplit(id, dir); refreshAll(); },
    [refreshAll]
  );
  const setRestWeekdays = useCallback(
    (id: number, days: number[]) => { updateSplit(id, { rest_weekdays: days }); refreshAll(); },
    [refreshAll]
  );
  const setSplitAnchorDate = useCallback(
    (id: number, anchorISO: string) => { updateSplit(id, { anchor_date: anchorISO }); refreshAll(); },
    [refreshAll]
  );

  // ── Unit mutators ─────────────────────────────────────────────────
  const addUnit = useCallback(
    (split: RoutineSplit, opts?: { ordinal?: number; label?: string }) => {
      let unitId: number;
      if (split.mode === "cyclic") {
        const count = getUnits(split.id).length;
        unitId = createUnit({ split_id: split.id, ordinal: count, label: opts?.label ?? `Dia ${count + 1}` });
      } else {
        if (opts?.ordinal === undefined) return; // weekly needs a weekday
        unitId = createUnit({ split_id: split.id, ordinal: opts.ordinal, label: opts.label ?? split.name });
      }
      // Auto-add default running exercise so corrida units are never empty.
      if (split.modality === "corrida") provisionCorridaExercise(unitId);
      refreshAll();
    },
    [refreshAll]
  );
  const renameUnit = useCallback((id: number, label: string) => {
    updateUnitLabel(id, label);
    setUnitsBySplit((prev) => {
      const next: Record<number, RoutineUnit[]> = {};
      for (const [k, arr] of Object.entries(prev)) {
        next[Number(k)] = arr.map((u) => (u.id === id ? { ...u, label } : u));
      }
      return next;
    });
  }, []);
  const removeUnit = useCallback((id: number) => { deleteUnit(id); refreshAll(); }, [refreshAll]);
  const reorderUnit = useCallback(
    (id: number, dir: "up" | "down") => { moveUnit(id, dir); refreshAll(); },
    [refreshAll]
  );

  // ── Exercise mutators ─────────────────────────────────────────────
  const addExercise = useCallback(
    (unitId: number, exercise: Exercise) => {
      const existing = getUnitExercises(unitId);
      const isDistance = exercise.modality === "corrida";
      addUnitExercise({
        unit_id: unitId,
        exercise_id: exercise.id,
        order: existing.length,
        target_sets: isDistance ? 0 : 3,
        target_reps: isDistance ? 0 : 8,
        target_reps_max: null,
        target_weight_kg: null,
        target_distance_km: null,
        target_duration_min: null,
        run_type: isDistance ? "continuous" : null,
        target_pace_sec: null,
        interval_reps: null,
        interval_work_sec: null,
        interval_work_km: null,
        interval_rest_sec: null,
      });
      refreshAll();
    },
    [refreshAll]
  );
  const removeExercise = useCallback((id: number) => { removeUnitExercise(id); refreshAll(); }, [refreshAll]);
  const reorderExercises = useCallback(
    (unitId: number, orderedIds: number[]) => { reorderUnitExercises(unitId, orderedIds); refreshAll(); },
    [refreshAll]
  );

  // Optimistic target edits (avoid DB re-read per keystroke).
  const updateExerciseTargets = useCallback((id: number, patch: TargetPatch) => {
    updateUnitExerciseTargets(id, patch);
    setExercisesByUnit((prev) => {
      const next: Record<number, RoutineUnitExercise[]> = {};
      for (const [k, arr] of Object.entries(prev)) {
        next[Number(k)] = arr.map((e) => (e.id === id ? { ...e, ...patch } : e));
      }
      return next;
    });
  }, []);

  // ── Execution overrides ───────────────────────────────────────────
  const markOverride = useCallback((date: string, status: OverrideStatus) => {
    setOverrideQuery(date, status);
    setOverrides((prev) => ({ ...prev, [date]: status }));
  }, []);
  const clearOverrideMark = useCallback((date: string) => {
    clearOverrideQuery(date);
    setOverrides((prev) => {
      const n = { ...prev };
      delete n[date];
      return n;
    });
  }, []);

  // ── Training program mutators ──────────────────────────────────────
  const addProgram = useCallback(
    (splitId: number, name: string, totalWeeks: number): number => {
      const id = createProgram({ split_id: splitId, name, total_weeks: totalWeeks });
      for (let wn = 1; wn <= totalWeeks; wn++) addProgramWeekQuery(id, wn);
      refreshAll();
      return id;
    },
    [refreshAll]
  );
  const renameProgram = useCallback(
    (id: number, patch: { name?: string; total_weeks?: number }) => { updateProgram(id, patch); refreshAll(); },
    [refreshAll]
  );
  const removeProgram = useCallback((id: number) => { deleteProgram(id); refreshAll(); }, [refreshAll]);
  const activateProgram = useCallback(
    (splitId: number, programId: number) => { setActiveProgramQuery(splitId, programId); refreshAll(); },
    [refreshAll]
  );
  const addWeek = useCallback(
    (programId: number, weekNumber: number, label?: string | null) => {
      addProgramWeekQuery(programId, weekNumber, label);
      refreshAll();
    },
    [refreshAll]
  );
  const removeWeek = useCallback((id: number) => { deleteProgramWeekQuery(id); refreshAll(); }, [refreshAll]);
  const renameWeek = useCallback((id: number, label: string | null) => { updateProgramWeekLabel(id, label); refreshAll(); }, [refreshAll]);
  const setProgramSetupProgress = useCallback(
    (programId: number, weekNumber: number | null) => { updateProgramSetupProgress(programId, weekNumber); refreshAll(); },
    [refreshAll]
  );
  const upsertEntry = useCallback((entry: Omit<ProgramEntry, "id">) => { upsertProgramEntry(entry); refreshAll(); }, [refreshAll]);
  const removeEntry = useCallback((id: number) => { deleteProgramEntryQuery(id); refreshAll(); }, [refreshAll]);

  // ── Resolved targets (fixed unit target, overridden by the active program's current week) ──
  const resolvedTargetsForUnit = useCallback(
    (
      unit: RoutineUnit,
      split: RoutineSplit,
      dateISO: string
    ): { exercises: RoutineUnitExercise[]; programWeekId: number | null } => {
      const base = exercisesByUnit[unit.id] ?? [];
      if (!split.anchor_date) return { exercises: base, programWeekId: null };
      const active = (programsBySplit[split.id] ?? []).find((p) => p.is_active);
      if (!active) return { exercises: base, programWeekId: null };
      const weekIndex = weekIndexSince(split.anchor_date, dateISO);
      if (weekIndex < 0 || weekIndex >= active.total_weeks) return { exercises: base, programWeekId: null };
      const week = getProgramWeeks(active.id).find((w) => w.week_number === weekIndex + 1);
      if (!week) return { exercises: base, programWeekId: null };
      const entries = getWeekEntries(week.id).filter((e) => e.unit_id === unit.id);
      return { exercises: applyProgramEntries(base, entries), programWeekId: week.id };
    },
    [exercisesByUnit, programsBySplit]
  );

  // ── Per-date schedule selector ────────────────────────────────────
  const scheduleForDate = useCallback(
    (dateISO: string): { planned: DayScheduleEntry[]; override: OverrideStatus | null } => {
      const wd = weekday(dateISO);
      const planned: DayScheduleEntry[] = [];
      for (const split of splits) {
        const units = unitsBySplit[split.id] ?? [];
        if (split.mode === "weekly") {
          const unit = units.find((u) => u.ordinal === wd) ?? null;
          planned.push({ split, unit, status: unit ? "workout" : "rest" });
        } else {
          if (!split.anchor_date || units.length === 0) {
            planned.push({ split, unit: null, status: "rest" });
            continue;
          }
          const idx = cyclicSlotIndex(split.anchor_date, dateISO, units.length, split.rest_weekdays);
          if (idx < 0) {
            planned.push({ split, unit: null, status: "rest" });
            continue;
          }
          const unit = units.find((u) => u.ordinal === idx) ?? units[idx] ?? null;
          planned.push({ split, unit, status: unit ? "workout" : "rest" });
        }
      }
      return { planned, override: overrides[dateISO] ?? null };
    },
    [splits, unitsBySplit, overrides]
  );

  return {
    splits,
    unitsBySplit,
    exercisesByUnit,
    overrides,
    refreshAll,
    addSplit,
    renameSplit,
    removeSplit,
    reorderSplit,
    setRestWeekdays,
    setSplitAnchorDate,
    addUnit,
    renameUnit,
    removeUnit,
    reorderUnit,
    addExercise,
    removeExercise,
    reorderExercises,
    updateExerciseTargets,
    markOverride,
    clearOverrideMark,
    scheduleForDate,
    programsBySplit,
    addProgram,
    renameProgram,
    removeProgram,
    activateProgram,
    addWeek,
    removeWeek,
    renameWeek,
    setProgramSetupProgress,
    upsertEntry,
    removeEntry,
    resolvedTargetsForUnit,
  };
}
