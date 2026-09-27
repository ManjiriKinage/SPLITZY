/**
 * SPLITZY 2.0 — Supabase Authentication & Profile Management Engine
 * 
 * Provides:
 * - Enterprise-grade Supabase Authentication (Email/Password, Sessions, Tokens)
 * - Profile Synchronization with Supabase PostgreSQL
 * - Gatekeeper protection: requires login/registration before accessing groups and expenses
 */

class AuthManager {
  constructor() {
    this.currentUser = null;
  }

  async init() {
    // 1. Try Supabase Engine initialization
    if (typeof supabaseEngine !== 'undefined') {
      try {
        const initialized = await supabaseEngine.init();
        if (initialized && supabaseEngine.isAuthenticated()) {
          this.currentUser = supabaseEngine.getUser();
          return true;
        }
      } catch (e) {
        console.warn('[Splitzy Auth] Supabase init warning:', e);
      }
    }

    // 2. Check cached local user profile from localStorage
    if (typeof storage !== 'undefined') {
      const cached = storage.getUserProfile();
      if (cached && cached.name && cached.name !== 'You' && (cached.email || cached.id)) {
        this.currentUser = cached;
        return true;
      }
    }

    return false;
  }

  isAuthenticated() {
    if (typeof supabaseEngine !== 'undefined' && supabaseEngine.isAuthenticated()) {
      return true;
    }
    if (this.currentUser && this.currentUser.name && this.currentUser.name !== 'You') {
      return true;
    }
    if (typeof storage !== 'undefined') {
      const cached = storage.getUserProfile();
      return !!(cached && cached.name && cached.name !== 'You' && (cached.email || cached.id));
    }
    return false;
  }

  getUser() {
    if (typeof supabaseEngine !== 'undefined' && supabaseEngine.getUser()) {
      const u = supabaseEngine.getUser();
      this.currentUser = u;
      return u;
    }
    if (this.currentUser && this.currentUser.name && this.currentUser.name !== 'You') {
      return this.currentUser;
    }
    if (typeof storage !== 'undefined') {
      return storage.getUserProfile();
    }
    return { name: 'You', email: '', upiId: '', color: '#4f46e5' };
  }

  async login(email, password) {
    if (typeof supabaseEngine !== 'undefined') {
      const result = await supabaseEngine.signIn(email, password);
      if (result.success) {
        this.currentUser = result.user;
        if (typeof storage !== 'undefined') storage.setLocalUserProfile(result.user);
        return result;
      }
    }
    return { success: false, message: 'Invalid email or password.' };
  }

  async register(name, email, password, upiId = '') {
    if (typeof supabaseEngine !== 'undefined') {
      const result = await supabaseEngine.signUp(email, password, name, upiId);
      if (result.success) {
        this.currentUser = result.user;
        if (typeof storage !== 'undefined') storage.setLocalUserProfile(result.user);
        return result;
      }
    }
    return { success: false, message: 'Registration failed. Please check your credentials.' };
  }

  async logout() {
    if (typeof supabaseEngine !== 'undefined') {
      await supabaseEngine.signOut();
    }
    this.currentUser = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('splitzy_local_user_v2');
    }
    return { success: true };
  }

  async updateProfile(name, upiId, color) {
    if (typeof supabaseEngine !== 'undefined') {
      return await supabaseEngine.updateProfile(name, upiId, color);
    }
    return { success: false, message: 'Supabase not ready.' };
  }

  async changePassword(newPassword) {
    if (!this.isAuthenticated()) {
      return { success: false, message: 'Please sign in first.' };
    }
    try {
      const { error } = await supabaseEngine.client.auth.updateUser({
        password: newPassword
      });
      if (error) throw error;
      return { success: true, message: 'Password updated successfully!' };
    } catch (err) {
      return { success: false, message: err.message || 'Failed to update password.' };
    }
  }
}

const authManager = new AuthManager();
