/* eslint-disable */
// Curated demo data for Zitting Finance — used as defaults/fallback and as
// the seed source. DB rows override the entity sections via getFinanceData().
// (Extracted verbatim from the design prototype's appdata.js.)
export const MOCK_FINANCE_DATA: any = {
  // Consolidated top-level nav (7). Tidy up + Import live as tabs inside
  // Transactions; Allocations is the Rules tab inside Transfers; Bills is a
  // tab inside Income & Bills; Categories/Learned/Receipts moved into the
  // Settings hub; Ask AI is the sparkles button in the topbar.
  nav: [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'accounts', label: 'Accounts', icon: 'wallet' },
    { id: 'transactions', label: 'Transactions', icon: 'list' },
    { id: 'budgets', label: 'Budgets', icon: 'pie' },
    { id: 'transfers', label: 'Transfers', icon: 'transfers' },
    { id: 'savings', label: 'Savings', icon: 'target' },
    { id: 'income', label: 'Income & Bills', icon: 'trendingUp' },
  ],

  learned: [],
  notifPrefs: [],
  // Merchant-clustered triage groups for the member Review tab (live data
  // builds these in getFinanceData; shape mirrors queries.ts bulkGroups).
  // ids reference memberHome.activity rows below.
  bulkGroups: [
    {
      key: 'cash app', merchant: 'Cash App', ids: [101, 102], count: 2, unreviewed: 2, uncategorized: 2,
      spend: 65, spendLabel: '$65.00', currentCategoryId: null, currentCategory: null, currentColor: null, mixed: false,
      suggestion: { categoryId: 'kids', name: 'Kids', color: 'var(--green-600)', confidence: 0.78, confidencePct: 78, reason: null, source: 'memory' },
      accounts: ["Sarah's wallet"], dateRange: 'Jun 6 – Jun 8',
    },
    {
      key: 'check', merchant: 'By Check', ids: [103, 104, 105], count: 3, unreviewed: 3, uncategorized: 3,
      spend: 225, spendLabel: '$225.00', currentCategoryId: null, currentCategory: null, currentColor: null, mixed: false,
      suggestion: { categoryId: 'utilities', name: 'Utilities', color: 'var(--gray-500)', confidence: 0.55, confidencePct: 55, reason: null, source: 'keyword' },
      accounts: ["Sarah's wallet"], dateRange: 'May 20 – Jun 7',
    },
  ],
  receipts: [
    // matched + scanned: full line-item breakdown attached to a transaction
    {
      id: 'mock-receipt-1', filename: 'harmons.jpg', mime: 'image/jpeg', sizeLabel: '1.2 MB',
      status: 'matched', transactionId: 1,
      txn: { id: 1, merchant: 'Harmons Grocery', date: 'Jun 4', amount: '$84.21' },
      suggestedTransactionId: null, suggestedTxn: null,
      merchant: 'Harmons Grocery', total: 84.21, totalLabel: '$84.21', receiptDate: 'Jun 4', dateISO: '2026-06-04',
      scanStatus: 'scanned',
      lines: [
        { name: 'Whole milk 2%', qty: 2, price: 7.98 },
        { name: 'Bananas', qty: null, price: 2.43 },
        { name: 'Chicken breast', qty: null, price: 18.62 },
        { name: 'Cheddar cheese', qty: 1, price: 6.49 },
        { name: 'Sourdough bread', qty: 2, price: 9.98 },
        { name: 'Eggs, dozen', qty: 1, price: 4.29 },
        { name: 'Apples, Honeycrisp', qty: 6, price: 8.12 },
        { name: 'Greek yogurt', qty: 4, price: 5.96 },
        { name: 'Pasta sauce', qty: 2, price: 7.58 },
        { name: 'Ground beef', qty: null, price: 11.24 },
        { name: 'Member savings', qty: null, price: -3.50 },
        { name: 'Misc grocery', qty: null, price: 5.02 },
      ],
      uploadedById: 'sarah', uploadedBy: 'Sarah', uploaded: '2h ago',
    },
    // scanned but ambiguous: suggestion waiting for a one-tap accept
    {
      id: 'mock-receipt-2', filename: 'target.jpg', mime: 'image/jpeg', sizeLabel: '0.9 MB',
      status: 'inbox', transactionId: null, txn: null,
      suggestedTransactionId: 5,
      suggestedTxn: { id: 5, merchant: 'Target', date: 'Jun 2', amount: '$36.40' },
      merchant: 'Target', total: 36.40, totalLabel: '$36.40', receiptDate: 'Jun 2', dateISO: '2026-06-02',
      scanStatus: 'scanned',
      lines: [
        { name: 'Notebook 3-pack', qty: 1, price: 12.99 },
        { name: 'Hair ties', qty: 2, price: 7.98 },
        { name: 'Phone case', qty: 1, price: 15.43 },
      ],
      uploadedById: 'sarah', uploadedBy: 'Sarah', uploaded: 'Yesterday',
    },
    // older scanned receipts across the year — power the item search history
    {
      id: 'mock-receipt-3', filename: 'costco.jpg', mime: 'image/jpeg', sizeLabel: '1.4 MB',
      status: 'inbox', transactionId: null, txn: null, suggestedTransactionId: null, suggestedTxn: null,
      merchant: 'Costco', total: 142.88, totalLabel: '$142.88', receiptDate: 'Apr 20', dateISO: '2026-04-20',
      scanStatus: 'scanned',
      lines: [
        { name: 'Organic apples, 4lb', qty: 4, price: 9.49 },
        { name: 'Whole milk', qty: 2, price: 6.78 },
        { name: 'Rotisserie chicken', qty: 1, price: 4.99 },
        { name: 'Eggs, 24 ct', qty: 1, price: 7.29 },
        { name: 'Paper towels', qty: 1, price: 21.99 },
        { name: 'Bananas', qty: null, price: 1.99 },
      ],
      uploadedById: 'sarah', uploadedBy: 'Sarah', uploaded: 'Apr 20',
    },
    {
      id: 'mock-receipt-4', filename: 'smiths.jpg', mime: 'image/jpeg', sizeLabel: '1.0 MB',
      status: 'inbox', transactionId: null, txn: null, suggestedTransactionId: null, suggestedTxn: null,
      merchant: "Smith's", total: 53.17, totalLabel: '$53.17', receiptDate: 'Feb 14', dateISO: '2026-02-14',
      scanStatus: 'scanned',
      lines: [
        { name: 'Apples, Gala', qty: 5, price: 6.45 },
        { name: 'Bananas', qty: null, price: 2.10 },
        { name: 'Whole milk 2%', qty: 1, price: 3.99 },
        { name: 'Strawberries', qty: 2, price: 7.98 },
        { name: 'Bread, wheat', qty: 1, price: 3.49 },
      ],
      uploadedById: 'sarah', uploadedBy: 'Sarah', uploaded: 'Feb 14',
    },
  ],

  stats: {
    totalCash: '$84,920',
    spending: '$6,420',
    income: '$9,250',
    transfers: '$4,000',
  },

  // Derived live (getFinanceData): pending transfer count + total to move.
  transfersPending: 0,
  transfersPendingTotal: '$0',

  trend: {
    income:   [7600, 8200, 7900, 8800, 8600, 9250],
    spending: [6100, 6400, 5900, 6800, 6200, 6420],
    labels:   ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
  },

  categories: [
    { label: 'Housing',   value: 1900, display: '$1,900', color: 'var(--green-500)' },
    { label: 'Groceries', value: 1240, display: '$1,240', color: 'var(--indigo-500)' },
    { label: 'Dining',    value: 680,  display: '$680',   color: 'var(--amber-500)' },
    { label: 'Kids',      value: 520,  display: '$520',   color: 'var(--green-600)' },
    { label: 'Utilities', value: 430,  display: '$430',   color: 'var(--gray-500)' },
  ],

  // Minimal taxonomy so the category pickers work without a DB (live data
  // replaces these via getFinanceData; shape mirrors queries.ts allCategories).
  categoryGroups: [
    { id: 'spending', name: 'Spending', sortOrder: 0 },
    { id: 'home', name: 'Home', sortOrder: 1 },
  ],
  allCategories: [
    { id: 'groceries', name: 'Groceries', groupId: 'spending', color: 'var(--indigo-500)', icon: null, kind: 'expense', excludeFromBudget: false, sortOrder: 0 },
    { id: 'dining', name: 'Dining', groupId: 'spending', color: 'var(--amber-500)', icon: null, kind: 'expense', excludeFromBudget: false, sortOrder: 1 },
    { id: 'shopping', name: 'Shopping', groupId: 'spending', color: 'var(--green-600)', icon: null, kind: 'expense', excludeFromBudget: false, sortOrder: 2 },
    { id: 'kids', name: 'Kids', groupId: 'spending', color: 'var(--green-600)', icon: null, kind: 'expense', excludeFromBudget: false, sortOrder: 3 },
    { id: 'entertainment', name: 'Fun', groupId: 'spending', color: 'var(--green-500)', icon: null, kind: 'expense', excludeFromBudget: false, sortOrder: 4 },
    { id: 'utilities', name: 'Utilities', groupId: 'home', color: 'var(--gray-500)', icon: null, kind: 'expense', excludeFromBudget: false, sortOrder: 5 },
  ],

  budgets: [
    { name: "Sarah's allowance", who: 'Sarah', spent: 215, limit: 400 },
    { name: "Rebecca's allowance", who: 'Rebecca', spent: 380, limit: 400 },
    { name: 'Groceries', who: null, icon: 'pie', spent: 312, limit: 600 },
    { name: 'Dining', who: null, icon: 'list', spent: 360, limit: 400 },
  ],

  upcoming: [
    { to: 'Tithing', from: 'Main Checking', amount: '$600.00', due: 'Due Jun 1', state: 'todo', icon: 'dollar' },
    { to: 'Bills account', from: 'Main Checking', amount: '$1,200.00', due: 'Auto', state: 'auto', icon: 'repeat' },
    { to: 'Groceries budget', from: 'Main Checking', amount: '$600.00', due: 'Due Jun 1', state: 'todo', icon: 'pie' },
    { to: "Sarah's allowance", from: 'Main Checking', amount: '$400.00', due: 'Due Jun 1', state: 'done', icon: 'wallet' },
    { to: 'Emergency Fund', from: 'Main Checking', amount: '$1,200.00', due: 'Due Jun 1', state: 'todo', icon: 'target' },
  ],
  scheduledTransfers: [],

  past: [
    { to: 'Tithing', from: 'Main Checking', amount: '$540.00', due: 'May 1', state: 'auto', icon: 'dollar' },
    { to: 'Bills account', from: 'Main Checking', amount: '$1,200.00', due: 'May 1', state: 'auto', icon: 'repeat' },
    { to: 'Emergency Fund', from: 'Main Checking', amount: '$980.00', due: 'May 1', state: 'done', icon: 'target' },
  ],

  txns: [
    { id: 1, date: 'Jun 4', isoDate: '2026-06-04', merchant: 'Harmons Grocery', cat: 'Groceries', color: 'var(--indigo-500)', who: 'Sarah', account: 'Amex ••3008', accountId: 'amex', amt: -84.21, pending: false, receiptId: 'mock-receipt-1' },
    { id: 2, date: 'Jun 3', isoDate: '2026-06-03', merchant: 'ADP Payroll', cat: 'Income', color: 'var(--green-500)', who: 'Jared', account: 'Main Checking', accountId: 'main', amt: 4000, income: true, pending: false },
    { id: 3, date: 'Jun 3', isoDate: '2026-06-03', merchant: 'Chick-fil-A', cat: 'Dining', color: 'var(--amber-500)', who: 'Rebecca', account: 'Amex ••3008', accountId: 'amex', amt: -18.75, pending: true },
    { id: 4, date: 'Jun 2', isoDate: '2026-06-02', merchant: 'Rocky Mtn Power', cat: 'Utilities', color: 'var(--gray-500)', who: 'Household', account: 'Bills account', accountId: 'bills', amt: -142.66, pending: false },
    { id: 5, date: 'Jun 2', isoDate: '2026-06-02', merchant: 'Target', cat: 'Shopping', color: 'var(--green-600)', who: 'Sarah', account: 'Amex ••3008', accountId: 'amex', amt: -36.40, pending: false, flagged: true },
    { id: 6, date: 'Jun 1', isoDate: '2026-06-01', merchant: 'From the Farm', cat: 'Income', color: 'var(--green-500)', who: 'Jared', account: 'Main Checking', accountId: 'main', amt: 1250, income: true, pending: false },
  ],

  rules: [
    { id: 'tithe', name: 'Tithe', method: '%', value: 15, dest: 'Tithing account', icon: 'dollar' },
    { id: 'bills', name: 'Bills', method: 'Fixed', value: 1200, dest: 'Bills account', icon: 'repeat' },
    { id: 'groceries', name: 'Groceries', method: 'Fixed', value: 600, dest: 'Groceries budget', icon: 'pie' },
    { id: 'sarah', name: "Sarah's allowance", method: 'Fixed', value: 400, dest: "Sarah's wallet", icon: 'wallet' },
    { id: 'savings', name: 'Savings', method: 'Remainder', value: null, dest: 'Emergency Fund', icon: 'target' },
    { id: 'auto-ef', name: 'Auto-save to Emergency Fund', method: 'Fixed', value: 500, dest: 'Emergency Fund', icon: 'transfers', trigger: 'scheduled', cadence: 'monthly', anchorDate: '2026-06-01', nextRunDate: '2026-07-01', nextRunLabel: 'Next · Jul 1' },
  ],

  member: {
    name: 'Sarah',
    allowance: 400,
    spent: 215,
    period: 'June',
    shared: [
      { name: 'Groceries', spent: 312, limit: 600 },
      { name: 'Dining', spent: 360, limit: 400 },
    ],
    txns: [
      { date: 'Jun 4', merchant: 'Harmons Grocery', cat: 'Groceries', amt: -84.21 },
      { date: 'Jun 2', merchant: 'Target', cat: 'Shopping', amt: -36.40 },
      { date: 'Jun 1', merchant: 'Chick-fil-A', cat: 'Dining', amt: -18.75 },
    ],
  },

  // Accounts moved out of the household (e.g. business) — surfaced for management.
  excludedAccounts: [] as { id: string; name: string; institution: string; mask: string | null; type: string; space: string; label: string; plaidLinked: boolean }[],

  accounts: {
    checking: [
      { id: 'main', name: 'Main Checking', inst: 'Mountain America CU', mask: '4021', balance: 12480.22, who: 'Household', synced: '2m ago', status: 'good', trend: [11200, 9800, 13400, 10200, 14100, 12480], dest: null },
      { id: 'bills', name: 'Bills account', inst: 'Mountain America CU', mask: '8847', balance: 2140.00, who: 'Household', synced: '2m ago', status: 'good', trend: [1800, 2300, 900, 2600, 1400, 2140], dest: 'Bills' },
      { id: 'tithing', name: 'Tithing', inst: 'Ally Bank', mask: '6610', balance: 0.0, who: 'Household', synced: '2m ago', status: 'good', trend: [540, 0, 600, 0, 540, 0], dest: 'Tithing' },
    ],
    savings: [
      { id: 'emergency', name: 'Emergency Fund', inst: 'Ally Bank', mask: '3390', balance: 48200.00, who: 'Household', synced: '5m ago', status: 'good', trend: [42000, 43800, 44900, 46100, 47200, 48200], dest: 'Savings' },
      { id: 'sarah-wallet', name: "Sarah's wallet", inst: 'Ally Bank', mask: '1192', balance: 185.40, who: 'Sarah', synced: '5m ago', status: 'good', trend: [400, 320, 260, 410, 300, 185], dest: 'Allowance' },
    ],
    credit: [
      { id: 'amex', name: 'Amex Everyday', inst: 'American Express', mask: '3008', balance: -2140.66, who: 'Household', synced: '1h ago', status: 'good', trend: [-1800, -2400, -1500, -2900, -1700, -2141] },
      { id: 'visa', name: 'Costco Visa', inst: 'Citi', mask: '7725', balance: -612.10, who: 'Jared', synced: 'Needs attention', status: 'attention', trend: [-300, -800, -450, -900, -500, -612] },
    ],
  },

  incomeStreams: [
    { id: 'adp', name: 'ADP Payroll', sub: "Jared · Zitting Dental", monthly: 8400, cadence: 'Twice monthly', last: 'Jun 1', next: 'Jun 15', status: 'on-track', spark: [8200, 8400, 8400, 8400, 8400, 8400] },
    { id: 'farm', name: 'From the Farm', sub: 'Seasonal · variable', monthly: 1250, cadence: 'Monthly', last: 'Jun 1', next: 'Jul 1', status: 'on-track', spark: [600, 900, 1100, 1400, 1250, 1250] },
    { id: 'sarah-job', name: 'Sarah — Etsy shop', sub: 'Side income', monthly: 420, cadence: 'Monthly', last: 'May 28', next: 'Jun 28', status: 'on-track', spark: [180, 240, 310, 360, 400, 420] },
    { id: 'rental', name: 'Basement rental', sub: 'Tenant · Mark P.', monthly: 1100, cadence: 'Monthly', last: 'May 3', next: 'Jun 3', status: 'late', spark: [1100, 1100, 1100, 1100, 1100, 0] },
  ],

  // Curated income registry (built live by getFinanceData; demo defaults here).
  income: {
    sources: [],
    candidates: [
      { matchKey: 'adp', name: 'ADP Payroll', sub: 'Jared · Zitting Dental', monthly: 8400, monthlyLabel: '$8,400', cadence: 'Twice monthly', next: 'Jun 15', accountId: null },
    ],
    allPayers: [
      { matchKey: 'adp', name: 'ADP Payroll', count: 14, total: 52000, totalLabel: '$52,000', avg: 3714.29, avgLabel: '$3,714', last: 'Jun 3', lastISO: '2026-06-03', cadence: 'Twice monthly', accountId: null, accountLabel: 'Main Checking', registered: false },
      { matchKey: 'from the farm', name: 'From the Farm', count: 6, total: 6500, totalLabel: '$6,500', avg: 1083.33, avgLabel: '$1,083', last: 'Jun 1', lastISO: '2026-06-01', cadence: 'Monthly', accountId: null, accountLabel: 'Main Checking', registered: false },
      { matchKey: 'venmo', name: 'Venmo', count: 9, total: 740, totalLabel: '$740', avg: 82.22, avgLabel: '$82', last: 'May 30', lastISO: '2026-05-30', cadence: null, accountId: null, accountLabel: 'Main Checking', registered: false },
      { matchKey: 'amazon refund', name: 'Amazon Refund', count: 3, total: 96, totalLabel: '$96', avg: 32, avgLabel: '$32', last: 'May 12', lastISO: '2026-05-12', cadence: null, accountId: null, accountLabel: 'Amex \u2022\u20223008', registered: false },
    ],
    totalMonthly: 0,
    totalMonthlyLabel: '$0',
  },

  bills: [
    { id: 1, name: 'Rocky Mountain Power', cat: 'Utilities', color: 'var(--gray-500)', amount: 142.66, freq: 'Monthly', next: 'Jun 18', account: 'Bills ••8847', badge: 'changed', delta: '+$22' },
    { id: 2, name: 'Xfinity Internet', cat: 'Utilities', color: 'var(--gray-500)', amount: 89.99, freq: 'Monthly', next: 'Jun 12', account: 'Bills ••8847', badge: 'due soon' },
    { id: 3, name: 'Mortgage — MACU', cat: 'Housing', color: 'var(--green-500)', amount: 1890.00, freq: 'Monthly', next: 'Jul 1', account: 'Main ••4021' },
    { id: 4, name: 'State Farm Auto', cat: 'Insurance', color: 'var(--indigo-500)', amount: 184.50, freq: 'Monthly', next: 'Jun 22', account: 'Main ••4021' },
    { id: 5, name: 'Netflix', cat: 'Subscriptions', color: 'var(--amber-500)', amount: 22.99, freq: 'Monthly', next: 'Jun 14', account: 'Amex ••3008', badge: 'new' },
    { id: 6, name: 'Spotify Family', cat: 'Subscriptions', color: 'var(--amber-500)', amount: 16.99, freq: 'Monthly', next: 'Jun 20', account: 'Amex ••3008' },
    { id: 7, name: 'iCloud+ 2TB', cat: 'Subscriptions', color: 'var(--amber-500)', amount: 9.99, freq: 'Monthly', next: 'Jun 9', account: 'Amex ••3008', badge: 'due soon' },
    { id: 8, name: 'Gym — VASA', cat: 'Health', color: 'var(--green-600)', amount: 38.00, freq: 'Monthly', next: 'Jun 25', account: 'Amex ••3008' },
  ],

  // The first entry carries `as` casts so the inferred element type allows the
  // nullable fields getFinanceData emits (targetDate/account/icon/monthsLeft…).
  goals: [
    {
      id: 'ef', name: 'Emergency Fund', saved: 48200, target: 60000, pct: 80, remaining: 11800,
      date: 'Dec 2026' as string | null, targetDate: '2026-12-31' as string | null,
      account: 'Ally ••3390' as string | null, accountId: 'emergency' as string | null,
      contrib: 1200, autoContrib: 1200, icon: '🛟' as string | null, color: 'var(--accent)',
      goalType: 'emergency', visibility: 'household',
      members: [] as { id: string; name: string; color: string | null }[],
      contributions: [] as { id: number; amount: number; date: string | null; kind: string; member: string | null; note: string | null }[],
      monthsLeft: 6 as number | null, requiredPerMonth: 1967 as number | null,
      status: 'on-track', archived: false,
    },
    { id: 'trip', name: 'Family trip — Hawaii', saved: 3400, target: 9000, pct: 38, remaining: 5600, date: 'Mar 2027', targetDate: '2027-03-31', account: 'Ally ••3390', accountId: 'emergency', contrib: 400, autoContrib: 400, icon: '🌴', color: 'var(--indigo-500)', goalType: 'vacation', visibility: 'household', members: [], contributions: [], monthsLeft: 9, requiredPerMonth: 623, status: 'at-risk', archived: false },
    { id: 'car', name: 'New van', saved: 14800, target: 38000, pct: 39, remaining: 23200, date: 'Aug 2027', targetDate: '2027-08-31', account: 'Ally ••3390', accountId: 'emergency', contrib: 600, autoContrib: 600, icon: '🚐', color: 'var(--amber-500)', goalType: 'car', visibility: 'household', members: [], contributions: [], monthsLeft: 14, requiredPerMonth: 1658, status: 'at-risk', archived: false },
    { id: 'mission', name: 'Mission fund — Caleb', saved: 6200, target: 12000, pct: 52, remaining: 5800, date: '2028', targetDate: '2028-01-31', account: 'Ally ••3390', accountId: 'emergency', contrib: 250, autoContrib: 250, icon: '✈️', color: 'var(--green-600)', goalType: 'sinking', visibility: 'private', members: [], contributions: [], monthsLeft: 20, requiredPerMonth: 290, status: 'on-track', archived: false },
  ],
  savingsStats: { totalSaved: 72600, totalSavedDisplay: '$72,600', monthlyContrib: 2450, monthlyContribDisplay: '$2,450', activeCount: 4, onTrackCount: 2 },

  digest: { cadence: 'monthly', enabled: true, ownerEnabled: true, membersEnabled: true, nextRunLabel: 'Next · Jul 1', emailConfigured: false },

  // Member "Spendable" home (server-computed live; this is the mock/demo default
  // so the member view renders without a DB). Null in emptyData().
  memberHome: {
    memberId: 'sarah',
    name: 'Sarah',
    allowance: 400,
    allowanceLabel: '$400',
    monthLabel: 'June',
    prevMonthLabel: 'May',
    managedAccounts: [
      { id: 'sarah-wallet', name: "Sarah's wallet", label: "Sarah's wallet ••1192", type: 'checking', mask: '1192', balance: 318.42, balanceLabel: '$318.42', spark: [180, 240, 205, 290, 260, 318], total: 8, reviewed: 3, remaining: 5, done: false },
    ],
    spendTrend: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], values: [120, 185, 95, 240, 160, 215] },
    spent: 215,
    spentLabel: '$215.00',
    remaining: 185,
    remainingLabel: '$185.00',
    spentPrevMonth: 160,
    spentPrevMonthLabel: '$160',
    categoriesMonth: [
      { categoryId: 'shopping', name: 'Shopping', color: 'var(--indigo-500)', value: 96, display: '$96' },
      { categoryId: 'dining', name: 'Dining', color: 'var(--amber-500)', value: 64, display: '$64' },
      { categoryId: 'entertainment', name: 'Fun', color: 'var(--green-500)', value: 35, display: '$35' },
      { categoryId: '__other__', name: 'Everything else', color: 'var(--gray-500)', value: 20, display: '$20' },
    ],
    totalRemaining: 5,
    allCaughtUp: false,
    prevMonthRemaining: 0,
    allowanceUnlocked: true,
    celebrationStyle: 'spicy',
    // Unreviewed txns drive the Review tab (one-at-a-time mode) and resolve
    // the bulkGroups ids above for the by-merchant drill-in.
    reviewQueue: [
      { id: 101, date: 'Jun 8', merchant: 'Cash App', description: 'CASH APP *JOHN SMITH 8009691940 CA', cat: 'Uncategorized', color: 'var(--gray-500)', categoryId: null, account: "Sarah's wallet", accountId: 'sarah-wallet', amt: -25.00, reviewed: false },
      { id: 102, date: 'Jun 6', merchant: 'Cash App', description: 'CASH APP *MARI PIANO LESSONS 8009691940 CA', cat: 'Uncategorized', color: 'var(--gray-500)', categoryId: null, account: "Sarah's wallet", accountId: 'sarah-wallet', amt: -40.00, reviewed: false },
      { id: 103, date: 'Jun 7', merchant: 'Check', description: 'CHECK #1043 — YARD SERVICE', cat: 'Uncategorized', color: 'var(--gray-500)', categoryId: null, account: "Sarah's wallet", accountId: 'sarah-wallet', amt: -120.00, reviewed: false },
      { id: 104, date: 'May 28', merchant: 'Check', description: 'CHECK #1042', cat: 'Uncategorized', color: 'var(--gray-500)', categoryId: null, account: "Sarah's wallet", accountId: 'sarah-wallet', amt: -45.00, reviewed: false },
      { id: 105, date: 'May 20', merchant: 'Check', description: 'CHECK #1041 — PIANO RECITAL FEE', cat: 'Uncategorized', color: 'var(--gray-500)', categoryId: null, account: "Sarah's wallet", accountId: 'sarah-wallet', amt: -60.00, reviewed: false },
    ],
    // Same txn ids as the household list — receipt suggestions reference them.
    activity: [
      { id: 101, date: 'Jun 8', merchant: 'Cash App', description: 'CASH APP *JOHN SMITH 8009691940 CA', cat: 'Uncategorized', color: 'var(--gray-500)', categoryId: null, account: "Sarah's wallet", accountId: 'sarah-wallet', amt: -25.00, reviewed: false },
      { id: 103, date: 'Jun 7', merchant: 'Check', description: 'CHECK #1043 — YARD SERVICE', cat: 'Uncategorized', color: 'var(--gray-500)', categoryId: null, account: "Sarah's wallet", accountId: 'sarah-wallet', amt: -120.00, reviewed: false },
      { id: 102, date: 'Jun 6', merchant: 'Cash App', description: 'CASH APP *MARI PIANO LESSONS 8009691940 CA', cat: 'Uncategorized', color: 'var(--gray-500)', categoryId: null, account: "Sarah's wallet", accountId: 'sarah-wallet', amt: -40.00, reviewed: false },
      { id: 1, date: 'Jun 4', merchant: 'Harmons Grocery', cat: 'Groceries', color: 'var(--indigo-500)', account: "Sarah's wallet", accountId: 'sarah-wallet', amt: -84.21, reviewed: true, receiptId: 'mock-receipt-1' },
      { id: 3, date: 'Jun 3', merchant: 'Chick-fil-A', cat: 'Dining', color: 'var(--amber-500)', account: "Sarah's wallet", accountId: 'sarah-wallet', amt: -18.75, reviewed: true },
      { id: 5, date: 'Jun 2', merchant: 'Target', cat: 'Shopping', color: 'var(--green-600)', account: "Sarah's wallet", accountId: 'sarah-wallet', amt: -36.40, reviewed: true },
      { id: 104, date: 'May 28', merchant: 'Check', description: 'CHECK #1042', cat: 'Uncategorized', color: 'var(--gray-500)', categoryId: null, account: "Sarah's wallet", accountId: 'sarah-wallet', amt: -45.00, reviewed: false },
      { id: 105, date: 'May 20', merchant: 'Check', description: 'CHECK #1041 — PIANO RECITAL FEE', cat: 'Uncategorized', color: 'var(--gray-500)', categoryId: null, account: "Sarah's wallet", accountId: 'sarah-wallet', amt: -60.00, reviewed: false },
    ],
    // Receipts this member can see (own uploads + managed-account matches).
    receipts: [], // filled below — references the top-level receipts array
  },

  notifications: [
    { id: 1, type: 'transfers', icon: 'transfers', tone: 'accent', title: 'Transfers ready', body: '$4,000 income arrived — 5 transfers totaling $4,000 are ready to send.', time: 'Just now', unread: true, entityType: 'route', entityId: 'transfers' },
    { id: 6, type: 'large-charge', icon: 'flag', tone: 'warning', title: 'Large charge · $36.40', body: 'Target — posted at Amex ••3008.', time: '2d ago', unread: true, entityType: 'transaction', entityId: '5' },
    { id: 2, type: 'bill', icon: 'repeat', tone: 'warning', title: 'Bill amount changed', body: 'Rocky Mountain Power is $142.66 this month, up $22 from May.', time: '2h ago', unread: true, entityType: 'transaction', entityId: '4' },
    { id: 7, type: 'new-transactions', icon: 'list', tone: 'info', title: '3 new transactions', body: '$139.36 in spending synced from Amex ••3008.', time: '3h ago', unread: true, entityType: 'transaction-group', entityId: '1,3,5' },
    { id: 8, type: 'categorize-nudge', icon: 'list', tone: 'accent', title: '2 new transactions to categorize', body: "New activity on Sarah's wallet. Tap to review and confirm.", time: '4h ago', unread: true, entityType: 'account', entityId: 'sarah-wallet' },
    { id: 4, type: 'budget', icon: 'pie', tone: 'negative', title: 'Allowance overspent', body: "Rebecca is $0 left with 22 days to go in June.", time: 'Yesterday', unread: false, entityType: 'route', entityId: 'overview' },
    { id: 5, type: 'income', icon: 'trendingUp', tone: 'warning', title: 'Income looks late', body: 'Basement rental ($1,100) was expected Jun 3 and hasn’t arrived.', time: 'Yesterday', unread: false, entityType: 'route', entityId: 'income' },
  ],

  notifRules: [
    { id: 1, name: 'Any charge over $100', detail: 'All accounts · notify Jared', channels: 'Push · Email', on: true },
    { id: 2, name: 'New subscription detected', detail: 'All accounts · notify Jared', channels: 'Push', on: true },
    { id: 3, name: 'Allowance over budget', detail: 'Each member · notify owner + member', channels: 'Push', on: true },
    { id: 4, name: 'Income missing > 2 days', detail: 'All income streams', channels: 'Email', on: true },
    { id: 5, name: "Sarah's charges over $35", detail: 'Amex ••3008 · notify Jared', channels: 'Push', on: false },
  ],

  ask: {
    prompts: [
      'Where can we cut $300/month?',
      'How much did we spend on dining?',
      'Are we on track for tithing this year?',
      'What changed in our bills this month?',
    ],
    messages: [
      { role: 'user', text: 'How much did we spend on dining last month, and is it trending up?' },
      { role: 'ai', text: 'You spent $680 on dining in May — up 60% from your 3-month average of $425. Most of it ($410) was weekend takeout.', chart: 'dining' },
      { role: 'ai', text: 'If you cap dining at $450, you’d free up about $230/month. Want me to set that budget and route the difference to your Hawaii goal?' },
    ],
  },

  permissions: {
    member: 'Sarah',
    areas: [
      { name: 'Spendable view', view: true, edit: false, locked: true },
      { name: 'Shared budgets', view: true, edit: false },
      { name: 'Receipts', view: true, edit: true },
      { name: 'Accounts', view: false, edit: false },
      { name: 'Transfers', view: false, edit: false },
      { name: 'Allocations', view: false, edit: false },
    ],
    accounts: [
      { name: "Sarah's wallet", view: true, edit: true },
      { name: 'Main Checking', view: false, edit: false },
      { name: 'Emergency Fund', view: false, edit: false },
      { name: 'Amex Everyday', view: true, edit: false },
    ],
  },

  receiptItems: [
    { item: 'Organic bananas', qty: 2, unit: 1.18, total: 2.36 },
    { item: 'Whole milk, 1 gal', qty: 1, unit: 3.98, total: 3.98 },
    { item: 'Chicken breast', qty: 1, unit: 11.42, total: 11.42 },
    { item: 'Sourdough bread', qty: 2, unit: 4.49, total: 8.98 },
    { item: 'Eggs, 18 ct', qty: 1, unit: 5.29, total: 5.29 },
    { item: 'Spinach', qty: 1, unit: 3.18, total: 3.18 },
  ],
};

// Sarah uploaded both mock receipts, so her member home sees them all.
MOCK_FINANCE_DATA.memberHome.receipts = MOCK_FINANCE_DATA.receipts;
