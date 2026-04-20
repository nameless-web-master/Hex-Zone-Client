import { useEffect, useState } from "react";
import { getOwners, type OwnerListItem } from "../services/api/auth";
import { getMembers, type Member } from "../services/api/members";
import { useAppState } from "../state/app/AppStateContext";

function formatLastSeen(value?: string): string {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export default function Members() {
  const { setMembers: setGlobalMembers } = useAppState();
  const [members, setMembers] = useState<Member[]>([]);
  const [owners, setOwners] = useState<OwnerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([getMembers(), getOwners({ skip: 0, limit: 500 })])
      .then(([membersResult, ownersResult]) => {
        if (!mounted) return;

        if (membersResult.error || ownersResult.error) {
          setError(membersResult.error ?? ownersResult.error ?? "Failed to load data.");
          return;
        }

        const nextMembers = membersResult.data ?? [];
        const nextOwners = ownersResult.data ?? [];
        setMembers(nextMembers);
        setGlobalMembers(nextMembers);
        setOwners(nextOwners);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [setGlobalMembers]);

  return (
    <section className="space-y-6 p-8">
      <h1 className="text-2xl font-semibold text-white sm:text-3xl">Members</h1>
      {loading && <p className="text-sm text-slate-400">Loading members...</p>}
      {error && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      <div className="grid grid-cols-3 gap-3">
        {members.map((member) => (
          <article
            key={member.id}
            className="rounded-xl border border-slate-800/80 bg-slate-950/80 p-4 flex-1"
          >
            <p className="font-medium text-white">{member.name}</p>
            <p className="mt-1 text-xs text-slate-500">
              Member ID: <span className="font-mono">{member.id}</span>
            </p>
            {member.address && (
              <p className="text-xs text-slate-500">Address: {member.address}</p>
            )}
            <p className="mt-1 text-xs text-slate-500">
              Primary zone: {member.zone_id ?? "Unknown"}
            </p>
          </article>
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-white">Owners (for private messages)</h2>
        <div className="grid grid-cols-3 gap-3">
          {owners.map((owner) => {
            const name =
              `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim() ||
              owner.email ||
              "Owner";
            return (
              <article
                key={owner.id}
                className="rounded-xl border border-slate-800/80 bg-slate-950/80 p-4 flex-1"
              >
                <p className="font-medium text-white">{name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Owner ID: <span className="font-mono">{owner.id}</span>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Primary zone: {owner.zone_id ?? "Unknown"}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
