# Running this locally (Windows + VS Code)

## Option 0 - just look at the UI (no Docker, no database)

Demo mode runs the web app against an in-memory backend, seeded with jobs,
rigs, quotes and booking requests, so every screen works. Needs only
Node.js 20+.

```powershell
npm install                 # from the repo root, not from apps\web-app
npm run demo --workspace=web-app
```

Open http://localhost:5173. On the sign-in screen pick Customer, Contractor
or Rig owner - any password works.

Nothing is saved: reload and it starts fresh. It is for showing the UI, not
for testing the backend. `npm run dev` is untouched and still calls the real
services.

For the real thing there are two ways. **Option A** runs everything (4 backend services, 4 Postgres
databases, Redis and the web app) with one command and is what you want for a
demo. **Option B** runs only the web app, against a backend you started
yourself.

---

## Option A — everything in Docker

**Needs:** Docker Desktop running.

```powershell
# 1. Open the project in VS Code (from the unzipped folder)
code .

# 2. Terminal -> New Terminal, then create the one required secret
copy services\platform-spine\.env.example services\platform-spine\.env
#    open that file and set JWT_SECRET to any long random string

# 3. Build and start everything (first run pulls images - a few minutes)
docker compose up --build -d

# 4. Check the four services answer
curl http://localhost:8001/healthz
curl http://localhost:8002/healthz
curl http://localhost:8003/healthz
curl http://localhost:8004/healthz

# 5. Open the app
start http://localhost:5173
```

Each service runs its own database migrations on start, so there is no
separate migrate step here.

Useful while it runs:

```powershell
docker compose logs -f            # follow logs (Ctrl+C to stop following)
docker compose logs -f web-app    # just the frontend
docker compose down               # stop everything
docker compose down -v            # stop and wipe the databases
```

---

## Option B — web app on your machine, backend in Docker

Better for UI work: instant hot reload, no rebuild.

**Needs:** Node.js 20+ and Docker Desktop.

```powershell
# 1. Start only the backend pieces
docker compose up -d postgres-platform-spine postgres-quotation postgres-resource-network postgres-payments-data redis platform-spine quotation resource-network payments-data

# 2. Install frontend dependencies - FROM THE REPO ROOT, not from apps\web-app
#    (web-app uses shared-ui through an npm workspace; installing inside
#    apps\web-app pulls an unrelated package off npm instead)
npm install

# 3. Run the web app
npm run dev --workspace=web-app

# 4. Open http://localhost:5173
```

Checks before you commit anything:

```powershell
npm run lint                      # eslint over apps/
npm run build --workspace=web-app # production build
```

---

## First five minutes in the app

The app starts empty, so create the data in this order:

1. **Register a rig owner** -> Fleet -> **List equipment**: name it, set an
   hourly rate, click the map to place it. Only *available* listings with a
   location are searchable.
2. **Register a contractor** (use a different browser profile or a private
   window so both stay signed in) -> **Pricing**: fill in one job type and
   save. No quote can be generated without this. -> **Areas**: add a village
   with a water depth, e.g. Kallikudi at 440 ft.
3. **Register a customer** -> **Request a borewell**: drag the pin, pick a
   type, get the estimate.
4. **Contractor** -> Overview -> open the job -> **Generate quotation** ->
   **Find nearby rigs** -> send a booking request.
5. **Owner** -> accept the request.
6. **Customer** -> approve the quotation -> pay.
7. **Contractor** -> **Advance stage** until Completion -> record actual depth
   and cost to see the variance.

## Two things that will look broken but aren't

- **Payment stops at Razorpay** unless `RAZORPAY_KEY_ID`,
  `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` are set in
  `services\payments-data\.env`. Without them the API returns 502 and the
  customer sees a plain explanation. A payment only becomes *completed* when
  Razorpay's signed webhook arrives, so on a local machine it stays pending
  even after a test payment (the webhook can't reach localhost without a
  tunnel such as ngrok).
- **Names are missing everywhere.** Jobs and bookings only carry IDs - there
  is no users endpoint yet - so screens show a short job code and the service
  area name instead of a customer or contractor name.

## Where the new code lives

```
apps/shared-ui/src/tokens.js      colours, type, spacing, stage labels, INR format
apps/shared-ui/src/platform.js    API client (completion, quote edit, payments, areas added)
apps/web-app/src/styles.css       the design system as CSS
apps/web-app/src/components/      buttons, cards, badges, depth gauge, map, stage rail
apps/web-app/src/lib/             session, data loading, Razorpay loader
apps/web-app/src/pages/customer/  job list, new request, job detail + payment
apps/web-app/src/pages/contractor/overview, job, rig search, bookings, pricing, areas
apps/web-app/src/pages/owner/     overview, fleet, booking requests
docs/adr/0005-field-console-ui.md why it is built this way, and the API gaps
```
