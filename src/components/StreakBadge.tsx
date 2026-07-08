import { Text, View } from "react-native";

interface Props {
  days: number;
  recentDates?: string[];
}

function buildGrid(recentDates: string[]): { date: string; trained: boolean; isToday: boolean }[] {
  const trainedSet = new Set(recentDates);
  const today = new Date();
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (13 - i));
    const dateStr = d.toISOString().slice(0, 10);
    return { date: dateStr, trained: trainedSet.has(dateStr), isToday: i === 13 };
  });
}

export function StreakBadge({ days, recentDates }: Props) {
  const grid = buildGrid(recentDates ?? []);

  return (
    <View className="bg-surface-card rounded-2xl p-4 mb-4">
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <View style={{ width: 2, height: 14, backgroundColor: '#26241f', borderRadius: 1 }} />
          <Text style={{ color: '#928d80', fontSize: 10, fontWeight: '600', letterSpacing: 1.5 }}>
            TRAINING STREAK
          </Text>
        </View>
        <View className="flex-row items-baseline" style={{ gap: 4 }}>
          <Text style={{ color: '#26241f', fontSize: 28, fontWeight: '700', fontFamily: 'JetBrains Mono, Menlo, Courier New, monospace', lineHeight: 32 }}>
            {days}
          </Text>
          <Text className="text-ink-mute text-xs">days</Text>
        </View>
      </View>

      {/* 14-day grid */}
      <View className="flex-row flex-wrap" style={{ gap: 5 }}>
        {grid.map(({ date, trained, isToday }) => (
          <View
            key={date}
            style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              backgroundColor: trained ? '#26241f' : '#ebe7df',
              borderWidth: isToday ? 1.5 : 0,
              borderColor: '#26241f',
              opacity: trained ? 1 : 1,
            }}
          />
        ))}
      </View>

      <View className="flex-row items-center justify-between mt-3">
        <Text className="text-ink-faint text-xs">14 days ago</Text>
        <Text className="text-ink-faint text-xs">today</Text>
      </View>

      {days === 0 && (
        <Text className="text-ink-mute text-xs mt-2">Train today to start your streak</Text>
      )}
    </View>
  );
}
