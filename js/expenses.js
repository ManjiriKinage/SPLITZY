/**
 * SPLITZY 2.0 — Expenses & Multi-Member Split Engine
 * Supports: Equal, Exact, Percentage, and Itemized ("Who Ate What") splits.
 */

const EXPENSE_CATEGORIES = {
  Food: { icon: '🍕', color: '#d97706' },
  Travel: { icon: '🚗', color: '#0284c7' },
  Hotel: { icon: '🏨', color: '#7c3aed' },
  Utilities: { icon: '💡', color: '#059669' },
  Shopping: { icon: '🛍️', color: '#db2777' },
  Entertainment: { icon: '🎟️', color: '#4f46e5' },
  Rent: { icon: '🏠', color: '#0d9488' },
  General: { icon: '📦', color: '#475569' }
};

class ExpensesManager {
  static currentItemizedRows = [];

  static getCategoryMeta(cat) {
    return EXPENSE_CATEGORIES[cat] || EXPENSE_CATEGORIES.General;
  }

  static generateSplitInputs(group, currentSplitType = 'equal', existingSplits = {}, totalAmount = 0, existingItemized = null) {
    const members = group.members || [];
    let html = '';

    if (currentSplitType === 'equal') {
      const isInitial = Object.keys(existingSplits).length === 0;
      html = `
        <div class="mb-2 d-flex justify-content-between align-items-center">
          <small class="text-muted fw-bold">Select members splitting equally:</small>
          <button type="button" class="btn btn-sm btn-link p-0 text-decoration-none fw-bold" onclick="ExpensesManager.toggleSelectAllMembers(true)">Select All</button>
        </div>
      `;

      members.forEach(member => {
        const isChecked = isInitial ? true : existingSplits[member] !== undefined;
        html += `
          <div class="member-split-row">
            <div class="form-check d-flex align-items-center gap-2 mb-0">
              <input class="form-check-input split-member-check" type="checkbox" value="${member}" id="chk_${member}" ${isChecked ? 'checked' : ''} onchange="ExpensesManager.updateEqualSplitPreview()">
              <label class="form-check-label fw-bold text-main" for="chk_${member}">
                ${member}
              </label>
            </div>
            <span class="fw-bold split-preview-val text-primary" id="preview_${member}">₹0</span>
          </div>
        `;
      });

    } else if (currentSplitType === 'exact') {
      html = `
        <div class="mb-2 d-flex justify-content-between align-items-center">
          <small class="text-muted fw-bold">Enter exact amounts per member:</small>
          <span class="badge-custom badge-category" id="exact_diff_badge">Remaining: ₹${totalAmount}</span>
        </div>
      `;

      members.forEach(member => {
        const val = existingSplits[member] !== undefined ? existingSplits[member] : '';
        html += `
          <div class="member-split-row">
            <span class="fw-bold text-main">${member}</span>
            <div class="input-group input-group-sm" style="max-width: 140px;">
              <span class="input-group-text">₹</span>
              <input type="number" step="0.01" min="0" class="form-control text-end exact-split-input" data-member="${member}" value="${val}" placeholder="0.00" oninput="ExpensesManager.validateExactSplit()">
            </div>
          </div>
        `;
      });

    } else if (currentSplitType === 'percentage') {
      html = `
        <div class="mb-2 d-flex justify-content-between align-items-center">
          <small class="text-muted fw-bold">Enter percentage share (%):</small>
          <span class="badge-custom badge-category" id="pct_diff_badge">Total: 0% / 100%</span>
        </div>
      `;

      members.forEach(member => {
        let pct = '';
        if (existingSplits[member] !== undefined && totalAmount > 0) {
          pct = Math.round((existingSplits[member] / totalAmount) * 100);
        }
        html += `
          <div class="member-split-row">
            <span class="fw-bold text-main">${member}</span>
            <div class="d-flex align-items-center gap-2" style="max-width: 160px;">
              <div class="input-group input-group-sm">
                <input type="number" step="1" min="0" max="100" class="form-control text-end pct-split-input" data-member="${member}" value="${pct}" placeholder="0" oninput="ExpensesManager.validatePctSplit()">
                <span class="input-group-text">%</span>
              </div>
              <small class="text-muted text-nowrap fw-bold" id="pct_val_${member}">₹0</small>
            </div>
          </div>
        `;
      });

    } else if (currentSplitType === 'itemized') {
      // Itemized "Who Ate What" Builder
      this.currentItemizedRows = (existingItemized && existingItemized.items && existingItemized.items.length > 0) 
        ? JSON.parse(JSON.stringify(existingItemized.items))
        : [
            { id: 'item_1', name: 'Item 1', amount: '', consumers: [...members] }
          ];

      const initialTax = existingItemized?.taxPct !== undefined ? existingItemized.taxPct : 5;
      const initialTip = existingItemized?.tipAmount !== undefined ? existingItemized.tipAmount : 0;

      html = `
        <div class="itemized-builder-container">
          <div class="d-flex align-items-center justify-content-between mb-2">
            <small class="text-muted fw-bold"><i class="fa-solid fa-receipt text-warning me-1"></i> Add line items & select who ate what:</small>
            <button type="button" class="btn btn-sm btn-outline-primary fw-bold" onclick="ExpensesManager.addItemizedRow()">
              <i class="fa-solid fa-plus me-1"></i> Add Item
            </button>
          </div>

          <div id="itemizedRowsList" class="d-flex flex-column gap-2 mb-3">
            <!-- Rendered by renderItemizedRows() -->
          </div>

          <!-- Tax & Tip Controls -->
          <div class="p-2 rounded bg-light border mb-3" style="background: var(--bg-card) !important; border-color: var(--card-border) !important;">
            <div class="row g-2">
              <div class="col-6">
                <label class="form-label small fw-bold text-muted mb-1">Tax / GST (%)</label>
                <div class="input-group input-group-sm">
                  <input type="number" step="0.5" min="0" max="100" id="itemizedTaxPct" class="form-control" value="${initialTax}" oninput="ExpensesManager.updateItemizedSplitCalculation()">
                  <span class="input-group-text">%</span>
                </div>
              </div>
              <div class="col-6">
                <label class="form-label small fw-bold text-muted mb-1">Tip / Delivery Fee (₹)</label>
                <div class="input-group input-group-sm">
                  <span class="input-group-text">₹</span>
                  <input type="number" step="1" min="0" id="itemizedTipAmount" class="form-control" value="${initialTip}" oninput="ExpensesManager.updateItemizedSplitCalculation()">
                </div>
              </div>
            </div>
          </div>

          <!-- Calculated Per-Member Breakdown Preview -->
          <div class="p-2 rounded" style="background: rgba(79, 70, 229, 0.08); border: 1px dashed var(--primary);">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <small class="fw-bold text-primary"><i class="fa-solid fa-calculator me-1"></i> Member Share Breakdown:</small>
              <span class="badge-custom badge-category" id="itemizedTotalBadge">Total: ₹0</span>
            </div>
            <div id="itemizedMemberSharesPreview" class="d-flex flex-column gap-1">
              <!-- Populated via calculation -->
            </div>
          </div>
        </div>
      `;

      // Schedule row rendering after HTML insertion
      setTimeout(() => {
        this.renderItemizedRows(members);
        this.updateItemizedSplitCalculation();
      }, 50);
    }

    return html;
  }

