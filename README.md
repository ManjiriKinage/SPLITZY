# Splitzy — Smart Group Expense & Bill Splitting App

> **A modern, responsive, and viva-ready Group Expense & Debt Settlement Web Application built using Vanilla HTML5, CSS3, JavaScript (ES6+), Bootstrap 5, Chart.js, and browser `localStorage`.**

---

## 🌟 Project Overview

When friends travel together, flatmates share monthly bills, or colleagues split party expenses, keeping track of who paid and who owes whom becomes messy.

**Splitzy** solves this by:
1. Recording group expenses with flexible split modes (**Equal**, **Exact amounts**, or **Percentage** shares).
2. Calculating net balances for every individual in real-time.
3. Automatically executing a greedy **Min-Cash-Flow Debt Simplification Algorithm** to minimize the total number of transactions needed to settle all debts.
4. Providing interactive financial analytics (category doughnut charts, contribution bar charts, WhatsApp sharing, CSV export, and printable invoices).

---

## 🚀 Key Features

* **Multi-Group & Member Management**: Create custom groups with category tags (Trips 🏖️, Flatmates 🏠, Dining 🍕, Travel 🚗, Projects 🚀) and custom icons.
* **Persona Switcher ("Viewing As")**: Easily switch between group members (e.g. Manjiri, Aditi, Rahul, Sneha) to see how individual metrics (*"You are owed"* vs *"You owe"*) adjust dynamically.
* **Dynamic Split Engine**:
  * **Equal Split**: Evenly divides the bill among selected members with instant preview.
  * **Exact Split**: Allows entering exact monetary amounts with real-time balance validation.
  * **Percentage Split**: Custom percentage breakdown validating to 100%.
* **Smart Settlement Algorithm**:
  * Consolidates multi-party debts so members don't have to make redundant payments.
  * One-click "Settle Up / Record Payment" with celebratory confetti and instant balance recalculation.
* **Visual Analytics & Insights (Chart.js)**:
  * Category spending distribution (Doughnut Chart).
  * Paid vs Consumed comparison per member (Bar Chart).
  * Key group stats: Top Spender, Average spend per member, Total spend.
* **Export & Sharing Hub**:
  * **WhatsApp Formatted Summary**: Generates clean, formatted text with emojis for group chats.
  * **CSV Spreadsheet Export**: Download complete expense logs.
  * **Print-Ready Invoices**: Formatted CSS print layouts.
* **Persistence & Real-Time Cloud Sync**:
  * **Real-Time Multi-Device Cloud Sync**: Integrated Firebase Firestore engine allowing simultaneous cross-device live updates without page reload.
  * **Offline-First Resilience**: 100% functional offline with browser `localStorage` and PWA service worker precaching.
  * **One-Click Cloud Migration**: Seamlessly upload existing local groups and expenses to Firestore.
  * One-click JSON backup export and restore.
  * "Reset to Viva Demo Data" option.
* **Aesthetics & Theme**:
  * Modern Dark and Light mode toggle.
  * Glassmorphic cards, smooth animations, and mobile-friendly responsive layout.

---

## 🧮 Viva Focus: The Debt Simplification Algorithm

### The Mathematical Problem
In a group of $N$ people, if everyone tries to settle debts directly with each person they shared an expense with, it could lead to up to $O(N^2)$ separate transactions.

### The Solution: Min-Cash-Flow Greedy Algorithm ($O(N \log N)$)
1. **Net Balance Calculation**:
   For each member $i$:
   $$\text{Net}(i) = \sum \text{Amount Paid by } i - \sum \text{Share Consumed by } i$$
   * If $\text{Net}(i) > 0$, member $i$ is a **Creditor** (is owed money).
   * If $\text{Net}(i) < 0$, member $i$ is a **Debtor** (owes money).
   * If $\text{Net}(i) = 0$, member $i$ is settled.

2. **Greedy Matching**:
   * Sort Debtors descending by owed amount.
   * Sort Creditors descending by receivable amount.
   * Take the maximum debtor $D$ and maximum creditor $C$.
   * Settle $\min(|D|, |C|)$ in a single direct transfer ($D \rightarrow C$).
   * Adjust remaining amounts and repeat until all balances are zero.

This guarantees settling all debts in at most $N - 1$ transactions!

---

## 📁 Project Structure

```text
SPLITZY/
├── index.html              # Main Single Page Application shell & interactive modals
├── css/
│   └── style.css           # Glassmorphism, CSS design tokens, themes & animations
├── js/
│   ├── storage.js          # LocalStorage CRUD, seed data & reactive event triggers
│   ├── settlement.js       # Greedy Min-Cash-Flow Algorithm & balance engine
│   ├── groups.js           # Group management & member avatar chip renderers
│   ├── expenses.js         # Dynamic split forms (Equal, Exact, %) & list rendering
│   ├── analytics.js        # Chart.js visualizations & group KPI cards
│   ├── export.js           # CSV, WhatsApp text formatter & print report generator
│   └── app.js              # Application controller, routing & modal binders
├── assets/
│   └── favicon.svg         # Splitzy branding vector icon
└── README.md               # Project documentation & viva explanation guide
```

---

## 💻 Technologies Used

| Technology | Purpose |
| :--- | :--- |
| **HTML5** | Semantic layout, forms, accessible modal structures |
| **CSS3** | Glassmorphism, CSS variables, theme switching, responsive design |
| **Bootstrap 5** | Responsive grid system, modals, dropdowns, utility classes |
| **JavaScript (ES6+)** | Object-Oriented modules, greedy algorithms, DOM manipulation, custom events |
| **Chart.js** | Interactive category doughnut & member comparison bar charts |
| **Canvas Confetti** | Delightful micro-interaction on debt settlements |
| **LocalStorage API** | Browser-based data persistence with JSON export/import |

---

## 🛠️ How to Run Locally

Since Splitzy uses standard modern client-side technologies, you can run it instantly in any modern browser:

1. Double-click [index.html](file:///d:/projects2/SPLITZY/index.html) to open in your browser, **or**
2. Run a local web server (e.g. `npx serve .` or VS Code Live Server extension).

---

## 🎓 Viva Questions & Answers

**Q1. Why use `localStorage` instead of a full backend for this project?**
> *Answer:* `localStorage` provides instant persistence without server latency, allows offline usage, and removes database/server configuration overhead while demonstrating client-side storage, data serialization, and state synchronization.

**Q2. How does the Equal vs Exact vs Percentage split work?**
> *Answer:* 
> - **Equal**: Total is divided equally among checked members ($\frac{\text{Amount}}{\text{Count}}$).
> - **Exact**: User enters exact rupee values per member; client validates that $\sum \text{values} == \text{Total Amount}$.
> - **Percentage**: User assigns percentage shares; client validates that $\sum \% == 100\%$, then computes monetary shares.

**Q3. How does the Persona Switcher work?**
> *Answer:* Changing the viewing persona modifies the active user context in `localStorage`. The balance engine re-evaluates all calculations from the chosen user's perspective, updating "You owe" and "You are owed" stats in real-time.
