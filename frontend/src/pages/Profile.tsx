import React, { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import logo from '../assets/logo.png'
import api from '../api/client'
import './profile.css'

/* ── helpers ── */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
})

const INTEREST_OPTIONS = [
  { label: 'Hiking & Trekking', description: 'Trails, mountain peaks, and nature walks.' },
  { label: 'Camping & Glamping', description: 'National parks, backcountry sites, and luxury outdoor stays.' },
  { label: 'Water Sports', description: 'Surfing, kayaking, scuba diving, and snorkeling.' },
  { label: 'Winter Sports', description: 'Skiing, snowboarding, and snowshoeing.' },
  { label: 'Adrenaline', description: 'Skydiving, bungee jumping, and rock climbing.' },
  { label: 'Local Cuisine', description: 'Authentic street food and regional specialties.' },
  { label: 'Fine Dining', description: 'Michelin-star restaurants and upscale eateries.' },
  { label: 'Food Tours', description: 'Guided culinary walks and market visits.' },
  { label: 'Café Culture', description: 'Best spots for coffee, brunch, and remote work.' },
  { label: 'Nightlife', description: 'Bars, clubs, and live music venues.' },
  { label: 'Museums & Art', description: 'Galleries, historical exhibits, and installations.' },
  { label: 'History & Heritage', description: 'Ancient ruins, landmarks, and architecture.' },
  { label: 'Local Festivals', description: 'Seasonal events, carnivals, and cultural celebrations.' },
  { label: 'Photography', description: '"Instagrammable" spots and scenic viewpoints.' },
  { label: 'Solo Travel', description: 'Safe, social, and easy-to-navigate destinations.' },
  { label: 'Family Friendly', description: 'Activities for kids and strollers.' },
  { label: 'Luxury', description: '5-star resorts, private villas, and concierge services.' },
  { label: 'Budget & Backpacking', description: 'Hostels, free attractions, and cheap eats.' },
  { label: 'Eco-Friendly', description: 'Sustainable stays and conservation-focused tours.' },
  { label: 'Wellness', description: 'Spas, yoga retreats, and meditation centers.' },
  { label: 'Road Trips', description: 'Scenic drives and car-friendly stops.' },
  { label: 'Pet-Friendly', description: 'Parks and hotels that allow animals.' },
  { label: 'Off the Beaten Path', description: 'Hidden gems and less crowded areas.' },
  { label: 'Beaches & Islands', description: 'Coastal escapes, island hopping, and beach stays.' },
  { label: 'Wildlife & Safari', description: 'National reserves, safaris, and animal encounters.' },
  { label: 'Digital Nomad', description: 'Coworking-friendly places with strong Wi-Fi and long stays.' },
  { label: 'Shopping', description: 'Local markets, artisan stores, and premium shopping districts.' },
  { label: 'Religious & Spiritual', description: 'Temples, churches, mosques, monasteries, and spiritual retreats.' },
  { label: 'Cruises', description: 'Ocean and river cruises with multi-stop itineraries.' },
  { label: 'Theme Parks', description: 'Amusement parks, water parks, and entertainment resorts.' },
  { label: 'Volunteer Travel', description: 'Community projects, conservation, and impact-focused travel.' },
  { label: 'Language & Learning', description: 'Language immersion, workshops, and educational experiences.' },
  { label: 'Medical & Wellness Travel', description: 'Health checkups, recovery stays, and holistic care trips.' },
]

/* ════════════════════════════════════════════════ */
type ProfileState = {
  username: string
  email: string
  location: string
  dateOfBirth: string
  bio: string
  interests: string[]
  profilePicture: string
  memberSince: Date
  tripsCount: number
  destinationsVisited: number
}

type EditableField = 'username' | 'email' | 'location' | 'dateOfBirth' | 'bio' | 'interests'

const toDateInputValue = (dateValue: string | null | undefined): string => {
  if (!dateValue) return ''
  return dateValue.slice(0, 10)
}

