# Splitzy — Real-Time Group Expense & Debt Settlement App (Supabase Edition)

> **A modern, real-time Progressive Web Application (PWA) built with Vanilla JavaScript (ES6+), Supabase (PostgreSQL, Auth & Realtime WebSockets), Bootstrap 5, Chart.js, and UPI Payment Deep-Links.**

---

## 🌟 Project Overview

When friends travel together, flatmates share monthly bills, or colleagues split group expenses, keeping track of who paid and who owes whom becomes messy.

**Splitzy** solves this by:
1. Providing direct **Supabase Authentication** (Secure Email/Password register and login barrier).
2. Supporting 4 flexible split modes (**Equal**, **Exact amounts**, **Percentage shares**, and **Itemized / "Who Ate What"**).
3. Calculating net balances for every individual in real-time.
4. Executing an optimal **Greedy Min-Cash-Flow Debt Simplification Algorithm** ($O(N \log N)$) to reduce cross-party debts down to at most $(N - 1)$ transactions.
5. Broadcasting database changes live across all connected devices using **Supabase Realtime WebSockets (Postgres Change Data Capture)**.
6. Generating instant NPCI-compliant **UPI payment QR codes & deep-links** for GPay, PhonePe, and Paytm.

---

## 🚀 Key Features

* **Real-Time Multi-Device Sync**: Powered by Supabase PostgreSQL and Realtime Channels—when an expense is added on one phone, all members' screens update instantly without reloading.
* **Gatekeeper Supabase Auth**: Users must log in or register before accessing groups and expenses. Secure session handling and user profile synchronization.
* **Optimal Debt Settlement Algorithm**: Mathematically eliminates circular debts ($O(N^2) \rightarrow N - 1$).
* **NPCI-Compliant UPI Payments**: Dynamic QR codes and 1-click mobile deep-links (`upi://pay`).
* **Interactive Financial Analytics**: Category distribution doughnut charts and member comparison bar charts with **Chart.js**.
* **Export & Sharing Hub**: Instant formatted WhatsApp group summaries, CSV spreadsheet downloads, and print-ready PDF settlement receipts.
* **Progressive Web App (PWA)**: Installable on Android, iOS, and Desktop with offline caching via Service Worker.

---

## 🧮 Algorithm Focus: Greedy Min-Cash-Flow Debt Simplification

### The Mathematical Problem
In a group of $N$ people, pairwise settling can lead to up to $O(N^2)$ separate transactions.

### The Solution: Min-Cash-Flow Greedy Algorithm ($O(N \log N)$)
1. **Net Balance Calculation**:
   $$\text{Net}(i) = \sum \text{Amount Paid by } i - \sum \text{Share Consumed by } i$$
   * $\text{Net}(i) > 0 \implies$ **Creditor** (is owed money)
   * $\text{Net}(i) < 0 \implies$ **Debtor** (owes money)
   * $\text{Net}(i) = 0 \implies$ Settled

2. **Greedy Two-Pointer Matching**:
   * Sort Debtors descending by owed amount.
   * Sort Creditors descending by receivable amount.
   * Settle $\min(|D|, |C|)$ in a single direct transfer ($D \rightarrow C$).
   * Adjust remaining amounts and repeat until all balances are zero.

This guarantees settling all debts in at most $N - 1$ transactions!

---

## 📁 Project Structure

```text
SPLITZY/
├── index.html              # Single Page Application shell & interactive modals
├── supabase-schema.sql     # PostgreSQL tables, RLS policies & Realtime configuration
├── css/
│   └── style.css           # Glassmorphism, CSS design tokens, themes & animations
├── js/
│   ├── supabase-config.js  # Supabase project URL & public anon key
│   ├── supabase.js         # Supabase client, Auth, and Realtime WebSocket Engine
│   ├── storage.js          # In-memory reactive data manager & cache
│   ├── auth.js             # Auth gatekeeper & session manager
│   ├── settlement.js       # Greedy Min-Cash-Flow Algorithm & balance engine
│   ├── groups.js           # Group management & avatar chip renderers
│   ├── expenses.js         # Dynamic 4-mode split forms & list rendering
│   ├── analytics.js        # Chart.js visualizations & group KPI cards
│   ├── export.js           # CSV, WhatsApp text formatter & PDF receipt generator
│   └── app.js              # Central UI controller, routing & event handlers
├── assets/
│   └── favicon.svg         # Splitzy branding vector icon
└── manifest.json           # PWA configuration
```

---

## 🛠️ How to Connect Your Supabase Backend

1. Create a free project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** in your Supabase Dashboard, paste the contents of [`supabase-schema.sql`](file:///d:/projects2/SPLITZY/supabase-schema.sql), and click **RUN**.
3. Go to **Project Settings → API** in Supabase, and copy:
   - **Project URL**
   - **anon / public key**
4. Paste them into [`js/supabase-config.js`](file:///d:/projects2/SPLITZY/js/supabase-config.js):
   ```javascript
   window.SPLITZY_SUPABASE_CONFIG = {
     url: "https://your-project-ref.supabase.co",
     anonKey: "your-anon-public-key"
   };
   ```
5. Open [index.html](file:///d:/projects2/SPLITZY/index.html) in your browser!
