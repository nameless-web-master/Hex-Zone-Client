import { request } from "./client";

export type Member = {
  id: string;
  name: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  address?: string;
  zone_id?: string;
  location?: {
    latitude: number;
    longitude: number;
  } | null;
  lastSeen?: string;
  zones?: string[];
};

function normalizeMember(raw: unknown): Member | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;

  const id = row.id;
  const name = row.name;
  if (id == null || typeof name !== "string") return null;

  const rawLocation = row.location;
  let location: Member["location"] = null;
  if (rawLocation && typeof rawLocation === "object") {
    const latitude = (rawLocation as Record<string, unknown>).latitude;
    const longitude = (rawLocation as Record<string, unknown>).longitude;
    if (typeof latitude === "number" && typeof longitude === "number") {
      location = { latitude, longitude };
    }
  }

  const zones =
    Array.isArray(row.zones)
      ? row.zones.filter((zone): zone is string => typeof zone === "string")
      : [];

  return {
    id: String(id),
    name,
    email: typeof row.email === "string" ? row.email : undefined,
    first_name: typeof row.first_name === "string" ? row.first_name : undefined,
    last_name: typeof row.last_name === "string" ? row.last_name : undefined,
    address: typeof row.address === "string" ? row.address : undefined,
    zone_id: typeof row.zone_id === "string" ? row.zone_id : undefined,
    location,
    lastSeen: typeof row.lastSeen === "string" ? row.lastSeen : undefined,
    zones,
  };
}

export async function getMembers() {
  const result = await request<unknown[]>({ method: "GET", url: "/members" });
  return {
    ...result,
    data: (result.data ?? [])
      .map(normalizeMember)
      .filter((member): member is Member => Boolean(member)),
  };
}

export async function updateLocation(payload: {
  latitude: number;
  longitude: number;
}) {
  return request<{ success: boolean }>({
    method: "POST",
    url: "/members/location",
    data: payload,
  });
}
