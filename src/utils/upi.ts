/**
 * UPI Deep Link & QR Code Generation Helper
 * Conforms to NPCI UPI Linking Specifications
 */

export interface UPILinkParams {
  pa: string // Payee UPI VPA (e.g. manjirikinage2005@oksbi)
  pn: string // Payee Name (e.g. Manjiri Kinage)
  am: number // Amount in Rupees (e.g. 1040 or 1040.50)
  tn?: string // Transaction Note (e.g. "Splitzy: Goa Trip")
  tr?: string // Transaction Reference ID
}

export type UPIApp = 'generic' | 'gpay' | 'phonepe' | 'paytm' | 'bhim'

export interface UPIAppOption {
  id: UPIApp
  name: string
  schemePrefix: string
  color: string
}

export const POPULAR_UPI_APPS: UPIAppOption[] = [
  { id: 'generic', name: 'Default UPI', schemePrefix: 'upi://pay', color: '#4F46E5' },
  { id: 'gpay', name: 'Google Pay', schemePrefix: 'tez://upi/pay', color: '#1A73E8' },
  { id: 'phonepe', name: 'PhonePe', schemePrefix: 'phonepe://pay', color: '#5F259F' },
  { id: 'paytm', name: 'Paytm', schemePrefix: 'paytmmp://pay', color: '#00BAF2' },
  { id: 'bhim', name: 'BHIM UPI', schemePrefix: 'upi://pay', color: '#005E5D' },
]

/**
 * Builds standard UPI URI string
 * format: upi://pay?pa=...&pn=...&am=...&cu=INR&tn=...
 */
export function buildUPILink(params: UPILinkParams, app: UPIApp = 'generic'): string {
  const cleanPa = params.pa.trim()
  const cleanPn = encodeURIComponent(params.pn.trim())
  const amountStr = params.am.toFixed(2)
  const cleanTn = encodeURIComponent(params.tn ? params.tn.trim() : 'Splitzy Payment')

  const baseParams = `pa=${cleanPa}&pn=${cleanPn}&am=${amountStr}&cu=INR&tn=${cleanTn}`
  const trParam = params.tr ? `&tr=${encodeURIComponent(params.tr)}` : ''

  const appOption = POPULAR_UPI_APPS.find((a) => a.id === app)
  const prefix = appOption?.schemePrefix || 'upi://pay'

  return `${prefix}?${baseParams}${trParam}`
}

/**
 * Validates UPI VPA format (e.g. name@bank)
 */
export function isValidUPI(vpa: string): boolean {
  if (!vpa) return false
  const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/
  return upiRegex.test(vpa.trim())
}

/**
 * Validates 12-digit NPCI UPI Transaction Reference (UTR)
 */
export function isValidUTR(utr: string): boolean {
  if (!utr) return false
  const utrClean = utr.trim()
  // Typical NPCI UTR is 12 digits, but some banking apps show alphanumeric 8-16 chars
  return /^[0-9A-Za-z]{8,20}$/.test(utrClean)
}

/**
 * Parses UPI URI query parameters back into an object
 */
export function parseUPIUri(uri: string): Partial<UPILinkParams> | null {
  try {
    const url = new URL(uri.replace(/^[^:]+:\/\/[^?]*\?/, 'https://dummy.com/?'))
    const pa = url.searchParams.get('pa') || ''
    const pn = url.searchParams.get('pn') || ''
    const am = parseFloat(url.searchParams.get('am') || '0')
    const tn = url.searchParams.get('tn') || ''
    const tr = url.searchParams.get('tr') || ''

    if (!pa) return null

    return {
      pa,
      pn: decodeURIComponent(pn),
      am: isNaN(am) ? 0 : am,
      tn: decodeURIComponent(tn),
      tr: decodeURIComponent(tr),
    }
  } catch {
    return null
  }
}
