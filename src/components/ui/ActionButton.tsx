import type { ComponentProps } from "react";
import { StyleSheet } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Button, ButtonText } from "./button";
import colors from "@/theme/palette.json";

type Props = {
  label: string;
  icon?: ComponentProps<typeof MaterialCommunityIcons>["name"];
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
};

export function ActionButton({
  label,
  icon,
  onPress,
  variant = "primary",
  disabled,
}: Props) {
  const foreground = variant === "primary" ? colors.white : colors.primary;
  return (
    <Button
      accessibilityLabel={label}
      onPress={onPress}
      isDisabled={disabled}
      style={[
        styles.button,
        variant === "primary"
          ? styles.primary
          : variant === "secondary"
            ? styles.secondary
            : styles.ghost,
      ]}
    >
      {icon && (
        <MaterialCommunityIcons name={icon} size={18} color={foreground} />
      )}
      <ButtonText
        className="font-sans"
        style={[styles.label, { color: foreground }]}
      >
        {label}
      </ButtonText>
    </Button>
  );
}

export function IconButton({
  label,
  icon,
  onPress,
}: Pick<Props, "icon" | "onPress"> & { label: string }) {
  return (
    <Button
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.iconButton}
    >
      <MaterialCommunityIcons name={icon} size={22} color={colors.muted} />
    </Button>
  );
}

export function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active && styles.activeChip]}
    >
      <ButtonText
        className="font-sans"
        style={[styles.chipText, active && styles.activeChipText]}
      >
        {label}
      </ButtonText>
    </Button>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 46,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.pale },
  ghost: { backgroundColor: "transparent" },
  label: { fontSize: 13, fontWeight: "600" },
  iconButton: { width: 44, height: 44, borderRadius: 22 },
  chip: {
    minHeight: 36,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
  },
  activeChip: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  activeChipText: { color: colors.white },
});
