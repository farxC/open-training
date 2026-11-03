import { forwardRef, type ComponentProps, type ElementRef } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { createButton } from "@gluestack-ui/core/button/creator";
import { tva } from "@gluestack-ui/utils/nativewind-utils";

// Gluestack's behavior primitives with local styling, following its copy-in model.
const UIButton = createButton({
  Root: Pressable,
  Text,
  Group: View,
  Spinner: ActivityIndicator,
  Icon: View,
});

const buttonStyle = tva({
  base: "flex-row items-center justify-center data-[disabled=true]:opacity-40 data-[hover=true]:opacity-80 data-[active=true]:opacity-70 web:focus-visible:outline web:focus-visible:outline-2 web:focus-visible:outline-offset-2 web:focus-visible:outline-current",
});

export const Button = forwardRef<
  ElementRef<typeof UIButton>,
  ComponentProps<typeof UIButton>
>(function Button({ className, ...props }, ref) {
  return (
    <UIButton
      ref={ref}
      {...props}
      className={buttonStyle({ class: className })}
    />
  );
});

export const ButtonText = UIButton.Text;
