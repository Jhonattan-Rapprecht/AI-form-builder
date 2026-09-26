const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const databaseName = process.env.DB_NAME || 'ai_formbuilder';
const expectedTables = [
  'organizations',
  'users',
  'organization_memberships',
  'platform_roles',
  'user_platform_roles',
  'auth_identities'
];

const expectedConstraints = {
  uq_organizations_slug: 'UNIQUE',
  uq_users_email: 'UNIQUE',
  uq_organization_memberships_org_user: 'UNIQUE',
  fk_organization_memberships_organization: 'FOREIGN KEY',
  fk_organization_memberships_user: 'FOREIGN KEY',
  uq_platform_roles_code: 'UNIQUE',
  uq_user_platform_roles_user_role: 'UNIQUE',
  fk_user_platform_roles_user: 'FOREIGN KEY',
  fk_user_platform_roles_platform_role: 'FOREIGN KEY',
  uq_auth_identities_provider_subject: 'UNIQUE',
  fk_auth_identities_user: 'FOREIGN KEY'
};

const createTables = [
  `CREATE TABLE IF NOT EXISTS organizations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_organizations_slug (slug),
    KEY ix_organizations_status (status)
  ) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    first_name VARCHAR(100) NULL,
    last_name VARCHAR(100) NULL,
    email VARCHAR(254) NOT NULL,
    password_hash VARCHAR(255) NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'INVITED',
    email_verified_at TIMESTAMP NULL DEFAULT NULL,
    last_login_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email),
    KEY ix_users_status (status)
  ) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS organization_memberships (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organization_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    role VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_organization_memberships_org_user (organization_id, user_id),
    KEY ix_organization_memberships_user (user_id),
    CONSTRAINT chk_organization_memberships_role CHECK (role IN ('ADMIN', 'USER', 'GUEST')),
    CONSTRAINT fk_organization_memberships_organization
      FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
    CONSTRAINT fk_organization_memberships_user
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS platform_roles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    role_code VARCHAR(64) NOT NULL,
    description VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_platform_roles_code (role_code)
  ) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS user_platform_roles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    platform_role_id BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_user_platform_roles_user_role (user_id, platform_role_id),
    KEY ix_user_platform_roles_platform_role (platform_role_id),
    CONSTRAINT fk_user_platform_roles_user
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_user_platform_roles_platform_role
      FOREIGN KEY (platform_role_id) REFERENCES platform_roles (id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS auth_identities (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    provider VARCHAR(32) NOT NULL,
    provider_subject VARCHAR(255) NOT NULL,
    provider_email VARCHAR(254) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_auth_identities_provider_subject (provider, provider_subject),
    KEY ix_auth_identities_user (user_id),
    KEY ix_auth_identities_provider_email (provider, provider_email),
    CONSTRAINT fk_auth_identities_user
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
];

async function initializeDatabase() {
  if (!Object.prototype.hasOwnProperty.call(process.env, 'DB_PASSWORD')) {
    throw new Error('DB_PASSWORD is not set in .env.');
  }

  let bootstrapConnection;
  let pool;

  try {
    bootstrapConnection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD
    });

    await bootstrapConnection.query(
      `CREATE DATABASE IF NOT EXISTS ${mysql.escapeId(databaseName)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await bootstrapConnection.end();
    bootstrapConnection = null;

    pool = require('../config/database');

    for (const statement of createTables) {
      await pool.query(statement);
    }

    await pool.query(
      `INSERT INTO platform_roles (role_code, description)
       VALUES ('SUPER_ADMIN', 'Platform-level administrator')
       ON DUPLICATE KEY UPDATE role_code = VALUES(role_code)`
    );

    const [tableRows] = await pool.query(
      `SELECT table_name, engine
       FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name IN (?)`,
      [expectedTables]
    );
    const tables = new Map(tableRows.map(row => [row.TABLE_NAME || row.table_name, row.ENGINE || row.engine]));
    const missingTables = expectedTables.filter(table => !tables.has(table));
    const nonInnoDbTables = expectedTables.filter(table => tables.get(table) !== 'InnoDB');

    const constraintNames = Object.keys(expectedConstraints);
    const [constraintRows] = await pool.query(
      `SELECT constraint_name, constraint_type
       FROM information_schema.table_constraints
       WHERE table_schema = DATABASE() AND constraint_name IN (?)`,
      [constraintNames]
    );
    const constraints = new Map(
      constraintRows.map(row => [
        row.CONSTRAINT_NAME || row.constraint_name,
        row.CONSTRAINT_TYPE || row.constraint_type
      ])
    );
    const missingConstraints = Object.entries(expectedConstraints)
      .filter(([name, type]) => constraints.get(name) !== type)
      .map(([name]) => name);

    if (missingTables.length || nonInnoDbTables.length || missingConstraints.length) {
      throw new Error('Schema verification failed.');
    }

    const [testRows] = await pool.query('SELECT 1 AS connected');
    if (testRows[0].connected !== 1) {
      throw new Error('Database query verification failed.');
    }

    console.log(`Database initialized and verified: ${databaseName}`);
    console.log(`Tables: ${expectedTables.join(', ')}`);
    console.log(`Verified ${constraintNames.length} unique and foreign-key constraints.`);
    console.log('Query test passed (SELECT 1).');
    console.log('Seeded platform role definition: SUPER_ADMIN (no user created).');
  } finally {
    if (bootstrapConnection) {
      await bootstrapConnection.end();
    }
    if (pool) {
      await pool.end();
    }
  }
}

initializeDatabase().catch(error => {
  console.error(`Database initialization failed${error.code ? ` (${error.code})` : ''}.`);
  if (error.message === 'DB_PASSWORD is not set in .env.') {
    console.error(error.message);
  } else if (error.message === 'Schema verification failed.') {
    console.error('One or more expected tables or named constraints could not be verified.');
  } else if (error.message === 'Database query verification failed.') {
    console.error(error.message);
  }
  process.exitCode = 1;
});