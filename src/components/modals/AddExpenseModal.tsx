import React, { useState, useEffect, useRef } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { useSplitzyStore } from '@/store/useSplitzyStore'
import { rupeesToPaise, formatINR, calculateEqualSplit, calculatePercentageSplit } from '@/utils/money'
import { SplitType } from '@/types'
import { Plus, Trash2, Calendar, FileText, ChevronDown, ChevronUp } from 'lucide-react'

const CATEGORIES = ['Food', 'Travel', 'Stay', 'Bills', 'More']

export function AddExpenseModal() {
  const {
    isAddExpenseOpen,
    setAddExpenseOpen,
    groups,
    selectedGroupId,
    currentUser,
    addExpense,
  } = useSplitzyStore()

  const currentGroup = groups.find((g) => g.id === selectedGroupId) || groups[0]
  const currentUserName = currentUser.name.split(' ')[0] || 'You'
  const members = currentGroup ? currentGroup.members : [currentUserName]

  const [amountStr, setAmountStr] = useState('')
  const [title, setTitle] = useState('')
  const [paidBy, setPaidBy] = useState(currentUserName)
  const [category, setCategory] = useState('Food')
  const [splitType, setSplitType] = useState<SplitType>('equal')
  const [selectedMembers, setSelectedMembers] = useState<string[]>(members)

  // Advanced options state
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({})
  const [percentages, setPercentages] = useState<Record<string, string>>({})
  const [itemizedList, setItemizedList] = useState<
    Array<{ id: string; name: string; amount: string; assignedTo: string[] }>
  >([
    { id: '1', name: '', amount: '', assignedTo: [...members] },
  ])
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [isAdvancedExpanded, setIsAdvancedExpanded] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const amountInputRef = useRef<HTMLInputElement>(null)

  // Reset and focus when modal opens
  useEffect(() => {
    if (isAddExpenseOpen) {
      setAmountStr('')
      setTitle('')
      setPaidBy(currentUserName)
      setCategory('Food')
      setSplitType('equal')
      setSelectedMembers(currentGroup ? [...currentGroup.members] : [currentUserName])
      setExactAmounts({})
      setPercentages({})
      setDate(new Date().toISOString().split('T')[0])
      setNotes('')
      setErrorMsg('')
      setIsAdvancedExpanded(false)

      setTimeout(() => {
        amountInputRef.current?.focus()
      }, 100)
    }
  }, [isAddExpenseOpen, currentGroup, currentUserName])

  const totalPaise = rupeesToPaise(amountStr)

  // Calculate per person equal share
  const activeCount = selectedMembers.length
  const equalSharePaise = activeCount > 0 ? Math.floor(totalPaise / activeCount) : 0

  const toggleMemberSelection = (memberName: string) => {
    if (selectedMembers.includes(memberName)) {
      if (selectedMembers.length === 1) return // Keep at least one member
      setSelectedMembers(selectedMembers.filter((m) => m !== memberName))
    } else {
      setSelectedMembers([...selectedMembers, memberName])
    }
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!amountStr || totalPaise <= 0) {
      setErrorMsg('Please enter a valid expense amount.')
      return
    }

    if (!title.trim()) {
      setErrorMsg('Please enter a description for the expense.')
      return
    }

    if (selectedMembers.length === 0) {
      setErrorMsg('Please select at least one member to split with.')
      return
    }

    let finalSplits: Record<string, number> = {}

    if (splitType === 'equal') {
      // Non-negotiable: distribute remainder paise deterministically
      finalSplits = calculateEqualSplit(totalPaise, selectedMembers, paidBy)
    } else if (splitType === 'exact') {
      let sumPaise = 0
      for (const m of selectedMembers) {
        const p = rupeesToPaise(exactAmounts[m] || '0')
        finalSplits[m] = p
        sumPaise += p
      }
      if (sumPaise !== totalPaise) {
        setErrorMsg(
          `Exact shares sum to ${formatINR(sumPaise)}, which does not match total ${formatINR(totalPaise)}.`
        )
        return
      }
    } else if (splitType === 'percentage') {
      let sumPct = 0
      const pctMap: Record<string, number> = {}
      for (const m of selectedMembers) {
        const val = parseFloat(percentages[m] || '0')
        pctMap[m] = val
        sumPct += val
      }
      if (Math.abs(sumPct - 100) > 0.1) {
        setErrorMsg(`Percentages must sum to 100% (currently ${sumPct.toFixed(1)}%).`)
        return
      }
      finalSplits = calculatePercentageSplit(totalPaise, pctMap, paidBy)
    } else if (splitType === 'itemized') {
      // Calculate itemized shares with exact remainder rounding
      for (const m of members) finalSplits[m] = 0
      let totalItemsPaise = 0

      for (const item of itemizedList) {
        const itemPaise = rupeesToPaise(item.amount)
        if (itemPaise <= 0 || item.assignedTo.length === 0) continue
        totalItemsPaise += itemPaise
        const itemSplit = calculateEqualSplit(itemPaise, item.assignedTo, paidBy)
        for (const [member, share] of Object.entries(itemSplit)) {
          finalSplits[member] = (finalSplits[member] || 0) + share
        }
      }

      if (totalItemsPaise !== totalPaise) {
        setErrorMsg(
          `Items sum to ${formatINR(totalItemsPaise)}, which does not match total ${formatINR(totalPaise)}.`
        )
        return
      }
    }

    if (!currentGroup) return

    addExpense({
      group_id: currentGroup.id,
      title: title.trim(),
      amount_paise: totalPaise,
      category,
      date,
      paid_by: paidBy,
      split_type: splitType,
      splits: finalSplits,
      notes: notes.trim() || undefined,
    })

    setAddExpenseOpen(false)
  }

  return (
    <Sheet
      isOpen={isAddExpenseOpen}
      onClose={() => setAddExpenseOpen(false)}
      maxWidth="md"
    >
      <form onSubmit={handleSave} className="space-y-5">
        {/* Top Header Row with Group Badge */}
        <div className="flex items-center justify-between pb-1">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Add expense
          </h2>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
            {currentGroup?.name || 'Group'}
          </span>
        </div>

        {/* Hero Amount Input with ₹ Prefix (Tabular Nums, 40px) */}
        <div className="flex items-center justify-center py-2">
          <div className="relative flex items-center justify-center">
            <span className="text-3xl font-bold text-zinc-400 dark:text-zinc-500 mr-2 select-none">
              ₹
            </span>
            <input
              ref={amountInputRef}
              type="number"
              step="any"
              min="0"
              placeholder="0"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className="text-4xl md:text-5xl font-extrabold tracking-tight tabular-nums text-zinc-900 dark:text-zinc-100 bg-transparent text-center focus:outline-none w-56 placeholder-zinc-300 dark:placeholder-zinc-700"
            />
          </div>
        </div>

        {/* Description / Title Input */}
        <div>
          <input
            type="text"
            placeholder="Dinner at Fisherman's Wharf"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 text-base rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
          />
        </div>

        {/* Paid by Pills */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            Paid by
          </label>
          <div className="flex flex-wrap gap-2">
            {members.map((memberName) => {
              const isSelected = paidBy === memberName
              return (
                <button
                  key={memberName}
                  type="button"
                  onClick={() => setPaidBy(memberName)}
                  className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-accent text-white shadow-sm ring-1 ring-accent'
                      : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {memberName === currentUserName ? 'You' : memberName}
                </button>
              )
            })}
          </div>
        </div>

        {/* Category Pills */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            Category
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => {
              const isSelected = category === cat
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {cat}
                </button>
              )
            })}
          </div>
        </div>

        {/* Split Mode Segmented Control Tabs */}
        <div className="bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl flex items-center">
          {(['equal', 'exact', 'percentage', 'itemized'] as SplitType[]).map((mode) => {
            const labels = {
              equal: 'Equal',
              exact: 'Exact',
              percentage: 'Percent',
              itemized: 'Who ate what',
            }
            const isCurrent = splitType === mode
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setSplitType(mode)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  isCurrent
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900'
                }`}
              >
                {labels[mode]}
              </button>
            )
          })}
        </div>

        {/* Equal Split Section */}
        {splitType === 'equal' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>Split between {selectedMembers.length}</span>
              {totalPaise > 0 && (
                <span className="font-semibold text-accent">
                  {formatINR(equalSharePaise)} each
                </span>
              )}
            </div>

            <div className="space-y-1.5 divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {members.map((memberName) => {
                const isSelected = selectedMembers.includes(memberName)
                return (
                  <div
                    key={memberName}
                    onClick={() => toggleMemberSelection(memberName)}
                    className="flex items-center justify-between py-2.5 px-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // handled by row click
                        className="w-4 h-4 rounded text-accent focus:ring-accent border-zinc-300 dark:border-zinc-700 cursor-pointer"
                      />
                      <Avatar name={memberName} size="sm" />
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {memberName === currentUserName ? 'You' : memberName}
                      </span>
                    </div>
                    {isSelected && totalPaise > 0 && (
                      <span className="text-sm font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
                        {formatINR(equalSharePaise)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Exact Split Section */}
        {splitType === 'exact' && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Enter the exact amount paid for each person. Total must equal {formatINR(totalPaise)}.
            </p>
            {members.map((memberName) => (
              <div key={memberName} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Avatar name={memberName} size="sm" />
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {memberName === currentUserName ? 'You' : memberName}
                  </span>
                </div>
                <div className="relative w-36">
                  <span className="absolute left-3 top-2.5 text-xs text-zinc-400">₹</span>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={exactAmounts[memberName] || ''}
                    onChange={(e) =>
                      setExactAmounts({ ...exactAmounts, [memberName]: e.target.value })
                    }
                    className="w-full pl-7 pr-3 py-1.5 text-sm tabular-nums rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-right focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Percentage Split Section */}
        {splitType === 'percentage' && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Enter percentage shares. Must sum to 100%.
            </p>
            {members.map((memberName) => (
              <div key={memberName} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Avatar name={memberName} size="sm" />
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {memberName === currentUserName ? 'You' : memberName}
                  </span>
                </div>
                <div className="relative w-28">
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={percentages[memberName] || ''}
                    onChange={(e) =>
                      setPercentages({ ...percentages, [memberName]: e.target.value })
                    }
                    className="w-full pr-7 pl-3 py-1.5 text-sm tabular-nums rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-right focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <span className="absolute right-3 top-2 text-xs text-zinc-400">%</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Who Ate What (Itemized) Split Section */}
        {splitType === 'itemized' && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Add bill line items and select who shared each item:
            </p>
            {itemizedList.map((item, idx) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Butter Chicken"
                    value={item.name}
                    onChange={(e) => {
                      const updated = [...itemizedList]
                      updated[idx].name = e.target.value
                      setItemizedList(updated)
                    }}
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <div className="relative w-24">
                    <span className="absolute left-2.5 top-1.5 text-xs text-zinc-400">₹</span>
                    <input
                      type="number"
                      step="any"
                      placeholder="0"
                      value={item.amount}
                      onChange={(e) => {
                        const updated = [...itemizedList]
                        updated[idx].amount = e.target.value
                        setItemizedList(updated)
                      }}
                      className="w-full pl-6 pr-2 py-1.5 text-xs tabular-nums text-right rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>
                  {itemizedList.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setItemizedList(itemizedList.filter((_, i) => i !== idx))}
                      className="p-1.5 text-zinc-400 hover:text-negative"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {/* Member pills for this item */}
                <div className="flex flex-wrap gap-1">
                  {members.map((m) => {
                    const isAssigned = item.assignedTo.includes(m)
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          const updated = [...itemizedList]
                          if (isAssigned) {
                            updated[idx].assignedTo = updated[idx].assignedTo.filter((x) => x !== m)
                          } else {
                            updated[idx].assignedTo.push(m)
                          }
                          setItemizedList(updated)
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                          isAssigned
                            ? 'bg-accent/15 text-accent border border-accent/30'
                            : 'bg-zinc-200/60 dark:bg-zinc-700/60 text-zinc-500'
                        }`}
                      >
                        {m === currentUserName ? 'You' : m}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() =>
                setItemizedList([
                  ...itemizedList,
                  { id: String(Date.now()), name: '', amount: '', assignedTo: [...members] },
                ])
              }
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              Add another item
            </button>
          </div>
        )}

        {/* Collapsible Date, Receipt & Notes */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setIsAdvancedExpanded(!isAdvancedExpanded)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
          >
            <span>{isAdvancedExpanded ? 'Hide additional details' : 'Add date, receipt photo or note'}</span>
            {isAdvancedExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {isAdvancedExpanded && (
            <div className="mt-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-zinc-400" />
                <label className="text-xs text-zinc-500 dark:text-zinc-400 w-12">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-start gap-2">
                <FileText className="w-4 h-4 text-zinc-400 mt-1.5" />
                <textarea
                  placeholder="Notes (e.g. Fisherman's Wharf bill #4928)"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 placeholder-zinc-400 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>
          )}
        </div>

        {/* Error message if any */}
        {errorMsg && (
          <p className="text-xs font-semibold text-negative dark:text-negative-dark bg-negative-light/30 px-3 py-2 rounded-lg">
            {errorMsg}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => setAddExpenseOpen(false)}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="flex-1">
            Save expense
          </Button>
        </div>
      </form>
    </Sheet>
  )
}
