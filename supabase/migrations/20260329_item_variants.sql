ALTER TABLE accreditation_item_types ADD COLUMN IF NOT EXISTS variants text[];
ALTER TABLE accreditation_person_items ADD COLUMN IF NOT EXISTS selected_variant text;
