const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();

const supabase = createClient(url, key);

async function checkSchema() {
  console.log('Mengecek struktur tabel contacting di Supabase...');
  
  // Try to select everything
  const { data, error } = await supabase.from('contacting').select('*').limit(1);
  
  if (error) {
    console.error('Error saat select *:', error.message);
  } else if (data && data.length > 0) {
    console.log('Berhasil mengambil data. Kolom yang tersedia:');
    console.log(Object.keys(data[0]).join(', '));
    
    if (Object.keys(data[0]).includes('contacted_count')) {
      console.log('✅ Kolom contacted_count SUDAH ADA di database.');
    } else {
      console.log('❌ Kolom contacted_count BELUM ADA di database.');
    }
  } else {
    console.log('Tabel contacting kosong, mencoba insert test dummy...');
    // Try to insert with contacted_count to see if it fails
    const { error: insertError } = await supabase.from('contacting').insert([
        { call_count: 0, blasting_count: 0, contacted_count: 0 }
    ]);
    
    if (insertError) {
      console.log('❌ Error Insert (kolom mungkin belum ada):', insertError.message);
    } else {
      console.log('✅ Berhasil insert data dengan contacted_count. Kolom SUDAH ADA.');
    }
  }
}

checkSchema();
