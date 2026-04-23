import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createDevice,
  fetchDevice,
  fetchDevices,
  sendDeviceHeartbeat,
  updateDevice,
  type CachedDeviceSettings,
  type CreateDevicePayload,
  type DeviceResponse,
  type UpdateDevicePayload,
} from "../lib/api";
import { getMembers } from "../services/api/members";
import {
  appendLocalDevice,
  applyDeviceAssignments,
  getSettingsForHid,
  loadLocalDevices,
  mergeApiAndLocalDevices,
  setDeviceAssignment,
  setSettingsForHid,
  updateLocalDevice,
  type LocalManagedDevice,
  type RegisteredUser,
} from "../lib/deviceManagerStorage";
import { useAuth } from "../hooks/useAuth";
import { AddressAutocompleteInput } from "../components/AddressAutocompleteInput";
import { AlertTriangle, CircleDot, Plus, Smartphone, X } from "lucide-react";

const ACCENT = "#00E5D1";
const H3_RESOLUTION = 10;
const WEB_DEVICE_HID_KEY = "zoneweaver_device_hid";
const DM_ADDRESS_LABEL =
  "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500";
const DM_ADDRESS_INPUT =
  "w-full rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-[#00E5D1] focus:outline-none focus:ring-2 focus:ring-[#00E5D1]/30";
const DEVICE_LIMIT_MESSAGE_BY_ACCOUNT = {
  PRIVATE: "Private accounts can register up to 1 device.",
  EXCLUSIVE: "Exclusive accounts are limited to 1 device.",
  PRIVATE_PLUS: "Private+ accounts can register up to 10 devices.",
  ENHANCED: "Enhanced accounts are limited to 1 device.",
  ENHANCED_PLUS: "",
} as const;

type Device = DeviceResponse & {
  /** Person shown in the Devices "User" column (from assignment or API). */
  user_display_name?: string;
  user_email?: string;
  assigned_user_id?: string;
  /** When present, overrides connectivity for UI (online | offline | error). */
  status?: string;
  error_message?: string;
  /** Saved only in this browser when the API cannot create the device. */
  local_only?: boolean;
};

type UiStatus = "online" | "offline" | "error";

function slugUsername(displayName: string): string {
  return displayName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9.]/g, "");
}

function zoneLabel(h3?: string | null): string {
  if (!h3 || h3.length < 6) return "ZN-4F8A2C";
  return `ZN-${h3
    .replace(/[^a-f0-9]/gi, "")
    .slice(0, 6)
    .toUpperCase()}`;
}

function deriveUiStatus(device: Device): UiStatus {
  if (device.error_message) return "error";
  const raw = device.status;
  if (raw === "error") return "error";
  if (raw === "offline") return "offline";
  if (raw === "online") return "online";
  if (device.is_online === false) return "offline";
  if (device.is_online === true) return "online";
  if (device.active === false) return "offline";
  return "online";
}

function formatLastSeen(device: Device): string {
  const t = device.last_seen ?? device.updated_at;
  return t ? new Date(t).toLocaleString() : "—";
}

function statusBadgeClass(status: UiStatus): string {
  if (status === "online") return "bg-emerald-500/15 text-emerald-300";
  if (status === "error") return "bg-amber-500/15 text-amber-200";
  return "bg-slate-700/50 text-slate-400";
}

function userRowStatusClass(active: boolean): string {
  return active ? "font-medium text-emerald-300" : "font-medium text-slate-500";
}

function generateDeviceHid(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i += 1) {
    s += chars[Math.floor(Math.random() * chars.length)]!;
  }
  return `DEV-${s}`;
}

function isLocalOnlyDevice(d: Device): boolean {
  return Boolean(d.local_only) || d.id < 0;
}

/** Normalizes to `DEV-` + alphanumeric suffix (min 3 chars after the prefix). */
function normalizeDeviceHidInput(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  let suffix: string;
  if (upper.startsWith("DEV-")) {
    suffix = upper.slice(4).replace(/[^A-Z0-9]/g, "");
  } else {
    suffix = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  }
  if (suffix.length < 3) return null;
  return `DEV-${suffix}`;
}

function mapMembersToRegisteredUsers(data: unknown): RegisteredUser[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((m) => {
      const row = m as Record<string, unknown>;
      const id = row.id;
      if (id == null || id === "") return null;
      const first = String(row.first_name ?? "");
      const last = String(row.last_name ?? "");
      const name = String(row.name ?? "");
      const displayName = `${first} ${last}`.trim() || name || `User ${id}`;
      const email = String(row.email ?? "");
      return { id: String(id), displayName, email } satisfies RegisteredUser;
    })
    .filter((u): u is RegisteredUser => u !== null);
}

function ownerForDevice(
  device: Device,
  owners: RegisteredUser[],
): RegisteredUser | undefined {
  if (device.owner?.id != null) {
    const first = String(device.owner.first_name ?? "").trim();
    const last = String(device.owner.last_name ?? "").trim();
    const displayName =
      `${first} ${last}`.trim() ||
      device.owner.email?.trim() ||
      `User ${device.owner.id}`;
    return {
      id: String(device.owner.id),
      displayName,
      email: String(device.owner.email ?? ""),
    };
  }
  const ownerId = device.owner_id != null ? String(device.owner_id) : null;
  if (!ownerId) return undefined;
  return owners.find((o) => o.id === ownerId);
}

