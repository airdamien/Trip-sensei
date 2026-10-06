import type { DayKind, HotelOption, LuggagePlan } from "@/lib/types";
import { minutesToLabel } from "@/lib/format";

export function luggageFor(args: {
  kind: DayKind;
  zone: string;
  wakeZone: string;
  sleepZone: string;
  reachMin: number | null;
  picked: HotelOption | null;
  flightLabel: string | null;
}): LuggagePlan {
  const { kind, zone, wakeZone, sleepZone, reachMin, picked, flightLabel } = args;
  const moving =
    picked !== null && picked.area !== sleepZone && picked.area !== wakeZone;

  if (moving && picked) {
    const early = reachMin !== null && reachMin < 15 * 60;
    return {
      headline: `Move to ${picked.name} tonight`,
      detail: early
        ? `You chose a hotel in ${picked.area}. Have this morning's hotel ship the suitcases, or drop them at the new desk. Before 3:00 pm they will store the bags for free. Ask if the room is already turned over — if it is, they often let you in at no extra charge. Paying for a guaranteed early check-in is a separate thing, and you do not need it just to park luggage.`
        : `You chose a hotel in ${picked.area}. Go there, check in, and put the bags in the room. Arriving after 3:00 pm is ordinary check-in, so there is no early-check-in fee. Book ${picked.name} before you fly so the desk has your name.`,
      bookHotel: true,
      bookReason: `Reserve ${picked.name}. Bag storage is free; the room itself is included once check-in has opened at 3:00 pm.`,
      alternateZone: null,
      alternateNote: null,
    };
  }

  if (kind === "arrival") {
    const reached = reachMin === null ? "the hotel" : minutesToLabel(reachMin);
    if (reachMin !== null && reachMin >= 15 * 60) {
      return {
        headline: "Check in and leave the bags in the room",
        detail: `You reach the ${sleepZone} hotel around ${reached}, after the usual 3:00 pm check-in. Book the room before you fly. Once 3:00 pm has passed there is no extra charge to take the room — the hotel has had the day to turn it over. Ride the Keikyu line in from Haneda and do this before any sightseeing.`,
        bookHotel: true,
        bookReason: `Reserve a ${sleepZone} hotel now so the desk is expecting you. You are not buying early check-in.`,
        alternateZone: null,
        alternateNote: null,
      };
    }
    return {
      headline: "Drop the bags, then ask if the room is ready",
      detail: `You get to the ${sleepZone} hotel around ${reached}, before 3:00 pm. They will keep the suitcases for free either way. If that room is already turned over they often let you in early at no charge. It only costs extra when you demand a guaranteed early check-in. Do not tour with the luggage.`,
      bookHotel: true,
      bookReason: "Book the hotel so storage is waiting under your name. Skip paid early check-in unless you need the room itself.",
      alternateZone: null,
      alternateNote: null,
    };
  }

  if (kind === "departure") {
    return {
      headline: "Check out at 11:00 and let the hotel hold the bags",
      detail: `Almost every Tokyo hotel keeps luggage after checkout for free. ${
        flightLabel
          ? `For a ${flightLabel} flight, be at Haneda three hours earlier.`
          : "Be at Haneda three hours before an international flight."
      } Ride Keikyu back. A station locker is only a backup if you will be nowhere near the hotel when it is time to leave.`,
      bookHotel: false,
      bookReason: "You already have the room. Ask the desk in the morning to hold the bags after 11:00.",
      alternateZone: null,
      alternateNote: null,
    };
  }

  if (kind === "day-trip") {
    return {
      headline: `Leave the suitcases in the ${sleepZone} room`,
      detail: `${zone} is there and back in a day. The room is still yours tonight, so the big bags stay put. A coin locker is for shopping, not for suitcases.`,
      bookHotel: false,
      bookReason: `Keep the ${sleepZone} room. Do not check out for a day trip.`,
      alternateZone: null,
      alternateNote: null,
    };
  }

  if (kind === "overnight" && wakeZone !== sleepZone) {
    return {
      headline: `Bags go with you to ${sleepZone}, or ahead of you`,
      detail: `You are changing hotels. The easy version is to ask ${wakeZone} to send the suitcases by takkyubin the evening before (usually next-day delivery, a couple of thousand yen a bag) and travel with a day bag. If you carry them, go straight to the new hotel and drop them. Before 3:00 pm that is free storage. After 3:00 pm, check in and put them in the room at no extra charge.`,
      bookHotel: true,
      bookReason: `Book the ${sleepZone} hotel before the travel day. Same-day bag delivery needs that hotel's name on the waybill.`,
      alternateZone: null,
      alternateNote: null,
    };
  }

  if (kind === "overnight") {
    return {
      headline: "Leave the suitcases in the room",
      detail: `You are already at the ${sleepZone} hotel. Take a day bag. Large luggage stays behind.`,
      bookHotel: false,
      bookReason: "The room is already booked for tonight.",
      alternateZone: null,
      alternateNote: null,
    };
  }

  if (kind === "open") {
    return {
      headline: `Leave the suitcases in the ${sleepZone} room`,
      detail: "Nothing is pinned to this day yet. The hotel is still your base. Add a wish, or wander from the room with a small bag.",
      bookHotel: false,
      bookReason: `Keep the ${sleepZone} room for the Tokyo nights.`,
      alternateZone: null,
      alternateNote: null,
    };
  }

  const alternate = zone !== sleepZone;
  return {
    headline: `Leave the suitcases in the ${sleepZone} room`,
    detail: alternate
      ? `You finish around ${zone}. That is a train ride back to ${sleepZone}, not a reason to change hotels. Moving bags across Tokyo costs the afternoon. Stay checked in and come home.`
      : `Same hotel as last night. The suitcases stay in the room. Carry a day bag.`,
    bookHotel: false,
    bookReason: `One ${sleepZone} room covers the Tokyo nights. Check out only when you leave the city or fly home.`,
    alternateZone: alternate ? zone : null,
    alternateNote: alternate
      ? `If you would rather fall into bed in ${zone}, book a second room and ship the bags that morning. Otherwise ride back.`
      : null,
  };
}
