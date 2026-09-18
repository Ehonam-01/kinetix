-- Custom SQL migration file, put your code below! --

-- Seeds the singleton settings row so getActiveProvider (repositories/
-- payment-settings.ts) always finds a row instead of having to special-case
-- "no row yet" at every call site. Starts on MONEROO — no behavior change
-- until an admin explicitly switches it from /admin/payments.
INSERT INTO payment_settings (id, active_provider)
VALUES ('default', 'MONEROO')
ON CONFLICT (id) DO NOTHING;
