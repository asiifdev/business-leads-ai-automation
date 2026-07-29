"use client";
import { useMemo } from "react";
import Link from "next/link";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Phone, Star, ChevronRight } from "lucide-react";
import type { Lead } from "@/hooks/use-leads";

// Jakarta city center — used as the default view when no leads have coordinates yet.
const DEFAULT_CENTER: [number, number] = [-6.2088, 106.8456];
const DEFAULT_ZOOM = 11;

const PRIORITY_COLOR: Record<Lead["priority"], string> = {
  HIGH: "hsl(var(--success))",
  MEDIUM: "hsl(var(--warning))",
  LOW: "hsl(var(--muted-foreground))",
};

function markerIcon(priority: Lead["priority"]) {
  const color = PRIORITY_COLOR[priority];
  return L.divIcon({
    className: "prospex-marker",
    html: `
      <div class="prospex-marker-pin" style="--pin-color:${color}">
        <svg width="30" height="38" viewBox="0 0 30 38" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 23 15 23s15-12.5 15-23C30 6.7 23.3 0 15 0z" fill="var(--pin-color)"/>
          <circle cx="15" cy="15" r="6" fill="white"/>
        </svg>
      </div>
    `,
    iconSize: [30, 38],
    iconAnchor: [15, 38],
    popupAnchor: [0, -34],
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useMemo(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.map((p) => p.join(",")).join("|")]);
  return null;
}

interface Props {
  leads: Lead[];
}

export function LeadsMap({ leads }: Props) {
  const pinned = leads.filter(
    (l): l is Lead & { lat: number; lng: number } =>
      typeof l.lat === "number" && typeof l.lng === "number",
  );
  const points = useMemo<[number, number][]>(
    () => pinned.map((l) => [l.lat, l.lng]),
    [pinned],
  );

  if (leads.length > 0 && pinned.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <p className="text-sm font-medium">No coordinates available for these leads</p>
        <p className="text-xs text-muted-foreground">
          Coordinates are captured for new scrapes going forward
        </p>
      </div>
    );
  }

  return (
    <div className="h-[520px] w-full overflow-hidden rounded-b-lg">
      <style>{`
        .prospex-marker-pin { filter: drop-shadow(0 2px 4px rgb(0 0 0 / 0.35)); transition: transform 0.15s ease; }
        .prospex-marker-pin:hover { transform: scale(1.15) translateY(-2px); }
        .leaflet-popup-content-wrapper { border-radius: 0.75rem; }
      `}</style>
      <MapContainer
        center={pinned[0] ? [pinned[0].lat, pinned[0].lng] : DEFAULT_CENTER}
        zoom={pinned.length ? undefined : DEFAULT_ZOOM}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        {pinned.map((lead) => (
          <Marker key={lead.id} position={[lead.lat, lead.lng]} icon={markerIcon(lead.priority)}>
            <Popup>
              <div className="min-w-[180px] space-y-1">
                <p className="text-sm font-semibold leading-tight">{lead.name}</p>
                {lead.address && <p className="text-xs text-muted-foreground">{lead.address}</p>}
                <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
                  {lead.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />{lead.phone}
                    </span>
                  )}
                  {lead.rating && (
                    <span className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-warning" />{lead.rating}
                      {lead.reviewCount != null && ` (${lead.reviewCount})`}
                    </span>
                  )}
                </div>
                <Link
                  href={`/leads/${lead.id}`}
                  className="flex items-center gap-0.5 pt-1 text-xs font-medium text-primary hover:underline"
                >
                  View details<ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
