import type { ReactNode } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, type Href } from "expo-router";

interface Props {
  /** Static title text. Ignored if `titleNode` is passed (e.g. an editable name field). */
  title?: string;
  titleNode?: ReactNode;
  /** Custom back handler. Defaults to router.back(), falling back to `fallbackHref` when
   *  there's no history to pop (screen reached via a replace() chain, deep link, or refresh). */
  onBack?: () => void;
  fallbackHref?: Href;
  /** Right-aligned slot, e.g. a delete action. */
  right?: ReactNode;
  /** Hides the back chevron — used by forced-flow screens (wizards) with no previous step to return to. */
  showBack?: boolean;
}

export function ScreenHeader({ title, titleNode, onBack, fallbackHref, right, showBack = true }: Props) {
  const handleBack = () => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else if (fallbackHref) router.replace(fallbackHref);
  };

  return (
    <View className="flex-row items-center px-4 py-3" style={{ gap: 2 }}>
      {showBack && (
        <TouchableOpacity onPress={handleBack} hitSlop={12} style={{ marginLeft: -8, padding: 6 }}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#26241f" />
        </TouchableOpacity>
      )}
      <View className="flex-1" style={!showBack ? undefined : { marginLeft: 2 }}>
        {titleNode ?? (
          <Text
            className="text-ink font-display font-semibold text-2xl"
            style={{ letterSpacing: -0.4 }}
            numberOfLines={1}
          >
            {title}
          </Text>
        )}
      </View>
      {right}
    </View>
  );
}
