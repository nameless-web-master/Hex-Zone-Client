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
        <h2 className="mb-3 text-xl font-semibold text-white">Devices</h2>
        <div className="space-y-4 text-sm text-slate-300">
          <div>
            <p className="font-semibold text-slate-100">GET /devices/</p>
            <p className="mt-2">List devices for the authenticated owner.</p>
            <p className="mt-2 text-slate-400">
              Response fields typically include: id, hid, device_id, name, latitude, longitude, address, h3_cell_id, owner_id, propagate_enabled, propagate_radius_km, active, is_online, last_seen, enable_notification, alert_threshold_meters, update_interval_seconds, created_at, updated_at.
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-100">GET /devices/{`{device_id}`}</p>
            <p className="mt-2">Get one device by numeric id.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-100">POST /devices/</p>
            <p className="mt-2">Create device. Example body:</p>
            <pre className="mt-2 rounded-3xl bg-slate-900/90 p-4 text-xs text-slate-200">
              {`{
  "hid": "DEV-A1B2C3",
  "name": "Front Gate Tracker",
  "address": "123 Main St, Anytown",
  "latitude": 47.6205,
  "longitude": -122.3493,
  "propagate_enabled": true,
  "propagate_radius_km": 2.5,
  "enable_notification": true,
  "alert_threshold_meters": 150.0,
  "update_interval_seconds": 120
}`}
            </pre>
          </div>
          <div>
            <p className="font-semibold text-slate-100">PATCH /devices/{`{device_id}`}</p>
            <p className="mt-2">Update device settings. Example body:</p>
            <pre className="mt-2 rounded-3xl bg-slate-900/90 p-4 text-xs text-slate-200">
              {`{
  "name": "Front Gate Tracker v2",
  "address": "321 Main St, Anytown",
  "propagate_enabled": false,
  "propagate_radius_km": 3.0,
  "enable_notification": false,
  "alert_threshold_meters": 200.0,
  "update_interval_seconds": 300
}`}
            </pre>
          </div>
          <div>
            <p className="font-semibold text-slate-100">POST /devices/{`{device_id}`}/heartbeat</p>
            <p className="mt-2">Device heartbeat (no body).</p>
          </div>
          <div>
            <p className="font-semibold text-slate-100">POST /devices/{`{device_id}`}/location</p>
            <p className="mt-2">Update location. Example body:</p>
            <pre className="mt-2 rounded-3xl bg-slate-900/90 p-4 text-xs text-slate-200">
              {`{
  "latitude": 47.6205,
  "longitude": -122.3493,
  "address": "123 Main St, Anytown"
}`}
            </pre>
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
