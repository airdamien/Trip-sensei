"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mergeTrips } from "@/lib/merge";
import { ensureStarterWishes, starterTrip } from "@/lib/starter";
import {
  EMPTY_SETTINGS,
  fetchRemote,
  loadSettings,
  loadTrip,
  pushTrip,
  saveSettings,
  saveTrip,
  type SyncSettings,
} from "@/lib/sync";
import { makeCode, normalizeCode } from "@/lib/format";
import type { HotelOption, Interest, Pace, TravelMode, Trip, Wish } from "@/lib/types";

export type SyncStatus = "loading" | "local" | "saving" | "saved" | "watching" | "error";

function stamp(trip: Trip, frame = false): Trip {
  const now = new Date().toISOString();
  return {
    ...trip,
    updatedAt: now,
    frameUpdatedAt: frame ? now : trip.frameUpdatedAt,
    revision: trip.revision + 1,
  };
}

function writeCode(code: string) {
  const url = new URL(window.location.href);
  if (code) url.searchParams.set("trip", code);
  else url.searchParams.delete("trip");
  window.history.replaceState(null, "", url);
}

export function useSharedTrip() {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [settings, setSettings] = useState<SyncSettings>(EMPTY_SETTINGS);
  const [sha, setSha] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const dirty = useRef(false);
  const shaRef = useRef<string | null>(null);
  const tripRef = useRef<Trip | null>(null);
  const settingsRef = useRef(settings);
  const saving = useRef(false);

  useEffect(() => {
    tripRef.current = trip;
  }, [trip]);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    shaRef.current = sha;
  }, [sha]);

  const adopt = useCallback((next: Trip, nextSha: string | null, markDirty: boolean) => {
    const grown = ensureStarterWishes(next);
    dirty.current = markDirty || grown.wishes.length !== next.wishes.length;
    setTrip(grown);
    setSha(nextSha);
    saveTrip(grown);
    if (grown.code) writeCode(grown.code);
  }, []);

  const persistRemote = useCallback(async (next: Trip, baseSha: string | null) => {
    const current = settingsRef.current;
    if (!next.code || !current.token) {
      setStatus("local");
      return;
    }
    saving.current = true;
    setStatus("saving");
    setError(null);
    try {
      const newSha = await pushTrip(current, next, baseSha);
      shaRef.current = newSha;
      setSha(newSha);
      dirty.current = false;
      setStatus("saved");
    } catch (err) {
      if (err instanceof Error && err.name === "ConflictError") {
        const remote = await fetchRemote(current, next.code);
        if (remote) {
          const merged = mergeTrips(next, remote.trip);
          saveTrip(merged);
          setTrip(merged);
          tripRef.current = merged;
          const newSha = await pushTrip(current, merged, remote.sha);
          shaRef.current = newSha;
          setSha(newSha);
          dirty.current = false;
          setStatus("saved");
          setError("Both of you edited. Wishes from each side were kept.");
          return;
        }
      }
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not save the shared plan.");
      throw err;
    } finally {
      saving.current = false;
    }
  }, []);

  useEffect(() => {
    const storedSettings = loadSettings();
    setSettings(storedSettings);
    settingsRef.current = storedSettings;
    const params = new URLSearchParams(window.location.search);
    const code = normalizeCode(params.get("trip") ?? "");
    const stored = loadTrip();
    let initial = ensureStarterWishes(stored ?? starterTrip());
    if (stored && initial.wishes.length !== stored.wishes.length) dirty.current = true;
    if (code && initial.code && initial.code !== code) initial = { ...starterTrip(), code };
    else if (code && !initial.code) initial = { ...initial, code };
    setTrip(initial);
    saveTrip(initial);
    setStatus(initial.code ? "watching" : "local");

    if (!initial.code || !storedSettings.owner || !storedSettings.repo) return;
    fetchRemote(storedSettings, initial.code)
      .then((remote) => {
        if (!remote) {
          if (storedSettings.token) dirty.current = true;
          return;
        }
        const localNewer = initial.updatedAt > remote.trip.updatedAt;
        if (localNewer && storedSettings.token) {
          dirty.current = true;
          setSha(remote.sha);
          return;
        }
        adopt(remote.trip, remote.sha, false);
        setStatus(storedSettings.token ? "saved" : "watching");
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not open the shared plan.");
      });
  }, [adopt]);

  useEffect(() => {
    if (!trip?.code || !settings.token || !dirty.current) return;
    const handle = window.setTimeout(() => {
      const current = tripRef.current;
      if (!current || !dirty.current || saving.current) return;
      void persistRemote(current, shaRef.current);
    }, 1400);
    return () => window.clearTimeout(handle);
  }, [trip, settings.token, persistRemote]);

  useEffect(() => {
    if (!trip?.code || !settings.owner || !settings.repo) return;
    const pull = async () => {
      if (saving.current || document.hidden) return;
      try {
        const remote = await fetchRemote(settingsRef.current, trip.code);
        if (!remote) return;
        const current = tripRef.current;
        if (!current) return;
        if (remote.trip.updatedAt === current.updatedAt) {
          if (remote.sha) setSha(remote.sha);
          return;
        }
        if (!dirty.current) {
          adopt(remote.trip, remote.sha, false);
          setStatus(settingsRef.current.token ? "saved" : "watching");
          return;
        }
        const merged = mergeTrips(current, remote.trip);
        dirty.current = true;
        setSha(remote.sha);
        setTrip(merged);
        saveTrip(merged);
        setError("A newer plan came in from the other browser. Both sets of wishes were kept.");
      } catch {
        // Polling should not block editing when GitHub is briefly unreachable.
      }
    };
    const handle = window.setInterval(pull, 20000);
    window.addEventListener("focus", pull);
    return () => {
      window.clearInterval(handle);
      window.removeEventListener("focus", pull);
    };
  }, [trip?.code, settings.owner, settings.repo, adopt]);

  const update = useCallback((recipe: (current: Trip) => Trip, frame = false) => {
    setTrip((current) => {
      if (!current) return current;
      const next = stamp(recipe(current), frame);
      dirty.current = true;
      saveTrip(next);
      setStatus(next.code && settingsRef.current.token ? "saving" : "local");
      return next;
    });
  }, []);

  const setFrame = useCallback(
    (patch: Partial<Pick<Trip, "title" | "arrival" | "departure" | "pace">> & { interests?: Interest[] }) => {
      update((current) => ({ ...current, ...patch }), true);
    },
    [update],
  );

  const addWish = useCallback(
    (wish: Wish) => {
      update((current) => {
        if (current.wishes.some((item) => item.id === wish.id)) return current;
        return {
          ...current,
          wishes: [...current.wishes, wish],
          deletedWishIds: current.deletedWishIds.filter((item) => item.id !== wish.id),
        };
      });
    },
    [update],
  );

  const editWish = useCallback(
    (id: string, patch: Partial<Wish>) => {
      const now = new Date().toISOString();
      update((current) => ({
        ...current,
        wishes: current.wishes.map((wish) => (wish.id === id ? { ...wish, ...patch, updatedAt: now } : wish)),
      }));
    },
    [update],
  );

  const removeWish = useCallback(
    (id: string) => {
      const now = new Date().toISOString();
      update((current) => ({
        ...current,
        wishes: current.wishes.filter((wish) => wish.id !== id),
        deletedWishIds: [...current.deletedWishIds.filter((item) => item.id !== id), { id, at: now }],
      }));
    },
    [update],
  );

  const pickHotel = useCallback(
    (date: string, hotelId: string) => {
      update((current) => ({ ...current, hotelPicks: { ...current.hotelPicks, [date]: hotelId } }), true);
    },
    [update],
  );

  const chooseMode = useCallback(
    (legId: string, mode: TravelMode) => {
      update((current) => ({ ...current, legChoices: { ...current.legChoices, [legId]: mode } }), true);
    },
    [update],
  );

  const saveHotels = useCallback(
    (date: string, hotels: HotelOption[]) => {
      update((current) => ({ ...current, extraHotels: { ...current.extraHotels, [date]: hotels } }), true);
    },
    [update],
  );

  const updateSettings = useCallback((patch: Partial<SyncSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      saveSettings(next);
      settingsRef.current = next;
      return next;
    });
  }, []);

  const createShare = useCallback(async () => {
    const current = tripRef.current;
    if (!current) return;
    const code = current.code || makeCode();
    const next = stamp({ ...current, code }, true);
    dirty.current = false;
    setTrip(next);
    saveTrip(next);
    writeCode(code);
    await persistRemote(next, null);
  }, [persistRemote]);

  const join = useCallback(
    async (raw: string) => {
      const code = normalizeCode(raw);
      if (code.length < 6) throw new Error("Enter the six-character code.");
      const remote = await fetchRemote(settingsRef.current, code);
      if (!remote) throw new Error("No plan is saved under that code yet.");
      adopt(remote.trip, remote.sha, false);
      setStatus(settingsRef.current.token ? "saved" : "watching");
      setError(null);
    },
    [adopt],
  );

  return {
    trip,
    settings,
    status,
    error,
    setFrame,
    addWish,
    editWish,
    removeWish,
    pickHotel,
    chooseMode,
    saveHotels,
    updateSettings,
    createShare,
    join,
    setPace: (pace: Pace) => setFrame({ pace }),
  };
}
