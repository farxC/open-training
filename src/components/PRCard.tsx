import uiColors from "@/theme/palette.json";
import { Text, View } from "react-native";

interface Props {
  exerciseName: string;
  maxWeightKg: number;
  maxReps: number;
}

export function PRCard({ exerciseName, maxWeightKg, maxReps }: Props) {
  return (
    <View className="bg-surface-card rounded-xl mb-2 overflow-hidden flex-row">
      {/* Left accent bar */}
      <View style={{ width: 3, backgroundColor: uiColors.record }} />

      <View className="flex-1 flex-row items-center px-4 py-3">
        <View className="flex-1">
          <Text className="font-sans" style={{ color: uiColors.muted, fontSize: 9, fontWeight: '700', letterSpacing: 1.5 }}>
            PERSONAL RECORD
          </Text>
          <Text className="font-sans text-ink text-sm font-medium mt-0.5" numberOfLines={1}>
            {exerciseName}
          </Text>
          <Text className="font-sans text-ink-mute text-xs mt-0.5">
            {maxReps} {maxReps === 1 ? "rep" : "reps"}
          </Text>
        </View>
        <View className="items-end">
          <Text style={{ color: uiColors.ink, fontSize: 24, fontWeight: '700', fontFamily: 'JetBrains Mono', lineHeight: 28 }}>
            {maxWeightKg}
          </Text>
          <Text className="font-sans text-ink-mute text-xs">kg</Text>
        </View>
      </View>
    </View>
  );
}
