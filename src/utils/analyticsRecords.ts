// Pure grouping for the records accordion. Separate from analyticsAgg.ts because
// records aren't a time-window aggregate — they're all-time bests being filed
// under a muscle group.

import type { StrengthRecord } from "@/types";

/** Bucket for records whose exercise has no muscle group configured. */
export const UNGROUPED_KEY = "__ungrouped__";

export interface MuscleRecordGroup {
  muscle_group: string;
  records: StrengthRecord[];
}

/**
 * Files each record under every group it carries. Which groups those are is the
 * query's call, not this function's: getStrengthRecords hands over only the ones
 * an exercise emphasises most, so a bench press tagged chest 1× / triceps ½×
 * arrives as chest alone. A movement genuinely split across two groups still
 * arrives with both and is filed under both. Groups come back ordered by how
 * many records they hold, records within a group by weight; a record with no
 * group lands in UNGROUPED_KEY, which always sorts last so it never leads.
 */
export function groupRecordsByMuscle(records: StrengthRecord[]): MuscleRecordGroup[] {
  const byGroup = new Map<string, StrengthRecord[]>();

  for (const record of records) {
    const keys = record.muscle_groups.length > 0 ? record.muscle_groups : [UNGROUPED_KEY];
    for (const key of keys) {
      const bucket = byGroup.get(key);
      if (bucket) bucket.push(record);
      else byGroup.set(key, [record]);
    }
  }

  return Array.from(byGroup.entries())
    .map(([muscle_group, groupRecords]) => ({
      muscle_group,
      records: [...groupRecords].sort((a, b) => b.max_weight_kg - a.max_weight_kg),
    }))
    .sort((a, b) => {
      if (a.muscle_group === UNGROUPED_KEY) return 1;
      if (b.muscle_group === UNGROUPED_KEY) return -1;
      return b.records.length - a.records.length;
    });
}
