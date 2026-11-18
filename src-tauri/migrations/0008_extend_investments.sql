-- Investment improvements: a status (planned → purchased, with the purchase date),
-- an optional target date, budget and the amount saved so far (all in cents).
-- Keep INVESTMENT_STATUSES in src/types/investment.ts in sync with the CHECK below.
-- `date(x) IS x` rejects anything but a real 'YYYY-MM-DD' date and allows NULL.

ALTER TABLE investments ADD COLUMN status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'purchased'));
ALTER TABLE investments ADD COLUMN purchased_date TEXT CHECK (date(purchased_date) IS purchased_date);
ALTER TABLE investments ADD COLUMN target_date TEXT CHECK (date(target_date) IS target_date);
ALTER TABLE investments ADD COLUMN budget_cents INTEGER CHECK (budget_cents >= 0);
ALTER TABLE investments ADD COLUMN saved_cents INTEGER CHECK (saved_cents >= 0);

-- A purchased investment has a purchase date, a planned one has none.
CREATE TRIGGER IF NOT EXISTS investments_purchased_date_insert
BEFORE INSERT ON investments
WHEN (NEW.status = 'purchased') <> (NEW.purchased_date IS NOT NULL)
BEGIN
    SELECT RAISE(ABORT, 'purchased investments need a purchase date, planned ones none');
END;

CREATE TRIGGER IF NOT EXISTS investments_purchased_date_update
BEFORE UPDATE OF status, purchased_date ON investments
WHEN (NEW.status = 'purchased') <> (NEW.purchased_date IS NOT NULL)
BEGIN
    SELECT RAISE(ABORT, 'purchased investments need a purchase date, planned ones none');
END;
