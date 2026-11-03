import uiColors from "@/theme/palette.json";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnalyticsFilters } from "@/components/AnalyticsFilters";
import { AnalyticsMuscleBreakdown } from "@/components/AnalyticsMuscleBreakdown";
import { AnalyticsRecords } from "@/components/AnalyticsRecords";
import { AnalyticsSummary } from "@/components/AnalyticsSummary";
import { AnalyticsTrend } from "@/components/AnalyticsTrend";
import { IconButton } from "@/components/ui/ActionButton";
import { ProfileHeader } from "@/components/ProfileHeader";
import { StreakBadge } from "@/components/StreakBadge";
import { isStrengthCategory, targetKindOf } from "@/data/modalities";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useUserProfile } from "@/hooks/useUserProfile";
import { todayISO } from "@/utils/cycle";

export default function ProfileScreen() {
  const [showProfile, setShowProfile] = useState(false);
  const { width } = useWindowDimensions();
  const desktop = width >= 960;
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
  const {
    profile,
    refresh: refreshProfile,
    update: updateProfile,
  } = useUserProfile();

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshProfile();
    }, [refresh, refreshProfile]),
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
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            paddingTop: 14,
            paddingBottom: 20,
          }}
        >
          <Text
            className="font-display"
            style={{ color: uiColors.ink, fontSize: 32, letterSpacing: -1 }}
          >
            Evolução
          </Text>
          <IconButton
            label={showProfile ? "Ocultar perfil" : "Editar perfil"}
            icon="account-circle-outline"
            onPress={() => setShowProfile((value) => !value)}
          />
        </View>
        {showProfile && (
          <ProfileHeader profile={profile} onUpdate={updateProfile} />
        )}
        <View style={{ paddingHorizontal: 20 }}>
          <AnalyticsFilters
            modality={modality}
            granularity={granularity}
            onModalityChange={setModality}
            onGranularityChange={setGranularity}
          />

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

          <View style={{ marginTop: 20 }}>
            <StreakBadge days={streak} recentDates={streakDates} />
          </View>
          <View
            style={{
              flexDirection: desktop ? "row" : "column",
              gap: 24,
              marginTop: 26,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <View>
                <AnalyticsTrend
                  modality={modality}
                  granularity={granularity}
                  trend={trend}
                  dayBars={dayBars}
                  dayBreakdown={dayBreakdown}
                  todayISO={todayISO()}
                />
              </View>

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
            </View>
            <View style={desktop ? { width: 340 } : {}}>
              <AnalyticsRecords
                modality={modality}
                recordsByGroup={recordsByGroup}
                hotExercises={hotExercises}
                distanceRecords={distanceRecords}
                currentRange={analysisWindow.range}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
