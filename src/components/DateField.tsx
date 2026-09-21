import { Platform, Pressable, Text } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { dateToISO } from "@/utils/cycle";
import { useTheme } from "@/theme";

interface Props {
  value: string | null;
  onChange: (iso: string) => void;
}

function toDate(iso: string | null): Date {
  return iso ? new Date(iso + "T00:00:00") : new Date();
}

export function DateField({ value, onChange }: Props) {
  const { colors } = useTheme();
  if (Platform.OS === "android") {
    return (
      <Pressable
        onPress={() =>
          DateTimePickerAndroid.open({
            value: toDate(value),
            mode: "date",
            onChange: (_event, selected) => {
              if (selected) onChange(dateToISO(selected));
            },
          })
        }
        style={{
          backgroundColor: colors["surface"],
          borderWidth: 1,
          borderColor: colors["brand-100"],
          borderRadius: 8,
          paddingVertical: 6,
          paddingHorizontal: 10,
        }}
      >
        <Text style={{ color: colors["ink"], fontSize: 13, fontWeight: "500" }}>
          {value ?? "Selecionar"}
        </Text>
      </Pressable>
    );
  }

  return (
    <DateTimePicker
      value={toDate(value)}
      mode="date"
      display="compact"
      onChange={(_event, selected) => {
        if (selected) onChange(dateToISO(selected));
      }}
    />
  );
}
