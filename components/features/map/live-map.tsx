'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import { getHeatmap } from '../../../lib/api/client';
import type { HeatmapPoint } from '../../../lib/api/types';
import { useStats } from '../../layout/providers';
import {
  Dialog,
  Empty,
  ErrorState,
  Lede,
  Loading,
  MockNotice,
  SeverityTag,
  Stat,
} from '../../ui/primitives';
import { c } from '../../../lib/styles';
import { nearestRegion, REGIONS, getLocationName } from '../../../lib/geo';
import { severity, severityColors, type Severity } from '../../../lib/format';
import { errorMessage } from '../../../lib/api/errors';

const Map = dynamic(() => import('./leaflet-map'), {
  ssr: false,
  loading: () => <Loading label="Opening map…" />,
});

const closeBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  fontSize: '1.25rem',
  lineHeight: 1,
  cursor: 'pointer',
  padding: '2px 8px',
  borderRadius: '4px',
  color: 'inherit',
  opacity: 0.7,
};

const toggleBtnStyle: React.CSSProperties = {
  position: 'absolute',
  zIndex: 400,
  background: 'var(--panel-bg, #ffffff)',
  color: 'var(--text-color, #111827)',
  border: '1px solid var(--border-color, #d1d5db)',
  borderRadius: '20px',
  padding: '6px 14px',
  fontSize: '0.85rem',
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

export function LiveMap() {
  const [minimum, setMinimum] = useState(0.4);
  const [limit, setLimit] = useState(500);
  const [region, setRegion] = useState('all');
  const [bands, setBands] = useState<Severity[]>(['high', 'medium', 'low']);
  const [selected, setSelected] = useState<HeatmapPoint | null>(null);

  // Panel visibility states
  const [showTitle, setShowTitle] = useState(true);
  const [showFilter, setShowFilter] = useState(true);
  const [showFeed, setShowFeed] = useState(true);

  const stats = useStats();

  const data = useSWR(
    ['heatmap', minimum, limit],
    () => getHeatmap({ min_confidence: minimum, limit }),
    { refreshInterval: 30000, keepPreviousData: true },
  );

  const points = useMemo(
    () =>
      (data.data || [])
        .filter(
          (p) =>
            p.intensity >= minimum &&
            bands.includes(severity(p.intensity)) &&
            (region === 'all' || nearestRegion(p) === region),
        )
        .slice(0, limit),
    [data.data, minimum, bands, region, limit],
  );

  const select = useCallback((point: HeatmapPoint) => setSelected(point), []);
  const average = points.reduce((total, p) => total + p.intensity, 0) / (points.length || 1);

  return (
    <>
      <section className={c('hero')}>
        <Map points={points} onSelect={select} />

        {/* Title / Overview Panel */}
        {showTitle ? (
          <div className={c('ov ov-title')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <div className={c('eyebrow')}>Live network · {points.length} locations</div>
              <button
                type="button"
                style={closeBtnStyle}
                onClick={() => setShowTitle(false)}
                aria-label="Close overview panel"
                title="Close panel"
              >
                ✕
              </button>
            </div>
            <h1>Every pothole on Ghana&apos;s roads, as it is found.</h1>
            <p>
              Confirmed hazards from the detection API, refreshed every 30 seconds and graded by model
              confidence.
            </p>
            <div className={c('legend')}>
              {(['high', 'medium', 'low'] as const).map((s) => (
                <span key={s}>
                  <i style={{ background: severityColors[s] }} />
                  {s}
                  {s === 'high' ? ' ≥ .75' : s === 'medium' ? ' ≥ .50' : ''}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <button
            type="button"
            style={{ ...toggleBtnStyle, top: '16px', left: '16px' }}
            onClick={() => setShowTitle(true)}
          >
            ℹ Overview
          </button>
        )}

        {/* Filter Panel */}
        {showFilter ? (
          <div className={c('ov ov-left')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div className={c('eyebrow')}>Filter</div>
              <button
                type="button"
                style={closeBtnStyle}
                onClick={() => setShowFilter(false)}
                aria-label="Close filter panel"
                title="Close panel"
              >
                ✕
              </button>
            </div>

            <div className={c('field')}>
              <label htmlFor="map-confidence">
                Min confidence <span className={c('mono push-right')}>{minimum.toFixed(2)}</span>
              </label>
              <input
                id="map-confidence"
                type="range"
                min="0"
                max="1"
                step=".05"
                value={minimum}
                onChange={(e) => setMinimum(Number(e.target.value))}
              />
            </div>
            <div className={c('field')}>
              <label>Severity</label>
              <div className={c('chips')}>
                {(['high', 'medium', 'low'] as const).map((s) => (
                  <button
                    className={c('chip', s)}
                    key={s}
                    aria-pressed={bands.includes(s)}
                    onClick={() =>
                      setBands((b) => (b.includes(s) ? b.filter((x) => x !== s) : [...b, s]))
                    }
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className={c('field')}>
              <label htmlFor="map-region">Nearest region</label>
              <select id="map-region" value={region} onChange={(e) => setRegion(e.target.value)}>
                <option value="all">All 16 regions</option>
                {Object.keys(REGIONS).map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className={c('field')}>
              <label htmlFor="map-limit">Limit</label>
              <select id="map-limit" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
                {[100, 500, 1000, 2000].map((n) => (
                  <option value={n} key={n}>
                    {n} points
                  </option>
                ))}
              </select>
            </div>
            <button
              className={c('btn quiet')}
              disabled={data.isValidating}
              onClick={() => void data.mutate()}
            >
              {data.isValidating ? 'Refreshing…' : 'Refresh map'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            style={{
              ...toggleBtnStyle,
              left: '16px',
              top: showTitle ? 'calc(100% - 60px)' : '60px',
            }}
            onClick={() => setShowFilter(true)}
          >
            Filters
          </button>
        )}

        {/* Location Feed Panel */}
        {showFeed ? (
          <div className={c('ov ov-right')}>
            <div className={c('panel-head')}>
              <h2>Location feed</h2>
              <span className={c('endpoint push-right')}>
                {data.isValidating ? 'Updating…' : `${points.length} points`}
              </span>
              <button
                type="button"
                style={{ ...closeBtnStyle, marginLeft: '8px' }}
                onClick={() => setShowFeed(false)}
                aria-label="Close location feed panel"
                title="Close panel"
              >
                ✕
              </button>
            </div>
            <div className={c('feed')}>
              {data.error ? (
                <ErrorState message={errorMessage(data.error)} retry={() => void data.mutate()} />
              ) : data.isLoading ? (
                <Loading />
              ) : !points.length ? (
                <Empty>No locations match these filters.</Empty>
              ) : (
                points.slice(0, 60).map((p, i) => (
                  <button
                    key={`${p.lat}-${p.lng}-${i}`}
                    className={c('feed-row')}
                    onClick={() => select(p)}
                  >
                    <span
                      className={c('c mono')}
                      style={{ color: severityColors[severity(p.intensity)] }}
                    >
                      {p.intensity.toFixed(2)}
                    </span>
                    <span>
                      <span className={c('r')}>{getLocationName(p)}</span>
                      <span className={c('d feed-coordinate')}>{nearestRegion(p)}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
            <div className={c('feed-note')}>
              Location feed displays real-world landmark names. Capture times and device IDs are
              available in GHA records.
            </div>
          </div>
        ) : (
          <button
            type="button"
            style={{ ...toggleBtnStyle, top: '16px', right: '16px' }}
            onClick={() => setShowFeed(true)}
          >
            Location Feed ({points.length})
          </button>
        )}
      </section>

      <section className={c('band')}>
        <Lede
          eyebrow="Roadwatch"
          title="Field intelligence for Ghana’s roads"
          description="One console for detection, inspection, and regional reporting."
          actions={
            <>
              <Link href="/detect" className={c('btn quiet')}>
                Report a pothole
              </Link>
              <Link href="/report" className={c('btn solid')}>
                Regional report
              </Link>
            </>
          }
        />
        <div className={c('stat-strip spaced')}>
          <Stat
            label="Map locations"
            value={points.length.toLocaleString()}
            foot="Matching the current filters"
          />
          <Stat
            label="Avg confidence"
            value={average.toFixed(2)}
            foot={`Threshold ${minimum.toFixed(2)}`}
          />
          <Stat
            label="Devices recorded"
            value={stats.data?.devices_active ?? '—'}
            foot="Distinct device IDs in stored data"
          />
        </div>
        {stats.data?.mock_mode && <MockNotice />}
      </section>

      <Dialog open={!!selected} onClose={() => setSelected(null)} label="Pothole location" drawer>
        {selected && (
          <>
            <div className={c('drawer-head')}>
              <div>
                <div className={c('eyebrow')}>Map location</div>
                <h2>{getLocationName(selected)}</h2>
              </div>
              <button
                className={c('x push-right')}
                onClick={() => setSelected(null)}
                aria-label="Close location"
              >
                ×
              </button>
            </div>
            <div className={c('drawer-body')}>
              {(() => {
                const imageUrl = selected.image_url
                  ? (selected.image_url.startsWith('http')
                    ? selected.image_url
                    : `/api/backend${selected.image_url.replace('/api/v1', '')}`)
                  : selected.id
                    ? `/api/backend/images/${selected.id}`
                    : `/api/backend/images/${selected.lat}-${selected.lng}`;

                return (
                  <div
                    style={{
                      borderRadius: '12px',
                      overflow: 'hidden',
                      marginBottom: '16px',
                      background: '#0f172a',
                      border: '1px solid var(--border-color, #e2e8f0)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      position: 'relative',
                      width: '100%',
                      maxHeight: '260px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <img
                      src={imageUrl}
                      alt={`Pothole at ${getLocationName(selected)}`}
                      style={{ width: '100%', maxHeight: '260px', objectFit: 'cover' }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="225" viewBox="0 0 400 225"><rect width="400" height="225" fill="%231e293b"/><path d="M120,130 C150,110 180,150 220,135 C260,120 280,140 290,130 C270,165 240,175 190,170 C140,165 110,150 120,130 Z" fill="%23334155" stroke="%23475569" stroke-width="3"/><text x="200" y="95" fill="%23f8fafc" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="600">Pothole Detection Image</text><text x="200" y="195" fill="%2394a3b8" text-anchor="middle" font-family="sans-serif" font-size="12">Location Feed Visual</text></svg>';
                      }}
                    />
                  </div>
                );
              })()}

              <div style={{ marginBottom: '12px' }}>
                <SeverityTag confidence={selected.intensity} />
              </div>

              <dl className={c('kv')}>
                <dt>Location</dt>
                <dd style={{ fontWeight: 600 }}>{getLocationName(selected)}</dd>
                <dt>Region</dt>
                <dd>{nearestRegion(selected)}</dd>
                <dt>Confidence</dt>
                <dd className={c('mono')}>{selected.intensity.toFixed(4)}</dd>
                <dt>Coordinates</dt>
                <dd className={c('mono')}>{selected.lat.toFixed(4)}, {selected.lng.toFixed(4)}</dd>
              </dl>

              <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
                <a
                  href={`https://www.google.com/maps?q=${selected.lat},${selected.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className={c('btn solid')}
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  Open in Google Maps
                </a>
                <a
                  href={`https://www.openstreetmap.org/?mlat=${selected.lat}&mlon=${selected.lng}#map=17/${selected.lat}/${selected.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className={c('btn quiet')}
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  Open in OpenStreetMap
                </a>
              </div>
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}
