-- Taxes and fees (e.g. Grundsteuer, Kfz-Steuer) are marked by the cost type 'tax'
-- alone, not by a tax category as well: the export for the tax advisor puts them in
-- a group of their own ("Steuern und Abgaben"). A cost or rule of type 'tax' has no
-- tax category and no labour share (CostValues / RecurringCostValues check it).
--
-- This undoes the category of 0011: what was filed under it becomes type 'tax',
-- and the category is removed.

UPDATE costs
   SET cost_type = 'tax'
 WHERE tax_category_id IN (SELECT id FROM tax_categories WHERE name = 'Steuern und Abgaben');

UPDATE recurring_costs
   SET cost_type = 'tax'
 WHERE tax_category_id IN (SELECT id FROM tax_categories WHERE name = 'Steuern und Abgaben');

UPDATE costs
   SET tax_category_id = NULL, labour_cents = NULL
 WHERE cost_type = 'tax';

UPDATE recurring_costs
   SET tax_category_id = NULL, labour_cents = NULL
 WHERE cost_type = 'tax';

DELETE FROM tax_categories WHERE name = 'Steuern und Abgaben';
