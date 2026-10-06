"use client";

import { useEffect, useRef } from "react";
import { ensureMaps } from "@/lib/google";
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

export function TripMap({
  days,
  mapsKey,
  className,
}: {
  days: DayPlan[];
  mapsKey: string;
  className?: string;
}) {
  const { points, lines } = pointsFor(days);
  const ref = useRef<HTMLDivElement>(null);
  const signature = `${mapsKey}:${points.map((point) => `${point.lat.toFixed(4)},${point.lng.toFixed(4)}`).join("|")}:${lines.length}`;
  const drawn = useRef({ points, lines });
  drawn.current = { points, lines };

  useEffect(() => {
    if (!mapsKey || !ref.current) return;
    let cancelled = false;
    ensureMaps(mapsKey)
      .then(() => {
        if (cancelled || !ref.current) return;
        const current = drawn.current;
        if (!current.points.length) return;
        const center = current.points[Math.floor(current.points.length / 2)];
        const map = new google.maps.Map(ref.current, {
          center,
          zoom: 11,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          backgroundColor: "#f3eee4",
          styles: MAP_STYLE,
        });
        const bounds = new google.maps.LatLngBounds();
        current.points.forEach((point, index) => {
          bounds.extend(point);
          new google.maps.Marker({
            map,
            position: point,
            label: point.kind === "stop" ? String(index + 1) : undefined,
            title: point.label,
          });
        });
        current.lines.forEach((path) => {
          path.forEach((point) => bounds.extend(point));
          new google.maps.Polyline({
            map,
            path,
            strokeColor: "#c2412d",
            strokeOpacity: 0.85,
            strokeWeight: 3,
          });
        });
        if (current.points.length > 1) map.fitBounds(bounds, 48);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [mapsKey, signature]);

  if (mapsKey) {
    return <div ref={ref} className={className ?? "h-full w-full rounded-3xl"} />;
  }

  return <Schematic points={points} lines={lines} className={className} />;
}

function Schematic({
  points,
  lines,
  className,
}: {
  points: Point[];
  lines: { lat: number; lng: number }[][];
  className?: string;
}) {
  if (!points.length) {
    return <div className="grid h-full place-items-center text-sm text-muted-foreground">Add a place to draw the map.</div>;
  }
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const minLat = Math.min(...lats) - 0.08;
  const maxLat = Math.max(...lats) + 0.08;
  const minLng = Math.min(...lngs) - 0.08;
  const maxLng = Math.max(...lngs) + 0.08;
  const x = (lng: number) => ((lng - minLng) / (maxLng - minLng)) * 100;
  const y = (lat: number) => (1 - (lat - minLat) / (maxLat - minLat)) * 100;

  return (
    <svg viewBox="0 0 100 100" className={className ?? "h-full w-full rounded-3xl bg-[#efe6d6]"}>
      <rect width="100" height="100" fill="#efe6d6" />
      {Array.from({ length: 6 }, (_, index) => (
        <line key={index} x1={index * 20} y1="0" x2={index * 20} y2="100" stroke="#e2d5c0" strokeWidth="0.3" />
      ))}
      {lines.map((line, index) => (
        <polyline
          key={index}
          fill="none"
          stroke="#c2412d"
          strokeWidth="0.8"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={line.map((point) => `${x(point.lng)},${y(point.lat)}`).join(" ")}
        />
      ))}
      {points.map((point, index) => (
        <g key={`${point.label}-${index}`}>
          <circle cx={x(point.lng)} cy={y(point.lat)} r={point.kind === "stop" ? 2.2 : 1.6} fill="#c2412d" />
          <text x={x(point.lng) + 2.6} y={y(point.lat) + 1} fontSize="2.4" fill="#1c1915">
            {point.kind === "stop" ? `${index + 1} ${short(point.label)}` : short(point.label)}
          </text>
        </g>
      ))}
    </svg>
  );
}

function short(label: string): string {
  return label.length > 22 ? `${label.slice(0, 20)}…` : label;
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

const MAP_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "geometry", stylers: [{ color: "#f3eee4" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5c5348" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#e7dccb" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#d5e2dc" }] },
  { featureType: "landscape.natural", stylers: [{ color: "#e7f0e6" }] },
];
