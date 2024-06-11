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

// Resto de tu código aquí...


// Función para hacer la llamada a OpenAI
async function getChatGPTResponse(messages) {
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
        return response.data.choices[0].message.content.trim();
    } catch (error) {
        console.error('Error al llamar a OpenAI:', error);
        return null;
    }
}

// Escuchar el evento de cambio de idioma
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const opts = {
        reply_markup: JSON.stringify({
            inline_keyboard: [
                [{ text: '🇬🇧 English', callback_data: 'en' }],
                [{ text: '🇪🇸 Español', callback_data: 'es' }],
            ],
        }),
    };
    bot.sendMessage(chatId, i18n.__('¡Hola! Por favor, elige tu idioma.'), opts);
});

// Manejar el cambio de idioma
bot.on('callback_query', (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const locale = callbackQuery.data;
    i18n.setLocale(locale);
    bot.sendMessage(chatId, i18n.__('Idioma cambiado a %s', i18n.getLocale()));
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userMessage = msg.text;
    const language = msg.from.language_code && ['en', 'es'].includes(msg.from.language_code) ? msg.from.language_code : 'es';

    try {
        const prompt = { role: 'user', content: userMessage };
        const messages = [prompt];
        const gptResponse = await getChatGPTResponse(messages);

        if (!gptResponse) {
            const doc = await wtf.fetch(userMessage, language);
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
