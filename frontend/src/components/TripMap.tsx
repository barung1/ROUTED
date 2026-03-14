import React, { useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default marker icon in bundled apps
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

interface TripMapProps {
  from?: { lat: number; lng: number; name?: string } | null
  to?: { lat: number; lng: number; name?: string } | null
  className?: string
  height?: string
}

function FitBounds({ from, to }: { from: TripMapProps['from']; to: TripMapProps['to'] }) {
  const map = useMap()
  useMemo(() => {
    if (from && to) {
      const bounds = L.latLngBounds([from.lat, from.lng], [to.lat, to.lng])
      map.fitBounds(bounds.pad(0.15), { maxZoom: 12 })
    }
  }, [map, from, to])
  return null
}

export const TripMap: React.FC<TripMapProps> = ({
  from,
  to,
  className = '',
  height = '220px',
}) => {
  const hasRoute = from && to
  const center: [number, number] = hasRoute
    ? [(from.lat + to.lat) / 2, (from.lng + to.lng) / 2]
    : [20, 0]
  const zoom = hasRoute ? 5 : 2

  const linePositions: [number, number][] = hasRoute
    ? [
        [from.lat, from.lng],
        [to.lat, to.lng],
      ]
    : []

  return (
    <div className={`rounded-xl overflow-hidden border border-gray-200 ${className}`} style={{ height }}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={false}
        className="h-full w-full"
        style={{ minHeight: height }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {from && <FitBounds from={from} to={to} />}
        {from && (
          <Marker position={[from.lat, from.lng]}>
            <Popup>{from.name || 'From'}</Popup>
          </Marker>
        )}
        {to && (
          <Marker position={[to.lat, to.lng]}>
            <Popup>{to.name || 'To'}</Popup>
          </Marker>
        )}
        {linePositions.length >= 2 && (
          <Polyline
            positions={linePositions}
            pathOptions={{ color: '#4169e1', weight: 3, opacity: 0.8 }}
          />
        )}
      </MapContainer>
    </div>
  )
}
