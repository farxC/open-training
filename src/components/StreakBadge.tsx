import { Text, View } from "react-native";
import colors from "@/theme/palette.json";

interface Props {
  days: number;
  recentDates?: string[];
}
export function StreakBadge({ days, recentDates = [] }: Props) {
  const trained = new Set(recentDates);
  const today = new Date();
  const grid = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (13 - index));
    return { date: date.toISOString().slice(0, 10), isToday: index === 13 };
  });
  return (
    <View
      style={{
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: 12,
        padding: 16,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <Text
          className="font-sans"
          style={{ fontSize: 13, color: colors.muted }}
        >
          Sequência atual
        </Text>
        <Text
          className="font-sans"
          style={{ fontSize: 14, fontWeight: "600", color: colors.ink }}
        >
          {days} {days === 1 ? "dia" : "dias"}
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: 5, maxWidth: 400 }}>
        {grid.map((day) => (
          <View
            key={day.date}
            accessibilityLabel={`${day.date}: ${trained.has(day.date) ? "treino realizado" : "sem treino"}`}
            style={{
              flex: 1,
              height: 14,
              borderRadius: 4,
              backgroundColor: trained.has(day.date)
                ? colors.success
                : colors.sidebar,
              borderWidth: day.isToday ? 1 : 0,
              borderColor: colors.primary,
            }}
          />
        ))}
      </View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: 8,
        }}
      >
        <Text
          className="font-sans"
          style={{ color: colors.muted, fontSize: 11 }}
        >
          Últimos 14 dias
        </Text>
        <Text
          className="font-sans"
          style={{ color: colors.muted, fontSize: 11 }}
        >
          Hoje
        </Text>
      </View>
    </View>
  );
}
