import { useState } from 'react';
import type { ReactElement } from 'react';
import Map, { Marker } from 'react-map-gl/maplibre';
import type { MapLayerMouseEvent, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface HomeLocationValue {
  lat: number;
  lng: number;
  radius: number;
}

export interface HomeLocationStepProps {
  onSave: (value: HomeLocationValue) => void;
  onSkip: () => void;
}

const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

export function HomeLocationStep({ onSave, onSkip }: HomeLocationStepProps): ReactElement {
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState<number>(50);

  function handleUseMyLocation(): void {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setPin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    });
  }

  function handleSave(): void {
    if (!pin) return;
    onSave({ lat: pin.lat, lng: pin.lng, radius });
  }

  return (
    <section className="mx-auto flex max-w-md flex-col gap-4 p-6 font-body">
      <h2 className="font-heading text-2xl font-semibold text-primary">Set your home</h2>
      <p className="text-sm text-dark-black/70">
        Tap the map to drop a pin, or use your current location. We&apos;ll use this to surface
        reminders when you get home. You can skip and set it later in Settings.
      </p>

      <div className="h-64 overflow-hidden rounded-2xl border border-dark-black/10">
        <Map
          initialViewState={{ longitude: -79.38, latitude: 43.65, zoom: 11 }}
          style={{ width: '100%', height: '100%' }}
          mapStyle={OSM_STYLE}
          onClick={(e: MapLayerMouseEvent) => setPin({ lat: e.lngLat.lat, lng: e.lngLat.lng })}
        >
          {pin && (
            <Marker longitude={pin.lng} latitude={pin.lat} anchor="bottom">
              <div className="h-4 w-4 rounded-full bg-primary ring-2 ring-white" />
            </Marker>
          )}
        </Map>
      </div>

      <button
        type="button"
        onClick={handleUseMyLocation}
        className="self-start text-sm font-semibold text-primary underline"
      >
        Use my current location
      </button>

      <label className="flex flex-col gap-1 text-sm text-dark-black/80">
        Radius: {radius} m
        <input
          type="range"
          min={25}
          max={200}
          step={5}
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
        />
      </label>

      <div className="mt-2 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm font-semibold text-dark-black/60 underline"
        >
          Skip for now
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!pin}
          className="rounded-full bg-primary px-6 py-2 font-heading text-sm font-semibold text-white disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </section>
  );
}
