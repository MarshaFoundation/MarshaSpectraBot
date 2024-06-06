const TelegramBot = require('node-telegram-bot-api');
const i18n = require('i18n');

// Configuración de i18n
i18n.configure({
    locales: ['en', 'es'],
    directory: __dirname + '/locales',
    defaultLocale: 'es',
    queryParameter: 'lang',
    cookie: 'locale',
});

const token = 'YOUR_TELEGRAM_BOT_TOKEN'; // Reemplaza 'YOUR_TELEGRAM_BOT_TOKEN' con el token real de tu bot
const bot = new TelegramBot(token, { polling: true });

const userCodes = {}; // Almacenar los códigos temporales
const userLanguages = {}; // Almacenar las preferencias de idioma temporales

// Comando para iniciar
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, '¡Hola! Soy un bot sobre la comunidad LGTBI+ y Marsha+. Pregunta lo que quieras y estaré encantado de ayudarte.');
});

// Comando para solicitar autenticación
bot.onText(/\/auth/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const code = Math.floor(100000 + Math.random() * 900000); // Generar un código de 6 dígitos
    userCodes[userId] = code;
    bot.sendMessage(chatId, `Tu código de autenticación es: ${code}. Envíalo usando el comando /verify <código>`);
});

// Comando para verificar el código
bot.onText(/\/verify (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const code = parseInt(match[1]);

    if (userCodes[userId] && userCodes[userId] === code) {
        delete userCodes[userId];
        bot.sendMessage(chatId, 'Autenticación exitosa.');
    } else {
        bot.sendMessage(chatId, 'Código incorrecto. Inténtalo de nuevo.');
    }
});

// Comando para cambiar el idioma
bot.onText(/\/language (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const locale = match[1];

    if (['en', 'es'].includes(locale)) {
        userLanguages[userId] = locale;
        i18n.setLocale(locale);
        bot.sendMessage(chatId, i18n.__('Idioma cambiado a ') + locale);
    } else {
        bot.sendMessage(chatId, i18n.__('Idioma no soportado.'));
    }
});

// Comando para mostrar el menú
bot.onText(/\/menu/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const locale = userLanguages[userId] || 'es';
    i18n.setLocale(locale);

    const options = {
        reply_markup: JSON.stringify({
            inline_keyboard: [
                [{ text: i18n.__('Info'), callback_data: 'info' }],
                [{ text: i18n.__('Recursos'), callback_data: 'resources' }],
                [{ text: i18n.__('Eventos'), callback_data: 'events' }],
                [{ text: i18n.__('Soporte'), callback_data: 'support' }],
                [{ text: i18n.__('Comentarios'), callback_data: 'feedback' }],
            ]
        })
    };
    bot.sendMessage(chatId, i18n.__('Elige una opción:'), options);
});

// Manejo de las opciones del menú
bot.on('callback_query', (callbackQuery) => {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;
    const userId = msg.from.id;
    const locale = userLanguages[userId] || 'es';
    i18n.setLocale(locale);

    if (data === 'info') {
        bot.sendMessage(msg.chat.id, i18n.__('Marsha+ es una comunidad inclusiva...'));
    } else if (data === 'resources') {
        bot.sendMessage(msg.chat.id, i18n.__('Aquí tienes algunos recursos útiles...'));
    } else if (data === 'events') {
        bot.sendMessage(msg.chat.id, i18n.__('Aquí tienes algunos próximos eventos...'));
    } else if (data === 'support') {
        bot.sendMessage(msg.chat.id, i18n.__('Si necesitas apoyo, aquí tienes algunas opciones...'));
    } else if (data === 'feedback') {
        bot.sendMessage(msg.chat.id, i18n.__('Por favor, envía tus comentarios usando /feedback <tu feedback>'));
    }
});

// Comando para recibir feedback
bot.onText(/\/feedback (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const feedback = match[1];

    // Aquí podríamos guardar el feedback en la base de datos o enviarlo a un administrador
    bot.sendMessage(chatId, i18n.__('Gracias por tu feedback. Lo apreciamos mucho.'));
});

// Iniciar la aplicación
bot.on('polling_error', (error) => {
    console.log(error.code);  // => 'EFATAL'
});
