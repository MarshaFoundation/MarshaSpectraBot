const TelegramBot = require('node-telegram-bot-api');
const i18n = require('i18n');

// Token del bot (¡reemplaza esto con tu propio token!)
const token = '7164860622:AAGdgiNe_Po07H5aGkQWvA4aPFvfAxLEDO0';

// Configuración de i18n
i18n.configure({
    locales: ['en', 'es'],
    directory: __dirname + '/locales',
    defaultLocale: 'es',
    queryParameter: 'lang',
    cookie: 'locale',
});

// Crear instancia del bot
const bot = new TelegramBot(token, { polling: true });

console.log('Bot iniciado correctamente');

// Función para manejar el comando /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, '¡Hola! Soy Spectra, un Bot de Marsha+, ¿estás list@ para aprender sobre la comunidad LGTBI+? ¿En qué puedo ayudarte hoy?');
});

// Función para manejar el comando /auth
bot.onText(/\/auth/, (msg) => {
    const chatId = msg.chat.id;
    const code = Math.floor(100000 + Math.random() * 900000);
    bot.sendMessage(chatId, `Tu código de autenticación es: ${code}. Envíalo usando el comando /verify <código>`);
});

// Función para manejar el comando /verify
bot.onText(/\/verify (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const code = parseInt(match[1]);
    // Lógica para verificar el código y autenticar al usuario
});

// Función para manejar el comando /language
bot.onText(/\/language (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const locale = match[1];
    if (['en', 'es'].includes(locale)) {
        i18n.setLocale(locale);
        bot.sendMessage(chatId, i18n.__('Idioma cambiado a ') + locale);
    } else {
        bot.sendMessage(chatId, i18n.__('Idioma no soportado.'));
    }
});

// Función para manejar el comando /menu
bot.onText(/\/menu/, (msg) => {
    const chatId = msg.chat.id;
    const options = {
        reply_markup: JSON.stringify({
            inline_keyboard: [
                [{ text: 'Info', callback_data: 'info' }],
                [{ text: 'Recursos', callback_data: 'resources' }],
                [{ text: 'Eventos', callback_data: 'events' }],
                [{ text: 'Soporte', callback_data: 'support' }],
                [{ text: 'Comentarios', callback_data: 'feedback' }],
            ]
        })
    };
    bot.sendMessage(chatId, 'Elige una opción:', options);
});

// Función para manejar las opciones del menú
bot.on('callback_query', (callbackQuery) => {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;

    if (data === 'info') {
        bot.sendMessage(msg.chat.id, 'Marsha+ es una comunidad inclusiva...');
    } else if (data === 'resources') {
        bot.sendMessage(msg.chat.id, 'Aquí tienes algunos recursos útiles...');
    } else if (data === 'events') {
        bot.sendMessage(msg.chat.id, 'Aquí tienes algunos próximos eventos...');
    } else if (data === 'support') {
        bot.sendMessage(msg.chat.id, 'Si necesitas apoyo, aquí tienes algunas opciones...');
    } else if (data === 'feedback') {
        bot.sendMessage(msg.chat.id, 'Por favor, envía tus comentarios usando /feedback <tu feedback>');
    }
});

// Función para manejar el comando /feedback
bot.onText(/\/feedback (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const feedback = match[1];
    // Lógica para manejar el feedback del usuario
});

// Función para manejar errores de polling
bot.on('polling_error', (error) => {
    console.error('Error de polling:', error);
});

// Función para manejar errores no capturados
process.on('uncaughtException', (err) => {
    console.error('Error no capturado:', err);
});

// Función para manejar errores no manejados
process.on('unhandledRejection', (reason, promise) => {
    console.error('Error no manejado:', reason, 'promise:', promise);
});
