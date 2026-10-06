"use client";

import { Button } from "@/components/ui/button";
import { minutesToLabel, yen } from "@/lib/format";
import { chosenFor, dayCost } from "@/lib/plan";
import type { DayPlan, HotelOption, TravelMode, Trip } from "@/lib/types";
import { TripMap } from "@/components/trip-map";

const MODES: { id: TravelMode; label: string }[] = [
  { id: "walk", label: "Walk" },
  { id: "transit", label: "Train" },
  { id: "taxi", label: "Taxi" },
];

export function DayBoard({
  days,
  index,
  onIndex,
  trip,
  onMode,
  onHotel,
  onSearchHotels,
  searching,
}: {
  days: DayPlan[];
  index: number;
  onIndex: (index: number) => void;
  trip: Trip;
  onMode: (legId: string, mode: TravelMode) => void;
  onHotel: (date: string, hotelId: string) => void;
  onSearchHotels: (day: DayPlan) => void;
  searching: boolean;
}) {
  const day = days[index] ?? days[0];
  if (!day) return null;
  const cost = dayCost(day, trip.legChoices);

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
        {days.map((item, itemIndex) => (
          <button
            key={item.date}
            type="button"
            onClick={() => onIndex(itemIndex)}
            className={`min-w-40 rounded-2xl border px-3 py-3 text-left lg:min-w-0 ${itemIndex === index ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}
          >
            <span className="block text-xs tracking-wide uppercase opacity-80">{item.label}</span>
            <span className="mt-1 block font-serif text-lg leading-tight">{item.title}</span>
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <div className="overflow-hidden rounded-3xl border bg-card">
          <div className="h-64">
            <TripMap days={[day]} className="h-full w-full" />
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{day.label}</p>
            <h2 className="font-serif text-4xl">{day.title}</h2>
          </div>
          <p className="text-sm text-muted-foreground">Transit for two, about {yen(cost * 2)}</p>
        </div>
        {day.holiday && <p className="rounded-2xl bg-secondary px-4 py-3 text-sm">{day.holiday}</p>}
        {day.warnings.map((warning) => (
          <p key={warning} className="rounded-2xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
            {warning}
          </p>
        ))}

        <article className="rounded-3xl border border-primary/30 bg-[#f8efe6] p-5">
          <p className="text-xs tracking-[0.16em] text-primary uppercase">Luggage</p>
          <h3 className="mt-1 font-serif text-2xl">{day.luggage.headline}</h3>
          <p className="mt-2 text-sm leading-6">{day.luggage.detail}</p>
          <p className="mt-3 text-sm text-muted-foreground">{day.luggage.bookReason}</p>
          {day.luggage.alternateNote && <p className="mt-2 text-sm">{day.luggage.alternateNote}</p>}
        </article>

        <ol className="space-y-3">
          {day.blocks.map((block) => {
            if (block.type === "travel") {
              const chosen = chosenFor(block, trip.legChoices);
              return (
                <li key={block.id} className="rounded-3xl border bg-card p-4">
                  <p className="text-xs tracking-wide text-muted-foreground uppercase">
                    {minutesToLabel(block.departMin)} · {block.fromName} to {block.toName}
                  </p>
                  <p className="mt-1 font-medium">{chosen.summary}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{chosen.detail}</p>
                  <p className="mt-2 text-sm">
                    {chosen.minutes} min · {yen(chosen.costYen)}
                    {chosen.source === "estimate" ? " · estimated" : " · Google"}
                  </p>
                  {chosen.reserve && (
                    <div className="mt-3 rounded-2xl bg-secondary px-3 py-2 text-sm">
                      <p className="font-medium">Reserve this seat</p>
                      <p className="mt-1">{chosen.reserve.where}</p>
                      <p className="mt-1 text-muted-foreground">{chosen.reserve.when}</p>
                      <p className="mt-1 text-muted-foreground">{chosen.reserve.note}</p>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {MODES.filter((mode) => block.options.some((option) => option.mode === mode.id)).map((mode) => (
                      <Button key={mode.id} type="button" size="sm" variant={chosen.mode === mode.id ? "default" : "outline"} onClick={() => onMode(block.id, mode.id)}>
                        {mode.label}
                        <span className="text-xs opacity-80">{block.options.find((option) => option.mode === mode.id)?.minutes}m</span>
                      </Button>
                    ))}
                  </div>
                </li>
              );
            }
            if (block.type === "place") {
              return (
                <li key={block.wishId} className="rounded-3xl border bg-card p-4">
                  <p className="text-xs tracking-wide text-muted-foreground uppercase">
                    {minutesToLabel(block.startMin)} – {minutesToLabel(block.endMin)}
                  </p>
                  <h3 className="font-serif text-2xl">{block.name}</h3>
                  {block.note && <p className="mt-1 text-sm">{block.note}</p>}
                  {block.hint && <p className="mt-1 text-sm text-muted-foreground">{block.hint}</p>}
                  {block.reserve && (
                    <p className="mt-2 text-sm">
                      Book ahead at {block.reserve.where}. {block.reserve.note}
                    </p>
                  )}
                  <a className="mt-2 inline-block text-sm underline" href={`https://www.google.com/maps/search/?api=1&query=${block.lat},${block.lng}`} target="_blank" rel="noreferrer">
                    Open in Google Maps
                  </a>
                </li>
              );
            }
            return (
              <li key={`${block.type}-${block.type === "hotel" ? block.role : block.role}-${block.timeMin}`} className="rounded-3xl bg-foreground px-4 py-4 text-background">
                <p className="text-xs tracking-wide uppercase opacity-70">{minutesToLabel(block.timeMin)}</p>
                <h3 className="font-serif text-2xl">{block.title}</h3>
                <p className="mt-1 text-sm opacity-80">{block.detail}</p>
              </li>
            );
          })}
        </ol>

        {day.kind !== "departure" && (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-serif text-2xl">Sleep in {day.sleepZone}</h3>
              <Button type="button" variant="outline" size="sm" disabled={searching} onClick={() => onSearchHotels(day)}>
                {searching ? "Looking" : "Find hotels nearby"}
              </Button>
            </div>
            <HotelList hotels={day.hotelOptions} picked={trip.hotelPicks[day.date]} onPick={(id) => onHotel(day.date, id)} />
            {day.alternateHotels.length > 0 && (
              <>
                <h4 className="pt-2 font-serif text-xl">If you would rather sleep in {day.luggage.alternateZone}</h4>
                <HotelList hotels={day.alternateHotels} picked={trip.hotelPicks[day.date]} onPick={(id) => onHotel(day.date, id)} />
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function HotelList({ hotels, picked, onPick }: { hotels: HotelOption[]; picked?: string; onPick: (id: string) => void }) {
  if (!hotels.length) return <p className="text-sm text-muted-foreground">No hotel list for this area yet.</p>;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {hotels.map((hotel) => (
        <button
          key={hotel.id}
          type="button"
          onClick={() => onPick(hotel.id)}
          className={`rounded-2xl border p-4 text-left ${picked === hotel.id ? "border-primary bg-[#f8efe6]" : "bg-card"}`}
        >
          <p className="font-medium">{hotel.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">{hotel.blurb}</p>
          <p className="mt-2 text-xs tracking-wide text-muted-foreground uppercase">
            {hotel.priceBand}
            {hotel.rating ? ` · ${hotel.rating.toFixed(1)}` : ""} · {hotel.station}
          </p>
          <a className="mt-2 inline-block text-sm underline" href={hotel.mapsUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
            Map
          </a>
        </button>
      ))}
    </div>
  );
}
