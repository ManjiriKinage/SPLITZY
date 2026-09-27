/**
 * SPLITZY 2.0 — Supabase Real-Time Database & Auth Engine
 * 
 * Provides:
 * - Direct Supabase Auth (Sign Up, Sign In, Session Tokens, Profile Sync)
 * - PostgreSQL CRUD for Groups, Expenses, Settlements, and Profiles
 * - Supabase Realtime Channels (WebSockets / Postgres CDC) for live multi-user sync
 */

const SUPABASE_STORAGE_KEY = 'splitzy_supabase_custom_config_v2';

class SupabaseEngine {
  constructor() {
    this.client = null;
    this.currentUser = null;
    this.currentProfile = null;
    this.status = 'unconfigured'; // 'unconfigured' | 'connecting' | 'connected' | 'error' | 'disconnected'
    this.realtimeChannel = null;
    this.isInitialized = false;
  }

  /**
   * Initializes Supabase client and sets up auth listeners
   */
  async init() {
    const config = this.getConfig();
    if (!config || !config.url || !config.anonKey || config.url.includes('your-project-ref')) {
      this.status = 'unconfigured';
      this.notifyStatusChange();
      console.warn('[Splitzy Supabase] Supabase is not configured yet with valid URL/Key.');
      return false;
    }

    try {
      this.status = 'connecting';
      this.notifyStatusChange();

      if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
        console.error('[Splitzy Supabase] Supabase JS SDK is not loaded in window.');
        this.status = 'error';
        this.notifyStatusChange();
        return false;
      }

      this.client = window.supabase.createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });

      // Get active session
      const { data: { session }, error: sessionError } = await this.client.auth.getSession();
      if (sessionError) {
        console.warn('[Splitzy Supabase] Session error:', sessionError.message);
      }

      if (session && session.user) {
        this.currentUser = session.user;
        await this.loadUserProfile(session.user.id);
        const userObj = this.getUser();
        if (typeof storage !== 'undefined' && userObj) {
          storage.setLocalUserProfile(userObj);
        }
      } else {
        // Try restoring local user cache if offline/session resuming
        if (typeof storage !== 'undefined') {
          const cachedUser = storage.getUserProfile();
          if (cachedUser && cachedUser.email && cachedUser.name !== 'You') {
            this.currentProfile = {
              id: cachedUser.id || 'local-user',
              name: cachedUser.name,
              email: cachedUser.email,
              upi_id: cachedUser.upiId || '',
              color: cachedUser.color || '#4f46e5'
            };
          }
        }
      }

      // Listen to auth state changes (login, logout, token refresh)
      this.client.auth.onAuthStateChange(async (event, newSession) => {
        console.log('[Splitzy Supabase] Auth event:', event);
        if (newSession && newSession.user) {
          this.currentUser = newSession.user;
          await this.loadUserProfile(newSession.user.id);
          this.status = 'connected';
          this.notifyStatusChange();
          const userObj = this.getUser();
          if (typeof storage !== 'undefined' && userObj) {
            storage.setLocalUserProfile(userObj);
          }
          window.dispatchEvent(new CustomEvent('splitzy:auth-changed', { detail: { isAuthenticated: true, user: userObj } }));
          // Fetch data and attach realtime
          await this.syncAllDataFromSupabase();
          this.subscribeToRealtimeChanges();
        } else if (event === 'SIGNED_OUT') {
          this.currentUser = null;
          this.currentProfile = null;
          this.status = 'disconnected';
          this.unsubscribeFromRealtime();
          this.notifyStatusChange();
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('splitzy_local_user_v2');
          }
          window.dispatchEvent(new CustomEvent('splitzy:auth-changed', { detail: { isAuthenticated: false, user: null } }));
        }
      });

      this.status = 'connected';
      this.notifyStatusChange();
      this.isInitialized = true;

      if (this.currentUser) {
        await this.syncAllDataFromSupabase();
        this.subscribeToRealtimeChanges();
      }

      console.log('⚡ [Splitzy Supabase] Connected to Supabase project:', config.url);
      return true;
    } catch (err) {
      console.error('[Splitzy Supabase] Init error:', err);
      this.status = 'error';
      this.notifyStatusChange();
      return false;
    }
  }

  getConfig() {
    try {
      const stored = localStorage.getItem(SUPABASE_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {}

    if (window.SPLITZY_SUPABASE_CONFIG) {
      return window.SPLITZY_SUPABASE_CONFIG;
    }
    return null;
  }

  isConfigured() {
    return this.client !== null && this.status === 'connected';
  }

  isAuthenticated() {
    return !!(this.client && this.currentUser);
  }

  getUser() {
    if (!this.currentUser) return null;
    return {
      id: this.currentUser.id,
      email: this.currentUser.email || '',
      name: this.currentProfile?.name || this.currentUser.user_metadata?.full_name || this.currentUser.user_metadata?.name || this.currentUser.email?.split('@')[0] || 'User',
      upiId: this.currentProfile?.upi_id || this.currentUser.user_metadata?.upi_id || '',
      color: this.currentProfile?.color || '#4f46e5'
    };
  }

  // --- Profile Loading & Updates ---
  async loadUserProfile(userId) {
    if (!this.client || !userId) return null;
    try {
      const { data, error } = await this.client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.warn('[Splitzy Supabase] Error loading profile:', error.message);
      }

      if (data) {
        this.currentProfile = data;
      } else {
        // Create initial profile if missing
        const name = this.currentUser.user_metadata?.full_name || this.currentUser.user_metadata?.name || this.currentUser.email?.split('@')[0] || 'User';
        const upiId = this.currentUser.user_metadata?.upi_id || '';
        const color = '#4f46e5';

        const { data: created, error: createErr } = await this.client
          .from('profiles')
          .upsert({
            id: userId,
            name: name,
            email: this.currentUser.email,
            upi_id: upiId,
            color: color,
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (!createErr && created) {
          this.currentProfile = created;
        }
      }
      return this.currentProfile;
    } catch (e) {
      console.warn('[Splitzy Supabase] Profile error:', e);
      return null;
    }
  }

  async updateProfile(name, upiId, color) {
    if (!this.isAuthenticated()) return { success: false, message: 'Please sign in first.' };

    try {
      const updates = {
        name: (name || '').trim(),
        upi_id: (upiId || '').trim(),
        updated_at: new Date().toISOString()
      };
      if (color) updates.color = color;

      const { data, error } = await this.client
        .from('profiles')
        .update(updates)
        .eq('id', this.currentUser.id)
        .select()
        .single();

      if (error) throw error;
      this.currentProfile = data;
      window.dispatchEvent(new CustomEvent('splitzy:user-updated', { detail: this.getUser() }));
      return { success: true, message: 'Profile updated successfully!' };
    } catch (err) {
      console.error('[Splitzy Supabase] Error updating profile:', err);
      return { success: false, message: err.message || 'Failed to update profile.' };
    }
  }

  // --- Auth Methods ---
  async signUp(email, password, name, upiId = '') {
    if (!this.client) {
      return { success: false, message: 'Supabase is not configured. Please check js/supabase-config.js.' };
    }

    try {
      const cleanEmail = (email || '').trim().toLowerCase();
      const cleanName = (name || '').trim();
      const cleanUpi = (upiId || '').trim();

      const { data, error } = await this.client.auth.signUp({
        email: cleanEmail,
        password: password,
        options: {
          data: {
            full_name: cleanName,
            name: cleanName,
            upi_id: cleanUpi
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        this.currentUser = data.user;
        // Insert profile row
        await this.client.from('profiles').upsert({
          id: data.user.id,
          name: cleanName,
          email: cleanEmail,
          upi_id: cleanUpi,
          color: '#4f46e5',
          updated_at: new Date().toISOString()
        });
        await this.loadUserProfile(data.user.id);
      }

      return {
        success: true,
        message: data.session ? 'Account created and signed in successfully!' : 'Registration successful! Please check your email if confirmation is required.',
        user: this.getUser()
      };
    } catch (err) {
      console.error('[Splitzy Supabase] Sign up error:', err);
      return { success: false, message: err.message || 'Registration failed.' };
    }
  }

  async signIn(email, password) {
    if (!this.client) {
      return { success: false, message: 'Supabase is not configured. Please check js/supabase-config.js.' };
    }

    try {
      const cleanEmail = (email || '').trim().toLowerCase();
      const { data, error } = await this.client.auth.signInWithPassword({
        email: cleanEmail,
        password: password
      });

      if (error) throw error;

      if (data.user) {
        this.currentUser = data.user;
        await this.loadUserProfile(data.user.id);
        await this.syncAllDataFromSupabase();
        this.subscribeToRealtimeChanges();
      }

      return {
        success: true,
        message: 'Signed in successfully!',
        user: this.getUser()
      };
    } catch (err) {
      console.error('[Splitzy Supabase] Sign in error:', err);
      return { success: false, message: err.message || 'Invalid email or password.' };
    }
  }

  async signOut() {
    if (this.client) {
      try {
        await this.client.auth.signOut();
      } catch (e) {}
    }
    this.currentUser = null;
    this.currentProfile = null;
    this.unsubscribeFromRealtime();
    // Clear in-memory storage
    if (typeof storage !== 'undefined') {
      storage.clearState();
    }
    return { success: true };
  }

  // --- Realtime WebSocket Subscriptions ---
  subscribeToRealtimeChanges() {
    if (!this.client || this.realtimeChannel) return;

    try {
      console.log('⚡ [Splitzy Realtime] Subscribing to Supabase Realtime changes...');
      this.realtimeChannel = this.client
        .channel('splitzy-realtime-channel')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'groups' },
          async (payload) => {
            console.log('⚡ [Realtime Group Change]:', payload.eventType);
            await this.handleRemoteGroupChange(payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'expenses' },
          async (payload) => {
            console.log('⚡ [Realtime Expense Change]:', payload.eventType);
            await this.handleRemoteExpenseChange(payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'settlements' },
          async (payload) => {
            console.log('⚡ [Realtime Settlement Change]:', payload.eventType);
            await this.handleRemoteSettlementChange(payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'profiles' },
          async (payload) => {
            if (payload.new && this.currentUser && payload.new.id === this.currentUser.id) {
              this.currentProfile = payload.new;
              window.dispatchEvent(new CustomEvent('splitzy:user-updated', { detail: this.getUser() }));
            }
          }
        )
        .subscribe((status) => {
          console.log('[Splitzy Realtime] Channel status:', status);
        });
    } catch (e) {
      console.warn('[Splitzy Realtime] Failed to subscribe to realtime:', e);
    }
  }

  unsubscribeFromRealtime() {
    if (this.realtimeChannel && this.client) {
      try {
        this.client.removeChannel(this.realtimeChannel);
      } catch (e) {}
      this.realtimeChannel = null;
    }
  }

  // --- Realtime Event Handlers ---
  async handleRemoteGroupChange(payload) {
    if (typeof storage === 'undefined') return;
    if (payload.eventType === 'DELETE') {
      const id = payload.old?.id;
      if (id) storage.removeGroupFromCache(id);
    } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
      const grp = this.formatGroupFromDb(payload.new);
      storage.upsertGroupInCache(grp);
    }
    window.dispatchEvent(new CustomEvent('splitzy:data-updated'));
  }

  async handleRemoteExpenseChange(payload) {
    if (typeof storage === 'undefined') return;
    if (payload.eventType === 'DELETE') {
      const id = payload.old?.id;
      if (id) storage.removeExpenseFromCache(id);
    } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
      const exp = this.formatExpenseFromDb(payload.new);
      storage.upsertExpenseInCache(exp);
    }
    window.dispatchEvent(new CustomEvent('splitzy:data-updated'));
  }

  async handleRemoteSettlementChange(payload) {
    if (typeof storage === 'undefined') return;
    if (payload.eventType === 'DELETE') {
      const id = payload.old?.id;
      if (id) storage.removeSettlementFromCache(id);
    } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
      const stl = this.formatSettlementFromDb(payload.new);
      storage.upsertSettlementInCache(stl);
    }
    window.dispatchEvent(new CustomEvent('splitzy:data-updated'));
  }

  // --- Database Synchronization (Pull from Cloud) ---
  async syncAllDataFromSupabase() {
    if (!this.isAuthenticated()) return;

    try {
      const user = this.getUser();
      const userName = user ? user.name : '';

      // 1. Fetch Groups
      const { data: groupsData, error: grpError } = await this.client
        .from('groups')
        .select('*')
        .order('created_at', { ascending: false });

      if (grpError) throw grpError;

      const formattedGroups = (groupsData || []).map(g => this.formatGroupFromDb(g));
      storage.setGroupsCache(formattedGroups);

      // 2. Fetch Expenses
      const { data: expensesData, error: expError } = await this.client
        .from('expenses')
        .select('*')
        .order('created_at', { ascending: false });

      if (expError) throw expError;

      const formattedExpenses = (expensesData || []).map(e => this.formatExpenseFromDb(e));
      storage.setExpensesCache(formattedExpenses);

      // 3. Fetch Settlements
      const { data: settlementsData, error: stlError } = await this.client
        .from('settlements')
        .select('*')
        .order('created_at', { ascending: false });

      if (stlError) throw stlError;

      const formattedSettlements = (settlementsData || []).map(s => this.formatSettlementFromDb(s));
      storage.setSettlementsCache(formattedSettlements);

      console.log(`⚡ [Splitzy Supabase] Loaded ${formattedGroups.length} groups, ${formattedExpenses.length} expenses, ${formattedSettlements.length} settlements from Supabase.`);
      window.dispatchEvent(new CustomEvent('splitzy:data-updated'));
    } catch (err) {
      console.warn('[Splitzy Supabase] Error syncing data from database:', err.message);
    }
  }

  // --- Format Converters (Postgres snake_case <-> App camelCase) ---
  formatGroupFromDb(g) {
    if (!g) return null;
    return {
      id: g.id,
      code: g.code,
      name: g.name,
      category: g.category || 'General',
      icon: g.icon || 'fa-users',
      color: g.color || '#4f46e5',
      members: Array.isArray(g.members) ? g.members : (typeof g.members === 'string' ? JSON.parse(g.members) : []),
      createdBy: g.created_by || '',
      createdById: g.created_by_id || null,
      createdAt: g.created_at,
      updatedAt: g.updated_at
    };
  }

  formatGroupToDb(g) {
    return {
      id: g.id,
      code: g.code,
      name: g.name,
      category: g.category || 'General',
      icon: g.icon || 'fa-users',
      color: g.color || '#4f46e5',
      members: g.members || [],
      created_by: g.createdBy || (this.getUser()?.name || 'You'),
      created_by_id: this.currentUser?.id || null,
      updated_at: new Date().toISOString()
    };
  }

  formatExpenseFromDb(e) {
    if (!e) return null;
    let itemized = [];
    try {
      itemized = typeof e.itemized_data === 'object' ? (e.itemized_data || []) : (JSON.parse(e.itemized_data || '[]'));
    } catch (err) {
      itemized = [];
    }
    let splitsObj = {};
    try {
      splitsObj = typeof e.splits === 'object' ? (e.splits || {}) : (JSON.parse(e.splits || '{}'));
    } catch (err) {
      splitsObj = {};
    }

    return {
      id: e.id,
      groupId: e.group_id,
      title: e.title,
      amount: parseFloat(e.amount) || 0,
      category: e.category || 'General',
      date: e.date,
      paidBy: e.paid_by,
      splitType: e.split_type || 'equal',
      splits: splitsObj,
      itemizedData: itemized,
      itemizedBreakdown: Array.isArray(itemized) ? (itemized.length > 0 ? { items: itemized } : null) : itemized,
      notes: e.notes || '',
      createdAt: e.created_at,
      updatedAt: e.updated_at
    };
  }

  formatExpenseToDb(e) {
    let itemData = e.itemizedData || (e.itemizedBreakdown ? (e.itemizedBreakdown.items || e.itemizedBreakdown) : []);
    return {
      id: e.id,
      group_id: e.groupId,
      title: e.title,
      amount: parseFloat(e.amount) || 0,
      category: e.category || 'General',
      date: e.date || new Date().toISOString().split('T')[0],
      paid_by: e.paidBy,
      split_type: e.splitType || 'equal',
      splits: e.splits || {},
      itemized_data: itemData || [],
      notes: e.notes || '',
      updated_at: new Date().toISOString()
    };
  }

  formatSettlementFromDb(s) {
    if (!s) return null;
    return {
      id: s.id,
      groupId: s.group_id,
      payer: s.payer,
      receiver: s.receiver,
      amount: parseFloat(s.amount) || 0,
      date: s.date,
      notes: s.notes || '',
      createdAt: s.created_at
    };
  }

  formatSettlementToDb(s) {
    return {
      id: s.id,
      group_id: s.groupId,
      payer: s.payer,
      receiver: s.receiver,
      amount: parseFloat(s.amount) || 0,
      date: s.date || new Date().toISOString().split('T')[0],
      notes: s.notes || ''
    };
  }

  // --- Asynchronous DB CRUD for App Actions ---
  async saveGroupToDb(groupData) {
    if (!this.isAuthenticated()) return null;
    try {
      const row = this.formatGroupToDb(groupData);
      const { data, error } = await this.client
        .from('groups')
        .upsert(row)
        .select()
        .single();

      if (error) throw error;
      return this.formatGroupFromDb(data);
    } catch (err) {
      console.error('[Splitzy Supabase] Error saving group:', err);
      return null;
    }
  }

  async deleteGroupFromDb(groupId) {
    if (!this.isAuthenticated()) return false;
    try {
      const { error } = await this.client
        .from('groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('[Splitzy Supabase] Error deleting group:', err);
      return false;
    }
  }

  async saveExpenseToDb(expenseData) {
    if (!this.isAuthenticated()) return null;
    try {
      const row = this.formatExpenseToDb(expenseData);
      const { data, error } = await this.client
        .from('expenses')
        .upsert(row)
        .select()
        .single();

      if (error) throw error;
      return this.formatExpenseFromDb(data);
    } catch (err) {
      console.error('[Splitzy Supabase] Error saving expense:', err);
      return null;
    }
  }

  async deleteExpenseFromDb(expenseId) {
    if (!this.isAuthenticated()) return false;
    try {
      const { error } = await this.client
        .from('expenses')
        .delete()
        .eq('id', expenseId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('[Splitzy Supabase] Error deleting expense:', err);
      return false;
    }
  }

  async saveSettlementToDb(settleData) {
    if (!this.isAuthenticated()) return null;
    try {
      const row = this.formatSettlementToDb(settleData);
      const { data, error } = await this.client
        .from('settlements')
        .upsert(row)
        .select()
        .single();

      if (error) throw error;
      return this.formatSettlementFromDb(data);
    } catch (err) {
      console.error('[Splitzy Supabase] Error recording settlement:', err);
      return null;
    }
  }

  async findGroupByCode(code) {
    if (!this.client || !code) return null;
    try {
      const cleanCode = code.trim().toUpperCase();
      const { data, error } = await this.client
        .from('groups')
        .select('*')
        .eq('code', cleanCode)
        .maybeSingle();

      if (error || !data) return null;
      return this.formatGroupFromDb(data);
    } catch (e) {
      console.warn('[Splitzy Supabase] Error looking up group code:', e);
      return null;
    }
  }

  notifyStatusChange() {
    window.dispatchEvent(new CustomEvent('splitzy:supabase-status', { detail: { status: this.status } }));
  }
}

const supabaseEngine = new SupabaseEngine();
