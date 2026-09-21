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

  /**
   * Validates if a string conforms to the official NPCI UPI Virtual Payment Address (VPA) standard
   * Format: username@bankhandle (e.g. rahul@okaxis, 9876543210@paytm, user.name@ybl)
   */
  static validateUpiId(upiId) {
    if (!upiId || typeof upiId !== 'string') {
      return { valid: false, message: 'UPI ID cannot be empty.' };
    }
    const clean = upiId.trim();
    
    // Strict NPCI VPA regex: allows alphanumeric, dots, hyphens, underscores before '@', and valid bank handle after '@'
    const upiRegex = /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z0-9]{2,32}$/;
    
    if (!upiRegex.test(clean)) {
      return { 
        valid: false, 
        message: 'Invalid UPI ID format. Should look like name@bank (e.g. rahul@okaxis or 9876543210@paytm).' 
      };
    }
    
    // Disallow dangerous injection characters
    const forbiddenChars = /[<>'";`\\(){}\[\]\r\n&?=#%]/;
    if (forbiddenChars.test(clean)) {
      return { valid: false, message: 'UPI ID contains invalid or unsafe characters.' };
    }
    
    return { valid: true, cleanUpi: clean.toLowerCase() };
  }

  /**
   * Masks a UPI ID for privacy (e.g., 9876543210@paytm -> 98765***10@paytm)
   */
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
    if (!memberName) return false;
    const upis = this.getMemberUpis();
    const cleanId = (upiId || '').trim();
    if (cleanId) {
      const validation = StorageManager.validateUpiId(cleanId);
      if (validation.valid) {
        upis[memberName] = validation.cleanUpi;
      } else {
        return false;
      }
    } else {
      delete upis[memberName];
    }
    localStorage.setItem(STORAGE_KEYS.MEMBER_UPIS, JSON.stringify(upis));
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
        icon: groupData.icon || 'fa-users',
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
      name: 'Weekend Getaway',
      category: 'Trip',
      icon: 'fa-plane',
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

  // --- Cross-Device Portable Sync Engine ---
  /**
   * Encodes a group and all its expenses into a compressed, portable payload string
   */
  exportGroupPayload(groupId) {
    const group = this.getGroupById(groupId);
    if (!group) return null;

    const expenses = this.getExpensesByGroup(group.id);
    const settlements = this.getSettlementsByGroup(group.id);
    const memberUpis = {};
    const allUpis = this.getMemberUpis();
    (group.members || []).forEach(m => {
      if (allUpis[m]) memberUpis[m] = allUpis[m];
    });

    const payload = {
      v: 2,
      g: group,
      e: expenses,
      s: settlements,
      u: memberUpis,
      ts: Date.now()
    };

    const jsonStr = JSON.stringify(payload);
    try {
      if (typeof LZString !== 'undefined' && LZString.compressToEncodedURIComponent) {
        return LZString.compressToEncodedURIComponent(jsonStr);
      }
    } catch (e) {
      console.warn('[Splitzy] LZString compression failed, falling back to base64:', e);
    }
    return encodeURIComponent(btoa(unescape(encodeURIComponent(jsonStr))));
  }

  /**
   * Decodes a compressed or raw group payload and seamlessly merges it into local storage
   */
  importGroupPayload(payloadInput) {
    if (!payloadInput) return { success: false, message: 'No payload provided' };

    let payload = null;
    if (typeof payloadInput === 'object' && payloadInput.g) {
      payload = payloadInput;
    } else if (typeof payloadInput === 'string') {
      const cleanInput = payloadInput.trim();
      // Try LZString decompress
      try {
        if (typeof LZString !== 'undefined' && LZString.decompressFromEncodedURIComponent) {
          const decompressed = LZString.decompressFromEncodedURIComponent(cleanInput);
          if (decompressed) {
            payload = JSON.parse(decompressed);
          }
        }
      } catch (e) {}

      // Try URL-decoded base64 fallback
      if (!payload) {
        try {
          const decoded = decodeURIComponent(escape(atob(decodeURIComponent(cleanInput))));
          payload = JSON.parse(decoded);
        } catch (e) {}
      }

      // Try raw JSON parse
      if (!payload) {
        try {
          payload = JSON.parse(cleanInput);
        } catch (e) {}
      }
    }

    if (!payload || !payload.g || !payload.g.name) {
      return { success: false, message: 'Invalid or corrupted group data payload.' };
    }

    const importedGroup = {
      id: String(payload.g.id || '').replace(/[^a-zA-Z0-9_\-]/g, ''),
      code: String(payload.g.code || '').replace(/[^a-zA-Z0-9_\-]/g, '').toUpperCase(),
      name: String(payload.g.name || '').trim().substring(0, 100),
      category: String(payload.g.category || 'General').substring(0, 50),
      icon: String(payload.g.icon || '👥').substring(0, 10),
      color: String(payload.g.color || '#4f46e5').substring(0, 20),
      members: Array.isArray(payload.g.members) ? payload.g.members.map(m => String(m).trim()).filter(Boolean) : [],
      createdBy: String(payload.g.createdBy || 'User'),
      createdAt: payload.g.createdAt || new Date().toISOString()
    };

    const importedExpenses = Array.isArray(payload.e) ? payload.e.map(e => ({
      id: String(e.id || 'exp_' + Math.random().toString(36).substring(2, 8)),
      groupId: importedGroup.id,
      title: String(e.title || 'Expense').trim().substring(0, 150),
      category: String(e.category || 'General').substring(0, 50),
      amount: Math.max(0, Math.min(10000000, parseFloat(e.amount) || 0)),
      paidBy: String(e.paidBy || ''),
      date: e.date || new Date().toISOString().split('T')[0],
      notes: String(e.notes || '').substring(0, 300),
      splitType: e.splitType || 'equal',
      splits: (typeof e.splits === 'object' && e.splits !== null) ? e.splits : {},
      createdAt: e.createdAt || new Date().toISOString()
    })) : [];

    const importedSettlements = Array.isArray(payload.s) ? payload.s.map(s => ({
      id: String(s.id || 'set_' + Math.random().toString(36).substring(2, 8)),
      groupId: importedGroup.id,
      from: String(s.from || ''),
      to: String(s.to || ''),
      amount: Math.max(0, Math.min(10000000, parseFloat(s.amount) || 0)),
      date: s.date || new Date().toISOString().split('T')[0],
      upiRef: String(s.upiRef || '').substring(0, 100),
      createdAt: s.createdAt || new Date().toISOString()
    })) : [];

    // Sanitize & validate imported UPI addresses
    const importedUpis = {};
    if (typeof payload.u === 'object' && payload.u !== null) {
      Object.entries(payload.u).forEach(([name, upi]) => {
        const cleanName = String(name).trim();
        const validation = StorageManager.validateUpiId(String(upi));
        if (cleanName && validation.valid) {
          importedUpis[cleanName] = validation.cleanUpi;
        }
      });
    }

    // 1. Merge Group
    const groups = this.getGroups();
    const existingGroupIdx = groups.findIndex(g => g.id === importedGroup.id || (importedGroup.code && g.code === importedGroup.code));
    let isNew = false;

    if (existingGroupIdx !== -1) {
      const mergedMembers = Array.from(new Set([
        ...(groups[existingGroupIdx].members || []),
        ...(importedGroup.members || [])
      ]));
      groups[existingGroupIdx] = {
        ...groups[existingGroupIdx],
        ...importedGroup,
        members: mergedMembers,
        updatedAt: new Date().toISOString()
      };
    } else {
      groups.unshift(importedGroup);
      isNew = true;
    }
    localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));

    // 2. Merge Expenses (Avoid duplicates by id)
    const existingExpenses = this.getExpenses();
    importedExpenses.forEach(impExp => {
      const idx = existingExpenses.findIndex(e => e.id === impExp.id);
      if (idx !== -1) {
        existingExpenses[idx] = { ...existingExpenses[idx], ...impExp };
      } else {
        existingExpenses.unshift(impExp);
      }
    });
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(existingExpenses));

    // 3. Merge Settlements
    const existingSettlements = this.getSettlements();
    importedSettlements.forEach(impSet => {
      const idx = existingSettlements.findIndex(s => s.id === impSet.id);
      if (idx !== -1) {
        existingSettlements[idx] = { ...existingSettlements[idx], ...impSet };
      } else {
        existingSettlements.unshift(impSet);
      }
    });
    localStorage.setItem(STORAGE_KEYS.SETTLEMENTS, JSON.stringify(existingSettlements));

    // 4. Merge Member UPIs (Only validated ones)
    const existingUpis = this.getMemberUpis();
    Object.assign(existingUpis, importedUpis);
    localStorage.setItem(STORAGE_KEYS.MEMBER_UPIS, JSON.stringify(existingUpis));

    // 5. Ensure current user profile is a member
    const currentUser = this.getUserName();
    this.addMemberToGroup(importedGroup.id, currentUser);

    window.dispatchEvent(new CustomEvent('splitzy:data-updated'));
    return {
      success: true,
      group: importedGroup,
      expenseCount: importedExpenses.length,
      isNew: isNew
    };
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