  static renderItemizedRows(members = null) {
    const container = document.getElementById('itemizedRowsList');
    if (!container) return;

    if (!members) {
      const activeGroup = storage.getGroupById(document.getElementById('expenseGroupSelect')?.value);
      members = activeGroup ? activeGroup.members : [];
    }

    container.innerHTML = this.currentItemizedRows.map((item, idx) => `
      <div class="itemized-item-card p-2 rounded border" style="background: var(--bg-card); border-color: var(--card-border) !important;">
        <div class="d-flex align-items-center gap-2 mb-2">
          <input type="text" class="form-control form-control-sm itemized-name-input" placeholder="e.g. Pizza, Drinks" value="${item.name || ''}" oninput="ExpensesManager.onItemNameChange(${idx}, this.value)">
          <div class="input-group input-group-sm" style="max-width: 120px;">
            <span class="input-group-text">₹</span>
            <input type="number" step="0.01" min="0" class="form-control text-end itemized-amt-input" placeholder="0.00" value="${item.amount || ''}" oninput="ExpensesManager.onItemAmountChange(${idx}, this.value)">
          </div>
          ${this.currentItemizedRows.length > 1 ? `
            <button type="button" class="btn btn-sm btn-outline-danger p-1 px-2" title="Remove item" onclick="ExpensesManager.removeItemizedRow(${idx})">
              <i class="fa-solid fa-trash"></i>
            </button>
          ` : ''}
        </div>
        
        <div class="d-flex align-items-center gap-1 flex-wrap">
          <small class="text-muted fw-bold me-1" style="font-size: 0.75rem;">Shared by:</small>
          ${members.map(m => {
            const isSelected = item.consumers.includes(m);
            return `
              <button type="button" class="btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline-secondary'} py-0 px-2 rounded-pill" style="font-size: 0.75rem;" onclick="ExpensesManager.toggleItemConsumer(${idx}, '${m}')">
                ${m} ${isSelected ? '✓' : ''}
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `).join('');
  }

  static addItemizedRow() {
    const activeGroup = storage.getGroupById(document.getElementById('expenseGroupSelect')?.value);
    const members = activeGroup ? activeGroup.members : [];
    const nextNum = this.currentItemizedRows.length + 1;
    this.currentItemizedRows.push({
      id: 'item_' + Date.now(),
      name: `Item ${nextNum}`,
      amount: '',
      consumers: [...members]
    });
    this.renderItemizedRows(members);
    this.updateItemizedSplitCalculation();
  }

  static removeItemizedRow(index) {
    this.currentItemizedRows.splice(index, 1);
    const activeGroup = storage.getGroupById(document.getElementById('expenseGroupSelect')?.value);
    this.renderItemizedRows(activeGroup ? activeGroup.members : null);
    this.updateItemizedSplitCalculation();
  }

  static onItemNameChange(index, value) {
    if (this.currentItemizedRows[index]) {
      this.currentItemizedRows[index].name = value;
    }
  }

  static onItemAmountChange(index, value) {
    if (this.currentItemizedRows[index]) {
      this.currentItemizedRows[index].amount = parseFloat(value) || 0;
      this.updateItemizedSplitCalculation();
    }
  }

  static toggleItemConsumer(index, member) {
    if (!this.currentItemizedRows[index]) return;
    const consumers = this.currentItemizedRows[index].consumers;
    const pos = consumers.indexOf(member);
    if (pos >= 0) {
      if (consumers.length > 1) {
        consumers.splice(pos, 1);
      }
    } else {
      consumers.push(member);
    }
    const activeGroup = storage.getGroupById(document.getElementById('expenseGroupSelect')?.value);
    this.renderItemizedRows(activeGroup ? activeGroup.members : null);
    this.updateItemizedSplitCalculation();
  }

  static updateItemizedSplitCalculation() {
    const activeGroup = storage.getGroupById(document.getElementById('expenseGroupSelect')?.value);
    if (!activeGroup) return;

    const members = activeGroup.members || [];
    const memberBaseShares = {};
    members.forEach(m => { memberBaseShares[m] = 0; });

    let itemsSubtotal = 0;

    this.currentItemizedRows.forEach(item => {
      const amt = parseFloat(item.amount) || 0;
      itemsSubtotal += amt;
      const count = (item.consumers && item.consumers.length > 0) ? item.consumers.length : members.length;
      const sharePerPerson = amt / count;

      (item.consumers || members).forEach(m => {
        if (memberBaseShares[m] !== undefined) {
          memberBaseShares[m] += sharePerPerson;
        }
      });
    });

    const taxPct = parseFloat(document.getElementById('itemizedTaxPct')?.value) || 0;
    const tipAmt = parseFloat(document.getElementById('itemizedTipAmount')?.value) || 0;

    const taxTotal = itemsSubtotal * (taxPct / 100);
    const extraCharges = taxTotal + tipAmt;
    const grandTotal = Math.round((itemsSubtotal + extraCharges) * 100) / 100;

    // Update main expense amount input
    const mainAmtInput = document.getElementById('expenseAmount');
    if (mainAmtInput) {
      mainAmtInput.value = grandTotal > 0 ? grandTotal : '';
    }

    // Pro-rate extra charges (tax + tip) proportionally to base items consumed
    const finalShares = {};
    members.forEach(m => {
      const base = memberBaseShares[m] || 0;
      let extra = 0;
      if (itemsSubtotal > 0) {
        extra = (base / itemsSubtotal) * extraCharges;
      } else if (members.length > 0) {
        extra = extraCharges / members.length;
      }
      finalShares[m] = Math.round((base + extra) * 100) / 100;
    });

    // Update total badge
    const badge = document.getElementById('itemizedTotalBadge');
    if (badge) {
      badge.textContent = `Total: ₹${grandTotal.toLocaleString('en-IN')}`;
    }

    // Render Preview Shares
    const previewContainer = document.getElementById('itemizedMemberSharesPreview');
    if (previewContainer) {
      previewContainer.innerHTML = members.map(m => `
        <div class="d-flex justify-content-between align-items-center small py-1 border-bottom" style="border-color: var(--card-border) !important;">
          <span class="text-main fw-bold">${m}</span>
          <span class="fw-bold text-primary">₹${(finalShares[m] || 0).toLocaleString('en-IN')}</span>
        </div>
      `).join('');
    }

    return { grandTotal, finalShares, itemsSubtotal, taxTotal, tipAmt };
  }

  static toggleSelectAllMembers(select) {
    document.querySelectorAll('.split-member-check').forEach(chk => { chk.checked = select; });
    this.updateEqualSplitPreview();
  }

  static updateEqualSplitPreview() {
    const totalAmount = parseFloat(document.getElementById('expenseAmount')?.value) || 0;
    const checkboxes = Array.from(document.querySelectorAll('.split-member-check'));
    const checked = checkboxes.filter(c => c.checked);

    if (checked.length === 0) {
      checkboxes.forEach(c => {
        const valEl = document.getElementById(`preview_${c.value}`);
        if (valEl) valEl.textContent = '₹0';
      });
      return;
    }

    const share = Math.round((totalAmount / checked.length) * 100) / 100;
    checkboxes.forEach(c => {
      const valEl = document.getElementById(`preview_${c.value}`);
      if (valEl) valEl.textContent = c.checked ? `₹${share}` : '₹0';
    });
  }

  static validateExactSplit() {
    const totalAmount = parseFloat(document.getElementById('expenseAmount')?.value) || 0;
    const inputs = document.querySelectorAll('.exact-split-input');
    let sum = 0;
    inputs.forEach(input => { sum += parseFloat(input.value) || 0; });

    const diff = Math.round((totalAmount - sum) * 100) / 100;
    const badge = document.getElementById('exact_diff_badge');
    if (badge) {
      if (Math.abs(diff) < 0.01) {
        badge.className = 'badge-custom badge-credit';
        badge.innerHTML = '<i class="fa-solid fa-check"></i> Balanced';
      } else if (diff > 0) {
        badge.className = 'badge-custom badge-category';
        badge.innerHTML = `Remaining: ₹${diff}`;
      } else {
        badge.className = 'badge-custom badge-debt';
        badge.innerHTML = `Over by: ₹${Math.abs(diff)}`;
      }
    }
    return Math.abs(diff) < 0.01;
  }

  static validatePctSplit() {
    const totalAmount = parseFloat(document.getElementById('expenseAmount')?.value) || 0;
    const inputs = document.querySelectorAll('.pct-split-input');
    let totalPct = 0;

    inputs.forEach(input => {
      const pct = parseFloat(input.value) || 0;
      totalPct += pct;
      const member = input.dataset.member;
      const valEl = document.getElementById(`pct_val_${member}`);
      if (valEl) {
        const amt = Math.round((totalAmount * (pct / 100)) * 100) / 100;
        valEl.textContent = `₹${amt}`;
      }
    });

    const badge = document.getElementById('pct_diff_badge');
    if (badge) {
      if (Math.abs(totalPct - 100) < 0.01) {
        badge.className = 'badge-custom badge-credit';
        badge.innerHTML = '<i class="fa-solid fa-check"></i> 100% Balanced';
      } else {
        badge.className = 'badge-custom badge-debt';
        badge.innerHTML = `Total: ${totalPct}% / 100%`;
      }
    }
    return Math.abs(totalPct - 100) < 0.01;
  }

  static collectSplits(splitType, totalAmount) {
    let splits = {};
    let itemizedBreakdown = null;

    if (splitType === 'equal') {
      const checkboxes = Array.from(document.querySelectorAll('.split-member-check:checked'));
      if (checkboxes.length === 0) throw new Error('Please select at least one member.');
      const share = Math.round((totalAmount / checkboxes.length) * 100) / 100;
      checkboxes.forEach(c => { splits[c.value] = share; });
    } else if (splitType === 'exact') {
      const inputs = document.querySelectorAll('.exact-split-input');
      let sum = 0;
      inputs.forEach(input => {
        const val = parseFloat(input.value) || 0;
        if (val > 0) {
          splits[input.dataset.member] = val;
          sum += val;
        }
      });
      if (Math.abs(sum - totalAmount) > 0.05) {
        throw new Error(`Total exact amounts (₹${sum}) must equal ₹${totalAmount}.`);
      }
    } else if (splitType === 'percentage') {
      const inputs = document.querySelectorAll('.pct-split-input');
      let totalPct = 0;
      inputs.forEach(input => {
        const pct = parseFloat(input.value) || 0;
        if (pct > 0) {
          const share = Math.round((totalAmount * (pct / 100)) * 100) / 100;
          splits[input.dataset.member] = share;
          totalPct += pct;
        }
      });
      if (Math.abs(totalPct - 100) > 0.05) {
        throw new Error(`Percentages must add up to 100% (currently ${totalPct}%).`);
      }
    } else if (splitType === 'itemized') {
      const calc = this.updateItemizedSplitCalculation();
      if (!calc || calc.grandTotal <= 0) {
        throw new Error('Please add at least one line item with a price.');
      }
      splits = calc.finalShares;
      const taxPct = parseFloat(document.getElementById('itemizedTaxPct')?.value) || 0;
      const tipAmount = parseFloat(document.getElementById('itemizedTipAmount')?.value) || 0;

      itemizedBreakdown = {
        items: this.currentItemizedRows,
        taxPct: taxPct,
        tipAmount: tipAmount,
        subtotal: calc.itemsSubtotal,
        total: calc.grandTotal
      };
    }

    return { splits, itemizedBreakdown };
  }

  static renderExpenseItem(expense, currentUserName) {
    const cat = this.getCategoryMeta(expense.category);
    const dateFormatted = new Date(expense.date || expense.createdAt).toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric'
    });

    const isPayer = expense.paidBy === currentUserName;
    const userShare = expense.splits ? (expense.splits[currentUserName] || 0) : 0;

    let shareSnippet = '';
    if (isPayer) {
      const lent = (parseFloat(expense.amount) || 0) - userShare;
      shareSnippet = `<span class="badge-custom badge-credit d-block text-end">+₹${lent.toLocaleString('en-IN')}</span><small class="text-muted d-block text-end fw-bold">you lent</small>`;
    } else if (userShare > 0) {
      shareSnippet = `<span class="badge-custom badge-debt d-block text-end">-₹${userShare.toLocaleString('en-IN')}</span><small class="text-muted d-block text-end fw-bold">your share</small>`;
    } else {
      shareSnippet = `<span class="badge-custom badge-settled d-block text-end">₹0</span><small class="text-muted d-block text-end">not involved</small>`;
    }

    const isItemized = expense.splitType === 'itemized' && expense.itemizedBreakdown;

    return `
      <div class="expense-item">
        <div class="d-flex align-items-center gap-3">
          <div class="expense-cat-icon" style="background: ${cat.color}15; color: ${cat.color}">
            ${cat.icon}
          </div>
          <div>
            <div class="d-flex align-items-center gap-2">
              <h6 class="mb-0 text-main fw-bold">${expense.title}</h6>
              ${isItemized ? `<span class="badge bg-warning-subtle text-warning border px-2 py-0 small" style="font-size: 0.7rem;"><i class="fa-solid fa-list-ol me-1"></i>Itemized (${expense.itemizedBreakdown.items.length})</span>` : ''}
            </div>
            <div class="d-flex align-items-center gap-2 flex-wrap mt-1">
              <small class="text-muted fw-semibold"><i class="fa-regular fa-calendar me-1"></i>${dateFormatted}</small>
              <small class="text-muted">•</small>
              <small class="text-muted fw-semibold">Paid by <strong class="${isPayer ? 'text-primary' : 'text-main'}">${isPayer ? 'You' : expense.paidBy}</strong></small>
              <span class="badge-custom badge-category text-capitalize">${expense.splitType || 'equal'}</span>
            </div>
            ${expense.notes ? `<small class="text-muted fst-italic d-block mt-1">${expense.notes}</small>` : ''}
          </div>
        </div>

        <div class="d-flex align-items-center gap-3">
          <div>
            <strong class="d-block text-end fs-6 text-main">₹${(parseFloat(expense.amount) || 0).toLocaleString('en-IN')}</strong>
            ${shareSnippet}
          </div>

          <div class="dropdown">
            <button class="btn btn-sm btn-link text-muted p-1" data-bs-toggle="dropdown">
              <i class="fa-solid fa-ellipsis-vertical"></i>
            </button>
            <ul class="dropdown-menu dropdown-menu-end shadow">
              <li><a class="dropdown-item" href="javascript:void(0)" onclick="App.openEditExpenseModal('${expense.id}')"><i class="fa-solid fa-pen-to-square me-2 text-warning"></i>Edit</a></li>
              <li><a class="dropdown-item text-danger" href="javascript:void(0)" onclick="App.deleteExpense('${expense.id}')"><i class="fa-solid fa-trash me-2"></i>Delete</a></li>
            </ul>
          </div>
        </div>
      </div>
    `;
  }
}

window.ExpensesManager = ExpensesManager;
