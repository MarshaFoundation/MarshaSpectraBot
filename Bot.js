const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const token = process.env.TELEGRAM_API_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;
const assistantName = 'SilvIA+';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID; // Asegúrate de definir ADMIN_CHAT_ID en tu .env

// Configuración de la conexión a PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Conexión SSL sin validación explícita, ajusta esto en producción según sea necesario
  }
});

// Crear instancia del bot después de haber definido TelegramBot
const bot = new TelegramBot(token, { polling: true });
console.log('Bot iniciado correctamente');

// Almacenamiento temporal para mensajes por chat
const chatMessageHistory = new Map();

// Función para hacer la llamada a OpenAI y cachear respuestas
const cachedResponses = new Map();

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
    const client = await pool.connect();
    const res = await client.query('SELECT locale FROM users WHERE chat_id = $1', [chatId]);
    client.release();
    return res.rows.length > 0 ? res.rows[0].locale : 'es';
  } catch (error) {
    console.error('Error al obtener el idioma del usuario:', error);
    return 'es';
  }
}

// Función para actualizar/guardar el idioma del usuario en la base de datos
async function setUserLocale(chatId, locale) {
  try {
    const client = await pool.connect();
    await client.query('INSERT INTO users (chat_id, locale) VALUES ($1, $2) ON CONFLICT (chat_id) DO UPDATE SET locale = $2', [chatId, locale]);
    client.release();
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

// Función para manejar mensajes de texto
async function handleTextMessage(msg) {
  try {
    const chatId = msg.chat.id;
    const userMessage = msg.text.trim().toLowerCase();

    // Obtener o inicializar historial de mensajes para este chat
    let messageHistory = chatMessageHistory.get(chatId) || [];

 // Función para manejar mensajes de texto
async function handleTextMessage(msg) {
  try {
    const chatId = msg.chat.id; // ID del chat
    const userId = msg.from.id; // ID del usuario que envió el mensaje
    const userFirstName = msg.from.first_name; // Primer nombre del usuario que envió el mensaje
    const userMessage = msg.text.trim().toLowerCase(); // Mensaje del usuario

    // Obtener o inicializar historial de mensajes para este chat
    let messageHistory = chatMessageHistory.get(chatId) || [];

    // Guardar el mensaje actual en el historial
    messageHistory.push({ role: 'user', content: userMessage });
    chatMessageHistory.set(chatId, messageHistory);

    // Verificar si el mensaje contiene información sobre "Loan"
    const loanKeywords = ['loan', 'niño perdido', 'chico perdido', 'encontrado niño', 'vi a loan', 'se donde esta loan', 'encontre al niño', 'vi al nene', 'el nene esta'];

    if (loanKeywords.some(keyword => userMessage.includes(keyword))) {
      // Enviar alerta al grupo administrativo solo si el mensaje contiene frases específicas
      const alertMessage = `🚨 ¡Posible avistamiento del niño perdido! 🚨\n\nMensaje de ${userFirstName} (${userId}):\n${msg.text}`;
      bot.sendMessage(ADMIN_CHAT_ID, alertMessage)
        .then(() => console.log('Mensaje de alerta enviado al grupo administrativo'))
        .catch(error => console.error('Error al enviar mensaje de alerta:', error));
    } else if (isGreeting(userMessage)) {
      // Saludo detectado
      const responseMessage = `¡Hola! Soy ${assistantName}, un asistente avanzado. ¿En qué puedo ayudarte?`;
      bot.sendMessage(chatId, responseMessage);
    } else if (isAskingName(userMessage)) {
      // Pregunta por el nombre del asistente
      bot.sendMessage(chatId, assistantName);
    } else if (userMessage.includes('/historial')) {
      // Comando /historial para obtener historial de conversación
      if (messageHistory.length > 0) {
        const conversationHistory = messageHistory.map(m => m.content).join('\n');
        bot.sendMessage(chatId, `Historial de Conversación:\n\n${conversationHistory}`);
      } else {
        bot.sendMessage(chatId, 'No hay historial de conversación disponible.');
      }
    } else {
      // Consulta a OpenAI o Wikipedia
      const prompt = { role: 'user', content: userMessage };
      const messages = [...messageHistory, prompt];

      const gptResponse = await getChatGPTResponse(messages);
      bot.sendMessage(chatId, gptResponse || 'No entiendo tu solicitud. ¿Podrías reformularla?');
    }
  } catch (error) {
    console.error('Error al manejar mensaje de texto:', error);
  }
}

// Escuchar todos los mensajes entrantes
bot.on('message', async (msg) => {
  if (!msg || (!msg.text && !msg.voice)) {
    console.error('Mensaje entrante no válido:', msg);
    return;
  }

  if (msg.voice) {
    // Procesar mensaje de voz (implementación omitida para brevedad)
    console.log('Mensaje de voz recibido:', msg.voice);
  } else {
    // Procesar mensaje de texto
    handleTextMessage(msg);
  }
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
  bot.sendMessage(chatId, '¡Hola! Por favor, elige tu idioma.', opts);
});

// Manejar el cambio de idioma desde los botones de selección
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const locale = callbackQuery.data;
  await setUserLocale(chatId, locale);
  bot.sendMessage(chatId, `Idioma cambiado a ${locale}`);
});

// Escuchar errores de polling del bot
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

// Función para limpiar el historial de mensajes de un chat
function clearMessageHistory(chatId) {
  chatMessageHistory.delete(chatId);
}

console.log('Bot iniciado correctamente');

