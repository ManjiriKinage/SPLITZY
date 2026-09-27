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
    if (typeof supabaseEngine !== 'undefined') {
      const initialized = await supabaseEngine.init();
      if (initialized && supabaseEngine.isAuthenticated()) {
        this.currentUser = supabaseEngine.getUser();
        return true;
      }
    }
    return false;
  }

  isAuthenticated() {
    return typeof supabaseEngine !== 'undefined' && supabaseEngine.isAuthenticated();
  }

  getUser() {
    if (typeof supabaseEngine !== 'undefined' && supabaseEngine.getUser()) {
      return supabaseEngine.getUser();
    }
    return { name: 'You', email: '', upiId: '', color: '#4f46e5' };
  }

  async login(email, password) {
    if (typeof supabaseEngine === 'undefined') {
      return { success: false, message: 'Supabase Engine not available.' };
    }
    const result = await supabaseEngine.signIn(email, password);
    if (result.success) {
      this.currentUser = result.user;
    }
    return result;
  }

  async register(name, email, password, upiId = '') {
    if (typeof supabaseEngine === 'undefined') {
      return { success: false, message: 'Supabase Engine not available.' };
    }
    const result = await supabaseEngine.signUp(email, password, name, upiId);
    if (result.success) {
      this.currentUser = result.user;
    }
    return result;
  }

  async logout() {
    if (typeof supabaseEngine !== 'undefined') {
      await supabaseEngine.signOut();
    }
    this.currentUser = null;
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
