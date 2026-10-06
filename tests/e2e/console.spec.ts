import { test, expect } from '@playwright/test';
import path from 'node:path';
async function signIn(page: import('@playwright/test').Page) {
  await page.getByLabel('Email address', { exact: true }).fill('authority@rha.com');
  await page.getByLabel('Password', { exact: true }).fill('fixture-authority-password');
  await page.getByRole('button', { name: 'Sign in to Roadwatch', exact: true }).click();
}
const image = path.resolve('tests/fixtures/road.png');
test.beforeEach(async ({ request }) => {
  await request.post('http://127.0.0.1:8001/__scenario', { data: { scenario: 'normal' } });
});
test('public navigation stays limited and authority login reveals aggregate screens', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('Model ready', { exact: true })).toBeVisible();
  await expect(page.getByText('Live network · 2 locations')).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link'),
  ).toHaveCount(2);
  await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Authority login', exact: true }).click();
  await signIn(page);
  await expect(
    page.getByRole('heading', { name: 'Road intelligence overview' }),
  ).toBeVisible();
  await expect(page.getByText('Greater Accra', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Regional report', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Greater Accra', exact: true })).toBeVisible();
});
test('upload uses multipart fields and renders pixel bounding boxes', async ({ page, request }) => {
  await page.goto('/detect');
  await page.getByLabel('Road image', { exact: true }).setInputFiles(image);
  await page.getByLabel('Latitude', { exact: true }).fill('5.60374');
  await page.getByLabel('Longitude', { exact: true }).fill('-0.18701');
  await page.getByRole('button', { name: 'Submit report', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pothole confirmed' })).toBeVisible();
  await expect(page.getByRole('img', { name: '1 detected potholes' })).toHaveAttribute(
    'viewBox',
    '0 0 640 360',
  );
  const upload = await (await request.get('http://127.0.0.1:8001/__upload')).json();
  expect(upload.fields).toEqual(['device_id', 'image', 'lat', 'lng']);
  expect(upload.imageType).toBe('image/png');
  expect(upload.lat).toBe(5.60374);
});
test('negative inference does not claim a saved record', async ({ page }) => {
  await page.goto('/login');
  await signIn(page);
  await expect(page).toHaveURL('/dashboard');
  await page.goto('/detect');
  await page.getByLabel('Road image', { exact: true }).setInputFiles(image);
  await page.getByLabel('Latitude', { exact: true }).fill('5.6');
  await page.getByLabel('Longitude', { exact: true }).fill('-.18');
  await page.getByLabel('Device ID', { exact: true }).fill('no-potholes');
  await page.getByRole('button', { name: 'Run detection', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No confirmed pothole' })).toBeVisible();
  await expect(page.getByText('Not saved', { exact: true }).first()).toBeVisible();
});
test('invalid location and unsupported media are rejected before inference', async ({
  page,
  request,
}) => {
  await page.goto('/detect');
  await page.getByLabel('Road image', { exact: true }).setInputFiles({
    name: 'clip.mp4',
    mimeType: 'video/mp4',
    buffer: Buffer.from('invalid-video'),
  });
  await expect(
    page.getByText('Choose an image file. Video uploads are not supported by the backend.'),
  ).toBeVisible();
  await page.getByLabel('Road image', { exact: true }).setInputFiles(image);
  await page.getByLabel('Latitude', { exact: true }).fill('1');
  await page.getByLabel('Longitude', { exact: true }).fill('0');
  await page.getByRole('button', { name: 'Submit report', exact: true }).click();
  await expect(page.getByText('Latitude must be at least 4.5.')).toBeVisible();
  expect(await (await request.get('http://127.0.0.1:8001/__upload')).json()).toBeNull();
});
test('RHA endpoints enforce sessions and request origins', async ({ request }) => {
  expect((await request.get('/api/backend/detections/export?format=geojson')).status()).toBe(401);
  expect(
    (
      await request.delete('/api/backend/detections/11111111-1111-4111-8111-111111111111', {
        headers: { Origin: 'http://localhost:3000' },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post('/api/auth', {
        headers: { Origin: 'https://attacker.example' },
        data: { email: 'authority@rha.com', password: 'fixture-authority-password' },
      })
    ).status(),
  ).toBe(403);
});
test('RHA login, export, deletion, and sign-out work', async ({ page }) => {
  await page.goto('/detections');
  await expect(page).toHaveURL(/\/login\?next=/);
  await signIn(page);
  await expect(page.getByRole('cell', { name: '11111111', exact: true })).toBeVisible();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV', exact: true }).click();
  expect((await downloading).suggestedFilename()).toBe('detections.csv');
  await page
    .getByRole('button', {
      name: 'Delete detection 11111111-1111-4111-8111-111111111111',
      exact: true,
    })
    .click();
  await page.getByRole('button', { name: 'Delete record', exact: true }).click();
  await expect(page.getByRole('cell', { name: '11111111', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('link', { name: 'Authority login', exact: true })).toBeVisible();
  await page.goto('/detections');
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
});
test('model failures surface without fabricated results', async ({ page, request }) => {
  await request.post('http://127.0.0.1:8001/__scenario', {
    data: { scenario: 'model-unavailable' },
  });
  await page.goto('/detect');
  await page.getByLabel('Road image', { exact: true }).setInputFiles(image);
  await page.getByLabel('Latitude', { exact: true }).fill('5.6');
  await page.getByLabel('Longitude', { exact: true }).fill('-.18');
  await page.getByRole('button', { name: 'Submit report', exact: true }).click();
  await expect(page.getByText('Pothole detection model is not available.').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pothole confirmed' })).toHaveCount(0);
});
test('mobile screens fit the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ['/', '/detect', '/login']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await page.goto('/login');
  await signIn(page);
  await expect(page).toHaveURL('/dashboard');
  for (const route of ['/dashboard', '/report', '/devices', '/detections']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await page.goto('/detect');
  await page.screenshot({ path: 'test-results/mobile-detection.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'test-results/desktop-detection.png', fullPage: true });
});
