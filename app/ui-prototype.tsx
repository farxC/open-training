import { Redirect } from "expo-router";

// Preserve the shared preview bookmark after promoting its design to the app.
export default function PreviewBookmark() {
  return <Redirect href="/" />;
}
