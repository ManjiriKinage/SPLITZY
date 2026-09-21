/**
 * SPLITZY 2.0 — Central App Controller
 * Orchestrates routing, onboarding, PWA install, UPI settlements, and itemized splits.
 */

class SplitzyApp {
  constructor() {
    this.currentView = 'dashboard';
    this.activeGroupId = null;
    this.currentSplitType = 'equal';
    this.editingExpenseId = null;
    this.tempGroupMembers = [];
    this.deferredPrompt = null;
  }

  init() {
    // 1. Theme initialization
    const savedTheme = storage.getTheme();
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeIcon(savedTheme);

    // 2. User Profile Setup / Onboarding Check
    this.checkUserProfileOnboarding();

    // 3. Navigation Setup (Desktop + Mobile)
    this.setupNavigation();

    // 4. Global Event Listeners & PWA Install Hook
    this.setupEventListeners();

    // 5. Check URL parameters for ?join=CODE or ?group=CODE
    this.handleUrlJoinParameters();

    // 6. Initial View Render
    this.renderActiveView();
  }

  // --- Onboarding & Profile Management ---
  checkUserProfileOnboarding() {
    const profile = storage.getUserProfile();
    const userBtnLabel = document.getElementById('navbarUserName');

    if (!profile) {
      setTimeout(() => {
        const modalEl = document.getElementById('userOnboardingModal');
        if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show();
      }, 400);
      if (userBtnLabel) userBtnLabel.textContent = 'Set Name';
    } else {
      if (userBtnLabel) userBtnLabel.textContent = profile.name;
    }
  }

  saveUserProfileFromModal() {
    const nameInput = document.getElementById('onboardingUserName');
    const upiInput = document.getElementById('onboardingUserUpi');
    const name = nameInput?.value.trim();
    const upi = upiInput?.value.trim() || '';

    if (!name) {
      this.showToast('Please enter your name', 'warning');
      return;
    }

    storage.setUserProfile(name, upi);
    const modalEl = document.getElementById('userOnboardingModal');
    bootstrap.Modal.getInstance(modalEl)?.hide();

    this.showToast(`Welcome to Splitzy, ${name}! 🎉`, 'success');
    this.renderActiveView();
  }

  openProfileEditModal() {
    const profile = storage.getUserProfile();
    const nameInput = document.getElementById('editProfileNameInput');
    const upiInput = document.getElementById('editProfileUpiInput');

    if (nameInput) nameInput.value = profile ? profile.name : '';
    if (upiInput) upiInput.value = profile ? (profile.upiId || '') : '';

    const modalEl = document.getElementById('profileEditModal');
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  saveProfileEdit() {
    const nameInput = document.getElementById('editProfileNameInput');
    const upiInput = document.getElementById('editProfileUpiInput');
    const name = nameInput?.value.trim();
    const upi = upiInput?.value.trim() || '';

    if (!name) {
      this.showToast('Name cannot be empty', 'warning');
      return;
    }

    storage.setUserProfile(name, upi);
    const modalEl = document.getElementById('profileEditModal');
    bootstrap.Modal.getInstance(modalEl)?.hide();
    this.showToast('Profile and UPI updated!', 'success');
    this.renderActiveView();
  }

  // --- URL Join Deep Links & Cross-Device Portable Sync ---
  handleUrlJoinParameters() {
    let joinCode = null;
    let payloadData = null;

    // 1. Check Hash parameters (#join=...&data=...)
    if (window.location.hash) {
      const hashStr = window.location.hash.substring(1);
      const hashParams = new URLSearchParams(hashStr);
      joinCode = hashParams.get('join') || hashParams.get('group');
      payloadData = hashParams.get('data') || hashParams.get('payload') || hashParams.get('sync');
    }

    // 2. Check Search Query parameters (?join=...&data=...)
    if (!payloadData || !joinCode) {
      const urlParams = new URLSearchParams(window.location.search);
      if (!joinCode) joinCode = urlParams.get('join') || urlParams.get('group');
      if (!payloadData) payloadData = urlParams.get('data') || urlParams.get('payload') || urlParams.get('sync');
    }

    // 3. If portable data payload is present, import & sync group immediately!
    if (payloadData) {
      const importResult = storage.importGroupPayload(payloadData);
      if (importResult.success && importResult.group) {
        const currentUserName = storage.getUserName();
        storage.addMemberToGroup(importResult.group.id, currentUserName);
        
        // Clean URL to keep it pretty and prevent re-importing on reload
        const cleanUrl = window.location.pathname + '?group=' + encodeURIComponent(importResult.group.id);
        window.history.replaceState({}, document.title, cleanUrl);

        this.openGroupDetail(importResult.group.id);
        this.showToast(`🎉 Joined "${importResult.group.name}" with ${importResult.expenseCount || 0} expenses!`, 'success');
        return;
      } else {
        this.showToast('Could not import group data: invalid payload.', 'danger');
      }
    }

    // 4. If only join code was provided
    if (joinCode) {
      const group = storage.getGroupById(joinCode);
      if (group) {
        const currentUserName = storage.getUserName();
        storage.addMemberToGroup(group.id, currentUserName);
        this.openGroupDetail(group.id);
        this.showToast(`Joined group: ${group.name}! 🚀`, 'success');
      } else {
        this.showToast(`Group code "${joinCode}" not found on this device. Paste the full Invite Link to sync!`, 'warning');
        this.openJoinGroupModal(joinCode);
      }
    }
  }

  setupEventListeners() {
    // Storage data updates
    window.addEventListener('splitzy:data-updated', () => {
      this.renderActiveView();
    });

    window.addEventListener('splitzy:user-updated', (e) => {
      const userBtnLabel = document.getElementById('navbarUserName');
      if (userBtnLabel) userBtnLabel.textContent = e.detail.name;
      this.renderActiveView();
    });

    // PWA Install Prompt Listener
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      const installBtn = document.getElementById('pwaInstallBtn');
      if (installBtn) {
        installBtn.style.display = 'inline-flex';
      }
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      const installBtn = document.getElementById('pwaInstallBtn');
      if (installBtn) installBtn.style.display = 'none';
      this.showToast('Splitzy installed successfully! 📱', 'success');
    });

