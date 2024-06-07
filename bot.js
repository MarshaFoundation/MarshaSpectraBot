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
async function trainNlp() {
    
// Saludos
const greetings = [
    { en: 'hello', es: 'hola', key: 'greetings.hello' },
    { en: 'hi', es: 'hola', key: 'greetings.hello' },
    { en: 'good morning', es: 'buenos días', key: 'greetings.goodmorning' },
    { en: 'good afternoon', es: 'buenas tardes', key: 'greetings.goodafternoon' },
    { en: 'good evening', es: 'buenas noches', key: 'greetings.goodevening' },
    { en: 'how are you', es: 'cómo estás', key: 'greetings.howareyou' }
];

for (const greeting of greetings) {
    manager.addDocument('en', greeting.en, greeting.key);
    manager.addDocument('es', greeting.es, greeting.key);
}

manager.addAnswer('en', 'greetings.hello', 'Hello! How can I help you today?');
manager.addAnswer('es', 'greetings.hello', '¡Hola! ¿Cómo puedo ayudarte hoy?');
manager.addAnswer('en', 'greetings.goodmorning', 'Good morning! How can I help you today?');
manager.addAnswer('es', 'greetings.goodmorning', '¡Buenos días! ¿Cómo puedo ayudarte hoy?');
manager.addAnswer('en', 'greetings.goodafternoon', 'Good afternoon! How can I help you today?');
manager.addAnswer('es', 'greetings.goodafternoon', '¡Buenas tardes! ¿Cómo puedo ayudarte hoy?');
manager.addAnswer('en', 'greetings.goodevening', 'Good evening! How can I help you today?');
manager.addAnswer('es', 'greetings.goodevening', '¡Buenas noches! ¿Cómo puedo ayudarte hoy?');
manager.addAnswer('es', 'greetings.howareyou', 'Soy un bot de IA, ¡siempre estoy bien! ¿Y tú?');
manager.addAnswer('es', 'greetings.howareyou', 'Soy un bot de IA, ¡siempre estoy bien! ¿Y tú?');owareyou', 'Soy un bot de IA, ¡siempre estoy bien! ¿Y tú?');
    
 // Consultas sobre la comunidad LGTBI+
    const lgbtQueries = [
        { en: 'tell me about LGBT', es: 'cuéntame sobre LGBT', key: 'lgbt.info' },
        { en: 'what does LGBT mean', es: 'qué significa LGBT', key: 'lgbt.meaning' },
        { en: 'what is LGBTQ+', es: 'qué es LGBTQ+', key: 'lgbtq.info' },
        { en: 'what are the rights of LGBTQ+ individuals', es: 'cuáles son los derechos de las personas LGBTQ+', key: 'lgbtq.rights' },
        { en: 'how can I support a friend who is coming out', es: 'cómo puedo apoyar a un amigo que está saliendo del clóset', key: 'lgbtq.support.friend' },
        { en: 'what does being non-binary mean', es: 'qué significa ser no binario', key: 'lgbtq.nonbinary' },
        { en: 'how to talk to kids about LGBTQ+', es: 'cómo hablar con los niños sobre LGBTQ+', key: 'lgbtq.talk.kids' },
        { en: 'how to create a safe space for LGBTQ+ youth', es: 'cómo crear un espacio seguro para jóvenes LGBTQ+', key: 'lgbtq.safe.space' },
        { en: 'what is gender dysphoria', es: 'qué es la disforia de género', key: 'lgbtq.gender.dysphoria' },
        { en: 'what are some famous LGBTQ+ activists', es: 'quiénes son algunos activistas LGBTQ+ famosos', key: 'lgbtq.activists' },
        { en: 'how to handle discrimination at work', es: 'cómo manejar la discriminación en el trabajo', key: 'lgbtq.discrimination.work' },
        { en: 'what are some LGBTQ+ friendly places', es: 'cuáles son algunos lugares amigables LGBTQ+', key: 'lgbtq.friendly.places' },
        { en: 'how to support LGBTQ+ rights', es: 'cómo apoyar los derechos LGBTQ+', key: 'lgbtq.support.rights' },
        { en: 'what are pronouns and why are they important', es: 'qué son los pronombres y por qué son importantes', key: 'lgbtq.pronouns' },
        { en: 'how to be an ally to LGBTQ+ people', es: 'cómo ser un aliado de las personas LGBTQ+', key: 'lgbtq.ally' },
        { en: 'what are some LGBTQ+ support groups', es: 'cuáles son algunos grupos de apoyo LGBTQ+', key: 'lgbtq.support.groups' },
        { en: 'how to come out to family', es: 'cómo salir del clóset con la familia', key: 'lgbtq.coming.out.family' },
        { en: 'what is the history of the LGBTQ+ movement', es: 'cuál es la historia del movimiento LGBTQ+', key: 'lgbtq.history' },
        { en: 'how to deal with internalized homophobia', es: 'cómo lidiar con la homofobia internalizada', key: 'lgbtq.internalized.homophobia' },
        { en: 'how to support a transgender friend', es: 'cómo apoyar a un amigo transgénero', key: 'lgbtq.support.transgender' },
];

    // Consultas sobre la comunidad LGTBI+
const lgbtQueries = [
    { en: 'tell me about LGBT', es: 'cuéntame sobre LGBT', key: 'lgbt.info' },
    { en: 'what does LGBT mean', es: 'qué significa LGBT', key: 'lgbt.meaning' },
    { en: 'what is LGBTQ+', es: 'qué es LGBTQ+', key: 'lgbtq.info' },
    { en: 'what are the rights of LGBTQ+ individuals', es: 'cuáles son los derechos de las personas LGBTQ+', key: 'lgbtq.rights' },
    { en: 'how can I support a friend who is coming out', es: 'cómo puedo apoyar a un amigo que está saliendo del clóset', key: 'lgbtq.support.friend' },
    { en: 'what does being non-binary mean', es: 'qué significa ser no binario', key: 'lgbtq.nonbinary' },
    { en: 'how to talk to kids about LGBTQ+', es: 'cómo hablar con los niños sobre LGBTQ+', key: 'lgbtq.talk.kids' },
    { en: 'how to create a safe space for LGBTQ+ youth', es: 'cómo crear un espacio seguro para jóvenes LGBTQ+', key: 'lgbtq.safe.space' },
    { en: 'what is gender dysphoria', es: 'qué es la disforia de género', key: 'lgbtq.gender.dysphoria' },
    { en: 'what are some famous LGBTQ+ activists', es: 'quiénes son algunos activistas LGBTQ+ famosos', key: 'lgbtq.activists' },
    { en: 'how to handle discrimination at work', es: 'cómo manejar la discriminación en el trabajo', key: 'lgbtq.discrimination.work' },
    { en: 'what are some LGBTQ// Consultas sobre la comunidad LGTBI+
const lgbtQueries = [
    { en: 'tell me about LGBT', es: 'cuéntame sobre LGBT', key: 'lgbt.info' },
    { en: 'what does LGBT mean', es: 'qué significa LGBT', key: 'lgbt.meaning' },
    { en: 'what is LGBTQ+', es: 'qué es LGBTQ+', key: 'lgbtq.info' },
    { en: 'what are the rights of LGBTQ+ individuals', es: 'cuáles son los derechos de las personas LGBTQ+', key: 'lgbtq.rights' },
    { en: 'how can I support a friend who is coming out', es: 'cómo puedo apoyar a un amigo que está saliendo del clóset', key: 'lgbtq.support.friend' },
    { en: 'what does being non-binary mean', es: 'qué significa ser no binario', key: 'lgbtq.nonbinary' },
    { en: 'how to talk to kids about LGBTQ+', es: 'cómo hablar con los niños sobre LGBTQ+', key: 'lgbtq.talk.kids' },
    { en: 'how to create a safe space for LGBTQ+ youth', es: 'cómo crear un espacio seguro para jóvenes LGBTQ+', key: 'lgbtq.safe.space' },
    { en: 'what is gender dysphoria', es: 'qué es la disforia de género', key: 'lgbtq.gender.dysphoria' },
    { en: 'what are some famous LGBTQ+ activists', es: 'quiénes son algunos activistas LGBTQ+ famosos', key: 'lgbtq.activists' },
    { en: 'how to handle discrimination at work', es: 'cómo manejar la discriminación en el trabajo', key: 'lgbtq.discrimination.work' },
    { en: 'what are some LGBTQ+ friendly places', es: 'cuáles son algunos lugares amigables LGBTQ+', key: 'lgbtq.friendly.places' },
    { en: 'how to support LGBTQ+ rights', es: 'cómo apoyar los derechos LGBTQ+', key: 'lgbtq.support.rights' },
    { en: 'what are pronouns and why are they important', es: 'qué son los pronombres y por qué son importantes', key: 'lgbtq.pronouns' },
    { en: 'how to be an ally to LGBTQ+ people', es: 'cómo ser un aliado de las personas LGBTQ+', key: 'lgbtq.ally' },
    { en: 'what are some LGBTQ+ support groups', es: 'cuáles son algunos grupos de apoyo LGBTQ+', key: 'lgbtq.support.groups' },
    { en: 'how to come out to family', es: 'cómo salir del clóset con la familia', key: 'lgbtq.coming.out.family' },
    { en: 'what is the history of the LGBTQ+ movement', es: 'cuál es la historia del movimiento LGBTQ+', key: 'lgbtq.history' },
    { en: 'how to deal with internalized homophobia', es: 'cómo lidiar con la homofobia internalizada', key: 'lgbtq.internalized.homophobia' },
    { en: 'how to support a transgender friend', es: 'cómo apoyar a un amigo transgénero', key: 'lgbtq.support.transgender' },
];

for (const query of lgbtQueries) {
    manager.addDocument('en', query.en, query.key);
    manager.addDocument('es', query.es, query.key);
}

manager.addAnswer('en', 'lgbt.info', 'The LGBT community is diverse and inclusive, encompassing a wide range of identities including lesbian, gay, bisexual, and transgender individuals.');
manager.addAnswer('es', 'lgbt.info', 'La comunidad LGBT es diversa e inclusiva, abarcando una amplia gama de identidades que incluyen a lesbianas, gays, bisexuales y personas transgénero.');
manager.addAnswer('en', 'lgbt.meaning', 'LGBT stands for Lesbian, Gay, Bisexual, and Transgender.');
manager.addAnswer('es', 'lgbt.meaning', 'LGBT significa Lesbianas, Gays, Bisexuales y Transgénero.');
manager.addAnswer('en', 'lgbtq.info', 'LGBTQ+ includes all of the identities in the LGBT acronym plus Queer and other identities.');
manager.addAnswer('es', 'lgbtq.info', 'LGBTQ+ incluye todas las identidades del acrónimo LGBT más Queer y otras identidades.');
manager.addAnswer('en', 'lgbtq.rights', 'LGBTQ+ rights vary by country and region. It\'s important to stay informed about local laws and advocate for equal rights everywhere.');
manager.addAnswer('es', 'lgbtq.rights', 'Los derechos LGBTQ+ varían según el país y la región. Es importante estar informado sobre las leyes locales y abogar por la igualdad de derechos en todas partes.');
manager.addAnswer('en', 'lgbtq.support.friend', 'Supporting a friend who is coming out can make a big difference. Be there for them, listen without judgment, and let them know they are loved.');
manager.addAnswer('es', 'lgbtq.support.friend', 'Apoyar a un amigo que está saliendo del clóset puede hacer una gran diferencia. Esté allí para ellos, escuche sin juzgar y hágales saber que son amados.');
manager.addAnswer('en', 'lgbtq.nonbinary', 'Being non-binary means not identifying exclusively as male or female. It is a valid and respected gender identity.');
manager.addAnswer('es', 'lgbtq.nonbinary', 'Ser no binario significa no identificarse exclusivamente como hombre o mujer. Es una identidad de género válida y respetada.');
manager.addAnswer('en', 'lgbtq.talk.kids', 'When talking to kids about LGBTQ+ topics, use age-appropriate language, be honest, and emphasize the importance of acceptance and diversity.');
manager.addAnswer('es', 'lgbtq.talk.kids', 'Cuando hables con niños sobre temas LGBTQ+, utiliza un lenguaje apropiado para su edad, sé honesto y enfatiza la importancia de la aceptación y la diversidad.');
manager.addAnswer('en', 'lgbtq.safe.space', 'Creating a safe space for LGBTQ+ youth involves fostering an environment of acceptance, respect, and support where they can freely express themselves without fear of judgment or discrimination.');

  // Responder a situaciones personales
const personalSituations = [
    { en: 'I am feeling sad', es: 'me siento triste', key: 'emotion.sad' },
    { en: 'I am feeling happy', es: 'me siento feliz', key: 'emotion.happy' },
    { en: 'I need help', es: 'necesito ayuda', key: 'emotion.help' },
    // Agrega más situaciones personales aquí
];

for (const situation of personalSituations) {
    manager.addDocument('en', situation.en, situation.key);
    manager.addDocument('es', situation.es, situation.key);
}

manager.addAnswer('en', 'emotion.sad', 'I am sorry to hear that you are feeling sad. If you need someone to talk to, there are many resources available to help you.');
manager.addAnswer('es', 'emotion.sad', 'Lamento escuchar que te sientes triste. Si necesitas hablar con alguien, hay muchos recursos disponibles para ayudarte.');
manager.addAnswer('en', 'emotion.happy', 'I am glad to hear that you are feeling happy! Remember, your happiness is important.');
manager.addAnswer('es', 'emotion.happy', '¡Me alegra saber que te sientes feliz! Recuerda, tu felicidad es importante.');
manager.addAnswer('en', 'emotion.help', 'It is okay to ask for help. If you need support, here are some resources that might be helpful for you.');
manager.addAnswer('es', 'emotion.help', 'Está bien pedir ayuda. Si necesitas apoyo, aquí tienes algunos recursos que pueden ser útiles para ti.');


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

trainNlp();

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

bot.on('callback_query', (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const locale = callbackQuery.data;
    i18n.setLocale(locale);
    bot.sendMessage(chatId, i18n.__('Idioma cambiado a %s', i18n.getLocale()));
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;

    try {
        const language = msg.from.language_code && ['en', 'es'].includes(msg.from.language_code) ? msg.from.language_code : 'es';
        const response = await manager.process(language, msg.text);

        if (!response.intent || response.intent === 'None') {
            const doc = await wtf.fetch(msg.text, language);
            if (doc && doc.sections(0) && doc.sections(0).paragraphs(0) && doc.sections(0).paragraphs(0).sentences(0)) {
                const summary = doc.sections(0).paragraphs(0).sentences(0).text();
                bot.sendMessage(chatId, summary);
            } else {
                bot.sendMessage(chatId, i18n.__('Lo siento, no entiendo eso. ¿Podrías reformularlo?'));
            }
        } else {
            bot.sendMessage(chatId, response.answer);
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