type DeviceFormState = {
  name: string;
  address: string;
  propagate_enabled: boolean;
  propagate_radius_km: number;
  enable_notification: boolean;
  alert_threshold_meters: number;
  update_interval_seconds: number;
};

function defaultForm(device: Device): DeviceFormState {
  return {
    name: device.name ?? "",
    address: device.address ?? "",
    propagate_enabled: device.propagate_enabled ?? true,
    propagate_radius_km: Number(device.propagate_radius_km ?? 2.5),
    enable_notification: device.enable_notification ?? true,
    alert_threshold_meters: Number(device.alert_threshold_meters ?? 100),
    update_interval_seconds: Number(device.update_interval_seconds ?? 30),
  };
}

type NormalizedAccountType =
  | "PRIVATE"
  | "EXCLUSIVE"
  | "PRIVATE_PLUS"
  | "ENHANCED"
  | "ENHANCED_PLUS";

function normalizeAccountType(
  accountType?: string | null,
  legacyAccountType?: string | null,
): NormalizedAccountType {
  const upper = String(accountType ?? legacyAccountType ?? "").toUpperCase();
  if (upper === "EXCLUSIVE") return "EXCLUSIVE";
  if (upper === "PRIVATE_PLUS") return "PRIVATE_PLUS";
  if (upper === "ENHANCED") return "ENHANCED";
  if (upper === "ENHANCED_PLUS") return "ENHANCED_PLUS";
  return "PRIVATE";
}

function getDeviceLimit(accountType: NormalizedAccountType): number {
  if (accountType === "PRIVATE") return 1;
  if (accountType === "PRIVATE_PLUS") return 10;
  if (accountType === "EXCLUSIVE" || accountType === "ENHANCED") return 1;
  return Number.POSITIVE_INFINITY;
}

function remoteToForm(
  remote: DeviceResponse,
  fallback: Device,
): DeviceFormState {
  return {
    name: remote.name ?? fallback.name ?? "",
    address: String(remote.address ?? fallback.address ?? ""),
    propagate_enabled:
      remote.propagate_enabled ?? fallback.propagate_enabled ?? true,
    propagate_radius_km: Number(
      remote.propagate_radius_km ?? fallback.propagate_radius_km ?? 2.5,
    ),
    enable_notification:
      remote.enable_notification ?? fallback.enable_notification ?? true,
    alert_threshold_meters: Number(
      remote.alert_threshold_meters ?? fallback.alert_threshold_meters ?? 100,
    ),
    update_interval_seconds: Number(
      remote.update_interval_seconds ?? fallback.update_interval_seconds ?? 30,
    ),
  };
}

