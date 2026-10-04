'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { getRegionalReport } from '@/lib/api/client';
import { useStats } from '@/components/layout/providers';
import type { RegionReport } from '@/lib/api/types';
import {
  Lede,
  Notice,
  MockNotice,
  Panel,
  Empty,
  Loading,
  ErrorState,
} from '@/components/ui/primitives';
import { ExportActions } from './export-actions';
import { c } from '@/lib/styles';
import { severityColors, dateTime } from '@/lib/format';
import { errorMessage } from '@/lib/api/errors';
export function SeverityStack({ region }: { region: RegionReport }) {
  return (
    <div
      className={c('stack')}
      aria-label={`High ${region.severity_breakdown.high}, medium ${region.severity_breakdown.medium}, low ${region.severity_breakdown.low}`}
    >
      {(['high', 'medium', 'low'] as const).map((b) => (
        <span
          key={b}
          style={{ flex: region.severity_breakdown[b], background: severityColors[b] }}
        />
      ))}
    </div>
  );
}
export function RegionBars({ regions }: { regions: RegionReport[] }) {
  const max = Math.max(...regions.map((r) => r.total), 1);
  return (
    <>
      {regions.map((r) => (
        <div className={c('bar-row')} key={r.region}>
          <span className={c('n')}>{r.region}</span>
          <div style={{ width: Math.max(6, (r.total / max) * 100) + '%' }}>
            <SeverityStack region={r} />
          </div>
          <span className={c('mono text-right')}>{r.total}</span>
        </div>
      ))}
    </>
  );
}
export function RegionalReport() {
  const [minimum, setMinimum] = useState(0.4);
  const [limit, setLimit] = useState(5000);
  const stats = useStats();
  const report = useSWR(
    ['report', minimum, limit],
    () => getRegionalReport({ min_confidence: minimum, limit }),
    { keepPreviousData: true },
  );
  return (
    <>
      <section className={c('band')}>
        <Lede
          eyebrow="Handoff"
          title="Regional severity report"
          description="Detections grouped by nearest regional capital and confidence band for Roads and Highway Authority review."
          actions={<ExportActions options={{ min_confidence: minimum, limit }} />}
        />
        <div className={c('spaced')}>
          <Notice label="Method">
            Region assignment uses the nearest regional capital. Severity bands reflect model
            confidence, rather than measured pothole depth.
          </Notice>
        </div>
        {stats.data?.mock_mode && (
          <div className={c('spaced')}>
            <MockNotice />
          </div>
        )}
      </section>
      <section className={c('band')}>
        <div className={c('filter-row')}>
          <div className={c('field')}>
            <label htmlFor="report-confidence">Min confidence · {minimum.toFixed(2)}</label>
            <input
              id="report-confidence"
              type="range"
              min="0"
              max="1"
              step=".05"
              value={minimum}
              onChange={(e) => setMinimum(Number(e.target.value))}
            />
          </div>
          <div className={c('field')}>
            <label htmlFor="report-limit">Record limit</label>
            <select
              id="report-limit"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              {[500, 5000, 10000, 20000].map((n) => (
                <option key={n} value={n}>
                  {n.toLocaleString()}
                </option>
              ))}
            </select>
          </div>
          <button
            className={c('btn quiet')}
            disabled={report.isValidating}
            onClick={() => void report.mutate()}
          >
            {report.isValidating ? 'Refreshing…' : 'Refresh report'}
          </button>
        </div>
        <Panel
          title={
            report.data ? `Generated ${dateTime(report.data.generated_at)}` : 'Regional breakdown'
          }
          aside={
            <span className={c('endpoint')}>{report.data?.total_detections ?? '—'} detections</span>
          }
        >
          {report.error ? (
            <ErrorState message={errorMessage(report.error)} retry={() => void report.mutate()} />
          ) : report.isLoading ? (
            <Loading />
          ) : !report.data?.regions.length ? (
            <Empty>No saved detections match these filters.</Empty>
          ) : (
            <div className={c('table-wrap')}>
              <table>
                <caption className={c('sr-only')}>Regional pothole confidence bands</caption>
                <thead>
                  <tr>
                    <th>Region</th>
                    <th className={c('num')}>Total</th>
                    <th className={c('num')}>Avg conf.</th>
                    <th>Split</th>
                    <th className={c('num')}>High</th>
                    <th className={c('num')}>Med</th>
                    <th className={c('num')}>Low</th>
                  </tr>
                </thead>
                <tbody>
                  {report.data.regions.map((r) => (
                    <tr key={r.region}>
                      <td>{r.region}</td>
                      <td className={c('num mono')}>{r.total}</td>
                      <td className={c('num mono')}>{r.avg_confidence.toFixed(3)}</td>
                      <td style={{ minWidth: 160 }}>
                        <SeverityStack region={r} />
                      </td>
                      {(['high', 'medium', 'low'] as const).map((s) => (
                        <td className={c('num mono')} key={s}>
                          {r.severity_breakdown[s]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </section>
    </>
  );
}
