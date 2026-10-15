import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { AmountText } from '@/components/ui/AmountText'
import { useSplitzyStore } from '@/store/useSplitzyStore'
import { buildUPILink, POPULAR_UPI_APPS, UPIApp, isValidUTR } from '@/utils/upi'
import { paiseToRupees } from '@/utils/money'
import {
  Check,
  Copy,
  ArrowRight,
  ShieldCheck,
  QrCode,
  Download,
  Share2,
  ExternalLink,
  Smartphone,
  Hash,
} from 'lucide-react'

export function SettleModal() {
  const {
    isSettleModalOpen,
    setSettleModalOpen,
    activeSettlement,
    currentUser,
    groups,
    selectedGroupId,
    settlements,
    createSettlement,
    markSettlementPaid,
    confirmSettlementReceived,
  } = useSplitzyStore()

  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [copiedUpi, setCopiedUpi] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [showQrMobile, setShowQrMobile] = useState(false)
  const [selectedApp, setSelectedApp] = useState<UPIApp>('generic')
  const [utrInput, setUtrInput] = useState('')
  const [isEnteringUtr, setIsEnteringUtr] = useState(false)
  const [utrError, setUtrError] = useState('')

  const currentGroup = groups.find((g) => g.id === selectedGroupId) || groups[0]
  const currentUserName = currentUser.name.split(' ')[0] || 'You'

  const payer = activeSettlement?.from || ''
  const receiver = activeSettlement?.to || ''
  const amountPaise = activeSettlement?.amountPaise || 0

  const isReceiverCurrentUser = receiver === currentUserName || receiver === 'You'

  // Look for existing active settlement record in store or default to pending
  const existingRecord = settlements.find(
    (s) =>
      s.group_id === (currentGroup?.id || '') &&
      s.payer === payer &&
      s.receiver === receiver &&
      s.amount_paise === amountPaise
  )

  const status = existingRecord?.status || 'pending'
  const savedUtr = existingRecord?.upi_ref || ''

  // Determine receiver UPI ID
  const receiverUpi = isReceiverCurrentUser
    ? currentUser.upi_id || 'manjirikinage2005@oksbi'
    : 'manjirikinage2005@oksbi'

  // Generate UPI deep link
  const upiUrl = buildUPILink(
    {
      pa: receiverUpi,
      pn: receiver,
      am: paiseToRupees(amountPaise),
      tn: `Splitzy: ${currentGroup?.name || 'Split'}`,
    },
    selectedApp
  )

  const genericUpiUrl = buildUPILink({
    pa: receiverUpi,
    pn: receiver,
    am: paiseToRupees(amountPaise),
    tn: `Splitzy: ${currentGroup?.name || 'Split'}`,
  })

  // Generate dynamic QR code unconditionally
  useEffect(() => {
    if (!activeSettlement || !isSettleModalOpen) return

    let isMounted = true
    const toDataURL = QRCode?.toDataURL || (QRCode as unknown as { default: { toDataURL: typeof QRCode.toDataURL } })?.default?.toDataURL

    if (toDataURL) {
      toDataURL(genericUpiUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#111827',
          light: '#FFFFFF',
        },
      })
        .then((url: string) => {
          if (isMounted) setQrDataUrl(url)
        })
        .catch((err: unknown) => {
          console.error('Error generating QR code:', err)
        })
    }

    return () => {
      isMounted = false
    }
  }, [genericUpiUrl, activeSettlement, isSettleModalOpen])

  if (!activeSettlement) return null

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(receiverUpi)
    setCopiedUpi(true)
    setTimeout(() => setCopiedUpi(false), 2000)
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(genericUpiUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleDownloadQR = () => {
    if (!qrDataUrl) return
    const link = document.createElement('a')
    link.href = qrDataUrl
    link.download = `Splitzy_UPI_${receiver}_${paiseToRupees(amountPaise)}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePayUPI = (appId?: UPIApp) => {
    const targetUrl = appId
      ? buildUPILink(
          {
            pa: receiverUpi,
            pn: receiver,
            am: paiseToRupees(amountPaise),
            tn: `Splitzy: ${currentGroup?.name || 'Split'}`,
          },
          appId
        )
      : upiUrl

    window.location.href = targetUrl
  }

  const handleStartMarkPaid = () => {
    setIsEnteringUtr(true)
  }

  const handleConfirmMarkPaid = () => {
    setUtrError('')
    if (utrInput.trim() && !isValidUTR(utrInput.trim())) {
      setUtrError('UTR / Reference ID is typically 8-16 alphanumeric digits (e.g. 428910294821).')
      return
    }

    const finalUtr = utrInput.trim() || `UPI${Date.now().toString().slice(-8)}`

    if (existingRecord) {
      markSettlementPaid(existingRecord.id, finalUtr)
    } else if (currentGroup) {
      const created = createSettlement(
        currentGroup.id,
        payer,
        receiver,
        amountPaise,
        receiverUpi
      )
      markSettlementPaid(created.id, finalUtr)
    }

    setIsEnteringUtr(false)
  }

  const handleConfirmReceived = () => {
    if (existingRecord) {
      confirmSettlementReceived(existingRecord.id)
    } else if (currentGroup) {
      const created = createSettlement(
        currentGroup.id,
        payer,
        receiver,
        amountPaise,
        receiverUpi
      )
      markSettlementPaid(created.id)
      confirmSettlementReceived(created.id)
    }
  }

  return (
    <Sheet
      isOpen={isSettleModalOpen}
      onClose={() => setSettleModalOpen(false)}
      maxWidth="lg"
    >
      <div className="space-y-6">
        {/* Header: Avatars + Transfer direction */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar name={payer} size="md" />
            <ArrowRight className="w-4 h-4 text-zinc-400" />
            <Avatar name={receiver} size="md" />
            <div className="ml-1">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                {payer} pays {receiver}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {currentGroup?.name || 'Group Settlement'}
              </p>
            </div>
          </div>

          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-accent/15 text-accent hidden sm:inline-block">
            UPI Instant
          </span>
        </div>

        {/* Hero Amount in Large Green Tabular Figure */}
        <div className="text-center py-2">
          <AmountText
            paise={amountPaise}
            size="2xl"
            sentiment="positive"
            className="text-4xl md:text-5xl"
          />
          <div className="flex items-center justify-center gap-1.5 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            <span>to</span>
            <span className="font-mono font-medium text-zinc-700 dark:text-zinc-300">
              {receiverUpi}
            </span>
          </div>
        </div>

        {/* Desktop 2-column or Mobile stack view */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Enhanced Dynamic QR Code Column */}
          <div
            className={`flex flex-col items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-card border border-border-light dark:border-border-dark ${
              !showQrMobile ? 'hidden md:flex' : 'flex'
            }`}
          >
            <div className="relative group">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="UPI Payment QR Code"
                  className="w-52 h-52 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 bg-white p-2.5"
                />
              ) : (
                <div className="w-52 h-52 bg-zinc-200 animate-pulse rounded-2xl" />
              )}

              {/* Center UPI logo badge overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-9 h-9 rounded-full bg-white shadow-md border border-zinc-200 flex items-center justify-center">
                  <Smartphone className="w-4 h-4 text-accent" />
                </div>
              </div>
            </div>

            <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mt-3 text-center">
              Scan with any UPI app
            </p>
            <p className="text-[11px] text-zinc-400 text-center">
              Google Pay, PhonePe, Paytm, BHIM, Cred
            </p>

            {/* QR Utility buttons: Download & Copy Link */}
            <div className="flex items-center gap-2 mt-3 w-full justify-center">
              <button
                type="button"
                onClick={handleDownloadQR}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 hover:text-accent p-1.5 rounded-lg hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 transition-colors"
                title="Download QR Image"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save QR</span>
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 hover:text-accent p-1.5 rounded-lg hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 transition-colors"
                title="Copy UPI Payment Intent Link"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-positive" />
                    <span className="text-positive">Link Copied</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Actions & UPI App Selectors Column */}
          <div className="space-y-4">
            {/* Paying To Address Card */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                Payee UPI ID
              </label>
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-border-light dark:border-border-dark bg-zinc-50/50 dark:bg-zinc-800/50">
                <span className="text-xs font-mono font-medium text-zinc-800 dark:text-zinc-200 truncate mr-2">
                  {receiverUpi}
                </span>
                <button
                  type="button"
                  onClick={handleCopyUpi}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline shrink-0"
                >
                  {copiedUpi ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-positive" />
                      <span className="text-positive">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* UPI App Quick Intent Launchers */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                Direct UPI App Launch
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {POPULAR_UPI_APPS.slice(1).map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => {
                      setSelectedApp(app.id)
                      handlePayUPI(app.id)
                    }}
                    className="flex flex-col items-center justify-center p-2 rounded-xl border border-border-light dark:border-border-dark bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 hover:border-zinc-300 transition-all text-center"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full mb-1"
                      style={{ backgroundColor: app.color }}
                    />
                    <span className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 leading-tight">
                      {app.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Primary Action Button */}
            <div className="space-y-2.5 pt-1">
              <Button
                variant="primary"
                size="md"
                className="w-full flex items-center justify-center gap-2"
                onClick={() => handlePayUPI()}
              >
                <span>Pay with UPI app</span>
                <ExternalLink className="w-4 h-4" />
              </Button>

              {status === 'pending' && !isEnteringUtr && (
                <Button
                  variant="outline"
                  size="md"
                  className="w-full"
                  onClick={handleStartMarkPaid}
                >
                  I've paid
                </Button>
              )}

              {/* UTR Reference input step */}
              {isEnteringUtr && (
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-border-light dark:border-border-dark space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      Enter UPI Reference / UTR (Optional)
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEnteringUtr(false)}
                      className="text-xs text-zinc-400 hover:text-zinc-600"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="relative">
                    <Hash className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="e.g. 428910294821 or leave blank"
                      value={utrInput}
                      onChange={(e) => setUtrInput(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-xs font-mono rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>
                  {utrError && <p className="text-[11px] text-negative">{utrError}</p>}
                  <Button
                    size="sm"
                    variant="primary"
                    className="w-full"
                    onClick={handleConfirmMarkPaid}
                  >
                    Confirm & notify {receiver}
                  </Button>
                </div>
              )}

              {status === 'paid' && (
                <div className="space-y-2">
                  <div className="text-center p-2.5 rounded-xl bg-positive-light/20 text-positive text-xs font-medium">
                    Payment marked as paid by {payer}.
                    {savedUtr && (
                      <span className="block mt-0.5 text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
                        Ref: {savedUtr}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="primary"
                    size="md"
                    className="w-full bg-positive hover:bg-positive-hover text-white"
                    onClick={handleConfirmReceived}
                  >
                    Confirm received
                  </Button>
                </div>
              )}

              {status === 'confirmed' && (
                <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-positive-light text-positive font-semibold text-xs">
                  <ShieldCheck className="w-4 h-4" />
                  Payment confirmed by {receiver}
                </div>
              )}

              {/* Mobile toggle to show QR code */}
              <div className="md:hidden pt-1 text-center">
                <button
                  type="button"
                  onClick={() => setShowQrMobile(!showQrMobile)}
                  className="text-xs font-semibold text-accent hover:underline inline-flex items-center gap-1"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  {showQrMobile ? 'Hide QR code' : 'Show QR code instead'}
                </button>
              </div>
            </div>

            {/* Trust Microcopy */}
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">
              Splitzy never sees your UPI PIN. Check the receiver's name in your UPI app before paying.
            </p>
          </div>
        </div>

        {/* Status Lifecycle Timeline */}
        <div className="pt-3 border-t border-border-light/80 dark:border-border-dark/80 space-y-3">
          <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            Status
          </label>
          <div className="space-y-2.5">
            {/* Step 1 */}
            <div className="flex items-center gap-3">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  status === 'pending'
                    ? 'bg-accent text-white'
                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                }`}
              >
                1
              </div>
              <span
                className={`text-xs font-medium ${
                  status === 'pending'
                    ? 'text-zinc-900 dark:text-zinc-100 font-semibold'
                    : 'text-zinc-500'
                }`}
              >
                Pending: waiting for payment
              </span>
            </div>

            {/* Step 2 */}
            <div className="flex items-center gap-3">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  status === 'paid'
                    ? 'bg-accent text-white'
                    : status === 'confirmed'
                    ? 'bg-positive text-white'
                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'
                }`}
              >
                2
              </div>
              <div>
                <span
                  className={`text-xs font-medium block ${
                    status === 'paid'
                      ? 'text-zinc-900 dark:text-zinc-100 font-semibold'
                      : 'text-zinc-500'
                  }`}
                >
                  Paid: you tell {receiver} you paid
                </span>
                {savedUtr && (
                  <span className="text-[11px] font-mono text-zinc-400">
                    UTR: {savedUtr}
                  </span>
                )}
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-center gap-3">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  status === 'confirmed'
                    ? 'bg-positive text-white'
                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'
                }`}
              >
                3
              </div>
              <span
                className={`text-xs font-medium ${
                  status === 'confirmed'
                    ? 'text-positive dark:text-positive-dark font-semibold'
                    : 'text-zinc-500'
                }`}
              >
                Confirmed: {receiver} confirms receipt
              </span>
            </div>
          </div>
        </div>
      </div>
    </Sheet>
  )
}
