/**
 * SPLITZY 2.0 — Supabase-Integrated Data Manager & Cache
 * 
 * Provides:
 * - In-memory and real-time synchronized data cache
 * - Bridge to Supabase Engine for PostgreSQL persistence
 * - NPCI UPI ID validation & utilities
 * - Theme settings
 */

const STORAGE_KEYS = {
  THEME: 'splitzy_theme_v2',
  MEMBER_UPIS: 'splitzy_member_upis_v2',
  ACTIVE_GROUP: 'splitzy_active_group_v2',
  GROUPS: 'splitzy_groups_v2',
  EXPENSES: 'splitzy_expenses_v2',
  SETTLEMENTS: 'splitzy_settlements_v2',
  LOCAL_USER: 'splitzy_local_user_v2',
  ACTIVE_VIEW: 'splitzy_active_view_v2'
};

class StorageManager {
  constructor() {
    this.groupsCache = [];
    this.expensesCache = [];
    this.settlementsCache = [];
    this.memberUpis = {};
    this.init();
  }

  init() {
    // Load local caches immediately so data is available instantly on page load/refresh
    try {
      this.groupsCache = JSON.parse(localStorage.getItem(STORAGE_KEYS.GROUPS)) || [];
    } catch (e) {
      this.groupsCache = [];
    }
    try {
      this.expensesCache = JSON.parse(localStorage.getItem(STORAGE_KEYS.EXPENSES)) || [];
    } catch (e) {
      this.expensesCache = [];
    }
    try {
      this.settlementsCache = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTLEMENTS)) || [];
    } catch (e) {
      this.settlementsCache = [];
    }
    try {
      this.memberUpis = JSON.parse(localStorage.getItem(STORAGE_KEYS.MEMBER_UPIS)) || {};
    } catch (e) {
      this.memberUpis = {};
    }
  }

  persistGroups() {
    try {
      localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(this.groupsCache));
    } catch (e) {
      console.warn('[Splitzy Storage] Failed to persist groups:', e);
    }
  }

  persistExpenses() {
    try {
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(this.expensesCache));
    } catch (e) {
      console.warn('[Splitzy Storage] Failed to persist expenses:', e);
    }
  }

  persistSettlements() {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTLEMENTS, JSON.stringify(this.settlementsCache));
    } catch (e) {
      console.warn('[Splitzy Storage] Failed to persist settlements:', e);
    }
  }

  clearState() {
    this.groupsCache = [];
    this.expensesCache = [];
    this.settlementsCache = [];
    this.persistGroups();
    this.persistExpenses();
    this.persistSettlements();
    window.dispatchEvent(new CustomEvent('splitzy:data-updated'));
  }

  // --- Cache Updaters (Called by Supabase Realtime Engine & Local Operations) ---
  setGroupsCache(groups) {
    this.groupsCache = groups || [];
    this.persistGroups();
  }

  upsertGroupInCache(group) {
    if (!group || !group.id) return;
    const idx = this.groupsCache.findIndex(g => g.id === group.id || (group.code && g.code === group.code));
    if (idx !== -1) {
      this.groupsCache[idx] = { ...this.groupsCache[idx], ...group };
    } else {
      this.groupsCache.unshift(group);
    }
    this.persistGroups();
  }

  removeGroupFromCache(groupId) {
    this.groupsCache = this.groupsCache.filter(g => g.id !== groupId && g.code !== groupId);
    this.expensesCache = this.expensesCache.filter(e => e.groupId !== groupId);
    this.settlementsCache = this.settlementsCache.filter(s => s.groupId !== groupId);
    this.persistGroups();
    this.persistExpenses();
    this.persistSettlements();
  }

  setExpensesCache(expenses) {
    this.expensesCache = expenses || [];
    this.persistExpenses();
  }

  upsertExpenseInCache(expense) {
    if (!expense || !expense.id) return;
    const idx = this.expensesCache.findIndex(e => e.id === expense.id);
    if (idx !== -1) {
      this.expensesCache[idx] = { ...this.expensesCache[idx], ...expense };
    } else {
      this.expensesCache.unshift(expense);
    }
    this.persistExpenses();
  }

  removeExpenseFromCache(expenseId) {
    this.expensesCache = this.expensesCache.filter(e => e.id !== expenseId);
    this.persistExpenses();
  }

  setSettlementsCache(settlements) {
    this.settlementsCache = settlements || [];
    this.persistSettlements();
  }

  upsertSettlementInCache(settlement) {
    if (!settlement || !settlement.id) return;
    const idx = this.settlementsCache.findIndex(s => s.id === settlement.id);
    if (idx !== -1) {
      this.settlementsCache[idx] = { ...this.settlementsCache[idx], ...settlement };
    } else {
      this.settlementsCache.unshift(settlement);
    }
    this.persistSettlements();
  }

  removeSettlementFromCache(settlementId) {
    this.settlementsCache = this.settlementsCache.filter(s => s.id !== settlementId);
    this.persistSettlements();
  }

  /**
   * Generates a clean, shareable 6-character Group Code (e.g., GRP-7492)
   */
  static generateGroupCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `GRP-${code}`;
  }

  // --- User Profile Getters (Backed by Supabase Engine + LocalStorage fallback) ---
  getUserProfile() {
    if (typeof supabaseEngine !== 'undefined' && supabaseEngine.getUser()) {
      const user = supabaseEngine.getUser();
      this.setLocalUserProfile(user);
      return user;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.LOCAL_USER);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {}
    return { name: 'You', email: '', upiId: '', color: '#4f46e5' };
  }

  setLocalUserProfile(user) {
    if (!user) return;
    try {
      localStorage.setItem(STORAGE_KEYS.LOCAL_USER, JSON.stringify(user));
    } catch (e) {}
  }

  getUserName() {
    const p = this.getUserProfile();
    return p ? (p.name || 'You') : 'You';
  }

  getUserUpiId() {
    const p = this.getUserProfile();
    return p ? (p.upiId || '') : '';
  }

  // --- UPI Validation & Registry ---
  static validateUpiId(upiId) {
    if (!upiId || typeof upiId !== 'string') {
      return { valid: false, message: 'UPI ID cannot be empty.' };
    }
    const clean = upiId.trim();
    const upiRegex = /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z0-9]{2,32}$/;
    
    if (!upiRegex.test(clean)) {
      return { 
        valid: false, 
        message: 'Invalid UPI ID format. Should look like name@bank (e.g. rahul@okaxis or 9876543210@paytm).' 
      };
    }
    
    const forbiddenChars = /[<>'";`\\(){}\[\]\r\n&?=#%]/;
    if (forbiddenChars.test(clean)) {
      return { valid: false, message: 'UPI ID contains invalid or unsafe characters.' };
    }
    
    return { valid: true, cleanUpi: clean.toLowerCase() };
  }

  static maskUpiId(upiId) {
    if (!upiId || typeof upiId !== 'string' || !upiId.includes('@')) return upiId || '';
    const [handle, provider] = upiId.split('@');
    if (handle.length <= 4) {
      return `${handle.substring(0, 1)}***@${provider}`;
    }
    const start = handle.substring(0, Math.min(3, Math.floor(handle.length / 2)));
    const end = handle.substring(handle.length - 2);
    return `${start}***${end}@${provider}`;
  }

  getMemberUpi(memberName) {
    if (!memberName) return '';
    const currentUserName = this.getUserName();
    if (memberName === currentUserName || memberName === 'You') {
      const userUpi = this.getUserUpiId();
      if (userUpi) return userUpi;
    }
    if (this.memberUpis[memberName]) return this.memberUpis[memberName];
    const sanitized = memberName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${sanitized || 'pay'}@okaxis`;
  }

  setMemberUpi(memberName, upiId) {
    if (!memberName) return false;
    const cleanId = (upiId || '').trim();
    if (cleanId) {
      const validation = StorageManager.validateUpiId(cleanId);
      if (validation.valid) {
        this.memberUpis[memberName] = validation.cleanUpi;
      } else {
        return false;
      }
    } else {
      delete this.memberUpis[memberName];
    }
    try {
      localStorage.setItem(STORAGE_KEYS.MEMBER_UPIS, JSON.stringify(this.memberUpis));
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('splitzy:data-updated'));
    return true;
  }

  // --- Theme Management ---
  getTheme() {
    return localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
  }

  setTheme(theme) {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    document.documentElement.setAttribute('data-theme', theme);
  }

  // --- Groups Management ---
  getGroups() {
    return this.groupsCache;
  }

  getGroupById(groupId) {
    if (!groupId) return null;
    return this.groupsCache.find(g => g.id === groupId || g.code === groupId.toUpperCase()) || null;
  }

  async saveGroup(groupData) {
    const currentUser = this.getUserName();
    let formatted;

    if (groupData.id) {
      formatted = {
        ...groupData,
        updatedAt: new Date().toISOString()
      };
      this.upsertGroupInCache(formatted);
    } else {
      const code = StorageManager.generateGroupCode();
      formatted = {
        id: code.toLowerCase(),
        code: code,
        name: groupData.name.trim(),
        category: groupData.category || 'General',
        icon: groupData.icon || 'fa-users',
        color: groupData.color || '#4f46e5',
        members: Array.from(new Set([currentUser, ...(groupData.members || [])])),
        createdBy: currentUser,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.upsertGroupInCache(formatted);
    }

    window.dispatchEvent(new CustomEvent('splitzy:data-updated'));

    // Persist to Supabase in real-time
    if (typeof supabaseEngine !== 'undefined' && supabaseEngine.isConfigured()) {
      await supabaseEngine.saveGroupToDb(formatted);
    }

    return formatted;
  }

  async addMemberToGroup(groupId, memberName) {
    const trimmed = (memberName || '').trim();
    if (!trimmed) return false;

    const group = this.getGroupById(groupId);
    if (!group) return false;

    if (!group.members.includes(trimmed)) {
      group.members.push(trimmed);
      group.updatedAt = new Date().toISOString();
      this.upsertGroupInCache(group);
      window.dispatchEvent(new CustomEvent('splitzy:data-updated'));

      if (typeof supabaseEngine !== 'undefined' && supabaseEngine.isConfigured()) {
        await supabaseEngine.saveGroupToDb(group);
      }
    }
    return true;
  }

  async deleteGroup(groupId) {
    this.removeGroupFromCache(groupId);
    window.dispatchEvent(new CustomEvent('splitzy:data-updated'));

    if (typeof supabaseEngine !== 'undefined' && supabaseEngine.isConfigured()) {
      await supabaseEngine.deleteGroupFromDb(groupId);
    }
  }

  // --- Expenses Management ---
  getExpenses() {
    return this.expensesCache;
  }

  getExpensesByGroup(groupId) {
    return this.expensesCache.filter(e => e.groupId === groupId);
  }

  getExpenseById(id) {
    return this.expensesCache.find(e => e.id === id) || null;
  }

  async saveExpense(expenseData) {
    if (expenseData.id) {
      expenseData.updatedAt = new Date().toISOString();
      this.upsertExpenseInCache(expenseData);
    } else {
      expenseData.id = 'exp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      expenseData.createdAt = new Date().toISOString();
      expenseData.updatedAt = expenseData.createdAt;
      this.upsertExpenseInCache(expenseData);
    }

    window.dispatchEvent(new CustomEvent('splitzy:data-updated'));

    if (typeof supabaseEngine !== 'undefined' && supabaseEngine.isConfigured()) {
      await supabaseEngine.saveExpenseToDb(expenseData);
    }
    return expenseData;
  }

  async deleteExpense(expenseId) {
    this.removeExpenseFromCache(expenseId);
    window.dispatchEvent(new CustomEvent('splitzy:data-updated'));

    if (typeof supabaseEngine !== 'undefined' && supabaseEngine.isConfigured()) {
      await supabaseEngine.deleteExpenseFromDb(expenseId);
    }
  }

  // --- Settlements Management ---
  getSettlements() {
    return this.settlementsCache;
  }

  getSettlementsByGroup(groupId) {
    return this.settlementsCache.filter(s => s.groupId === groupId);
  }

  async saveSettlement(settlementData) {
    if (!settlementData.id) {
      settlementData.id = 'stl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      settlementData.createdAt = new Date().toISOString();
    }
    this.upsertSettlementInCache(settlementData);
    window.dispatchEvent(new CustomEvent('splitzy:data-updated'));

    if (typeof supabaseEngine !== 'undefined' && supabaseEngine.isConfigured()) {
      await supabaseEngine.saveSettlementToDb(settlementData);
    }
    return settlementData;
  }

  recordSettlement(settlementData) {
    return this.saveSettlement(settlementData);
  }

  // --- Portable Payloads & Backup Utilities ---
  exportGroupPayload(groupId) {
    const group = this.getGroupById(groupId);
    if (!group) return null;
    const expenses = this.getExpensesByGroup(group.id);
    const payload = {
      g: { id: group.id, c: group.code, n: group.name, cat: group.category, i: group.icon, col: group.color, m: group.members },
      e: expenses.map(e => ({ id: e.id, t: e.title, a: e.amount, c: e.category, d: e.date, p: e.paidBy, st: e.splitType, sp: e.splits, it: e.itemizedData, n: e.notes }))
    };
    try {
      if (typeof LZString !== 'undefined') {
        return LZString.compressToEncodedURIComponent(JSON.stringify(payload));
      }
      return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    } catch (e) {
      return null;
    }
  }

  importGroupPayload(compressedStr) {
    try {
      let jsonStr;
      if (typeof LZString !== 'undefined') {
        jsonStr = LZString.decompressFromEncodedURIComponent(compressedStr);
      }
      if (!jsonStr) {
        jsonStr = decodeURIComponent(escape(atob(compressedStr)));
      }
      const data = JSON.parse(jsonStr);
      if (!data || !data.g || !data.g.id) return { success: false, message: 'Invalid payload' };

      const group = {
        id: data.g.id,
        code: data.g.c || data.g.id.toUpperCase(),
        name: data.g.n,
        category: data.g.cat || 'General',
        icon: data.g.i || 'fa-users',
        color: data.g.col || '#4f46e5',
        members: data.g.m || [],
        createdBy: 'Imported',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.saveGroup(group);

      if (Array.isArray(data.e)) {
        data.e.forEach(e => {
          this.saveExpense({
            id: e.id,
            groupId: group.id,
            title: e.t,
            amount: e.a,
            category: e.c,
            date: e.d,
            paidBy: e.p,
            splitType: e.st,
            splits: e.sp,
            itemizedData: e.it,
            notes: e.n
          });
        });
      }
      return { success: true, group: group, expenseCount: data.e ? data.e.length : 0 };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  exportJSON() {
    const data = {
      groups: this.groupsCache,
      expenses: this.expensesCache,
      settlements: this.settlementsCache,
      exportedAt: new Date().toISOString(),
      version: '2.0-supabase'
    };
    return JSON.stringify(data, null, 2);
  }

  importJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data.groups && Array.isArray(data.groups)) {
        data.groups.forEach(g => this.saveGroup(g));
      }
      if (data.expenses && Array.isArray(data.expenses)) {
        data.expenses.forEach(e => this.saveExpense(e));
      }
      if (data.settlements && Array.isArray(data.settlements)) {
        data.settlements.forEach(s => this.saveSettlement(s));
      }
      return { success: true };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }
}

const storage = new StorageManager();

