import React, { useState } from 'react'
import { useSplitzyStore } from '@/store/useSplitzyStore'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { isValidUPI } from '@/utils/upi'
import { isSupabaseConfigured } from '@/lib/supabase'
import {
  Sun,
  Moon,
  Download,
  Trash2,
  Check,
  Cloud,
  Database,
  LogIn,
  LogOut,
  UserCheck,
} from 'lucide-react'

export function AccountScreen() {
  const {
    currentUser,
    isAuthenticated,
    updateProfile,
    setAuthModalOpen,
    logout,
    theme,
    toggleTheme,
    groups,
    expenses,
    settlements,
    activities,
  } = useSplitzyStore()

  const [name, setName] = useState(currentUser.name)
  const [email, setEmail] = useState(currentUser.email)
  const [upiId, setUpiId] = useState(currentUser.upi_id || '')
  const [isSaved, setIsSaved] = useState(false)
  const [upiError, setUpiError] = useState('')

  const isUpiValid = !upiId.trim() || isValidUPI(upiId.trim())

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault()
    setUpiError('')

    if (upiId.trim() && !isValidUPI(upiId.trim())) {
      setUpiError('Invalid UPI ID format. Must be e.g. name@bank (e.g. manjirikinage2005@oksbi)')
      return
    }

    updateProfile({
      name: name.trim() || currentUser.name,
      email: email.trim() || currentUser.email,
      upi_id: upiId.trim(),
    })

    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2500)
  }

  const handleExportAllData = () => {
    const data = {
      user: currentUser,
      groups,
      expenses,
      settlements,
      activities,
      exported_at: new Date().toISOString(),
      app: 'Splitzy v2.0',
    }
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', `splitzy_backup_${new Date().toISOString().split('T')[0]}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  const handleResetData = () => {
    if (confirm('Are you sure you want to reset Splitzy to initial default demo data?')) {
      localStorage.removeItem('splitzy-storage-v2')
      window.location.reload()
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
          Account & Settings
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Manage your profile, default UPI receiving address, authentication & preferences
        </p>
      </div>

      {/* Authentication & Session Card */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <Avatar name={currentUser.name} size="lg" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  {currentUser.name}
                </h2>
                {isAuthenticated && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-positive bg-positive-light px-2 py-0.5 rounded-full">
                    <UserCheck className="w-3 h-3" /> Signed In
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {currentUser.email}
              </p>
              {currentUser.upi_id && (
                <p className="text-xs font-mono font-medium text-accent mt-0.5">
                  UPI: {currentUser.upi_id}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAuthModalOpen(true)}
              className="text-xs"
            >
              <LogIn className="w-3.5 h-3.5 mr-1" />
              <span>{isAuthenticated ? 'Switch Account' : 'Sign In'}</span>
            </Button>
            {isAuthenticated && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => logout()}
                className="text-xs text-negative hover:bg-negative-light/20"
              >
                <LogOut className="w-3.5 h-3.5 mr-1" />
                <span>Sign Out</span>
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Profile & UPI Details Form */}
      <Card>
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-4">
          Profile Details & Receiving UPI ID
        </h3>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 px-3.5 py-2.5 text-sm rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 px-3.5 py-2.5 text-sm rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                Default UPI ID (VPA) for receiving payments
              </label>
              {upiId.trim() && isUpiValid && (
                <span className="text-[11px] font-semibold text-positive flex items-center gap-1">
                  <Check className="w-3 h-3" /> Valid UPI ID
                </span>
              )}
            </div>
            <input
              type="text"
              placeholder="e.g. yourname@oksbi or mobile@paytm"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              className={`w-full mt-1 px-3.5 py-2.5 text-sm font-mono rounded-xl bg-zinc-50 dark:bg-zinc-800 border text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-accent ${
                upiId.trim() && !isUpiValid
                  ? 'border-negative'
                  : 'border-zinc-200 dark:border-zinc-700'
              }`}
            />
            <p className="text-[11px] text-zinc-400 mt-1">
              Group members scan your dynamic QR code or tap Pay to transfer directly into this bank account.
            </p>
            {upiError && (
              <p className="text-xs font-semibold text-negative mt-1">{upiError}</p>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-positive font-medium flex items-center gap-1">
              {isSaved && (
                <>
                  <Check className="w-4 h-4" /> Profile saved successfully
                </>
              )}
            </span>
            <Button type="submit" variant="primary" size="sm">
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      {/* Preferences & Theme Card */}
      <Card className="space-y-4">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
          Preferences
        </h3>

        <div className="flex items-center justify-between py-2 border-b border-border-light dark:border-border-dark">
          <div>
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 block">
              Interface Theme
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Currently using {theme} mode
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={toggleTheme}
            className="flex items-center gap-1.5"
          >
            {theme === 'light' ? (
              <>
                <Moon className="w-3.5 h-3.5" />
                <span>Dark Mode</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5" />
                <span>Light Mode</span>
              </>
            )}
          </Button>
        </div>

        {/* Sync & Supabase Backend Status */}
        <div className="flex items-center justify-between py-2">
          <div>
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 block">
              Storage & Sync Engine
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {isSupabaseConfigured
                ? 'Connected to live Supabase Postgres & Realtime'
                : 'Offline-tolerant Local Storage (PWA ready)'}
            </span>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              isSupabaseConfigured
                ? 'bg-positive-light text-positive'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
            }`}
          >
            {isSupabaseConfigured ? (
              <>
                <Cloud className="w-3.5 h-3.5" /> Live Cloud
              </>
            ) : (
              <>
                <Database className="w-3.5 h-3.5" /> Local PWA
              </>
            )}
          </span>
        </div>
      </Card>

      {/* Data Management Card */}
      <Card className="space-y-3">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
          Data Management
        </h3>

        <div className="flex items-center justify-between py-2">
          <div>
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 block">
              Backup & Export Data
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Download your complete financial records as JSON
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportAllData}
            className="flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </Button>
        </div>

        <div className="flex items-center justify-between py-2 border-t border-border-light dark:border-border-dark">
          <div>
            <span className="text-sm font-semibold text-negative block">
              Reset Demo Data
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Restores Goa Trip, Flat 402, and all initial balances
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-negative border-negative/30 hover:bg-negative-light/20"
            onClick={handleResetData}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            Reset Data
          </Button>
        </div>
      </Card>

      <div className="text-center py-4 text-[11px] text-zinc-400">
        Splitzy 2.0 • UPI-First Group Expense & Min-Cash-Flow Debt Simplification
      </div>
    </div>
  )
}
