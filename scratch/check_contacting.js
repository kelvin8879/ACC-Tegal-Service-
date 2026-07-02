const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();

const supabase = createClient(url, key);

async function testInsert() {
  const { data, error } = await supabase.from('contacting').insert([
    { call_count: 0, blasting_count: 0, contacted_count: 0 }
  ]).select();
  if (error) {
    console.error('Insert error:', error.message, error.code);
  } else {
    console.log('Insert success!', data);
    // clean up
    if (data && data[0]) {
      await supabase.from('contacting').delete().eq('id', data[0].id);
    }
  }
}
testInsert();
