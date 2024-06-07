const TelegramBot = require('node-telegram-bot-api');
const { NlpManager } = require('node-nlp');
const i18n = require('i18n');
const wtf = require('wtf_wikipedia');

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

// Configuración de node-nlp
const manager = new NlpManager({ languages: ['en', 'es'], forceNER: true });

// Función para entrenar el modelo NLP
const trainNlp = async () => {
    // Saludos
    manager.addDocument('en', 'hello', 'greetings.hello');
    manager.addDocument('es', 'hola', 'greetings.hello');
    manager.addDocument('en', 'hi', 'greetings.hello');
    manager.addDocument('es', 'buenos días', 'greetings.goodmorning');
    manager.addDocument('en', 'good morning', 'greetings.goodmorning');
    manager.addDocument('es', 'buenas tardes', 'greetings.goodafternoon');
    manager.addDocument('en', 'good afternoon', 'greetings.goodafternoon');
    manager.addDocument('es', 'buenas noches', 'greetings.goodevening');
    manager.addDocument('en', 'good evening', 'greetings.goodevening');
    manager.addDocument('en', 'how are you', 'greetings.howareyou');
    manager.addDocument('es', 'como estas', 'greetings.howareyou');

    manager.addAnswer('en', 'greetings.hello', 'Hello! How can I help you today?');
    manager.addAnswer('es', 'greetings.hello', '¡Hola! ¿Cómo puedo ayudarte hoy?');
    manager.addAnswer('en', 'greetings.goodmorning', 'Good morning! How can I help you today?');
    manager.addAnswer('es', 'greetings.goodmorning', '¡Buenos días! ¿Cómo puedo ayudarte hoy?');
    manager.addAnswer('en', 'greetings.goodafternoon', 'Good afternoon! How can I help you today?');
    manager.addAnswer('es', 'greetings.goodafternoon', '¡Buenas tardes! ¿Cómo puedo ayudarte hoy?');
    manager.addAnswer('en', 'greetings.goodevening', 'Good evening! How can I help you today?');
    manager.addAnswer('es', 'greetings.goodevening', '¡Buenas noches! ¿Cómo puedo ayudarte hoy?');
    manager.addAnswer('en', 'greetings.howareyou', 'I am an AI bot, I am always fine! How about you?');
    manager.addAnswer('es', 'greetings.howareyou', 'Soy un bot de IA, ¡siempre estoy bien! ¿Y tú?');

    // Consultas sobre la comunidad LGTBI+
    manager.addDocument('en', 'tell me about LGBT', 'lgbt.info');
    manager.addDocument('es', 'cuéntame sobre LGBT', 'lgbt.info');
    manager.addDocument('en', 'what does LGBT mean', 'lgbt.meaning');
    manager.addDocument('es', 'qué significa LGBT', 'lgbt.meaning');
    manager.addDocument('en', 'what is LGBTQ+', 'lgbtq.info');
    manager.addDocument('es', 'qué es LGBTQ+', 'lgbtq.info');

    manager.addAnswer('en', 'lgbt.info', 'The LGBT community is diverse and inclusive, encompassing a wide range of identities including lesbian, gay, bisexual, and transgender individuals.');
    manager.addAnswer('es', 'lgbt.info', 'La comunidad LGBT es diversa e inclusiva, abarcando una amplia gama de identidades que incluyen a lesbianas, gays, bisexuales y personas transgénero.');
    manager.addAnswer('en', 'lgbt.meaning', 'LGBT stands for Lesbian, Gay, Bisexual, and Transgender.');
    manager.addAnswer('es', 'lgbt.meaning', 'LGBT significa Lesbianas, Gays, Bisexuales y Transgénero.');
    manager.addAnswer('en', 'lgbtq.info', 'LGBTQ+ includes all of the identities in the LGBT acronym plus Queer and other identities.');
    manager.addAnswer('es', 'lgbtq.info', 'LGBTQ+ incluye todas las identidades del acrónimo LGBT más Queer y otras identidades.');

    // Responder a situaciones personales
    manager.addDocument('en', 'I am feeling sad', 'emotion.sad');
    manager.addDocument('es', 'me siento triste', 'emotion.sad');
    manager.addDocument('en', 'I am feeling happy', 'emotion.happy');
    manager.addDocument('es', 'me siento feliz', 'emotion.happy');
    manager.addDocument('en', 'I need help', 'emotion.help');
    manager.addDocument('es', 'necesito ayuda', 'emotion.help');

    manager.addAnswer('en', 'emotion.sad', 'I am sorry to hear that you are feeling sad. If you need someone to talk to, there are many resources available to help you.');
    manager.addAnswer('es', 'emotion.sad', 'Lamento escuchar que te sientes triste. Si necesitas hablar con alguien, hay muchos recursos disponibles para ayudarte.');
    manager.addAnswer('en', 'emotion.happy', 'I am glad to hear that you are feeling happy! Remember, your happiness is important.');
    manager.addAnswer('es', 'emotion.happy', '¡Me alegra saber que te sientes feliz! Recuerda, tu felicidad es importante.');
    manager.addAnswer('en', 'emotion.help', 'It is okay to ask for help. If you need support, here are some resources that might be helpful for you.');
    manager.addAnswer('es', 'emotion.help', 'Está bien pedir ayuda. Si necesitas apoyo, aquí tienes algunos recursos que pueden ser útiles para ti.');

    // Entrenar y guardar el modelo
    await manager.train();
    manager.save();
};

trainNlp();

// Función para manejar mensajes de texto
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;

    try {
        const response = await manager.process(msg.from.language_code, msg.text);

        if (!response.intent || response.intent === 'None') {
            // Buscar en Wikipedia si no se detecta ninguna intención
            wtf.fetch(msg.text, 'es').then((doc) => {
                if (doc) {
                    const summary = doc.sections(0).paragraphs(0).sentences(0).text();
                    bot.sendMessage(chatId, summary);
                } else {
                    bot.sendMessage(chatId, i18n.__('Lo siento, no entiendo eso. ¿Podrías reformularlo?'));
                }
            }).catch((err) => {
                console.error('Error al buscar en Wikipedia:', err);
                bot.sendMessage(chatId, i18n.__('Lo siento, no entiendo eso. ¿Podrías reformularlo?'));
            });
        } else {
            // Responder según la intención detectada por node-nlp
            bot.sendMessage(chatId, response.answer);
        }
    } catch (error) {
        console.error('Error al procesar el mensaje:', error);
        bot.sendMessage(chatId, i18n.__('Ha ocurrido un error al procesar tu mensaje. Intenta nuevamente más tarde.'));
    }
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
