const TelegramBot = require('node-telegram-bot-api');
const wtf = require('wtf_wikipedia');
const i18n = require('i18n');
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

// Función para limpiar la entrada de usuario
function sanitizeInput(input) {
    return input.replace(/[^a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ\s.,?!]/g, '');
}

// Manejo de errores
async function handleError(chatId, errorMessage, errorDetails = '') {
    console.error(errorMessage, errorDetails);
    await bot.sendMessage(chatId, i18n.__('Ha ocurrido un error. Por favor, inténtalo nuevamente más tarde.'));
}

// Evento de inicio del bot
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

// Evento para manejar mensajes de texto
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userMessage = sanitizeInput(msg.text);

    // Manejo del mensaje "hola"
    if (userMessage.toLowerCase() === 'hola') {
        bot.sendMessage(chatId, i18n.__('¡Hola! Bienvenido de nuevo.'));
        return;
    }

    try {
        const doc = await wtf.fetch(userMessage, 'es');
        
        // Obtener el primer párrafo del artículo si está disponible
        const summary = doc && doc.sections(0) && doc.sections(0).sentences(0);

        if (summary) {
            bot.sendMessage(chatId, summary.text());
        } else {
            bot.sendMessage(chatId, i18n.__('Lo siento, no pude encontrar información sobre eso en Wikipedia. ¿Podrías intentarlo de nuevo?'));
        }
    } catch (error) {
        await handleError(chatId, error.message, error);
    }
});

// Manejo de errores generales
bot.on('polling_error', (error) => {
    console.error('Error de polling:', error);
});

process.on('uncaughtException', (err) => {
    console.error('Error no capturado:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Error no manejado:', reason, 'promise:', promise);
});
