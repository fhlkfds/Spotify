# Spotify Stats Tracker

A modern, self-hosted Spotify listening statistics tracker with beautiful visualizations and comprehensive analytics.

## Features

- **Dashboard**: Overview of listening time, top artists, top tracks, and activity heatmap
- **Artists**: Deep dive into artist stats with play counts and listening time
- **Albums**: Track album completion rates and discovery dates
- **Trends**: Visualize listening patterns with daily/hourly charts
- **Compare**: See how you stack up against other users

## Tech Stack

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Database**: SQLite with Prisma ORM
- **Styling**: Tailwind CSS + shadcn/ui components
- **Charts**: Recharts for data visualization
- **Auth**: NextAuth.js with Spotify OAuth

## Setup

### 1. Create Spotify App

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Add `http://localhost:3000/api/auth/callback/spotify` as a Redirect URI
4. Note your Client ID and Client Secret

### 2. Configure Environment

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
SPOTIFY_CLIENT_ID="your-spotify-client-id"
SPOTIFY_CLIENT_SECRET="your-spotify-client-secret"
```

Generate a secret with:
```bash
openssl rand -base64 32
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Setup Database

```bash
npx prisma db push
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Docker Deployment

### Using Docker Compose

1. Create a `.env` file with your credentials:

```env
NEXTAUTH_SECRET=your-secret-here
SPOTIFY_CLIENT_ID=your-client-id
SPOTIFY_CLIENT_SECRET=your-client-secret
```

2. Build and run:

```bash
docker-compose up -d
```

The app will be available at `http://localhost:3000`.

### Manual Docker Build

```bash
docker build -t spotify-stats .

docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL="file:/app/data/spotify-stats.db" \
  -e NEXTAUTH_URL="http://localhost:3000" \
  -e NEXTAUTH_SECRET="your-secret" \
  -e SPOTIFY_CLIENT_ID="your-client-id" \
  -e SPOTIFY_CLIENT_SECRET="your-client-secret" \
  -v spotify_data:/app/data \
  spotify-stats
```

## Syncing Data

Click the "Sync Now" button in the header to fetch your recent listening history from Spotify.

For automated syncing, you can set up a cron job to call the sync endpoint:

```bash
# Every 5 minutes
*/5 * * * * curl -X GET http://localhost:3000/api/sync -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Set the `CRON_SECRET` environment variable to secure the endpoint.

## Time Display

All listening time is displayed in hours format:
- Short times: "45 minutes"
- Normal times: "23.5 hours"
- Long times: "156 hours (6.5 days)"

## License

MIT
