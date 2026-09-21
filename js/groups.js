/**
 * SPLITZY 2.0 — Group Management & Invite Link Generator
 */

class GroupsManager {
  static getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  }

  static getMemberColor(name) {
    const colors = [
      '#4f46e5', '#059669', '#d97706', '#dc2626', 
      '#0284c7', '#7c3aed', '#db2777', '#2563eb', '#0d9488'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  /**
   * Generates a web shareable invite link for a group
   */
  static getInviteLink(group) {
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?join=${group.code || group.id}`;
  }

  static renderGroupCard(group, currentUserName) {
    const balances = SettlementEngine.calculateGroupBalances(group.id);
    const userBalance = balances[currentUserName] || { net: 0, totalPaid: 0, totalShare: 0 };
    const expenses = storage.getExpensesByGroup(group.id);
    const totalSpent = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    let balanceBadge = '';
    if (userBalance.net > 0) {
      balanceBadge = `<span class="badge-custom badge-credit"><i class="fa-solid fa-arrow-down-left"></i> You are owed ₹${userBalance.net.toLocaleString('en-IN')}</span>`;
    } else if (userBalance.net < 0) {
      balanceBadge = `<span class="badge-custom badge-debt"><i class="fa-solid fa-arrow-up-right"></i> You owe ₹${Math.abs(userBalance.net).toLocaleString('en-IN')}</span>`;
    } else {
      balanceBadge = `<span class="badge-custom badge-settled"><i class="fa-solid fa-check"></i> Settled up</span>`;
    }

    const memberAvatars = group.members.slice(0, 4).map(m => `
      <span class="avatar-chip" style="background-color: ${this.getMemberColor(m)}" title="${m}">
        ${this.getInitials(m)}
      </span>
    `).join('');

    const moreMembers = group.members.length > 4 ? `<span class="avatar-chip" style="background:#64748b">+${group.members.length - 4}</span>` : '';

    return `
      <div class="col-12 col-md-6 col-lg-4 mb-3">
        <div class="group-card h-100 d-flex flex-column justify-content-between" onclick="App.openGroupDetail('${group.id}')">
          <div>
            <div class="d-flex align-items-start justify-content-between mb-3">
              <div class="d-flex align-items-center gap-3">
                <div class="group-avatar" style="background: ${group.color || '#4f46e5'}15; color: ${group.color || '#4f46e5'}">
                  ${group.icon || '👥'}
                </div>
                <div>
                  <h5 class="mb-0 text-truncate" style="max-width: 170px;">${group.name}</h5>
                  <span class="group-code-badge">${group.code || group.id}</span>
                </div>
              </div>
              <span class="badge badge-category rounded-pill">${expenses.length} bills</span>
            </div>

            <div class="d-flex align-items-center justify-content-between py-2 border-top border-bottom mb-3" style="border-color: var(--card-border) !important;">
              <div>
                <small class="text-muted d-block">Total Spend</small>
                <strong>₹${totalSpent.toLocaleString('en-IN')}</strong>
              </div>
              <div class="text-end">
                <small class="text-muted d-block">Your Share</small>
                <strong>₹${userBalance.totalShare.toLocaleString('en-IN')}</strong>
              </div>
            </div>
          </div>

          <div class="d-flex align-items-center justify-content-between pt-1">
            <div class="avatar-stack">
              ${memberAvatars}
              ${moreMembers}
            </div>
            <div>
              ${balanceBadge}
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

window.GroupsManager = GroupsManager;
