/**
 * SPLITZY 2.0 — Export, Share & PDF Statement Hub
 */

class ExportManager {
  static exportGroupToCSV(groupId) {
    const group = storage.getGroupById(groupId);
    if (!group) return;

    const expenses = storage.getExpensesByGroup(group.id);
    let csv = "data:text/csv;charset=utf-8,Date,Title,Category,Amount (INR),Paid By,Split Type,Notes\n";

    expenses.forEach(e => {
      csv += `"${e.date || ''}","${(e.title || '').replace(/"/g, '""')}","${e.category || 'General'}",${e.amount},"${e.paidBy || ''}","${e.splitType || 'equal'}","${(e.notes || '').replace(/"/g, '""')}"\n`;
    });

    const encodedUri = encodeURI(csv);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Splitzy_${group.name.replace(/[^a-zA-Z0-9]/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    App.showToast('CSV downloaded successfully!', 'success');
  }

  static generateShareSummary(groupId) {
    const group = storage.getGroupById(groupId);
    if (!group) return '';

    const expenses = storage.getExpensesByGroup(group.id);
    const balances = SettlementEngine.calculateGroupBalances(group.id);
    const simplified = SettlementEngine.simplifyDebts(balances);
    const totalSpent = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const inviteLink = GroupsManager.getInviteLink(group);

    let text = `*${group.name} — Splitzy Summary*\n`;
    text += `Group Code: ${group.code || group.id}\n`;
    text += `Total Spent: ₹${totalSpent.toLocaleString('en-IN')}\n\n`;

    text += `*Member Balances:*\n`;
    Object.entries(balances).forEach(([m, data]) => {
      if (data.net > 0) text += `• ${m}: +₹${data.net} (Gets back)\n`;
      else if (data.net < 0) text += `• ${m}: -₹${Math.abs(data.net)} (Owes)\n`;
      else text += `• ${m}: Settled\n`;
    });

    text += `\n*Simplified Settlements:*\n`;
    if (simplified.length === 0) {
      text += `All settled up!\n`;
    } else {
      simplified.forEach((t, i) => {
        text += `${i + 1}. ${t.from} -> ${t.to}: ₹${t.amount.toLocaleString('en-IN')}\n`;
      });
    }

    text += `\nJoin & view group online: ${inviteLink}`;
    return text;
  }

  static shareToWhatsApp(groupId) {
    const text = this.generateShareSummary(groupId);
    if (!text) return;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  }

  static copyShareSummary(groupId) {
    const text = this.generateShareSummary(groupId);
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      App.showToast('Copied summary to clipboard!', 'success');
    }).catch(() => {
      App.showToast('Failed to copy text', 'danger');
    });
  }

  static copyInviteLink(groupId) {
    const group = storage.getGroupById(groupId);
    if (!group) return;
    const link = GroupsManager.getInviteLink(group);
    navigator.clipboard.writeText(link).then(() => {
      App.showToast('Invite link copied to clipboard!', 'success');
    }).catch(() => {
      App.showToast('Failed to copy link', 'danger');
    });
  }

