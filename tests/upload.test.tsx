// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UploadForm } from '@/components/features/detection/upload-form';
import { ImagePreview } from '@/components/features/detection/image-preview';
const mocks = vi.hoisted(() => ({ detect: vi.fn(), toast: vi.fn(), mutate: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ detectImage: mocks.detect }));
vi.mock('swr', () => ({ useSWRConfig: () => ({ mutate: mocks.mutate }) }));
vi.mock('@/components/layout/providers', () => ({
  useConsole: () => ({ role: 'gha', admin: false, toast: mocks.toast }),
  useHealth: () => ({ data: { pothole_model_ready: true } }),
  useStats: () => ({ data: { mock_mode: false } }),
}));
const positive = {
  id: 'saved-id',
  pothole_detected: true,
  detections: [
    { label: 'pothole', confidence: 0.92, bbox: { x1: 180, y1: 180, x2: 340, y2: 280 } },
  ],
  coordinates: { lat: 5.6, lng: -0.18 },
  device_id: 'manual',
  timestamp: '2026-10-04T21:00:00Z',
};
async function fillForm() {
  const user = userEvent.setup();
  await user.upload(
    screen.getByLabelText('Road image'),
    new File(['fixture-image'], 'road.png', { type: 'image/png' }),
  );
  await screen.findByText('road.png');
  fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '5.6' } });
  fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '-.18' } });
  return user;
}
describe('interactive upload form', () => {
  beforeEach(() => {
    mocks.detect.mockReset();
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
  it('rejects invalid coordinates before calling inference', async () => {
    render(<UploadForm />);
    const user = await fillForm();
    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '1' } });
    await user.click(screen.getByRole('button', { name: 'Run detection' }));
    expect(await screen.findByText('Latitude must be at least 4.5.')).toBeTruthy();
    expect(mocks.detect).not.toHaveBeenCalled();
  });
  it('submits the selected file and displays real detection metadata', async () => {
    mocks.detect.mockResolvedValue(positive);
    render(<UploadForm />);
    const user = await fillForm();
    await user.click(screen.getByRole('button', { name: 'Run detection' }));
    expect(await screen.findByRole('heading', { name: 'Pothole confirmed' })).toBeTruthy();
    expect(screen.getByText('saved-id')).toBeTruthy();
    expect(mocks.detect.mock.calls[0][0]).toMatchObject({
      lat: 5.6,
      lng: -0.18,
      device_id: 'manual',
    });
    expect(mocks.detect.mock.calls[0][0].image.name).toBe('road.png');
  });
  it('shows a negative result without fabricating persistence', async () => {
    mocks.detect.mockResolvedValue({
      ...positive,
      id: null,
      pothole_detected: false,
      detections: [],
    });
    render(<UploadForm />);
    const user = await fillForm();
    await user.click(screen.getByRole('button', { name: 'Run detection' }));
    expect(await screen.findByRole('heading', { name: 'No confirmed pothole' })).toBeTruthy();
    expect(screen.getAllByText('Not saved')).toHaveLength(2);
    expect(screen.queryByText('saved-id')).toBeNull();
  });
  it('renders failures and restores the submit control', async () => {
    mocks.detect.mockRejectedValue(new Error('Pothole model unavailable.'));
    render(<UploadForm />);
    const user = await fillForm();
    await user.click(screen.getByRole('button', { name: 'Run detection' }));
    expect(await screen.findByText('Pothole model unavailable.')).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Run detection' }).hasAttribute('disabled')).toBe(
        false,
      ),
    );
    expect(screen.queryByRole('heading', { name: 'Pothole confirmed' })).toBeNull();
  });
  it('renders boxes against natural image dimensions instead of a fixed frame', () => {
    render(<ImagePreview src="blob:test" detections={positive.detections} />);
    const image = screen.getByAltText('Uploaded road image');
    Object.defineProperty(image, 'naturalWidth', { configurable: true, value: 1280 });
    Object.defineProperty(image, 'naturalHeight', { configurable: true, value: 720 });
    fireEvent.load(image);
    expect(screen.getByRole('img', { name: '1 detected potholes' }).getAttribute('viewBox')).toBe(
      '0 0 1280 720',
    );
  });
});
