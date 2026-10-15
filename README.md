# Splitzy 2.0 — UPI-First Group Expense Splitting for India

A calm, trustworthy fintech application (inspired by Cred, Revolut, and Linear) built for trips, flatmates, and college groups in India. Mobile-first PWA that adapts into a three-pane desktop workspace.

---

## Architecture & Engineering Principles

### 1. Integer-Paise Precision
- **Zero float math**: All monetary values are strictly stored as integer paise (`BIGINT` in Postgres, `number` in TypeScript).
- **Formatting**: `formatINR(paise)` formats amounts into `₹1,240` or `₹1,240.50` using `Intl.NumberFormat('en-IN')`.
- Safe conversions (`rupeesToPaise`, `paiseToRupees`) eliminate floating-point rounding errors.

### 2. Deterministic Split Rounding
- When dividing an expense into fractional shares (e.g., ₹1.00 split 3 ways):
  - Base share: `Math.floor(total / n)` = 33 paise each.
  - Remainder paise (1 paise): Distributed deterministically to the **payer first**, then in member order.
  - Guarantees the sum of all individual shares **always equals the total amount exactly**.

### 3. Greedy Two-Pointer Debt Simplification ("Simplified")
- Solves net creditor/debtor imbalances in at most **$N-1$ transfers** using a pure, unit-tested function.
- Verified with 12 unit tests in `vitest`.
- Microcopy: Labeled truthfully as **"Simplified"**, never "Optimal".

### 4. UPI-First Settlement Flow
- Payers tap **"Pay via UPI"** to trigger standard `upi://pay?pa=...&pn=...&am=...&cu=INR` deep links.
- On desktop, dynamically generates a scannable **UPI QR Code** compatible with Google Pay, PhonePe, Paytm, BHIM, and Cred.
- 3-step payment lifecycle:
  1. `pending`: Transfer calculated, waiting for payer.
  2. `paid`: Payer marks as paid with optional reference ID.
  3. `confirmed`: Receiver acknowledges and confirms receipt in the app.
- Never marks a payment as verified until the receiver confirms.

### 5. Group-Scoped Supabase Row-Level Security (RLS)
- Users can only read and write rows of groups they belong to.
- Evaluated via `is_group_member(group_id)` security definer function.
- Full migration script provided in [`supabase-migration-v2.sql`](./supabase-migration-v2.sql).

---

## Tech Stack

- **Frontend**: Vite + React 18 + TypeScript
- **Styling**: Tailwind CSS (custom fintech tokens, hairline borders, 8px grid, dark mode CSS variables)
- **Icons**: Lucide React
- **State Management**: Zustand with persistent storage
- **Data Fetching**: TanStack Query
- **Charts & Visualizations**: Recharts (Category donut & per-member spend bar charts)
- **Animations**: Framer Motion (subtle spring sheets & dialogs, reduced-motion tolerant)
- **Database & Realtime**: Supabase Postgres & Realtime WebSockets
- **Unit Testing**: Vitest
- **PWA**: Web App Manifest + Service Worker offline caching

---

## Design System Tokens

| Element | Light Mode | Dark Mode |
|---|---|---|
| Background | `#F7F7F5` | `#0E0F11` |
| Cards | `#FFFFFF` (16px radius) | `#17181B` (16px radius) |
| Accent | `#4F46E5` (Indigo) | `#6366F1` (Indigo tint) |
| Positive (Money) | `#16A34A` | `#22C55E` |
| Negative (Money) | `#DC2626` | `#EF4444` |
| Typography | Inter (`tabular-nums`) | Inter (`tabular-nums`) |
| Touch Target | Minimum 44px (WCAG AA) | Minimum 44px (WCAG AA) |

---

## Quick Start & Local Setup

### 1. Prerequisites
- Node.js >= 18
- npm >= 9

### 2. Installation
```bash
git clone <repository_url>
cd SPLITZY
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

> [!NOTE]
> Splitzy functions out-of-the-box in local demo / offline PWA mode with preloaded mock groups (*Goa Trip*, *Flat 402*, *Office lunch*).

### 4. Supabase Setup (Optional for Cloud Sync)
1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Run the migration script in [`supabase-migration-v2.sql`](./supabase-migration-v2.sql) in your Supabase SQL Editor.
3. Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
4. Restart `npm run dev`.

### 5. Running Tests
```bash
npm test
```
Runs 12 unit tests covering paise arithmetic, deterministic split rounding, and greedy two-pointer settlement simplification.

### 6. Production Build
```bash
npm run build
```

---

## Roadmap

- [x] **v2.0**: Core redesign, integer paise precision, greedy debt simplification, dynamic UPI QR code generator, 3-step settlement timeline, PWA manifest.
- [ ] **v2.1**: OCR receipt scanner using Gemini Flash API for automatic itemized bill extraction.
- [ ] **v2.2**: Web Push Notifications via Service Worker when someone marks a transfer as paid.
- [ ] **v2.3**: Multi-currency auto-conversion to INR using live FX rates for international trips.
- [ ] **v2.4**: Recurring split automation for monthly flat rent & utility bills.
