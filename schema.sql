-- Create Officers Table
CREATE TABLE IF NOT EXISTS officers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    pin TEXT NOT NULL, -- 4 digit PIN
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Prospects Table
CREATE TABLE IF NOT EXISTS prospects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    officer_id UUID REFERENCES officers(id) ON DELETE SET NULL,
    pipeline TEXT NOT NULL CHECK (pipeline IN ('Call', 'Blasting', 'Prospek', 'Aplikasi IN', 'Aplikasi Valid')),
    pengajuan TEXT CHECK (pengajuan IN ('Top Up', 'Non Top Up')),
    nama TEXT NOT NULL,
    alamat TEXT,
    status TEXT, -- Status/progress (e.g. Open/Close for early stages, or On Progress, RE, NB, OV, DP OP for Aplikasi IN)
    progress TEXT,
    note TEXT,
    segment TEXT CHECK (segment IN ('Bronze', 'Flexi', 'Gold', 'Platinum', 'Solitaire')),
    no_reg TEXT CHECK (no_reg ~ '^[0-9]{7}$' OR no_reg IS NULL), -- 7 digit numeric registration
    date_in DATE,
    date_valid DATE,
    keterangan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE officers ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;

-- Public read/write policies for MVP simplicity
CREATE POLICY "Allow public read access on officers" ON officers FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on officers" ON officers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on officers" ON officers FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on officers" ON officers FOR DELETE USING (true);

CREATE POLICY "Allow public read access on prospects" ON prospects FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on prospects" ON prospects FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on prospects" ON prospects FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on prospects" ON prospects FOR DELETE USING (true);

-- Seed Initial Officers
INSERT INTO officers (name, pin) VALUES 
('Budi Pratama', '1234'),
('Siti Aminah', '5678'),
('Andi Wijaya', '1111')
ON CONFLICT (name) DO NOTHING;
