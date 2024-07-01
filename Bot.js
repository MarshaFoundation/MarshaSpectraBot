const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// Variables de entorno
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

// Almacenamiento temporal para mensajes por chat
const chatMessageHistory = new Map();

// Mapa para cachear respuestas de OpenAI
const cachedResponses = new Map();

// Función para obtener respuesta de OpenAI con ajustes dinámicos
async function getChatGPTResponse(messages) {
  const messagesKey = JSON.stringify(messages);
  if (cachedResponses.has(messagesKey)) {
    return cachedResponses.get(messagesKey);
  }

  // Parámetros iniciales
  let temperature = 0.7;
  let maxTokens = 200;
  let topP = 0.9;

  // Lógica para ajuste dinámico de parámetros según el último mensaje
  const lastUserMessage = messages.filter(msg => msg.role === 'user').pop();
  if (lastUserMessage) {
    const userText = lastUserMessage.content.toLowerCase();
    if (userText.includes('ayuda')) {
      temperature = 0.5;
      maxTokens = 150;
      topP = 0.8;
    } else if (userText.includes('gracias') || userText.includes('agradecido')) {
      temperature = 0.3;
      maxTokens = 100;
      topP = 0.7;
    } else if (userText.includes('información')) {
      temperature = 0.6;
      maxTokens = 180;
      topP = 0.85;
    } else if (userText.includes('adiós') || userText.includes('hasta luego')) {
      temperature = 0.4;
      maxTokens = 120;
      topP = 0.75;
    } else if (userText.includes('broma') || userText.includes('chiste')) {
      temperature = 0.7;
      maxTokens = 200;
      topP = 0.9;
    } else if (userText.includes('cuéntame más') || userText.includes('explícame')) {
      temperature = 0.6;
      maxTokens = 180;
      topP = 0.85;
    } else if (userText.includes('tienes tiempo')) {
      temperature = 0.4;
      maxTokens = 150;
      topP = 0.8;
    } else if (userText.includes('necesito ayuda urgente')) {
      temperature = 0.8;
      maxTokens = 250;
      topP = 0.95;
    } else if (userText.includes('eres un robot') || userText.includes('eres humano')) {
      temperature = 0.5;
      maxTokens = 160;
      topP = 0.85;
    } else if (userText.includes('qué opinas de')) {
      temperature = 0.6;
      maxTokens = 180;
      topP = 0.85;
    } else if (userText.includes('cuál es tu nombre')) {
      temperature = 0.3;
      maxTokens = 100;
      topP = 0.7;
    } else if (userText.includes('recursos de apoyo lgtbi')) {
      temperature = 0.6;
      maxTokens = 180;
      topP = 0.85;
    } else if (userText.includes('derechos lgtbi')) {
      temperature = 0.6;
      maxTokens = 180;
      topP = 0.85;
    } else if (userText.includes('definiciones lgtbi')) {
      temperature = 0.6;
      maxTokens = 180;
      topP = 0.85;
    } else if (userText.includes('eventos lgtbi')) {
      temperature = 0.5;
      maxTokens = 160;
      topP = 0.8;
    } else if (userText.includes('pronombres y género')) {
      temperature = 0.5;
      maxTokens = 160;
      topP = 0.8;
    } else if (userText.includes('discriminación lgtbi')) {
      temperature = 0.7;
      maxTokens = 200;
      topP = 0.9;
    } else if (userText.includes('apoyo familiar lgtbi')) {
      temperature = 0.6;
      maxTokens = 180;
      topP = 0.85;
    } else if (userText.includes('historia lgtbi')) {
      temperature = 0.6;
      maxTokens = 180;
      topP = 0.85;
    } else if (userText.includes('salud mental lgtbi')) {
      temperature = 0.6;
      maxTokens = 180;
      topP = 0.85;
    } else if (userText.includes('temas lgtbi')) {
      temperature = 0.6;
      maxTokens = 180;
      topP = 0.85;
    } else if (userText.includes('opinión lgtbi')) {
      temperature = 0.5;
      maxTokens = 160;
      topP = 0.8;
    }
  }

  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: messages,
      temperature: temperature,
      max_tokens: maxTokens,
      top_p: topP
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      }
    });

    let gptResponse = response.data.choices[0].message.content.trim();

    // Limitar la longitud de la respuesta
    if (gptResponse.length > 200) {
      gptResponse = gptResponse.split('. ').slice(0, 3).join('. ') + '.';
    }

    // Almacenar en caché la respuesta
    cachedResponses.set(messagesKey, gptResponse);

    return gptResponse;
  } catch (error) {
    console.error('Error al llamar a OpenAI:', error);
    return 'Lo siento, no puedo responder en este momento.';
  }
}

// Función para obtener el idioma del usuario desde la base de datos
async function getUserLocale(chatId) {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT locale FROM users WHERE chat_id = $1', [chatId]);
    if (result.rows.length > 0) {
      return result.rows[0].locale;
    } else {
      // Si el usuario no está en la base de datos, se usa 'es' como idioma predeterminado
      return 'es';
    }
  } catch (error) {
    console.error('Error al obtener el idioma del usuario:', error);
    // En caso de error, se devuelve 'es' como idioma predeterminado
    return 'es';
  } finally {
    client.release();
  }
}

