import { useCallback, useState } from "react";
import {
  getVolumeByWeek,
  getPRs,
  getSessionFrequencyByMuscle,
  getStreakDays,
  getRecentSessionDates,
} from "@/db/queries";

export interface AnalyticsData {
  volumeByWeek: { week: string; volume_kg: number }[];
  prs: { exercise_id: number; exercise_name: string; max_weight_kg: number; max_reps_at_max: number }[];
  frequencyByMuscle: { muscle_group: string; count: number }[];
  streakDays: number;
  recentDates: string[];
}

function loadAnalytics(): AnalyticsData {
  return {
    volumeByWeek: getVolumeByWeek(12).reverse(),
    prs: getPRs(),
    frequencyByMuscle: getSessionFrequencyByMuscle(84),
    streakDays: getStreakDays(),
    recentDates: getRecentSessionDates(30),
  };
}

export function useAnalytics() {
  const [data, setData] = useState<AnalyticsData>(loadAnalytics);

  const refresh = useCallback(() => {
    setData(loadAnalytics());
  }, []);

  return { ...data, refresh };
}
