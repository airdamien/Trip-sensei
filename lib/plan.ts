import { hotelsFor } from "@/lib/hotels";
import { luggageFor } from "@/lib/luggage";
import { chosenOption, estimateOptions } from "@/lib/trains";
import {
  clockMinutes,
  eachDate,
  formatDay,
  holidayNote,
  isBusyDate,
} from "@/lib/format";
import { HANEDA, REGIONS, ZONE_ORDER, centroid, haversine } from "@/lib/geo";
import type {
  Block,
  DayKind,
  DayPlan,
  HotelOption,
  LatLng,
  PlanResult,
  PlaceBlock,
  RegionId,
  RouteOption,
  TravelBlock,
  Trip,
  Wish,
} from "@/lib/types";

const PACE_MIN = { relaxed: 240, moderate: 330, full: 450 } as const;

type Unit = {
  kind: Exclude<DayKind, "arrival" | "departure" | "open">;
  zone: string;
  region: RegionId;
  wishes: Wish[];
};

function byPriority(a: Wish, b: Wish): number {
  const rank = { must: 0, want: 1, "if-time": 2 };
  return rank[a.priority] - rank[b.priority];
}

function chunkByBudget(wishes: Wish[], budget: number): Wish[][] {
  const sorted = [...wishes].sort(byPriority);
  const chunks: Wish[][] = [];
  let current: Wish[] = [];
  let load = 0;
  for (const wish of sorted) {
    if (current.length && load + wish.durationMin > budget) {
      chunks.push(current);
      current = [];
      load = 0;
    }
    current.push(wish);
    load += wish.durationMin;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

function takeWithin(wishes: Wish[], budget: number): { keep: Wish[]; rest: Wish[] } {
  const sorted = [...wishes].sort(byPriority);
  const keep: Wish[] = [];
  const rest: Wish[] = [];
  let load = 0;
  for (const wish of sorted) {
    if (!keep.length || load + wish.durationMin <= budget) {
      keep.push(wish);
      load += wish.durationMin;
    } else {
      rest.push(wish);
    }
  }
  return { keep, rest };
}

function orderFrom(wishes: Wish[], start: LatLng): Wish[] {
  const left = [...wishes];
  const ordered: Wish[] = [];
  let cursor = start;
  while (left.length) {
    let best = 0;
    let bestD = Infinity;
    left.forEach((wish, index) => {
      const d = haversine(cursor, wish);
      if (d < bestD) {
        bestD = d;
        best = index;
      }
    });
    const [next] = left.splice(best, 1);
    ordered.push(next);
    cursor = { lat: next.lat, lng: next.lng, name: next.name };
  }
  return ordered;
}

function dedupeHotels(hotels: HotelOption[]): HotelOption[] {
  const seen = new Set<string>();
  return hotels.filter((hotel) => {
    if (seen.has(hotel.id)) return false;
    seen.add(hotel.id);
    return true;
  });
}

function travelBlock(date: string, from: LatLng, to: LatLng, departMin: number, index: number): TravelBlock {
  return {
    type: "travel",
    id: `${date}:${index}:${from.name}->${to.name}`,
    fromName: from.name,
    toName: to.name,
    from,
    to,
    departMin,
    options: estimateOptions(from, to, departMin, date),
  };
}

function placeBlock(wish: Wish, startMin: number): PlaceBlock {
  return {
    type: "place",
    wishId: wish.id,
    name: wish.name,
    note: wish.note,
    hint: wish.hint,
    lat: wish.lat,
    lng: wish.lng,
    zone: wish.zone,
    startMin,
    endMin: startMin + wish.durationMin,
    durationMin: wish.durationMin,
    reserve: wish.reserve,
  };
}

function chosenMinutes(block: TravelBlock, choices: Trip["legChoices"]): number {
  return chosenOption(block.options, choices[block.id]).minutes;
}

export function buildPlan(trip: Trip): PlanResult {
  const dates = eachDate(trip.arrival, trip.departure);
  const last = dates.length - 1;
  const wishes = trip.wishes;
  const groups = new Map<string, Wish[]>();

  for (const wish of wishes) {
    const region = wish.region === "nara" && wishes.some((item) => item.region === "kyoto") ? "kyoto" : wish.region;
    const zone = region === "tokyo" ? wish.zone : wish.zone;
    const key = region === "tokyo" ? `tokyo:${zone}` : region;
    const list = groups.get(key) ?? [];
    list.push({ ...wish, region });
    groups.set(key, list);
  }

  const tokyoChunks: Unit[] = [];
  const dayTrips: Unit[] = [];
  const overnights: Unit[] = [];

  for (const [key, bucket] of groups) {
    const sample = bucket[0];
    if (key.startsWith("tokyo:")) {
      for (const piece of chunkByBudget(bucket, PACE_MIN[trip.pace])) {
        tokyoChunks.push({ kind: "tokyo", zone: sample.zone, region: "tokyo", wishes: piece });
      }
    } else if (sample.region === "kamakura" || sample.region === "yokohama" || sample.region === "nikko") {
      dayTrips.push({ kind: "day-trip", zone: sample.zone, region: sample.region, wishes: bucket });
    } else {
      overnights.push({
        kind: "overnight",
        zone: sample.zone,
        region: sample.region,
        wishes: bucket,
      });
    }
  }

  tokyoChunks.sort((a, b) => {
    const ai = ZONE_ORDER.indexOf(a.zone);
    const bi = ZONE_ORDER.indexOf(b.zone);
    return (ai === -1 ? 50 : ai) - (bi === -1 ? 50 : bi);
  });

  const arrivalBudget = clockMinutes(trip.arrival) >= 12 * 60 ? 150 : 240;
  let arrivalZone = "Asakusa";
  let arrivalWishes: Wish[] = [];
  const asakusaIndex = tokyoChunks.findIndex((chunk) => chunk.zone === "Asakusa");
  const seedIndex = asakusaIndex >= 0 ? asakusaIndex : 0;
  if (tokyoChunks[seedIndex]) {
    const seed = tokyoChunks[seedIndex];
    const split = takeWithin(seed.wishes, arrivalBudget);
    arrivalZone = seed.zone;
    arrivalWishes = split.keep;
    tokyoChunks.splice(seedIndex, 1);
    if (split.rest.length) {
      tokyoChunks.unshift({ kind: "tokyo", zone: seed.zone, region: "tokyo", wishes: split.rest });
    }
  }

  type Slot = Unit | { kind: "arrival"; zone: string; region: RegionId; wishes: Wish[] } | { kind: "departure" } | null;
  const slots: Slot[] = dates.map(() => null);
  slots[0] = { kind: "arrival", zone: arrivalZone, region: "tokyo", wishes: arrivalWishes };
  if (last > 0) slots[last] = { kind: "departure" };

  const middle = dates.map((_, index) => index).slice(1, last);
  const weekend = middle.filter((index) => isBusyDate(dates[index]) && dates[index] !== "2026-11-03");

  function take(prefer: number[]): number | null {
    for (const index of prefer) {
      if (slots[index] === null) return index;
    }
    for (const index of middle) {
      if (slots[index] === null) return index;
    }
    return null;
  }

  function takeRun(length: number): number[] | null {
    for (let start = 0; start <= middle.length - length; start += 1) {
      const run = middle.slice(start, start + length);
      if (run.every((index) => slots[index] === null)) return run;
    }
    return null;
  }

  const unscheduled: Wish[] = [];

  for (const tripUnit of dayTrips) {
    const index = take(weekend);
    if (index === null) unscheduled.push(...tripUnit.wishes);
    else slots[index] = tripUnit;
  }

  for (const stay of overnights) {
    const span = stay.wishes.reduce((sum, wish) => sum + wish.durationMin, 0) > 360 ? 3 : 2;
    const run = takeRun(span);
    if (!run) {
      unscheduled.push(...stay.wishes);
      continue;
    }
    const weights = span === 3 ? [180, PACE_MIN[trip.pace], 160] : [200, 160];
    const pieces = splitWeighted(stay.wishes, weights);
    run.forEach((index, part) => {
      slots[index] = { ...stay, wishes: pieces[part] ?? [] };
    });
  }

  for (const chunk of tokyoChunks) {
    const index = take(middle);
    if (index === null) unscheduled.push(...chunk.wishes);
    else slots[index] = chunk;
  }

  const tokyoBase = arrivalZone;
  let sleep = tokyoBase;
  const days: DayPlan[] = dates.map((date, index) => {
    const slot = slots[index];
    const wakeZone = sleep;
    let kind: DayKind = "open";
    let zone = wakeZone;
    let region: RegionId = "tokyo";
    let dayWishes: Wish[] = [];

    if (slot && "kind" in slot && slot.kind === "departure") {
      kind = "departure";
      zone = "Haneda";
    } else if (slot && slot.kind === "arrival") {
      kind = "arrival";
      zone = slot.zone;
      dayWishes = slot.wishes;
      sleep = tokyoBase;
    } else if (slot && slot.kind === "day-trip") {
      kind = "day-trip";
      zone = slot.zone;
      region = slot.region;
      dayWishes = slot.wishes;
      sleep = tokyoBase;
    } else if (slot && slot.kind === "overnight") {
      kind = "overnight";
      zone = slot.zone;
      region = slot.region;
      dayWishes = slot.wishes;
      sleep = slot.zone;
    } else if (slot && slot.kind === "tokyo") {
      kind = "tokyo";
      zone = slot.zone;
      dayWishes = slot.wishes;
      sleep = tokyoBase;
    } else {
      kind = "open";
      zone = tokyoBase;
      sleep = tokyoBase;
    }

    const sleepZone = kind === "departure" ? wakeZone : sleep;
    const built = composeDay({
      date,
      kind,
      zone,
      region,
      wakeZone,
      sleepZone,
      wishes: dayWishes,
      trip,
    });
    return built;
  });

  return { days, unscheduled };
}

function splitWeighted(wishes: Wish[], weights: number[]): Wish[][] {
  const out = weights.map(() => [] as Wish[]);
  const loads = weights.map(() => 0);
  for (const wish of [...wishes].sort(byPriority)) {
    let index = out.findIndex((bucket, i) => loads[i] + wish.durationMin <= weights[i]);
    if (index === -1) index = weights.length - 1;
    out[index].push(wish);
    loads[index] += wish.durationMin;
  }
  return out;
}

function composeDay(args: {
  date: string;
  kind: DayKind;
  zone: string;
  region: RegionId;
  wakeZone: string;
  sleepZone: string;
  wishes: Wish[];
  trip: Trip;
}): DayPlan {
  const { date, kind, zone, wakeZone, sleepZone, wishes, trip } = args;
  const blocks: Block[] = [];
  let leg = 0;
  const warnings: string[] = [];
  const holiday = holidayNote(date);
  if (kind === "day-trip" || kind === "overnight") {
    warnings.push(REGIONS[args.region].train);
  }

  const pushTravel = (from: LatLng, to: LatLng, departMin: number) => {
    if (haversine(from, to) < 0.12) return departMin;
    const block = travelBlock(date, from, to, departMin, leg);
    leg += 1;
    blocks.push(block);
    return departMin + chosenMinutes(block, trip.legChoices);
  };

  let reachMin: number | null = null;

  if (kind === "arrival") {
    const land = clockMinutes(trip.arrival);
    blocks.push({
      type: "airport",
      role: "arrive",
      timeMin: land,
      title: "Land at Haneda",
      detail: "International flights usually use Terminal 3. Bags, customs, then the Keikyu station on the arrivals level.",
    });
    let cursor = land + 40;
    const hotel = centroid(sleepZone);
    cursor = pushTravel(HANEDA, { ...hotel, name: `${sleepZone} hotel` }, cursor);
    reachMin = cursor;
    const open = cursor >= 15 * 60;
    blocks.push({
      type: "hotel",
      role: open ? "checkin" : "drop",
      zone: sleepZone,
      timeMin: cursor,
      title: open ? `Check in, ${sleepZone}` : `Drop bags in ${sleepZone}`,
      detail: open
        ? "Check-in is open. The room can take the suitcases at no extra charge."
        : "The desk will hold the bags. Ask whether the room is already free.",
    });
    cursor += 25;
    cursor = addPlaces(blocks, wishes, centroid(sleepZone), cursor, () => {
      const id = leg;
      leg += 1;
      return id;
    }, date, trip.legChoices);
    const back = centroid(sleepZone);
    const lastPlace = [...blocks].reverse().find((block) => block.type === "place");
    if (lastPlace && lastPlace.type === "place" && haversine(lastPlace, back) > 0.5) {
      cursor = pushTravel({ lat: lastPlace.lat, lng: lastPlace.lng, name: lastPlace.name }, { ...back, name: `${sleepZone} hotel` }, cursor);
      blocks.push({
        type: "hotel",
        role: "return",
        zone: sleepZone,
        timeMin: cursor,
        title: `Back to the ${sleepZone} hotel`,
        detail: "You are already checked in, or the bags are waiting at the desk.",
      });
    }
  } else if (kind === "departure") {
    const flight = clockMinutes(trip.departure);
    const hotel = centroid(wakeZone);
    blocks.push({
      type: "hotel",
      role: "checkout",
      zone: wakeZone,
      timeMin: 11 * 60,
      title: `Check out of ${wakeZone}`,
      detail: "Checkout is usually 11:00. Ask them to keep the suitcases until you leave for Haneda.",
    });
    const preview = estimateOptions(hotel, HANEDA, 11 * 60, date);
    const ride = chosenOption(preview, trip.legChoices[`${date}:airport`]).minutes;
    const leave = Math.max(11 * 60 + 20, flight - 180 - ride);
    const cursor = pushTravel({ ...hotel, name: `${wakeZone} hotel` }, HANEDA, leave);
    blocks.push({
      type: "airport",
      role: "depart",
      timeMin: flight - 180,
      title: "Be at Haneda",
      detail: `International departure at ${formatClock(flight)}. Aim to be in the terminal three hours earlier. This ride leaves the hotel at ${formatClock(leave)} and arrives around ${formatClock(cursor)}.`,
    });
    if (cursor > flight - 150) {
      warnings.push("The ride to Haneda is tight for an international flight. Leave the hotel earlier than this sketch.");
    }
  } else if (kind === "open") {
    blocks.push({
      type: "hotel",
      role: "base",
      zone: sleepZone,
      timeMin: 9 * 60 + 30,
      title: `Open day, based in ${sleepZone}`,
      detail: "Nothing is scheduled. Add a wish and the day will fill in around the hotel.",
    });
  } else {
    const start = trip.pace === "full" ? 8 * 60 + 30 : trip.pace === "relaxed" ? 9 * 60 + 45 : 9 * 60 + 15;
    let cursor = start;
    let prev = centroid(wakeZone);
    const ordered = orderFrom(wishes, prev);
    ordered.forEach((wish) => {
      const dest: LatLng = { lat: wish.lat, lng: wish.lng, name: wish.name };
      cursor = pushTravel({ ...prev, name: prev.name }, dest, cursor);
      blocks.push(placeBlock(wish, cursor));
      cursor += wish.durationMin;
      prev = dest;
    });
    const home = centroid(sleepZone);
    if (haversine(prev, home) > 0.45) {
      cursor = pushTravel(prev, { ...home, name: `${sleepZone} hotel` }, cursor);
      reachMin = cursor;
      blocks.push({
        type: "hotel",
        role: "return",
        zone: sleepZone,
        timeMin: cursor,
        title: wakeZone === sleepZone ? `Back to the ${sleepZone} hotel` : `Check in, ${sleepZone}`,
        detail:
          wakeZone === sleepZone
            ? "The suitcases are already in the room."
            : "Drop the bags here. Before 3:00 pm the desk stores them; after 3:00 pm the room is yours at no extra charge.",
      });
    }
  }

  const picked = findPicked(trip, date, sleepZone, zone);
  const luggage = luggageFor({
    kind,
    zone,
    wakeZone,
    sleepZone,
    reachMin,
    picked,
    flightLabel: kind === "departure" ? formatClock(clockMinutes(trip.departure)) : null,
  });

  const alternateZone = luggage.alternateZone;
  const title =
    kind === "arrival"
      ? `Haneda to ${sleepZone}`
      : kind === "departure"
        ? "Back to Haneda"
        : kind === "open"
          ? "Open day"
          : kind === "day-trip"
            ? `${zone} day trip`
            : zone;

  return {
    date,
    label: formatDay(date),
    holiday,
    title,
    kind,
    zone,
    wakeZone,
    sleepZone,
    blocks,
    hotelOptions: dedupeHotels([...(trip.extraHotels[date] ?? []), ...hotelsFor(sleepZone)]),
    alternateHotels: alternateZone ? hotelsFor(alternateZone) : [],
    luggage,
    warnings,
  };
}

function addPlaces(
  blocks: Block[],
  wishes: Wish[],
  start: LatLng,
  cursor: number,
  nextLeg: () => number,
  date: string,
  choices: Trip["legChoices"],
): number {
  let prev = start;
  for (const wish of orderFrom(wishes, start)) {
    const dest: LatLng = { lat: wish.lat, lng: wish.lng, name: wish.name };
    if (haversine(prev, dest) >= 0.12) {
      const block = travelBlock(date, { ...prev, name: prev.name }, dest, cursor, nextLeg());
      blocks.push(block);
      cursor += chosenMinutes(block, choices);
    }
    blocks.push(placeBlock(wish, cursor));
    cursor += wish.durationMin;
    prev = dest;
  }
  return cursor;
}

function findPicked(trip: Trip, date: string, sleepZone: string, zone: string): HotelOption | null {
  const id = trip.hotelPicks[date];
  if (!id) return null;
  const pool = [
    ...(trip.extraHotels[date] ?? []),
    ...hotelsFor(sleepZone),
    ...hotelsFor(zone),
    ...Object.values(trip.extraHotels).flat(),
  ];
  return pool.find((hotel) => hotel.id === id) ?? null;
}

function formatClock(mins: number): string {
  const wrapped = ((Math.round(mins) % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${suffix}`;
}

export function hydrateDay(day: DayPlan, trip: Trip, routes: Record<string, RouteOption[]>): DayPlan {
  let cursor: number | null = null;
  const blocks: Block[] = day.blocks.map((block) => {
    if (block.type === "airport" && block.role === "arrive") {
      cursor = block.timeMin + 40;
      return block;
    }
    if (block.type === "hotel" && block.role === "checkout") {
      cursor = block.timeMin;
      return block;
    }
    if (block.type === "travel") {
      const options = routes[block.id] ?? block.options;
      const departMin = cursor ?? block.departMin;
      const minutes = chosenOption(options, trip.legChoices[block.id]).minutes;
      cursor = departMin + minutes;
      return { ...block, options, departMin };
    }
    if (block.type === "place") {
      const startMin = cursor ?? block.startMin;
      cursor = startMin + block.durationMin;
      return { ...block, startMin, endMin: cursor };
    }
    if (block.type === "hotel") {
      const timeMin = cursor ?? block.timeMin;
      if (block.role === "drop" || block.role === "checkin") cursor = timeMin + 25;
      else cursor = timeMin;
      const open = timeMin >= 15 * 60;
      if (block.role === "drop" || block.role === "checkin") {
        return {
          ...block,
          timeMin,
          role: open ? "checkin" : "drop",
          title: open ? `Check in, ${block.zone}` : `Drop bags in ${block.zone}`,
        };
      }
      return { ...block, timeMin };
    }
    return block;
  });

  const hotel = blocks.find(
    (block) => block.type === "hotel" && (block.role === "checkin" || block.role === "drop"),
  );
  const picked = findPicked(trip, day.date, day.sleepZone, day.zone);
  const luggage = luggageFor({
    kind: day.kind,
    zone: day.zone,
    wakeZone: day.wakeZone,
    sleepZone: day.sleepZone,
    reachMin: hotel && hotel.type === "hotel" ? hotel.timeMin : null,
    picked,
    flightLabel: day.kind === "departure" ? formatClock(clockMinutes(trip.departure)) : null,
  });

  return {
    ...day,
    blocks,
    luggage,
    alternateHotels: luggage.alternateZone ? hotelsFor(luggage.alternateZone) : [],
  };
}

export function dayCost(day: DayPlan, choices: Trip["legChoices"]): number {
  return day.blocks.reduce((sum, block) => {
    if (block.type !== "travel") return sum;
    const cost = chosenOption(block.options, choices[block.id]).costYen;
    return sum + (cost ?? 0);
  }, 0);
}

export function chosenFor(block: TravelBlock, choices: Trip["legChoices"]): RouteOption {
  return chosenOption(block.options, choices[block.id]);
}
