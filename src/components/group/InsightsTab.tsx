import { useState } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import { useSplitzyStore } from '@/store/useSplitzyStore'
import { formatINR, paiseToRupees } from '@/utils/money'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Share2, Check, Copy } from 'lucide-react'

const CATEGORY_COLORS: Record<string, string> = {
  Food: '#4F46E5', // Indigo
  Stay: '#0D9488', // Teal
  Travel: '#F59E0B', // Amber
  Bills: '#EC4899', // Pink
  More: '#8B5CF6', // Purple
  General: '#6B7280', // Gray
}

export function InsightsTab() {
  const { groups, selectedGroupId, expenses, currentUser } = useSplitzyStore()
  const [copied, setCopied] = useState(false)

  const group = groups.find((g) => g.id === selectedGroupId)
  if (!group) return null

  const groupExpenses = expenses.filter((e) => e.group_id === group.id)
  const totalGroupPaise = groupExpenses.reduce((sum, e) => sum + e.amount_paise, 0)

  // 1. Category aggregation
  const categoryMap: Record<string, number> = {}
  for (const exp of groupExpenses) {
    categoryMap[exp.category] = (categoryMap[exp.category] || 0) + exp.amount_paise
  }

  const categoryData = Object.entries(categoryMap).map(([name, paise]) => ({
    name,
    value: paiseToRupees(paise),
    percentage: totalGroupPaise > 0 ? Math.round((paise / totalGroupPaise) * 100) : 0,
    paise,
    color: CATEGORY_COLORS[name] || '#6B7280',
  }))

  // 2. Per-member spend aggregation (how much each member paid)
  const memberSpendMap: Record<string, number> = {}
  for (const m of group.members) memberSpendMap[m] = 0
  for (const exp of groupExpenses) {
    memberSpendMap[exp.paid_by] = (memberSpendMap[exp.paid_by] || 0) + exp.amount_paise
  }

  const memberData = Object.entries(memberSpendMap).map(([name, paise]) => ({
    name: name === currentUser.name.split(' ')[0] ? `${name} (You)` : name,
    amount: paiseToRupees(paise),
    paise,
  }))

  // Trip Summary text for sharing
  const summaryLines = [
    `📊 *${group.name} — Expense Summary*`,
    `Total Spend: ${formatINR(totalGroupPaise)}`,
    `Members: ${group.members.join(', ')}`,
    '',
    '*Category Breakdown:*',
    ...categoryData.map((c) => `• ${c.name}: ${c.percentage}% (${formatINR(c.paise)})`),
    '',
    '*Paid by Members:*',
    ...memberData.map((m) => `• ${m.name}: ${formatINR(m.paise)}`),
    '',
    'Tracked seamlessly via Splitzy ⚡',
  ]
  const summaryText = summaryLines.join('\n')

  const handleCopySummary = () => {
    navigator.clipboard.writeText(summaryText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShareSummary = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(summaryText)}`
    window.open(url, '_blank')
  }

  return (
    <div className="space-y-6">
      {/* Category Donut & Breakdown */}
      <Card>
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1">
          Spending by Category
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
          Total group expenditure of {formatINR(totalGroupPaise)}
        </p>

        {categoryData.length === 0 ? (
          <p className="text-xs text-zinc-400 py-6 text-center">No expenses recorded yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            {/* Donut Chart */}
            <div className="h-48 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Category Percentages List */}
            <div className="space-y-2">
              {categoryData.map((cat) => (
                <div
                  key={cat.name}
                  className="flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">
                      {cat.name}
                    </span>
                    <span className="text-zinc-400">({cat.percentage}%)</span>
                  </div>
                  <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {formatINR(cat.paise)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Member Spending Bar Chart */}
      <Card>
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1">
          Who Paid What
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
          Total amount fronted by each member
        </p>

        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={memberData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Paid']}
              />
              <Bar dataKey="amount" fill="#4F46E5" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Shareable Trip Summary Card */}
      <Card className="bg-gradient-to-br from-zinc-50 to-white dark:from-[#17181B] dark:to-[#121316] border border-border-light dark:border-border-dark">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Trip Summary Card
            </h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Export and share with your group on WhatsApp
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleCopySummary}>
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
            <Button
              size="sm"
              variant="primary"
              className="bg-[#25D366] hover:bg-[#20bd5a] text-white"
              onClick={handleShareSummary}
            >
              <Share2 className="w-3.5 h-3.5 mr-1" />
              WhatsApp
            </Button>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
          {summaryText}
        </div>
      </Card>
    </div>
  )
}