    // Theme Toggle
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        storage.setTheme(next);
        this.updateThemeIcon(next);
        if (this.currentView === 'group') {
          AnalyticsManager.renderGroupAnalytics(this.activeGroupId);
        }
      });
    }

    // Split inputs live listeners
    const expAmtInput = document.getElementById('expenseAmount');
    if (expAmtInput) {
      expAmtInput.addEventListener('input', () => {
        if (this.currentSplitType === 'equal') ExpensesManager.updateEqualSplitPreview();
        else if (this.currentSplitType === 'exact') ExpensesManager.validateExactSplit();
        else if (this.currentSplitType === 'percentage') ExpensesManager.validatePctSplit();
      });
    }

    const expGroupSelect = document.getElementById('expenseGroupSelect');
    if (expGroupSelect) {
      expGroupSelect.addEventListener('change', (e) => {
        this.onExpenseGroupChanged(e.target.value);
      });
    }

    // Search and Category Filter
    const searchInput = document.getElementById('expenseSearchInput');
    const catFilter = document.getElementById('expenseCategoryFilter');
    if (searchInput) searchInput.addEventListener('input', () => this.filterExpensesList());
    if (catFilter) catFilter.addEventListener('change', () => this.filterExpensesList());
  }

  promptPwaInstall() {
    if (!this.deferredPrompt) {
      this.showToast('App is ready for installation from your browser menu!', 'info');
      return;
    }
    this.deferredPrompt.prompt();
    this.deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('[Splitzy] User accepted the install prompt');
      }
      this.deferredPrompt = null;
      const installBtn = document.getElementById('pwaInstallBtn');
      if (installBtn) installBtn.style.display = 'none';
    });
  }

  updateThemeIcon(theme) {
    const icon = document.querySelector('#themeToggleBtn i');
    if (icon) {
      icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
  }

  setupNavigation() {
    // Desktop Tabs
    document.querySelectorAll('.splitzy-nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.navigate(tab.dataset.view);
      });
    });

    // Mobile Bottom Nav Items
    document.querySelectorAll('.mobile-nav-item[data-view]').forEach(tab => {
      tab.addEventListener('click', () => {
        this.navigate(tab.dataset.view);
      });
    });
  }

  navigate(viewName, groupId = null) {
    this.currentView = viewName;
    if (groupId) this.activeGroupId = groupId;

    // Desktop tabs update
    document.querySelectorAll('.splitzy-nav-tab').forEach(tab => {
      if (tab.dataset.view === viewName) tab.classList.add('active');
      else tab.classList.remove('active');
    });

    // Mobile bottom nav update
    document.querySelectorAll('.mobile-nav-item').forEach(tab => {
      if (tab.dataset.view === viewName) tab.classList.add('active');
      else tab.classList.remove('active');
    });

    // View sections toggle
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.add('d-none'));

    const targetSection = document.getElementById(`view-${viewName}`);
    if (targetSection) targetSection.classList.remove('d-none');

    this.renderActiveView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  renderActiveView() {
    const currentUserName = storage.getUserName();
    this.renderMetricsRibbon(currentUserName);

    if (this.currentView === 'dashboard') {
      this.renderDashboardView(currentUserName);
    } else if (this.currentView === 'group') {
      this.renderGroupDetailView(this.activeGroupId, currentUserName);
    } else if (this.currentView === 'settlements') {
      this.renderSettlementsCenterView(currentUserName);
    } else if (this.currentView === 'activity') {
      this.renderActivityHistoryView(currentUserName);
    }
  }

  renderMetricsRibbon(currentUserName) {
    const summary = SettlementEngine.getUserGlobalSummary(currentUserName);
    const groups = storage.getGroups().filter(g => g.members.includes(currentUserName));

    const totalBalanceEl = document.getElementById('metricTotalBalance');
    const owedToYouEl = document.getElementById('metricOwedToYou');
    const youOweEl = document.getElementById('metricYouOwe');
    const totalGroupsEl = document.getElementById('metricTotalGroups');

    if (totalBalanceEl) {
      const net = summary.netBalance;
      totalBalanceEl.textContent = `${net >= 0 ? '+' : '-'}₹${Math.abs(net).toLocaleString('en-IN')}`;
      totalBalanceEl.className = `stat-value ${net > 0 ? 'text-success' : net < 0 ? 'text-danger' : 'text-main'}`;
    }
    if (owedToYouEl) owedToYouEl.textContent = `₹${summary.totalOwedToYou.toLocaleString('en-IN')}`;
    if (youOweEl) youOweEl.textContent = `₹${summary.totalYouOwe.toLocaleString('en-IN')}`;
    if (totalGroupsEl) totalGroupsEl.textContent = groups.length;
  }

  // --- 1. Dashboard View ---
  renderDashboardView(currentUserName) {
    const groups = storage.getGroups();
    const userGroups = groups.filter(g => g.members.includes(currentUserName));
    const container = document.getElementById('dashboardGroupsContainer');

    if (container) {
      if (userGroups.length === 0) {
        container.innerHTML = `
          <div class="col-12 text-center py-5">
            <div class="splitzy-card p-4 p-md-5">
              <i class="fa-solid fa-users fs-1 text-muted mb-3"></i>
              <h4 class="text-main fw-bold">No expense groups yet</h4>
              <p class="text-muted">Create a new group or join your friends using a Group Code.</p>
              <div class="d-flex justify-content-center gap-2 mt-3 flex-wrap">
                <button class="btn btn-splitzy-primary" onclick="App.openCreateGroupModal()">
                  <i class="fa-solid fa-plus me-1"></i> Create Group
                </button>
                <button class="btn btn-splitzy-secondary" onclick="App.openJoinGroupModal()">
                  <i class="fa-solid fa-key me-1"></i> Join by Code
                </button>
              </div>
            </div>
          </div>
        `;
      } else {
        container.innerHTML = userGroups.map(g => GroupsManager.renderGroupCard(g, currentUserName)).join('');
      }
    }

    // Quick Settlements
    const quickSettlementsContainer = document.getElementById('dashboardQuickSettlements');
    if (quickSettlementsContainer) {
      const summary = SettlementEngine.getUserGlobalSummary(currentUserName);
      if (summary.debts.length === 0 && summary.credits.length === 0) {
        quickSettlementsContainer.innerHTML = `
          <div class="text-center py-4 text-muted">
            <i class="fa-solid fa-circle-check fs-2 text-success mb-2"></i>
            <p class="mb-0 fw-semibold">You're all settled up! 🎉</p>
          </div>
        `;
      } else {
        let html = '';
        summary.debts.forEach(d => {
          html += `
            <div class="settlement-item">
              <div class="settlement-flow">
                <span class="text-danger fw-bold">You</span>
                <i class="fa-solid fa-arrow-right settlement-arrow"></i>
                <span class="text-main fw-bold">${d.to}</span>
              </div>
              <div class="d-flex align-items-center gap-2">
                <span class="fw-bold text-danger">₹${d.amount.toLocaleString('en-IN')}</span>
                <button class="btn btn-sm btn-splitzy-success py-1 px-2" onclick="App.openSettleUpModal('${d.groupId}', '${currentUserName}', '${d.to}', ${d.amount})">
                  <i class="fa-solid fa-qrcode me-1"></i> UPI Pay
                </button>
              </div>
            </div>
          `;
        });
        summary.credits.forEach(c => {
          html += `
            <div class="settlement-item">
              <div class="settlement-flow">
                <span class="text-main fw-bold">${c.from}</span>
                <i class="fa-solid fa-arrow-right settlement-arrow text-success"></i>
                <span class="text-success fw-bold">You</span>
              </div>
              <div class="d-flex align-items-center gap-2">
                <span class="fw-bold text-success">₹${c.amount.toLocaleString('en-IN')}</span>
                <button class="btn btn-sm btn-splitzy-secondary py-1 px-2" onclick="App.openSettleUpModal('${c.groupId}', '${c.from}', '${currentUserName}', ${c.amount})">
                  Settle
                </button>
              </div>
            </div>
          `;
        });
        quickSettlementsContainer.innerHTML = html;
      }
    }

    // Recent Activity
    const recentActivityContainer = document.getElementById('dashboardRecentActivity');
    if (recentActivityContainer) {
      const expenses = storage.getExpenses().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
      if (expenses.length === 0) {
        recentActivityContainer.innerHTML = '<p class="text-muted text-center py-3 fw-semibold">No recent activity.</p>';
      } else {
        recentActivityContainer.innerHTML = expenses.map(e => {
          const group = storage.getGroupById(e.groupId);
          return `
            <div class="d-flex align-items-center justify-content-between py-2 border-bottom" style="border-color: var(--card-border) !important;">
              <div class="d-flex align-items-center gap-2">
                <span class="fs-5">${EXPENSE_CATEGORIES[e.category]?.icon || '📦'}</span>
                <div>
                  <strong class="d-block text-main text-truncate" style="max-width: 180px;">${e.title}</strong>
                  <small class="text-muted fw-semibold">${e.paidBy} in ${group ? group.name : 'group'}</small>
                </div>
              </div>
              <span class="fw-bold text-main">₹${parseFloat(e.amount).toLocaleString('en-IN')}</span>
            </div>
          `;
        }).join('');
      }
    }
  }

  // --- 2. Group Detail View ---
  openGroupDetail(groupId) {
    this.navigate('group', groupId);
  }

  renderGroupDetailView(groupId, currentUserName) {
    const group = storage.getGroupById(groupId);
    if (!group) {
      this.navigate('dashboard');
      return;
    }

    document.getElementById('groupDetailName').textContent = group.name;
    document.getElementById('groupDetailIcon').textContent = group.icon || '👥';
    document.getElementById('groupDetailCode').textContent = group.code || group.id;

    // Member Chips
    const memberChipsContainer = document.getElementById('groupDetailMembers');
    if (memberChipsContainer) {
      memberChipsContainer.innerHTML = group.members.map(m => `
        <span class="badge rounded-pill bg-light text-dark border p-2 px-3 me-1 mb-1 d-inline-flex align-items-center gap-1 fw-bold">
          <span class="avatar-chip me-1" style="background-color: ${GroupsManager.getMemberColor(m)}; width: 22px; height: 22px; font-size: 0.65rem;">
            ${GroupsManager.getInitials(m)}
          </span>
          ${m} ${m === currentUserName ? '<span class="text-primary fw-bold ms-1">(You)</span>' : ''}
        </span>
      `).join('') + `
        <button class="btn btn-sm btn-outline-primary rounded-pill px-3 py-1 me-1 mb-1 fw-bold" onclick="App.openAddMemberModal('${group.id}')">
          <i class="fa-solid fa-plus me-1"></i> Add Member
        </button>
      `;
    }

    // Balances & Settlements
    const balances = SettlementEngine.calculateGroupBalances(group.id);
    const simplified = SettlementEngine.simplifyDebts(balances);

    const balancesContainer = document.getElementById('groupBalancesList');
    if (balancesContainer) {
      balancesContainer.innerHTML = Object.entries(balances).map(([m, data]) => {
        let badgeClass = data.net > 0 ? 'badge-credit' : data.net < 0 ? 'badge-debt' : 'badge-settled';
        let badgeText = data.net > 0 ? `+₹${data.net.toLocaleString('en-IN')}` : data.net < 0 ? `-₹${Math.abs(data.net).toLocaleString('en-IN')}` : '₹0';
        return `
          <div class="d-flex align-items-center justify-content-between p-2 rounded mb-2 border" style="background: var(--bg-surface-elevated); border-color: var(--card-border) !important;">
            <div class="d-flex align-items-center gap-2">
              <span class="avatar-chip" style="background-color: ${GroupsManager.getMemberColor(m)}">${GroupsManager.getInitials(m)}</span>
              <div>
                <strong class="text-main">${m}</strong>
                <small class="text-muted d-block fw-semibold">Paid ₹${data.totalPaid} • Share ₹${data.totalShare}</small>
              </div>
            </div>
            <span class="badge-custom ${badgeClass} fs-6">${badgeText}</span>
          </div>
        `;
      }).join('');
    }

    const settlementsContainer = document.getElementById('groupSimplifiedDebtsList');
    if (settlementsContainer) {
      if (simplified.length === 0) {
        settlementsContainer.innerHTML = `
          <div class="text-center py-4 text-muted">
            <i class="fa-solid fa-circle-check fs-2 text-success mb-2"></i>
            <p class="mb-0 fw-bold">All group debts are completely settled! 🎉</p>
          </div>
        `;
      } else {
        settlementsContainer.innerHTML = simplified.map(t => `
          <div class="settlement-item">
            <div class="settlement-flow">
              <span class="${t.from === currentUserName ? 'text-danger fw-bold' : 'text-main fw-bold'}">${t.from === currentUserName ? 'You' : t.from}</span>
              <i class="fa-solid fa-arrow-right settlement-arrow"></i>
              <span class="${t.to === currentUserName ? 'text-success fw-bold' : 'text-main fw-bold'}">${t.to === currentUserName ? 'You' : t.to}</span>
            </div>
            <div class="d-flex align-items-center gap-2">
              <span class="fw-bold fs-6 text-main">₹${t.amount.toLocaleString('en-IN')}</span>
              <button class="btn btn-sm btn-splitzy-success py-1 px-2" onclick="App.openSettleUpModal('${group.id}', '${t.from}', '${t.to}', ${t.amount})">
                <i class="fa-solid fa-qrcode me-1"></i> UPI Settle
              </button>
            </div>
          </div>
        `).join('');
      }
    }

    this.filterExpensesList();
    AnalyticsManager.renderGroupAnalytics(group.id);
  }

  filterExpensesList() {
    if (!this.activeGroupId) return;
    const currentUserName = storage.getUserName();
    const expenses = storage.getExpensesByGroup(this.activeGroupId);
    const searchVal = (document.getElementById('expenseSearchInput')?.value || '').toLowerCase();
    const catVal = document.getElementById('expenseCategoryFilter')?.value || 'ALL';

    const filtered = expenses.filter(e => {
      const matchSearch = e.title.toLowerCase().includes(searchVal) || e.paidBy.toLowerCase().includes(searchVal) || (e.notes && e.notes.toLowerCase().includes(searchVal));
      const matchCat = catVal === 'ALL' || e.category === catVal;
      return matchSearch && matchCat;
    });

    const container = document.getElementById('groupExpensesList') || document.getElementById('groupExpensesContainer');
    if (container) {
      if (filtered.length === 0) {
        container.innerHTML = `
          <div class="text-center py-5 text-muted">
            <i class="fa-solid fa-receipt fs-1 mb-2 opacity-50"></i>
            <p class="fw-semibold">No expenses found matching filter.</p>
          </div>
        `;
      } else {
        container.innerHTML = filtered.map(e => ExpensesManager.renderExpenseItem(e, currentUserName)).join('');
      }
    }
  }

  // --- 3. Settlements Center View ---
  renderSettlementsCenterView(currentUserName) {
    const summary = SettlementEngine.getUserGlobalSummary(currentUserName);

    const debtsContainer = document.getElementById('globalDebtsContainer');
    if (debtsContainer) {
      if (summary.debts.length === 0) {
        debtsContainer.innerHTML = '<p class="text-muted text-center py-4 fw-semibold"><i class="fa-solid fa-circle-check text-success me-1"></i> You do not owe anyone money.</p>';
      } else {
        debtsContainer.innerHTML = summary.debts.map(d => `
          <div class="settlement-item">
            <div>
              <div class="settlement-flow mb-1">
                <span class="text-danger fw-bold">You</span>
                <i class="fa-solid fa-arrow-right settlement-arrow"></i>
                <strong class="text-main">${d.to}</strong>
              </div>
              <small class="text-muted fw-semibold">in <strong>${d.groupName}</strong></small>
            </div>
            <div class="d-flex align-items-center gap-2">
              <strong class="text-danger fs-6">₹${d.amount.toLocaleString('en-IN')}</strong>
              <button class="btn btn-sm btn-splitzy-success py-1 px-3" onclick="App.openSettleUpModal('${d.groupId}', '${currentUserName}', '${d.to}', ${d.amount})">
                <i class="fa-solid fa-qrcode me-1"></i> Pay UPI
              </button>
            </div>
          </div>
        `).join('');
      }
    }

    const creditsContainer = document.getElementById('globalCreditsContainer');
    if (creditsContainer) {
      if (summary.credits.length === 0) {
        creditsContainer.innerHTML = '<p class="text-muted text-center py-4 fw-semibold"><i class="fa-solid fa-circle-check text-success me-1"></i> No one owes you money.</p>';
      } else {
        creditsContainer.innerHTML = summary.credits.map(c => `
          <div class="settlement-item">
            <div>
              <div class="settlement-flow mb-1">
                <strong class="text-main">${c.from}</strong>
                <i class="fa-solid fa-arrow-right settlement-arrow text-success"></i>
                <span class="text-success fw-bold">You</span>
              </div>
              <small class="text-muted fw-semibold">in <strong>${c.groupName}</strong></small>
            </div>
            <div class="d-flex align-items-center gap-2">
              <strong class="text-success fs-6">₹${c.amount.toLocaleString('en-IN')}</strong>
              <button class="btn btn-sm btn-splitzy-secondary py-1 px-3" onclick="App.openSettleUpModal('${c.groupId}', '${c.from}', '${currentUserName}', ${c.amount})">
                Settle
              </button>
            </div>
          </div>
        `).join('');
      }
    }
  }

  // --- 4. Activity History View ---
  renderActivityHistoryView(currentUserName) {
    const expenses = storage.getExpenses().sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
    const settlements = storage.getSettlements().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const container = document.getElementById('globalActivityLogContainer');

    if (container) {
      if (expenses.length === 0 && settlements.length === 0) {
        container.innerHTML = '<p class="text-muted text-center py-5 fw-semibold">No transactions recorded yet.</p>';
        return;
      }

      const events = [
        ...expenses.map(e => ({ type: 'expense', data: e, date: new Date(e.createdAt || e.date) })),
        ...settlements.map(s => ({ type: 'settlement', data: s, date: new Date(s.createdAt) }))
      ].sort((a, b) => b.date - a.date);

      container.innerHTML = events.map(ev => {
        if (ev.type === 'expense') {
          const e = ev.data;
          const group = storage.getGroupById(e.groupId);
          return `
            <div class="expense-item">
              <div class="d-flex align-items-center gap-3">
                <div class="expense-cat-icon">${EXPENSE_CATEGORIES[e.category]?.icon || '📦'}</div>
                <div>
                  <h6 class="mb-0 text-main fw-bold">${e.title}</h6>
                  <small class="text-muted fw-semibold">${e.paidBy} in <strong>${group ? group.name : 'Group'}</strong> • ${ev.date.toLocaleDateString('en-IN')}</small>
                </div>
              </div>
              <strong class="fs-6 text-main">₹${parseFloat(e.amount).toLocaleString('en-IN')}</strong>
            </div>
          `;
        } else {
          const s = ev.data;
          const group = storage.getGroupById(s.groupId);
          return `
            <div class="expense-item" style="border-left: 4px solid var(--success);">
              <div class="d-flex align-items-center gap-3">
                <div class="expense-cat-icon" style="background: var(--success-light); color: var(--success);">🤝</div>
                <div>
                  <h6 class="mb-0 text-success fw-bold">Settlement Payment</h6>
                  <small class="text-muted fw-semibold"><strong>${s.payer}</strong> paid <strong>${s.receiver}</strong> in ${group ? group.name : 'Group'}</small>
                </div>
              </div>
              <strong class="fs-6 text-success">₹${parseFloat(s.amount).toLocaleString('en-IN')}</strong>
            </div>
          `;
        }
      }).join('');
    }
  }

  // --- Modals & Actions ---

  // Add / Edit Expense Modal
  openAddExpenseModal(preselectedGroupId = null) {
    this.editingExpenseId = null;
    const modalEl = document.getElementById('expenseModal');
    const modalTitle = document.getElementById('expenseModalTitle');
    if (modalTitle) modalTitle.textContent = 'Add New Expense';

    const groupSelect = document.getElementById('expenseGroupSelect');
    const groups = storage.getGroups();
    const currentUserName = storage.getUserName();
    const userGroups = groups.filter(g => g.members.includes(currentUserName));
    const activeGroups = userGroups.length > 0 ? userGroups : groups;

    if (activeGroups.length === 0) {
      this.showToast('Please create a group first!', 'warning');
      this.openCreateGroupModal();
      return;
    }

    const targetGroupId = preselectedGroupId || this.activeGroupId || activeGroups[0]?.id;

    groupSelect.innerHTML = activeGroups.map(g => `
      <option value="${g.id}" ${g.id === targetGroupId ? 'selected' : ''}>${g.icon || '👥'} ${g.name} (${g.code})</option>
    `).join('');

    document.getElementById('expenseTitle').value = '';
    document.getElementById('expenseAmount').value = '';
    document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('expenseCategory').value = 'Food';
    document.getElementById('expenseNotes').value = '';

    this.setSplitType('equal');
    this.onExpenseGroupChanged(targetGroupId);

    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  openEditExpenseModal(expenseId) {
    const expense = storage.getExpenseById(expenseId);
    if (!expense) return;

    this.editingExpenseId = expenseId;
    const modalEl = document.getElementById('expenseModal');
    document.getElementById('expenseModalTitle').textContent = 'Edit Expense';

    const groupSelect = document.getElementById('expenseGroupSelect');
    const groups = storage.getGroups();
    groupSelect.innerHTML = groups.map(g => `
      <option value="${g.id}" ${g.id === expense.groupId ? 'selected' : ''}>${g.icon || '👥'} ${g.name}</option>
    `).join('');

    document.getElementById('expenseTitle').value = expense.title;
    document.getElementById('expenseAmount').value = expense.amount;
    document.getElementById('expenseDate').value = expense.date || new Date().toISOString().split('T')[0];
    document.getElementById('expenseCategory').value = expense.category || 'General';
    document.getElementById('expenseNotes').value = expense.notes || '';

    this.setSplitType(expense.splitType || 'equal');
    this.onExpenseGroupChanged(expense.groupId, expense.paidBy, expense.splits, expense.itemizedBreakdown);

    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  onExpenseGroupChanged(groupId, preselectedPayer = null, existingSplits = {}, existingItemized = null) {
    const group = storage.getGroupById(groupId);
    if (!group) return;

    const paidBySelect = document.getElementById('expensePaidBy');
    const currentUserName = storage.getUserName();
    const defaultPayer = preselectedPayer || (group.members.includes(currentUserName) ? currentUserName : group.members[0]);

    paidBySelect.innerHTML = group.members.map(m => `
      <option value="${m}" ${m === defaultPayer ? 'selected' : ''}>${m} ${m === currentUserName ? '(You)' : ''}</option>
    `).join('');

    const amount = parseFloat(document.getElementById('expenseAmount')?.value) || 0;
    const splitContainer = document.getElementById('splitBreakdownContainer');
    if (splitContainer) {
      splitContainer.innerHTML = ExpensesManager.generateSplitInputs(group, this.currentSplitType, existingSplits, amount, existingItemized);
      if (this.currentSplitType === 'equal') ExpensesManager.updateEqualSplitPreview();
      if (this.currentSplitType === 'exact') ExpensesManager.validateExactSplit();
      if (this.currentSplitType === 'percentage') ExpensesManager.validatePctSplit();
    }
  }

  setSplitType(type) {
    this.currentSplitType = type;
    document.querySelectorAll('.split-type-btn').forEach(btn => {
      if (btn.dataset.type === type) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    const groupId = document.getElementById('expenseGroupSelect')?.value;
    if (groupId) this.onExpenseGroupChanged(groupId);
  }

  saveExpenseFromModal() {
    try {
      const groupId = document.getElementById('expenseGroupSelect').value;
      const title = document.getElementById('expenseTitle').value.trim();
      const amount = parseFloat(document.getElementById('expenseAmount').value);
      const paidBy = document.getElementById('expensePaidBy').value;
      const category = document.getElementById('expenseCategory').value;
      const date = document.getElementById('expenseDate').value;
      const notes = document.getElementById('expenseNotes').value.trim();

      if (!title) throw new Error('Please enter an expense description.');
      if (isNaN(amount) || amount <= 0) throw new Error('Please enter a valid amount.');
      if (!paidBy) throw new Error('Please select who paid.');

      const { splits, itemizedBreakdown } = ExpensesManager.collectSplits(this.currentSplitType, amount);

      const expenseData = {
        groupId,
        title,
        amount,
        paidBy,
        category,
        date,
        notes,
        splitType: this.currentSplitType,
        splits,
        itemizedBreakdown
      };

      if (this.editingExpenseId) expenseData.id = this.editingExpenseId;

      storage.saveExpense(expenseData);

      const modalEl = document.getElementById('expenseModal');
      bootstrap.Modal.getInstance(modalEl)?.hide();

      this.showToast('Expense saved successfully!', 'success');
      this.triggerConfetti();
    } catch (err) {
      this.showToast(err.message, 'danger');
    }
  }

  deleteExpense(expenseId) {
    if (confirm('Delete this expense?')) {
      storage.deleteExpense(expenseId);
      this.showToast('Expense deleted', 'info');
    }
  }

  deleteGroup(groupId) {
    if (confirm('Are you sure you want to delete this group and all its expenses?')) {
      storage.deleteGroup(groupId);
      this.navigate('dashboard');
      this.showToast('Group deleted', 'info');
    }
  }

  // Create Group Modal
  openCreateGroupModal() {
    document.getElementById('newGroupName').value = '';
    document.getElementById('newGroupCategory').value = 'Trip';
    document.getElementById('newGroupIcon').value = '🏖️';
    this.tempGroupMembers = [];
    this.renderTempMemberChips();

    const modalEl = document.getElementById('createGroupModal');
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  renderTempMemberChips() {
    const container = document.getElementById('newGroupMembersList');
    const currentUserName = storage.getUserName();
    if (container) {
      container.innerHTML = `
        <span class="badge rounded-pill bg-primary p-2 px-3 me-1 mb-1 d-inline-flex align-items-center gap-1">
          👤 ${currentUserName} <small class="opacity-75">(You)</small>
        </span>
      ` + this.tempGroupMembers.map((m, idx) => `
        <span class="badge rounded-pill bg-dark border p-2 px-3 me-1 mb-1 d-inline-flex align-items-center gap-2">
          ${m}
          <i class="fa-solid fa-xmark cursor-pointer" onclick="App.removeTempMember(${idx})"></i>
        </span>
      `).join('');
    }
  }

  addMemberChip(name) {
    const trimmed = (name || '').trim();
    const currentUserName = storage.getUserName();
    if (!trimmed) return;
    if (trimmed.toLowerCase() === currentUserName.toLowerCase() || this.tempGroupMembers.includes(trimmed)) {
      this.showToast('Member already added', 'warning');
      return;
    }
    this.tempGroupMembers.push(trimmed);
    this.renderTempMemberChips();
  }

  removeTempMember(index) {
    this.tempGroupMembers.splice(index, 1);
    this.renderTempMemberChips();
  }

  saveNewGroup() {
    const name = document.getElementById('newGroupName').value.trim();
    const category = document.getElementById('newGroupCategory').value;
    const icon = document.getElementById('newGroupIcon').value || '👥';

    if (!name) {
      this.showToast('Please enter a group name', 'danger');
      return;
    }

    const group = storage.saveGroup({
      name,
      category,
      icon,
      members: this.tempGroupMembers
    });

    const modalEl = document.getElementById('createGroupModal');
    bootstrap.Modal.getInstance(modalEl)?.hide();

    this.showToast(`Group "${name}" created!`, 'success');
    this.openGroupDetail(group.id);
  }

  // Join Group / Import Data Modal
  openJoinGroupModal(prefill = '') {
    const input = document.getElementById('joinGroupCodeInput');
    if (input) input.value = prefill || '';
    const modalEl = document.getElementById('joinGroupModal');
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  async pasteIntoJoinInput() {
    try {
      const text = await navigator.clipboard.readText();
      const input = document.getElementById('joinGroupCodeInput');
      if (input && text) {
        input.value = text.trim();
        this.showToast('Pasted from clipboard!', 'info');
      }
    } catch (e) {
      this.showToast('Please paste manually using Ctrl+V or long-press.', 'info');
    }
  }

  joinGroupByCode() {
    const input = document.getElementById('joinGroupCodeInput');
    const rawVal = (input?.value || '').trim();
    if (!rawVal) {
      this.showToast('Please enter a Group Code or Invite Link', 'warning');
      return;
    }

    let payload = null;
    let code = rawVal;

    // Check if input is a URL or contains data payload parameter
    if (rawVal.includes('data=')) {
      try {
        const dummyBase = 'https://splitzy.app/';
        const parsedUrl = new URL(rawVal.startsWith('http') ? rawVal : `${dummyBase}${rawVal}`);
        const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));
        payload = hashParams.get('data') || parsedUrl.searchParams.get('data');
        code = hashParams.get('join') || parsedUrl.searchParams.get('join') || code;
      } catch (e) {
        const match = rawVal.match(/data=([^&]+)/);
        if (match) payload = decodeURIComponent(match[1]);
      }
    } else if (rawVal.length > 50 && !rawVal.startsWith('http')) {
      // Direct raw or compressed string
      payload = rawVal;
    }

    if (payload) {
      const importResult = storage.importGroupPayload(payload);
      if (importResult.success && importResult.group) {
        const currentUserName = storage.getUserName();
        storage.addMemberToGroup(importResult.group.id, currentUserName);
        const modalEl = document.getElementById('joinGroupModal');
        bootstrap.Modal.getInstance(modalEl)?.hide();
        this.showToast(`🎉 Joined "${importResult.group.name}" with ${importResult.expenseCount || 0} expenses!`, 'success');
        this.openGroupDetail(importResult.group.id);
        return;
      }
    }

    // Try finding by local code
    const group = storage.getGroupById(code);
    if (!group) {
      this.showToast(`Group "${code}" was not found on this device. Paste the full Invite Link to sync it!`, 'danger');
      return;
    }

    const currentUserName = storage.getUserName();
    storage.addMemberToGroup(group.id, currentUserName);

    const modalEl = document.getElementById('joinGroupModal');
    bootstrap.Modal.getInstance(modalEl)?.hide();

    this.showToast(`Joined "${group.name}"!`, 'success');
    this.openGroupDetail(group.id);
  }

  // Add Member to Existing Group Modal
  openAddMemberModal(groupId) {
    const group = storage.getGroupById(groupId);
    if (!group) return;
    document.getElementById('addMemberGroupId').value = group.id;
    document.getElementById('addMemberNameInput').value = '';

    const modalEl = document.getElementById('addMemberModal');
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  saveAddMember() {
    const groupId = document.getElementById('addMemberGroupId').value;
    const name = document.getElementById('addMemberNameInput').value.trim();
    if (!name) {
      this.showToast('Please enter a member name', 'warning');
      return;
    }

    const success = storage.addMemberToGroup(groupId, name);
    if (success) {
      const modalEl = document.getElementById('addMemberModal');
      bootstrap.Modal.getInstance(modalEl)?.hide();
      this.showToast(`Added ${name} to group!`, 'success');
      this.renderGroupDetailView(groupId, storage.getUserName());
    } else {
      this.showToast('Failed to add member', 'danger');
    }
  }

  // Share Group Invite Modal with QR Sync
  openShareGroupModal(groupId) {
    const group = storage.getGroupById(groupId);
    if (!group) return;

    const inviteLink = GroupsManager.getInviteLink(group);
    document.getElementById('shareGroupModalTitle').textContent = `Invite & Sync "${group.name}"`;
    document.getElementById('shareGroupCodeDisplay').textContent = group.code || group.id;
    document.getElementById('shareGroupLinkInput').value = inviteLink;
    document.getElementById('shareGroupCurrentGroupId').value = group.id;

    // Render high-res QR code for another device to scan
    const canvas = document.getElementById('shareGroupQrCanvas');
    if (canvas && typeof QRious !== 'undefined') {
      try {
        new QRious({
          element: canvas,
          value: inviteLink,
          size: 180,
          level: 'L'
        });
      } catch (e) {
        console.warn('[Splitzy] QRious generation error:', e);
      }
    }

    const modalEl = document.getElementById('shareGroupModal');
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  // Settle Up Modal & UPI QR Integration
  openSettleUpModal(groupId, from, to, amount) {
    const modalEl = document.getElementById('settleUpModal');
    document.getElementById('settleGroupId').value = groupId;
    document.getElementById('settleFrom').value = from;
    document.getElementById('settleTo').value = to;
    document.getElementById('settleAmount').value = amount;

    document.getElementById('settlePayerName').textContent = from;
    document.getElementById('settleReceiverName').textContent = to;

    // Load Beneficiary UPI ID
    const upiId = storage.getMemberUpi(to);
    const upiInput = document.getElementById('settleReceiverUpiInput');
    if (upiInput) upiInput.value = upiId;

    this.refreshSettleUpiDetails();

    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  refreshSettleUpiDetails() {
    const receiver = document.getElementById('settleTo')?.value || '';
    const amount = parseFloat(document.getElementById('settleAmount')?.value) || 0;
    const qrCanvas = document.getElementById('settleUpiQrCanvas');
    const payLink = document.getElementById('settleUpiPayLink');

    if (qrCanvas) {
      const upiUri = SettlementEngine.renderUpiQrCode(qrCanvas, receiver, amount);
      if (payLink && upiUri) {
        payLink.href = upiUri;
      }
    }
  }

  onSettleReceiverUpiChange(val) {
    const receiver = document.getElementById('settleTo')?.value;
    if (receiver && val.trim()) {
      storage.setMemberUpi(receiver, val.trim());
      this.refreshSettleUpiDetails();
    }
  }

  copySettleUpiId() {
    const input = document.getElementById('settleReceiverUpiInput');
    if (!input || !input.value) return;
    navigator.clipboard.writeText(input.value).then(() => {
      this.showToast('UPI ID copied to clipboard!', 'success');
    }).catch(() => {
      this.showToast('Failed to copy UPI ID', 'danger');
    });
  }

  copySettleUpiLink() {
    const receiver = document.getElementById('settleTo')?.value || '';
    const amount = parseFloat(document.getElementById('settleAmount')?.value) || 0;
    const upiUri = SettlementEngine.generateUpiUri(receiver, amount);

    navigator.clipboard.writeText(upiUri).then(() => {
      this.showToast('UPI payment link copied!', 'success');
    }).catch(() => {
      this.showToast('Failed to copy UPI link', 'danger');
    });
  }

  downloadCurrentSettlementReceipt() {
    const payer = document.getElementById('settleFrom')?.value || 'User';
    const receiver = document.getElementById('settleTo')?.value || 'Friend';
    const amount = document.getElementById('settleAmount')?.value || 0;
    const groupId = document.getElementById('settleGroupId')?.value;
    const group = storage.getGroupById(groupId);

    ExportManager.downloadSettlementReceiptPDF(payer, receiver, amount, group ? group.name : 'Splitzy Group');
  }

  recordSettlementPayment() {
    const groupId = document.getElementById('settleGroupId').value;
    const payer = document.getElementById('settleFrom').value;
    const receiver = document.getElementById('settleTo').value;
    const amount = parseFloat(document.getElementById('settleAmount').value);

    if (isNaN(amount) || amount <= 0) {
      this.showToast('Invalid amount', 'danger');
      return;
    }

    storage.recordSettlement({ groupId, payer, receiver, amount });

    const modalEl = document.getElementById('settleUpModal');
    bootstrap.Modal.getInstance(modalEl)?.hide();

    this.showToast(`Settlement of ₹${amount} recorded!`, 'success');
    this.triggerConfetti();
  }

  // --- JSON Backup & Restore ---
  exportBackupJSON() {
    const jsonStr = storage.exportJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Splitzy_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    this.showToast('Backup JSON exported!', 'success');
  }

  importBackupJSON(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      const res = storage.importJSON(content);
      if (res.success) {
        this.showToast('Data restored successfully! 🎉', 'success');
        this.renderActiveView();
      } else {
        this.showToast(`Restore failed: ${res.message}`, 'danger');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  // Toast & Confetti
  showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;

    const iconMap = {
      success: '<i class="fa-solid fa-circle-check text-success me-2"></i>',
      danger: '<i class="fa-solid fa-triangle-exclamation text-danger me-2"></i>',
      warning: '<i class="fa-solid fa-circle-exclamation text-warning me-2"></i>',
      info: '<i class="fa-solid fa-info-circle text-primary me-2"></i>'
    };

    const toastEl = document.createElement('div');
    toastEl.className = 'toast splitzy-toast show align-items-center mb-2';
    toastEl.setAttribute('role', 'alert');
    toastEl.innerHTML = `
      <div class="d-flex p-2">
        <div class="toast-body d-flex align-items-center fw-bold">
          ${iconMap[type] || ''}
          <span>${message}</span>
        </div>
        <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    `;

    toastContainer.appendChild(toastEl);
    setTimeout(() => {
      toastEl.classList.remove('show');
      setTimeout(() => toastEl.remove(), 250);
    }, 3500);
  }

  triggerConfetti() {
    if (typeof confetti === 'function') {
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.7 } });
    }
  }
}

const App = new SplitzyApp();
window.App = App;

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
