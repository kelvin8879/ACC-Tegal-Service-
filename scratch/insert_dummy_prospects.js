const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local
const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();

const supabase = createClient(url, key);

// Agung's ID from database query
const agungId = '9fc641bb-9bad-4ea5-aebd-8396f8403b60';

async function run() {
  try {
    console.log('Inserting dummy prospects for Agung...');
    
    // Calculate dates in WIB (UTC+7)
    // 3 days ago from today (June 30) is June 27
    const date3DaysAgo = new Date('2026-06-27T03:00:00.000Z'); // 10:00 AM WIB
    
    // 7 days ago from today (June 30) is June 23
    const date7DaysAgo = new Date('2026-06-23T03:00:00.000Z'); // 10:00 AM WIB

    const dummyProspects = [
      {
        officer_id: agungId,
        nama: 'Customer Uji Coba 3 Hari',
        pengajuan: 'Top Up',
        alamat: 'Jl. Pemuda No. 3, Tegal',
        pipeline: 'Prospek',
        status: 'Open',
        created_at: date3DaysAgo.toISOString(),
        note: 'Ini prospek uji coba berumur 3 hari.'
      },
      {
        officer_id: agungId,
        nama: 'Customer Uji Coba 7 Hari',
        pengajuan: 'Non Top Up',
        alamat: 'Jl. Pemuda No. 7, Tegal',
        pipeline: 'Prospek',
        status: 'Open',
        created_at: date7DaysAgo.toISOString(),
        note: 'Ini prospek uji coba berumur 7 hari.'
      }
    ];

    const { data, error } = await supabase
      .from('prospects')
      .insert(dummyProspects)
      .select();

    if (error) throw error;

    console.log('SUCCESS! Dummy prospects inserted:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('ERROR inserting prospects:', err.message);
  }
}

run();
