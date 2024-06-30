const { bot } = require('../services/telegramService');
const { getChatGPTResponse } = require('../services/openaiService');
const { getUserLocale, setUserLocale } = require('../services/databaseService');
const { responses, greetings, askingNames } = require('../constants/responses');
const { matchPhrases, getRandomResponse } = require('../utils/helpers');

const chatMessageHistory = new Map();

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const messageText = msg.text;

  if (!messageText) return;

  try {
    const userLocale = await getUserLocale(chatId);
    const messageHistory = chatMessageHistory.get(chatId) || [];
    messageHistory.push({ role: 'user', content: messageText });

    if (matchPhrases(messageText, greetings)) {
      const randomGreetingResponse = getRandomResponse(responses.greetings);
      bot.sendMessage(chatId, randomGreetingResponse);
    } else if (matchPhrases(messageText, askingNames)) {
      bot.sendMessage(chatId, responses.name);
    } else {
      const assistantIntro = `¡Hola! Soy ${assistantName}, ${assistantDescription}`;
      const messagesWithIntro = [assistantIntro, ...messageHistory];

      let gptResponse = await getChatGPTResponse(messagesWithIntro);
      
      const lastMessage = messageHistory[messageHistory.length - 1];
      const lastAssistantResponse = lastMessage && lastMessage.role === 'assistant' ? lastMessage.content : null;
      
      if (gptResponse === lastAssistantResponse) {
        gptResponse = await getChatGPTResponse([...messageHistory, `¿En qué más puedo ayudarte?`]);
      }

      bot.sendMessage(chatId, gptResponse);
      messageHistory.push({ role: 'assistant', content: gptResponse });
      chatMessageHistory.set(chatId, messageHistory);
    }
  } catch (error) {
    console.error('Error handling message:', error);
    bot.sendMessage(chatId, 'Lo siento, ocurrió un error al procesar tu mensaje.');
  }
}

module.exports = handleMessage;
