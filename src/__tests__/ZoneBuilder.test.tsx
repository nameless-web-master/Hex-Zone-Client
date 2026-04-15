import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ZoneBuilder from '../pages/ZoneBuilder';

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: any) => <div>{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Polygon: () => <div data-testid="polygon" />,
  Polyline: () => <div data-testid="polyline" />,
  CircleMarker: ({ children }: any) => <div data-testid="circle-marker">{children}</div>,
  Tooltip: ({ children }: any) => <div>{children}</div>,
  useMapEvent: () => null,
  useMap: () => ({ setView: vi.fn(), getZoom: () => 12 }),
  Popup: ({ children }: any) => <div>{children}</div>
}));

describe('Zone Builder page', () => {
  it('renders zone builder controls', () => {
    render(<ZoneBuilder />);

    expect(screen.getByRole('heading', { name: /Interactive H3 and geofence design./i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Zone Builder Map/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export json/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save zone/i })).toBeInTheDocument();
  });
});
