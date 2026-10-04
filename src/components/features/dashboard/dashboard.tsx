'use client';
import Link from 'next/link';
import useSWR from 'swr';
import { getHeatmap, getRegionalReport } from '@/lib/api/client';
import { useStats } from '@/components/layout/providers';
import {
  Lede,
  Stat,
  Panel,
  Loading,
  ErrorState,
  Empty,
  MockNotice,
} from '@/components/ui/primitives';
import { RegionBars } from '@/components/features/reports/regional-report';
import { c } from '@/lib/styles';
import { errorMessage } from '@/lib/api/errors';
export function Dashboard() {
  const stats = useStats();
  const report = useSWR(['report', 0.4, 5000], () => getRegionalReport());
  const map = useSWR(['heatmap', 0.4, 500], () => getHeatmap());
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
  const high = report.data?.regions.reduce((n, r) => n + r.severity_breakdown.high, 0);
  return (
    <>
      <section className={c('band')}>
        <Lede
          eyebrow="Dashboard"
          title="Road intelligence, in four numbers"
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
              label="High confidence band"
              value={high ?? '—'}
              foot="From report · first 5,000 records ≥ 0.4"
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
            aside={<span className={c('endpoint')}>Confidence ≥ 0.4</span>}
          >
            {report.error ? (
              <ErrorState message={errorMessage(report.error)} retry={() => void report.mutate()} />
            ) : report.isLoading ? (
              <Loading />
            ) : report.data?.regions.length ? (
              <RegionBars regions={report.data.regions} />
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
    </>
  );
}
