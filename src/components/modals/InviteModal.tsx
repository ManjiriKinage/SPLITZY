import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { useSplitzyStore } from '@/store/useSplitzyStore'
import { Share2, Copy, Check, MessageSquare } from 'lucide-react'

export interface InviteModalProps {
  isOpen: boolean
  onClose: () => void
}

export function InviteModal({ isOpen, onClose }: InviteModalProps) {
  const { groups, selectedGroupId } = useSplitzyStore()
  const [copied, setCopied] = useState(false)

  const currentGroup = groups.find((g) => g.id === selectedGroupId) || groups[0]
  if (!currentGroup) return null

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const inviteLink = `${origin}/?invite=${currentGroup.invite_token || currentGroup.id}`
  const shareMessage = `Hey! Join our "${currentGroup.name}" group on Splitzy to track expenses and settle instantly with UPI: ${inviteLink}`

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleWhatsAppShare = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`
    window.open(url, '_blank')
  }

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${currentGroup.name} on Splitzy`,
          text: shareMessage,
          url: inviteLink,
        })
      } catch {
        // User cancelled share
      }
    } else {
      handleWhatsAppShare()
    }
  }

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Invite members"
      subtitle={`Share this link to let anyone join ${currentGroup.name}`}
      maxWidth="sm"
    >
      <div className="space-y-4">
        {/* Link Input Box */}
        <div className="flex items-center gap-2 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
          <input
            type="text"
            readOnly
            value={inviteLink}
            className="flex-1 bg-transparent text-xs text-zinc-700 dark:text-zinc-300 select-all outline-none px-2"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopy}
            className="shrink-0 text-xs"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-positive mr-1" />
                <span className="text-positive">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 mr-1" />
                <span>Copy</span>
              </>
            )}
          </Button>
        </div>

        {/* WhatsApp & Native Share Buttons */}
        <div className="space-y-2 pt-1">
          <Button
            variant="primary"
            size="md"
            className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white flex items-center justify-center gap-2"
            onClick={handleWhatsAppShare}
          >
            <MessageSquare className="w-4 h-4" />
            Share via WhatsApp
          </Button>

          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <Button
              variant="outline"
              size="md"
              className="w-full flex items-center justify-center gap-2"
              onClick={handleNativeShare}
            >
              <Share2 className="w-4 h-4" />
              More share options...
            </Button>
          )}
        </div>

        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 text-center">
          Anyone with this link will automatically join this group without needing a group code.
        </p>
      </div>
    </Sheet>
  )
}
