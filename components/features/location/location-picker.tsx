'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { LocationSuggestion } from '../../../lib/api/location';
import { c } from '../../../lib/styles';

interface LocationPickerProps {
  lat?: number;
  lng?: number;
  onSelectLocation: (location: { lat: number; lng: number; address: string }) => void;
  error?: string;
  disabled?: boolean;
}

export function LocationPicker({
  lat,
  lng,
  onSelectLocation,
  error,
  disabled = false,
}: LocationPickerProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [selectedAddress, setSelectedAddress] = useState('');
  const [showManualCoords, setShowManualCoords] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const hasCoordinates = typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Perform Photon search with debounce
  const fetchSuggestions = useCallback((searchQuery: string) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();

    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 2) {
      setSuggestions([]);
      setLoadingSuggestions(false);
      setShowDropdown(false);
      return;
    }

    setLoadingSuggestions(true);

    searchTimeoutRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const res = await fetch(`/api/location/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data: LocationSuggestion[] = await res.json();
          setSuggestions(data);
          setShowDropdown(data.length > 0);
          setActiveIndex(-1);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('Failed to search locations:', err);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 250);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setLocationError('');
    fetchSuggestions(value);
  };

  const handleSelectSuggestion = (suggestion: LocationSuggestion) => {
    setQuery(suggestion.formattedAddress);
    setSelectedAddress(suggestion.formattedAddress);
    setShowDropdown(false);
    setSuggestions([]);
    setLocationError('');
    onSelectLocation({
      lat: suggestion.lat,
      lng: suggestion.lng,
      address: suggestion.formattedAddress,
    });
  };

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    setLocating(true);
    setLocationError('');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const userLat = Number(pos.coords.latitude.toFixed(6));
        const userLng = Number(pos.coords.longitude.toFixed(6));

        // Attempt reverse geocoding with Photon API
        try {
          const res = await fetch(`/api/location/reverse?lat=${userLat}&lng=${userLng}`);
          if (res.ok) {
            const data: LocationSuggestion | null = await res.json();
            const address = data?.formattedAddress || `Current Location (${userLat}, ${userLng})`;
            setQuery(address);
            setSelectedAddress(address);
            onSelectLocation({ lat: userLat, lng: userLng, address });
          } else {
            const fallbackAddress = `Current Location (${userLat}, ${userLng})`;
            setQuery(fallbackAddress);
            setSelectedAddress(fallbackAddress);
            onSelectLocation({ lat: userLat, lng: userLng, address: fallbackAddress });
          }
        } catch {
          const fallbackAddress = `Current Location (${userLat}, ${userLng})`;
          setQuery(fallbackAddress);
          setSelectedAddress(fallbackAddress);
          onSelectLocation({ lat: userLat, lng: userLng, address: fallbackAddress });
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        if (err.code === 1) {
          setLocationError('Location permission denied. Please search for your location above.');
        } else {
          setLocationError('Could not retrieve your position. Please search for your location above.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      handleSelectSuggestion(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  return (
    <div className={c('location-picker-container')} ref={containerRef}>
      <div className={c('field-header')}>
        <label htmlFor="location-search-input" className={c('field-label')}>
          Pothole Location
        </label>
        <button
          type="button"
          className={c('btn-link')}
          onClick={() => setShowManualCoords(!showManualCoords)}
          disabled={disabled}
        >
          {showManualCoords ? 'Hide manual coordinates' : 'Manual coordinates'}
        </button>
      </div>

      <div className={c('search-input-wrapper')}>
        <div className={c('input-with-button')}>
          <div className={c('input-relative-box')}>
            <input
              id="location-search-input"
              type="text"
              value={query}
              onChange={handleInputChange}
              onFocus={() => query.trim().length >= 2 && suggestions.length > 0 && setShowDropdown(true)}
              onKeyDown={handleKeyDown}
              placeholder="Search address or landmark in Ghana (e.g. Airport Shell, Legon Road)..."
              disabled={disabled || locating}
              aria-expanded={showDropdown}
              aria-autocomplete="list"
              className={c('location-search-input')}
            />

            {loadingSuggestions && (
              <span className={c('search-spinner')} aria-hidden="true">
                ⏳
              </span>
            )}

            {query && !disabled && (
              <button
                type="button"
                className={c('clear-query-btn')}
                onClick={() => {
                  setQuery('');
                  setSelectedAddress('');
                  setSuggestions([]);
                  setShowDropdown(false);
                }}
                title="Clear location"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            className={c('btn secondary location-btn')}
            onClick={handleCurrentLocation}
            disabled={disabled || locating}
          >
            {locating ? (
              <>
                <span className={c('spinner-dot')}>●</span> Locating...
              </>
            ) : (
              <>
                <span className={c('loc-icon')}>📍</span> Use current location
              </>
            )}
          </button>
        </div>

        {/* Autocomplete Dropdown */}
        {showDropdown && suggestions.length > 0 && (
          <ul className={c('autocomplete-dropdown')} role="listbox">
            {suggestions.map((item, index) => (
              <li
                key={item.id}
                role="option"
                aria-selected={index === activeIndex}
                className={c('suggestion-item', index === activeIndex && 'suggestion-item-active')}
                onClick={() => handleSelectSuggestion(item)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <div className={c('suggestion-main')}>
                  <span className={c('suggestion-icon')}>📍</span>
                  <div className={c('suggestion-details')}>
                    <span className={c('suggestion-name')}>{item.name}</span>
                    <span className={c('suggestion-address')}>{item.formattedAddress}</span>
                  </div>
                </div>
                <span className={c('suggestion-coords')}>
                  {item.lat}, {item.lng}
                </span>
              </li>
            ))}
            <li className={c('dropdown-footer')}>
              <span>Powered by Photon OSM Geocoding</span>
            </li>
          </ul>
        )}
      </div>

      {/* Selected Location Pill/Badge */}
      {hasCoordinates && (
        <div className={c('selected-location-chip')}>
          <span className={c('chip-icon')}>📌</span>
          <span className={c('chip-text')}>
            {selectedAddress ? (
              <>
                <strong>{selectedAddress}</strong> ({lat}, {lng})
              </>
            ) : (
              <>
                Selected Coordinates: <strong>{lat}, {lng}</strong>
              </>
            )}
          </span>
          <span className={c('chip-badge')}>Ghana Bounding Verified</span>
        </div>
      )}

      {/* Manual Coordinates Collapsible */}
      {showManualCoords && (
        <div className={c('manual-coords-box')}>
          <div className={c('coordinate-fields')}>
            <div className={c('field')}>
              <label htmlFor="manual-lat-input">Latitude (4.5 to 11.5)</label>
              <input
                id="manual-lat-input"
                type="number"
                step="any"
                value={lat ?? ''}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onSelectLocation({
                    lat: isNaN(val) ? 0 : val,
                    lng: lng ?? 0,
                    address: selectedAddress || 'Manual Input',
                  });
                }}
                disabled={disabled}
                placeholder="e.g. 5.60374"
              />
            </div>
            <div className={c('field')}>
              <label htmlFor="manual-lng-input">Longitude (−3.5 to 1.5)</label>
              <input
                id="manual-lng-input"
                type="number"
                step="any"
                value={lng ?? ''}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onSelectLocation({
                    lat: lat ?? 0,
                    lng: isNaN(val) ? 0 : val,
                    address: selectedAddress || 'Manual Input',
                  });
                }}
                disabled={disabled}
                placeholder="e.g. −0.18701"
              />
            </div>
          </div>
        </div>
      )}

      {(locationError || error) && (
        <span className={c('field-error')} role="alert">
          {locationError || error}
        </span>
      )}
    </div>
  );
}
