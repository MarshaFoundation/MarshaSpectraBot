const TelegramBot = require('node-telegram-bot-api');
const i18n = require('i18n');
const wtf = require('wtf_wikipedia');
const axios = require('axios');
require('dotenv').config();

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

// Caché para almacenar respuestas de OpenAI
const cachedResponses = new Map();
const cacheMaxSize = 100; // Establecer el límite máximo de elementos en la caché

// Función para hacer la llamada a OpenAI con control de frecuencia
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

        // Limpiar la caché si excede el límite máximo de tamaño
        if (cachedResponses.size > cacheMaxSize) {
            const keysToDelete = Array.from(cachedResponses.keys()).slice(0, cachedResponses.size - cacheMaxSize);
            keysToDelete.forEach(key => cachedResponses.delete(key));
        }

        return gptResponse;
    } catch (error) {
        console.error('Error al llamar a OpenAI:', error);
        return 'Lo siento, actualmente no puedo procesar tu solicitud.';
    }
}

// Función para manejar errores y enviar mensajes informativos al usuario
async function handleError(chatId, errorMessage) {
    console.error(errorMessage);
    await bot.sendMessage(chatId, i18n.__('Ha ocurrido un error. Por favor, inténtalo nuevamente más tarde.'));
}

// Función para sanitizar la entrada del usuario
function sanitizeInput(input) {
    return input.replace(/[^a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ\s.,?!]/g, '');
}

// Escuchar el evento de inicio para cambio de idioma
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
    const locale = 'es'; // Establecer el idioma predeterminado como español
    i18n.setLocale(locale);
    bot.sendMessage(chatId, i18n.__('¡Hola! Por favor, elige tu idioma.'), opts);
});

// Manejar el cambio de idioma
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const locale = callbackQuery.data;
    i18n.setLocale(locale);
    bot.sendMessage(chatId, i18n.__('Idioma cambiado a %s', i18n.getLocale()));
});

// Manejar mensajes del usuario
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userMessage = sanitizeInput(msg.text);

    try {
        const prompt = { role: 'user', content: userMessage };
        const messages = [prompt];
        const gptResponse = await getChatGPTResponse(messages);

        if (!gptResponse) {
            const doc = await wtf.fetch(userMessage, 'es');
            const summary = doc && doc.sections(0).paragraphs(0).sentences(0).text();
            bot.sendMessage(chatId, summary || i18n.__('Lo siento, no entiendo eso. ¿Podrías reformularlo?'));
        } else {
            bot.sendMessage(chatId, gptResponse);
        }
    } catch (error) {
        await handleError(chatId, error.message);
    }
});

// Manejar errores de polling
bot.on('polling_error', (error) => {
    console.error('Error de polling:', error);
});

// Manejar excepciones no capturadas
process.on('uncaughtException', (err) => {
    console.error('Error no capturado:', err);
});

// Manejar promesas no manejadas
process.on('unhandledRejection', (reason, promise) => {
    console.error('Error no manejado:', reason, 'promise:', promise);
});

