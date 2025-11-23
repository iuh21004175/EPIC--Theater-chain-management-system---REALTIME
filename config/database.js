const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DATABASE_NAME,
  process.env.DATABASE_USER,
  process.env.DATABASE_PASSWORD,
  {
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT,
    dialect: process.env.DATABASE_DRIVER,
    timezone: '+07:00', // Để Sequelize tự convert
    dialectOptions: {
      timezone: '+07:00'
    },
    define: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci'
    }
  }
);

sequelize.query("SET time_zone = '+07:00'");

module.exports = sequelize;