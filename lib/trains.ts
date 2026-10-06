import { isBusyDate } from "@/lib/format";
import { classify, haversine, isHaneda } from "@/lib/geo";
import type { LatLng, Reservation, RouteOption, TravelMode } from "@/lib/types";

const RESERVE_RE =
  /shinkansen|nozomi|hikari|kodama|hayabusa|hayate|komachi|romancecar|narita express|\bnex\b|limited express|haruka|thunderbird|spacia|kaiji|azusa|fuji excursion/i;

export function reservationFor(line: string, date: string): Reservation | null {
  if (!RESERVE_RE.test(line)) return null;
  const busy = isBusyDate(date);
  const shinkansen = /shinkansen|nozomi|hikari|kodama|hayabusa|hayate|komachi/i.test(line);
  return {
    needed: true,
    where: shinkansen
      ? "SmartEX for Tokaido and Sanyo trains, or JR-EAST Train Reservation for JR East shinkansen"
      : "JR-EAST Train Reservation, the Odakyu or Tobu website, or a station ticket machine",
    when: busy
      ? "This date is a holiday or weekend. Book the morning the window opens, about one month ahead at 10:00 Japan time."
      : "Reserve at least a few days ahead. Windows usually open one month before, at 10:00 Japan time.",
    note: shinkansen
      ? "A reserved ordinary seat is enough for two people. A suitcase whose three sides add up to more than 160 cm has to be booked into an oversized-baggage seat on the Tokaido shinkansen."
      : "Some limited expresses still have unreserved cars. On a holiday those seats go first and you will be standing.",
  };
}

function taxiYen(km: number, departMin: number): number {
  const meters = km * 1000;
  let yen = 500;
  const extra = Math.max(0, meters - 1096);
  yen += Math.ceil(extra / 255) * 100;
  const hour = Math.floor(departMin / 60) % 24;
  if (hour >= 22 || hour < 5) yen = Math.round(yen * 1.2);
  return yen;
}

function option(partial: Omit<RouteOption, "polyline" | "source"> & { polyline?: string | null; source?: RouteOption["source"] }): RouteOption {
  return {
    polyline: partial.polyline ?? null,
    source: partial.source ?? "estimate",
    mode: partial.mode,
    minutes: partial.minutes,
    costYen: partial.costYen,
    summary: partial.summary,
    detail: partial.detail,
    reserve: partial.reserve,
  };
}

export function estimateOptions(from: LatLng, to: LatLng, departMin: number, date: string): RouteOption[] {
  const km = haversine(from, to);
  const options: RouteOption[] = [];
  const fromRegion = classify(from.lat, from.lng);
  const toRegion = classify(to.lat, to.lng);
  const hanedaEnd = isHaneda(from) || isHaneda(to);
  const asakusaEnd =
    (from.lat >= 35.705 && from.lng >= 139.785) || (to.lat >= 35.705 && to.lng >= 139.785);

  if (km <= 2.4) {
    const minutes = Math.max(5, Math.round((km / 4.6) * 60));
    options.push(
      option({
        mode: "walk",
        minutes,
        costYen: 0,
        summary: "Walk",
        detail: km < 0.25 ? "It is next door." : `About ${km.toFixed(1)} km on foot.`,
        reserve: null,
      }),
    );
  }

  if (km >= 0.35) {
    let transit = transitEstimate(from, to, km, fromRegion, toRegion, hanedaEnd, asakusaEnd, date);
    if (km < 0.8 && options.some((o) => o.mode === "walk")) {
      transit = null;
    }
    if (transit) options.push(transit);
  }

  if (km >= 0.8 && km <= 35) {
    const minutes = Math.max(8, Math.round((km / 20) * 60) + 4);
    options.push(
      option({
        mode: "taxi",
        minutes,
        costYen: taxiYen(km, departMin),
        summary: "Taxi",
        detail:
          "Tokyo meter: ¥500 to start, then about ¥100 per 255 meters. A taxi is worth it with luggage late at night, not for a cross-town hop at 5pm.",
        reserve: null,
      }),
    );
  }

  if (!options.length) {
    options.push(
      option({
        mode: "transit",
        minutes: 15,
        costYen: 180,
        summary: "Train",
        detail: "A short hop with an IC card.",
        reserve: null,
      }),
    );
  }

  return options;
}

