const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const i18n = require('i18n');

// Configuración de i18n
i18n.configure({
    locales: ['en', 'es'],
    directory: __dirname + '/locales',
    defaultLocale: 'es',
    queryParameter: 'lang',
    cookie: 'locale',
});

// Conexión a MongoDB
mongoose.connect('mongodb://localhost:27017/telegramBot', { useNewUrlParser: true, useUnifiedTopology: true });

const userSchema = new mongoose.Schema({
    id: Number,
    username: String,
    subscribed: Boolean,
    authenticated: Boolean,
    language: { type: String, default: 'es' }
});

const User = mongoose.model('User', userSchema);

const token = '7164860622:AAGdgiNe_Po07H5aGkQWvA4aPFvfAxLEDO0';
const bot = new TelegramBot(token, { polling: true });

const userCodes = {}; // Almacenar los códigos temporales

// Comando para iniciar
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    let user = await User.findOne({ id: userId });

    if (!user) {
        user = new User({ id: userId, username: msg.from.username || 'Unknown', subscribed: false, authenticated: false });
        await user.save();
    }

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
bot.onText(/\/verify (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const code = parseInt(match[1]);

    if (userCodes[userId] && userCodes[userId] === code) {
        delete userCodes[userId];
        let user = await User.findOne({ id: userId });
        user.authenticated = true;
        await user.save();
        bot.sendMessage(chatId, 'Autenticación exitosa.');
    } else {
        bot.sendMessage(chatId, 'Código incorrecto. Inténtalo de nuevo.');
    }
});

// Comando para cambiar el idioma
bot.onText(/\/language (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const locale = match[1];

    if (['en', 'es'].includes(locale)) {
        i18n.setLocale(locale);
        let user = await User.findOne({ id: userId });
        user.language = locale;
        await user.save();
        bot.sendMessage(chatId, i18n.__('Language set to ') + locale);
    } else {
        bot.sendMessage(chatId, i18n.__('Unsupported language.'));
    }
});

// Comando para mostrar el menú
bot.onText(/\/menu/, (msg) => {
    const chatId = msg.chat.id;
    const options = {
        reply_markup: JSON.stringify({
            inline_keyboard: [
                [{ text: 'Info', callback_data: 'info' }],
                [{ text: 'Resources', callback_data: 'resources' }],
                [{ text: 'Events', callback_data: 'events' }],
                [{ text: 'Support', callback_data: 'support' }],
                [{ text: 'Feedback', callback_data: 'feedback' }],
            ]
        })
    };
    bot.sendMessage(chatId, 'Elige una opción:', options);
});

// Manejo de las opciones del menú
bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;
    const userId = msg.from.id;
    let user = await User.findOne({ id: userId });
    i18n.setLocale(user.language);

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
bot.onText(/\/feedback (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const feedback = match[1];
    const userId = msg.from.id;
    let user = await User.findOne({ id: userId });

    // Aquí podríamos guardar el feedback en la base de datos o enviarlo a un administrador
    bot.sendMessage(chatId, i18n.__('Gracias por tu feedback. Lo apreciamos mucho.'));
});

// Iniciar la aplicación
bot.on('polling_error', (error) => {
    console.log(error.code);  // => 'EFATAL'
});
