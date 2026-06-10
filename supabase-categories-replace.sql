-- =============================================================
-- Zitting Finance — replace the category taxonomy with the household chart.
-- SURGICAL: upserts the new groups/categories, repoints anything that pointed
-- at an old category to Uncategorized (so no FK breaks / no data loss), then
-- deletes the old chart. Does NOT touch accounts, transaction amounts, or
-- budget amounts. Run in Supabase SQL Editor. Idempotent (safe to re-run).
--
-- NOTE: the cleanup is one DO block (array vars, no temp tables) so it works
-- even when the SQL editor autocommits each statement.
-- =============================================================

-- 1) Upsert the new groups -------------------------------------------------
INSERT INTO category_groups (id, name, sort_order) VALUES
('income', 'Income', 0),
('automobile', 'Automobile', 1),
('babysitting', 'Babysitting/Day Care', 2),
('charitable', 'Charitable Contributions', 3),
('groceries-household', 'Groceries & Household', 4),
('home-yard-improvements', 'Home/Yard Improvements', 5),
('insurance', 'Insurance', 6),
('interest-fees', 'Interest, Fees & Finance Charges', 7),
('maintenance-home', 'Maintenance & Repairs (Home/Yard)', 8),
('miscellaneous', 'Miscellaneous', 9),
('taxes', 'Taxes', 10),
('travel-entertainment', 'Travel & Entertainment', 11),
('rent', 'Rent', 12),
('small-tools', 'Small Tools/Yard Equipment', 13),
('utilities', 'Utilities', 14),
('transfers', 'Transfers', 15),
('other', 'Other', 16)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

-- 2) Upsert the new categories --------------------------------------------
INSERT INTO categories (id, name, group_id, color, icon, kind, exclude_from_budget, sort_order) VALUES
('income-paycheck', 'Paycheck', 'income', 'var(--green-500)', 'trendingUp', 'income', FALSE, 0),
('income-self-employment', 'Self-Employment', 'income', 'var(--indigo-500)', 'dollar', 'income', FALSE, 1),
('income-other', 'Other income', 'income', 'var(--amber-500)', 'dollar', 'income', FALSE, 2),
('auto-fuel', 'Fuel', 'automobile', 'var(--green-600)', 'transfers', 'expense', FALSE, 0),
('auto-maintenance', 'Maintenance & Repairs', 'automobile', 'var(--indigo-400)', 'transfers', 'expense', FALSE, 1),
('auto-insurance', 'Insurance', 'automobile', 'var(--green-400)', 'transfers', 'expense', FALSE, 2),
('auto-other', 'Other', 'automobile', 'var(--gray-500)', 'transfers', 'expense', FALSE, 3),
('babysitting', 'Babysitting/Day Care', 'babysitting', 'var(--green-500)', 'users', 'expense', FALSE, 0),
('charitable-tithing', 'Tithing', 'charitable', 'var(--indigo-500)', 'dollar', 'expense', FALSE, 0),
('charitable-united-order', 'United Order', 'charitable', 'var(--amber-500)', 'dollar', 'expense', FALSE, 1),
('charitable-priesthood', 'Addl. Priesthood Contr. (Clinic, AAT, Lights)', 'charitable', 'var(--green-600)', 'dollar', 'expense', FALSE, 2),
('charitable-other', 'Other', 'charitable', 'var(--indigo-400)', 'dollar', 'expense', FALSE, 3),
('groc-basic-american', 'Basic American Supply', 'groceries-household', 'var(--green-400)', 'list', 'expense', FALSE, 0),
('groc-bees', 'Bee''s Marketplace', 'groceries-household', 'var(--gray-500)', 'list', 'expense', FALSE, 1),
('groc-sunset-farms', 'Sunset Farms', 'groceries-household', 'var(--green-500)', 'list', 'expense', FALSE, 2),
('groc-costco-walmart', 'Costco/Walmart', 'groceries-household', 'var(--indigo-500)', 'list', 'expense', FALSE, 3),
('groc-health-food', 'Health Food Stores', 'groceries-household', 'var(--amber-500)', 'list', 'expense', FALSE, 4),
('groc-other', 'Other', 'groceries-household', 'var(--green-600)', 'list', 'expense', FALSE, 5),
('home-yard-improvements', 'Home/Yard Improvements', 'home-yard-improvements', 'var(--indigo-400)', 'wallet', 'expense', FALSE, 0),
('ins-health', 'Health', 'insurance', 'var(--green-400)', 'target', 'expense', FALSE, 0),
('ins-home', 'Home', 'insurance', 'var(--gray-500)', 'target', 'expense', FALSE, 1),
('ins-life', 'Life', 'insurance', 'var(--green-500)', 'target', 'expense', FALSE, 2),
('ins-other', 'Other (Licenses)', 'insurance', 'var(--indigo-500)', 'target', 'expense', FALSE, 3),
('interest-fees', 'Interest, Fees & Finance Charges', 'interest-fees', 'var(--amber-500)', 'creditCard', 'expense', FALSE, 0),
('maint-basic-american', 'Basic American Supply', 'maintenance-home', 'var(--green-600)', 'settings', 'expense', FALSE, 0),
('maint-other', 'Other', 'maintenance-home', 'var(--indigo-400)', 'settings', 'expense', FALSE, 1),
('misc-children-activities', 'Children''s Activities', 'miscellaneous', 'var(--green-400)', 'grid', 'expense', FALSE, 0),
('misc-clothing', 'Clothing', 'miscellaneous', 'var(--gray-500)', 'grid', 'expense', FALSE, 1),
('misc-community', 'Community Functions/Activities', 'miscellaneous', 'var(--green-500)', 'grid', 'expense', FALSE, 2),
('misc-dental', 'Dental', 'miscellaneous', 'var(--indigo-500)', 'grid', 'expense', FALSE, 3),
('misc-education', 'Education (Tuition, Books, etc.)', 'miscellaneous', 'var(--amber-500)', 'grid', 'expense', FALSE, 4),
('misc-medical', 'Medical', 'miscellaneous', 'var(--green-600)', 'grid', 'expense', FALSE, 5),
('misc-other', 'Other (Gifts, Personal, etc.)', 'miscellaneous', 'var(--indigo-400)', 'grid', 'expense', FALSE, 6),
('tax-income', 'Income', 'taxes', 'var(--green-400)', 'receipt', 'expense', FALSE, 0),
('tax-property', 'Property', 'taxes', 'var(--gray-500)', 'receipt', 'expense', FALSE, 1),
('tax-self-employment', 'Self-Employment', 'taxes', 'var(--green-500)', 'receipt', 'expense', FALSE, 2),
('tax-other', 'Other', 'taxes', 'var(--indigo-500)', 'receipt', 'expense', FALSE, 3),
('te-entertainment-local', 'Entertainment (local)', 'travel-entertainment', 'var(--amber-500)', 'sparkles', 'expense', FALSE, 0),
('te-travel-outside', 'Travel & Entertainment (outside)', 'travel-entertainment', 'var(--green-600)', 'sparkles', 'expense', FALSE, 1),
('rent', 'Rent', 'rent', 'var(--indigo-400)', 'bank', 'expense', FALSE, 0),
('small-tools', 'Small Tools/Yard Equipment', 'small-tools', 'var(--green-400)', 'settings', 'expense', FALSE, 0),
('util-electricity', 'Electricity', 'utilities', 'var(--gray-500)', 'repeat', 'expense', FALSE, 0),
('util-gas', 'Gas', 'utilities', 'var(--green-500)', 'repeat', 'expense', FALSE, 1),
('util-phone-internet', 'Phone/Internet', 'utilities', 'var(--indigo-500)', 'repeat', 'expense', FALSE, 2),
('util-water-sewer-garbage', 'Water & Sewer & Garbage', 'utilities', 'var(--amber-500)', 'repeat', 'expense', FALSE, 3),
('transfer', 'Transfer', 'transfers', 'var(--green-600)', 'transfers', 'transfer', TRUE, 0),
('uncategorized', 'Uncategorized', 'other', 'var(--indigo-400)', 'list', 'expense', FALSE, 0)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, group_id = EXCLUDED.group_id, color = EXCLUDED.color,
  icon = EXCLUDED.icon, kind = EXCLUDED.kind,
  exclude_from_budget = EXCLUDED.exclude_from_budget, sort_order = EXCLUDED.sort_order;

