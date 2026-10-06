'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { getDetectionsList, updateDetectionStatus } from '../../../lib/api/client';
import type { DetectionRecord, PotholeStatus } from '../../../lib/api/types';
import { useConsole } from '../../layout/providers';
import { Empty, ErrorState, Lede, SeverityTag } from '../../ui/primitives';
import { ImagePreview } from '../detection/image-preview';
import { c } from '../../../lib/styles';
import { dateTime } from '../../../lib/format';
import { nearestRegion, getLocationName } from '../../../lib/geo';

export function GalleryView() {
  const consoleState = useConsole();
  const [filter, setFilter] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<DetectionRecord | null>(null);
  const [updating, setUpdating] = useState(false);

  const { data, error, isLoading, mutate } = useSWR(
    ['gallery-detections', filter],
    () => getDetectionsList({ status: filter === 'all' ? undefined : filter }),
    { refreshInterval: 10000 },
  );

  async function handleStatusChange(id: string, newStatus: PotholeStatus) {
    setUpdating(true);
    try {
      await updateDetectionStatus(id, newStatus);
      consoleState.toast(`Status updated to ${newStatus}`);
      if (selectedItem?.id === id) {
        setSelectedItem((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
      await mutate();
    } catch {
      consoleState.toast('Failed to update status', 'error');
    } finally {
      setUpdating(false);
    }
  }

  const statusBadges: Record<string, { label: string; bg: string; color: string }> = {
    pending: { label: 'Pending Verification', bg: '#fef3c7', color: '#92400e' },
    confirmed: { label: 'Confirmed Pothole', bg: '#fee2e2', color: '#991b1b' },
    declined: { label: 'Declined', bg: '#f3f4f6', color: '#374151' },
    fixed: { label: 'Fixed / Repaired', bg: '#d1fae5', color: '#065f46' },
  };

  return (
    <>
      <section className={c('band')}>
        <Lede
          eyebrow="Authority Dashboard"
          title="Pothole Photo Gallery"
          description="Review all submitted pothole images, inspect detection confidence & locations, and manually verify, decline, or mark hazards as fixed."
        />

        <div className={c('actions')} style={{ marginTop: '16px', gap: '8px', flexWrap: 'wrap' }}>
          {(['all', 'pending', 'confirmed', 'declined', 'fixed'] as const).map((st) => (
            <button
              key={st}
              type="button"
              className={c('btn', filter === st ? 'solid' : 'quiet')}
              onClick={() => setFilter(st)}
              style={{ textTransform: 'capitalize' }}
            >
              {st === 'all' ? 'All Uploads' : st}
            </button>
          ))}
        </div>
      </section>

      <section className={c('band')}>
        {isLoading && <Empty>Loading gallery images…</Empty>}
        {error && <ErrorState message="Failed to load gallery uploads." />}

        {data && data.length === 0 && (
          <Empty>No pothole images found for filter "{filter}".</Empty>
        )}

        {data && data.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '20px',
            }}
          >
            {data.map((item) => {
              const statusInfo = statusBadges[item.status || 'pending'] || statusBadges.pending;
              const imageUrl = item.image_url
                ? `/api/backend${item.image_url.replace('/api/v1', '')}`
                : `/api/backend/images/${item.id}`;
              const locationName = getLocationName({ lat: item.lat, lng: item.lng });

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  style={{
                    border: '1px solid var(--border-color, #e5e7eb)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    background: 'var(--card-bg, #ffffff)',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  }}
                  className="gallery-card"
                >
                  <div style={{ position: 'relative', width: '100%', height: '180px', background: '#1e293b' }}>
                    <img
                      src={imageUrl}
                      alt={`Pothole ${item.id}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="180" viewBox="0 0 300 180"><rect width="300" height="180" fill="%23334155"/><text x="150" y="95" fill="%23f8fafc" text-anchor="middle" font-family="sans-serif">Pothole Image</text></svg>';
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        background: statusInfo.bg,
                        color: statusInfo.color,
                        padding: '4px 10px',
                        borderRadius: '16px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      {statusInfo.label}
                    </span>
                  </div>

                  <div style={{ padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{item.device_id || 'Device'}</span>
                      {item.confidence > 0 && <SeverityTag confidence={item.confidence} />}
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--text-color, #1f2937)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>📍</span>
                      <span>{locationName}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Selected Item Detail Drawer/Modal */}
      {selectedItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '20px',
          }}
          onClick={() => setSelectedItem(null)}
        >
          <div
            style={{
              background: 'var(--panel-bg, #ffffff)',
              color: 'var(--text-color, #111827)',
              borderRadius: '16px',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Pothole Image Details</h3>
              <button
                type="button"
                className={c('btn quiet')}
                onClick={() => setSelectedItem(null)}
                style={{ padding: '4px 12px' }}
              >
                Close ✕
              </button>
            </div>

            <div style={{ borderRadius: '8px', overflow: 'hidden', marginBottom: '16px', background: '#0f172a' }}>
              <img
                src={
                  selectedItem.image_url
                    ? `/api/backend${selectedItem.image_url.replace('/api/v1', '')}`
                    : `/api/backend/images/${selectedItem.id}`
                }
                alt={`Pothole ${selectedItem.id}`}
                style={{ width: '100%', maxHeight: '360px', objectFit: 'contain' }}
              />
            </div>

            {selectedItem.detections && selectedItem.detections.length > 0 && (
              <ImagePreview
                src={
                  selectedItem.image_url
                    ? `/api/backend${selectedItem.image_url.replace('/api/v1', '')}`
                    : `/api/backend/images/${selectedItem.id}`
                }
                detections={selectedItem.detections}
              />
            )}

            <dl className={c('kv')} style={{ marginTop: '16px' }}>
              <dt>Record ID</dt>
              <dd className={c('mono')}>{selectedItem.id}</dd>
              <dt>Device Name / ID</dt>
              <dd>{selectedItem.device_id}</dd>
              <dt>Location Name</dt>
              <dd style={{ fontWeight: 600 }}>{getLocationName({ lat: selectedItem.lat, lng: selectedItem.lng })}</dd>
              <dt>Confidence Score</dt>
              <dd>{selectedItem.confidence > 0 ? (selectedItem.confidence * 100).toFixed(1) + '%' : 'Not analyzed yet'}</dd>
              <dt>Nearest Region</dt>
              <dd>{nearestRegion({ lat: selectedItem.lat, lng: selectedItem.lng })}</dd>
              <dt>Submission Date</dt>
              <dd>{dateTime(selectedItem.created_at)}</dd>
              <dt>Current Status</dt>
              <dd style={{ textTransform: 'capitalize', fontWeight: 600 }}>{selectedItem.status || 'pending'}</dd>
            </dl>

            <div style={{ marginTop: '24px', borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem' }}>Authority Verification & Status Management</h4>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={c('btn solid')}
                  disabled={updating || selectedItem.status === 'confirmed'}
                  onClick={() => handleStatusChange(selectedItem.id, 'confirmed')}
                  style={{ background: '#dc2626', color: '#ffffff' }}
                >
                  ✓ Confirm Pothole
                </button>

                <button
                  type="button"
                  className={c('btn quiet')}
                  disabled={updating || selectedItem.status === 'declined'}
                  onClick={() => handleStatusChange(selectedItem.id, 'declined')}
                >
                  ✕ Decline Report
                </button>

                <button
                  type="button"
                  className={c('btn solid')}
                  disabled={updating || selectedItem.status === 'fixed'}
                  onClick={() => handleStatusChange(selectedItem.id, 'fixed')}
                  style={{ background: '#059669', color: '#ffffff' }}
                >
                  🛠 Mark as Fixed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
