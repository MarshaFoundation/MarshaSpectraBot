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
const assistantName = 'SilvIA+'; // Nombre del asistente

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

// Función para determinar si el mensaje es un saludo
function isGreeting(message) {
    const greetings = ['hola', 'hi', 'hello', 'qué tal', 'buenas'];
    const normalizedMessage = message.trim().toLowerCase();
    return greetings.includes(normalizedMessage);
}

// Función para determinar si el mensaje es una pregunta por el nombre del asistente
function isAskingName(message) {
    const askingNames = ['¿cuál es tu nombre?', 'cuál es tu nombre?', 'como te llamas?', '¿como te llamas?', 'nombre?', 'dime tu nombre'];
    const normalizedMessage = message.trim().toLowerCase();
    return askingNames.includes(normalizedMessage);
}

// Escuchar todos los mensajes entrantes
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userMessage = msg.text;
    
    // Obtener idioma del usuario
    const locale = await getUserLocale(chatId);
    i18n.setLocale(locale);

    try {
        if (isGreeting(userMessage)) {
            // Si el mensaje es un saludo, enviar mensaje de bienvenida
            const welcomeMessage = ` Hola! Bienvenid@! Qué gusto tenerte por aquí! Soy ${assistantName}, una IA avanzada propiedad de Marsha+, y el primer asistente LGTBI+ creado en el mundo. ¿En qué puedo asistirte hoy?`;
            bot.sendMessage(chatId, welcomeMessage);
        } else if (isAskingName(userMessage)) {
            // Si el mensaje es una pregunta por el nombre del asistente
            bot.sendMessage(chatId, assistantName);
        } else {
            // Otro tipo de mensaje, procesar según sea necesario
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
        }
    } catch (error) {
        console.error('Error al procesar el mensaje:', error);
        bot.sendMessage(chatId, i18n.__('Ha ocurrido un error al procesar tu mensaje. Intenta nuevamente más tarde.'));
    }
});

// Escuchar el evento de cambio de idioma
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
    const locale = await getUserLocale(chatId);
    i18n.setLocale(locale);
    bot.sendMessage(chatId, i18n.__('¡Hola! Por favor, elige tu idioma.'), opts);
});

// Manejar el cambio de idioma
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const locale = callbackQuery.data;
    i18n.setLocale(locale);
    await setUserLocale(chatId, locale);
    bot.sendMessage(chatId, i18n.__('Idioma cambiado a %s', i18n.getLocale()));
});

// Manejar errores de polling
bot.on('polling_error', (error) => {
    console.error('Error de polling:', error);
});

// Manejar errores no capturados
process.on('uncaughtException', (err) => {
    console.error('Error no capturado:', err);
});

// Manejar rechazos no manejados
process.on('unhandledRejection', (reason, promise) => {
    console.error('Error no manejado:', reason, 'promise:', promise);
});
