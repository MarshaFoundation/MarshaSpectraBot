const TelegramBot = require('node-telegram-bot-api');
const i18n = require('i18n');
const wtf = require('wtf_wikipedia');
const axios = require('axios');
require('dotenv').config();
const { Pool } = require('pg');

// Verificar que las variables de entorno están cargadas correctamente
console.log('TELEGRAM_API_KEY:', process.env.TELEGRAM_API_KEY);
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY);
console.log('DATABASE_URL:', process.env.DATABASE_URL);

// Configurar la conexión a la base de datos PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const token = process.env.TELEGRAM_API_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

// Configuración de i18n
i18n.configure({
    locales: ['en', 'es'],
    directory: __dirname + '/locales',
    defaultLocale: 'es',
    queryParameter: 'lang',
    cookie: 'locale',
});

// Crear instancia del bot después de haber definido TelegramBot
const bot = new TelegramBot(token, { polling: true });
console.log('Bot iniciado correctamente');

// Función para hacer la llamada a OpenAI
const cachedResponses = new Map(); // Caché para almacenar respuestas de OpenAI

async function getChatGPTResponse(messages) {
    const messagesKey = JSON.stringify(messages);
    if (cachedResponses.has(messagesKey)) {
        return cachedResponses.get(messagesKey);
    }

    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-3.5-turbo',
            messages: messages,
            temperature: 0.7,
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiApiKey}`
            }
        });

        const gptResponse = response.data.choices[0].message.content.trim();
        cachedResponses.set(messagesKey, gptResponse);

        return gptResponse;
    } catch (error) {
        console.error('Error al llamar a OpenAI:', error);
        return 'Lo siento, actualmente no puedo procesar tu solicitud.';
    }
}

// Función para obtener el idioma del usuario desde la base de datos
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
        const res = await pool.query('INSERT INTO users (chat_id, locale) VALUES ($1, $2) ON CONFLICT (chat_id) DO UPDATE SET locale = $2', [chatId, locale]);
    } catch (error) {
        console.error('Error al configurar el idioma del usuario:', error);
    }
}

// Escuchar el evento de inicio (/start)
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const opts = {
        reply_markup: JSON.stringify({
            inline_keyboard: [
                [{ text: '🇬🇧 English', callback_data: 'en' }],
                [{ text: '🇪🇸 Español', callback_data: 'es' }],
            ],
        }),
    };

    // Verificar si es la primera interacción con el bot
    const isFirstInteraction = await checkFirstInteraction(chatId);
    if (isFirstInteraction) {
        // Obtener idioma del usuario
        const locale = await getUserLocale(chatId);
        i18n.setLocale(locale);

        // Enviar mensaje de bienvenida
        const welcomeMessage = "¡Hola! ¡Qué gusto tenerte por aquí! Mi nombre es SilvIA, una IA avanzada propiedad de Marsha+ Foundation. Soy el primer asistente LGTBI+ a nivel mundial más potente jamás creado. Estoy aquí para ayudarte en todo lo relacionado con la comunidad LGTBI, la tecnología blockchain y, por supuesto, conectarte con el ecosistema Marsha+. ¡Estoy aquí para asistirte en todo lo que necesites!";
        bot.sendMessage(chatId, welcomeMessage, opts);

        // Marcar la interacción como completada
        await markFirstInteractionComplete(chatId);
    } else {
        // Obtener idioma del usuario
        const locale = await getUserLocale(chatId);
        i18n.setLocale(locale);

        // Enviar mensaje para elegir idioma
        bot.sendMessage(chatId, i18n.__('¡Hola! Por favor, elige tu idioma.'), opts);
    }
});

// Función para verificar si es la primera interacción con el bot
async function checkFirstInteraction(chatId) {
    try {
        const res = await pool.query('SELECT first_interaction FROM users WHERE chat_id = $1', [chatId]);
        if (res.rows.length > 0) {
            return !res.rows[0].first_interaction; // true si no es la primera interacción
        } else {
            return true; // Si no hay registros previos, es la primera interacción
        }
    } catch (error) {
        console.error('Error al verificar la primera interacción:', error);
        return true; // En caso de error, considerar como primera interacción por precaución
    }
}

// Función para marcar la primera interacción como completada
async function markFirstInteractionComplete(chatId) {
    try {
        await pool.query('INSERT INTO users (chat_id, first_interaction) VALUES ($1, true) ON CONFLICT (chat_id) DO UPDATE SET first_interaction = true', [chatId]);
    } catch (error) {
        console.error('Error al marcar la primera interacción como completada:', error);
    }
}

// Escuchar todos los mensajes entrantes
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userMessage = msg.text;
    
    // Obtener idioma del usuario
    const locale = await getUserLocale(chatId);
    i18n.setLocale(locale);

    try {
        const prompt = { role: 'user', content: userMessage };
        const messages = [prompt];
        const gptResponse = await getChatGPTResponse(messages);

        if (!gptResponse) {
            const doc = await wtf.fetch(userMessage, locale);
            const summary = doc && doc.sections(0).paragraphs(0).sentences(0).text();
            bot.sendMessage(chatId, summary || i18n.__('Lo siento, no entiendo eso. ¿Podrías reformularlo?'));
        } else {
            bot.sendMessage(chatId, gptResponse);
        }
    } catch (error) {
        console.error('Error al procesar el mensaje:', error);
        bot.sendMessage(chatId, i18n.__('Ha ocurrido un error al procesar tu mensaje. Intenta nuevamente más tarde.'));
    }
});

bot.on('polling_error', (error) => {
    console.error('Error de polling:', error);
});

process.on('uncaughtException', (err) => {
    console.error('Error no capturado:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Error no manejado:', reason, 'promise:', promise);
});
