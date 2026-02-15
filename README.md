# Universal Checkout

Stablecoin payment links on Tempo. Create invoices, share a link or QR code, get paid.

Built with Next.js, Privy, and [tempo.ts](https://github.com/tempo-labs/tempo.ts).

## Setup

```bash
pnpm install
```

Create a `.env` file:

```
NEXTJS_ENV=development
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_app_secret
```

## Run

```bash
pnpm dev
```

## Stack

- **Next.js 15** — app router + turbopack
- **Privy** — auth and embedded wallets
- **tempo.ts** — transaction building and signing
- **Tailwind v4** — styling
- **Motion** — animations
