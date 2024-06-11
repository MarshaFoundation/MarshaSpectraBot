const TelegramBot = require('node-telegram-bot-api');
const i18n = require('i18n');
require('dotenv').config();
const { handleUserMessage, configureI18n } = require('./handlers');
const { getUserLocale, setUserLocale } = require('./database');

const token = process.env.TELEGRAM_API_KEY;

// Configuración de i18n
configureI18n(i18n);

const bot = new TelegramBot(token, { polling: true });
console.log('Bot iniciado correctamente');

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

bot.on('message', (msg) => {
    handleUserMessage(bot, msg);
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
