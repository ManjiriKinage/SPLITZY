import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns initials from a full name (e.g. "Manjiri Kinage" -> "MK", "Om" -> "OK")
 */
export function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase()
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Deterministic soft pastel background and text color for an avatar based on name
 */
export function getAvatarColor(name: string): { bg: string; text: string } {
  const palettes = [
    { bg: '#EDE9FE', text: '#5B21B6' }, // soft purple/indigo
    { bg: '#E0E7FF', text: '#3730A3' }, // soft blue
    { bg: '#DCFCE7', text: '#166534' }, // soft mint green
    { bg: '#FCE7F3', text: '#9D174D' }, // soft rose/pink
    { bg: '#FEF3C7', text: '#92400E' }, // soft amber
    { bg: '#E0F2FE', text: '#075985' }, // soft sky
    { bg: '#F3E8FF', text: '#6B21A8' }, // soft violet
  ]

  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % palettes.length
  return palettes[index]
}
