// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UploadForm } from '../components/features/detection/upload-form';
import { ImagePreview } from '../components/features/detection/image-preview';

const mocks = vi.hoisted(() => ({
  submit: vi.fn(),
  analyze: vi.fn(),
  toast: vi.fn(),
  mutate: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  submitImage: mocks.submit,
  analyzeDetection: mocks.analyze,
}));

vi.mock('swr', () => ({ useSWRConfig: () => ({ mutate: mocks.mutate }), default: () => ({ data: undefined }) }));

vi.mock('@/components/layout/providers', () => ({
  useConsole: () => ({ role: 'gha', admin: true, toast: mocks.toast }),
  useHealth: () => ({ data: { pothole_model_ready: true } }),
  useStats: () => ({ data: { mock_mode: false } }),
  useStorageMode: () => ({ data: { mock_mode: false } }),
}));

const positiveSubmission = {
  id: 'saved-id',
  message: 'Pothole report submitted successfully.',
  status: 'pending',
  device_id: 'Test Device',
  coordinates: { lat: 5.6, lng: -0.18 },
  image_url: '/api/v1/images/saved-id',
  timestamp: '2026-10-04T21:00:00Z',
};

const positiveAnalysis = {
  id: 'saved-id',
  pothole_detected: true,
  detections: [
    { label: 'pothole', confidence: 0.92, bbox: { x1: 180, y1: 180, x2: 340, y2: 280 } },
  ],
  coordinates: { lat: 5.6, lng: -0.18 },
  device_id: 'Test Device',
  timestamp: '2026-10-04T21:00:00Z',
  status: 'confirmed',
};

async function fillForm() {
  const user = userEvent.setup();
  await user.upload(
    screen.getByLabelText('Road image'),
    new File(['fixture-image'], 'road.png', { type: 'image/png' }),
  );
  await screen.findByText('road.png');
  await user.click(screen.getByRole('button', { name: 'Manual coordinates' }));
  fireEvent.change(screen.getByLabelText(/Latitude/i), { target: { value: '5.6' } });
  fireEvent.change(screen.getByLabelText(/Longitude/i), { target: { value: '-.18' } });
  return user;
}

describe('interactive upload form', () => {
  beforeEach(() => {
    mocks.submit.mockReset();
    mocks.analyze.mockReset();
    mocks.toast.mockReset();
    mocks.mutate.mockResolvedValue(undefined);
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 640, height: 360, close: vi.fn() })),
    );
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:test-image'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('rejects invalid coordinates before calling submit', async () => {
    render(<UploadForm />);
    const user = await fillForm();
    fireEvent.change(screen.getByLabelText(/Latitude/i), { target: { value: '1' } });
    await user.click(screen.getByRole('button', { name: 'Submit report' }));
    expect(await screen.findByText('Latitude must be at least 4.5.')).toBeTruthy();
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it('submits the selected file and displays view stats button', async () => {
    mocks.submit.mockResolvedValue(positiveSubmission);
    mocks.analyze.mockResolvedValue(positiveAnalysis);

    render(<UploadForm />);
    const user = await fillForm();
    await user.click(screen.getByRole('button', { name: 'Submit report' }));

    expect(await screen.findByText('Report Submitted Successfully')).toBeTruthy();
    expect(screen.getByText('saved-id')).toBeTruthy();

    const viewStatsBtn = screen.getByRole('button', { name: 'View Stats / Detection Report' });
    expect(viewStatsBtn).toBeTruthy();

    await user.click(viewStatsBtn);
    expect(await screen.findByRole('heading', { name: 'Pothole confirmed' })).toBeTruthy();
  });

  it('renders boxes against natural image dimensions instead of a fixed frame', () => {
    render(<ImagePreview src="blob:test" detections={positiveAnalysis.detections} />);
    const image = screen.getByAltText('Uploaded road image');
    Object.defineProperty(image, 'naturalWidth', { configurable: true, value: 1280 });
    Object.defineProperty(image, 'naturalHeight', { configurable: true, value: 720 });
    fireEvent.load(image);
    expect(screen.getByRole('img', { name: '1 detected potholes' }).getAttribute('viewBox')).toBe(
      '0 0 1280 720',
    );
  });
});
