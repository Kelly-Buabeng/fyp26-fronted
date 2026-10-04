'use client';
import useSWR from 'swr';
import { getSavedDetections } from '@/lib/api/client';
import { useConsole, useHealth, useStats } from '@/components/layout/providers';
import {
  Empty,
  ErrorState,
  Lede,
  Loading,
  MockNotice,
  Notice,
  Panel,
  Stat,
} from '@/components/ui/primitives';
import { errorMessage } from '@/lib/api/errors';
import { c } from '@/lib/styles';
import { dateTime } from '@/lib/format';
const endpoints = [
  ['GET', '/health', 'Public', 'Model readiness'],
  ['GET', '/api/v1/heatmap', 'Public', 'Location map'],
  ['GET', '/api/v1/stats', 'Public', 'Stored totals'],
  ['GET', '/api/v1/report', 'Public', 'Regional report'],
  ['POST', '/api/v1/detect', 'API key', 'Image inference'],
  ['GET', '/api/v1/detections/export', 'API key', 'CSV / GeoJSON'],
  ['DELETE', '/api/v1/detections/{id}', 'API key', 'False-positive removal'],
];
export function DevicesHealth() {
  const state = useConsole();
  const health = useHealth();
  const stats = useStats();
  const records = useSWR(state.admin ? ['records', 0, 5000] : null, () =>
    getSavedDetections({ min_confidence: 0, limit: 5000 }),
  );
  const groups = new Map<
    string,
    { device: string; total: number; last: string; regions: Set<string> }
  >();
  for (const r of records.data || []) {
    const g = groups.get(r.device_id) || {
      device: r.device_id,
      total: 0,
      last: r.created_at,
      regions: new Set<string>(),
    };
    g.total++;
    if (new Date(r.created_at) > new Date(g.last)) g.last = r.created_at;
    g.regions.add(r.region);
    groups.set(r.device_id, g);
  }
  return (
    <>
      <section className={c('band')}>
        <Lede
          eyebrow="Fleet"
          title="Devices & model health"
          description="Backend model readiness and device activity derived from saved detections."
          actions={
            <button
              className={c('btn quiet')}
              onClick={() => {
                void health.mutate();
                void stats.mutate();
                void records.mutate();
              }}
              disabled={health.isValidating}
            >
              Refresh health
            </button>
          }
        />
        {health.error ? (
          <ErrorState message={errorMessage(health.error)} retry={() => void health.mutate()} />
        ) : (
          <div className={c('stat-strip spaced')}>
            <Stat label="Service" value={health.data?.status ?? '—'} foot="GET /health" />
            <Stat
              label="Model loaded"
              value={health.data ? (health.data.model_loaded ? 'Yes' : 'No') : '—'}
              foot="Weights loaded by the backend"
            />
            <Stat
              label="Pothole class"
              value={
                health.data ? (health.data.pothole_model_ready ? 'Ready' : 'Unavailable') : '—'
              }
              foot="Required before image inference"
            />
            <Stat
              label="Storage mode"
              value={stats.data ? (stats.data.mock_mode ? 'Sample' : 'Live') : '—'}
              foot="From the backend statistics endpoint"
            />
          </div>
        )}
        {stats.data?.mock_mode && <MockNotice />}
      </section>
      <section className={c('band')}>
        <Panel
          title="Devices in saved records"
          aside={<span className={c('endpoint')}>First 5,000 records</span>}
        >
          {!state.admin ? (
            <>
              <Notice label="RHA access">
                Sign in to view device IDs and their last recorded detections.
              </Notice>
              <button className={c('btn quiet spaced')} onClick={() => state.openLogin()}>
                Sign in as RHA
              </button>
            </>
          ) : records.error ? (
            <ErrorState message={errorMessage(records.error)} retry={() => void records.mutate()} />
          ) : records.isLoading ? (
            <Loading />
          ) : !groups.size ? (
            <Empty>No devices have saved detections.</Empty>
          ) : (
            <div className={c('table-wrap')}>
              <table>
                <caption className={c('sr-only')}>Device activity from detections</caption>
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>Regions</th>
                    <th>Last detection</th>
                    <th className={c('num')}>Records</th>
                  </tr>
                </thead>
                <tbody>
                  {[...groups.values()].map((g) => (
                    <tr key={g.device}>
                      <td className={c('mono')}>{g.device}</td>
                      <td>{[...g.regions].join(', ')}</td>
                      <td className={c('mono')}>{dateTime(g.last)}</td>
                      <td className={c('num mono')}>{g.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className={c('muted')}>
            The API does not expose device battery, firmware, heartbeat, or connectivity status.
          </p>
        </Panel>
        <div className={c('spaced')}>
          <Panel title="API surface">
            <div className={c('table-wrap')}>
              <table>
                <caption className={c('sr-only')}>Backend endpoints</caption>
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Path</th>
                    <th>Backend access</th>
                    <th>Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  {endpoints.map(([method, path, access, purpose]) => (
                    <tr key={method + path}>
                      <td className={c('mono')}>{method}</td>
                      <td className={c('mono')}>{path}</td>
                      <td>{access}</td>
                      <td>{purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </section>
    </>
  );
}
