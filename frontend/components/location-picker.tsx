"use client";

import { useEffect, useRef, useState } from "react";

export type MapPin = { latitude: number; longitude: number };

type Props = {
  onChange: (pin: MapPin) => void;
};

export default function LocationPicker({ onChange }: Props) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const [pin, setPin] = useState<MapPin | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let active = true;
    let map: import("leaflet").Map | null = null;
    void import("leaflet").then((leaflet) => {
      if (!active || !mapElement.current) return;
      map = leaflet.map(mapElement.current).setView([-1.6, 37.9], 6);
      mapRef.current = map;
      leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      const placePin = (latitude?: number | null, longitude?: number | null) => {
        if (
          typeof latitude !== "number" ||
          typeof longitude !== "number" ||
          Number.isNaN(latitude) ||
          Number.isNaN(longitude)
        ) {
          return;
        }

        const coordinates = { latitude, longitude };
        if (markerRef.current) markerRef.current.setLatLng([latitude, longitude]);
        else {
          markerRef.current = leaflet.marker([latitude, longitude], {
            draggable: true,
            icon: leaflet.divIcon({
              className: "location-map-pin-icon",
              html: '<span class="location-map-pin" aria-hidden="true"></span>',
              iconSize: [28, 36],
              iconAnchor: [14, 34],
            }),
          }).addTo(map!);
          markerRef.current.on("dragend", () => {
            const position = markerRef.current?.getLatLng();
            if (position) {
              const movedPin = { latitude: position.lat, longitude: position.lng };
              setPin(movedPin);
              onChangeRef.current(movedPin);
            }
          });
        }
        setPin(coordinates);
        onChangeRef.current(coordinates);
      };

      map.on("click", (event: import("leaflet").LeafletMouseEvent) => {
        setError("");
        placePin(event.latlng.lat, event.latlng.lng);
      });
      map.invalidateSize();
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? "Map could not be loaded. Please try again." : "Map could not be loaded.");
      console.error("Could not load sanitation location map", reason);
    });

    return () => {
      active = false;
      map?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  function useCurrentLocation() {
    setError("");
    if (!navigator.geolocation) {
      setError("Location access is not available in this browser. You can still pin the map.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const coordinates = { latitude: coords.latitude, longitude: coords.longitude };
        mapRef.current?.setView([coordinates.latitude, coordinates.longitude], 16);
        if (markerRef.current) markerRef.current.setLatLng([coordinates.latitude, coordinates.longitude]);
        else mapRef.current?.fire("click", { latlng: coordinates });
        setPin(coordinates);
        onChangeRef.current(coordinates);
      },
      () => setError("Could not access your location. Allow location access or pin the map manually."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="location-picker">
      <div className="location-picker-heading">
        <div>
          <strong>Pin the service location</strong>
          <span>Click the map to place a pin, or drag it to the exact spot.</span>
        </div>
        <button type="button" onClick={useCurrentLocation}>Use my location</button>
      </div>
      <div ref={mapElement} className="location-picker-map" aria-label="Map for choosing the service location" />
      {pin && (
        <p className="location-picker-coordinates" aria-live="polite">
          Pinned: {pin.latitude.toFixed(5)}, {pin.longitude.toFixed(5)}
        </p>
      )}
      {error && <p className="location-picker-error" role="alert">{error}</p>}
    </div>
  );
}
