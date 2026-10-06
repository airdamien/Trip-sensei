import { classify, zoneFor } from "@/lib/geo";
import type { HotelOption, RegionId } from "@/lib/types";

export type PlaceHit = {
  id: string;
  name: string;
  detail: string;
  lat: number;
  lng: number;
  zone: string;
  region: RegionId;
};

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_id?: number;
    name?: string;
    countrycode?: string;
    city?: string;
    state?: string;
    street?: string;
    osm_value?: string;
  };
};

export async function searchPlaces(query: string): Promise<PlaceHit[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=35.6812&lon=139.7671&limit=8&lang=en`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Place search failed.");
  const body = (await response.json()) as { features?: PhotonFeature[] };
  return (body.features ?? [])
    .filter((feature) => {
      const code = feature.properties?.countrycode;
      return !code || code === "JP";
    })
    .map((feature) => {
      const [lng, lat] = feature.geometry?.coordinates ?? [0, 0];
      const name = feature.properties?.name || query;
      const region = classify(lat, lng);
      const detail = [feature.properties?.osm_value, feature.properties?.city || feature.properties?.state, feature.properties?.street]
        .filter(Boolean)
        .join(" · ");
      return {
        id: `osm-${feature.properties?.osm_id ?? `${lat.toFixed(5)}-${lng.toFixed(5)}`}`,
        name,
        detail,
        lat,
        lng,
        zone: zoneFor(lat, lng, region),
        region,
      };
    });
}

export async function nearbyHotels(lat: number, lng: number, area: string): Promise<HotelOption[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(`hotel ${area}`)}&lat=${lat}&lon=${lng}&limit=8&lang=en`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Hotel search failed.");
  const body = (await response.json()) as { features?: PhotonFeature[] };
  return (body.features ?? [])
    .filter((feature) => {
      const kind = feature.properties?.osm_value;
      const code = feature.properties?.countrycode;
      return (!code || code === "JP") && kind !== "love_hotel" && Boolean(feature.properties?.name);
    })
    .map((feature) => {
      const [pointLng, pointLat] = feature.geometry?.coordinates ?? [lng, lat];
      const name = feature.properties?.name ?? "Hotel";
      const kind = feature.properties?.osm_value === "hostel" ? "Hostel" : "Hotel";
      return {
        id: `osm-hotel-${feature.properties?.osm_id ?? name}`,
        name,
        area,
        lat: pointLat,
        lng: pointLng,
        blurb: `${kind} near ${area}. Ask the desk to hold bags before 3:00 pm. That storage is free.`,
        priceBand: "OpenStreetMap",
        station: feature.properties?.city || area,
        mapsUrl: `https://www.openstreetmap.org/?mlat=${pointLat}&mlon=${pointLng}#map=18/${pointLat}/${pointLng}`,
        source: "osm" as const,
      };
    });
}
