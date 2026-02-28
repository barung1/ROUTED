import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../api/client'

/* ── types ── */
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

const LS_SHORTLIST_KEY = 'routed_shortlisted'
const locationEmojis = ['🏖️', '🏔️', '🌆', '🗼', '⛩️', '🏝️', '🌋', '🏰', '🎡', '🌉']

/* ════════════════════════════════════════════════ */
const Explore: React.FC = () => {
  const [locations, setLocations] = useState<LocationItem[]>([])
  const [shortlisted, setShortlisted] = useState<LocationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAuthModal, setShowAuthModal] = useState(false)
  const navigate = useNavigate()

  const isLoggedIn = () => !!localStorage.getItem('routed_token')

  /* ── Auth-gated action helper ── */
  const requireAuth = (action: () => void) => {
    if (!isLoggedIn()) {
      setShowAuthModal(true)
    } else {
      action()
    }
  }

  /* ── Load locations from API ── */
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await api.get('/locations/')
        setLocations(res.data as LocationItem[])
      } catch {
        // fallback sample data when backend unavailable
        setLocations([
          { id: 'sample-1', name: 'Paris, France', description: 'The city of lights — art, culture, and gourmet food.', latitude: 48.8566, longitude: 2.3522, tags: [] },
          { id: 'sample-2', name: 'Tokyo, Japan', description: 'A vibrant mix of tradition and futuristic innovation.', latitude: 35.6762, longitude: 139.6503, tags: [] },
          { id: 'sample-3', name: 'Cape Town, South Africa', description: 'Stunning landscapes and incredible wildlife.', latitude: -33.9249, longitude: 18.4241, tags: [] },
          { id: 'sample-4', name: 'Bali, Indonesia', description: 'Tropical paradise with temples and rice terraces.', latitude: -8.3405, longitude: 115.092, tags: [] },
          { id: 'sample-5', name: 'New York, USA', description: 'The city that never sleeps — food, culture, skyline.', latitude: 40.7128, longitude: -74.006, tags: [] },
          { id: 'sample-6', name: 'Barcelona, Spain', description: 'Gaudí architecture, beaches, and tapas.', latitude: 41.3874, longitude: 2.1686, tags: [] },
        ])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  /* ── Load shortlisted from localStorage (only when logged in) ── */
  useEffect(() => {
    if (isLoggedIn()) {
      const saved: LocationItem[] = JSON.parse(localStorage.getItem(LS_SHORTLIST_KEY) || '[]')
      setShortlisted(saved)
    } else {
      setShortlisted([])
    }
  }, [])

  /* ── Shortlist helpers ── */
  const isShortlisted = useCallback(
    (id: string) => shortlisted.some((s) => s.id === id),
    [shortlisted],
  )

  const toggleShortlist = (loc: LocationItem) => {
    setShortlisted((prev) => {
      const exists = prev.some((s) => s.id === loc.id)
      const next = exists ? prev.filter((s) => s.id !== loc.id) : [...prev, loc]
      localStorage.setItem(LS_SHORTLIST_KEY, JSON.stringify(next))
      return next
    })
  }

  /* ── Filter by search ── */
  const filtered = searchQuery.trim()
    ? locations.filter(
        (l) =>
          l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          l.description?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : locations

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">

      {/* ── Hero header ── */}
      <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 pt-8 pb-20 px-4 md:px-8 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-12 -left-12 w-44 h-44 bg-white/10 rounded-full blur-2xl" />

        <div className="max-w-6xl mx-auto relative">
          <motion.div {...fadeUp(0)}>
            <Link to="/dashboard" className="inline-flex items-center gap-2 text-indigo-200 hover:text-white text-sm font-medium mb-4 transition">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              Back to Dashboard
            </Link>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">🌍 Explore Trips</h1>
            <p className="mt-2 text-indigo-200 text-sm md:text-base max-w-lg">
              Discover amazing destinations around the world. Shortlist the ones you love and plan your next adventure.
            </p>
          </motion.div>
        </div>
      </div>

      {/* ── Search bar (overlapping hero) ── */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 -mt-8">
        <motion.div {...fadeUp(0.1)} className="bg-white/90 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200/60 p-4 flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search destinations by name or description…"
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-xs text-gray-400 hover:text-gray-600 transition">
              Clear
            </button>
          )}
          <div className="text-xs text-gray-400 shrink-0">
            {filtered.length} destination{filtered.length !== 1 ? 's' : ''}
          </div>
        </motion.div>
      </div>

      {/* ── Stats bar ── */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 mt-4">
        <motion.div {...fadeUp(0.15)} className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">
            📍 {locations.length} total destinations
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
            ⭐ {shortlisted.length} shortlisted
          </span>
          <span className="flex-1" />
          <Link
            to="/trips"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
          >
            View My Trips →
          </Link>
        </motion.div>
      </div>

      {/* ── Content ── */}
      <main className="max-w-6xl mx-auto px-4 md:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <motion.div {...fadeUp(0.1)} className="text-center py-20">
            <span className="text-6xl mb-4 block">🔍</span>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {searchQuery ? 'No matching destinations' : 'No destinations found'}
            </h3>
            <p className="text-gray-500 max-w-md mx-auto">
              {searchQuery
                ? `Nothing matches "${searchQuery}". Try a different search term.`
                : 'Destinations will appear here once they are added to the system.'}
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((loc, i) => {
              const saved = isShortlisted(loc.id)
              return (
                <motion.div
                  key={loc.id}
                  {...fadeUp(0.04 * Math.min(i, 8))}
                  whileHover={{ y: -4 }}
                  className={`bg-white/80 backdrop-blur-sm rounded-2xl shadow-md border overflow-hidden transition-all group ${
                    saved ? 'border-amber-300 ring-2 ring-amber-200' : 'border-gray-200/60 hover:border-indigo-300'
                  }`}
                >
                  {/* Gradient strip */}
                  <div className={`h-2 ${saved ? 'bg-gradient-to-r from-amber-400 to-orange-400' : 'bg-gradient-to-r from-indigo-400 to-violet-400'}`} />

                  <div className="p-5">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-2xl shrink-0 shadow-sm group-hover:shadow-md transition">
                        {locationEmojis[i % locationEmojis.length]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-gray-900 truncate text-base">{loc.name}</h4>
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                          <span>📍</span> {loc.latitude.toFixed(2)}°, {loc.longitude.toFixed(2)}°
                        </p>
                      </div>
                      {saved && <span className="text-amber-400 text-lg shrink-0 animate-pulse">⭐</span>}
                    </div>

                    {loc.description && (
                      <p className="text-sm text-gray-600 leading-relaxed mb-4 line-clamp-3">{loc.description}</p>
                    )}

                    <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => requireAuth(() => toggleShortlist(loc))}
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition ${
                          saved
                            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-indigo-100 hover:text-indigo-700'
                        }`}
                      >
                        {saved ? '⭐ Shortlisted' : '☆ Shortlist'}
                      </motion.button>
                      <span className="flex-1" />
                      <button
                        onClick={() => requireAuth(() => navigate('/dashboard', { state: { openTripForm: true } }))}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition"
                      >
                        Plan a trip →
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </main>

      {/* ── Auth Gate Modal ── */}
      <AnimatePresence>
        {showAuthModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowAuthModal(false)}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center z-10"
            >
              {/* Close button */}
              <button
                onClick={() => setShowAuthModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
              </button>

              <span className="text-5xl mb-4 block">🔒</span>
              <h3 className="text-2xl font-extrabold text-gray-900 mb-2">Join the Adventure!</h3>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                Sign in or create an account to shortlist destinations, plan trips, and get the full Routed experience.
              </p>

              <div className="flex flex-col gap-3">
                <Link
                  to="/login"
                  className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-6 py-3 rounded-2xl font-semibold shadow-md hover:shadow-lg transition-all"
                >
                  ✨ Sign In
                </Link>
                <Link
                  to="/signup"
                  className="w-full inline-flex items-center justify-center gap-2 bg-white border-2 border-indigo-200 text-indigo-600 px-6 py-3 rounded-2xl font-semibold hover:bg-indigo-50 hover:border-indigo-300 transition-all"
                >
                  🚀 Create Account
                </Link>
              </div>

              <button
                onClick={() => setShowAuthModal(false)}
                className="mt-4 text-xs text-gray-400 hover:text-gray-600 transition"
              >
                Maybe later
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Explore
