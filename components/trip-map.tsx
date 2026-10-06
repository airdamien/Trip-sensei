"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { DayPlan } from "@/lib/types";

type Point = { lat: number; lng: number; label: string; kind: "stop" | "hotel" | "airport" };

export function pointsFor(days: DayPlan[]): { points: Point[]; lines: { lat: number; lng: number }[][] } {
  const points: Point[] = [];
  const lines: { lat: number; lng: number }[][] = [];
  for (const day of days) {
    const line: { lat: number; lng: number }[] = [];
    day.blocks.forEach((block) => {
      if (block.type === "place") {
        points.push({ lat: block.lat, lng: block.lng, label: block.name, kind: "stop" });
        line.push({ lat: block.lat, lng: block.lng });
      } else if (block.type === "airport") {
        points.push({ lat: 35.5494, lng: 139.7798, label: "Haneda", kind: "airport" });
        line.push({ lat: 35.5494, lng: 139.7798 });
      } else if (block.type === "travel" && block.options.some((option) => option.polyline)) {
        const chosen = block.options.find((option) => option.polyline);
        if (chosen?.polyline) lines.push(decodePolyline(chosen.polyline));
      }
    });
    if (line.length > 1) lines.push(line);
  }
  return { points, lines };
}

export function TripMap({ days, className }: { days: DayPlan[]; className?: string }) {
  const { points, lines } = pointsFor(days);
  const ref = useRef<HTMLDivElement>(null);
  const signature = `${points.map((point) => `${point.lat.toFixed(4)},${point.lng.toFixed(4)},${point.label}`).join("|")}:${lines.length}`;
  const drawn = useRef({ points, lines });
  drawn.current = { points, lines };

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let map: LeafletMap | null = null;
    let cancelled = false;
    void (async () => {
      const leaflet = await import("leaflet");
      if (cancelled || !ref.current) return;
      const L = leaflet.default;
      const current = drawn.current;
      if (!current.points.length) return;
      ref.current.replaceChildren();
      map = L.map(ref.current, { zoomControl: true, attributionControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);
      const bounds = L.latLngBounds([]);
      current.points.forEach((point, index) => {
        bounds.extend([point.lat, point.lng]);
        const marker = L.marker([point.lat, point.lng], {
          icon: L.divIcon({
            className: "",
            html: `<div style="width:26px;height:26px;border-radius:999px;background:#c2412d;color:#f6f1e7;display:grid;place-items:center;font:600 12px sans-serif;border:2px solid #f6f1e7;box-shadow:0 1px 4px rgba(0,0,0,.25)">${point.kind === "stop" ? index + 1 : "•"}</div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          }),
          title: point.label,
        });
        marker.bindTooltip(point.label, { direction: "top", offset: [0, -12] });
        marker.addTo(map!);
      });
      current.lines.forEach((path) => {
        if (path.length < 2) return;
        path.forEach((point) => bounds.extend([point.lat, point.lng]));
        L.polyline(
          path.map((point) => [point.lat, point.lng]),
          { color: "#c2412d", weight: 3, opacity: 0.85 },
        ).addTo(map!);
      });
      if (bounds.isValid()) map.fitBounds(bounds.pad(0.2));
      window.setTimeout(() => map?.invalidateSize(), 50);
    })();
    return () => {
      cancelled = true;
      map?.remove();
      node.replaceChildren();
    };
  }, [signature]);

  if (!points.length) {
    return <div className="grid h-full place-items-center text-sm text-muted-foreground">Add a place to draw the map.</div>;
  }

  return <div ref={ref} className={className ?? "h-full w-full"} />;
}

function decodePolyline(encoded: string): { lat: number; lng: number }[] {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates: { lat: number; lng: number }[] = [];
  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte = 0;
    do {
      byte = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coordinates.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return coordinates;
}
