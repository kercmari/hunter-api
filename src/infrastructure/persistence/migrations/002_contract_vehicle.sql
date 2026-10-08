ALTER TABLE contracts ADD COLUMN IF NOT EXISTS vehicle JSONB;
CREATE INDEX IF NOT EXISTS contracts_tax_vehicle_idx ON contracts (tax_id, (upper(vehicle->>'placa')));
