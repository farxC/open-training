export interface UserProfile {
  id: 1;
  name: string | null;
  username: string | null;
  photo_uri: string | null;
  cover_photo_uri: string | null;
  /** YYYY-MM-DD */
  birthdate: string | null;
  /** YYYY-MM-DD, declared by the user — independent of logged session history. */
  training_start_date: string | null;
  /** ISO timestamp, set once when the singleton row was seeded. */
  created_at: string;
}
