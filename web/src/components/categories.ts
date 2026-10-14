import type { EventCategory } from "@sentience/shared";

/** Decorative tint per category; the icon + label always carry identity. */
export const CATEGORY_TINT: Record<EventCategory, string> = {
  meal: "#eb6834",
  drink: "#2a78d6",
  supplement: "#1baf7a",
  medication: "#6250d6",
  hygiene: "#5ab0e3",
  sleep: "#4b4b9b",
  wake: "#eda100",
  movement: "#1baf7a",
  workout: "#e34948",
  work: "#2a78d6",
  study: "#6250d6",
  social: "#e87ba4",
  leisure: "#eda100",
  mood: "#e87ba4",
  symptom: "#e34948",
  location: "#8a8a93",
  chore: "#8a8a93",
  note: "#8a8a93",
};
