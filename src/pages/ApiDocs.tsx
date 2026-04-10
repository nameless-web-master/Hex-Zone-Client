export default function ApiDocs() {
  return (
    <div className="layer-card space-y-6">
      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.3em] text-teal-300">API Reference</p>
        <h1 className="text-3xl font-semibold text-white">Zone Weaver API docs</h1>
        <p className="text-slate-400">Quick access to the main backend endpoints and payload shapes for building zones, devices, and owner registration.</p>
      </div>

      <section className="rounded-3xl border border-slate-800/80 bg-slate-950/90 p-6">
        <h2 className="mb-3 text-xl font-semibold text-white">Authentication</h2>
        <div className="space-y-4 text-sm text-slate-300">
          <div>
            <p className="font-semibold text-slate-100">POST /owners/login</p>
            <p className="mt-2">Body:</p>
            <pre className="rounded-3xl bg-slate-900/90 p-4 text-xs text-slate-200">
              {`{
  "email": "owner@example.com",
  "password": "password123"
}`}
            </pre>
          </div>
          <div>
            <p className="font-semibold text-slate-100">POST /owners/register</p>
            <p className="mt-2">Body:</p>
            <pre className="rounded-3xl bg-slate-900/90 p-4 text-xs text-slate-200">
              {`{
  "email": "owner@example.com",
  "password": "password123",
  "first_name": "Alex",
  "last_name": "Rivers",
  "account_type": "private",
  "phone": "+1234567890",
  "zone_id": "xyz-0001",
  "address": "123 Zone St"
}`}
            </pre>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800/80 bg-slate-950/90 p-6">
        <h2 className="mb-3 text-xl font-semibold text-white">Zone management</h2>
        <div className="space-y-4 text-sm text-slate-300">
          <div>
            <p className="font-semibold text-slate-100">GET /zones/</p>
            <p className="mt-2">Fetch all zones for the authenticated owner.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-100">POST /zones/</p>
            <p className="mt-2">Body:</p>
            <pre className="rounded-3xl bg-slate-900/90 p-4 text-xs text-slate-200">
              {`{
  "name": "Downtown Mesh",
  "description": "Core H3 coverage",
  "zone_type": "warn",
  "h3_cells": ["8928308280fffff", "8928308281fffff"],
  "polygon": [[34.05, -118.25], [34.06, -118.24], [34.05, -118.23]]
}`}
            </pre>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800/80 bg-slate-950/90 p-6">
        <h2 className="mb-3 text-xl font-semibold text-white">Device utilities</h2>
        <div className="space-y-4 text-sm text-slate-300">
          <div>
            <p className="font-semibold text-slate-100">GET /devices/</p>
            <p className="mt-2">List all devices associated with the authenticated owner.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-100">POST /utils/h3/convert</p>
            <p className="mt-2">Convert latitude/longitude to an H3 cell.</p>
            <pre className="rounded-3xl bg-slate-900/90 p-4 text-xs text-slate-200">
              {`{
  "latitude": 34.0522,
  "longitude": -118.2437,
  "resolution": 13
}`}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}
