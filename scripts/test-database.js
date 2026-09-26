const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

if (!Object.prototype.hasOwnProperty.call(process.env, 'DB_PASSWORD')) {
  console.error('Database test not run: DB_PASSWORD is not set in .env.');
  process.exitCode = 1;
} else {
  async function testDatabaseConnection() {
    let connection;

    try {
      connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD
      });
      await connection.query('SELECT 1 AS connected');
      console.log('MariaDB connection successful (SELECT 1).');
    } catch (error) {
      console.error('MariaDB connection failed. Check that MariaDB is running and DB_* settings in .env are correct.');
      if (error.code) {
        console.error(`Error code: ${error.code}`);
      }
      process.exitCode = 1;
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }

  testDatabaseConnection();
}