# Zone Weaver Frontend (M2)

React + Tailwind UI for the Zone Weaver platform.

## Run locally

1. Install dependencies
   ```bash
   npm install
   ```
2. Start the development server
   ```bash
   npm run dev
   ```
3. Open the app in the browser
   - http://localhost:5173

## Backend integration

The frontend is configured to connect to the Zone Weaver backend at:

- `https://hex-zone-server.onrender.com/`

You can also override the API base URL using the environment variable:

- `VITE_API_BASE_URL`

## Testing

Run unit tests with:

```bash
npm test
```

## Project structure

- `src/components` — reusable UI pieces
- `src/pages` — application screens
- `src/hooks` — auth and API helpers
- `src/lib` — API client and H3 utilities

## Notes

- Dark teal theme with hex-style UI accents
- H3 grid and polygon zone builder powered by `h3-js` and `react-leaflet`
- JWT login stored in `localStorage`
