const { Pool, types } = require('pg');

types.setTypeParser(1082, (val) => val);

const sslConfig = process.env.SUPABASE_CA_CERT
  ? { ca: process.env.SUPABASE_CA_CERT, rejectUnauthorized: true }
  : (() => {
      if (process.env.NODE_ENV === 'production') {
        console.warn(
          '[db] SUPABASE_CA_CERT not set — falling back to rejectUnauthorized:false. ' +
            'Download your project\'s CA cert from Supabase > Database Settings and set ' +
            'SUPABASE_CA_CERT for a verified connection before shipping this for real.'
        );
      }
      return { rejectUnauthorized: false };
    })();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
});

// This is for your database connection pool
module.exports = pool;