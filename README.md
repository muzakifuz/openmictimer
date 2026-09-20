# Openmic Timer

A tool for open mic community managers to time comics on stage: set the
rules (min/max time), build the lineup, and start a live, color-coded timer
for whoever's up. Built with Next.js, Supabase (Postgres + Realtime), and
deployed on Vercel.

## How it works

- Visiting the site creates a fresh event and takes you to `/event/[id]`.
  That URL is your event's private "manage" link — bookmark or share it
  with co-hosts.
- **Save Rules**: max/min time, event name, and whether to show
  under/on-time/overtime badges.
- **Add to Lineup**: add each comic by name. Tap **Start Count** to open
  the fullscreen timer for that person.
- **Fullscreen timer**: counts up from 0:00. Background stays neutral
  before the minimum time, turns green once you're in the min–max window,
  and turns red past the maximum. Tap **Stop** to record the final time
  and badge, then you're back on the lineup.
- **Transfer the Timer**: shows a QR code (and a copy-able link) to the
  live timer. Scan it on another phone or laptop — e.g. handing control
  from the sign-up table to the stage — and it shows the exact same
  running timer, in sync, because the timer's state lives in Supabase
  rather than in one browser tab.
- **Download List**: exports the lineup (name, status, time, badge) as a
  CSV.

## Assumptions worth knowing about

- **No login.** Anyone with an event's `/event/[id]` link can view and
  edit it — same trust model as sharing a Google Sheet link. Don't post
  manage links publicly. If you want real access control later, add
  Supabase Auth and tighten the RLS policies in `supabase/schema.sql`.
- **No long-term history.** There's no "past events" browser. Use **Start
  a new event** (small link at the top once rules are saved) to wipe the
  current rules + lineup and get a fresh event — it asks for confirmation
  first. Data does persist in Supabase across an accidental page refresh
  during a show (so you don't lose your lineup mid-event); it's only
  cleared when you explicitly start a new event.

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run the contents of `supabase/schema.sql` from
   this repo. This creates the `events` and `lineup_entries` tables, sets
   permissive RLS policies (see note above), and turns on Realtime for
   both tables.
3. Go to **Project Settings → API** and copy:
   - **Project URL**
   - **anon public** key

## 2. Configure the app locally

```bash
cp .env.local.example .env.local
```

Fill in the two values you copied:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

Then install and run:

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`.

## 3. Push to GitHub

```bash
git init
git add .
git commit -m "Openmic Timer"
git branch -M main
git remote add origin https://github.com/<your-username>/openmic-timer.git
git push -u origin main
```

## 4. Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import the GitHub
   repo you just pushed.
2. In the import screen (or Project Settings → Environment Variables
   afterwards), add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy. Vercel will build and give you a live URL.

Every push to `main` will auto-redeploy.

## Project structure

```
app/
  page.tsx                          → creates a new event id, redirects
  event/[id]/page.tsx               → rules + lineup manager screen
  event/[id]/timer/[entryId]/page.tsx → fullscreen live timer
components/
  BadgePill.tsx                     → UNDER / ON TIME / OVERTIME pill
  ConfirmModal.tsx                  → generic confirm dialog
  TransferModal.tsx                 → QR code + link for timer handoff
lib/
  supabase.ts                       → Supabase browser client
  types.ts                          → shared types + badge/duration helpers
supabase/
  schema.sql                        → run once in Supabase's SQL editor
```

## Customizing to match your Figma exactly

I built this against the screenshots of your design (colors, layout, the
green/red full-screen states, the badge pills). Palette lives in
`tailwind.config.ts` under `colors.base` / `colors.brand` / `colors.status`
if you want to fine-tune hex values against the real Figma file, and the
logo mark in the header of `app/event/[id]/page.tsx` is a placeholder
gradient circle — swap in your real logo asset there.
