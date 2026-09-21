/**
 * SPLITZY 2.0 — High-Contrast Analytics & Chart Visualizations
 */

class AnalyticsManager {
  static categoryChartInstance = null;
  static memberChartInstance = null;

  static renderGroupAnalytics(groupId) {
    const group = storage.getGroupById(groupId);
    if (!group) return;

    const expenses = storage.getExpensesByGroup(group.id);
    const balances = SettlementEngine.calculateGroupBalances(group.id);

    // 1. Category Breakdown
    const catTotals = {};
    expenses.forEach(e => {
      const cat = e.category || 'General';
      catTotals[cat] = (catTotals[cat] || 0) + (parseFloat(e.amount) || 0);
    });

    const catLabels = Object.keys(catTotals);
    const catData = Object.values(catTotals);
    const catColors = catLabels.map(cat => {
      const meta = EXPENSE_CATEGORIES[cat] || EXPENSE_CATEGORIES.General;
      return meta.color;
    });

    const ctxCategory = document.getElementById('groupCategoryChart') || document.getElementById('categoryChart');
    if (ctxCategory) {
      if (this.categoryChartInstance) this.categoryChartInstance.destroy();

      if (catLabels.length === 0) {
        ctxCategory.parentElement.innerHTML = '<div class="text-center py-4 text-muted fw-semibold">No expenses added yet to show analytics.</div>';
      } else {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        this.categoryChartInstance = new Chart(ctxCategory, {
          type: 'doughnut',
          data: {
            labels: catLabels,
            datasets: [{
              data: catData,
              backgroundColor: catColors,
              borderColor: isDark ? '#111827' : '#ffffff',
              borderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  color: isDark ? '#f8fafc' : '#0f172a',
                  font: { family: "'Inter', sans-serif", weight: 'bold', size: 12 },
                  padding: 12
                }
              }
            },
            cutout: '65%'
          }
        });
      }
    }

    // 2. Member Paid vs Consumed Bar Chart
    const ctxMember = document.getElementById('groupMemberChart') || document.getElementById('memberComparisonChart');
    if (ctxMember) {
      if (this.memberChartInstance) this.memberChartInstance.destroy();

      const memberNames = group.members;
      const paidData = memberNames.map(m => balances[m] ? balances[m].totalPaid : 0);
      const consumedData = memberNames.map(m => balances[m] ? balances[m].totalShare : 0);
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

      this.memberChartInstance = new Chart(ctxMember, {
        type: 'bar',
        data: {
          labels: memberNames,
          datasets: [
            {
              label: 'Paid (Lent)',
              data: paidData,
              backgroundColor: '#4f46e5',
              borderRadius: 4
            },
            {
              label: 'Consumed (Share)',
              data: consumedData,
              backgroundColor: '#059669',
              borderRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: isDark ? '#cbd5e1' : '#334155', font: { weight: 'bold' } }
            },
            y: {
              grid: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' },
              ticks: {
                color: isDark ? '#cbd5e1' : '#334155',
                callback: function(val) { return '₹' + val; }
              }
            }
          },
          plugins: {
            legend: {
              position: 'top',
              labels: {
                color: isDark ? '#f8fafc' : '#0f172a',
                font: { family: "'Inter', sans-serif", weight: 'bold' }
              }
            }
          }
        }
      });
    }

    // Top Level Summary Stats
    const totalSpent = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const avgPerMember = group.members.length > 0 ? Math.round(totalSpent / group.members.length) : 0;
    
    let highestSpender = 'None';
    let highestSpent = 0;
    Object.entries(balances).forEach(([m, data]) => {
      if (data.totalPaid > highestSpent) {
        highestSpent = data.totalPaid;
        highestSpender = m;
      }
    });

    const statTotalEl = document.getElementById('analyticsTotalSpent');
    const statAvgEl = document.getElementById('analyticsAvgSpent');
    const statTopSpenderEl = document.getElementById('analyticsTopSpender');

    if (statTotalEl) statTotalEl.textContent = `₹${totalSpent.toLocaleString('en-IN')}`;
    if (statAvgEl) statAvgEl.textContent = `₹${avgPerMember.toLocaleString('en-IN')}`;
    if (statTopSpenderEl) statTopSpenderEl.textContent = `${highestSpender} (₹${highestSpent.toLocaleString('en-IN')})`;
  }
}

window.AnalyticsManager = AnalyticsManager;
