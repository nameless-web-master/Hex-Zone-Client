import type { CachedDeviceSettings } from "./api";

export type RegisteredUser = {
  id: string;
  displayName: string;
  email: string;
};

const DEVICES_KEY = "zoneweaver_local_devices";
const SETTINGS_KEY = "zoneweaver_device_settings_by_hid";
const ASSIGN_KEY = "zoneweaver_device_assignments";

export type DeviceAssignment = {
  user_display_name: string;
  user_email: string;
};

export type LocalManagedDevice = {
  id: number;
  hid: string;
  name: string;
  user_display_name: string;
  user_email: string;
  assigned_user_id: string;
  active?: boolean;
  updated_at?: string;
  status?: string;
  error_message?: string;
  h3_cell_id?: string;
  local_only: true;
};

export function loadLocalDevices(): LocalManagedDevice[] {
  try {
    const raw = localStorage.getItem(DEVICES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalManagedDevice[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalDevices(devices: LocalManagedDevice[]) {
  localStorage.setItem(DEVICES_KEY, JSON.stringify(devices));
}

export function appendLocalDevice(device: LocalManagedDevice) {
  const list = loadLocalDevices();
  saveLocalDevices([...list, device]);
}

export function updateLocalDevice(
  hid: string,
  patch: Partial<LocalManagedDevice>,
) {
  const list = loadLocalDevices();
  const next = list.map((d) => (d.hid === hid ? { ...d, ...patch } : d));
  saveLocalDevices(next);
}

export function readSettingsByHid(): Record<string, CachedDeviceSettings> {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw) as Record<string, CachedDeviceSettings>;
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

export function writeSettingsByHid(map: Record<string, CachedDeviceSettings>) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(map));
}

export function getSettingsForHid(hid: string): CachedDeviceSettings | undefined {
  const row = readSettingsByHid()[hid];
  if (!row) return undefined;
  // Migrate legacy keys from older UI
  const legacy = row as Record<string, unknown>;
  if (legacy.enable_notification === undefined && legacy.notifications_enabled !== undefined) {
    return {
      ...row,
      enable_notification: Boolean(legacy.notifications_enabled),
    };
  }
  return row;
}

export function setSettingsForHid(hid: string, payload: CachedDeviceSettings) {
  const map = readSettingsByHid();
  map[hid] = { ...map[hid], ...payload };
  writeSettingsByHid(map);
}

export function mergeApiAndLocalDevices<T extends { hid: string }>(
  apiDevices: T[],
  localDevices: LocalManagedDevice[],
): (T | LocalManagedDevice)[] {
  const apiHids = new Set(apiDevices.map((d) => d.hid));
  const extraLocal = localDevices.filter((d) => !apiHids.has(d.hid));
  return [...apiDevices, ...extraLocal];
}

function readAssignments(): Record<string, DeviceAssignment> {
  try {
    const raw = localStorage.getItem(ASSIGN_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw) as Record<string, DeviceAssignment>;
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

export function setDeviceAssignment(hid: string, assignment: DeviceAssignment) {
  const m = readAssignments();
  m[hid] = assignment;
  localStorage.setItem(ASSIGN_KEY, JSON.stringify(m));
}

/** Merge stored user assignment (set when adding a device) onto API rows that omit it. */
export function applyDeviceAssignments<
  T extends { hid: string; user_display_name?: string; user_email?: string },
>(devices: T[]): T[] {
  const m = readAssignments();
  return devices.map((d) => ({
    ...d,
    user_display_name: d.user_display_name ?? m[d.hid]?.user_display_name,
    user_email: d.user_email ?? m[d.hid]?.user_email,
  }));
}
