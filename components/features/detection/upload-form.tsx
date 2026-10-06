'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSWRConfig } from 'swr';
import { submitImage, analyzeDetection } from '../../../lib/api/client';
import type { DetectionResponse, SubmitResponse } from '../../../lib/api/types';
import { ApiError, errorMessage } from '../../../lib/api/errors';
import {
  detectionFormSchema,
  type DetectionFormValues,
  MAX_IMAGE_BYTES,
} from '../../../lib/validation/detection';
import { useConsole, useHealth, useStats } from '../../layout/providers';
import {
  Dialog,
  Empty,
  ErrorState,
  Lede,
  MockNotice,
  Notice,
  SeverityTag,
} from '../../ui/primitives';
import { ImagePreview } from './image-preview';
import { LocationPicker } from '../location/location-picker';
import { c } from '../../../lib/styles';
import { dateTime } from '../../../lib/format';
import { nearestRegion, getLocationName } from '../../../lib/geo';
import { getDeviceName } from '../../../lib/device';

async function prepareImage(file: File) {
  const isImage =
    file.type.startsWith('image/') ||
    /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif|tiff)$/i.test(file.name);
  if (!isImage)
    throw new Error('Choose an image file. Video uploads are not supported by the backend.');
  if (!file.size || file.size > MAX_IMAGE_BYTES)
    throw new Error('Choose an image no larger than 10 MiB.');

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }

  try {
    if (bitmap.width * bitmap.height > 40_000_000)
      throw new Error('Choose an image smaller than 40 megapixels.');
    if (['image/png', 'image/webp'].includes(file.type)) return file;
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95),
    );
    if (!blob || blob.size > MAX_IMAGE_BYTES) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
  } finally {
    bitmap.close();
  }
}

