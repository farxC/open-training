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
      <View style={{ width: 3, backgroundColor: '#26241f' }} />

      <View className="flex-1 flex-row items-center px-4 py-3">
        <View className="flex-1">
          <Text style={{ color: '#928d80', fontSize: 9, fontWeight: '700', letterSpacing: 1.5 }}>
            PERSONAL RECORD
          </Text>
          <Text className="text-ink text-sm font-medium mt-0.5" numberOfLines={1}>
            {exerciseName}
          </Text>
          <Text className="text-ink-mute text-xs mt-0.5">
            {maxReps} {maxReps === 1 ? "rep" : "reps"}
          </Text>
        </View>
        <View className="items-end">
          <Text style={{ color: '#26241f', fontSize: 24, fontWeight: '700', fontFamily: 'JetBrains Mono, Menlo, Courier New, monospace', lineHeight: 28 }}>
            {maxWeightKg}
          </Text>
          <Text className="text-ink-mute text-xs">kg</Text>
        </View>
      </View>
    </View>
  );
}
