import type { LatLng, RegionId } from "@/lib/types";

export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const HANEDA: LatLng = {
  lat: 35.5494,
  lng: 139.7798,
  name: "Haneda Airport",
};

export function isHaneda(p: { lat: number; lng: number }): boolean {
  return p.lat < 35.575 && p.lat > 35.53 && p.lng > 139.74 && p.lng < 139.82;
}

type RegionMeta = {
  label: string;
  lat: number;
  lng: number;
  kind: "base" | "day-trip" | "overnight";
  train: string;
};

export const REGIONS: Record<RegionId, RegionMeta> = {
  tokyo: {
    label: "Tokyo",
    lat: 35.6812,
    lng: 139.7671,
    kind: "base",
    train: "Suica or Pasmo on JR and the subway. No seat reservations.",
  },
  yokohama: {
    label: "Yokohama",
    lat: 35.4437,
    lng: 139.638,
    kind: "day-trip",
    train: "JR Keihin-Tohoku or Toyoko Line, about 30–40 minutes. No reservation.",
  },
  kamakura: {
    label: "Kamakura",
    lat: 35.319,
    lng: 139.5467,
    kind: "day-trip",
    train: "JR Yokosuka Line or Shonan-Shinjuku Line, about an hour. No reserved seats. Weekend trains are crowded.",
  },
  nikko: {
    label: "Nikko",
    lat: 36.7198,
    lng: 139.6982,
    kind: "day-trip",
    train: "Tobu limited express from Asakusa, about two hours. Reserve a seat.",
  },
  hakone: {
    label: "Hakone",
    lat: 35.2324,
    lng: 139.1069,
    kind: "overnight",
    train: "Odakyu Romancecar from Shinjuku to Hakone-Yumoto. Reserve, then the Hakone Free Pass for the loop.",
  },
  fuji: {
    label: "Kawaguchiko",
    lat: 35.498,
    lng: 138.768,
    kind: "overnight",
    train: "Limited express Fuji Excursion or highway bus from Shinjuku. Reserve the train.",
  },
  kyoto: {
    label: "Kyoto",
    lat: 34.985,
    lng: 135.758,
    kind: "overnight",
    train: "Tokaido Shinkansen from Tokyo Station, about 2 hours 15 minutes each way on Hikari. Reserve both directions. A palace day is there and back; the bags stay in Tokyo.",
  },
  nara: {
    label: "Nara",
    lat: 34.6851,
    lng: 135.8048,
    kind: "overnight",
    train: "Best paired with Kyoto. From Kyoto it is about 45 minutes on JR or Kintetsu, no reservation.",
  },
  osaka: {
    label: "Osaka",
    lat: 34.7025,
    lng: 135.4959,
    kind: "overnight",
    train: "Tokaido Shinkansen from Tokyo. Reserve. About 2 hours 30 minutes.",
  },
  kanazawa: {
    label: "Kanazawa",
    lat: 36.5613,
    lng: 136.6562,
    kind: "overnight",
    train: "Hokuriku Shinkansen from Tokyo, about 2 hours 30 minutes. Reserve.",
  },
  hiroshima: {
    label: "Hiroshima",
    lat: 34.3853,
    lng: 132.4553,
    kind: "overnight",
    train: "Tokaido and Sanyo Shinkansen, about 4 hours. Reserve, and only if you can spare two nights.",
  },
};

export function classify(lat: number, lng: number): RegionId {
  let best: RegionId = "tokyo";
  let bestD = Infinity;
  (Object.keys(REGIONS) as RegionId[]).forEach((id) => {
    const d = haversine({ lat, lng }, REGIONS[id]);
    if (d < bestD) {
      best = id;
      bestD = d;
    }
  });
  const tokyoD = haversine({ lat, lng }, REGIONS.tokyo);
  if (tokyoD <= 20) return "tokyo";
  return best;
}

export function zoneFor(lat: number, lng: number, region: RegionId = classify(lat, lng)): string {
  if (isHaneda({ lat, lng })) return "Haneda";
  if (region !== "tokyo") return REGIONS[region].label;
  if (lat >= 35.85) return "Omiya";
  if (lat >= 35.705 && lng >= 139.785) return "Asakusa";
  if (lat >= 35.705 && lng >= 139.735) return "Ueno & Yanaka";
  if (lat < 35.675 && lng >= 139.755) return "Tsukiji & Toyosu";
  if (lng < 139.715 && lat < 35.685) return "Shibuya & Harajuku";
  if (lng < 139.725 && lat >= 35.685 && lat < 35.715) return "Shinjuku";
  return "Central Tokyo";
}

export const ZONE_CENTROIDS: Record<string, LatLng> = {
  Asakusa: { lat: 35.7148, lng: 139.7966, name: "Asakusa" },
  "Ueno & Yanaka": { lat: 35.724, lng: 139.771, name: "Ueno" },
  "Tsukiji & Toyosu": { lat: 35.66, lng: 139.78, name: "Tsukiji" },
  "Shibuya & Harajuku": { lat: 35.662, lng: 139.698, name: "Shibuya" },
  Shinjuku: { lat: 35.6906, lng: 139.7006, name: "Shinjuku" },
  "Central Tokyo": { lat: 35.6812, lng: 139.7671, name: "Tokyo Station" },
  Haneda: HANEDA,
  Omiya: { lat: 35.921, lng: 139.618, name: "Omiya" },
  Yokohama: { lat: 35.4437, lng: 139.638, name: "Yokohama" },
  Kamakura: { lat: 35.319, lng: 139.5467, name: "Kamakura" },
  Nikko: { lat: 36.7198, lng: 139.6982, name: "Nikko" },
  Hakone: { lat: 35.2324, lng: 139.1069, name: "Hakone" },
  Kawaguchiko: { lat: 35.498, lng: 138.768, name: "Kawaguchiko" },
  Kyoto: { lat: 34.985, lng: 135.758, name: "Kyoto" },
  Nara: { lat: 34.6851, lng: 135.8048, name: "Nara" },
  Osaka: { lat: 34.7025, lng: 135.4959, name: "Osaka" },
  Kanazawa: { lat: 36.5613, lng: 136.6562, name: "Kanazawa" },
  Hiroshima: { lat: 34.3853, lng: 132.4553, name: "Hiroshima" },
};

export function centroid(zone: string): LatLng {
  return ZONE_CENTROIDS[zone] ?? ZONE_CENTROIDS["Central Tokyo"];
}

export const ZONE_ORDER = [
  "Ueno & Yanaka",
  "Tsukiji & Toyosu",
  "Central Tokyo",
  "Shibuya & Harajuku",
  "Shinjuku",
];
