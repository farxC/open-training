import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnalyticsFilters } from "@/components/AnalyticsFilters";
import { AnalyticsRecords } from "@/components/AnalyticsRecords";
import { AnalyticsSummary } from "@/components/AnalyticsSummary";
import { AnalyticsTrend } from "@/components/AnalyticsTrend";
import { MuscleFrequencyChart } from "@/components/MuscleFrequencyChart";
import { MuscleSeriesChart } from "@/components/MuscleSeriesChart";
import { SectionHeader } from "@/components/SectionHeader";
import { StreakBadge } from "@/components/StreakBadge";
import { isStrengthCategory, targetKindOf } from "@/data/modalities";
import { useAnalytics } from "@/hooks/useAnalytics";

export default function AnalyticsScreen() {
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
    strengthRecords,
    distanceRecords,
    muscleFreq,
    muscleSeries,
    streak,
    streakDates,
    currentRange,
    refresh,
  } = useAnalytics();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Two different questions: which summary/records shape to render (metric),
  // and whether muscle-group breakdowns mean anything here (training type).
  const isStrengthMetric = targetKindOf(modality) === "strength";
  const tracksMuscles = isStrengthCategory(modality);

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-4 pt-3 pb-4">
          <Text
            style={{
              color: "#928d80",
              fontSize: 10,
              fontWeight: "700",
              letterSpacing: 2,
              marginBottom: 2,
            }}
          >
            PERFORMANCE
          </Text>
          <Text
            className="text-ink font-display font-semibold text-3xl"
            style={{ letterSpacing: -0.6 }}
          >
            Analytics
          </Text>
        </View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: "#ddd8ce", marginHorizontal: 16, marginBottom: 20 }} />

        <View className="px-4">
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
            />
          ) : (
            <AnalyticsSummary
              kind="distance"
              modality={modality}
              current={distanceCurrent}
              previous={distancePrevious}
            />
          )}

          <View style={{ marginTop: 28 }}>
            <AnalyticsTrend modality={modality} granularity={granularity} trend={trend} />
          </View>

          <View style={{ marginTop: 28 }}>
            <AnalyticsRecords
              modality={modality}
              strengthRecords={strengthRecords}
              distanceRecords={distanceRecords}
              currentRange={currentRange}
            />
          </View>

          {tracksMuscles && (
            <View style={{ marginTop: 28 }}>
              <SectionHeader title="Grupos musculares" />
              <MuscleFrequencyChart data={muscleFreq} />
            </View>
          )}

          {tracksMuscles && (
            <View style={{ marginTop: 28 }}>
              <SectionHeader title="Séries por grupo muscular" />
              <MuscleSeriesChart data={muscleSeries} />
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
