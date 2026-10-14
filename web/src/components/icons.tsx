import {
  Activity, AlarmClock, Bath, BookOpen, Brain, Briefcase, CalendarDays, Coffee, CupSoda, DoorOpen, Dna, Droplet, Dumbbell,
  FlaskConical, Flame, Footprints, Gamepad2, HeartPulse, House, Landmark, Library, MapPin, Medal, Moon, Notebook, Palette, Pill,
  Sandwich, Soup, Sparkles, SprayCan, StickyNote, Stethoscope, Sunrise, Target, Thermometer, TrendingUp, Trophy, Users, Utensils,
  type LucideIcon,
} from "lucide-react";
import type { EventCategory } from "@sentience/shared";

export const CATEGORY_ICON: Record<EventCategory, LucideIcon> = {
  meal: Utensils,
  drink: CupSoda,
  supplement: Pill,
  medication: Stethoscope,
  hygiene: Bath,
  sleep: Moon,
  wake: Sunrise,
  movement: Footprints,
  workout: Dumbbell,
  work: Briefcase,
  study: BookOpen,
  social: Users,
  leisure: Gamepad2,
  mood: Brain,
  symptom: Thermometer,
  location: MapPin,
  chore: SprayCan,
  note: StickyNote,
};

/** Achievement icon keys sent by the server. */
export const ACHIEVEMENT_ICON: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  notebook: Notebook,
  library: Library,
  flame: Flame,
  calendar: CalendarDays,
  landmark: Landmark,
  dna: Dna,
  heart: HeartPulse,
  "trending-up": TrendingUp,
  target: Target,
  medal: Medal,
  palette: Palette,
  flask: FlaskConical,
};
export const achievementIcon = (k: string): LucideIcon => ACHIEVEMENT_ICON[k] ?? Trophy;

export const QUICK_ICON = {
  wake: AlarmClock,
  teeth: Sparkles,
  breakfast: Coffee,
  vitamins: Pill,
  coffee: Coffee,
  water: Droplet,
  leave: DoorOpen,
  home: House,
  lunch: Sandwich,
  dinner: Soup,
  workout: Dumbbell,
  mood: Brain,
  bed: Moon,
  activity: Activity,
} satisfies Record<string, LucideIcon>;

/**
 * Category groups for multi-category charts. Eighteen categories can't each
 * get a distinguishable colour, so charts colour by group (six fixed slots)
 * and keep the per-category icon for identity.
 */
export const CATEGORY_GROUPS: { key: string; label: string; color: string; categories: EventCategory[] }[] = [
  { key: "food", label: "Food, drink & meds", color: "var(--series-2)", categories: ["meal", "drink", "supplement", "medication"] },
  { key: "body", label: "Body & routine", color: "var(--series-1)", categories: ["wake", "sleep", "hygiene"] },
  { key: "move", label: "Movement", color: "var(--series-3)", categories: ["movement", "workout"] },
  { key: "work", label: "Work & chores", color: "var(--series-7)", categories: ["work", "study", "chore"] },
  { key: "social", label: "Social & leisure", color: "var(--series-5)", categories: ["social", "leisure"] },
  { key: "mind", label: "Mind & notes", color: "var(--series-4)", categories: ["mood", "symptom", "location", "note"] },
];
export const CATEGORY_GROUP_COLOR: Record<EventCategory, string> = Object.fromEntries(
  CATEGORY_GROUPS.flatMap((g) => g.categories.map((c) => [c, g.color])),
) as Record<EventCategory, string>;

export function CategoryIcon({ category, className = "h-4 w-4" }: { category: EventCategory; className?: string }) {
  const I = CATEGORY_ICON[category];
  return <I className={className} strokeWidth={1.8} aria-hidden />;
}
