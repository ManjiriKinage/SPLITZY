/**
 * SPLITZY 2.0 — Real-Time Cloud Synchronization Engine (Firebase Firestore)
 * Enables seamless multi-device live data synchronization, cross-device join by code,
 * and automatic reactive UI updates via Firestore onSnapshot listeners.
 */

const FIREBASE_STORAGE_KEY = 'splitzy_firebase_config_v2';

class RealtimeSyncEngine {
  constructor() {
    this.db = null;
    this.app = null;
    this.status = 'unconfigured'; // 'unconfigured' | 'connecting' | 'connected' | 'error' | 'offline'
    this.activeListeners = [];
    this.isSyncingFromRemote = false;
  }

  /**
   * Initializes Firebase Firestore with stored or default configuration
   */
  init() {
    const config = this.getConfig();
    if (!config || !config.projectId) {
      this.status = 'unconfigured';
      this.notifyStatusChange();
      return;
    }

    try {
      this.status = 'connecting';
      this.notifyStatusChange();

      if (typeof firebase === 'undefined') {
        console.warn('[RealtimeSync] Firebase SDK not loaded yet.');
        this.status = 'error';
        this.notifyStatusChange();
        return;
      }

      // Initialize or get existing Firebase App
      if (!firebase.apps || firebase.apps.length === 0) {
        this.app = firebase.initializeApp(config);
      } else {
        this.app = firebase.app();
      }

      this.db = firebase.firestore();

      // Enable offline persistence in firestore if supported
      try {
        this.db.enablePersistence({ synchronizeTabs: true }).catch(err => {
          if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
            console.warn('[RealtimeSync] Firestore persistence notice:', err.message);
          }
        });
      } catch (e) {}

      this.status = 'connected';
      this.notifyStatusChange();
      console.log('⚡ [Splitzy Realtime] Connected to Firestore project:', config.projectId);

      // Start global listener for groups
      this.startGlobalGroupListener();
    } catch (err) {
      console.error('[RealtimeSync] Failed to initialize Firebase:', err);
      this.status = 'error';
      this.notifyStatusChange();
    }
  }

  getConfig() {
    try {
      const stored = localStorage.getItem(FIREBASE_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    // Check if developer provided default global config in window
    if (window.SPLITZY_FIREBASE_CONFIG) {
      return window.SPLITZY_FIREBASE_CONFIG;
    }
    return null;
  }

  saveConfig(configObj) {
    if (!configObj || !configObj.projectId) return false;
    localStorage.setItem(FIREBASE_STORAGE_KEY, JSON.stringify(configObj));
    this.init();
    return true;
  }

  removeConfig() {
    this.cleanupListeners();
    localStorage.removeItem(FIREBASE_STORAGE_KEY);
    this.db = null;
    this.status = 'unconfigured';
    this.notifyStatusChange();
  }

  isConfigured() {
    return this.status === 'connected' && this.db !== null;
  }

  notifyStatusChange() {
    window.dispatchEvent(new CustomEvent('splitzy:sync-status', { 
      detail: { status: this.status, configured: this.isConfigured() } 
    }));
  }

  cleanupListeners() {
    this.activeListeners.forEach(unsub => {
      try { if (typeof unsub === 'function') unsub(); } catch (e) {}
    });
    this.activeListeners = [];
  }

  // --- Real-Time Push Handlers (Local -> Cloud) ---

  async syncGroup(groupData) {
    if (!this.isConfigured() || this.isSyncingFromRemote || !groupData?.id) return;
    try {
      const cleanGroup = { ...groupData, updatedAt: new Date().toISOString() };
      await this.db.collection('groups').doc(groupData.id).set(cleanGroup, { merge: true });
    } catch (err) {
      console.warn('[RealtimeSync] Error syncing group:', err);
    }
  }

  async deleteGroup(groupId) {
    if (!this.isConfigured() || !groupId) return;
    try {
      await this.db.collection('groups').doc(groupId).delete();
      // Also delete associated expenses from cloud
      const expSnap = await this.db.collection('expenses').where('groupId', '==', groupId).get();
      const batch = this.db.batch();
      expSnap.forEach(doc => batch.delete(doc.ref));
      const setSnap = await this.db.collection('settlements').where('groupId', '==', groupId).get();
      setSnap.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    } catch (err) {
      console.warn('[RealtimeSync] Error deleting group from cloud:', err);
    }
  }

  async syncExpense(expenseData) {
    if (!this.isConfigured() || this.isSyncingFromRemote || !expenseData?.id) return;
    try {
      const cleanExpense = { ...expenseData, updatedAt: new Date().toISOString() };
      await this.db.collection('expenses').doc(expenseData.id).set(cleanExpense, { merge: true });
    } catch (err) {
      console.warn('[RealtimeSync] Error syncing expense:', err);
    }
  }

  async deleteExpense(expenseId) {
    if (!this.isConfigured() || !expenseId) return;
    try {
      await this.db.collection('expenses').doc(expenseId).delete();
    } catch (err) {
      console.warn('[RealtimeSync] Error deleting expense from cloud:', err);
    }
  }

  async syncSettlement(settlementData) {
    if (!this.isConfigured() || this.isSyncingFromRemote || !settlementData?.id) return;
    try {
      const cleanSettlement = { ...settlementData, updatedAt: new Date().toISOString() };
      await this.db.collection('settlements').doc(settlementData.id).set(cleanSettlement, { merge: true });
    } catch (err) {
      console.warn('[RealtimeSync] Error syncing settlement:', err);
    }
  }

  // --- Real-Time Subscriptions (Cloud -> Local Reactive UI) ---

  /**
   * Listens to global groups in cloud
   */
  startGlobalGroupListener() {
    if (!this.isConfigured()) return;
    try {
      const unsub = this.db.collection('groups').onSnapshot((snapshot) => {
        if (snapshot.empty && snapshot.docChanges().length === 0) return;

        let localGroups = storage.getGroups();
        let changed = false;

        snapshot.docChanges().forEach((change) => {
          const remoteGroup = change.doc.data();
          if (!remoteGroup || !remoteGroup.id) return;

          if (change.type === 'added' || change.type === 'modified') {
            const idx = localGroups.findIndex(g => g.id === remoteGroup.id || g.code === remoteGroup.code);
            if (idx === -1) {
              localGroups.unshift(remoteGroup);
              changed = true;
            } else {
              // Only overwrite if remote is newer or modified
              const localTs = new Date(localGroups[idx].updatedAt || localGroups[idx].createdAt || 0).getTime();
              const remoteTs = new Date(remoteGroup.updatedAt || remoteGroup.createdAt || 0).getTime();
              if (remoteTs >= localTs) {
                localGroups[idx] = { ...localGroups[idx], ...remoteGroup };
                changed = true;
              }
            }
          } else if (change.type === 'removed') {
            localGroups = localGroups.filter(g => g.id !== remoteGroup.id && g.code !== remoteGroup.code);
            changed = true;
          }
        });

        if (changed) {
          this.isSyncingFromRemote = true;
          localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(localGroups));
          window.dispatchEvent(new CustomEvent('splitzy:data-updated'));
          this.isSyncingFromRemote = false;
        }
      }, (err) => {
        console.warn('[RealtimeSync] Group listener error:', err);
      });

      this.activeListeners.push(unsub);
    } catch (e) {
      console.warn('[RealtimeSync] Could not attach global group listener:', e);
    }
  }

  /**
   * Subscribes to real-time changes for a specific open group (group details, expenses, settlements)
   */
  listenToGroup(groupId) {
    if (!this.isConfigured() || !groupId) return;

    // Remove any previous active group listeners
    this.cleanupListeners();
    this.startGlobalGroupListener();

    try {
      // 1. Group Doc Listener
      const unsubGroup = this.db.collection('groups').doc(groupId).onSnapshot(doc => {
        if (!doc.exists) return;
        const gData = doc.data();
        const groups = storage.getGroups();
        const idx = groups.findIndex(g => g.id === groupId || g.code === groupId);
        if (idx !== -1) {
          groups[idx] = { ...groups[idx], ...gData };
        } else {
          groups.unshift(gData);
        }
        this.isSyncingFromRemote = true;
        localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
        window.dispatchEvent(new CustomEvent('splitzy:data-updated'));
        this.isSyncingFromRemote = false;
      });
      this.activeListeners.push(unsubGroup);

      // 2. Expenses Live Listener for this Group
      const unsubExpenses = this.db.collection('expenses')
        .where('groupId', '==', groupId)
        .onSnapshot(snapshot => {
          let allExpenses = storage.getExpenses();
          let groupExpenses = [];
          let otherExpenses = allExpenses.filter(e => e.groupId !== groupId);

          snapshot.forEach(doc => {
            const exp = doc.data();
            if (exp && exp.id) groupExpenses.push(exp);
          });

          // Sort by creation date descending
          groupExpenses.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

          const merged = [...groupExpenses, ...otherExpenses];
          this.isSyncingFromRemote = true;
          localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(merged));
          window.dispatchEvent(new CustomEvent('splitzy:data-updated'));
          this.isSyncingFromRemote = false;
        }, err => {
          console.warn('[RealtimeSync] Expense listener error:', err);
        });
      this.activeListeners.push(unsubExpenses);

      // 3. Settlements Live Listener for this Group
      const unsubSettlements = this.db.collection('settlements')
        .where('groupId', '==', groupId)
        .onSnapshot(snapshot => {
          let allSettlements = storage.getSettlements();
          let groupSettlements = [];
          let otherSettlements = allSettlements.filter(s => s.groupId !== groupId);

          snapshot.forEach(doc => {
            const set = doc.data();
            if (set && set.id) groupSettlements.push(set);
          });

          groupSettlements.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

          const merged = [...groupSettlements, ...otherSettlements];
          this.isSyncingFromRemote = true;
          localStorage.setItem(STORAGE_KEYS.SETTLEMENTS, JSON.stringify(merged));
          window.dispatchEvent(new CustomEvent('splitzy:data-updated'));
          this.isSyncingFromRemote = false;
        }, err => {
          console.warn('[RealtimeSync] Settlement listener error:', err);
        });
      this.activeListeners.push(unsubSettlements);

    } catch (err) {
      console.warn('[RealtimeSync] Error attaching group listeners:', err);
    }
  }

  /**
   * Fetches an entire group by code or ID from Firestore (for cross-device instant joining)
   */
  async fetchGroupByCode(codeOrId) {
    if (!this.isConfigured() || !codeOrId) return null;
    const cleanCode = codeOrId.trim();

    try {
      let groupDoc = null;
      // Try direct ID lookup
      const docSnap = await this.db.collection('groups').doc(cleanCode).get();
      if (docSnap.exists) {
        groupDoc = docSnap.data();
      } else {
        // Try code query
        const querySnap = await this.db.collection('groups').where('code', '==', cleanCode.toUpperCase()).get();
        if (!querySnap.empty) {
          groupDoc = querySnap.docs[0].data();
        }
      }

      if (!groupDoc) return null;

      // Fetch expenses for this group
      const expSnap = await this.db.collection('expenses').where('groupId', '==', groupDoc.id).get();
      const remoteExpenses = [];
      expSnap.forEach(d => remoteExpenses.push(d.data()));

      // Fetch settlements for this group
      const setSnap = await this.db.collection('settlements').where('groupId', '==', groupDoc.id).get();
      const remoteSettlements = [];
      setSnap.forEach(d => remoteSettlements.push(d.data()));

      // Merge into local storage
      const localGroups = storage.getGroups().filter(g => g.id !== groupDoc.id);
      localGroups.unshift(groupDoc);
      localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(localGroups));

      const localExpenses = storage.getExpenses().filter(e => e.groupId !== groupDoc.id);
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify([...remoteExpenses, ...localExpenses]));

      const localSettlements = storage.getSettlements().filter(s => s.groupId !== groupDoc.id);
      localStorage.setItem(STORAGE_KEYS.SETTLEMENTS, JSON.stringify([...remoteSettlements, ...localSettlements]));

      window.dispatchEvent(new CustomEvent('splitzy:data-updated'));
      return { group: groupDoc, expenseCount: remoteExpenses.length };
    } catch (err) {
      console.error('[RealtimeSync] Error fetching group by code:', err);
      return null;
    }
  }

  /**
   * One-click upload of all local groups, expenses, and settlements to Firestore
   */
  async syncAllLocalToCloud() {
    if (!this.isConfigured()) return { success: false, message: 'Firebase is not connected.' };

    try {
      const groups = storage.getGroups();
      const expenses = storage.getExpenses();
      const settlements = storage.getSettlements();

      for (const g of groups) {
        await this.db.collection('groups').doc(g.id).set(g, { merge: true });
      }
      for (const e of expenses) {
        await this.db.collection('expenses').doc(e.id).set(e, { merge: true });
      }
      for (const s of settlements) {
        await this.db.collection('settlements').doc(s.id).set(s, { merge: true });
      }

      return { 
        success: true, 
        message: `Synced ${groups.length} groups, ${expenses.length} expenses, and ${settlements.length} settlements to Cloud!` 
      };
    } catch (err) {
      console.error('[RealtimeSync] Bulk sync error:', err);
      return { success: false, message: 'Sync failed: ' + err.message };
    }
  }
}

// Global Singleton Instance
const realtimeSync = new RealtimeSyncEngine();
