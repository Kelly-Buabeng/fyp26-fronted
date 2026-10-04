'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import { getHeatmap } from '@/lib/api/client';
import type { HeatmapPoint } from '@/lib/api/types';
import { useStats } from '@/components/layout/providers';
import {
  Dialog,
  Empty,
  ErrorState,
  Lede,
  Loading,
  MockNotice,
  SeverityTag,
  Stat,
} from '@/components/ui/primitives';
import { c } from '@/lib/styles';
import { nearestRegion, REGIONS } from '@/lib/geo';
import { severity, severityColors, type Severity } from '@/lib/format';
import { errorMessage } from '@/lib/api/errors';
const Map = dynamic(() => import('./leaflet-map'), {
  ssr: false,
  loading: () => <Loading label="Opening map…" />,
});
export function LiveMap() {
  const [minimum, setMinimum] = useState(0.4);
  const [limit, setLimit] = useState(500);
  const [region, setRegion] = useState('all');
  const [bands, setBands] = useState<Severity[]>(['high', 'medium', 'low']);
  const [selected, setSelected] = useState<HeatmapPoint | null>(null);
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
  const high = points.filter((p) => severity(p.intensity) === 'high').length;
  return (
    <>
      <section className={c('hero')}>
        <Map points={points} onSelect={select} />
        <div className={c('ov ov-title')}>
          <div className={c('eyebrow')}>Live network · {points.length} locations</div>
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
        <div className={c('ov ov-left')}>
          <div className={c('eyebrow')}>Filter</div>
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
        <div className={c('ov ov-right')}>
          <div className={c('panel-head')}>
            <h2>Location feed</h2>
            <span className={c('endpoint push-right')}>
              {data.isValidating ? 'Updating…' : `${points.length} points`}
            </span>
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
                    <span className={c('r')}>{nearestRegion(p)}</span>
                    <span className={c('d feed-coordinate')}>
                      {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
          <div className={c('feed-note')}>
            Map points contain coordinates and confidence. Capture times and device IDs are
            available in GHA records.
          </div>
        </div>
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
          <Stat label="High confidence band" value={high} foot="Confidence ≥ 0.75" />
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
                <h2>{nearestRegion(selected)}</h2>
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
              <SeverityTag confidence={selected.intensity} />
              <dl className={c('kv')}>
                <dt>Latitude</dt>
                <dd className={c('mono')}>{selected.lat.toFixed(5)}</dd>
                <dt>Longitude</dt>
                <dd className={c('mono')}>{selected.lng.toFixed(5)}</dd>
                <dt>Confidence</dt>
                <dd className={c('mono')}>{selected.intensity.toFixed(4)}</dd>
                <dt>Region method</dt>
                <dd>Nearest regional capital</dd>
              </dl>
              <p className={c('muted')}>
                Original images and bounding boxes are not included in the map response.
              </p>
              <a
                href={`https://www.openstreetmap.org/?mlat=${selected.lat}&mlon=${selected.lng}#map=17/${selected.lat}/${selected.lng}`}
                target="_blank"
                rel="noreferrer"
                className={c('btn quiet')}
              >
                Open location
              </a>
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}
