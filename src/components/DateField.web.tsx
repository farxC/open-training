import { useTheme } from "@/theme";

interface Props {
  value: string | null;
  onChange: (iso: string) => void;
}

export function DateField({ value, onChange }: Props) {
  const { colors } = useTheme();
  return (
    <input
      type="date"
      value={value ?? ""}
      onChange={(e) => {
        if (e.target.value) onChange(e.target.value);
      }}
      style={{
        fontSize: 13,
        fontWeight: 500,
        color: colors["ink"],
        backgroundColor: colors["surface"],
        border: "1px solid #e7e4dc",
        borderRadius: 8,
        padding: "6px 10px",
        fontFamily: "inherit",
      }}
    />
  );
}
