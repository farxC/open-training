import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnalyticsFilters } from "@/components/AnalyticsFilters";
import { AnalyticsMuscleBreakdown } from "@/components/AnalyticsMuscleBreakdown";
import { AnalyticsRecords } from "@/components/AnalyticsRecords";
import { AnalyticsSummary } from "@/components/AnalyticsSummary";
import { AnalyticsTrend } from "@/components/AnalyticsTrend";
import { ProfileHeader } from "@/components/ProfileHeader";
import { StreakBadge } from "@/components/StreakBadge";
import { isStrengthCategory, targetKindOf } from "@/data/modalities";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useUserProfile } from "@/hooks/useUserProfile";
import { todayISO } from "@/utils/cycle";

export default function ProfileScreen() {
  const {
    modality,
    granularity,
    setModality,
    setGranularity,
    strengthCurrent,
    strengthPrevious,
    distanceCurrent,
    distancePrevious,
    trend,
    dayBars,
    dayBreakdown,
    recordsByGroup,
    hotExercises,
    distanceRecords,
    muscleFreq,
    muscleSeries,
    muscleBreakdown,
    streak,
    streakDates,
    analysisWindow,
    refresh,
  } = useAnalytics();
  const { profile, refresh: refreshProfile, update: updateProfile } = useUserProfile();

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshProfile();
    }, [refresh, refreshProfile])
  );

  // Two different questions: which summary/records shape to render (metric),
  // and whether muscle-group breakdowns mean anything here (training type).
  const isStrengthMetric = targetKindOf(modality) === "strength";
  const tracksMuscles = isStrengthCategory(modality);
  // The bar chart only earns its space as per-day bars, or as the long-view
  // fallback for modalities with no muscle breakdown to show instead.
  const showChart = granularity === "week" || !tracksMuscles;

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Sits outside the px-4 block on purpose: the cover photo is full-bleed
            and the avatar overlaps it with a negative margin. ProfileHeader also
            draws the divider that separates it from the stats below. */}
        <ProfileHeader profile={profile} onUpdate={updateProfile} />

        <View className="px-4">
          <Text
            style={{
              color: "#928d80",
              fontSize: 10,
              fontWeight: "700",
              letterSpacing: 2,
              marginBottom: 14,
            }}
          >
            DESEMPENHO
          </Text>

          <AnalyticsFilters
            modality={modality}
            granularity={granularity}
            onModalityChange={setModality}
            onGranularityChange={setGranularity}
          />

          <View style={{ marginTop: 20 }}>
            <StreakBadge days={streak} recentDates={streakDates} />
          </View>

          {isStrengthMetric ? (
            <AnalyticsSummary
              kind="strength"
              modality={modality}
              current={strengthCurrent}
              previous={strengthPrevious}
              comparisonLabel={analysisWindow.comparisonLabel}
            />
          ) : (
            <AnalyticsSummary
              kind="distance"
              modality={modality}
              current={distanceCurrent}
              previous={distancePrevious}
              comparisonLabel={analysisWindow.comparisonLabel}
            />
          )}

          {showChart && (
            <View style={{ marginTop: 28 }}>
              <AnalyticsTrend
                modality={modality}
                granularity={granularity}
                trend={trend}
                dayBars={dayBars}
                dayBreakdown={dayBreakdown}
                todayISO={todayISO()}
              />
            </View>
          )}

          {tracksMuscles && (
            <View style={{ marginTop: 28 }}>
              <AnalyticsMuscleBreakdown
                series={muscleSeries}
                frequency={muscleFreq}
                caption={analysisWindow.label}
                breakdown={muscleBreakdown}
              />
            </View>
          )}

          <View style={{ marginTop: 28 }}>
            <AnalyticsRecords
              modality={modality}
              recordsByGroup={recordsByGroup}
              hotExercises={hotExercises}
              distanceRecords={distanceRecords}
              currentRange={analysisWindow.range}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
