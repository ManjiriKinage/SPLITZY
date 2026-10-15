import React, { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { useSplitzyStore } from '@/store/useSplitzyStore'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { isValidUPI } from '@/utils/upi'
import { Receipt, Mail, Lock, User, AtSign, CheckCircle2, ArrowRight } from 'lucide-react'

export function AuthModal() {
  const { isAuthModalOpen, setAuthModalOpen, login, currentUser } = useSplitzyStore()

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [upiId, setUpiId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password.')
      return
    }

    if (mode === 'signup' && !name.trim()) {
      setErrorMsg('Please enter your full name.')
      return
    }

    if (upiId.trim() && !isValidUPI(upiId.trim())) {
      setErrorMsg('Invalid UPI ID format. Must be e.g. name@bank (e.g. manjirikinage2005@oksbi)')
      return
    }

    setIsLoading(true)

    try {
      if (isSupabaseConfigured && supabase) {
        if (mode === 'signup') {
          const { data, error } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: {
                name: name.trim(),
                upi_id: upiId.trim(),
              },
            },
          })
          if (error) throw error

          if (data.user) {
            // Upsert profile in Supabase profiles table
            await supabase.from('profiles').upsert({
              id: data.user.id,
              name: name.trim(),
              email: email.trim(),
              upi_id: upiId.trim(),
            })

            login({
              id: data.user.id,
              name: name.trim(),
              email: email.trim(),
              upi_id: upiId.trim(),
            })
            setSuccessMsg('Account created successfully!')
          }
        } else {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          })
          if (error) throw error

          if (data.user) {
            // Fetch profile
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', data.user.id)
              .single()

            login({
              id: data.user.id,
              name: profile?.name || data.user.email?.split('@')[0] || 'User',
              email: data.user.email || email.trim(),
              upi_id: profile?.upi_id || '',
            })
          }
        }
      } else {
        // Local/Demo Auth flow
        const displayName = mode === 'signup' ? name.trim() : email.split('@')[0] || 'You'
        login({
          id: `user-${Date.now()}`,
          name: displayName,
          email: email.trim(),
          upi_id: upiId.trim() || (mode === 'signin' ? currentUser.upi_id : ''),
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed. Please try again.'
      setErrorMsg(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setErrorMsg('')
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      })
      if (error) setErrorMsg(error.message)
    } else {
      // Demo Google login
      login({
        id: 'user-google-demo',
        name: 'Google User',
        email: 'user@gmail.com',
        upi_id: 'googleuser@okaxis',
      })
    }
  }

  const handleQuickDemo = (demoName: string, demoEmail: string, demoUpi: string) => {
    login({
      id: `user-${demoName.toLowerCase()}`,
      name: demoName,
      email: demoEmail,
      upi_id: demoUpi,
    })
  }

  return (
    <Sheet
      isOpen={isAuthModalOpen}
      onClose={() => setAuthModalOpen(false)}
      maxWidth="sm"
    >
      <div className="space-y-5">
        {/* Brand Header */}
        <div className="text-center pt-2">
          <div className="w-12 h-12 rounded-2xl bg-accent text-white mx-auto flex items-center justify-center shadow-md shadow-accent/20 mb-3">
            <Receipt className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {mode === 'signin' ? 'Welcome back to Splitzy' : 'Create your account'}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {mode === 'signin'
              ? 'Log in to manage trips, flatmate expenses & UPI settlements'
              : 'Sign up to split expenses and settle via UPI seamlessly'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl flex items-center">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mode === 'signin'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mode === 'signup'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/80 text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition-colors shadow-xs"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
          <span className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider">
            or with email
          </span>
          <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleAuthSubmit} className="space-y-3.5">
          {mode === 'signup' && (
            <div>
              <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                Full Name
              </label>
              <div className="relative mt-1">
                <User className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="e.g. Manjiri Kinage"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              Email Address
            </label>
            <div className="relative mt-1">
              <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
              <input
                type="email"
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              Password
            </label>
            <div className="relative mt-1">
              <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          {mode === 'signup' && (
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                  UPI ID (Optional)
                </label>
                <span className="text-[10px] text-zinc-400">Can be set later</span>
              </div>
              <div className="relative mt-1">
                <AtSign className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="e.g. yourname@oksbi"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs font-mono rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <p className="text-[10px] text-zinc-400 mt-1">
                Used to receive direct UPI transfers when your group settles up.
              </p>
            </div>
          )}

          {errorMsg && (
            <p className="text-xs font-semibold text-negative bg-negative-light/30 px-3 py-2 rounded-lg">
              {errorMsg}
            </p>
          )}

          {successMsg && (
            <p className="text-xs font-semibold text-positive bg-positive-light/30 px-3 py-2 rounded-lg flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {successMsg}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="md"
            className="w-full"
            isLoading={isLoading}
          >
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </Button>
        </form>

        {/* Demo Fast-Login Section */}
        <div className="pt-2 border-t border-border-light dark:border-border-dark space-y-2">
          <span className="text-[11px] font-semibold text-zinc-400 block text-center">
            Or test with instant demo accounts:
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemo('Manjiri Kinage', 'manjiri@splitzy.app', 'manjirikinage2005@oksbi')}
              className="p-2 rounded-xl border border-border-light dark:border-border-dark bg-zinc-50/70 dark:bg-zinc-800/40 hover:bg-zinc-100 text-left transition-colors"
            >
              <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center justify-between">
                <span>Manjiri (Creditor)</span>
                <ArrowRight className="w-3 h-3 text-zinc-400" />
              </div>
              <div className="text-[10px] text-positive font-medium mt-0.5">+₹1,240 in Goa</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickDemo('Om', 'om@splitzy.app', 'om@paytm')}
              className="p-2 rounded-xl border border-border-light dark:border-border-dark bg-zinc-50/70 dark:bg-zinc-800/40 hover:bg-zinc-100 text-left transition-colors"
            >
              <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center justify-between">
                <span>Om (Debtor)</span>
                <ArrowRight className="w-3 h-3 text-zinc-400" />
              </div>
              <div className="text-[10px] text-negative font-medium mt-0.5">-₹1,040 in Goa</div>
            </button>
          </div>
        </div>
      </div>
    </Sheet>
  )
}
