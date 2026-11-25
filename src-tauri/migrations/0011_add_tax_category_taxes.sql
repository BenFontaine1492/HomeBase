-- A default tax category for taxes and fees the household pays (e.g. Grundsteuer,
-- Kfz-Steuer, Müllgebühren), so they can be exported for the tax advisor like
-- other costs. DEFAULT_TAX_CATEGORIES in src/types/tax-category.ts holds the same
-- entry. HomeBase gives no tax advice: the category only groups costs.
--
-- It goes before 'Sonstiges' ("other" stays last), or at the end when the user
-- has renamed or deleted that one. Nothing happens if a category with this name
-- exists already (names are unique, case-insensitive).

UPDATE tax_categories
   SET sort_order = sort_order + 1
 WHERE sort_order >= (SELECT sort_order FROM tax_categories WHERE name = 'Sonstiges')
   AND NOT EXISTS (SELECT 1 FROM tax_categories WHERE name = 'Steuern und Abgaben');

INSERT INTO tax_categories (name, records_labour_cost, sort_order)
SELECT 'Steuern und Abgaben', 0,
       coalesce(
           (SELECT sort_order - 1 FROM tax_categories WHERE name = 'Sonstiges'),
           (SELECT coalesce(max(sort_order) + 1, 0) FROM tax_categories)
       )
 WHERE NOT EXISTS (SELECT 1 FROM tax_categories WHERE name = 'Steuern und Abgaben');
