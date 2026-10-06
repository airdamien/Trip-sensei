import { CATALOG, STARTER_IDS, wishFromCatalog } from "@/lib/catalog";
import type { Trip } from "@/lib/types";

const STAMP = "2026-10-06T00:00:00.000Z";

export function ensureStarterWishes(trip: Trip): Trip {
  const deleted = new Set(trip.deletedWishIds.map((item) => item.id));
  const have = new Set(trip.wishes.map((wish) => wish.id));
  const missing = CATALOG.filter((item) => STARTER_IDS.includes(item.id) && !have.has(item.id) && !deleted.has(item.id));
  if (!missing.length) return trip;
  return {
    ...trip,
    wishes: [...trip.wishes, ...missing.map((item) => wishFromCatalog(item, new Date().toISOString()))],
  };
}

export function starterTrip(): Trip {
  return {
    code: "",
    title: "Haneda week",
    arrival: "2026-11-03T14:30",
    departure: "2026-11-09T17:30",
    pace: "moderate",
    interests: ["food", "temples", "neighborhoods", "art", "gardens", "day-trips", "nightlife", "shopping", "onsen"],
    wishes: CATALOG.filter((item) => STARTER_IDS.includes(item.id)).map((item) => wishFromCatalog(item, STAMP)),
    deletedWishIds: [],
    hotelPicks: {},
    legChoices: {},
    extraHotels: {},
    frameUpdatedAt: STAMP,
    updatedAt: STAMP,
    revision: 1,
  };
}
