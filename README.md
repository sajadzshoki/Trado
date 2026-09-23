# Trado

Personal spot trading journal and portfolio tracker. It is not an exchange. You record cryptocurrency buys and sells yourself, group them into trades, and review capital and profit or loss in USD and Toman.

## Stack

- Nuxt 4, Vue 3, TypeScript
- Nuxt UI and Tailwind CSS
- Nuxt i18n (English default, Persian RTL)
- Nitro server API
- PostgreSQL and Drizzle ORM
- Sealed cookie sessions (`nuxt-auth-utils`)

## Run

Requirements: Node.js 22+ and PostgreSQL 16+.

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:migrate
npm run dev
```

The app listens on `http://0.0.0.0:3000`.

Set `NUXT_SESSION_PASSWORD` to a random string of at least 32 characters before sharing a deployment. `NUXT_AUTO_MIGRATE=true` applies SQL migrations when the server starts and the migrations folder is present. You can turn that off and run `npm run db:migrate` yourself.

## Authentication

Sign-in is mobile number plus password. Iranian numbers starting with `09` are stored as E.164 (`+98…`). Other numbers must already be in international form (`+14155552671`).

Sessions are sealed cookies. Every query is scoped to the signed-in user.

OTP is not implemented. The `otp_challenges` table and `server/services/otp.ts` are the extension point for a later one-time-code provider.

## Journal model

A trade is a container you control. It can hold many buy and sell entries. The app does not match buys and sells across trades, and it does not use FIFO or LIFO.

Inside one trade, realized P/L uses average cost on the overlapping quantity only. If a trade sells more than it bought, the extra quantity is flagged instead of being matched to another trade.

Each entry stores quantity, USD unit price, USD total, the USD/Toman rate at that moment, the Toman total, the date, and the side. Both currencies stay visible. Settings choose which one leads.

Initial capital stores a USD amount, the rate on that day, and the Toman equivalent. Mark-to-market performance against that capital is not calculated, because live prices are not tracked.

## Database

| Table | Purpose |
| --- | --- |
| `users` | Phone, password hash, name, locale, display currency |
| `otp_challenges` | Reserved for a future OTP flow. Nothing writes to it yet |
| `assets` | User-owned symbols |
| `trades` | A user-defined group of entries for one asset |
| `trade_entries` | Buy or sell rows with USD and Toman amounts |
| `initial_capital` | One capital record per user |

## Routes

Pages, with `/fa` prefixed when the language is Persian:

- `/login`
- `/register`
- `/` portfolio
- `/trades`
- `/trades/new`
- `/trades/:id`
- `/assets`
- `/settings`

API:

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PATCH /api/auth/password`
- `PATCH /api/settings`
- `GET /api/capital`
- `PUT /api/capital`
- `GET /api/assets`
- `POST /api/assets`
- `PATCH /api/assets/:id`
- `DELETE /api/assets/:id`
- `GET /api/trades`
- `POST /api/trades`
- `GET /api/trades/:id`
- `PATCH /api/trades/:id`
- `DELETE /api/trades/:id`
- `POST /api/trades/:id/entries`
- `PATCH /api/entries/:id`
- `DELETE /api/entries/:id`
- `GET /api/dashboard`

## Not built yet

- OTP send and verify
- Changing a phone number
- Live prices and performance against initial capital
- Capital history
- CSV export
- Charts
