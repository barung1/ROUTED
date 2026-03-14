import React, { useState, useRef, useEffect, useCallback } from 'react'
import api from '../api/client'

export interface PlaceSuggestion {
  place_id: string
  display_name: string
  lat: number
  lon: number
}

interface PlaceAutocompleteProps {
  value: string
  onChange: (place: PlaceSuggestion | null) => void
  onQueryChange?: (query: string) => void
  placeholder?: string
  label?: string
  className?: string
  inputClassName?: string
}

const DEBOUNCE_MS = 300

export const PlaceAutocomplete: React.FC<PlaceAutocompleteProps> = ({
  value,
  onChange,
  onQueryChange,
  placeholder = 'e.g. Toronto, Paris',
  label,
  className = '',
  inputClassName,
}) => {
  const [query, setQuery] = useState(value)
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([])
      return
    }
    setLoading(true)
    try {
      const res = await api.get<PlaceSuggestion[]>('/places/autocomplete', { params: { q } })
      setSuggestions(res.data || [])
      setOpen(true)
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (value !== query) setQuery(value)
  }, [value])

  useEffect(() => {
    const q = query.trim()
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.length < 2) {
      setSuggestions([])
      return
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(q), DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, fetchSuggestions])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const select = (place: PlaceSuggestion) => {
    setQuery(place.display_name)
    onChange(place)
    setOpen(false)
    setSuggestions([])
  }

  const clear = () => {
    setQuery('')
    onChange(null)
    setSuggestions([])
    setOpen(false)
  }

  const baseInputClass = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition'
  const inputClass = inputClassName ? `${baseInputClass} ${inputClassName}` : baseInputClass

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      )}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            const v = e.target.value
            setQuery(v)
            onQueryChange?.(v)
          }}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className={inputClass}
          autoComplete="off"
        />
        {value && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="Clear"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}
      </div>
      {loading && (
        <div className="absolute right-3 top-9 text-gray-400">
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
        </div>
      )}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto py-1">
          {suggestions.map((s) => (
            <li key={s.place_id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-brand-50 focus:bg-brand-50 focus:outline-none"
                onClick={() => select(s)}
              >
                <span className="text-gray-800">{s.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
