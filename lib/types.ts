export type Interest =
  | "food"
  | "temples"
  | "neighborhoods"
  | "art"
  | "day-trips"
  | "onsen"
  | "shopping"
  | "nightlife"
  | "gardens";

export const INTERESTS: { id: Interest; label: string }[] = [
  { id: "food", label: "Food" },
  { id: "temples", label: "Temples" },
  { id: "neighborhoods", label: "Neighborhoods" },
  { id: "art", label: "Art" },
  { id: "gardens", label: "Gardens" },
  { id: "day-trips", label: "Day trips" },
  { id: "onsen", label: "Onsen" },
  { id: "shopping", label: "Shopping" },
  { id: "nightlife", label: "Nightlife" },
];

export type Priority = "must" | "want" | "if-time";
export type Pace = "relaxed" | "moderate" | "full";
export type TravelMode = "walk" | "transit" | "taxi";

export type RegionId =
  | "tokyo"
  | "yokohama"
  | "kamakura"
  | "nikko"
  | "hakone"
  | "fuji"
  | "kyoto"
  | "nara"
  | "osaka"
  | "kanazawa"
  | "hiroshima";

export type LatLng = { lat: number; lng: number; name: string };

export type Reservation = {
  needed: true;
  where: string;
  when: string;
  note: string;
};

export type RouteOption = {
  mode: TravelMode;
  minutes: number;
  costYen: number | null;
  summary: string;
  detail: string;
  reserve: Reservation | null;
  polyline: string | null;
  source: "google" | "estimate";
};

export type TimedEntry = { where: string; note: string };

export type Wish = {
  id: string;
  name: string;
  note: string;
  hint: string;
  lat: number;
  lng: number;
  zone: string;
  region: RegionId;
  durationMin: number;
  priority: Priority;
  tags: Interest[];
  reserve: TimedEntry | null;
  source: "catalog" | "search" | "custom";
  placeId?: string;
  updatedAt: string;
};

export type Deletion = { id: string; at: string };

export type HotelOption = {
  id: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
  blurb: string;
  priceBand: string;
  station: string;
  mapsUrl: string;
  rating?: number;
  source: "curated" | "google";
};

export type LuggagePlan = {
  headline: string;
  detail: string;
  bookHotel: boolean;
  bookReason: string;
  alternateZone: string | null;
  alternateNote: string | null;
};

export type TravelBlock = {
  type: "travel";
  id: string;
  fromName: string;
  toName: string;
  from: LatLng;
  to: LatLng;
  departMin: number;
  options: RouteOption[];
};

export type PlaceBlock = {
  type: "place";
  wishId: string;
  name: string;
  note: string;
  hint: string;
  lat: number;
  lng: number;
  zone: string;
  startMin: number;
  endMin: number;
  durationMin: number;
  reserve: TimedEntry | null;
};

export type HotelBlock = {
  type: "hotel";
  role: "drop" | "checkin" | "checkout" | "base" | "return";
  zone: string;
  timeMin: number;
  title: string;
  detail: string;
};

export type AirportBlock = {
  type: "airport";
  role: "arrive" | "depart";
  timeMin: number;
  title: string;
  detail: string;
};

export type Block = TravelBlock | PlaceBlock | HotelBlock | AirportBlock;

export type DayKind = "arrival" | "departure" | "tokyo" | "day-trip" | "overnight" | "open";

export type DayPlan = {
  date: string;
  label: string;
  holiday: string | null;
  title: string;
  kind: DayKind;
  zone: string;
  wakeZone: string;
  sleepZone: string;
  blocks: Block[];
  hotelOptions: HotelOption[];
  alternateHotels: HotelOption[];
  luggage: LuggagePlan;
  warnings: string[];
};

export type Trip = {
  code: string;
  title: string;
  arrival: string;
  departure: string;
  pace: Pace;
  interests: Interest[];
  wishes: Wish[];
  deletedWishIds: Deletion[];
  hotelPicks: Record<string, string>;
  legChoices: Record<string, TravelMode>;
  extraHotels: Record<string, HotelOption[]>;
  frameUpdatedAt: string;
  updatedAt: string;
  revision: number;
};

export type PlanResult = {
  days: DayPlan[];
  unscheduled: Wish[];
};
