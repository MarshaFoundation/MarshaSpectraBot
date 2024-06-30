const dotenv = require('dotenv');
dotenv.config();

const { bot } = require('./services/telegramService');
const handleMessage = require('./handlers/messageHandler');

console.log('Bot iniciado correctamente');

bot.on('message', handleMessage);

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

console.log('Bot listo para recibir mensajes.');
