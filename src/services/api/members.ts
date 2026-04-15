import { request } from "./client";

export type Member = {
  id: string;
  name: string;
  latitude?: number;
  longitude?: number;
  zoneId?: string;
};

export async function getMembers() {
  return request<Member[]>({ method: "GET", url: "/members" });
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
