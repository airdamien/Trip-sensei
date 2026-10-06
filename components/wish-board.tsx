"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CATALOG, suggestionsFor, wishFromCatalog, type CatalogItem } from "@/lib/catalog";
import { searchPlaces, type PlaceHit } from "@/lib/places";
import { INTERESTS } from "@/lib/types";
import type { Interest, Pace, Priority, Trip, Wish } from "@/lib/types";

const PRIORITIES: { id: Priority; label: string }[] = [
  { id: "must", label: "Must" },
  { id: "want", label: "Want" },
  { id: "if-time", label: "If time" },
];

export function WishBoard({
  trip,
  onFrame,
  onAdd,
  onEdit,
  onRemove,
}: {
  trip: Trip;
  onFrame: (patch: Partial<Pick<Trip, "arrival" | "departure" | "pace" | "title">> & { interests?: Interest[] }) => void;
  onAdd: (wish: Wish) => void;
  onEdit: (id: string, patch: Partial<Wish>) => void;
  onRemove: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [searching, setSearching] = useState(false);
  const suggestions = suggestionsFor(trip.interests, trip.wishes);
  const catalogHits = query.trim()
    ? CATALOG.filter(
        (item) =>
          !trip.wishes.some((wish) => wish.id === item.id) &&
          item.name.toLowerCase().includes(query.trim().toLowerCase()),
      ).slice(0, 5)
    : [];

  async function lookup() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      setHits(await searchPlaces(query.trim()));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }

  function addHit(place: PlaceHit) {
    onAdd({
      id: place.id,
      name: place.name,
      note: "",
      hint: place.detail,
      lat: place.lat,
      lng: place.lng,
      zone: place.zone,
      region: place.region,
      durationMin: 75,
      priority: "want",
      tags: ["neighborhoods"],
      reserve: null,
      source: "search",
      updatedAt: new Date().toISOString(),
    });
    setHits([]);
    setQuery("");
  }

  function toggleInterest(id: Interest) {
    const interests = trip.interests.includes(id) ? trip.interests.filter((item) => item !== id) : [...trip.interests, id];
    onFrame({ interests });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <section className="rounded-3xl border bg-card/80 p-5 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="text-muted-foreground">Land at Haneda</span>
              <Input type="datetime-local" value={trip.arrival} onChange={(event) => onFrame({ arrival: event.target.value })} />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-muted-foreground">Fly out of Haneda</span>
              <Input type="datetime-local" value={trip.departure} onChange={(event) => onFrame({ departure: event.target.value })} />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(["relaxed", "moderate", "full"] as Pace[]).map((pace) => (
              <Button key={pace} type="button" size="sm" variant={trip.pace === pace ? "default" : "outline"} onClick={() => onFrame({ pace })}>
                {pace === "relaxed" ? "Unhurried" : pace === "moderate" ? "Steady" : "Full days"}
              </Button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {INTERESTS.map((interest) => (
              <button
                key={interest.id}
                type="button"
                onClick={() => toggleInterest(interest.id)}
                className={`rounded-full border px-3 py-1 text-sm ${trip.interests.includes(interest.id) ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}
              >
                {interest.label}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border bg-card/80 p-5 shadow-sm">
          <div className="flex gap-2">
            <Input
              value={query}
              placeholder="Search a temple, market, neighborhood…"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void lookup();
              }}
            />
            <Button type="button" variant="secondary" onClick={() => void lookup()} disabled={searching}>
              {searching ? "Searching" : "Search"}
            </Button>
          </div>
          {catalogHits.length > 0 && (
            <div className="mt-3 space-y-2">
              {catalogHits.map((item) => (
                <Suggestion key={item.id} item={item} onAdd={() => onAdd(wishFromCatalog(item, new Date().toISOString()))} />
              ))}
            </div>
          )}
          {hits.length > 0 && (
            <div className="mt-3 space-y-2">
              {hits.map((hit) => (
                <button key={hit.id} type="button" className="block w-full rounded-2xl border px-3 py-2 text-left text-sm hover:bg-secondary" onClick={() => addHit(hit)}>
                  <span className="font-medium">{hit.name}</span>
                  <span className="mt-0.5 block text-muted-foreground">{hit.detail || hit.zone}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <ol className="space-y-3">
          {trip.wishes.map((wish) => (
            <li key={wish.id} className="rounded-3xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-serif text-xl">{wish.name}</p>
                  <p className="text-sm text-muted-foreground">{wish.zone}</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(wish.id)}>
                  Remove
                </Button>
              </div>
              {wish.hint && <p className="mt-2 text-sm text-muted-foreground">{wish.hint}</p>}
              <Textarea
                className="mt-3"
                placeholder="A note for the two of you"
                value={wish.note}
                onChange={(event) => onEdit(wish.id, { note: event.target.value })}
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {PRIORITIES.map((priority) => (
                  <Button key={priority.id} type="button" size="sm" variant={wish.priority === priority.id ? "default" : "outline"} onClick={() => onEdit(wish.id, { priority: priority.id })}>
                    {priority.label}
                  </Button>
                ))}
                <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
                  Minutes
                  <Input
                    className="w-20"
                    type="number"
                    min={20}
                    max={360}
                    value={wish.durationMin}
                    onChange={(event) => onEdit(wish.id, { durationMin: Number(event.target.value) || 60 })}
                  />
                </label>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
        <p className="font-serif text-2xl">Worth adding</p>
        <p className="text-sm text-muted-foreground">Picked from what you said you care about, and from what is not on the list yet.</p>
        {suggestions.map((item) => (
          <Suggestion key={item.id} item={item} onAdd={() => onAdd(wishFromCatalog(item, new Date().toISOString()))} />
        ))}
      </aside>
    </div>
  );
}

function Suggestion({ item, onAdd }: { item: CatalogItem; onAdd: () => void }) {
  return (
    <div className="rounded-2xl border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{item.name}</p>
          <p className="text-sm text-muted-foreground">{item.blurb}</p>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={onAdd}>
          Add
        </Button>
      </div>
    </div>
  );
}
