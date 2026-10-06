import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeTrips } from "./merge";
import { buildPlan } from "./plan";
import { starterTrip } from "./starter";
import { reservationFor } from "./trains";

describe("Haneda week plan", () => {
  const plan = buildPlan(starterTrip());

  it("covers November 3 through November 9", () => {
    assert.equal(plan.days.length, 7);
    assert.equal(plan.days[0].date, "2026-11-03");
    assert.equal(plan.days[6].date, "2026-11-09");
  });

  it("checks into Asakusa on arrival day", () => {
    const arrival = plan.days[0];
    assert.equal(arrival.kind, "arrival");
    assert.equal(arrival.sleepZone, "Asakusa");
    assert.equal(arrival.luggage.bookHotel, true);
    assert.match(arrival.luggage.headline, /room/i);
    assert.match(arrival.holiday ?? "", /Culture Day/);
    const ride = arrival.blocks.find((block) => block.type === "travel");
    assert.ok(ride && ride.type === "travel");
    assert.match(ride.options.find((option) => option.mode === "transit")?.summary ?? "", /Keikyu/);
  });

  it("keeps Kamakura as a day trip and the bags in Tokyo", () => {
    const day = plan.days.find((item) => item.zone === "Kamakura");
    assert.ok(day);
    assert.equal(day.kind, "day-trip");
    assert.equal(day.date, "2026-11-07");
    assert.equal(day.sleepZone, "Asakusa");
    assert.match(day.luggage.headline, /suitcases/i);
    assert.match(day.holiday ?? "", /Weekend/);
  });

  it("places every starter wish", () => {
    const placed = new Set(
      plan.days.flatMap((day) => day.blocks.filter((block) => block.type === "place").map((block) => block.wishId)),
    );
    for (const wish of starterTrip().wishes) {
      assert.ok(placed.has(wish.id), wish.name);
    }
    assert.equal(plan.unscheduled.length, 0);
  });

  it("flags teamLab tickets", () => {
    const stop = plan.days.flatMap((day) => day.blocks).find((block) => block.type === "place" && /teamLab/.test(block.name));
    assert.ok(stop && stop.type === "place" && stop.reserve);
  });
});

describe("reservations", () => {
  it("asks for shinkansen seats on a holiday", () => {
    const note = reservationFor("Tokaido Shinkansen Hikari", "2026-11-03");
    assert.ok(note);
    assert.match(note.where, /SmartEX/);
    assert.match(note.when, /holiday/);
  });

  it("does not reserve the Yamanote", () => {
    assert.equal(reservationFor("JR Yamanote Line", "2026-11-04"), null);
  });
});

describe("merge", () => {
  it("keeps wishes added on either side and honors a deletion", () => {
    const base = starterTrip();
    const local = {
      ...base,
      wishes: base.wishes.filter((wish) => wish.id !== "yanaka"),
      deletedWishIds: [{ id: "yanaka", at: "2026-10-07T00:00:00.000Z" }],
      frameUpdatedAt: "2026-10-07T00:00:00.000Z",
    };
    const remoteWish = { ...base.wishes[0], id: "extra", name: "Extra stop", updatedAt: "2026-10-07T01:00:00.000Z" };
    const remote = {
      ...base,
      wishes: [...base.wishes, remoteWish],
      frameUpdatedAt: "2026-10-06T00:00:00.000Z",
    };
    const merged = mergeTrips(local, remote);
    assert.equal(merged.wishes.some((wish) => wish.id === "yanaka"), false);
    assert.equal(merged.wishes.some((wish) => wish.id === "extra"), true);
  });
});
