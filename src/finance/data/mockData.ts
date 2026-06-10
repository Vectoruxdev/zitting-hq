/* eslint-disable */
// Curated demo data for Zitting Finance — used as defaults/fallback and as
// the seed source. DB rows override the entity sections via getFinanceData().
// (Extracted verbatim from the design prototype's appdata.js.)
export const MOCK_FINANCE_DATA: any = {
  nav: [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'accounts', label: 'Accounts', icon: 'wallet' },
    { id: 'transactions', label: 'Transactions', icon: 'list' },
    { id: 'bulk', label: 'Tidy up', icon: 'sparkles' },
    { id: 'import', label: 'Import', icon: 'arrowDown' },
    { id: 'categories', label: 'Categories', icon: 'pie' },
    { id: 'learned', label: 'Learned', icon: 'sparkles' },
    { id: 'budgets', label: 'Budgets', icon: 'pie' },
    { id: 'income', label: 'Income', icon: 'trendingUp' },
    { id: 'bills', label: 'Bills', icon: 'repeat' },
    { id: 'transfers', label: 'Transfers', icon: 'transfers' },
    { id: 'allocations', label: 'Allocations', icon: 'allocations' },
    { id: 'savings', label: 'Savings', icon: 'target' },
    { id: 'receipts', label: 'Receipts', icon: 'receipt' },
    { id: 'ask', label: 'Ask AI', icon: 'sparkles' },
  ],

  learned: [],
  notifPrefs: [],
  bulkGroups: [],

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

  past: [
    { to: 'Tithing', from: 'Main Checking', amount: '$540.00', due: 'May 1', state: 'auto', icon: 'dollar' },
    { to: 'Bills account', from: 'Main Checking', amount: '$1,200.00', due: 'May 1', state: 'auto', icon: 'repeat' },
    { to: 'Emergency Fund', from: 'Main Checking', amount: '$980.00', due: 'May 1', state: 'done', icon: 'target' },
  ],

  txns: [
    { id: 1, date: 'Jun 4', merchant: 'Harmons Grocery', cat: 'Groceries', color: 'var(--indigo-500)', who: 'Sarah', account: 'Amex ••3008', amt: -84.21, pending: false },
    { id: 2, date: 'Jun 3', merchant: 'ADP Payroll', cat: 'Income', color: 'var(--green-500)', who: 'Jared', account: 'Main Checking', amt: 4000, income: true, pending: false },
    { id: 3, date: 'Jun 3', merchant: 'Chick-fil-A', cat: 'Dining', color: 'var(--amber-500)', who: 'Rebecca', account: 'Amex ••3008', amt: -18.75, pending: true },
    { id: 4, date: 'Jun 2', merchant: 'Rocky Mtn Power', cat: 'Utilities', color: 'var(--gray-500)', who: 'Household', account: 'Bills account', amt: -142.66, pending: false },
    { id: 5, date: 'Jun 2', merchant: 'Target', cat: 'Shopping', color: 'var(--green-600)', who: 'Sarah', account: 'Amex ••3008', amt: -36.40, pending: false, flagged: true },
    { id: 6, date: 'Jun 1', merchant: 'From the Farm', cat: 'Income', color: 'var(--green-500)', who: 'Jared', account: 'Main Checking', amt: 1250, income: true, pending: false },
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
      { id: 'sarah-wallet', name: "Sarah's wallet", label: "Sarah's wallet ••1192", total: 6, reviewed: 6, remaining: 0, done: true },
    ],
    totalRemaining: 0,
    allCaughtUp: true,
    prevMonthRemaining: 0,
    allowanceUnlocked: true,
    reviewQueue: [],
  },

  notifications: [
    { id: 1, type: 'transfers', icon: 'transfers', tone: 'accent', title: 'Transfers ready', body: '$4,000 income arrived — 5 transfers totaling $4,000 are ready to send.', time: 'Just now', unread: true },
    { id: 2, type: 'bill', icon: 'repeat', tone: 'warning', title: 'Bill amount changed', body: 'Rocky Mountain Power is $142.66 this month, up $22 from May.', time: '2h ago', unread: true },
    { id: 3, type: 'sub', icon: 'alert', tone: 'info', title: 'New subscription detected', body: 'Netflix — $22.99/mo on Amex ••3008.', time: '5h ago', unread: true },
    { id: 4, type: 'budget', icon: 'pie', tone: 'negative', title: 'Allowance overspent', body: "Rebecca is $0 left with 22 days to go in June.", time: 'Yesterday', unread: false },
    { id: 5, type: 'income', icon: 'trendingUp', tone: 'warning', title: 'Income looks late', body: 'Basement rental ($1,100) was expected Jun 3 and hasn’t arrived.', time: 'Yesterday', unread: false },
    { id: 6, type: 'txn', icon: 'flag', tone: 'warning', title: 'Large charge flagged', body: 'Target — $36.40 by Sarah was auto-flagged (over your $35 alert).', time: '2d ago', unread: false },
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
