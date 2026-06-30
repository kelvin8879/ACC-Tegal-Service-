-- Create Officers Table
CREATE TABLE IF NOT EXISTS officers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    pin TEXT NOT NULL, -- 4 digit PIN or Password
    email TEXT, -- Added for email reminders
    division TEXT DEFAULT 'Sales C2', -- Added for division filter (Operation / Sales C2)
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
    call BOOLEAN DEFAULT false NOT NULL, -- Added to track daily Call activities
    blasting BOOLEAN DEFAULT false NOT NULL, -- Added to track daily Blasting activities
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

-- Database Size Function for RPC
CREATE OR REPLACE FUNCTION public.get_db_size()
RETURNS TABLE(size_mb NUMERIC, is_almost_full BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    db_size_bytes BIGINT;
    limit_bytes BIGINT := 1500000000; -- 500 MB in bytes
    size_mb_val NUMERIC;
BEGIN
    -- Get size of the current database
    SELECT pg_database_size(current_database()) INTO db_size_bytes;
    
    -- Convert to MB with 2 decimal places
    size_mb_val := ROUND((db_size_bytes::NUMERIC / 1024 / 1024), 2);
    
    RETURN QUERY 
    SELECT 
        size_mb_val,
        (db_size_bytes >= (limit_bytes * 0.9)); -- Almost full if >= 90% of 500 MB
END;
$$;

-- Seed Initial Officers
INSERT INTO officers (name, pin, division) VALUES 
('Budi Pratama', '1234', 'Sales C2'),
('Siti Aminah', '5678', 'Sales C2'),
('Andi Wijaya', '1111', 'Sales C2'),
('Mayfanny', 'May123', 'Operation'),
('Livia', 'Livi123', 'Operation'),
('Dian', 'Dian123', 'Operation'),
('Dani', 'Dani123', 'Operation'),
('Agung', 'Agung123', 'Operation'),
('Vivi', 'Vivi123', 'Operation'),
('Kiki', 'Kiki123', 'Operation'),
('Husni', 'Husni123', 'Operation'),
('Banu', 'Banu123', 'Operation'),
('Dwi', 'Dwi123', 'Operation')
ON CONFLICT (name) DO UPDATE SET pin = EXCLUDED.pin, division = EXCLUDED.division;

-- Create Contacting Table
CREATE TABLE IF NOT EXISTS contacting (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    officer_id UUID REFERENCES officers(id) ON DELETE CASCADE,
    call_count INTEGER DEFAULT 0 NOT NULL,
    blasting_count INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE contacting ENABLE ROW LEVEL SECURITY;

-- Public read/write policies for MVP simplicity
CREATE POLICY "Allow public read access on contacting" ON contacting FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on contacting" ON contacting FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on contacting" ON contacting FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on contacting" ON contacting FOR DELETE USING (true);

-- Create Coordinators Table
CREATE TABLE IF NOT EXISTS coordinators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('master', 'operation', 'sales_c2')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE coordinators ENABLE ROW LEVEL SECURITY;

-- Public read/write policies for MVP simplicity
CREATE POLICY "Allow public read access on coordinators" ON coordinators FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on coordinators" ON coordinators FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on coordinators" ON coordinators FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on coordinators" ON coordinators FOR DELETE USING (true);

-- Seed Initial Coordinators
INSERT INTO coordinators (email, password, role) VALUES
('admin@acc.co.id', 'admin123', 'master'),
('op@acc.co.id', 'op123', 'operation'),
('sales@acc.co.id', 'sales123', 'sales_c2')
ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, role = EXCLUDED.role;