function transitEstimate(
  from: LatLng,
  to: LatLng,
  km: number,
  fromRegion: string,
  toRegion: string,
  hanedaEnd: boolean,
  asakusaEnd: boolean,
  date: string,
): RouteOption | null {
  if (hanedaEnd && asakusaEnd) {
    return option({
      mode: "transit",
      minutes: 48,
      costYen: 530,
      summary: "Keikyu Airport Line through to Asakusa",
      detail:
        "From Haneda, take the Keikyu line. Trains continue onto the Toei Asakusa Line, so you usually stay on board all the way to Asakusa. No seat reservation. Suica or Pasmo works. This is the luggage-friendly way.",
      reserve: null,
    });
  }

  if (hanedaEnd) {
    const minutes = Math.max(35, Math.round(30 + km * 1.3));
    return option({
      mode: "transit",
      minutes,
      costYen: km < 12 ? 420 : 580,
      summary: "Keikyu, then JR or subway",
      detail:
        "Ride Keikyu from Haneda to Shinagawa (or stay on if your hotel is on the Asakusa Line). Change there for the Yamanote or the subway. No reservation. Use an IC card.",
      reserve: null,
    });
  }

  const regions = new Set([fromRegion, toRegion]);
  if (regions.has("kamakura") && regions.has("tokyo")) {
    return option({
      mode: "transit",
      minutes: 75,
      costYen: 940,
      summary: "JR rapid to Kamakura",
      detail:
        "JR Yokosuka Line from Tokyo, or Shonan-Shinjuku from Shinjuku and Shibuya. About an hour, no reserved seats. On a weekend, go in the morning. The Enoden tram runs from Kamakura Station to Hase for the Great Buddha.",
      reserve: null,
    });
  }

  if (regions.has("nikko") && (regions.has("tokyo") || from.name.includes("Asakusa") || to.name.includes("Asakusa"))) {
    return option({
      mode: "transit",
      minutes: 120,
      costYen: 2800,
      summary: "Tobu limited express to Nikko",
      detail: "Tobu Railway from Asakusa. The limited express is the comfortable ride and it does take seat reservations.",
      reserve: reservationFor("Tobu limited express", date),
    });
  }

  if (regions.has("hakone") && regions.has("tokyo")) {
    return option({
      mode: "transit",
      minutes: 85,
      costYen: 2500,
      summary: "Odakyu Romancecar to Hakone-Yumoto",
      detail:
        "From Shinjuku. Reserve the Romancecar. Local Odakyu trains are cheaper and slower and do not need a reservation. Pick up a Hakone Free Pass if you will ride the pirate ship, ropeway, and bus.",
      reserve: reservationFor("Odakyu Romancecar", date),
    });
  }

  if ((from.lat >= 35.85 || to.lat >= 35.85) && fromRegion === "tokyo" && toRegion === "tokyo") {
    return option({
      mode: "transit",
      minutes: 40,
      costYen: 570,
      summary: "JR to Omiya",
      detail:
        "JR Keihin-Tohoku or the Utsunomiya Line to Omiya, about 30–40 minutes from Tokyo or Ueno. No seat reservation. A shinkansen is faster and costs more; you do not need one for the museum.",
      reserve: null,
    });
  }

  if (regions.has("yokohama") && regions.has("tokyo")) {
    return option({
      mode: "transit",
      minutes: 40,
      costYen: 510,
      summary: "JR to Yokohama",
      detail: "JR Keihin-Tohoku or the Tokaido Line, about 30–40 minutes from Tokyo or Shimbashi. No reservation. Suica or Pasmo is enough.",
      reserve: null,
    });
  }

  if (regions.has("kyoto") && regions.has("tokyo")) {
    return option({
      mode: "transit",
      minutes: 150,
      costYen: 13870,
      summary: "Tokaido Shinkansen (Hikari)",
      detail:
        "Tokyo Station to Kyoto, each way. Hikari is the right train unless you specifically need a Nozomi stop pattern. About $92 · ¥13,870 is a typical adult reserved ordinary seat, not a quote. The return is the same fare again.",
      reserve: reservationFor("Shinkansen Hikari", date),
    });
  }

  if (regions.has("osaka") && regions.has("tokyo")) {
    return option({
      mode: "transit",
      minutes: 165,
      costYen: 14720,
      summary: "Tokaido Shinkansen to Shin-Osaka",
      detail: "About two and a half hours. Reserve ordinary seats. A JR Pass rarely pays off for a single round trip plus Tokyo transit — run the numbers before you buy one.",
      reserve: reservationFor("Shinkansen Hikari", date),
    });
  }

  if (regions.has("kanazawa") && regions.has("tokyo")) {
    return option({
      mode: "transit",
      minutes: 160,
      costYen: 14000,
      summary: "Hokuriku Shinkansen",
      detail: "From Tokyo Station. Reserve. This is a JR East train, so use JR-EAST Train Reservation rather than SmartEX.",
      reserve: reservationFor("Hokuriku Shinkansen", date),
    });
  }

  if (km > 280) {
    return option({
      mode: "transit",
      minutes: Math.round(70 + (km / 210) * 60),
      costYen: Math.round(km * 22),
      summary: "Shinkansen",
      detail: "A long-distance shinkansen day. Reserve seats before you count on a specific train.",
      reserve: reservationFor("Shinkansen", date),
    });
  }

  if (km > 70) {
    const reserve = reservationFor("Limited express", date);
    return option({
      mode: "transit",
      minutes: Math.round(25 + (km / 70) * 60),
      costYen: Math.round(1200 + km * 20),
      summary: "Limited express",
      detail: "A reserved limited express is the comfortable way once you are past the suburbs.",
      reserve,
    });
  }

  const cost = km < 4 ? 180 : km < 8 ? 220 : km < 14 ? 310 : km < 24 ? 460 : 640;
  const minutes = Math.max(12, Math.round(8 + (km / 26) * 60));
  return option({
    mode: "transit",
    minutes,
    costYen: cost,
    summary: km < 8 ? "Subway or JR, IC card" : "JR or subway with one change",
    detail:
      "Tap a Suica or Pasmo. No seat reservation. Digital Suica on iPhone works; Welcome Suica covers a short trip if you do not have a phone card yet.",
    reserve: null,
  });
}

export function defaultMode(options: RouteOption[]): TravelMode {
  const walk = options.find((o) => o.mode === "walk");
  const transit = options.find((o) => o.mode === "transit");
  if (walk && walk.minutes <= 16 && (!transit || walk.minutes + 3 <= transit.minutes)) return "walk";
  if (transit) return "transit";
  if (walk) return "walk";
  return "taxi";
}

export function chosenOption(options: RouteOption[], choice?: TravelMode): RouteOption {
  if (choice) {
    const hit = options.find((o) => o.mode === choice);
    if (hit) return hit;
  }
  const mode = defaultMode(options);
  return options.find((o) => o.mode === mode) ?? options[0];
}
