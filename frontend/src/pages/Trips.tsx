import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../api/client'

/* ── types ── */
interface TripItem {
  id: string
  fromPlace: string
  toPlace: string
  startDate: string
  endDate: string
  travelMode: string
  budget: string
  currency: string
  interests: string
  description: string
  status: 'planned' | 'completed' | 'cancelled'
}

interface LocationItem {
  id: string
  name: string
  description: string
  latitude: number
  longitude: number
  tags: string[]
}

/* ── helpers ── */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
})

const LS_TRIPS_KEY = 'routed_my_trips'
const LS_SHORTLIST_KEY = 'routed_shortlisted'

const statusColors: Record<string, string> = {
  planned: 'bg-blue-100 text-blue-700 border-blue-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
}

const statusEmoji: Record<string, string> = {
  planned: '🗓️',
  completed: '✅',
  cancelled: '❌',
}

const locationEmojis = ['🏖️', '🏔️', '🌆', '🗼', '⛩️', '🏝️', '🌋', '🏰', '🎡', '🌉']

/* ════════════════════════════════════════════════ */
const Trips: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'my-trips' | 'shortlisted'>('my-trips')
  const [myTrips, setMyTrips] = useState<TripItem[]>([])
  const [shortlisted, setShortlisted] = useState<LocationItem[]>([])
  const [loadingTrips, setLoadingTrips] = useState(true)
  const [expandedTrip, setExpandedTrip] = useState<string | null>(null)

  /* ── Load my trips ── */
  useEffect(() => {
    const loadTrips = async () => {
      setLoadingTrips(true)
      try {
        const res = await api.get('/trips/me')
        const backendTrips = (res.data as any[]).map((t) => ({
          id: t.id,
          fromPlace: '',
          toPlace: t.locationId || '',
          startDate: t.startDate,
          endDate: t.endDate,
          travelMode: '',
          budget: '',
          currency: 'USD',
          interests: '',
          description: '',
          status: t.status?.toLowerCase() || 'planned',
        })) as TripItem[]
        const local: TripItem[] = JSON.parse(localStorage.getItem(LS_TRIPS_KEY) || '[]')
        const ids = new Set(backendTrips.map((t) => t.id))
        const merged = [...backendTrips, ...local.filter((t) => !ids.has(t.id))]
        setMyTrips(merged)
      } catch {
        const local: TripItem[] = JSON.parse(localStorage.getItem(LS_TRIPS_KEY) || '[]')
        setMyTrips(local)
      } finally {
        setLoadingTrips(false)
      }
    }
    loadTrips()
  }, [])

  /* ── Load shortlisted from localStorage ── */
  useEffect(() => {
    const saved: LocationItem[] = JSON.parse(localStorage.getItem(LS_SHORTLIST_KEY) || '[]')
    setShortlisted(saved)
  }, [])

  /* ── Remove trip ── */
  const removeTrip = (id: string) => {
    setMyTrips((prev) => {
      const next = prev.filter((t) => t.id !== id)
      localStorage.setItem(LS_TRIPS_KEY, JSON.stringify(next))
      return next
    })
  }

  /* ── Remove from shortlist ── */
  const removeShortlist = (id: string) => {
    setShortlisted((prev) => {
      const next = prev.filter((s) => s.id !== id)
      localStorage.setItem(LS_SHORTLIST_KEY, JSON.stringify(next))
      return next
    })
  }

  /* ── Tab config ── */
  const tabs = [
    { key: 'my-trips' as const, label: 'My Trips', emoji: '💎', count: myTrips.length },
    { key: 'shortlisted' as const, label: 'Shortlisted', emoji: '⭐', count: shortlisted.length },
  ]

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">

      {/* ── Page Header ── */}
      <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 pt-8 pb-16 px-4 md:px-8 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-12 -left-12 w-44 h-44 bg-white/10 rounded-full blur-2xl" />

        <div className="max-w-6xl mx-auto relative">
          <motion.div {...fadeUp(0)}>
            <div className="flex items-start justify-between">
              <div>
                <Link to="/dashboard" className="inline-flex items-center gap-2 text-indigo-200 hover:text-white text-sm font-medium mb-4 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                  Back to Dashboard
                </Link>
                <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">Trips</h1>
                <p className="mt-2 text-indigo-200 text-sm md:text-base max-w-lg">Manage your trips and view shortlisted destinations.</p>
              </div>

              {/* Explore Trips button — same position as Landing & Dashboard */}
              <Link
                to="/explore"
                className="bg-white text-indigo-600 px-5 py-2.5 rounded-full shadow-lg hover:bg-indigo-50 hover:shadow-xl transition-all text-sm font-semibold tracking-wide shrink-0 mt-2"
              >
                🌍 Explore Trips
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 -mt-8">
        <motion.div {...fadeUp(0.1)} className="flex gap-2 bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200/60 p-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
                activeTab === tab.key
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <span>{tab.emoji}</span>
              {tab.label}
              <span className={`ml-1 text-xs px-2 py-0.5 rounded-full font-bold ${
                activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </motion.div>
      </div>

      {/* ── Content ── */}
      <main className="max-w-6xl mx-auto px-4 md:px-8 py-8">
        <AnimatePresence mode="wait">

          {/* ═══════ MY TRIPS TAB ═══════ */}
          {activeTab === 'my-trips' && (
            <motion.div
              key="my-trips"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
            >
              {loadingTrips ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                </div>
              ) : myTrips.length === 0 ? (
                <motion.div {...fadeUp(0.1)} className="text-center py-20">
                  <span className="text-6xl mb-4 block">🧳</span>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">No trips yet</h3>
                  <p className="text-gray-500 mb-6 max-w-md mx-auto">Create your first trip from the Dashboard or explore destinations to get started.</p>
                  <div className="flex gap-3 justify-center">
                    <Link
                      to="/dashboard"
                      state={{ openTripForm: true }}
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-6 py-3 rounded-2xl font-semibold shadow-md hover:shadow-lg transition-all"
                    >
                      <span className="text-lg">+</span> Create a Trip
                    </Link>
                    <Link
                      to="/explore"
                      className="inline-flex items-center gap-2 bg-white border border-indigo-200 text-indigo-600 px-6 py-3 rounded-2xl font-semibold shadow-md hover:shadow-lg hover:bg-indigo-50 transition-all"
                    >
                      🌍 Explore
                    </Link>
                  </div>
                </motion.div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {myTrips.map((trip, i) => (
                    <motion.div
                      key={trip.id}
                      {...fadeUp(0.05 * i)}
                      layout
                      className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-md border border-gray-200/60 overflow-hidden hover:shadow-lg transition-shadow"
                    >
                      <div className="h-2 bg-gradient-to-r from-indigo-500 to-violet-500" />

                      <div className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-lg shrink-0">
                              {trip.travelMode === 'Flight' ? '✈️' : trip.travelMode === 'Train' ? '🚆' : trip.travelMode === 'Car' ? '🚗' : trip.travelMode === 'Ship' ? '🚢' : '🧳'}
                            </span>
                            <div className="min-w-0">
                              <h4 className="font-bold text-gray-900 truncate">
                                {trip.fromPlace && trip.toPlace
                                  ? `${trip.fromPlace} → ${trip.toPlace}`
                                  : trip.toPlace || trip.fromPlace || 'Untitled Trip'}
                              </h4>
                              <p className="text-xs text-gray-500">
                                {trip.startDate && trip.endDate
                                  ? `${trip.startDate} — ${trip.endDate}`
                                  : trip.startDate || 'No dates set'}
                              </p>
                            </div>
                          </div>
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0 ${statusColors[trip.status] || statusColors.planned}`}>
                            {statusEmoji[trip.status]} {trip.status.charAt(0).toUpperCase() + trip.status.slice(1)}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-3">
                          {trip.travelMode && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg">🚀 {trip.travelMode}</span>
                          )}
                          {trip.budget && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg">💰 {trip.currency} {trip.budget}</span>
                          )}
                          {trip.interests && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg">🎯 {trip.interests}</span>
                          )}
                        </div>

                        {trip.description && (
                          <>
                            <button
                              onClick={() => setExpandedTrip(expandedTrip === trip.id ? null : trip.id)}
                              className="text-xs text-indigo-600 font-semibold hover:text-indigo-800 transition mb-2"
                            >
                              {expandedTrip === trip.id ? 'Hide details ▲' : 'Show details ▼'}
                            </button>
                            <AnimatePresence>
                              {expandedTrip === trip.id && (
                                <motion.p
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="text-sm text-gray-600 leading-relaxed overflow-hidden"
                                >
                                  {trip.description}
                                </motion.p>
                              )}
                            </AnimatePresence>
                          </>
                        )}

                        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                          <button
                            onClick={() => removeTrip(trip.id)}
                            className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition font-medium"
                          >
                            Remove
                          </button>
                          <span className="flex-1" />
                          <span className="text-xs text-gray-400">ID: {trip.id.slice(0, 8)}…</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ═══════ SHORTLISTED TAB ═══════ */}
          {activeTab === 'shortlisted' && (
            <motion.div
              key="shortlisted"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
            >
              {shortlisted.length === 0 ? (
                <motion.div {...fadeUp(0.1)} className="text-center py-20">
                  <span className="text-6xl mb-4 block">⭐</span>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">No shortlisted destinations</h3>
                  <p className="text-gray-500 mb-6 max-w-md mx-auto">Browse the Explore page and shortlist destinations you are interested in.</p>
                  <Link
                    to="/explore"
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-3 rounded-2xl font-semibold shadow-md hover:shadow-lg transition-all"
                  >
                    🌍 Explore Destinations
                  </Link>
                </motion.div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {shortlisted.map((loc, i) => (
                    <motion.div
                      key={loc.id}
                      {...fadeUp(0.05 * i)}
                      layout
                      className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-md border border-amber-200/60 overflow-hidden hover:shadow-lg transition-shadow group"
                    >
                      <div className="h-2 bg-gradient-to-r from-amber-400 to-orange-400" />

                      <div className="p-5">
                        <div className="flex items-start gap-3 mb-3">
                          <span className="w-11 h-11 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center text-xl shrink-0">
                            {locationEmojis[i % locationEmojis.length]}
                          </span>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-gray-900 truncate">{loc.name}</h4>
                            <p className="text-xs text-gray-500 mt-0.5">
                              📍 {loc.latitude.toFixed(2)}°, {loc.longitude.toFixed(2)}°
                            </p>
                          </div>
                          <span className="text-amber-400 text-xl shrink-0">⭐</span>
                        </div>

                        {loc.description && (
                          <p className="text-sm text-gray-600 leading-relaxed mb-4 line-clamp-2">{loc.description}</p>
                        )}

                        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                          <button
                            onClick={() => removeShortlist(loc.id)}
                            className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition font-medium"
                          >
                            Remove
                          </button>
                          <span className="flex-1" />
                          <Link
                            to="/dashboard"
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition"
                          >
                            Plan a trip →
                          </Link>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  )
}

export default Trips
