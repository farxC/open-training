import { useCallback, useState } from "react";
import { getUserProfile, updateUserProfile } from "@/db/queries";
import type { UserProfile } from "@/types";

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile>(() => getUserProfile());

  const refresh = useCallback(() => {
    setProfile(getUserProfile());
  }, []);

  const update = useCallback(
    (
      patch: Partial<
        Pick<UserProfile, "name" | "username" | "photo_uri" | "cover_photo_uri" | "birthdate" | "training_start_date">
      >
    ) => {
      updateUserProfile(patch);
      setProfile((prev) => ({ ...prev, ...patch }));
    },
    []
  );

  return { profile, refresh, update };
}
