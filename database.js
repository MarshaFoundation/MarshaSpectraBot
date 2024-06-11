const { Pool } = require('pg');
require('dotenv').config();

// Configurar la conexión a la base de datos PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function getUserLocale(chatId) {
    try {
        const res = await pool.query('SELECT locale FROM users WHERE chat_id = $1', [chatId]);
        if (res.rows.length > 0) {
            return res.rows[0].locale;
        } else {
            return 'es';
        }
    } catch (error) {
        console.error('Error al obtener el idioma del usuario:', error);
        return 'es';
    }
}

// Función para actualizar/guardar el idioma del usuario en la base de datos
async function setUserLocale(chatId, locale) {
    try {
        await pool.query('INSERT INTO users (chat_id, locale) VALUES ($1, $2) ON CONFLICT (chat_id) DO UPDATE SET locale = $2', [chatId, locale]);
    } catch (error) {
        console.error('Error al configurar el idioma del usuario:', error);
    }
}

module.exports = {
    getUserLocale,
    setUserLocale,
};
