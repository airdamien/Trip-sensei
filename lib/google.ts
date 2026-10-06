import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { classify, zoneFor } from "@/lib/geo";
import { reservationFor } from "@/lib/trains";
import type { HotelOption, RouteOption } from "@/lib/types";

let loading: Promise<void> | null = null;
let loadedKey = "";

export async function ensureMaps(key: string): Promise<void> {
  if (!key) throw new Error("Add a Google Maps key in Share settings.");
  if (loadedKey && loadedKey !== key) {
    throw new Error("Reload the page after changing the Maps key.");
  }
  if (!loading) {
    loadedKey = key;
    setOptions({ key, v: "weekly" });
    loading = Promise.all([importLibrary("maps"), importLibrary("places"), importLibrary("geocoding")]).then(() => undefined);
  }
  await loading;
}

export async function searchPlaces(key: string, query: string): Promise<google.maps.places.AutocompletePrediction[]> {
  await ensureMaps(key);
  const service = new google.maps.places.AutocompleteService();
  return new Promise((resolve, reject) => {
    service.getPlacePredictions(
      { input: query, componentRestrictions: { country: "jp" } },
      (predictions, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
          if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) resolve([]);
          else reject(new Error("Place search failed."));
          return;
        }
        resolve(predictions);
      },
    );
  });
}

export async function placeDetails(
  key: string,
  placeId: string,
): Promise<{ name: string; lat: number; lng: number; zone: string; region: ReturnType<typeof classify> }> {
  await ensureMaps(key);
  const service = new google.maps.places.PlacesService(document.createElement("div"));
  return new Promise((resolve, reject) => {
    service.getDetails({ placeId, fields: ["name", "geometry", "place_id"] }, (place, status) => {
      if (status !== google.maps.places.PlacesServiceStatus.OK || !place?.geometry?.location || !place.name) {
        reject(new Error("Could not read that place."));
        return;
      }
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      const region = classify(lat, lng);
      resolve({ name: place.name, lat, lng, zone: zoneFor(lat, lng, region), region });
    });
  });
}

export async function nearbyHotels(key: string, lat: number, lng: number, area: string): Promise<HotelOption[]> {
  await ensureMaps(key);
  const service = new google.maps.places.PlacesService(document.createElement("div"));
  return new Promise((resolve, reject) => {
    service.nearbySearch(
      { location: { lat, lng }, radius: 1400, type: "lodging" },
      (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          resolve([]);
          return;
        }
        if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
          reject(new Error("Hotel search failed."));
          return;
        }
        resolve(
          results.slice(0, 6).map((place) => ({
            id: `g:${place.place_id}`,
            name: place.name ?? "Hotel",
            area,
            lat: place.geometry?.location?.lat() ?? lat,
            lng: place.geometry?.location?.lng() ?? lng,
            blurb: place.vicinity ? `${place.vicinity}. The desk can hold bags before check-in.` : "Nearby hotel from Google Places.",
            priceBand: priceBand(place.price_level),
            station: area,
            mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name ?? "hotel")}&query_place_id=${place.place_id}`,
            rating: place.rating,
            source: "google" as const,
          })),
        );
      },
    );
  });
}

function priceBand(level?: number): string {
  if (level === 0 || level === 1) return "Simple";
  if (level === 2) return "Mid range";
  if (level === 3 || level === 4) return "Splurge";
  return "See the hotel site";
}

export async function liveRoutes(
  key: string,
  from: google.maps.LatLngLiteral,
  to: google.maps.LatLngLiteral,
  depart: Date,
  date: string,
): Promise<RouteOption[]> {
  await ensureMaps(key);
  const service = new google.maps.DirectionsService();
  const [transit, walk] = await Promise.all([
    route(service, from, to, google.maps.TravelMode.TRANSIT, depart),
    route(service, from, to, google.maps.TravelMode.WALKING, depart),
  ]);
  const options: RouteOption[] = [];
  if (walk && walk.minutes <= 35) {
    options.push({
      mode: "walk",
      minutes: walk.minutes,
      costYen: 0,
      summary: "Walk",
      detail: walk.detail,
      reserve: null,
      polyline: walk.polyline,
      source: "google",
    });
  }
  if (transit) {
    options.push({
      mode: "transit",
      minutes: transit.minutes,
      costYen: transit.costYen,
      summary: transit.summary,
      detail: transit.detail,
      reserve: reservationFor(transit.summary + " " + transit.detail, date),
      polyline: transit.polyline,
      source: "google",
    });
  }
  return options;
}

function polylineOf(overview: string | { points?: string } | undefined): string | null {
  if (!overview) return null;
  if (typeof overview === "string") return overview;
  return overview.points ?? null;
}

function route(
  service: google.maps.DirectionsService,
  from: google.maps.LatLngLiteral,
  to: google.maps.LatLngLiteral,
  mode: google.maps.TravelMode,
  depart: Date,
): Promise<{ minutes: number; summary: string; detail: string; costYen: number | null; polyline: string | null } | null> {
  return new Promise((resolve) => {
    service.route(
      {
        origin: from,
        destination: to,
        travelMode: mode,
        region: "jp",
        transitOptions: mode === google.maps.TravelMode.TRANSIT ? { departureTime: depart } : undefined,
      },
      (result, status) => {
        if (status !== "OK" || !result?.routes[0]?.legs[0]) {
          resolve(null);
          return;
        }
        const leg = result.routes[0].legs[0];
        const lines = leg.steps
          .filter((step) => step.travel_mode === "TRANSIT" && step.transit)
          .map((step) => {
            const transit = step.transit!;
            const name = transit.line.short_name || transit.line.name;
            return `${name} from ${transit.departure_stop.name} to ${transit.arrival_stop.name}`;
          });
        const summary =
          mode === google.maps.TravelMode.WALKING
            ? "Walk"
            : lines.map((line) => line.split(" from ")[0]).join(" → ") || result.routes[0].summary;
        resolve({
          minutes: Math.max(1, Math.round((leg.duration?.value ?? 0) / 60)),
          summary,
          detail: lines.join(". ") || leg.steps.map((step) => step.instructions?.replace(/<[^>]+>/g, "")).filter(Boolean).join(" · "),
          costYen: result.routes[0].fare?.value ?? null,
          polyline: polylineOf(result.routes[0].overview_polyline),
        });
      },
    );
  });
}
