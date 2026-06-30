-- Create Officers Table
CREATE TABLE IF NOT EXISTS officers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    pin TEXT NOT NULL, -- 4 digit PIN or Password
    email TEXT, -- Added for email reminders
    division TEXT DEFAULT 'Operation', -- Added for division filter (Operation / PE / Cabang)
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
DROP POLICY IF EXISTS "Allow public read access on officers" ON officers;
DROP POLICY IF EXISTS "Allow public insert access on officers" ON officers;
DROP POLICY IF EXISTS "Allow public update access on officers" ON officers;
DROP POLICY IF EXISTS "Allow public delete access on officers" ON officers;
CREATE POLICY "Allow public read access on officers" ON officers FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on officers" ON officers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on officers" ON officers FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on officers" ON officers FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read access on prospects" ON prospects;
DROP POLICY IF EXISTS "Allow public insert access on prospects" ON prospects;
DROP POLICY IF EXISTS "Allow public update access on prospects" ON prospects;
DROP POLICY IF EXISTS "Allow public delete access on prospects" ON prospects;
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
INSERT INTO officers (name, pin, email, division) VALUES 
('Mayfanny', 'May123', NULL, 'Operation'),
('Livia', 'Livi123', NULL, 'Operation'),
('Dian', 'Dian123', NULL, 'Operation'),
('Dani', 'Dani123', NULL, 'Operation'),
('Agung', 'Agung123', NULL, 'Operation'),
('Vivi', 'Vivi123', NULL, 'Operation'),
('Kiki', 'Kiki123', NULL, 'Operation'),
('Husni', 'Husni123', NULL, 'Operation'),
('Banu', 'Banu123', NULL, 'Operation'),
('Dwi', 'Dwi123', NULL, 'Operation'),
-- PE Team
('Zakia', 'zakia123', 'zakiatuisma@gmail.com', 'PE'),
('Arsy', 'Arsy5758', 'arsyariadeni30@gmail.com', 'PE'),
('Dyah', 'Dyah987', 'dyahayu1533@gmail.com', 'PE'),
('Syahrul', 'Syahrul1928', 'syahrulkhasani3@gmail.com', 'PE'),
('Asep', 'Asep0801', 'asepfathur6@gmail.com', 'PE'),
-- Cabang Team
('Oby', 'Tanyasales2026', 'obytrikhakim@gmail.com', 'Cabang'),
('Deni', 'KECILSEMUA', 'rsydden@gmail.com', 'Cabang'),
('Daffa', 'Arabkesasar20', 'dfffdllh20@gmail.com', 'Cabang'),
('Candra', 'Indonesiaemas26', 'candradiwijaya05@gmail.com', 'Cabang'),
('Jildan', 'Atursendiri69', 'jildanra@gmail.com', 'Cabang'),
('Doni', 'Doniramdhani18@', 'doniramdhani1831@gmail.com', 'Cabang')
ON CONFLICT (name) DO UPDATE SET pin = EXCLUDED.pin, email = EXCLUDED.email, division = EXCLUDED.division;

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
DROP POLICY IF EXISTS "Allow public read access on contacting" ON contacting;
DROP POLICY IF EXISTS "Allow public insert access on contacting" ON contacting;
DROP POLICY IF EXISTS "Allow public update access on contacting" ON contacting;
DROP POLICY IF EXISTS "Allow public delete access on contacting" ON contacting;
CREATE POLICY "Allow public read access on contacting" ON contacting FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on contacting" ON contacting FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on contacting" ON contacting FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on contacting" ON contacting FOR DELETE USING (true);

-- Create Coordinators Table
CREATE TABLE IF NOT EXISTS coordinators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('master', 'operation', 'pe', 'cabang')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE coordinators ENABLE ROW LEVEL SECURITY;

-- Public read/write policies for MVP simplicity
DROP POLICY IF EXISTS "Allow public read access on coordinators" ON coordinators;
DROP POLICY IF EXISTS "Allow public insert access on coordinators" ON coordinators;
DROP POLICY IF EXISTS "Allow public update access on coordinators" ON coordinators;
DROP POLICY IF EXISTS "Allow public delete access on coordinators" ON coordinators;
CREATE POLICY "Allow public read access on coordinators" ON coordinators FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on coordinators" ON coordinators FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on coordinators" ON coordinators FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on coordinators" ON coordinators FOR DELETE USING (true);

-- Seed Initial Coordinators
INSERT INTO coordinators (email, password, role) VALUES
('mgutegal@gmail.com', 'MGU100', 'master'),
('adilasesilia@gmail.com', 'Adila123', 'operation'),
('milleniatercia@gmail.com', 'Makassar88', 'pe'),
('yosiyanandas@gmail.com', 'Lautanbiru21', 'cabang')
ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, role = EXCLUDED.role;

