const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// Configuración de variables de entorno
const token = process.env.TELEGRAM_API_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;
const assistantName = 'SilvIA+';
const assistantDescription = 'Mi nombre es SilvIA, el primer asistente LGTBI+ en el mundo. Desarrollado por Marsha+ Foundation. www.marshafoundation.org, info@marshafoundation.org.';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const DATABASE_URL = process.env.DATABASE_URL;

// Configuración de la conexión a PostgreSQL
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Ajusta esta configuración según tu entorno de base de datos
  }
});

// Crear instancia del bot
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

// Función para enviar un mensaje directo a un usuario dado su chat_id
async function enviarMensajeDirecto(chatId, mensaje) {
  try {
    await bot.sendMessage(chatId, mensaje);
    console.log(`Mensaje enviado a ${chatId}: ${mensaje}`);
  } catch (error) {
    console.error(`Error al enviar mensaje a ${chatId}:`, error);
  }
}

// Función para determinar si el mensaje es un saludo
function isGreeting(message) {
  const greetings = ['hola!','hola', 'hi', 'hello', 'qué tal', 'buenas', 'hey'];
  const normalizedMessage = message.trim().toLowerCase();
  return greetings.includes(normalizedMessage);
}

// Función para determinar si el mensaje es una pregunta por el nombre del asistente
function isAskingName(message) {
  const askingNames = ['¿cuál es tu nombre?', 'cuál es tu nombre?', 'como te llamas?', 'cómo te llamas?', '¿como te llamas?', 'nombre?', 'dime tu nombre'];
  const normalizedMessage = message.trim().toLowerCase();
  return askingNames.includes(normalizedMessage);
}

// Función para manejar el reporte de avistamiento del niño perdido
async function handleMissingChildReport(msg) {
  const chatId = msg.chat.id;

  try {
    await bot.sendMessage(chatId, '🚨 ¡Posible avistamiento del niño perdido! 🚨');
    await bot.sendMessage(ADMIN_CHAT_ID, `Mensaje de ${msg.from.first_name} | ${msg.chat.username || msg.chat.id}:\n${msg.text}`);
    await bot.sendMessage(chatId, 'Gracias por tu mensaje. Hemos notificado a las autoridades competentes. ¿Puedo ayudarte con algo más?');
  } catch (error) {
    console.error(`Error al manejar el reporte de avistamiento del niño perdido:`, error);
  }
}

// Manejar el reporte de avistamiento del niño perdido
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const messageText = msg.text.toLowerCase();

    if (messageText.includes('loan')) {
        // Solicitar ubicación al usuario de manera contextual
        const request = "¿Podrías compartir tu ubicación actual para ayudarnos en la búsqueda del niño perdido?";
        bot.sendMessage(chatId, request, {
            reply_markup: {
                keyboard: [
                    [{
                        text: "Compartir ubicación",
                        request_location: true // Solicitar ubicación
                    }]
                ],
                resize_keyboard: true
            }
        });
    } else {
        // Manejar otros mensajes como se haría normalmente
        await bot.sendMessage(chatId, '¡Hola! Soy SilvIA, el primer asistente LGTBI+ en el mundo. Desarrollado por Marsha+ Foundation. www.marshafoundation.org, info@marshafoundation.org. ¿En qué puedo ayudarte?');
    }
});

// Manejar mensajes de texto y comandos
bot.on('message', async (msg) => {
  try {
    if (!msg || (!msg.text && !msg.voice)) {
      console.error('Mensaje entrante no válido:', msg);
      return;
    }

    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userMessage = msg.text.trim().toLowerCase();

    // Obtener o inicializar historial de mensajes para este chat
    let messageHistory = chatMessageHistory.get(chatId) || [];
    messageHistory.push({ role: 'user', content: userMessage });
    chatMessageHistory.set(chatId, messageHistory);

    // Saludo detectado
    if (isGreeting(userMessage)) {
      const responseMessage = `¡Hola! Soy ${assistantName}, ${assistantDescription}. ¿En qué puedo ayudarte?`;
      bot.sendMessage(chatId, responseMessage);
    }
    // Pregunta por el nombre del asistente
    else if (isAskingName(userMessage)) {
      const responseMessage = `Mi nombre es ${assistantName}, ${assistantDescription}`;
      bot.sendMessage(chatId, responseMessage);
    }
    // Reporte de avistamiento del niño perdido
    else if (userMessage.includes('loan')) {
      await handleMissingChildReport(msg);
    }
    // Consulta a OpenAI o Wikipedia
    else {
      const prompt = { role: 'user', content: userMessage };
      const messages = [...messageHistory, prompt];
      const gptResponse = await getChatGPTResponse(messages);
      bot.sendMessage(chatId, gptResponse || 'No entiendo tu solicitud. ¿Podrías reformularla?');
    }
  } catch (error) {
    console.error('Error al manejar mensaje de texto:', error);
  }
});

// Manejar el evento de inicio del bot (/start)
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

// Solicitar ubicación al usuario
bot.onText(/\/ubicacion/, (msg) => {
  const chatId = msg.chat.id;
  const request = "Por favor, comparte tu ubicación actual para ayudarnos en la búsqueda del niño perdido.";

  bot.sendMessage(chatId, request, {
    reply_markup: {
      keyboard: [
        [{
          text: "Compartir ubicación",
          request_location: true // Solicitar ubicación
        }]
      ],
      resize_keyboard: true
    }
  });
});

// Manejar la respuesta de ubicación del usuario
bot.on('location', async (msg) => {
  const chatId = msg.chat.id;
  const latitude = msg.location.latitude;
  const longitude = msg.location.longitude;

  // Guardar o utilizar la ubicación recibida para ayudar en la búsqueda del niño perdido
  console.log(`Ubicación recibida de ${chatId}: Latitud ${latitude}, Longitud ${longitude}`);

  // Puedes enviar un agradecimiento o confirmación al usuario
  await bot.sendMessage(chatId, "¡Gracias por compartir tu ubicación! Esto nos ayuda mucho en la búsqueda.");
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

// Iniciar el bot
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

// Solicitar ubicación al usuario
bot.onText(/\/ubicacion/, (msg) => {
  const chatId = msg.chat.id;
  const request = "Por favor, comparte tu ubicación actual para ayudarnos en la búsqueda del niño perdido.";

  bot.sendMessage(chatId, request, {
    reply_markup: {
      keyboard: [
        [{
          text: "Compartir ubicación",
          request_location: true // Solicitar ubicación
        }]
      ],
      resize_keyboard: true
    }
  });
});

// Manejar la respuesta de ubicación del usuario
bot.on('location', async (msg) => {
  const chatId = msg.chat.id;
  const latitude = msg.location.latitude;
  const longitude = msg.location.longitude;

  // Guardar o utilizar la ubicación recibida para ayudar en la búsqueda del niño perdido
  console.log(`Ubicación recibida de ${chatId}: Latitud ${latitude}, Longitud ${longitude}`);

  // Puedes enviar un agradecimiento o confirmación al usuario
  await bot.sendMessage(chatId, "¡Gracias por compartir tu ubicación! Esto nos ayuda mucho en la búsqueda.");
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



