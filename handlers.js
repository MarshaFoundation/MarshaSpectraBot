const wtf = require('wtf_wikipedia');
const { getChatGPTResponse } = require('./openai');
const { getUserLocale } = require('./database');
const i18n = require('i18n');

async function handleUserMessage(bot, msg) {
    const chatId = msg.chat.id;
    const userMessage = msg.text;
    
    const locale = await getUserLocale(chatId);
    i18n.setLocale(locale);

    try {
        const prompt = { role: 'user', content: userMessage };
        const messages = [prompt];
        const gptResponse = await getChatGPTResponse(messages);

        if (!gptResponse) {
            const doc = await wtf.fetch(userMessage, locale);
            const summary = doc && doc.sections(0).paragraphs(0).sentences(0).text();
            bot.sendMessage(chatId, summary || i18n.__('Lo siento, no entiendo eso. ¿Podrías reformularlo?'));
        } else {
            bot.sendMessage(chatId, gptResponse);
        }
    } catch (error) {
        console.error('Error al procesar el mensaje:', error);
        bot.sendMessage(chatId, i18n.__('Ha ocurrido un error al procesar tu mensaje. Intenta nuevamente más tarde.'));
    }
}

function configureI18n(i18n) {
    i18n.configure({
        locales: ['en', 'es'],
        directory: __dirname + '/locales',
        defaultLocale: 'es',
        queryParameter: 'lang',
        cookie: 'locale',
    });
}

module.exports = {
    handleUserMessage,
    configureI18n,
};