const toDisplayDate = (dateValue: string | null | undefined, fallback: Date): Date => {
  if (!dateValue) return fallback
  return new Date(`${dateValue.slice(0, 10)}T00:00:00`)
}

const Profile: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const settingsRef = useRef<HTMLDivElement>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Profile state - will be fetched from backend
  const [profile, setProfile] = useState<ProfileState>({
    username: 'JohnDoe',
    email: 'john.doe@example.com',
    location: '',
    dateOfBirth: '',
    bio: '',
    interests: [] as string[],
    profilePicture: '', // URL or base64
    memberSince: new Date(2024, 0, 15), // January 15, 2024
    tripsCount: 5,
    destinationsVisited: 12,
  })
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [requestError, setRequestError] = useState('')
  const [savingField, setSavingField] = useState<EditableField | null>(null)

  // Edit mode states
  const [isEditingUsername, setIsEditingUsername] = useState(false)
  const [isEditingEmail, setIsEditingEmail] = useState(false)
  const [isEditingLocation, setIsEditingLocation] = useState(false)
  const [isEditingDateOfBirth, setIsEditingDateOfBirth] = useState(false)
  const [isEditingBio, setIsEditingBio] = useState(false)
  const [isEditingInterests, setIsEditingInterests] = useState(false)
  const [interestSearch, setInterestSearch] = useState('')
  const [showInterestDropdown, setShowInterestDropdown] = useState(false)
  const [showProfilePictureMenu, setShowProfilePictureMenu] = useState(false)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  /* close settings dropdown on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const fetchProfile = async () => {
      setRequestError('')
      setLoadingProfile(true)

      try {
        const response = await api.get('/users/me')
        const data = response.data

        setProfile((prev) => ({
          ...prev,
          username: data.username ?? prev.username,
          email: data.email ?? prev.email,
          location: data.location ?? '',
          dateOfBirth: toDateInputValue(data.dateOfBirth),
          bio: data.bio ?? '',
          interests: Array.isArray(data.interests) ? data.interests : [],
          memberSince: toDisplayDate(data.memberSince, prev.memberSince),
          tripsCount: typeof data.tripsCount === 'number' ? data.tripsCount : 0,
          destinationsVisited: typeof data.tripsCount === 'number' ? data.tripsCount : prev.destinationsVisited,
        }))

        try {
          const existingUser = localStorage.getItem('routed_user')
          const parsedUser = existingUser ? JSON.parse(existingUser) : {}
          localStorage.setItem(
            'routed_user',
            JSON.stringify({
              ...parsedUser,
              username: data.username,
              email: data.email,
              location: data.location,
              dateOfBirth: data.dateOfBirth,
            })
          )
        } catch {
          // ignore storage parsing issues
        }
      } catch (err) {
        const status = (err as any)?.response?.status
        if (status === 401) {
          localStorage.removeItem('routed_token')
          localStorage.removeItem('routed_user')
          navigate('/login')
          return
        }
        const message = (err as any)?.response?.data?.detail || 'Unable to load profile. Please try again.'
        setRequestError(message)
      } finally {
        setLoadingProfile(false)
      }
    }

    fetchProfile()
  }, [navigate])

  const handleLogout = () => {
    localStorage.removeItem('routed_token')
    localStorage.removeItem('routed_shortlisted')
    localStorage.removeItem('routed_my_trips')
    navigate('/')
  }

  const handleProfilePictureClick = () => {
    setShowProfilePictureMenu(true)
  }

  const handleGallerySelect = () => {
    fileInputRef.current?.click()
    setShowProfilePictureMenu(false)
  }

  const handleCameraCapture = () => {
    cameraInputRef.current?.click()
    setShowProfilePictureMenu(false)
  }

  const handleRemoveProfilePicture = () => {
    setProfile((prev) => ({ ...prev, profilePicture: '' }))
    setShowProfilePictureMenu(false)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        console.log('File loaded successfully')
        setProfile((prev) => ({ ...prev, profilePicture: reader.result as string }))
      }
      reader.onerror = () => {
        console.error('Error reading file')
      }
      reader.readAsDataURL(file)
      console.log('Reading file:', file.name)
    }
  }

  const handleFieldChange = (field: string, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }))
  }

  const addInterest = (interest: string) => {
    const cleanedInterest = interest.trim()
    if (!cleanedInterest) return
    setProfile((prev) => {
      if (prev.interests.includes(cleanedInterest)) return prev
      return { ...prev, interests: [...prev.interests, cleanedInterest] }
    })
    setInterestSearch('')
  }

  const removeInterest = (interest: string) => {
    setProfile((prev) => ({ ...prev, interests: prev.interests.filter((item) => item !== interest) }))
  }

  const filteredInterestOptions = INTEREST_OPTIONS.filter((option) => {
    const search = interestSearch.toLowerCase().trim()
    const matches = !search || option.label.toLowerCase().includes(search) || option.description.toLowerCase().includes(search)
    return matches && !profile.interests.includes(option.label)
  })

  const handleSave = async (field: EditableField) => {
    setRequestError('')
    setSavingField(field)

    const payload: Record<string, unknown> = {}
    switch (field) {
      case 'username':
        payload.username = profile.username.trim()
        break
      case 'email':
        payload.email = profile.email.trim()
        break
      case 'location':
        payload.location = profile.location.trim() || null
        break
      case 'dateOfBirth':
        payload.dateOfBirth = profile.dateOfBirth || null
        break
      case 'bio':
        payload.bio = profile.bio.trim() || null
        break
      case 'interests':
        payload.interests = profile.interests
        break
    }

    try {
      const response = await api.put('/users/me', payload)
      const updatedUser = response.data

      setProfile((prev) => ({
        ...prev,
        username: updatedUser.username ?? prev.username,
        email: updatedUser.email ?? prev.email,
        location: updatedUser.location ?? '',
        dateOfBirth: toDateInputValue(updatedUser.dateOfBirth),
        bio: updatedUser.bio ?? '',
        interests: Array.isArray(updatedUser.interests) ? updatedUser.interests : prev.interests,
      }))

      try {
        const existingUser = localStorage.getItem('routed_user')
        const parsedUser = existingUser ? JSON.parse(existingUser) : {}
        localStorage.setItem(
          'routed_user',
          JSON.stringify({
            ...parsedUser,
            username: updatedUser.username,
            email: updatedUser.email,
            location: updatedUser.location,
            dateOfBirth: updatedUser.dateOfBirth,
          })
        )
      } catch {
        // ignore storage parsing issues
      }

      switch (field) {
        case 'username':
          setIsEditingUsername(false)
          break
        case 'email':
          setIsEditingEmail(false)
          break
        case 'location':
          setIsEditingLocation(false)
          break
        case 'dateOfBirth':
          setIsEditingDateOfBirth(false)
          break
        case 'bio':
          setIsEditingBio(false)
          break
        case 'interests':
          setIsEditingInterests(false)
          break
      }
    } catch (err) {
      const message = (err as any)?.response?.data?.detail || `Failed to save ${field}. Please try again.`
      setRequestError(message)
    } finally {
      setSavingField(null)
    }
  }

  if (loadingProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-gray-600 text-lg font-medium">Loading profile...</div>
      </div>
    )
  }

  /* ── render ── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      {requestError && (
        <div className="max-w-4xl mx-auto px-4 md:px-8 pt-4">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{requestError}</div>
        </div>
      )}
      
      {/* ═══════════ HEADER ═══════════ */}
      <header className="w-full sticky top-0 z-30 backdrop-blur-md bg-white/80 border-b border-gray-200/60">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center h-16 justify-between">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2 shrink-0" aria-label="Routed home">
            <img src={logo} alt="Routed logo" className="h-35 w-auto object-contain" />
          </Link>

          {/* Right actions — Settings gear with dropdown */}
          <div ref={settingsRef} className="relative">
            <motion.button
              type="button"
              whileHover={{ rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              onClick={() => setSettingsOpen((p) => !p)}
              className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
                settingsOpen
                  ? 'bg-white text-indigo-600 ring-2 ring-indigo-300'
                  : 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white'
              }`}
              aria-label="Settings"
              title="Settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </motion.button>

            {/* Settings dropdown */}
            <AnimatePresence>
              {settingsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-200/60 py-2 z-50"
                >
                  <Link
                    to="/dashboard"
                    onClick={() => setSettingsOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition rounded-lg mx-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    Dashboard
                  </Link>
                  <Link
                    to="/trips"
                    onClick={() => setSettingsOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition rounded-lg mx-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                    My Trips
                  </Link>
                  <Link
                    to="/explore"
                    onClick={() => setSettingsOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition rounded-lg mx-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
                    Explore
                  </Link>
                  <hr className="my-1.5 border-gray-100" />
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition rounded-lg mx-1 text-left"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Logout
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* ── Back to Dashboard ── */}
      <div className="max-w-4xl mx-auto px-4 md:px-8 pt-4">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 text-sm font-medium transition">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          Back to Dashboard
        </Link>
      </div>

      {/* ═══════════ MAIN ═══════════ */}
      <main className="max-w-4xl mx-auto px-4 md:px-8 py-8">
        
        {/* ── Profile Card ── */}
        <motion.div {...fadeUp(0)} className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          
          {/* Header Banner */}
          <div className="h-32 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 relative">
            <div className="absolute -bottom-16 left-8">
              <div className="relative group">
                {/* Profile Picture */}
                <div className="w-32 h-32 rounded-full border-4 border-white bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg flex items-center justify-center overflow-hidden">
                  {profile.profilePicture ? (
                    <img src={profile.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v1.2c0 .7.5 1.2 1.2 1.2h16.8c.7 0 1.2-.5 1.2-1.2v-1.2c0-3.2-6.4-4.8-9.6-4.8z"/>
                    </svg>
                  )}
                </div>
                
                {/* Edit Icon on Profile Picture */}
                <button
                  onClick={handleProfilePictureClick}
                  className="absolute bottom-1 right-1 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-indigo-600 hover:bg-indigo-50 transition-all hover:scale-110 active:scale-95 group-hover:ring-2 group-hover:ring-indigo-300"
                  aria-label="Edit profile picture"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>

                {/* Profile Picture Menu */}
                {showProfilePictureMenu && (
                  <div className="absolute bottom-12 right-0 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50 min-w-max">
                    <button
                      onClick={handleGallerySelect}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition text-left"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                      </svg>
                      Choose from Gallery
                    </button>
                    <button
                      onClick={handleCameraCapture}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition text-left"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 7 16 12 23 17 23 7"/>
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                      </svg>
                      Take a Photo
                    </button>
                    {profile.profilePicture && (
                      <>
                        <hr className="my-1.5 border-gray-100" />
                        <button
                          onClick={handleRemoveProfilePicture}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition text-left"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            <line x1="10" y1="11" x2="10" y2="17"/>
                            <line x1="14" y1="11" x2="14" y2="17"/>
                          </svg>
                          Remove Picture
                        </button>
                      </>
                    )}
                  </div>
                )}
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>

            {/* Travel Stats Section */}
            <div className="absolute inset-y-0 right-8 flex items-center gap-8">
              <div className="text-white text-center">
                <div className="text-3xl font-bold">{profile.tripsCount}</div>
                <div className="text-sm text-indigo-100">Trips</div>
              </div>
              <div className="h-12 w-px bg-white/30"></div>
              <div className="text-white text-center">
                <div className="text-xs text-indigo-100">Member Since</div>
                <div className="text-sm font-semibold">{profile.memberSince.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
              </div>
            </div>
          </div>

          {/* Profile Content */}
          <div className="pt-20 px-8 pb-8 text-left">
            
            {/* Username Field */}
            <div className="mb-6">
              <label className="block text-lg font-bold text-gray-700 mb-2 text-left profile-label-username">Username</label>
              <div className="flex items-center gap-3">
                {isEditingUsername ? (
                  <>
                    <input
                      type="text"
                      value={profile.username}
                      onChange={(e) => handleFieldChange('username', e.target.value)}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-base font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSave('username')}
                      disabled={savingField === 'username'}
                      className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-medium"
                    >
                      {savingField === 'username' ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setIsEditingUsername(false)}
                      className="px-4 py-2.5 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all font-medium"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 px-4 py-3 bg-gray-50 rounded-xl text-gray-800 text-base text-left profile-value-username">
                      {profile.username}
                    </div>
                    <button
                      onClick={() => setIsEditingUsername(true)}
                      className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl hover:bg-indigo-200 transition-all flex items-center justify-center"
                      aria-label="Edit username"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Email Field */}
            <div className="mb-6">
              <label className="block text-lg font-bold text-gray-700 mb-2 text-left profile-label-email">Email</label>
              <div className="flex items-center gap-3">
                {isEditingEmail ? (
                  <>
                    <input
                      type="email"
                      value={profile.email}
                      onChange={(e) => handleFieldChange('email', e.target.value)}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-base font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSave('email')}
                      disabled={savingField === 'email'}
                      className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-medium"
                    >
                      {savingField === 'email' ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setIsEditingEmail(false)}
                      className="px-4 py-2.5 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all font-medium"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 px-4 py-3 bg-gray-50 rounded-xl text-gray-800 text-base text-left profile-value-email">
                      {profile.email}
                    </div>
                    <button
                      onClick={() => setIsEditingEmail(true)}
                      className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl hover:bg-indigo-200 transition-all flex items-center justify-center"
                      aria-label="Edit email"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Location Field */}
            <div className="mb-6">
              <label className="block text-lg font-bold text-gray-700 mb-2 text-left profile-label-location">Location</label>
              <div className="flex items-center gap-3">
                {isEditingLocation ? (
                  <>
                    <input
                      type="text"
                      value={profile.location}
                      onChange={(e) => handleFieldChange('location', e.target.value)}
                      placeholder="Enter your location"
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-base font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSave('location')}
                      disabled={savingField === 'location'}
                      className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-medium"
                    >
                      {savingField === 'location' ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setIsEditingLocation(false)}
                      className="px-4 py-2.5 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all font-medium"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 px-4 py-3 bg-gray-50 rounded-xl text-gray-800 text-base text-left profile-value-location">
                      {profile.location || "Where in the world are you from?"}
                    </div>
                    <button
                      onClick={() => setIsEditingLocation(true)}
                      className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl hover:bg-indigo-200 transition-all flex items-center justify-center"
                      aria-label="Edit location"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Date of Birth Field */}
            <div className="mb-6">
              <label className="block text-lg font-bold text-gray-700 mb-2 text-left profile-label-location">Date of Birth</label>
              <div className="flex items-center gap-3">
                {isEditingDateOfBirth ? (
                  <>
                    <input
                      type="date"
                      value={profile.dateOfBirth}
                      onChange={(e) => handleFieldChange('dateOfBirth', e.target.value)}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-base font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSave('dateOfBirth')}
                      disabled={savingField === 'dateOfBirth'}
                      className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-medium"
                    >
                      {savingField === 'dateOfBirth' ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setIsEditingDateOfBirth(false)}
                      className="px-4 py-2.5 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all font-medium"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 px-4 py-3 bg-gray-50 rounded-xl text-gray-800 text-base text-left profile-value-location">
                      {profile.dateOfBirth
                        ? new Date(profile.dateOfBirth + 'T00:00:00').toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })
                        : "What's your birthday?"}
                    </div>
                    <button
                      onClick={() => setIsEditingDateOfBirth(true)}
                      className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl hover:bg-indigo-200 transition-all flex items-center justify-center"
                      aria-label="Edit date of birth"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Interests Field */}
            <div className="mb-6">
              <label className="block text-lg font-bold text-gray-700 mb-2 text-left profile-label-interests">Interests</label>
              <div className="flex items-start gap-3">
                {isEditingInterests ? (
                  <>
                    <div className="flex-1">
                      <div className="mb-3 flex flex-wrap gap-2">
                        {profile.interests.length === 0 ? (
                          <p className="text-sm text-gray-500">No interests selected yet.</p>
                        ) : (
                          profile.interests.map((interest) => (
                            <span key={interest} className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-800 text-sm font-semibold px-3 py-1.5 rounded-full">
                              {interest}
                              <button
                                type="button"
                                onClick={() => removeInterest(interest)}
                                className="text-indigo-600 hover:text-indigo-900"
                                aria-label={`Remove ${interest}`}
                              >
                                ×
                              </button>
                            </span>
                          ))
                        )}
                      </div>

                      <div className="relative">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={interestSearch}
                            onChange={(e) => {
                              setInterestSearch(e.target.value)
                              setShowInterestDropdown(true)
                            }}
                            onFocus={() => setShowInterestDropdown(true)}
                            onBlur={() => setTimeout(() => setShowInterestDropdown(false), 120)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                addInterest(interestSearch)
                              }
                            }}
                            placeholder="Search interests or type your own"
                            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-base font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => addInterest(interestSearch)}
                            className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-medium"
                          >
                            Add
                          </button>
                        </div>

                        {showInterestDropdown && filteredInterestOptions.length > 0 && (
                          <div className="absolute z-20 mt-2 w-full max-h-64 overflow-auto bg-white border border-gray-200 rounded-xl shadow-lg">
                            {filteredInterestOptions.map((option) => (
                              <button
                                key={option.label}
                                type="button"
                                onClick={() => addInterest(option.label)}
                                className="w-full text-left px-4 py-3 hover:bg-indigo-50 border-b border-gray-100 last:border-b-0"
                              >
                                <p className="text-sm font-semibold text-gray-800">{option.label}</p>
                                <p className="text-xs text-gray-500">{option.description}</p>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <p className="mt-2 text-xs text-gray-500">Pick from the dropdown or type and add your own interest.</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleSave('interests')}
                        disabled={savingField === 'interests'}
                        className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-medium"
                      >
                        {savingField === 'interests' ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setIsEditingInterests(false)}
                        className="px-4 py-2.5 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex-1 px-4 py-3 bg-gray-50 rounded-xl text-gray-800 text-base text-left profile-value-interests">
                      {profile.interests.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {profile.interests.map((interest) => (
                            <span key={interest} className="bg-indigo-100 text-indigo-800 text-sm font-semibold px-3 py-1.5 rounded-full">
                              {interest}
                            </span>
                          ))}
                        </div>
                      ) : (
                        "What makes your heart race when traveling?"
                      )}
                    </div>
                    <button
                      onClick={() => setIsEditingInterests(true)}
                      className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl hover:bg-indigo-200 transition-all flex items-center justify-center shrink-0"
                      aria-label="Edit interests"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Bio Field */}
            <div className="mb-6">
              <label className="block text-lg font-bold text-gray-700 mb-2 text-left profile-label-bio">Bio</label>
              <div className="flex items-start gap-3">
                {isEditingBio ? (
                  <>
                    <textarea
                      value={profile.bio}
                      onChange={(e) => handleFieldChange('bio', e.target.value)}
                      rows={4}
                      placeholder="Tell us about yourself..."
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-base font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                      autoFocus
                    />
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleSave('bio')}
                        disabled={savingField === 'bio'}
                        className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-medium"
                      >
                        {savingField === 'bio' ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setIsEditingBio(false)}
                        className="px-4 py-2.5 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex-1 px-4 py-3 bg-gray-50 rounded-xl text-gray-800 text-base min-h-[100px] text-left profile-value-bio">
                      {profile.bio || "Share your travel story. What inspires you to explore?"}
                    </div>
                    <button
                      onClick={() => setIsEditingBio(true)}
                      className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl hover:bg-indigo-200 transition-all flex items-center justify-center shrink-0"
                      aria-label="Edit bio"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>

          </div>
        </motion.div>

      </main>
    </div>
  )
}

export default Profile
