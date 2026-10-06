"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DayBoard } from "@/components/day-board";
import { Itinerary } from "@/components/itinerary";
import { SyncSheet } from "@/components/sync-sheet";
import { useSharedTrip } from "@/components/use-shared-trip";
import { WishBoard } from "@/components/wish-board";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { centroid } from "@/lib/geo";
import { formatCode, formatRange } from "@/lib/format";
import { nearbyHotels } from "@/lib/places";
import { buildPlan, hydrateDay } from "@/lib/plan";

type View = "wishes" | "days" | "itinerary";

export function Planner() {
  const model = useSharedTrip();
  const [view, setView] = useState<View>("days");
  const [dayIndex, setDayIndex] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const trip = model.trip;

  const plan = useMemo(() => (trip ? buildPlan(trip) : null), [trip]);
  const liveDays = useMemo(() => {
    if (!trip || !plan) return [];
    return plan.days.map((day) => hydrateDay(day, trip, {}));
  }, [plan, trip]);

  if (!trip || !plan) {
    return (
      <main className="grid min-h-screen place-items-center">
        <p className="font-serif text-2xl">Opening the week…</p>
      </main>
    );
  }

  async function searchHotels(day: (typeof liveDays)[number]) {
    const pin = centroid(day.sleepZone);
    setSearching(true);
    try {
      const hotels = await nearbyHotels(pin.lat, pin.lng, day.sleepZone);
      model.saveHotels(day.date, hotels);
      toast.success(`Found ${hotels.length} hotels near ${day.sleepZone}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hotel search failed.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 pb-24">
      <Toaster />
      <header className="no-print sticky top-0 z-20 -mx-4 mb-6 border-b bg-background/85 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">{formatRange(trip.arrival, trip.departure)}</p>
            <h1 className="font-serif text-3xl leading-none">Haneda Week</h1>
          </div>
          <nav className="flex rounded-full border bg-card p-1">
            {(
              [
                ["wishes", "Wishes"],
                ["days", "Days"],
                ["itinerary", "Itinerary"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={`rounded-full px-3 py-1.5 text-sm ${view === id ? "bg-foreground text-background" : ""}`}
              >
                {label}
              </button>
            ))}
          </nav>
          <Button type="button" variant="outline" onClick={() => setShareOpen(true)}>
            {formatCode(trip.code)}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="hidden sm:inline-flex"
            onClick={() => {
              setView("itinerary");
              window.setTimeout(() => window.print(), 60);
            }}
          >
            Print
          </Button>
        </div>
      </header>

      {!trip.code && (
        <button type="button" onClick={() => setShareOpen(true)} className="mb-6 block w-full rounded-2xl border border-dashed px-4 py-3 text-left text-sm">
          This plan is only in this browser. Create a share code so you can both edit it.
        </button>
      )}
      {plan.unscheduled.length > 0 && (
        <p className="mb-6 rounded-2xl bg-secondary px-4 py-3 text-sm">
          Could not fit: {plan.unscheduled.map((wish) => wish.name).join(", ")}. Drop something or lengthen a day.
        </p>
      )}

      {view === "wishes" && (
        <WishBoard trip={trip} onFrame={model.setFrame} onAdd={model.addWish} onEdit={model.editWish} onRemove={model.removeWish} />
      )}
      {view === "days" && (
        <DayBoard
          days={liveDays}
          index={dayIndex}
          onIndex={setDayIndex}
          trip={trip}
          onMode={model.chooseMode}
          onHotel={model.pickHotel}
          onSearchHotels={(day) => void searchHotels(day)}
          searching={searching}
        />
      )}
      {view === "itinerary" && <Itinerary days={liveDays} trip={trip} />}

      <SyncSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        code={trip.code}
        status={model.status}
        error={model.error}
        settings={model.settings}
        onSettings={model.updateSettings}
        onCreate={model.createShare}
        onJoin={model.join}
      />
    </main>
  );
}
