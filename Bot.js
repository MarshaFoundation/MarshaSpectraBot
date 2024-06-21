const TelegramBot = require('node-telegram-bot-api');
const i18n = require('i18n');
const wtf = require('wtf_wikipedia');
const axios = require('axios');
require('dotenv').config();
const { Pool } = require('pg');

// Configuración de la conexión a PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Permite conexiones SSL sin validación explícita
  }
});

// Verificar la conexión y crear la tabla "users" si no existe
pool.connect()
  .then(client => {
    console.log('Conexión exitosa a PostgreSQL');
    return client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        chat_id BIGINT UNIQUE NOT NULL,
        locale VARCHAR(10) DEFAULT 'es'
      );
    `).then(() => {
      client.release();
      console.log('Tabla "users" verificada o creada');
    });
  })
  .catch(err => {
    console.error('Error de conexión a PostgreSQL:', err);
  });

// Verificar que las variables de entorno están cargadas correctamente
console.log('TELEGRAM_API_KEY:', process.env.TELEGRAM_API_KEY);
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY);
console.log('DATABASE_URL:', process.env.DATABASE_URL);

const token = process.env.TELEGRAM_API_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;
const assistantName = 'SilvIA+'; // Nombre del asistente

// Configuración de i18n
i18n.configure({
  locales: ['en', 'es'],
  directory: __dirname + '/locales',
  defaultLocale: 'es',
  queryParameter: 'lang',
  cookie: 'locale',
});

// Crear instancia del bot después de haber definido TelegramBot
const bot = new TelegramBot(token, { polling: true });
console.log('Bot iniciado correctamente');

// Función para hacer la llamada a OpenAI y cachear respuestas
const cachedResponses = new Map(); // Caché para almacenar respuestas de OpenAI

async function getChatGPTResponse(messages) {
  const messagesKey = JSON.stringify(messages);
  if (cachedResponses.has(messagesKey)) {
    return cachedResponses.get(messagesKey);
  }

  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: messages,
      temperature: 0.7,
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      }
    });

    const gptResponse = response.data.choices[0].message.content.trim();
    cachedResponses.set(messagesKey, gptResponse);

    return gptResponse;
  } catch (error) {
    console.error('Error al llamar a OpenAI:', error);
    return 'Lo siento, actualmente no puedo procesar tu solicitud.';
  }
}

// Función para obtener el idioma del usuario desde la base de datos
async function getUserLocale(chatId) {
  try {
    const res = await pool.query('SELECT locale FROM users WHERE chat_id = $1', [chatId]);
    if (res.rows.length > 0) {
      return res.rows[0].locale;
    } else {
      return 'es'; // Idioma predeterminado si no se encuentra en la base de datos
    }
  } catch (error) {
    console.error('Error al obtener el idioma del usuario:', error);
    return 'es';
  }
}

// Función para actualizar/guardar el idioma del usuario en la base de datos
async function setUserLocale(chatId, locale) {
  try {
    await pool.query('INSERT INTO users (chat_id, locale) VALUES ($1, $2) ON CONFLICT (chat_id) DO UPDATE SET locale = $2', [chatId, locale]);
  } catch (error) {
    console.error('Error al configurar el idioma del usuario:', error);
  }
}

// Función para determinar si el mensaje es un saludo
function isGreeting(message) {
  const greetings = ['hola', 'hi', 'hello', 'qué tal', 'buenas', 'hey'];
  const normalizedMessage = message.trim().toLowerCase();
  return greetings.includes(normalizedMessage);
}

// Función para determinar si el mensaje es una pregunta por el nombre del asistente
function isAskingName(message) {
  const askingNames = ['¿cuál es tu nombre?', 'cuál es tu nombre?', 'como te llamas?', 'cómo te llamas?', '¿como te llamas?', 'nombre?', 'dime tu nombre'];
  const normalizedMessage = message.trim().toLowerCase();
  return askingNames.includes(normalizedMessage);
}

// Almacén temporal para mensajes por chat
const chatMessageHistory = new Map();

// Escuchar todos los mensajes entrantes
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userMessage = msg.text;

  // Obtener o inicializar historial de mensajes para este chat
  let messageHistory = chatMessageHistory.get(chatId);
  if (!messageHistory) {
    messageHistory = [];
    chatMessageHistory.set(chatId, messageHistory);
  }

  // Guardar el mensaje actual en el historial
  messageHistory.push(userMessage);

  // Obtener idioma del usuario
  const locale = await getUserLocale(chatId);
  i18n.setLocale(locale);

  try {
    if (isGreeting(userMessage)) {
      // Si el mensaje es un saludo, enviar mensaje de bienvenida
      const welcomeMessage = `Hola! Bienvenid@! Soy ${assistantName}, una IA avanzada propiedad de Marsha+ =), y el primer asistente LGTBI+ creado en el mundo. www.marshafoundation.org info@marshafoundation.org ¿En qué puedo asistirte hoy?`;
      bot.sendMessage(chatId, welcomeMessage);
    } else if (isAskingName(userMessage)) {
      // Si el mensaje es una pregunta por el nombre del asistente
      bot.sendMessage(chatId, assistantName);
    } else if (userMessage.toLowerCase().includes('/historial')) {
      // Si el mensaje contiene "/historial", mostrar el historial de conversación
      if (messageHistory.length > 0) {
        const conversationHistory = messageHistory.join('\n');
        bot.sendMessage(chatId, `Historial de Conversación:\n\n${conversationHistory}`);
      } else {
        bot.sendMessage(chatId, 'No hay historial de conversación disponible.');
      }
    } else {
      // Otro tipo de mensaje, procesar según sea necesario
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
    }
  } catch (error) {
    console.error('Error al procesar el mensaje:', error);
    bot.sendMessage(chatId, i18n.__('Ha ocurrido un error al procesar tu mensaje. Intenta nuevamente más tarde.'));
  }
});

// Función para limpiar historial de mensajes
function clearMessageHistory(chatId) {
  chatMessageHistory.delete(chatId);
}

// Escuchar el evento de cierre del asistente (simulado)
bot.on('close', (chatId) => {
  clearMessageHistory(chatId);
});

// Escuchar el evento de inicio del bot (/start)
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
  const locale = await getUserLocale(chatId);
  i18n.setLocale(locale);
  bot.sendMessage(chatId, i18n.__('¡Hola! Por favor, elige tu idioma.'), opts);
});

// Manejar el cambio de idioma desde los botones de selección
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const locale = callbackQuery.data;
  i18n.setLocale(locale);
  await setUserLocale(chatId, locale);
  bot.sendMessage(chatId, i18n.__('Idioma cambiado a %s', i18n.getLocale()));
});

// Manejar errores de polling del bot
bot.on('polling_error', (error) => {
  console.error('Error de polling:', error);
});

// Manejar errores no capturados en el proceso
process.on('uncaughtException', (err) => {
  console.error('Error no capturado:', err);
});

// Manejar rechazos no manejados en promesas
process.on('unhandledRejection', (reason, promise) => {
  console.error('Error no manejado:', reason, 'promise:', promise);
});

