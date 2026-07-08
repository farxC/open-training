import { Text, TouchableOpacity, View } from "react-native";
import { dateToISO, todayISO } from "@/utils/cycle";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface Props {
  monthDate: Date; // any date within the displayed month
  onMonthChange: (d: Date) => void;
  selectedDate?: string | null;
  onSelectDate: (dateISO: string) => void;
}

/** A plain month grid — no modal, no title, no "today" shortcut. Embed it wherever a
 *  date needs picking (a modal, a wizard step, …); those callers own the chrome around it. */
export function MonthCalendar({ monthDate, onMonthChange, selectedDate, onSelectDate }: Props) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const leading = (firstOfMonth.getDay() + 6) % 7; // Monday-based offset
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayISO();

  const cells: (number | null)[] = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View>
      <View className="flex-row items-center justify-between mb-3">
        <TouchableOpacity onPress={() => onMonthChange(new Date(year, month - 1, 1))} className="px-3 py-2">
          <Text className="text-ink-mute text-lg">‹</Text>
        </TouchableOpacity>
        <Text className="text-ink font-display font-semibold text-lg">
          {MONTHS[month]} {year}
        </Text>
        <TouchableOpacity onPress={() => onMonthChange(new Date(year, month + 1, 1))} className="px-3 py-2">
          <Text className="text-ink-mute text-lg">›</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row mb-1">
        {WEEKDAYS.map((w) => (
          <View key={w} className="flex-1 items-center">
            <Text className="text-ink-faint text-xs">{w}</Text>
          </View>
        ))}
      </View>

      <View className="flex-row flex-wrap">
        {cells.map((day, i) => {
          if (day == null) return <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
          const cellISO = dateToISO(new Date(year, month, day));
          const isToday = cellISO === today;
          const isSelected = cellISO === selectedDate;
          return (
            <TouchableOpacity
              key={i}
              style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 3 }}
              onPress={() => onSelectDate(cellISO)}
            >
              <View
                style={{
                  flex: 1,
                  borderRadius: 10,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isSelected ? "#26241f" : "transparent",
                  borderWidth: isToday && !isSelected ? 1.5 : 0,
                  borderColor: "#26241f",
                }}
              >
                <Text
                  style={{
                    color: isSelected ? "#ffffff" : "#26241f",
                    fontSize: 14,
                    fontWeight: isToday || isSelected ? "700" : "500",
                  }}
                >
                  {day}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
