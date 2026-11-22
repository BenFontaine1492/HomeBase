-- Maintenance costs move into the general costs table (0009): the cost of a
-- maintenance record becomes a cost row of type 'maintenance' linked to it
-- (one per record; it goes with the record, ON DELETE CASCADE). The "Mark as done"
-- dialog keeps its cost field and writes that row. The paid date and the payee
-- follow the record; the tax fields are edited on the Costs page.
--
-- The dashboard's "Maintenance costs" widget becomes the general "Costs" widget,
-- showing only maintenance costs as before (its new cost type setting).

INSERT INTO costs (paid_date, amount_cents, cost_type, payee, maintenance_record_id, created_at, updated_at)
SELECT date, cost_cents, 'maintenance', provider, id, created_at, updated_at
  FROM maintenance_records
 WHERE cost_cents IS NOT NULL;

ALTER TABLE maintenance_records DROP COLUMN cost_cents;

UPDATE dashboard_widgets
   SET widget_type = 'costs',
       settings = json_set(settings, '$.costType', 'maintenance')
 WHERE widget_type = 'maintenance-costs';