// Función para actualizar/guardar el idioma del usuario en la base de datos
async function setUserLocale(chatId, locale) {
  const queryText =
    `INSERT INTO users (chat_id, locale)
     VALUES ($1, $2)
     ON CONFLICT (chat_id)
     DO UPDATE SET locale = $2`;

  let client;
  try {
    client = await pool.connect();
    await client.query(queryText, [chatId, locale]);
    console.log(`Idioma del usuario ${chatId} actualizado a ${locale}`);
  } catch (error) {
    console.error('Error al configurar el idioma del usuario:', error);
  } finally {
    if (client) client.release();
  }
}

// Función para enviar mensaje directo a un usuario
async function enviarMensajeDirecto(chatId, mensaje) {
  try {
    const response = await bot.sendMessage(chatId, mensaje);
    console.log(`Mensaje enviado a ${chatId}: ${mensaje}`);
    return response;
  } catch (error) {
    console.error(`Error al enviar mensaje a ${chatId}:`, error);
    throw error; // Propagar el error para manejarlo en el lugar donde se llama a esta función
  }
}

// Función genérica para comparar mensajes
function matchPhrases(message, phrases) {
  const normalizedMessage = message.trim().toLowerCase();
  return phrases.includes(normalizedMessage);
}

// Manejador de comandos /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name;

  const welcomeMessage = `Hola ${firstName}! ${assistantDescription}`;
  await bot.sendMessage(chatId, welcomeMessage);

  const userMessage = {
    role: 'user',
    content: '/start'
  };
  chatMessageHistory.set(chatId, [userMessage]);
});

// Manejador de comandos /help
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;

  const helpMessage = 'Puedo ayudarte con información LGTBI+ y responder preguntas sobre diversos temas. ¡Pregúntame lo que quieras!';
  await bot.sendMessage(chatId, helpMessage);

  const userMessage = {
    role: 'user',
    content: '/help'
  };
  chatMessageHistory.set(chatId, [userMessage]);
});

// Manejador de comandos /about
bot.onText(/\/about/, async (msg) => {
  const chatId = msg.chat.id;

  const aboutMessage = assistantDescription;
  await bot.sendMessage(chatId, aboutMessage);

  const userMessage = {
    role: 'user',
    content: '/about'
  };
  chatMessageHistory.set(chatId, [userMessage]);
});

// Manejador de mensajes de texto
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const messageId = msg.message_id;
  const messageText = msg.text;

  if (!messageText) return;

  // Obtener historial de mensajes del chat
  let messages = chatMessageHistory.get(chatId) || [];

  // Añadir mensaje del usuario al historial
  messages.push({
    role: 'user',
    content: messageText
  });

  // Actualizar el historial de mensajes del chat
  chatMessageHistory.set(chatId, messages);

  try {
    // Obtener respuesta de OpenAI
    const responseText = await getChatGPTResponse(messages);

    // Enviar respuesta al usuario
    await bot.sendMessage(chatId, responseText);

    // Añadir mensaje de respuesta de OpenAI al historial
    messages.push({
      role: 'assistant',
      content: responseText
    });

    // Actualizar el historial de mensajes del chat
    chatMessageHistory.set(chatId, messages);

    // Guardar mensaje de respuesta en la base de datos
    const client = await pool.connect();
    try {
      await client.query('INSERT INTO messages (chat_id, message_id, content) VALUES ($1, $2, $3)', [chatId, messageId, responseText]);
    } catch (error) {
      console.error('Error al guardar mensaje en la base de datos:', error);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error al procesar el mensaje:', error);
  }
});

// Manejador de eventos de fotos
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;

  const responseText = 'Gracias por la foto! No puedo procesar imágenes, pero puedes preguntarme cualquier otra cosa.';
  await bot.sendMessage(chatId, responseText);

  const userMessage = {
    role: 'user',
    content: 'Photo message'
  };
  chatMessageHistory.set(chatId, [userMessage]);
});

// Manejador de eventos de ubicación
bot.on('location', async (msg) => {
  const chatId = msg.chat.id;

  const responseText = 'Gracias por compartir tu ubicación! No puedo procesar ubicaciones, pero puedes preguntarme cualquier otra cosa.';
  await bot.sendMessage(chatId, responseText);

  const userMessage = {
    role: 'user',
    content: 'Location message'
  };
  chatMessageHistory.set(chatId, [userMessage]);
});

// Manejador de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('Excepción no capturada:', error);
  if (ADMIN_CHAT_ID) {
    enviarMensajeDirecto(ADMIN_CHAT_ID, `Excepción no capturada: ${error.message}`);
  }
});

// Manejador para promesas rechazadas
process.on('unhandledRejection', (reason, promise) => {
  console.error('Promesa rechazada:', reason);
  if (ADMIN_CHAT_ID) {
    enviarMensajeDirecto(ADMIN_CHAT_ID, `Promesa rechazada: ${reason}`);
  }
});



































































































































