'use client';
import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { getHeatmap, getRegionalReport } from '../../../lib/api/client';
import type { RegionReport } from '../../../lib/api/types';
import { useStats } from '../../layout/providers';
import {
  Lede,
  Stat,
  Panel,
  Loading,
  ErrorState,
  Empty,
  MockNotice,
  Dialog,
  SeverityTag,
} from '../../ui/primitives';
import { RegionBars } from '../reports/regional-report';
import { c } from '../../../lib/styles';
import { errorMessage } from '../../../lib/api/errors';
import { getLocationName, nearestRegion } from '../../../lib/geo';
import { severityColors } from '../../../lib/format';

export function Dashboard() {
  const stats = useStats();
  const report = useSWR(['report', 0.4, 5000], () => getRegionalReport());
  const map = useSWR(['heatmap', 0.4, 500], () => getHeatmap());

  const [selectedRegion, setSelectedRegion] = useState<RegionReport | null>(null);

  const buckets = Array.from(
    { length: 6 },
    (_, i) =>
      (map.data || []).filter(
        (p) =>
          p.intensity >= 0.4 + i * 0.1 &&
          (i === 5 ? p.intensity <= 1 : p.intensity < 0.5 + i * 0.1),
      ).length,
  );
  const max = Math.max(...buckets, 1);

  // Filter map points belonging to the selected region
  const regionPoints = selectedRegion
    ? (map.data || []).filter((p) => nearestRegion(p) === selectedRegion.region)
    : [];

  return (
    <>
      <section className={c('band')}>
        <Lede
          eyebrow="Dashboard"
          title="Road intelligence overview"
          description="Stored detection totals and the current regional confidence breakdown."
          actions={
            <Link href="/" className={c('btn quiet')}>
              View on map
            </Link>
          }
        />
        {stats.error ? (
          <ErrorState message={errorMessage(stats.error)} retry={() => void stats.mutate()} />
        ) : (
          <div className={c('stat-strip spaced')}>
            <Stat
              label="Saved detections"
              value={stats.data?.total_detections.toLocaleString() ?? '—'}
              foot="All records returned by the backend"
            />
            <Stat
              label="Avg confidence"
              value={stats.data?.avg_confidence.toFixed(2) ?? '—'}
              foot="Across stored detections"
            />
            <Stat
              label="Devices recorded"
              value={stats.data?.devices_active ?? '—'}
              foot="Distinct device IDs; not live connectivity"
            />
          </div>
        )}
        {stats.data?.mock_mode && <MockNotice />}
      </section>

      <section className={c('band')}>
        <div className={c('cols')}>
          <Panel
            title="Severity by region"
            aside={<span className={c('endpoint')}>Confidence ≥ 0.4 · Click for details</span>}
          >
            {report.error ? (
              <ErrorState message={errorMessage(report.error)} retry={() => void report.mutate()} />
            ) : report.isLoading ? (
              <Loading />
            ) : report.data?.regions.length ? (
              <RegionBars
                regions={report.data.regions}
                onSelectRegion={(r) => setSelectedRegion(r)}
              />
            ) : (
              <Empty>No regional detections yet.</Empty>
            )}
          </Panel>

          <Panel
            title="Map confidence distribution"
            aside={<span className={c('endpoint')}>First 500 points</span>}
          >
            {map.error ? (
              <ErrorState message={errorMessage(map.error)} retry={() => void map.mutate()} />
            ) : map.isLoading ? (
              <Loading />
            ) : !map.data?.length ? (
              <Empty>No map points yet.</Empty>
            ) : (
              <>
                <div
                  className={c('spark')}
                  role="img"
                  aria-label={buckets
                    .map(
                      (n, i) =>
                        `${(0.4 + i * 0.1).toFixed(1)} to ${(0.5 + i * 0.1).toFixed(1)}: ${n} locations`,
                    )
                    .join('; ')}
                >
                  {buckets.map((n, i) => (
                    <div
                      key={i}
                      title={`${(0.4 + i * 0.1).toFixed(1)}–${(0.5 + i * 0.1).toFixed(1)}: ${n}`}
                    >
                      <i style={{ height: `${(n / max) * 100}%` }} />
                    </div>
                  ))}
                </div>
                <div className={c('axis')}>
                  <span>0.4</span>
                  <span>0.7</span>
                  <span>1.0 confidence</span>
                </div>
                <p className={c('muted')}>
                  Counts by confidence band for the displayed map cohort.
                </p>
              </>
            )}
          </Panel>
        </div>
      </section>

      {/* Extensive Region Detail Modal */}
      <Dialog
        open={!!selectedRegion}
        onClose={() => setSelectedRegion(null)}
        label="Region details"
        drawer
      >
        {selectedRegion && (
          <>
            <div className={c('drawer-head')}>
              <div>
                <div className={c('eyebrow')}>Regional Intelligence Detail</div>
                <h2>{selectedRegion.region} Region</h2>
              </div>
              <button
                type="button"
                className={c('x push-right')}
                onClick={() => setSelectedRegion(null)}
                aria-label="Close region details"
              >
                ×
              </button>
            </div>

            <div className={c('drawer-body')}>
              <div className={c('stat-strip spaced')}>
                <Stat
                  label="Total detections"
                  value={selectedRegion.total.toLocaleString()}
                  foot="In this region"
                />
                <Stat
                  label="Avg confidence"
                  value={selectedRegion.avg_confidence.toFixed(2)}
                  foot="Regional score"
                />
              </div>

              <div className={c('field')}>
                <div className={c('eyebrow')}>Severity breakdown</div>
                <div className={c('legend')} style={{ marginTop: '8px' }}>
                  {(['high', 'medium', 'low'] as const).map((s) => (
                    <span key={s}>
                      <i style={{ background: severityColors[s] }} />
                      {s} ({selectedRegion.severity_breakdown[s]})
                    </span>
                  ))}
                </div>
              </div>

              <div className={c('field')}>
                <div className={c('eyebrow')} style={{ marginBottom: '8px' }}>
                  Pothole Locations ({regionPoints.length})
                </div>

                {regionPoints.length === 0 ? (
                  <Empty>No mapped points matching current filters for {selectedRegion.region}.</Empty>
                ) : (
                  <div
                    className={c('feed')}
                    style={{
                      maxHeight: '360px',
                      border: '1px solid var(--line-2)',
                      borderRadius: '2px',
                    }}
                  >
                    {regionPoints.map((point, i) => {
                      const locationName = getLocationName(point);
                      const googleMapsUrl = `https://www.google.com/maps?q=${point.lat},${point.lng}`;

                      return (
                        <div
                          key={`${point.lat}-${point.lng}-${i}`}
                          className={c('feed-row')}
                          style={{
                            gridTemplateColumns: 'minmax(0, 1fr) auto',
                            alignItems: 'center',
                            cursor: 'default',
                          }}
                        >
                          <div>
                            <div className={c('r')}>{locationName}</div>
                            <div className={c('d feed-coordinate')}>
                              {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <SeverityTag confidence={point.intensity} />
                            <span className={c('mono')} style={{ fontSize: '0.82rem' }}>
                              {(point.intensity * 100).toFixed(0)}%
                            </span>
                            <a
                              href={googleMapsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={c('btn quiet')}
                              style={{ padding: '3px 8px', fontSize: '0.78rem', textDecoration: 'none' }}
                              title="Open in Google Maps"
                            >
                              Maps
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
                <Link
                  href={`/?region=${encodeURIComponent(selectedRegion.region)}`}
                  className={c('btn solid')}
                  onClick={() => setSelectedRegion(null)}
                  style={{ textDecoration: 'none' }}
                >
                  View on Live Map
                </Link>
                <button
                  type="button"
                  className={c('btn quiet')}
                  onClick={() => setSelectedRegion(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}