export function UploadForm() {
  const consoleState = useConsole();
  const health = useHealth();
  const stats = useStats();
  const { mutate } = useSWRConfig();

  const [deviceName, setDeviceName] = useState('Web Device');

  useEffect(() => {
    const fetched = getDeviceName();
    setDeviceName(fetched);
    form.setValue('device_id', fetched);
  }, []);

  const form = useForm<DetectionFormValues>({
    resolver: zodResolver(detectionFormSchema),
    defaultValues: { device_id: 'manual' },
  });

  const image = useWatch({ control: form.control, name: 'image' });
  const [src, setSrc] = useState('');
  const [submission, setSubmission] = useState<SubmitResponse | null>(null);
  const [result, setResult] = useState<DetectionResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'processing'>('idle');
  const [progress, setProgress] = useState(0);
  const [preparing, setPreparing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const selection = useRef(0);
  const previewUrl = useRef('');
  const busy = phase !== 'idle';

  useEffect(
    () => () => {
      selection.current++;
      controller.current?.abort();
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    },
    [],
  );

  async function choose(file?: File) {
    if (!file || busy) return;
    const token = ++selection.current;
    setPreparing(true);
    setError('');
    setSubmission(null);
    setResult(null);
    try {
      const prepared = await prepareImage(file);
      if (token !== selection.current) return;
      form.setValue('image', prepared, { shouldValidate: true });
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = URL.createObjectURL(prepared);
      setSrc(previewUrl.current);
    } catch (e) {
      if (token === selection.current) {
        form.reset({ ...form.getValues(), image: undefined });
        if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
        previewUrl.current = '';
        setSrc('');
        setError(errorMessage(e));
      }
    } finally {
      if (token === selection.current) setPreparing(false);
    }
  }

  async function submit(values: DetectionFormValues) {
    setError('');
    setSubmission(null);
    setResult(null);
    setPhase('uploading');
    setProgress(0);
    const abort = new AbortController();
    controller.current = abort;

    const deviceIdToUse = values.device_id || deviceName || 'Web Device';

    try {
      const response = await submitImage(
        { ...values, device_id: deviceIdToUse },
        { signal: abort.signal, onProgress: setProgress, onUploaded: () => setPhase('processing') },
      );
      setSubmission(response);
      consoleState.toast('Pothole report submitted successfully!');
      await mutate((key) => Array.isArray(key) || key === 'stats');
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setError('Upload cancelled.');
      } else {
        setError(errorMessage(e));
        consoleState.toast(errorMessage(e), 'error');
        if (e instanceof ApiError)
          for (const [field, message] of Object.entries(e.fieldErrors))
            if (['lat', 'lng', 'device_id', 'image'].includes(field))
              form.setError(field as keyof DetectionFormValues, { message });
      }
    } finally {
      setPhase('idle');
      controller.current = null;
    }
  }

  async function handleAnalyze() {
    if (!submission?.id) return;
    setAnalyzing(true);
    setError('');
    try {
      const res = await analyzeDetection(submission.id);
      setResult(res);
      consoleState.toast(
        res.pothole_detected
          ? 'Analysis complete: Pothole detected!'
          : 'Analysis complete: No confirmed pothole.',
      );
    } catch (e) {
      setError(errorMessage(e));
      consoleState.toast(errorMessage(e), 'error');
    } finally {
      setAnalyzing(false);
    }
  }

  function handleCloseModal() {
    setSubmission(null);
    setResult(null);
  }

  function handleResetForm() {
    setSubmission(null);
    setResult(null);
    form.reset({ device_id: deviceName });
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = '';
    setSrc('');
    setError('');
  }

  const maximum = result?.detections.length
    ? Math.max(...result.detections.map((d) => d.confidence))
    : 0;

  return (
    <>
      <section className={c('band')}>
        <Lede
          eyebrow={consoleState.role === 'public' ? 'Public reporting' : 'Operations'}
          title={
            consoleState.role === 'public'
              ? 'Found a pothole? Send us the photo.'
              : 'Report a pothole'
          }
          description="Upload a road image with its GPS location. The report will be submitted immediately with your device ID."
        />
        {stats.data?.mock_mode && (
          <div className={c('spaced')}>
            <MockNotice />
          </div>
        )}
      </section>

      <section className={c('band')}>
        <div style={{ maxWidth: '780px', margin: '0 auto', width: '100%' }}>
          <div
            style={{
              background: 'var(--panel-bg, #ffffff)',
              border: '1px solid var(--border-color, #e5e7eb)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
            }}
          >
            <form
              className={c('form-stack')}
              onSubmit={(event) => void form.handleSubmit(submit)(event)}
              noValidate
            >
              {/* Step 1: Image Upload */}
              <div style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span
                    style={{
                      background: 'var(--primary-color, #2563eb)',
                      color: '#fff',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.85rem',
                      fontWeight: 'bold',
                    }}
                  >
                    1
                  </span>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>📷 Road Photo</h3>
                </div>

                <div
                  className={c('drop', dragging && 'drop-active')}
                  style={{
                    minHeight: '150px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '2px dashed var(--border-color, #cbd5e1)',
                    background: 'var(--bg-card, #f8fafc)',
                    cursor: busy || preparing ? 'not-allowed' : 'pointer',
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!busy) setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    void choose(e.dataTransfer.files[0]);
                  }}
                >
                  <strong style={{ fontSize: '1rem', marginBottom: '4px' }}>
                    {image ? image.name : 'Drop a road image or tap to select'}
                  </strong>
                  <span className={c('eyebrow')} style={{ marginBottom: '12px' }}>
                    JPEG, PNG, WebP, GIF, HEIC · max 10 MiB
                  </span>
                  <input
                    ref={input}
                    type="file"
                    accept="image/*,.jpg,.jpeg,.png,.webp,.bmp,.gif,.heic,.heif,.avif,.tiff"
                    disabled={busy || preparing}
                    aria-label="Road image"
                    onChange={(e) => {
                      void choose(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                    className={c('file-input')}
                  />
                  <button
                    type="button"
                    className={c('btn quiet')}
                    onClick={() => input.current?.click()}
                    disabled={busy || preparing}
                    style={{ minHeight: '44px', padding: '0 20px' }}
                  >
                    {preparing ? 'Preparing image…' : image ? 'Change photo' : '📷 Choose photo'}
                  </button>
                  {image && (
                    <span className={c('muted')} style={{ marginTop: '8px', fontSize: '0.85rem' }}>
                      {(image.size / 1024 / 1024).toFixed(2)} MiB
                    </span>
                  )}
                </div>
                {form.formState.errors.image && (
                  <span className={c('field-error')} role="alert" style={{ marginTop: '6px' }}>
                    {form.formState.errors.image.message}
                  </span>
                )}
                {src && !result && (
                  <div style={{ marginTop: '12px', borderRadius: '10px', overflow: 'hidden' }}>
                    <ImagePreview src={src} />
                  </div>
                )}
              </div>

              {/* Step 2: Location */}
              <div style={{ marginTop: '16px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span
                    style={{
                      background: 'var(--primary-color, #2563eb)',
                      color: '#fff',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.85rem',
                      fontWeight: 'bold',
                    }}
                  >
                    2
                  </span>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>📍 Pothole Location</h3>
                </div>

                <LocationPicker
                  lat={useWatch({ control: form.control, name: 'lat' })}
                  lng={useWatch({ control: form.control, name: 'lng' })}
                  onSelectLocation={({ lat, lng }) => {
                    form.setValue('lat', lat, { shouldValidate: true });
                    form.setValue('lng', lng, { shouldValidate: true });
                  }}
                  error={
                    form.formState.errors.lat?.message || form.formState.errors.lng?.message
                  }
                  disabled={busy}
                />
                <Notice label="Ghana Bounding">
                  Coordinates must fall within Ghana: latitude 4.5–11.5, longitude −3.5–1.5.
                </Notice>
              </div>

              {/* Step 3: Device Details */}
              <div style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span
                    style={{
                      background: 'var(--primary-color, #2563eb)',
                      color: '#fff',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.85rem',
                      fontWeight: 'bold',
                    }}
                  >
                    3
                  </span>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>📱 Device Identifier</h3>
                </div>

                <div className={c('field')}>
                  <label htmlFor="device-id">Device Name / ID</label>
                  <input
                    id="device-id"
                    type="text"
                    disabled={busy}
                    placeholder="Fetching device name..."
                    {...form.register('device_id')}
                    style={{ minHeight: '44px' }}
                  />
                  {form.formState.errors.device_id && (
                    <span className={c('field-error')}>
                      {form.formState.errors.device_id.message}
                    </span>
                  )}
                </div>
              </div>

              {error && <ErrorState message={error} />}
              {busy && (
                <div role="status" className={c('upload-progress')}>
                  <span>
                    {phase === 'uploading' ? `Uploading image · ${progress}%` : 'Submitting report…'}
                  </span>
                  {phase === 'uploading' ? <progress max={100} value={progress} /> : <progress />}
                </div>
              )}

              <div className={c('actions')} style={{ marginTop: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  className={c('btn solid')}
                  disabled={busy || preparing}
                  style={{ flex: 1, minHeight: '48px', fontSize: '1rem', fontWeight: 600 }}
                >
                  {busy ? 'Submitting…' : 'Submit report'}
                </button>
                <button
                  type="button"
                  className={c('btn quiet')}
                  disabled={preparing || busy}
                  onClick={handleResetForm}
                  style={{ minHeight: '48px', padding: '0 20px' }}
                >
                  Reset
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Submission & AI Report Modal / Overlay */}
      <Dialog
        open={!!submission || !!result}
        onClose={handleCloseModal}
        label="Pothole Submission Report"
      >
        {(submission || result) && (
          <div style={{ padding: '24px', maxWidth: '640px', width: '100%' }}>
            {/* Modal Head */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <div className={c('eyebrow')}>
                  {result ? 'AI Detection Result' : 'Report Saved'}
                </div>
                <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700 }}>
                  {result
                    ? result.pothole_detected
                      ? 'Pothole confirmed'
                      : 'No confirmed pothole'
                    : 'Report Submitted Successfully'}
                </h2>
              </div>
              <button
                type="button"
                className={c('btn quiet')}
                onClick={handleCloseModal}
                aria-label="Close modal"
                style={{ padding: '4px 10px', fontSize: '1.2rem', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {/* Success Banner */}
            {!result && (
              <div
                style={{
                  background: '#064e3b',
                  color: '#a7f3d0',
                  padding: '14px 18px',
                  borderRadius: '10px',
                  marginBottom: '16px',
                }}
              >
                <strong style={{ fontSize: '0.95rem' }}>✓ Pothole Report Recorded</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.88rem', opacity: 0.9 }}>
                  Your road image and location data have been saved. You can inspect AI model detection stats below.
                </p>
              </div>
            )}

            {/* Image Preview with Bounding Box Overlay if available */}
            {src && (
              <div style={{ borderRadius: '10px', overflow: 'hidden', marginBottom: '16px', background: '#0f172a' }}>
                <ImagePreview src={src} detections={result?.detections || []} />
              </div>
            )}

            {/* Metadata KV List */}
            <dl className={c('kv')}>
              <dt>Record ID</dt>
              <dd className={c('mono')}>{result?.id || submission?.id}</dd>
              <dt>Device Name</dt>
              <dd>{result?.device_id || submission?.device_id}</dd>
              <dt>Location Name</dt>
              <dd style={{ fontWeight: 600 }}>
                {getLocationName(
                  result?.coordinates || submission?.coordinates || { lat: 0, lng: 0 },
                )}
              </dd>
              <dt>Coordinates</dt>
              <dd className={c('mono')}>
                {(result?.coordinates.lat ?? submission?.coordinates.lat ?? 0).toFixed(5)},{' '}
                {(result?.coordinates.lng ?? submission?.coordinates.lng ?? 0).toFixed(5)}
              </dd>
              <dt>Timestamp</dt>
              <dd>{dateTime(result?.timestamp || submission?.timestamp || '')}</dd>
              <dt>Status</dt>
              <dd style={{ textTransform: 'capitalize', fontWeight: 600 }}>
                {result?.status || submission?.status || 'pending'}
              </dd>
              {result && (
                <>
                  <dt>Objects Detected</dt>
                  <dd>{result.detections.length}</dd>
                  <dt>Max Confidence</dt>
                  <dd className={c('mono')}>{(maximum * 100).toFixed(1)}%</dd>
                </>
              )}
            </dl>

            {/* Detections Bounding Box Table */}
            {result && result.detections.length > 0 && (
              <div className={c('table-wrap')} style={{ marginTop: '16px' }}>
                <table>
                  <caption className={c('sr-only')}>Detection bounding boxes in pixels</caption>
                  <thead>
                    <tr>
                      <th>Label</th>
                      <th>Conf.</th>
                      <th>Bounding box (px)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.detections.map((d, i) => (
                      <tr key={i}>
                        <td>{d.label}</td>
                        <td className={c('mono')}>{d.confidence.toFixed(4)}</td>
                        <td className={c('mono')}>
                          {Object.values(d.bbox)
                            .map((n) => n.toFixed(0))
                            .join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ marginTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {!result && (
                <button
                  type="button"
                  className={c('btn solid')}
                  disabled={analyzing}
                  onClick={() => void handleAnalyze()}
                  style={{ flex: 1, minHeight: '44px', fontWeight: 600 }}
                >
                  {analyzing ? 'Analyzing Image…' : 'View Stats / Detection Report'}
                </button>
              )}

              <Link
                href="/"
                className={c('btn quiet')}
                onClick={handleCloseModal}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              >
                See the live map
              </Link>

              <button
                type="button"
                className={c('btn quiet')}
                onClick={handleResetForm}
                style={{ padding: '0 16px' }}
              >
                Submit another report
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
