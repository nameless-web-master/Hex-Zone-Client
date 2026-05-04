const DEVICE_HID_STORAGE_KEY = "zoneweaver_device_hid";
const GUEST_HID_STORAGE_KEY = "zoneweaver_guest_hid";

function buildBrowserDerivedDeviceId(): string {
  const seed = `${navigator.userAgent}|${navigator.language}|${navigator.platform}`;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  const suffix = hash.toString(36).toUpperCase().slice(0, 10).padEnd(10, "X");
  return `WEB-${suffix}`;
}

/** Stable-ish device identifier for anonymous guest access (no auth). */
export function resolveGuestBrowserDeviceId(): string {
  const knownHid = String(
    localStorage.getItem(DEVICE_HID_STORAGE_KEY) ??
      localStorage.getItem(GUEST_HID_STORAGE_KEY) ??
      "",
  ).trim();
  if (knownHid) return knownHid;
  const derived = buildBrowserDerivedDeviceId();
  localStorage.setItem(GUEST_HID_STORAGE_KEY, derived);
  return derived;
}
