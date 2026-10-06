"use client";

import { minutesToLabel, yen } from "@/lib/format";
import { chosenFor, dayCost } from "@/lib/plan";
import type { DayPlan, Trip } from "@/lib/types";
import { TripMap } from "@/components/trip-map";

export function Itinerary({ days, trip }: { days: DayPlan[]; trip: Trip }) {
  const total = days.reduce((sum, day) => sum + dayCost(day, trip.legChoices), 0);
  const reservations = days.flatMap((day) =>
    day.blocks.flatMap((block) => {
      if (block.type === "travel") {
        const chosen = chosenFor(block, trip.legChoices);
        if (!chosen.reserve) return [];
        return [{ when: day.label, what: chosen.summary, where: chosen.reserve.where, note: chosen.reserve.when }];
      }
      if (block.type === "place" && block.reserve) {
        return [{ when: day.label, what: block.name, where: block.reserve.where, note: block.reserve.note }];
      }
      return [];
    }),
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-8">
        <header>
          <p className="text-sm text-muted-foreground">Two of you · in and out of Haneda · transit about {yen(total * 2)}</p>
          <h2 className="font-serif text-4xl sm:text-5xl">The week, in order</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Local trains do not need a seat. Shinkansen and limited expresses do. A Suica covers the city. A national JR Pass usually does not pay for itself on a Tokyo week unless a long shinkansen sneaks in.
          </p>
        </header>

        {reservations.length > 0 && (
          <section className="rounded-3xl border bg-card p-5">
            <h3 className="font-serif text-2xl">Reserve ahead</h3>
            <ul className="mt-3 space-y-3">
              {reservations.map((item) => (
                <li key={`${item.when}-${item.what}`}>
                  <p className="font-medium">
                    {item.when} · {item.what}
                  </p>
                  <p className="text-sm text-muted-foreground">{item.where}</p>
                  <p className="text-sm text-muted-foreground">{item.note}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {days.map((day) => (
          <section key={day.date} className="border-t pt-6">
            <p className="text-sm text-muted-foreground">{day.label}</p>
            <h3 className="font-serif text-3xl">{day.title}</h3>
            <p className="mt-2 text-sm">{day.luggage.headline}</p>
            <ol className="mt-4 space-y-2">
              {day.blocks.map((block, index) => {
                if (block.type === "travel") {
                  const chosen = chosenFor(block, trip.legChoices);
                  return (
                    <li key={block.id} className="text-sm text-muted-foreground">
                      {minutesToLabel(block.departMin)} · {chosen.summary} · {chosen.minutes} min · {yen(chosen.costYen)} each
                      {chosen.reserve ? " · reserve a seat" : ""}
                    </li>
                  );
                }
                if (block.type === "place") {
                  return (
                    <li key={block.wishId} className="text-sm">
                      {minutesToLabel(block.startMin)} · {block.name}
                      {block.note ? ` — ${block.note}` : ""}
                    </li>
                  );
                }
                return (
                  <li key={`${day.date}-${index}`} className="text-sm">
                    {minutesToLabel(block.timeMin)} · {block.title}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
      <div className="no-print lg:sticky lg:top-24 lg:self-start">
        <div className="h-[70vh] overflow-hidden rounded-3xl border bg-card">
          <TripMap days={days} className="h-full w-full" />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Map tiles from OpenStreetMap. Fares are typical adult one-way prices, shown in dollars at about ¥150 to the dollar, then yen. Train times are typical routes, including when a seat should be reserved.
        </p>
      </div>
    </div>
  );
}
