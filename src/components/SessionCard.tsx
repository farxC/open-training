import { Image, Text, TouchableOpacity, View } from "react-native";
import type { SessionSummary } from "@/types";

interface Props {
  session: SessionSummary;
  onPress: () => void;
}

const DAY_ABBREVS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return { day: DAY_ABBREVS[d.getDay()], month: MONTH_NAMES[d.getMonth()], date: d.getDate() };
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  return `${m}min`;
}

export function SessionCard({ session, onPress }: Props) {
  const { day, month, date } = parseDate(session.date);
  const duration = formatDuration(session.duration_seconds);

  return (
    <TouchableOpacity
      className="bg-surface-card mx-4 mb-3 rounded-2xl overflow-hidden"
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Top accent line */}
      <View style={{ height: 2, backgroundColor: '#26241f' }} />

      {session.cover_photo_uri && (
        <Image
          source={{ uri: session.cover_photo_uri }}
          className="w-full h-40"
          resizeMode="cover"
        />
      )}

      <View className="p-4">
        {/* Date row */}
        <View className="flex-row justify-between items-start mb-3">
          <View>
            <Text style={{ color: '#928d80', fontSize: 10, fontWeight: '700', letterSpacing: 1.5 }}>
              {day}
            </Text>
            <Text className="text-ink font-display font-medium text-xl leading-tight" style={{ letterSpacing: -0.3 }}>
              {session.name || `${month} ${date}`}
            </Text>
          </View>
          {duration !== "" && (
            <View className="bg-surface-elevated rounded-full px-3 py-1">
              <Text className="text-ink-mute text-xs">{duration}</Text>
            </View>
          )}
        </View>

        {/* Exercise chips */}
        {session.exercise_names.length > 0 && (
          <View className="flex-row flex-wrap mb-3" style={{ gap: 6 }}>
            {session.exercise_names.slice(0, 4).map((name, i) => (
              <View key={i} className="bg-surface-elevated rounded-full px-2.5 py-0.5">
                <Text className="text-ink-soft text-xs">{name}</Text>
              </View>
            ))}
            {session.exercise_names.length > 4 && (
              <View className="bg-surface-elevated rounded-full px-2.5 py-0.5">
                <Text className="text-ink-mute text-xs">+{session.exercise_names.length - 4}</Text>
              </View>
            )}
          </View>
        )}

        {/* Volume or distance */}
        {session.modality === "corrida" && session.total_distance_km != null && session.total_distance_km > 0 ? (
          <View className="flex-row items-baseline" style={{ gap: 4 }}>
            <Text style={{ color: '#26241f', fontSize: 22, fontWeight: '700', fontFamily: 'JetBrains Mono, Menlo, Courier New, monospace' }}>
              {session.total_distance_km.toFixed(1)}
            </Text>
            <Text className="text-ink-mute text-sm">km</Text>
          </View>
        ) : (
          session.total_volume != null && session.total_volume > 0 && (
            <View className="flex-row items-baseline" style={{ gap: 4 }}>
              <Text style={{ color: '#26241f', fontSize: 22, fontWeight: '700', fontFamily: 'JetBrains Mono, Menlo, Courier New, monospace' }}>
                {session.total_volume.toFixed(0)}
              </Text>
              <Text className="text-ink-mute text-sm">kg total volume</Text>
            </View>
          )
        )}

        {session.notes && (
          <Text className="text-ink-mute text-xs mt-2 italic" numberOfLines={1}>
            {session.notes}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}
