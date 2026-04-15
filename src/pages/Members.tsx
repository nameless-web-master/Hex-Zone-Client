import { useEffect, useState } from "react";
import { getMembers, type Member } from "../services/api/members";
import { useAppState } from "../state/app/AppStateContext";

export default function Members() {
  const { setMembers: setGlobalMembers } = useAppState();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getMembers()
      .then((result) => {
        if (!mounted) return;
        if (result.error) setError(result.error);
        else {
          const next = result.data ?? [];
          setMembers(next);
          setGlobalMembers(next);
        }
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
      <div className="grid gap-3">
        {members.map((member) => (
          <article
            key={member.id}
            className="rounded-xl border border-slate-800/80 bg-slate-950/80 p-4"
          >
            <p className="font-medium text-white">{member.name}</p>
            <p className="mt-1 text-xs text-slate-500">
              Zone: {member.zoneId ?? "Unknown"}
            </p>
            <p className="text-xs text-slate-500">
              Location:{" "}
              {member.latitude != null && member.longitude != null
                ? `${member.latitude.toFixed(5)}, ${member.longitude.toFixed(5)}`
                : "Unavailable"}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