export default function DeviceManager() {
  const { user } = useAuth();
  const normalizedAccountType = normalizeAccountType(
    user?.accountType,
    user?.account_type,
  );
  const currentWebHid = useMemo(
    () => String(localStorage.getItem(WEB_DEVICE_HID_KEY) ?? "").toUpperCase(),
    [],
  );
  const isExclusiveAccount = normalizedAccountType === "EXCLUSIVE";
  const [devices, setDevices] = useState<Device[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawerDevice, setDrawerDevice] = useState<Device | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [heartbeatBusy, setHeartbeatBusy] = useState(false);
  const [form, setForm] = useState<DeviceFormState>({
    name: "",
    address: "",
    propagate_enabled: true,
    propagate_radius_km: 2.5,
    enable_notification: true,
    alert_threshold_meters: 100,
    update_interval_seconds: 30,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({
    userId: "",
    hid: "",
    deviceName: "",
    address: "123 Main St, Anytown",
    latitude: 47.6205,
    longitude: -122.3493,
    propagate_enabled: true,
    propagate_radius_km: 2.5,
    enable_notification: true,
    alert_threshold_meters: 150,
    update_interval_seconds: 120,
  });

  const loadRegisteredOwners = useCallback(async (): Promise<
    RegisteredUser[]
  > => {
    if (!user) {
      setRegisteredUsers([]);
      setUsersError(null);
      return [];
    }
    setUsersLoading(true);
    setUsersError(null);
    try {
      const result = await getMembers();
      const list = mapMembersToRegisteredUsers(result.data ?? []);
      setRegisteredUsers(list);
      return list;
    } catch {
      setRegisteredUsers([]);
      setUsersError(
        "Could not load registered users. Check your session and GET /members.",
      );
      return [];
    } finally {
      setUsersLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadRegisteredOwners();
  }, [loadRegisteredOwners]);

  const loadDevices = useCallback(() => {
    return fetchDevices()
      .then((data: DeviceResponse[]) => {
        const apiList = Array.isArray(data) ? data : [];
        const localList = loadLocalDevices();
        const merged = applyDeviceAssignments(
          mergeApiAndLocalDevices(apiList, localList) as Device[],
        );
        setDevices(merged as Device[]);
      })
      .catch(() => {
        const localList = loadLocalDevices();
        setDevices(
          applyDeviceAssignments(localList as unknown as Device[]) as Device[],
        );
      });
  }, []);

  useEffect(() => {
    loadDevices().finally(() => setLoading(false));
  }, [loadDevices]);

  useEffect(() => {
    const id = window.setInterval(() => {
      loadDevices();
    }, 45_000);
    return () => window.clearInterval(id);
  }, [loadDevices]);

  const openSettings = useCallback(async (device: Device) => {
    setDrawerDevice(device);
    setSettingsError(null);
    setSettingsLoading(true);
    const defaults = defaultForm(device);
    const cached = getSettingsForHid(device.hid) as
      | CachedDeviceSettings
      | undefined;

    if (isLocalOnlyDevice(device)) {
      setForm({
        name: cached?.name ?? device.name ?? defaults.name,
        address: cached?.address ?? device.address ?? defaults.address,
        propagate_enabled:
          cached?.propagate_enabled ?? defaults.propagate_enabled,
        propagate_radius_km: Number(
          cached?.propagate_radius_km ?? defaults.propagate_radius_km,
        ),
        enable_notification:
          cached?.enable_notification ?? defaults.enable_notification,
        alert_threshold_meters: Number(
          cached?.alert_threshold_meters ?? defaults.alert_threshold_meters,
        ),
        update_interval_seconds: Number(
          cached?.update_interval_seconds ?? defaults.update_interval_seconds,
        ),
      });
      setSettingsLoading(false);
      return;
    }

    try {
      const remote = await fetchDevice(device.id);
      setForm(remoteToForm(remote, device));
      setDrawerDevice({ ...device, ...remote });
    } catch {
      setForm({
        name: cached?.name ?? defaults.name,
        address: cached?.address ?? defaults.address,
        propagate_enabled:
          cached?.propagate_enabled ?? defaults.propagate_enabled,
        propagate_radius_km: Number(
          cached?.propagate_radius_km ?? defaults.propagate_radius_km,
        ),
        enable_notification:
          cached?.enable_notification ?? defaults.enable_notification,
        alert_threshold_meters: Number(
          cached?.alert_threshold_meters ?? defaults.alert_threshold_meters,
        ),
        update_interval_seconds: Number(
          cached?.update_interval_seconds ?? defaults.update_interval_seconds,
        ),
      });
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!drawerDevice || isLocalOnlyDevice(drawerDevice)) return;
    const tick = window.setInterval(() => {
      fetchDevice(drawerDevice.id)
        .then((remote) => {
          setForm(remoteToForm(remote, drawerDevice));
          setDrawerDevice((d) =>
            d && d.id === drawerDevice.id ? { ...d, ...remote } : d,
          );
        })
        .catch(() => {});
    }, 12_000);
    return () => window.clearInterval(tick);
  }, [drawerDevice?.id]);

  const closeDrawer = () => {
    setDrawerDevice(null);
    setSettingsError(null);
  };

  const saveSettings = async () => {
    if (!drawerDevice) return;
    setSettingsSaving(true);
    setSettingsError(null);
    const payload: UpdateDevicePayload = {
      name: form.name.trim() || drawerDevice.name,
      address: form.address.trim() || undefined,
      propagate_enabled: form.propagate_enabled,
      propagate_radius_km: form.propagate_radius_km,
      enable_notification: form.enable_notification,
      alert_threshold_meters: form.alert_threshold_meters,
      update_interval_seconds: form.update_interval_seconds,
    };

    if (isLocalOnlyDevice(drawerDevice)) {
      try {
        setSettingsForHid(drawerDevice.hid, payload);
        updateLocalDevice(drawerDevice.hid, {
          name: payload.name ?? drawerDevice.name,
          updated_at: new Date().toISOString(),
        });
        setDevices((prev) =>
          prev.map((d) =>
            d.hid === drawerDevice.hid
              ? {
                  ...d,
                  name: payload.name ?? d.name,
                  address: payload.address ?? d.address,
                  propagate_enabled: payload.propagate_enabled,
                  propagate_radius_km: payload.propagate_radius_km,
                  enable_notification: payload.enable_notification,
                  alert_threshold_meters: payload.alert_threshold_meters,
                  update_interval_seconds: payload.update_interval_seconds,
                }
              : d,
          ),
        );
        setDrawerDevice((d) =>
          d && d.hid === drawerDevice.hid
            ? {
                ...d,
                name: payload.name ?? d.name,
                address: payload.address ?? d.address,
                propagate_enabled: payload.propagate_enabled,
                propagate_radius_km: payload.propagate_radius_km,
                enable_notification: payload.enable_notification,
                alert_threshold_meters: payload.alert_threshold_meters,
                update_interval_seconds: payload.update_interval_seconds,
              }
            : d,
        );
        closeDrawer();
      } catch {
        setSettingsError("Could not save settings to browser storage.");
      } finally {
        setSettingsSaving(false);
      }
      return;
    }

    try {
      const updated = await updateDevice(drawerDevice.id, payload);
      setSettingsForHid(drawerDevice.hid, payload);
      setDevices((prev) =>
        prev.map((d) => (d.id === drawerDevice.id ? { ...d, ...updated } : d)),
      );
      setDrawerDevice((d) =>
        d && d.id === drawerDevice.id ? { ...d, ...updated } : d,
      );
      closeDrawer();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? String(
              (e as { response?: { data?: { detail?: string } } }).response
                ?.data?.detail,
            )
          : "Could not save settings. Use PATCH /devices/{device_id}.";
      setSettingsError(msg || "Could not save settings.");
    } finally {
      setSettingsSaving(false);
    }
  };

  const onSendHeartbeat = async () => {
    if (!drawerDevice || isLocalOnlyDevice(drawerDevice)) return;
    setHeartbeatBusy(true);
    setSettingsError(null);
    try {
      await sendDeviceHeartbeat(drawerDevice.id);
      await loadDevices();
      const fresh = await fetchDevice(drawerDevice.id);
      setDrawerDevice((d) =>
        d && d.id === drawerDevice.id ? { ...d, ...fresh } : d,
      );
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? String(
              (e as { response?: { data?: { detail?: string } } }).response
                ?.data?.detail,
            )
          : "Heartbeat failed.";
      setSettingsError(msg || "Could not send heartbeat.");
    } finally {
      setHeartbeatBusy(false);
    }
  };

  const openAddModal = () => {
    setAddError(null);
    setModalOpen(true);
    void loadRegisteredOwners().then((list) => {
      setAddForm({
        userId: list[0]?.id ?? "",
        hid: generateDeviceHid(),
        deviceName: "",
        address: "123 Main St, Anytown",
        latitude: 47.6205,
        longitude: -122.3493,
        propagate_enabled: true,
        propagate_radius_km: 2.5,
        enable_notification: true,
        alert_threshold_meters: 150,
        update_interval_seconds: 120,
      });
    });
  };

  const closeAddModal = useCallback(() => {
    setModalOpen(false);
    setAddError(null);
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAddModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, closeAddModal]);

  useEffect(() => {
    if (!modalOpen) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, [modalOpen]);

  const handleAddDevice = async () => {
    const ru = registeredUsers.find((u) => u.id === addForm.userId);
    if (!ru) {
      setAddError("Select a registered user.");
      return;
    }
    const normalizedHid =
      normalizeDeviceHidInput(addForm.hid) ?? generateDeviceHid();
    if (
      devices.some((d) => d.hid.toLowerCase() === normalizedHid.toLowerCase())
    ) {
      setAddError("This Device ID is already in use.");
      return;
    }
    const deviceLimit = getDeviceLimit(normalizedAccountType);
    if (devices.length >= deviceLimit) {
      setAddError(
        DEVICE_LIMIT_MESSAGE_BY_ACCOUNT[normalizedAccountType] ||
          "This account has reached its device limit.",
      );
      return;
    }
    const deviceLabel =
      addForm.deviceName.trim() ||
      `${(ru.displayName.split(/\s+/)[0] || "User").replace(/[^a-zA-Z]/g, "") || "User"} Device`;

    setAddSubmitting(true);
    setAddError(null);

    const createPayload: CreateDevicePayload = {
      hid: normalizedHid,
      name: deviceLabel,
      address: addForm.address.trim() || "123 Main St, Anytown",
      latitude: addForm.latitude,
      longitude: addForm.longitude,
      propagate_enabled: addForm.propagate_enabled,
      propagate_radius_km: addForm.propagate_radius_km,
      enable_notification: addForm.enable_notification,
      alert_threshold_meters: addForm.alert_threshold_meters,
      update_interval_seconds: addForm.update_interval_seconds,
    };

    const cachePayload: CachedDeviceSettings = {
      name: createPayload.name,
      address: createPayload.address,
      propagate_enabled: createPayload.propagate_enabled,
      propagate_radius_km: createPayload.propagate_radius_km,
      enable_notification: createPayload.enable_notification,
      alert_threshold_meters: createPayload.alert_threshold_meters,
      update_interval_seconds: createPayload.update_interval_seconds,
    };

    try {
      await createDevice(createPayload);
      setDeviceAssignment(normalizedHid, {
        user_display_name: ru.displayName,
        user_email: ru.email,
      });
      setSettingsForHid(normalizedHid, cachePayload);
      await loadDevices();
      closeAddModal();
    } catch (e: unknown) {
      const detail =
        e && typeof e === "object" && "response" in e
          ? String(
              (e as { response?: { data?: { detail?: string; message?: string } } })
                .response?.data?.detail ??
                (e as { response?: { data?: { detail?: string; message?: string } } })
                  .response?.data?.message ??
                "",
            )
          : "";
      const status =
        e && typeof e === "object" && "response" in e
          ? Number((e as { response?: { status?: number } }).response?.status ?? 0)
          : 0;
      if (
        status === 403 &&
        /max devices|device limit|limit|forbidden/i.test(detail || "403")
      ) {
        setAddError(
          detail ||
            DEVICE_LIMIT_MESSAGE_BY_ACCOUNT[normalizedAccountType] ||
            "Device limit reached for this account.",
        );
        return;
      }
      const localDev: LocalManagedDevice = {
        id: -Date.now(),
        hid: normalizedHid,
        name: deviceLabel,
        user_display_name: ru.displayName,
        user_email: ru.email,
        assigned_user_id: ru.id,
        active: true,
        updated_at: new Date().toISOString(),
        local_only: true,
      };
      appendLocalDevice(localDev);
      setDeviceAssignment(normalizedHid, {
        user_display_name: ru.displayName,
        user_email: ru.email,
      });
      setSettingsForHid(normalizedHid, cachePayload);
      await loadDevices();
      closeAddModal();
    } finally {
      setAddSubmitting(false);
    }
  };

  const sortedDevices = useMemo(() => {
    const withOwners = devices.map((device) => {
      const owner = ownerForDevice(device, registeredUsers);
      if (!owner) return device;
      return {
        ...device,
        user_display_name: owner.displayName,
        user_email: owner.email,
        owner_id: device.owner_id ?? Number(owner.id),
      };
    });

    const role = String(user?.role ?? "").toLowerCase();
    const currentUserId = String(user?.id ?? "");
    const roleScoped =
      (role === "user" || isExclusiveAccount) && currentUserId
        ? withOwners.filter(
            (device) =>
              String(device.owner_id ?? "") === currentUserId ||
              (!!currentWebHid &&
                String(device.hid ?? "").toUpperCase() === currentWebHid),
          )
        : withOwners;

    return [...roleScoped].sort((a, b) => {
      const dateA = new Date(a.last_seen || a.updated_at || 0).getTime();
      const dateB = new Date(b.last_seen || b.updated_at || 0).getTime();
      return dateB - dateA;
    });
  }, [
    devices,
    registeredUsers,
    user?.id,
    user?.role,
    isExclusiveAccount,
    currentWebHid,
  ]);

  const ownerUsernameSlug = useMemo(() => {
    if (!user?.first_name && !user?.last_name) return "";
    return slugUsername(
      `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim(),
    );
  }, [user?.first_name, user?.last_name]);

  const userRows = useMemo(() => {
    return sortedDevices.map((device) => {
      const personName =
        device.user_display_name?.trim() || device.name?.trim() || device.hid;
      const username = slugUsername(personName) || `device.${device.id}`;
      const email = device.user_email?.trim() || `${username}@geozone.io`;
      const ui = deriveUiStatus(device);
      const active = device.active;
      const ownerActive =
        typeof device.owner?.active === "boolean"
          ? device.owner.active
          : Boolean(active);
      const highlight =
        (!!user?.email &&
          device.user_email?.toLowerCase() === user.email.toLowerCase()) ||
        (!!ownerUsernameSlug && username === ownerUsernameSlug);
      return {
        key: device.id,
        username,
        email,
        deviceId: device.hid,
        zone: zoneLabel(device.h3_cell_id),
        active,
        ownerActive,
        highlight,
      };
    });
  }, [sortedDevices, ownerUsernameSlug, user?.email]);

  const drawerUiStatus: UiStatus | null = drawerDevice
    ? deriveUiStatus(drawerDevice)
    : null;

  const accountLabel =
    user?.accountType === "PRIVATE_PLUS" ||
    user?.account_type === "private_plus"
      ? "Private+"
      : user?.accountType === "ENHANCED_PLUS" ||
          user?.account_type === "enhanced_plus"
        ? "Enhanced+"
        : user?.accountType === "ENHANCED" || user?.account_type === "enhanced"
          ? "Enhanced"
          : user?.accountType === "EXCLUSIVE" ||
              user?.account_type === "exclusive"
            ? "Exclusive"
            : "Private";

  const warningCopy =
    accountLabel === "Private"
      ? `All devices in a Private account must share the same zone type. Each user defines three (3) acceptable zones based on H3 Geospatial Indexing (resolution = ${H3_RESOLUTION}).`
      : accountLabel === "Private+"
        ? `Private+ supports up to 10 devices. Zones use H3 Geospatial Indexing (resolution = ${H3_RESOLUTION}).`
        : accountLabel === "Exclusive" || accountLabel === "Enhanced"
          ? `${accountLabel} accounts support one registered device. Zones use H3 Geospatial Indexing (resolution = ${H3_RESOLUTION}).`
          : `Enhanced+ has no device cap. Zones use H3 Geospatial Indexing (resolution = ${H3_RESOLUTION}).`;

  return (
    <div className="space-y-6 pb-8">
      <section className="p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Account &amp; Device Manager
            </h1>
            <p className="mt-2 text-slate-400">
              Account type:{" "}
              <span className="font-semibold" style={{ color: ACCENT }}>
                {accountLabel}
              </span>
            </p>
          </div>
          {/* <button
            type="button"
            onClick={openAddModal}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md px-5 py-3 text-sm font-bold text-[#0B0E11] transition hover:brightness-110"
            style={{ backgroundColor: ACCENT }}
          >
            <Plus size={18} strokeWidth={2.5} /> Add device
          </button> */}
        </div>
      </section>

      <section className="layer-card border-amber-500/25 bg-slate-900/90">
        <div className="flex gap-4 text-sm leading-relaxed text-slate-300">
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0 text-amber-400"
            strokeWidth={2}
            aria-hidden
          />
          <p>{warningCopy}</p>
        </div>
      </section>

      <section className="layer-card overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-slate-800/80 px-6 py-4">
          <Smartphone
            className="h-5 w-5"
            style={{ color: ACCENT }}
            strokeWidth={2}
          />
          <h2 className="text-lg font-semibold text-white">Devices</h2>
        </div>
        <div className="min-w-full overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-sm text-slate-200">
            <thead className="bg-slate-950/80 text-xs uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="px-6 py-4 text-left font-medium">Device ID</th>
                <th className="px-6 py-4 text-left font-medium">User</th>
                <th className="px-6 py-4 text-left font-medium">Status</th>
                <th className="px-6 py-4 text-left font-medium">Last seen</th>
                <th className="px-6 py-4 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td
                    className="px-6 py-10 text-center text-slate-500"
                    colSpan={5}
                  >
                    Loading devices…
                  </td>
                </tr>
              ) : sortedDevices.length === 0 ? (
                <tr>
                  <td
                    className="px-6 py-10 text-center text-slate-500"
                    colSpan={5}
                  >
                    No devices yet. Use{" "}
                    <span className="text-slate-300">Add device</span> to
                    register one, or ensure{" "}
                    <code className="text-slate-400">GET /devices/</code>{" "}
                    returns data from the server.
                  </td>
                </tr>
              ) : (
                sortedDevices.map((device) => {
                  const ui = deriveUiStatus(device);
                  return (
                    <tr key={device.id} className="hover:bg-slate-950/60">
                      <td className="px-6 py-4 font-mono text-sm text-white">
                        {device.hid}
                      </td>
                      <td className="px-6 py-4 text-slate-200">
                        {device.user_display_name?.trim() ||
                          device.name?.trim() ||
                          "—"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass(ui)}`}
                        >
                          <CircleDot size={12} /> {ui}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400">
                        {formatLastSeen(device)}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => openSettings(device)}
                          className="text-sm font-semibold transition hover:brightness-125"
                          style={{ color: ACCENT }}
                        >
                          Settings
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="layer-card overflow-hidden p-0">
        <div className="border-b border-slate-800/80 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">User information</h2>
          <p className="mt-1 text-sm text-slate-500">
            Username, email, device assignment, status, and zone
          </p>
        </div>
        <div className="min-w-full overflow-x-auto">
          <table className="min-w-full divide-slate-800 text-sm text-slate-200">
            <thead className="bg-slate-950/80 text-xs uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="px-6 py-4 text-left font-medium">Username</th>
                <th className="px-6 py-4 text-left font-medium">Email</th>
                <th className="px-6 py-4 text-left font-medium">Device ID</th>
                <th className="px-6 py-4 text-left font-medium">Status</th>
                <th className="px-6 py-4 text-left font-medium">Zone</th>
              </tr>
            </thead>
            <tbody className="">
              {userRows.length === 0 ? (
                <tr>
                  <td
                    className="px-6 py-10 text-center text-slate-500"
                    colSpan={5}
                  >
                    No users linked to devices yet.
                  </td>
                </tr>
              ) : (
                userRows.map((row) => (
                  <tr
                    key={row.key}
                    className={`hover:bg-slate-950/60 ${row.highlight ? "bg-[#00E5D1]/5 ring-1 ring-inset ring-[#00E5D1]/20" : ""}`}
                  >
                    <td className="px-6 py-4 font-mono text-sm text-white">
                      {row.username}
                    </td>
                    <td className="px-6 py-4 text-slate-300">{row.email}</td>
                    <td className="px-6 py-4 font-mono text-sm text-slate-300">
                      {row.deviceId}
                    </td>
                    <td
                      className={`px-6 py-4 ${userRowStatusClass(row.ownerActive)}`}
                    >
                      {row.ownerActive ? "active" : "inactive"}
                    </td>
                    <td
                      className="px-6 py-4 font-mono text-sm font-medium"
                      style={{ color: ACCENT }}
                    >
                      {row.zone}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto overscroll-contain p-4 !mt-0">
          <button
            type="button"
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            aria-label="Close dialog"
            onClick={closeAddModal}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-device-title"
            className="relative z-10 my-auto w-full max-w-lg max-h-[min(90vh,calc(100dvh-2rem))] overflow-y-auto overscroll-contain rounded-2xl border border-slate-800/80 bg-[#0b0e14] p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="add-device-title"
                  className="text-xl font-semibold text-white"
                >
                  Add device
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Link a device to a registered user. Settings sync via REST for
                  mobile clients.
                </p>
              </div>
              <button
                type="button"
                onClick={closeAddModal}
                className="rounded-md p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                aria-label="Close"
              >
                <X size={22} />
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Registered user
                </label>
                {usersError && (
                  <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                    {usersError}
                  </p>
                )}
                <select
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-white focus:border-[#00E5D1] focus:outline-none focus:ring-2 focus:ring-[#00E5D1]/30 disabled:cursor-not-allowed disabled:opacity-60"
                  value={addForm.userId}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, userId: e.target.value }))
                  }
                  disabled={usersLoading || registeredUsers.length === 0}
                >
                  {usersLoading ? (
                    <option value="">Loading users from database…</option>
                  ) : registeredUsers.length === 0 ? (
                    <option value="">
                      {usersError
                        ? "Could not load users"
                        : "No registered owners in the database"}
                    </option>
                  ) : (
                    registeredUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.displayName} ({u.email})
                      </option>
                    ))
                  )}
                </select>
                {!usersLoading &&
                  !usersError &&
                  registeredUsers.length === 0 && (
                    <p className="mt-2 text-xs text-slate-500">
                      Users come from{" "}
                      <code className="text-slate-400">GET /members</code>.
                    </p>
                  )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Device ID
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2.5 font-mono text-sm text-white focus:border-[#00E5D1] focus:outline-none focus:ring-2 focus:ring-[#00E5D1]/30"
                    value={addForm.hid}
                    onChange={(e) =>
                      setAddForm((f) => ({ ...f, hid: e.target.value }))
                    }
                    placeholder="DEV-A1B2C3"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setAddForm((f) => ({ ...f, hid: generateDeviceHid() }))
                    }
                    className="shrink-0 rounded-md border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-[#00E5D1]/50 hover:text-[#00E5D1]"
                  >
                    Generate
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Use Generate or enter an ID: prefix{" "}
                  <span className="font-mono text-slate-400">DEV-</span> plus at
                  least 3 letters or numbers (e.g.{" "}
                  <span className="font-mono text-slate-400">DEV-A1B2C3</span>
                  ).
                </p>
              </div>

              <AddressAutocompleteInput
                id="dm-add-address"
                label="Address"
                value={addForm.address}
                onChange={(addr, coords) => {
                  setAddForm((f) => ({
                    ...f,
                    address: addr,
                    ...(coords
                      ? { latitude: coords[0], longitude: coords[1] }
                      : {}),
                  }));
                }}
                required
                placeholder="Search for a street or place…"
                labelClassName={DM_ADDRESS_LABEL}
                inputClassName={DM_ADDRESS_INPUT}
                className="relative z-10"
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-white focus:border-[#00E5D1] focus:outline-none focus:ring-2 focus:ring-[#00E5D1]/30"
                    value={addForm.latitude}
                    onChange={(e) =>
                      setAddForm((f) => ({
                        ...f,
                        latitude: Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-white focus:border-[#00E5D1] focus:outline-none focus:ring-2 focus:ring-[#00E5D1]/30"
                    value={addForm.longitude}
                    onChange={(e) =>
                      setAddForm((f) => ({
                        ...f,
                        longitude: Number(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Device name
                </label>
                <input
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-white focus:border-[#00E5D1] focus:outline-none focus:ring-2 focus:ring-[#00E5D1]/30"
                  value={addForm.deviceName}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, deviceName: e.target.value }))
                  }
                  placeholder="e.g. Alex Device"
                />
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-800/80 bg-slate-900/50 px-4 py-3">
                <input
                  type="checkbox"
                  className="rounded border-slate-600 text-[#00E5D1] focus:ring-[#00E5D1]"
                  checked={addForm.propagate_enabled}
                  onChange={(e) =>
                    setAddForm((f) => ({
                      ...f,
                      propagate_enabled: e.target.checked,
                    }))
                  }
                />
                <span className="text-sm text-slate-200">
                  Propagate enabled
                </span>
              </label>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Propagate radius (km)
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-white focus:border-[#00E5D1] focus:outline-none focus:ring-2 focus:ring-[#00E5D1]/30"
                  value={addForm.propagate_radius_km}
                  onChange={(e) =>
                    setAddForm((f) => ({
                      ...f,
                      propagate_radius_km: Number(e.target.value) || 0,
                    }))
                  }
                />
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-800/80 bg-slate-900/50 px-4 py-3">
                <input
                  type="checkbox"
                  className="rounded border-slate-600 text-[#00E5D1] focus:ring-[#00E5D1]"
                  checked={addForm.enable_notification}
                  onChange={(e) =>
                    setAddForm((f) => ({
                      ...f,
                      enable_notification: e.target.checked,
                    }))
                  }
                />
                <span className="text-sm text-slate-200">
                  Enable notification
                </span>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                    Alert threshold (meters)
                  </label>
                  <input
                    type="number"
                    min={1}
                    className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-white focus:border-[#00E5D1] focus:outline-none focus:ring-2 focus:ring-[#00E5D1]/30"
                    value={addForm.alert_threshold_meters}
                    onChange={(e) =>
                      setAddForm((f) => ({
                        ...f,
                        alert_threshold_meters: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                    Update interval (seconds)
                  </label>
                  <input
                    type="number"
                    min={5}
                    className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-white focus:border-[#00E5D1] focus:outline-none focus:ring-2 focus:ring-[#00E5D1]/30"
                    value={addForm.update_interval_seconds}
                    onChange={(e) =>
                      setAddForm((f) => ({
                        ...f,
                        update_interval_seconds: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>

              {addError && (
                <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                  {addError}
                </p>
              )}

              <div className="flex flex-wrap justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeAddModal}
                  className="rounded-md border border-slate-600 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    addSubmitting ||
                    usersLoading ||
                    registeredUsers.length === 0
                  }
                  onClick={handleAddDevice}
                  className="rounded-md px-5 py-2.5 text-sm font-bold text-[#0B0E11] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ backgroundColor: ACCENT }}
                >
                  {addSubmitting ? "Saving…" : "Save device"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {drawerDevice && (
        <div className="fixed inset-0 z-50 flex justify-end !mt-0">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Close settings"
            onClick={closeDrawer}
          />
          <aside
            className="relative flex h-full w-full max-w-md flex-col border-l border-slate-800/80 bg-slate-950 shadow-2xl"
            role="dialog"
            aria-labelledby="device-settings-title"
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-800/80 px-5 py-4">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-900/80"
                  style={{ color: ACCENT }}
                >
                  <Smartphone size={20} strokeWidth={2} />
                </div>
                <h2
                  id="device-settings-title"
                  className="text-lg font-semibold text-white"
                >
                  Device Settings
                </h2>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded-md p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                aria-label="Close"
              >
                <X size={22} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-6">
              {settingsLoading ? (
                <p className="text-sm text-slate-500">Loading settings…</p>
              ) : (
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                      Device ID
                    </label>
                    <input
                      readOnly
                      className="mt-2 w-full cursor-not-allowed rounded-md border border-slate-800 bg-slate-900/80 px-3 py-2.5 font-mono text-sm text-slate-400"
                      value={drawerDevice.hid}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                      Owner
                    </label>
                    <p className="mt-2 text-sm text-slate-300">
                      {drawerDevice.owner
                        ? `${drawerDevice.owner.first_name ?? ""} ${drawerDevice.owner.last_name ?? ""}`.trim() ||
                          drawerDevice.owner.email ||
                          `User ${drawerDevice.owner.id}`
                        : "—"}
                    </p>
                    {drawerDevice.owner?.email && (
                      <p className="text-xs text-slate-500">{drawerDevice.owner.email}</p>
                    )}
                    {drawerDevice.owner?.account_type && (
                      <p className="text-xs text-slate-500">
                        {String(drawerDevice.owner.role ?? "user")} ·{" "}
                        {drawerDevice.owner.account_type}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                      Device name
                    </label>
                    <input
                      className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-white ring-[#00E5D1]/40 focus:border-[#00E5D1] focus:outline-none focus:ring-2"
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                    />
                  </div>
                  <AddressAutocompleteInput
                    id="dm-settings-address"
                    label="Address"
                    value={form.address}
                    onChange={(addr) => {
                      setForm((f) => ({ ...f, address: addr }));
                    }}
                    placeholder="Search for a street or place…"
                    labelClassName={DM_ADDRESS_LABEL}
                    inputClassName={DM_ADDRESS_INPUT}
                    className="relative z-10"
                  />
                  <label className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-800/80 bg-slate-900/50 px-4 py-3">
                    <input
                      type="checkbox"
                      className="rounded border-slate-600 text-[#00E5D1] focus:ring-[#00E5D1]"
                      checked={form.propagate_enabled}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          propagate_enabled: e.target.checked,
                        }))
                      }
                    />
                    <span className="text-sm text-slate-200">
                      Propagate enabled
                    </span>
                  </label>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                      Propagate radius (km)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-white focus:border-[#00E5D1] focus:outline-none focus:ring-2 focus:ring-[#00E5D1]/30"
                      value={form.propagate_radius_km}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          propagate_radius_km: Number(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <label className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-800/80 bg-slate-900/50 px-4 py-3">
                    <input
                      type="checkbox"
                      className="rounded border-slate-600 text-[#00E5D1] focus:ring-[#00E5D1]"
                      checked={form.enable_notification}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          enable_notification: e.target.checked,
                        }))
                      }
                    />
                    <span className="text-sm text-slate-200">
                      Enable notification
                    </span>
                  </label>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                      Alert threshold (meters)
                    </label>
                    <input
                      type="number"
                      min={1}
                      className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-white focus:border-[#00E5D1] focus:outline-none focus:ring-2 focus:ring-[#00E5D1]/30"
                      value={form.alert_threshold_meters}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          alert_threshold_meters: Number(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                      Update interval (seconds)
                    </label>
                    <input
                      type="number"
                      min={5}
                      className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-white focus:border-[#00E5D1] focus:outline-none focus:ring-2 focus:ring-[#00E5D1]/30"
                      value={form.update_interval_seconds}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          update_interval_seconds: Number(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  {settingsError && (
                    <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                      {settingsError}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-slate-800/80 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <div>
                  <span className="text-slate-500">Status </span>
                  <span
                    className={
                      drawerUiStatus === "online"
                        ? "font-medium text-emerald-300"
                        : drawerUiStatus === "error"
                          ? "font-medium text-amber-200"
                          : "font-medium text-slate-500"
                    }
                  >
                    {drawerUiStatus}
                  </span>
                </div>
                <div className="text-slate-500">
                  Last seen: {formatLastSeen(drawerDevice)}
                </div>
              </div>
              {!isLocalOnlyDevice(drawerDevice) && (
                <button
                  type="button"
                  disabled={heartbeatBusy || settingsLoading}
                  onClick={onSendHeartbeat}
                  className="mt-3 w-full rounded-md border border-slate-600 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-[#00E5D1]/50 hover:text-[#00E5D1] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {heartbeatBusy ? "Sending heartbeat…" : "Send heartbeat"}
                </button>
              )}
              <button
                type="button"
                disabled={settingsSaving || settingsLoading}
                onClick={saveSettings}
                className="mt-3 w-full rounded-md py-3 text-sm font-bold text-[#0B0E11] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: ACCENT }}
              >
                {settingsSaving ? "Saving…" : "Save settings"}
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
