import type { Trip } from "@/lib/types";

export type SyncSettings = {
  owner: string;
  repo: string;
  branch: string;
  token: string;
  mapsKey: string;
};

export const EMPTY_SETTINGS: SyncSettings = {
  owner: process.env.NEXT_PUBLIC_GITHUB_OWNER ?? "",
  repo: process.env.NEXT_PUBLIC_GITHUB_REPO ?? "",
  branch: process.env.NEXT_PUBLIC_GITHUB_BRANCH ?? "main",
  token: "",
  mapsKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
};

const SETTINGS_KEY = "haneda-week-settings";
const TRIP_KEY = "haneda-week-trip";

export function loadSettings(): SyncSettings {
  if (typeof window === "undefined") return EMPTY_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...EMPTY_SETTINGS };
    return { ...EMPTY_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY_SETTINGS };
  }
}

export function saveSettings(settings: SyncSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadTrip(): Trip | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TRIP_KEY);
    return raw ? (JSON.parse(raw) as Trip) : null;
  } catch {
    return null;
  }
}

export function saveTrip(trip: Trip) {
  localStorage.setItem(TRIP_KEY, JSON.stringify(trip));
}

export function tripPath(code: string): string {
  return `data/trips/${code}.json`;
}

type Remote = { sha: string | null; trip: Trip };

function headers(token: string, json = false): HeadersInit {
  const base: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) base.Authorization = `Bearer ${token}`;
  if (json) base["Content-Type"] = "application/json";
  return base;
}

function encode(trip: Trip): string {
  const bytes = new TextEncoder().encode(JSON.stringify(trip, null, 2));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function decode(content: string): Trip {
  const clean = content.replace(/\n/g, "");
  const binary = atob(clean);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as Trip;
}

export async function fetchRemote(settings: SyncSettings, code: string): Promise<Remote | null> {
  if (!settings.owner || !settings.repo || !code) return null;
  const path = tripPath(code);
  if (settings.token) {
    const url = `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${path}?ref=${encodeURIComponent(settings.branch || "main")}`;
    const response = await fetch(url, { headers: headers(settings.token), cache: "no-store" });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(await errorText(response));
    const body = (await response.json()) as { sha: string; content: string };
    return { sha: body.sha, trip: decode(body.content) };
  }
  const raw = `https://raw.githubusercontent.com/${settings.owner}/${settings.repo}/${settings.branch || "main"}/${path}?t=${Date.now()}`;
  const response = await fetch(raw, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Could not read the shared plan. If the repo is private, add a token.");
  return { sha: null, trip: (await response.json()) as Trip };
}

export async function pushTrip(settings: SyncSettings, trip: Trip, sha: string | null): Promise<string> {
  if (!settings.token) throw new Error("Add a GitHub token before saving the shared plan.");
  if (!settings.owner || !settings.repo) throw new Error("Add the GitHub owner and repository name.");
  const path = tripPath(trip.code);
  const url = `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${path}`;
  const response = await fetch(url, {
    method: "PUT",
    headers: headers(settings.token, true),
    body: JSON.stringify({
      message: `Update trip ${trip.code}`,
      content: encode(trip),
      branch: settings.branch || "main",
      ...(sha ? { sha } : {}),
    }),
  });
  if (response.status === 409) {
    const error = new Error("conflict");
    error.name = "ConflictError";
    throw error;
  }
  if (!response.ok) throw new Error(await errorText(response));
  const body = (await response.json()) as { content: { sha: string } };
  return body.content.sha;
}

async function errorText(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message || `GitHub returned ${response.status}`;
  } catch {
    return `GitHub returned ${response.status}`;
  }
}