-- 3) Repoint references off old categories, then delete the old chart -----
DO $$
DECLARE
  keep_cats text[] := ARRAY[
    'income-paycheck','income-self-employment','income-other',
    'auto-fuel','auto-maintenance','auto-insurance','auto-other',
    'babysitting',
    'charitable-tithing','charitable-united-order','charitable-priesthood','charitable-other',
    'groc-basic-american','groc-bees','groc-sunset-farms','groc-costco-walmart','groc-health-food','groc-other',
    'home-yard-improvements',
    'ins-health','ins-home','ins-life','ins-other',
    'interest-fees',
    'maint-basic-american','maint-other',
    'misc-children-activities','misc-clothing','misc-community','misc-dental','misc-education','misc-medical','misc-other',
    'tax-income','tax-property','tax-self-employment','tax-other',
    'te-entertainment-local','te-travel-outside',
    'rent','small-tools',
    'util-electricity','util-gas','util-phone-internet','util-water-sewer-garbage',
    'transfer','uncategorized'
  ];
  keep_groups text[] := ARRAY[
    'income','automobile','babysitting','charitable','groceries-household',
    'home-yard-improvements','insurance','interest-fees','maintenance-home',
    'miscellaneous','taxes','travel-entertainment','rent','small-tools',
    'utilities','transfers','other'
  ];
BEGIN
  UPDATE transactions SET
    category_id = 'uncategorized', category = 'Uncategorized', color = 'var(--gray-500)',
    category_source = NULL, category_confidence = NULL, reviewed = FALSE
    WHERE category_id IS NOT NULL AND NOT (category_id = ANY(keep_cats));
  UPDATE transaction_splits SET category_id = NULL
    WHERE category_id IS NOT NULL AND NOT (category_id = ANY(keep_cats));
  UPDATE budgets SET category_id = NULL
    WHERE category_id IS NOT NULL AND NOT (category_id = ANY(keep_cats));
  UPDATE categorization_rules SET category_id = NULL, enabled = FALSE
    WHERE category_id IS NOT NULL AND NOT (category_id = ANY(keep_cats));
  DELETE FROM merchant_memory
    WHERE category_id IS NOT NULL AND NOT (category_id = ANY(keep_cats));
  DELETE FROM categories WHERE NOT (id = ANY(keep_cats));
  DELETE FROM category_groups WHERE NOT (id = ANY(keep_groups));
END $$;
