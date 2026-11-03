import uiColors from "@/theme/palette.json";
import { Platform, Pressable, Text } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { dateToISO } from "@/utils/cycle";

interface Props {
  value: string | null;
  onChange: (iso: string) => void;
}

function toDate(iso: string | null): Date {
  return iso ? new Date(iso + "T00:00:00") : new Date();
}

export function DateField({ value, onChange }: Props) {
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
          backgroundColor: uiColors.paper,
          borderWidth: 1,
          borderColor: uiColors.line,
          borderRadius: 8,
          paddingVertical: 6,
          paddingHorizontal: 10,
        }}
      >
        <Text className="font-sans" style={{ color: uiColors.ink, fontSize: 13, fontWeight: "500" }}>
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
