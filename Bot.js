const TelegramBot = require('node-telegram-bot-api');
const i18n = require('i18n');
const wtf = require('wtf_wikipedia');
require('dotenv').config();

const token = process.env.TELEGRAM_API_KEY;

// Configuración del objeto de configuración
const CONFIG = {
    locales: ['en', 'es'],
    defaultLocale: 'es',
    cacheMaxSize: 100,
};

i18n.configure({
    locales: CONFIG.locales,
    directory: __dirname + '/locales',
    defaultLocale: CONFIG.defaultLocale,
    queryParameter: 'lang',
    cookie: 'locale',
});

const bot = new TelegramBot(token, { polling: true });
console.log('Bot iniciado correctamente');

// Implementación de una caché LRU
class LRUCache {
    constructor(maxSize) {
        this.maxSize = maxSize;
        this.cache = new Map();
    }

    get(key) {
        if (!this.cache.has(key)) {
            return null;
        }
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    set(key, value) {
        if (this.cache.size >= this.maxSize) {
            const keys = this.cache.keys();
            this.cache.delete(keys.next().value);
        }
        this.cache.set(key, value);
    }
}

const cache = new LRUCache(CONFIG.cacheMaxSize);

// Funciones de utilidad
async function handleError(chatId, errorMessage, errorDetails = '') {
    console.error(errorMessage, errorDetails);
    await bot.sendMessage(chatId, i18n.__('Ha ocurrido un error. Por favor, inténtalo nuevamente más tarde.'));
}

function sanitizeInput(input) {
    return input.replace(/[^a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ\s.,?!]/g, '');
}

// Bot commands setup
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
    const locale = CONFIG.defaultLocale;
    i18n.setLocale(locale);
    bot.sendMessage(chatId, i18n.__('¡Hola! Por favor, elige tu idioma.'), opts);
    const welcomeMessage = `
Hola, soy SylvIA+. ¡Bienvenido al mundo Marsha+! Estoy aquí para ayudarte. Permíteme ofrecerte una breve descripción de nosotros:

🌟 En Marsha+, creemos en un mundo donde las finanzas descentralizadas ocupan un lugar fundamental en la sociedad.

🔄 El cambio y la transición ya están en marcha. Personas, bancos, gobiernos, empresas y medios de comunicación han hablado sobre BTC o este mundo en algún momento. ¡Es una realidad!

🔍 Las herramientas que necesitas están aquí: educación financiera, transparencia, apoyo, tecnología y evolución son parte de Marsha+. Trabajamos para ti. 🌍❤️

🚀 Nuestra iniciativa revolucionaria aprovecha el poder de la tecnología blockchain para empoderar y apoyar a la comunidad LGBTQ+.

💡 Marsha+ es más que un activo digital; es un catalizador para acciones significativas. Construido en Ethereum y desplegado en la Binance Smart Chain, nuestro token garantiza transacciones seguras, transparentes, públicas y descentralizadas.

🏳️‍🌈 Trabajamos incansablemente para convertirnos en la comunidad blockchain LGBTQ+ más grande del mundo.

🤝 Además, el 25% de nuestra empresa está dedicado a propósitos de ayuda, asegurando que siempre contribuyamos al bienestar y apoyo de nuestra comunidad, no solo con palabras sino con acciones.

🔥 Con un suministro total de 8 mil millones de tokens y una tasa de quema anual del 3%, Marsha+ se erige como un símbolo de compromiso sostenido con la igualdad, la diversidad y un futuro más brillante. 💫

💪 Únete a nosotros en este viaje para fortalecer a la comunidad LGBTQ+ y proporcionar las herramientas necesarias para enfrentar los desafíos contemporáneos con confianza.

✨ Juntos, podemos crear un mundo donde todos tengan el poder de vivir su verdad. 🏳️‍🌈💪
`;
    bot.sendMessage(chatId, welcomeMessage, opts);
});

bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const locale = callbackQuery.data;
    i18n.setLocale(locale);
    bot.sendMessage(chatId, i18n.__('Idioma cambiado a %s', i18n.getLocale()));
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userMessage = sanitizeInput(msg.text);

    try {
        const doc = await wtf.fetch(userMessage, 'es');
        const summary = doc && doc.sections(0).paragraphs(0).sentences(0).text();
        bot.sendMessage(chatId, summary || i18n.__('Lo siento, no entiendo eso. ¿Podrías reformularlo?'));
    } catch (error) {
        await handleError(chatId, error.message, error);
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
