import type { Trip, Wish } from "@/lib/types";

function wishMap(wishes: Wish[]): Map<string, Wish> {
  return new Map(wishes.map((wish) => [wish.id, wish]));
}

export function mergeTrips(local: Trip, remote: Trip): Trip {
  const deleted = new Map<string, string>();
  for (const item of [...remote.deletedWishIds, ...local.deletedWishIds]) {
    const prev = deleted.get(item.id);
    if (!prev || item.at > prev) deleted.set(item.id, item.at);
  }

  const wishes = wishMap(remote.wishes);
  for (const wish of local.wishes) {
    const other = wishes.get(wish.id);
    if (!other || wish.updatedAt >= other.updatedAt) wishes.set(wish.id, wish);
  }

  const kept = [...wishes.values()].filter((wish) => {
    const at = deleted.get(wish.id);
    return !at || wish.updatedAt > at;
  });

  const localFrame = local.frameUpdatedAt >= remote.frameUpdatedAt;
  const primary = localFrame ? local : remote;
  const secondary = localFrame ? remote : local;

  return {
    ...primary,
    wishes: kept,
    deletedWishIds: [...deleted.entries()].map(([id, at]) => ({ id, at })),
    hotelPicks: { ...secondary.hotelPicks, ...primary.hotelPicks },
    legChoices: { ...secondary.legChoices, ...primary.legChoices },
    extraHotels: { ...secondary.extraHotels, ...primary.extraHotels },
    updatedAt: new Date().toISOString(),
    revision: Math.max(local.revision, remote.revision) + 1,
  };
}
