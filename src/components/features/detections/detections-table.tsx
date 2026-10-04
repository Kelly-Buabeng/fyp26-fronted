'use client';
import { useMemo, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { deleteDetection, getSavedDetections } from '@/lib/api/client';
import type { SavedDetection } from '@/lib/api/types';
import { useConsole, useStats } from '@/components/layout/providers';
import {
  Dialog,
  Empty,
  ErrorState,
  Lede,
  Loading,
  MockNotice,
  Notice,
  Panel,
  SeverityTag,
} from '@/components/ui/primitives';
import { ExportActions } from '@/components/features/reports/export-actions';
import { errorMessage } from '@/lib/api/errors';
import { dateTime } from '@/lib/format';
import { c } from '@/lib/styles';
export function AdminGate() {
  const { openLogin } = useConsole();
  return (
    <Panel title="RHA access required">
      <p>Sign in to view saved detection records and manage false positives.</p>
      <button className={c('btn solid')} onClick={() => openLogin()}>
        Sign in as RHA
      </button>
    </Panel>
  );
}
export function DetectionsTable() {
  const state = useConsole();
  const stats = useStats();
  const { mutate } = useSWRConfig();
  const [minimum, setMinimum] = useState(0);
  const [limit, setLimit] = useState(5000);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<SavedDetection | null>(null);
  const [deleting, setDeleting] = useState<SavedDetection | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const data = useSWR(state.admin ? ['records', minimum, limit] : null, () =>
    getSavedDetections({ min_confidence: minimum, limit }),
  );
  const rows = useMemo(
    () =>
      (data.data || []).filter((r) =>
        [r.id, r.device_id, r.region].some((v) => v.toLowerCase().includes(search.toLowerCase())),
      ),
    [data.data, search],
  );
  const pages = Math.max(1, Math.ceil(rows.length / 20));
  const current = Math.min(page, pages - 1);
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setDeleteError('');
    try {
      await deleteDetection(deleting.id);
      setDeleting(null);
      setSelected(null);
      state.toast(
        stats.data?.mock_mode
          ? 'Mock deletion acknowledged; sample records are regenerated.'
          : 'Detection removed.',
      );
      await mutate((key) => Array.isArray(key) || key === 'stats');
    } catch (e) {
      setDeleteError(errorMessage(e));
      state.toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className={c('band')}>
        <Lede
          eyebrow="Records"
          title="Detections"
          description="Inspect saved metadata, remove false positives, and export records for QGIS or ArcGIS."
          actions={<ExportActions options={{ min_confidence: minimum, limit }} />}
        />
        {stats.data?.mock_mode && (
          <div className={c('spaced')}>
            <MockNotice />
          </div>
        )}
      </section>
      <section className={c('band')}>
        {!state.admin ? (
          <AdminGate />
        ) : (
          <>
            <div className={c('filter-row')}>
              <div className={c('field')}>
                <label htmlFor="record-search">Search ID, device, or region</label>
                <input
                  id="record-search"
                  type="search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                  placeholder="Search records…"
                />
              </div>
              <div className={c('field')}>
                <label htmlFor="record-confidence">Min confidence · {minimum.toFixed(2)}</label>
                <input
                  id="record-confidence"
                  type="range"
                  min="0"
                  max="1"
                  step=".05"
                  value={minimum}
                  onChange={(e) => {
                    setMinimum(Number(e.target.value));
                    setPage(0);
                  }}
                />
              </div>
              <div className={c('field')}>
                <label htmlFor="record-limit">Fetch limit</label>
                <select
                  id="record-limit"
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(0);
                  }}
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
                disabled={data.isValidating}
                onClick={() => void data.mutate()}
              >
                {data.isValidating ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
            <Panel
              title={`${rows.length.toLocaleString()} matching records`}
              aside={<span className={c('endpoint')}>From GeoJSON export</span>}
            >
              {data.error ? (
                <ErrorState message={errorMessage(data.error)} retry={() => void data.mutate()} />
              ) : data.isLoading ? (
                <Loading />
              ) : !rows.length ? (
                <Empty>No records match these filters.</Empty>
              ) : (
                <>
                  <div className={c('table-wrap')}>
                    <table>
                      <caption className={c('sr-only')}>Saved detection records</caption>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Captured</th>
                          <th>Device</th>
                          <th>Region</th>
                          <th>Coordinates</th>
                          <th className={c('num')}>Conf.</th>
                          <th>Severity</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(current * 20, current * 20 + 20).map((r) => (
                          <tr key={r.id}>
                            <td className={c('mono')} title={r.id}>
                              {r.id.slice(0, 8)}
                            </td>
                            <td className={c('mono')}>{dateTime(r.created_at)}</td>
                            <td className={c('mono')}>{r.device_id}</td>
                            <td>{r.region}</td>
                            <td className={c('mono')}>
                              {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
                            </td>
                            <td className={c('num mono')}>{r.confidence.toFixed(2)}</td>
                            <td>
                              <SeverityTag confidence={r.confidence} />
                            </td>
                            <td>
                              <div className={c('actions')}>
                                <button
                                  className={c('btn quiet')}
                                  onClick={() => setSelected(r)}
                                  aria-label={`Inspect detection ${r.id}`}
                                >
                                  Inspect
                                </button>
                                <button
                                  className={c('btn danger')}
                                  onClick={() => {
                                    setDeleteError('');
                                    setDeleting(r);
                                  }}
                                  aria-label={`Delete detection ${r.id}`}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className={c('pagination')}>
                    <span>
                      Page {current + 1} of {pages}
                    </span>
                    <button
                      className={c('btn quiet')}
                      disabled={current === 0}
                      onClick={() => setPage(current - 1)}
                    >
                      Previous
                    </button>
                    <button
                      className={c('btn quiet')}
                      disabled={current === pages - 1}
                      onClick={() => setPage(current + 1)}
                    >
                      Next
                    </button>
                  </div>
                </>
              )}
            </Panel>
          </>
        )}
      </section>
      <Dialog
        open={!!selected && state.admin}
        onClose={() => setSelected(null)}
        label="Detection details"
        drawer
      >
        {selected && (
          <>
            <div className={c('drawer-head')}>
              <div>
                <div className={c('eyebrow')}>{dateTime(selected.created_at)}</div>
                <h2>{selected.region}</h2>
              </div>
              <button
                className={c('x push-right')}
                aria-label="Close detection"
                onClick={() => setSelected(null)}
              >
                ×
              </button>
            </div>
            <div className={c('drawer-body')}>
              <SeverityTag confidence={selected.confidence} />
              <dl className={c('kv')}>
                <dt>Record ID</dt>
                <dd className={c('mono')}>{selected.id}</dd>
                <dt>Device</dt>
                <dd>{selected.device_id}</dd>
                <dt>Coordinates</dt>
                <dd className={c('mono')}>
                  {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
                </dd>
                <dt>Confidence</dt>
                <dd className={c('mono')}>{selected.confidence.toFixed(4)}</dd>
                <dt>Detected labels</dt>
                <dd>{selected.labels.join(', ') || 'None provided'}</dd>
              </dl>
              <Notice label="Media">
                The export endpoint does not include saved images or bounding boxes. Image overlays
                are available immediately after a new upload.
              </Notice>
              <button
                className={c('btn danger')}
                onClick={() => {
                  setDeleteError('');
                  setDeleting(selected);
                }}
              >
                Remove false positive
              </button>
            </div>
          </>
        )}
      </Dialog>
      <Dialog
        open={!!deleting && state.admin}
        onClose={() => {
          if (!busy) setDeleting(null);
        }}
        label="Confirm deletion"
      >
        <div className={c('panel-head')}>
          <h2>Remove false positive</h2>
        </div>
        <div className={c('panel-body form-stack')}>
          <p>
            Delete detection <strong>{deleting?.id}</strong> from {deleting?.region}?
          </p>
          <p>This removes the saved record from the backend.</p>
          {deleteError && <ErrorState message={deleteError} />}
          <div className={c('actions')}>
            <button className={c('btn danger')} disabled={busy} onClick={() => void remove()}>
              {busy ? 'Deleting…' : 'Delete record'}
            </button>
            <button className={c('btn quiet')} disabled={busy} onClick={() => setDeleting(null)}>
              Cancel
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
