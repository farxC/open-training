import { useEffect, useState, type ComponentProps } from "react";
import { View, Text } from "react-native";
import { createTooltip } from "@gluestack-ui/core/tooltip/creator";
import { AnimatePresence, Motion } from "@legendapp/motion";

const UITooltip = createTooltip({
  Root: View,
  Content: Motion.View,
  Text,
  AnimatePresence,
});

export function Tooltip({
  isDisabled,
  isOpen,
  onOpen,
  onClose,
  ...props
}: ComponentProps<typeof UITooltip>) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (isDisabled) setOpen(false);
  }, [isDisabled]);
  return (
    <UITooltip
      {...props}
      isDisabled={isDisabled}
      isOpen={!isDisabled && (isOpen ?? open)}
      onOpen={() => {
        setOpen(true);
        onOpen?.();
      }}
      onClose={() => {
        setOpen(false);
        onClose?.();
      }}
    />
  );
}
export const TooltipContent = UITooltip.Content;
export const TooltipText = UITooltip.Text;