  /**
   * Generates a high-quality, professional downloadable PDF Group Statement
   */
  static downloadGroupPDF(groupId) {
    const group = storage.getGroupById(groupId);
    if (!group) return;

    App.showToast('Generating PDF statement...', 'info');

    const expenses = storage.getExpensesByGroup(group.id);
    const settlements = storage.getSettlementsByGroup(group.id);
    const balances = SettlementEngine.calculateGroupBalances(group.id);
    const simplified = SettlementEngine.simplifyDebts(balances);
    const totalSpent = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const avgSpend = group.members.length > 0 ? (totalSpent / group.members.length).toFixed(2) : '0';

    // Build standalone printable/renderable element
    const container = document.createElement('div');
    container.id = 'pdf-render-container';
    container.style.padding = '24px';
    container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    container.style.color = '#1e293b';
    container.style.background = '#ffffff';
    container.style.maxWidth = '800px';

    container.innerHTML = `
      <div style="border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1 style="margin: 0; color: #4f46e5; font-size: 24px; font-weight: 800; display: flex; align-items: center; gap: 8px;">
            <span>⚡ Splitzy</span>
          </h1>
          <p style="margin: 4px 0 0; color: #64748b; font-size: 12px;">Official Group Expense & Settlement Statement</p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 14px; font-weight: 700; color: #0f172a;">${group.icon || '👥'} ${group.name}</div>
          <div style="font-size: 11px; color: #64748b;">Code: <strong>${group.code || group.id}</strong> | Date: ${new Date().toLocaleDateString('en-IN')}</div>
        </div>
      </div>

      <!-- KPI Summary -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
          <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">Total Group Spend</div>
          <div style="font-size: 18px; font-weight: 800; color: #4f46e5; margin-top: 4px;">₹${totalSpent.toLocaleString('en-IN')}</div>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
          <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">Average Per Member</div>
          <div style="font-size: 18px; font-weight: 800; color: #0d9488; margin-top: 4px;">₹${parseFloat(avgSpend).toLocaleString('en-IN')}</div>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
          <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">Total Expenses</div>
          <div style="font-size: 18px; font-weight: 800; color: #d97706; margin-top: 4px;">${expenses.length} Records</div>
        </div>
      </div>

      <!-- Member Balances Table -->
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 8px; border-left: 3px solid #4f46e5; padding-left: 8px;">1. Member Balance Breakdown</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
          <thead>
            <tr style="background: #f1f5f9; color: #475569; border-bottom: 2px solid #cbd5e1;">
              <th style="padding: 8px;">Member Name</th>
              <th style="padding: 8px; text-align: right;">Total Paid</th>
              <th style="padding: 8px; text-align: right;">Total Share</th>
              <th style="padding: 8px; text-align: right;">Net Balance</th>
              <th style="padding: 8px; text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(balances).map(([m, data]) => {
              const isCredit = data.net > 0;
              const isDebit = data.net < 0;
              const statusColor = isCredit ? '#16a34a' : isDebit ? '#dc2626' : '#64748b';
              const statusText = isCredit ? 'Gets back' : isDebit ? 'Owes' : 'Settled';
              return `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px; font-weight: 600;">${m}</td>
                  <td style="padding: 8px; text-align: right;">₹${data.totalPaid.toLocaleString('en-IN')}</td>
                  <td style="padding: 8px; text-align: right;">₹${data.totalShare.toLocaleString('en-IN')}</td>
                  <td style="padding: 8px; text-align: right; font-weight: 700; color: ${statusColor};">${isCredit ? '+' : ''}₹${data.net.toLocaleString('en-IN')}</td>
                  <td style="padding: 8px; text-align: center; font-weight: 600; color: ${statusColor};">${statusText}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Optimal Debt Settlement Plan -->
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 8px; border-left: 3px solid #059669; padding-left: 8px;">2. Simplified Settlement Plan (Min-Cash-Flow)</h3>
        ${simplified.length === 0 ? `
          <div style="padding: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; color: #16a34a; font-size: 12px; font-weight: 600;">
            ✅ All debts are completely settled up! No transactions needed.
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${simplified.map((t, idx) => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px;">
                <span><strong>#${idx + 1}. ${t.from}</strong> pays <strong>${t.to}</strong></span>
                <span style="font-weight: 800; color: #0f172a; font-size: 13px;">₹${t.amount.toLocaleString('en-IN')}</span>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <!-- Full Expense Logs -->
      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 8px; border-left: 3px solid #d97706; padding-left: 8px;">3. Expense Activity Log</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
          <thead>
            <tr style="background: #f1f5f9; color: #475569; border-bottom: 2px solid #cbd5e1;">
              <th style="padding: 6px;">Date</th>
              <th style="padding: 6px;">Description</th>
              <th style="padding: 6px;">Category</th>
              <th style="padding: 6px;">Paid By</th>
              <th style="padding: 6px; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${expenses.map(e => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 6px; color: #64748b;">${e.date || '-'}</td>
                <td style="padding: 6px; font-weight: 600;">${e.title}</td>
                <td style="padding: 6px;">${e.category || 'General'}</td>
                <td style="padding: 6px;">${e.paidBy}</td>
                <td style="padding: 6px; text-align: right; font-weight: 700;">₹${parseFloat(e.amount).toLocaleString('en-IN')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Footer Note -->
      <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 24px; text-align: center; font-size: 10px; color: #94a3b8;">
        Generated via Splitzy App • Clean, Accurate Group Debt Simplification Algorithm
      </div>
    `;

    document.body.appendChild(container);

    if (typeof html2pdf !== 'undefined') {
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `Splitzy_Statement_${group.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      html2pdf().set(opt).from(container).save().then(() => {
        container.remove();
        App.showToast('PDF downloaded successfully! 📄', 'success');
      }).catch(err => {
        console.error('PDF export failed:', err);
        container.remove();
        window.print();
      });
    } else {
      container.remove();
      window.print();
    }
  }

  /**
   * Generates a single payment receipt voucher PDF
   */
  static downloadSettlementReceiptPDF(payer, receiver, amount, groupName = 'Splitzy Group') {
    App.showToast('Generating Payment Receipt...', 'info');

    const container = document.createElement('div');
    container.style.padding = '30px';
    container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    container.style.color = '#1e293b';
    container.style.background = '#ffffff';
    container.style.maxWidth = '600px';

    const upiId = storage.getMemberUpi(receiver);
    const txnId = 'SPZ-' + Date.now().toString().slice(-8);

    container.innerHTML = `
      <div style="border: 2px solid #e2e8f0; border-radius: 12px; padding: 24px; background: #ffffff;">
        <div style="text-align: center; border-bottom: 2px dashed #e2e8f0; padding-bottom: 16px; margin-bottom: 20px;">
          <div style="font-size: 24px; font-weight: 800; color: #4f46e5;">⚡ Splitzy</div>
          <div style="font-size: 14px; font-weight: 700; color: #16a34a; margin-top: 4px;">PAYMENT SETTLEMENT RECEIPT</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Txn Reference: <strong>${txnId}</strong></div>
        </div>

        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600;">Amount Settled</div>
          <div style="font-size: 32px; font-weight: 900; color: #0f172a; margin: 4px 0;">₹${parseFloat(amount).toLocaleString('en-IN')}</div>
          <span style="background: #f0fdf4; color: #16a34a; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; border: 1px solid #bbf7d0;">
            ✓ Settle Up Completed
          </span>
        </div>

        <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 20px; font-size: 13px;">
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e2e8f0;">
            <span style="color: #64748b;">Paid By (Sender):</span>
            <strong style="color: #0f172a;">${payer}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e2e8f0;">
            <span style="color: #64748b;">Received By (Beneficiary):</span>
            <strong style="color: #0f172a;">${receiver}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e2e8f0;">
            <span style="color: #64748b;">Receiver UPI ID:</span>
            <strong style="color: #4f46e5;">${upiId}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e2e8f0;">
            <span style="color: #64748b;">Group Name:</span>
            <strong style="color: #0f172a;">${groupName}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0;">
            <span style="color: #64748b;">Timestamp:</span>
            <strong style="color: #0f172a;">${new Date().toLocaleString('en-IN')}</strong>
          </div>
        </div>

        <div style="text-align: center; font-size: 10px; color: #94a3b8;">
          This is a computer generated receipt from Splitzy Expense Manager.
        </div>
      </div>
    `;

    document.body.appendChild(container);

    if (typeof html2pdf !== 'undefined') {
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `Splitzy_Receipt_${payer}_to_${receiver}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a5', orientation: 'portrait' }
      };

      html2pdf().set(opt).from(container).save().then(() => {
        container.remove();
        App.showToast('Receipt PDF downloaded! 🧾', 'success');
      }).catch(err => {
        console.error('Receipt PDF failed:', err);
        container.remove();
      });
    } else {
      container.remove();
      window.print();
    }
  }

  static printGroupReport() {
    window.print();
  }
}

window.ExportManager = ExportManager;
