import { CATALOG, STARTER_IDS, wishFromCatalog } from "@/lib/catalog";
import type { Trip } from "@/lib/types";

const STAMP = "2026-10-06T00:00:00.000Z";

export function starterTrip(): Trip {
  return {
    code: "",
    title: "Haneda week",
    arrival: "2026-11-03T14:30",
    departure: "2026-11-09T17:30",
    pace: "moderate",
    interests: ["food", "temples", "neighborhoods", "art", "gardens", "day-trips", "nightlife", "shopping"],
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
