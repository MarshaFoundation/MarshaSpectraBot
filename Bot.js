// bot.js
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios').default;
const { Pool } = require('pg');
const dotenv = require('dotenv');
const getUserLocale = require('./getUserLocale'); // Ajusta la ruta según tu estructura

dotenv.config();

// Variables de entorno y configuración
const token = process.env.TELEGRAM_API_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;
const assistantName = 'SilvIA+';
const assistantDescription = 'el primer asistente LGTBI+ en el mundo =) Desarrollado por Marsha+ Foundation. www.marshafoundation.org, info@marshafoundation.org.';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const DATABASE_URL = process.env.DATABASE_URL;

// Configuración de conexión a PostgreSQL
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Ajusta según tu entorno de base de datos
  }
});

// Crear instancia del bot
const bot = new TelegramBot(token, { polling: true });

console.log('Bot iniciado correctamente');

// Mapa para cachear respuestas de OpenAI (actualizado a GPT-4)
const cachedResponses = new Map();

// Configuración de instancia de Axios para OpenAI
const openai = axios.create({
  baseURL: 'https://api.openai.com/v1',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${openaiApiKey}`,
  }
});

// Función para obtener respuesta de OpenAI (actualizada a GPT-4)
async function getChatGPTResponse(messages) {
  const messagesKey = JSON.stringify(messages);

  try {
    const response = await openai.post('/engines/gpt-4/completions', {
      messages: messages,
      max_tokens: 150,
      temperature: 0.7,
      stop: '\n',
    });

    const gptResponse = response.data.choices[0].text.trim();
    cachedResponses.set(messagesKey, gptResponse);

    return gptResponse;
  } catch (error) {
    console.error('Error al llamar a OpenAI:', error);
    return 'Lo siento, actualmente no puedo procesar tu solicitud.';
  }
}

// Función para actualizar/guardar el idioma del usuario en la base de datos de manera segura
async function setUserLocale(chatId, locale) {
  const queryText = `
    INSERT INTO users (chat_id, locale) 
    VALUES ($1, $2) 
    ON CONFLICT (chat_id) 
    DO UPDATE SET locale = $2
  `;
  
  let client;
  try {
    client = await pool.connect();
    await client.query(queryText, [chatId, locale]);
    console.log(`Idioma del usuario ${chatId} actualizado a ${locale}`);
  } catch (error) {
    console.error('Error al configurar el idioma del usuario:', error);
  } finally {
    if (client) {
      await client.release();
    }
  }
}

// Función genérica para comparar mensajes
function matchPhrases(message, phrases) {
  const normalizedMessage = message.trim().toLowerCase();
  return phrases.includes(normalizedMessage);
}

// Manejar comandos o mensajes recibidos
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text;

  if (messageText) {
    try {
      // Ejemplo: responder a un saludo
      if (matchPhrases(messageText, ['hola', 'buenos días', 'buenas tardes'])) {
        bot.sendMessage(chatId, `¡Hola! Soy ${assistantName}. ¿En qué puedo ayudarte?`);
      } else if (messageText.startsWith('/start')) {
        // Ejemplo: comando /start
        bot.sendMessage(chatId, `¡Hola! Soy ${assistantName}. ¿En qué puedo ayudarte?`);
      } else {
        // Ejemplo: respuesta utilizando OpenAI
        const locale = await getUserLocale(chatId);
        const response = await getChatGPTResponse([{ role: 'user', content: messageText }]);
        bot.sendMessage(chatId, response);
      }
    } catch (error) {
      console.error('Error al manejar el mensaje:', error);
      bot.sendMessage(chatId, 'Lo siento, ocurrió un error al procesar tu mensaje.');
    }
  }
});

// Función para manejar consultas callback
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data.startsWith('setLocale_')) {
    const locale = data.split('_')[1];
    await setUserLocale(chatId, locale);
    bot.sendMessage(chatId, `Idioma configurado a ${locale}`);
  }
});

// Manejar errores de polling
bot.on('polling_error', (error) => {
  console.error('Error de polling:', error);
});

// Manejar errores no capturados
process.on('uncaughtException', (err) => {
  console.error('Error no capturado:', err);
  process.exit(1);
});

// Manejar promesas no manejadas
process.on('unhandledRejection', (reason, promise) => {
  console.error('Error no manejado:', reason, 'promise:', promise);
});






































