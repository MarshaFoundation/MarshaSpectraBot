const TelegramBot = require('node-telegram-bot-api');
const { token } = require('../config/config');

const bot = new TelegramBot(token, { polling: true });

async function enviarMensajeDirecto(chatId, mensaje) {
  try {
    const response = await bot.sendMessage(chatId, mensaje);
    console.log(`Mensaje enviado a ${chatId}: ${mensaje}`);
    return response;
  } catch (error) {
    console.error(`Error al enviar mensaje a ${chatId}:`, error);
    throw error;
  }
}

module.exports = { bot, enviarMensajeDirecto };
