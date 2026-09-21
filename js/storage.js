/**
 * SPLITZY 2.0 — Universal LocalStorage Data Engine
 * Real-world collaborative storage with Group-by-ID indexing, Shareable Join Codes,
 * and user profile onboarding.
 */

const STORAGE_KEYS = {
  USER_PROFILE: 'splitzy_user_profile_v2',
  GROUPS: 'splitzy_groups_v2',
  EXPENSES: 'splitzy_expenses_v2',
  SETTLEMENTS: 'splitzy_settlements_v2',
  THEME: 'splitzy_theme_v2',
  MEMBER_UPIS: 'splitzy_member_upis_v2'
};

class StorageManager {
  constructor() {
    this.init();
  }

  init() {
    // Check if user has initialized previously
    if (!localStorage.getItem(STORAGE_KEYS.GROUPS)) {
      this.seedInitialStarterData();
    }
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

  // --- User Profile Management (Universal) ---
  getUserProfile() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  getUserName() {
    const profile = this.getUserProfile();
    return profile ? profile.name : 'You';
  }

  getUserUpiId() {
    const profile = this.getUserProfile();
    return profile ? (profile.upiId || '') : '';
  }

  setUserProfile(name, upiId = '') {
    const trimmed = (name || '').trim();
    if (!trimmed) return null;

    let profile = this.getUserProfile();
    if (profile) {
      profile.name = trimmed;
      if (upiId !== undefined) profile.upiId = (upiId || '').trim();
      profile.updatedAt = new Date().toISOString();
    } else {
      profile = {
        id: 'usr_' + Date.now(),
        name: trimmed,
        upiId: (upiId || '').trim(),
        createdAt: new Date().toISOString()
      };
    }

    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
    if (profile.upiId) {
      this.setMemberUpi(profile.name, profile.upiId);
    }
    window.dispatchEvent(new CustomEvent('splitzy:user-updated', { detail: profile }));
    return profile;
  }

  // --- Member UPI ID Registry ---
  getMemberUpis() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.MEMBER_UPIS)) || {};
    } catch (e) {
      return {};
    }
  }

  getMemberUpi(memberName) {
    if (!memberName) return '';
    const currentUserName = this.getUserName();
    if (memberName === currentUserName || memberName === 'You') {
      const userUpi = this.getUserUpiId();
      if (userUpi) return userUpi;
    }
    const upis = this.getMemberUpis();
    if (upis[memberName]) return upis[memberName];
    
    // Clean formatted default handle for demo/viva (e.g. rahul@okaxis)
    const sanitized = memberName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${sanitized || 'pay'}@okaxis`;
  }

  setMemberUpi(memberName, upiId) {
    if (!memberName) return;
    const upis = this.getMemberUpis();
    upis[memberName] = (upiId || '').trim();
    localStorage.setItem(STORAGE_KEYS.MEMBER_UPIS, JSON.stringify(upis));
    window.dispatchEvent(new CustomEvent('splitzy:data-updated'));
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
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.GROUPS)) || [];
    } catch (e) {
      return [];
    }
  }

  getGroupById(groupId) {
    if (!groupId) return null;
    const groups = this.getGroups();
    return groups.find(g => g.id === groupId || g.code === groupId.toUpperCase()) || null;
  }

  saveGroup(groupData) {
    const groups = this.getGroups();
    const currentUser = this.getUserName();

    if (groupData.id) {
      const idx = groups.findIndex(g => g.id === groupData.id);
      if (idx !== -1) {
        groups[idx] = { ...groups[idx], ...groupData, updatedAt: new Date().toISOString() };
      }
    } else {
      const code = StorageManager.generateGroupCode();
      const newGroup = {
        id: code.toLowerCase(),
        code: code,
        name: groupData.name.trim(),
        category: groupData.category || 'General',
        icon: groupData.icon || '👥',
        color: groupData.color || '#4f46e5',
        members: Array.from(new Set([currentUser, ...(groupData.members || [])])),
        createdBy: currentUser,
        createdAt: new Date().toISOString()
      };
      groups.unshift(newGroup);
      groupData = newGroup;
    }

    localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
    window.dispatchEvent(new CustomEvent('splitzy:data-updated'));
    return groupData;
  }

  addMemberToGroup(groupId, memberName) {
    const trimmed = (memberName || '').trim();
    if (!trimmed) return false;

    const groups = this.getGroups();
    const group = groups.find(g => g.id === groupId || g.code === groupId.toUpperCase());
    if (!group) return false;

    if (!group.members.includes(trimmed)) {
      group.members.push(trimmed);
      localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
      window.dispatchEvent(new CustomEvent('splitzy:data-updated'));
    }
    return true;
  }

  deleteGroup(groupId) {
    let groups = this.getGroups().filter(g => g.id !== groupId && g.code !== groupId);
    localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));

    // Delete associated expenses & settlements
    let expenses = this.getExpenses().filter(e => e.groupId !== groupId);
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));

    let settlements = this.getSettlements().filter(s => s.groupId !== groupId);
    localStorage.setItem(STORAGE_KEYS.SETTLEMENTS, JSON.stringify(settlements));

    window.dispatchEvent(new CustomEvent('splitzy:data-updated'));
  }

  // --- Expenses Management ---
  getExpenses() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.EXPENSES)) || [];
    } catch (e) {
      return [];
    }
  }

  getExpensesByGroup(groupId) {
    return this.getExpenses().filter(e => e.groupId === groupId);
  }

  getExpenseById(id) {
    return this.getExpenses().find(e => e.id === id) || null;
  }

  saveExpense(expenseData) {
    const expenses = this.getExpenses();
    if (expenseData.id) {
      const idx = expenses.findIndex(e => e.id === expenseData.id);
      if (idx !== -1) {
        expenses[idx] = { ...expenses[idx], ...expenseData, updatedAt: new Date().toISOString() };
      }
    } else {
      expenseData.id = 'exp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      expenseData.createdAt = new Date().toISOString();
      expenses.unshift(expenseData);
    }
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    window.dispatchEvent(new CustomEvent('splitzy:data-updated'));
    return expenseData;
  }

  deleteExpense(expenseId) {
    let expenses = this.getExpenses().filter(e => e.id !== expenseId);
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    window.dispatchEvent(new CustomEvent('splitzy:data-updated'));
  }

  // --- Settlements (Direct Payments) ---
  getSettlements() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTLEMENTS)) || [];
    } catch (e) {
      return [];
    }
  }

  getSettlementsByGroup(groupId) {
    return this.getSettlements().filter(s => s.groupId === groupId);
  }

  recordSettlement(settlementData) {
    const settlements = this.getSettlements();
    settlementData.id = 'set_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    settlementData.createdAt = new Date().toISOString();
    settlements.unshift(settlementData);
    localStorage.setItem(STORAGE_KEYS.SETTLEMENTS, JSON.stringify(settlements));
    window.dispatchEvent(new CustomEvent('splitzy:data-updated'));
    return settlementData;
  }

  // --- Initial Clean Starter Data ---
  seedInitialStarterData() {
    const sampleGroup = {
      id: 'grp-trip',
      code: 'GRP-TRIP',
      name: 'Weekend Getaway 🏖️',
      category: 'Trip',
      icon: '🏖️',
      color: '#4f46e5',
      members: ['You', 'Alex', 'Sam', 'Taylor'],
      createdBy: 'You',
      createdAt: new Date().toISOString()
    };

    const sampleExpenses = [
      {
        id: 'exp_sample_1',
        groupId: 'grp-trip',
        title: 'Beachside Villa Booking',
        category: 'Hotel',
        amount: 4800,
        paidBy: 'You',
        date: new Date().toISOString().split('T')[0],
        notes: '2 Nights stay',
        splitType: 'equal',
        splits: { 'You': 1200, 'Alex': 1200, 'Sam': 1200, 'Taylor': 1200 },
        createdAt: new Date().toISOString()
      },
      {
        id: 'exp_sample_2',
        groupId: 'grp-trip',
        title: 'Group Dinner & Drinks',
        category: 'Food',
        amount: 2400,
        paidBy: 'Alex',
        date: new Date().toISOString().split('T')[0],
        notes: 'Seafood restaurant',
        splitType: 'equal',
        splits: { 'You': 600, 'Alex': 600, 'Sam': 600, 'Taylor': 600 },
        createdAt: new Date().toISOString()
      }
    ];

    localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify([sampleGroup]));
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(sampleExpenses));
    localStorage.setItem(STORAGE_KEYS.SETTLEMENTS, JSON.stringify([]));
  }

  // --- Export & Import Backup ---
  exportJSON() {
    const data = {
      userProfile: this.getUserProfile(),
      groups: this.getGroups(),
      expenses: this.getExpenses(),
      settlements: this.getSettlements(),
      memberUpis: this.getMemberUpis(),
      exportedAt: new Date().toISOString()
    };
    return JSON.stringify(data, null, 2);
  }

  importJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.groups) {
        localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(parsed.groups));
        localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(parsed.expenses || []));
        localStorage.setItem(STORAGE_KEYS.SETTLEMENTS, JSON.stringify(parsed.settlements || []));
        if (parsed.userProfile) {
          localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(parsed.userProfile));
        }
        if (parsed.memberUpis) {
          localStorage.setItem(STORAGE_KEYS.MEMBER_UPIS, JSON.stringify(parsed.memberUpis));
        }
        window.dispatchEvent(new CustomEvent('splitzy:data-updated'));
        return { success: true };
      }
      return { success: false, message: 'Invalid file format' };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }
}

const storage = new StorageManager();
window.storage = storage;
