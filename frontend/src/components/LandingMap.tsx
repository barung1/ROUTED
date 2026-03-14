import React, { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import api from '../api/client'

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

interface TripMarker {
  id: string
  lat: number
  lng: number
  label: string
  toPlace: string | null
  fromPlace: string | null
}

export const LandingMap: React.FC<{ className?: string; height?: string }> = ({
  className = '',
  height = '400px',
}) => {
  const [trips, setTrips] = useState<TripMarker[]>([])

  useEffect(() => {
    api
      .get<Array<{
        id: string
        toLat: number | null
        toLng: number | null
        fromLat: number | null
        fromLng: number | null
        toPlace: string | null
        fromPlace: string | null
      }>>('/trips/')
      .then((res) => {
        const markers: TripMarker[] = []
        for (const t of res.data || []) {
          const lat = t.toLat ?? t.fromLat
          const lng = t.toLng ?? t.fromLng
          if (lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
            markers.push({
              id: t.id,
              lat,
              lng,
              label: t.toPlace || t.fromPlace || 'Trip',
              toPlace: t.toPlace,
              fromPlace: t.fromPlace,
            })
          }
        }
        setTrips(markers)
      })
      .catch(() => setTrips([]))
  }, [])

  const hasPoints = trips.length > 0
  const center: [number, number] = hasPoints
    ? [
        trips.reduce((s, t) => s + t.lat, 0) / trips.length,
        trips.reduce((s, t) => s + t.lng, 0) / trips.length,
      ]
    : [20, 0]
  const zoom = hasPoints ? 3 : 2

  return (
    <div
      className={`rounded-2xl overflow-hidden border border-slate-200/80 shadow-lg ${className}`}
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        className="h-full w-full"
        style={{ minHeight: height }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {trips.map((t) => (
          <Marker key={t.id} position={[t.lat, t.lng]}>
            <Popup>
              <span className="font-medium">{t.label}</span>
              {t.fromPlace && (
                <p className="text-sm text-slate-600 mt-1">From: {t.fromPlace}</p>
              )}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
