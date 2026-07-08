import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MuscleFrequencyChart } from "@/components/MuscleFrequencyChart";
import { PRCard } from "@/components/PRCard";
import { StreakBadge } from "@/components/StreakBadge";
import { VolumeChart } from "@/components/VolumeChart";
import { useAnalytics } from "@/hooks/useAnalytics";

function SectionHeader({ title }: { title: string }) {
  return (
    <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
      <View style={{ width: 2, height: 14, backgroundColor: '#26241f', borderRadius: 1 }} />
      <Text style={{ color: '#928d80', fontSize: 10, fontWeight: '700', letterSpacing: 1.5 }}>
        {title.toUpperCase()}
      </Text>
    </View>
  );
}

export default function AnalyticsScreen() {
  const { volumeByWeek, prs, frequencyByMuscle, streakDays, recentDates, refresh } =
    useAnalytics();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-4 pt-3 pb-4">
          <Text style={{ color: '#928d80', fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 2 }}>
            PERFORMANCE
          </Text>
          <Text className="text-ink font-display font-semibold text-3xl" style={{ letterSpacing: -0.6 }}>Analytics</Text>
        </View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: '#ddd8ce', marginHorizontal: 16, marginBottom: 20 }} />

        <View className="px-4">
          <StreakBadge days={streakDays} recentDates={recentDates} />

          <SectionHeader title="Weekly Volume" />
          <VolumeChart data={volumeByWeek} />

          <View style={{ marginTop: 28 }}>
            <SectionHeader title="Muscle Groups" />
            <MuscleFrequencyChart data={frequencyByMuscle} />
          </View>

          {prs.length > 0 && (
            <View style={{ marginTop: 28 }}>
              <SectionHeader title="Personal Records" />
              {prs.map((pr) => (
                <PRCard
                  key={pr.exercise_id}
                  exerciseName={pr.exercise_name}
                  maxWeightKg={pr.max_weight_kg}
                  maxReps={pr.max_reps_at_max}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
