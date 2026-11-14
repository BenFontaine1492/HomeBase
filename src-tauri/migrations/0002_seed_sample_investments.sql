-- Sample data so a fresh installation shows a representative dashboard.
-- Runs exactly once (tracked in _sqlx_migrations); users may delete these rows.
INSERT INTO investments (title, description, estimated_cost_cents, priority, sort_order) VALUES
    ('Heat pump replacement', 'Replace the 20-year-old gas boiler with an air-source heat pump', 1850000, 'high', 1),
    ('Solar panel system',    '9.8 kWp rooftop installation including battery storage',          1420000, 'high', 2),
    ('Kitchen renovation',    'New countertops, induction hob and energy-efficient appliances',   920000, 'medium', 3),
    ('Window insulation',     'Triple-glazed windows for the upper floor',                        640000, 'medium', 4),
    ('Garden irrigation',     'Automated drip irrigation for the vegetable beds',                  85000, 'low', 5);
