'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSWRConfig } from 'swr';
import { detectImage } from '../../../lib/api/client';
import type { DetectionResponse } from '../../../lib/api/types';
import { ApiError, errorMessage } from '../../../lib/api/errors';
import {
  detectionFormSchema,
  type DetectionFormValues,
  MAX_IMAGE_BYTES,
} from '../../../lib/validation/detection';
import { useConsole, useHealth, useStats } from '../../layout/providers';
import {
  Empty,
  ErrorState,
  Lede,
  MockNotice,
  Notice,
  Panel,
  SeverityTag,
} from '../../ui/primitives';
import { ImagePreview } from './image-preview';
import { LocationPicker } from '../location/location-picker';
import { c } from '../../../lib/styles';
import { dateTime } from '../../../lib/format';
import { nearestRegion } from '../../../lib/geo';

// Bake JPEG EXIF orientation into the pixels so browser previews and Pillow's
// untransposed RGB input share the same coordinate system. PNG is unchanged.
async function prepareImage(file: File) {
  if (!['image/jpeg', 'image/png'].includes(file.type))
    throw new Error('Choose a JPEG or PNG image. Video uploads are not supported by the backend.');
  if (!file.size || file.size > MAX_IMAGE_BYTES)
    throw new Error('Choose an image no larger than 10 MiB.');
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => {
    throw new Error('This image could not be decoded. Choose a valid JPEG or PNG.');
  });
  try {
    if (bitmap.width * bitmap.height > 40_000_000)
      throw new Error('Choose an image smaller than 40 megapixels.');
    if (file.type === 'image/png') return file;
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to prepare this image.');
    context.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Unable to prepare this image.'))),
        'image/jpeg',
        0.95,
      ),
    );
    if (blob.size > MAX_IMAGE_BYTES)
      throw new Error('The prepared image exceeds 10 MiB. Choose a smaller image.');
    return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
  } finally {
    bitmap.close();
  }
}
export function UploadForm() {
  const consoleState = useConsole();
  const health = useHealth();
  const stats = useStorageMode();
  const { mutate } = useSWRConfig();
  const form = useForm<DetectionFormValues>({
    resolver: zodResolver(detectionFormSchema),
    defaultValues: { device_id: 'manual' },
  });
  const image = useWatch({ control: form.control, name: 'image' });
  const [src, setSrc] = useState('');
  const [result, setResult] = useState<DetectionResponse | null>(null);
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
    setResult(null);
    setPhase('uploading');
    setProgress(0);
    const abort = new AbortController();
    controller.current = abort;
    try {
      const response = await detectImage(
        { ...values, device_id: consoleState.role === 'public' ? 'web-public' : values.device_id },
        { signal: abort.signal, onProgress: setProgress, onUploaded: () => setPhase('processing') },
      );
      setResult(response);
      consoleState.toast(
        response.pothole_detected
          ? 'Detection complete.'
          : 'Analysis complete: no confirmed pothole.',
      );
      await mutate((key) => Array.isArray(key) || key === 'stats');
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setError(
          'Upload cancelled. If inference had started, check saved records before submitting again.',
        );
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
              : 'Run a detection'
          }
          description="Upload a road image with its GPS location. The model returns pothole confidence scores and bounding boxes."
        />
        {stats.data?.mock_mode && (
          <div className={c('spaced')}>
            <MockNotice />
          </div>
        )}
      </section>
      <section className={c('band')}>
        <div className={c('cols')}>
          <Panel title={consoleState.role === 'public' ? 'Your report' : 'Frame + GPS fix'}>
            <form
              className={c('form-stack')}
              onSubmit={(event) => void form.handleSubmit(submit)(event)}
              noValidate
            >
              <div
                className={c('drop', dragging && 'drop-active')}
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
                <strong>{image ? image.name : 'Drop a road image'}</strong>
                <span className={c('eyebrow')}>JPEG or PNG · max 10 MiB</span>
                <input
                  ref={input}
                  type="file"
                  accept="image/jpeg,image/png"
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
                >
                  {preparing ? 'Preparing image…' : image ? 'Change image' : 'Choose file'}
                </button>
                {image && (
                  <span className={c('muted')}>{(image.size / 1024 / 1024).toFixed(2)} MiB</span>
                )}
              </div>
              {form.formState.errors.image && (
                <span className={c('field-error')} role="alert">
                  {form.formState.errors.image.message}
                </span>
              )}
              {src && !result && <ImagePreview src={src} />}
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
              {consoleState.role === 'gha' && (
                <div className={c('field')}>
                  <label htmlFor="device-id">Device ID</label>
                  <input
                    id="device-id"
                    type="text"
                    disabled={busy}
                    {...form.register('device_id')}
                  />
                  {form.formState.errors.device_id && (
                    <span className={c('field-error')}>
                      {form.formState.errors.device_id.message}
                    </span>
                  )}
                </div>
              )}
              <Notice label="Location">
                Coordinates must fall within Ghana: latitude 4.5–11.5, longitude −3.5–1.5.
              </Notice>
              {health.data && !health.data.pothole_model_ready && (
                <Notice label="Model unavailable">
                  The backend needs trained pothole weights before it can process images.
                </Notice>
              )}
              {error && <ErrorState message={error} />}
              {busy && (
                <div role="status" className={c('upload-progress')}>
                  <span>
                    {phase === 'uploading' ? `Uploading image · ${progress}%` : 'Analysing image…'}
                  </span>
                  {phase === 'uploading' ? <progress max={100} value={progress} /> : <progress />}
                </div>
              )}
              <div className={c('actions')}>
                <button
                  className={c('btn solid')}
                  disabled={busy || preparing || health.data?.pothole_model_ready === false}
                >
                  {busy
                    ? 'Processing…'
                    : consoleState.role === 'public'
                      ? 'Submit report'
                      : 'Run detection'}
                </button>
                {busy ? (
                  <button
                    type="button"
                    className={c('btn quiet')}
                    onClick={() => controller.current?.abort()}
                  >
                    Cancel
                  </button>
                ) : (
                  <button
                    type="button"
                    className={c('btn quiet')}
                    disabled={preparing}
                    onClick={() => {
                      form.reset({ device_id: 'manual' });
                      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
                      previewUrl.current = '';
                      setSrc('');
                      setResult(null);
                      setError('');
                    }}
                  >
                    Reset
                  </button>
                )}
              </div>
            </form>
          </Panel>
          <Panel
            title="Result"
            aside={
              result && result.detections.length > 0 ? (
                <SeverityTag confidence={maximum} />
              ) : undefined
            }
          >
            {!result ? (
              <Empty>
                {busy
                  ? 'Waiting for the model response…'
                  : 'Submit a frame to see detections, confidence scores, and bounding boxes.'}
              </Empty>
            ) : (
              <div className={c('form-stack')}>
                <h2 className={c('result-title')}>
                  {result.pothole_detected ? 'Pothole confirmed' : 'No confirmed pothole'}
                </h2>
                {src && <ImagePreview src={src} detections={result.detections} />}
                <dl className={c('kv')}>
                  <dt>Record ID</dt>
                  <dd className={c('mono')}>{result.id || 'Not saved'}</dd>
                  <dt>Objects found</dt>
                  <dd>{result.detections.length}</dd>
                  <dt>Max confidence</dt>
                  <dd>{maximum.toFixed(4)}</dd>
                  <dt>Nearest region</dt>
                  <dd>{nearestRegion(result.coordinates)}</dd>
                  <dt>Coordinates</dt>
                  <dd className={c('mono')}>
                    {result.coordinates.lat.toFixed(5)}, {result.coordinates.lng.toFixed(5)}
                  </dd>
                  <dt>Analysed</dt>
                  <dd>{dateTime(result.timestamp)}</dd>
                  <dt>Storage</dt>
                  <dd>
                    {stats.data?.mock_mode
                      ? 'Mock save; not persisted'
                      : !stats.data
                        ? 'Storage mode unverified'
                        : result.id
                          ? 'Saved'
                          : 'Not saved'}
                  </dd>
                </dl>
                {result.detections.length > 0 && (
                  <div className={c('table-wrap')}>
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
                {!result.pothole_detected && result.detections.length > 0 && (
                  <Notice label="Threshold">
                    Objects below 0.4 confidence do not trigger a confirmed detection or saved
                    record.
                  </Notice>
                )}
                <Link href="/" className={c('btn quiet')}>
                  See the live map
                </Link>
              </div>
            )}
          </Panel>
        </div>
      </section>
    </>
  );
}
