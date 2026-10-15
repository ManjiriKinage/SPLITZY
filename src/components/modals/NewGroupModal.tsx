import React, { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { useSplitzyStore } from '@/store/useSplitzyStore'
import { X, Plus } from 'lucide-react'

const CATEGORIES = ['Travel', 'Flatmates', 'College', 'Food', 'Work', 'General']

export function NewGroupModal() {
  const { isNewGroupOpen, setNewGroupOpen, createGroup, currentUser } = useSplitzyStore()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Travel')
  const [memberInput, setMemberInput] = useState('')
  const [members, setMembers] = useState<string[]>(['Om', 'Aarav'])
  const [errorMsg, setErrorMsg] = useState('')

  const handleAddMember = () => {
    const trimmed = memberInput.trim()
    if (!trimmed) return
    if (members.includes(trimmed)) {
      setErrorMsg('Member already added.')
      return
    }
    setMembers([...members, trimmed])
    setMemberInput('')
    setErrorMsg('')
  }

  const handleRemoveMember = (m: string) => {
    setMembers(members.filter((x) => x !== m))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setErrorMsg('Please enter a group name.')
      return
    }

    createGroup(name.trim(), category, members)
    setName('')
    setMembers(['Om', 'Aarav'])
    setNewGroupOpen(false)
  }

  return (
    <Sheet
      isOpen={isNewGroupOpen}
      onClose={() => setNewGroupOpen(false)}
      title="Create new group"
      subtitle="Split expenses with friends, flatmates, or colleagues"
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
            Group name
          </label>
          <input
            type="text"
            placeholder="e.g. Manali Road Trip or Flat 301"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full mt-1 px-3.5 py-2.5 text-sm rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
            Category
          </label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  category === cat
                    ? 'bg-accent text-white shadow-sm'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
            Members (You are automatically included)
          </label>
          <div className="flex gap-2 mt-1">
            <input
              type="text"
              placeholder="Friend's name"
              value={memberInput}
              onChange={(e) => setMemberInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddMember()
                }
              }}
              className="flex-1 px-3.5 py-2 text-sm rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <Button type="button" size="sm" variant="secondary" onClick={handleAddMember}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 mt-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-accent/15 text-accent">
              {currentUser.name.split(' ')[0]} (You)
            </span>
            {members.map((m) => (
              <span
                key={m}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
              >
                {m}
                <button
                  type="button"
                  onClick={() => handleRemoveMember(m)}
                  className="p-0.5 hover:text-negative"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {errorMsg && (
          <p className="text-xs font-semibold text-negative bg-negative-light/30 px-3 py-1.5 rounded-lg">
            {errorMsg}
          </p>
        )}

        <div className="pt-2 flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => setNewGroupOpen(false)}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="flex-1">
            Create group
          </Button>
        </div>
      </form>
    </Sheet>
  )
}
