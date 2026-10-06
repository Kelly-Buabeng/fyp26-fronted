/**
 * Utility to fetch or autogenerate a clean device name / device ID
 * based on the user's browser, platform, and operating system.
 */
export function getDeviceName(): string {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'Web Device';
  }

  const storageKey = 'roadwatch_device_name';
  let cachedName = '';
  try {
    cachedName = localStorage.getItem(storageKey) || '';
  } catch {
    // ignore
  }

  if (cachedName) {
    return cachedName;
  }

  const ua = navigator.userAgent;

  let os = 'Desktop';
  if (/android/i.test(ua)) os = 'Android Device';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS Device';
  else if (/Win/i.test(ua)) os = 'Windows PC';
  else if (/Mac/i.test(ua)) os = 'Mac Workstation';
  else if (/Linux/i.test(ua)) os = 'Linux Terminal';

  let browser = 'Browser';
  if (/Edg/i.test(ua)) browser = 'MS Edge';
  else if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Google Chrome';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';

  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const generated = `${browser} (${os}) - #${randomSuffix}`;

  try {
    localStorage.setItem(storageKey, generated);
  } catch {
    // ignore
  }

  return generated;
}
