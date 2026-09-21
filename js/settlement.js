/**
 * SPLITZY 2.0 — Debt Simplification & Balance Engine
 * Implements Min-Cash-Flow greedy algorithm for any N members.
 */

class SettlementEngine {
  /**
   * Calculates net balances for all members in a group
   */
  static calculateGroupBalances(groupId) {
    const group = storage.getGroupById(groupId);
    if (!group) return {};

    const expenses = storage.getExpensesByGroup(group.id);
    const settlements = storage.getSettlementsByGroup(group.id);

    const balances = {};
    const paidTotals = {};
    const shareTotals = {};

    // Ensure all group members exist in tracking
    group.members.forEach(member => {
      balances[member] = 0;
      paidTotals[member] = 0;
      shareTotals[member] = 0;
    });

    // 1. Process Expenses
    expenses.forEach(expense => {
      const payer = expense.paidBy;
      const totalAmount = parseFloat(expense.amount) || 0;

      if (paidTotals[payer] !== undefined) {
        paidTotals[payer] += totalAmount;
      } else {
        paidTotals[payer] = totalAmount;
        if (!group.members.includes(payer)) group.members.push(payer);
      }

      if (expense.splits) {
        Object.entries(expense.splits).forEach(([member, share]) => {
          const numShare = parseFloat(share) || 0;
          if (shareTotals[member] !== undefined) {
            shareTotals[member] += numShare;
          } else {
            shareTotals[member] = numShare;
          }
        });
      }
    });

    // 2. Process Settlements (Direct recorded cash transfers)
    settlements.forEach(settle => {
      const amount = parseFloat(settle.amount) || 0;
      if (paidTotals[settle.payer] !== undefined) paidTotals[settle.payer] += amount;
      if (shareTotals[settle.receiver] !== undefined) shareTotals[settle.receiver] += amount;
    });

    // 3. Compute Net Position (Paid - Share)
    group.members.forEach(member => {
      const paid = Math.round((paidTotals[member] || 0) * 100) / 100;
      const share = Math.round((shareTotals[member] || 0) * 100) / 100;
      const net = Math.round((paid - share) * 100) / 100;

      balances[member] = {
        net: Math.abs(net) < 0.01 ? 0 : net,
        totalPaid: paid,
        totalShare: share
      };
    });

    return balances;
  }

  /**
   * Greedy Min-Cash-Flow Algorithm to find optimal transfers
   */
  static simplifyDebts(memberBalances) {
    const debtors = [];
    const creditors = [];

    Object.entries(memberBalances).forEach(([name, data]) => {
      const net = typeof data === 'object' ? data.net : data;
      if (net < -0.01) {
        debtors.push({ name, amount: Math.abs(net) });
      } else if (net > 0.01) {
        creditors.push({ name, amount: net });
      }
    });

    const transactions = [];

    while (debtors.length > 0 && creditors.length > 0) {
      debtors.sort((a, b) => b.amount - a.amount);
      creditors.sort((a, b) => b.amount - a.amount);

      const debtor = debtors[0];
      const creditor = creditors[0];

      const settleAmount = Math.min(debtor.amount, creditor.amount);
      const roundedAmount = Math.round(settleAmount * 100) / 100;

      if (roundedAmount > 0) {
        transactions.push({
          from: debtor.name,
          to: creditor.name,
          amount: roundedAmount
        });
      }

      debtor.amount -= settleAmount;
      creditor.amount -= settleAmount;

      if (debtor.amount < 0.01) debtors.shift();
      if (creditor.amount < 0.01) creditors.shift();
    }

    return transactions;
  }

  /**
   * Global financial overview for active user profile
   */
  static getUserGlobalSummary(userName) {
    const groups = storage.getGroups();
    let totalOwedToYou = 0;
    let totalYouOwe = 0;
    const debts = [];
    const credits = [];

    groups.forEach(group => {
      if (!group.members.includes(userName)) return;

      const balances = this.calculateGroupBalances(group.id);
      const userBalance = balances[userName];

      if (userBalance) {
        if (userBalance.net > 0) totalOwedToYou += userBalance.net;
        else if (userBalance.net < 0) totalYouOwe += Math.abs(userBalance.net);
      }

      const transactions = this.simplifyDebts(balances);
      transactions.forEach(t => {
        if (t.from === userName) {
          debts.push({
            groupId: group.id,
            groupName: group.name,
            groupCode: group.code,
            to: t.to,
            amount: t.amount
          });
        } else if (t.to === userName) {
          credits.push({
            groupId: group.id,
            groupName: group.name,
            groupCode: group.code,
            from: t.from,
            amount: t.amount
          });
        }
      });
    });

    return {
      totalOwedToYou: Math.round(totalOwedToYou * 100) / 100,
      totalYouOwe: Math.round(totalYouOwe * 100) / 100,
      netBalance: Math.round((totalOwedToYou - totalYouOwe) * 100) / 100,
      debts,
      credits
    };
  }
  /**
   * Generates standard Indian Unified Payments Interface (UPI) deep-link string
   * Strict NPCI specification with parameter sanitization and injection prevention
   */
  static generateUpiUri(receiverName, amount, note = 'Splitzy Settlement') {
    const rawUpiId = storage.getMemberUpi(receiverName);
    const validation = StorageManager.validateUpiId(rawUpiId);
    const cleanUpi = validation.valid ? validation.cleanUpi : rawUpiId.replace(/[^a-zA-Z0-9.@_\-]/g, '');

    // Strict positive numeric amount (NPCI max ₹1,00,000 per transaction guard)
    const numAmount = Math.max(0.01, Math.min(100000, parseFloat(amount) || 0));
    const cleanAmount = numAmount.toFixed(2);

    // Sanitize receiver name (strip CRLF, URL delimiters, and scripts)
    const cleanReceiver = (receiverName || 'Splitzy Payee')
      .replace(/[\r\n&?=#<>"'`;\\]/g, '')
      .trim()
      .substring(0, 50);

    // Sanitize note
    const cleanNote = (note || 'Splitzy Settlement')
      .replace(/[\r\n&?=#<>"'`;\\]/g, '')
      .trim()
      .substring(0, 50);

    // Unique transaction reference for fraud prevention and deduplication
    const txRef = `SPLITZY_${Date.now()}`;

    return `upi://pay?pa=${encodeURIComponent(cleanUpi)}&pn=${encodeURIComponent(cleanReceiver)}&am=${cleanAmount}&cu=INR&tn=${encodeURIComponent(cleanNote)}&tr=${encodeURIComponent(txRef)}`;
  }

  /**
   * Renders high-res UPI QR code onto given canvas element using QRious
   */
  static renderUpiQrCode(canvasElement, receiverName, amount, note = 'Splitzy Settlement') {
    if (!canvasElement) return null;
    const upiUri = this.generateUpiUri(receiverName, amount, note);

    try {
      if (typeof QRious !== 'undefined') {
        new QRious({
          element: canvasElement,
          value: upiUri,
          size: 220,
          level: 'H',
          background: '#ffffff',
          foreground: '#0f172a'
        });
        return upiUri;
      }
    } catch (e) {
      console.warn('QRious generation error:', e);
    }
    return upiUri;
  }
}

window.SettlementEngine = SettlementEngine;
