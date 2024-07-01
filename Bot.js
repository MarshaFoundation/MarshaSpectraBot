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

/ Manejador de comandos /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  const welcomeMessage = `¡Hola! Soy ${assistantName}, ${assistantDescription} 😊🌈\n\n¿En qué puedo ayudarte hoy?`;

  try {
    await enviarMensajeDirecto(chatId, welcomeMessage);
  } catch (error) {
    console.error(`Error al enviar mensaje de bienvenida a ${chatId}:`, error);
  }
});

// Manejador de mensajes de texto
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const messageId = msg.message_id;
  const messageText = msg.text;

  // Obtener el idioma del usuario
  const userLocale = await getUserLocale(chatId);

  // Agregar mensaje al historial de mensajes por chat
  if (!chatMessageHistory.has(chatId)) {
    chatMessageHistory.set(chatId, []);
  }

  const chatMessages = chatMessageHistory.get(chatId);
  chatMessages.push({ role: 'user', content: messageText });

  // Limitar el historial de mensajes a los últimos 10 mensajes
  if (chatMessages.length > 10) {
    chatMessages.shift();
  }

  // Actualizar el historial de mensajes por chat
  chatMessageHistory.set(chatId, chatMessages);

  // Obtener respuesta de OpenAI
  try {
    const gptResponse = await getChatGPTResponse(chatMessages);

    // Enviar respuesta al usuario
    await enviarMensajeDirecto(chatId, gptResponse);
  } catch (error) {
    console.error(`Error al procesar mensaje de ${chatId}:`, error);
  }
});

// Manejador de errores no capturados
process.on('uncaughtException', (err) => {
  console.error('Excepción no capturada:', err);
  if (ADMIN_CHAT_ID) {
    bot.sendMessage(ADMIN_CHAT_ID, `Excepción no capturada: ${err.message}`);
  }
});

// Manejador de errores no manejados de promesas rechazadas
process.on('unhandledRejection', (reason, promise) => {
  console.error('Promesa rechazada no manejada:', reason);
  if (ADMIN_CHAT_ID) {
    bot.sendMessage(ADMIN_CHAT_ID, `Promesa rechazada no manejada: ${reason}`);
  }
});

// Funciones para detectar saludos y preguntas por el nombre del asistente
const greetings = [
  'hola', 'hi', 'hello', 'qué tal', 'buenas', 'hey', 'buen día',
  '¿cómo estás?', 'saludos', '¿qué hay?', 'buenas tardes', 'buenas noches',
  '¿cómo va?', '¿qué pasa?', '¿qué hubo?', '¡buenos días!',
  '¿cómo te va?', '¿qué onda?', '¿estás ahí?',
  'good morning', 'good afternoon', 'good evening', 'hey there', 'howdy',
  'what’s up?', 'how are you?', 'greetings', 'how’s it going?', 'what’s new?',
  'how’s everything?', 'long time no see', 'how’s life?', 'hey man', 'hi there',
  'howdy-do', 'what’s happening?', 'how goes it?', 'hey buddy', 'hello there',
  'good day', 'what’s cracking?', 'hey dude', 'what’s the good word?', 'how’s your day?',
  'nice to see you', 'hiya', 'what’s happening?', 'hey friend', 'sup?',
  'how’s your day been?', 'yo', 'what’s popping?'
];

const askingNames = [
  // Formas en español
  '¿cuál es tu nombre?', 'como te llamas?', 'cómo te llamas?', 'nombre?', 'dime tu nombre',
  'cuál es tu nombre', 'me puedes decir tu nombre', 'quiero saber tu nombre', 'cómo te llaman', 
  'cual es tu nombre completo', 'cómo te nombras', 'tu nombre', 'sabes tu nombre', 'cual es su nombre',
  'podrías decirme tu nombre', 'dime el nombre que usas', 'cómo debería llamarte', 'tu nombre por favor',
  'puedo saber tu nombre', 'cómo te conocen', 'quién eres', 'cómo te identificas', 'sabes cómo te llaman',
  'cómo te referirías a ti mismo', 'dame tu nombre', 'qué nombre tienes', 'cómo te identifican', 'tu nombre actual',
  'cómo te apodan', 'sabes tu propio nombre', 'quiero tu nombre', 'dime cómo te llaman', 'sabes tu nombre actual',
  'tu nombre es', 'dime cómo te nombran', 'me gustaría saber tu nombre', 'puedes darme tu nombre', 'dime tu identificación',
  'dime el nombre con el que te conocen', 'dime el nombre que usas', 'sabes cómo te dicen', 'cómo debería llamarte',
  'dime el nombre que tienes', 'cómo debería referirme a ti', 'cómo te identificas tú mismo',

  // Formas en inglés
  'what is your name?', 'what\'s your name?', 'your name?', 'tell me your name', 'could you tell me your name',
  'can you tell me your name', 'may I know your name', 'what do they call you', 'how should I address you',
  'what should I call you', 'could you share your name', 'tell me the name you use', 'what name do you use',
  'may I have your name', 'your full name', 'how do you identify yourself', 'do you know your name', 'your current name',
  'could I know your name', 'your identity', 'who are you', 'how do you call yourself', 'can you reveal your name',
  'may I get your name', 'what are you called', 'may I know your identity', 'what name do you have', 'may I know the name you use',
  'what do people call you', 'tell me your current name', 'your given name', 'your name please', 'what is the name you go by',
  'what is your nickname', 'could you let me know your name', 'what is the name that you use', 'tell me your identification',
  'what should I refer to you as', 'how should I refer to you', 'what do you call yourself'
];

// Manejar mensajes
async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const messageText = msg.text;

  if (!messageText) return;

  try {
    const userLocale = await getUserLocale(chatId);
    const messageHistory = chatMessageHistory.get(chatId) || [];
    messageHistory.push({ role: 'user', content: messageText });

    if (matchPhrases(messageText, greetings)) {
      const greeting = responses.greeting[userLocale][Math.floor(Math.random() * responses.greeting[userLocale].length)];
      await bot.sendMessage(chatId, greeting);
    } else if (matchPhrases(messageText, askingNames)) {
      const nameResponse = responses.name[userLocale][Math.floor(Math.random() * responses.name[userLocale].length)];
      await bot.sendMessage(chatId, nameResponse);
    } else {
      const assistantIntro = { role: 'system', content: `Eres un asistente llamado ${assistantName}. ${assistantDescription}` };
      const messagesWithIntro = [assistantIntro, ...messageHistory];

      const gptResponse = await getChatGPTResponse(messagesWithIntro);
      await bot.sendMessage(chatId, gptResponse);

      messageHistory.push({ role: 'assistant', content: gptResponse });
      chatMessageHistory.set(chatId, messageHistory);
    }
  } catch (error) {
    console.error('Error handling message:', error);
    await bot.sendMessage(chatId, 'Lo siento, ocurrió un error al procesar tu mensaje.');
  }
}

// Manejar el comando /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const welcomeMessage = `¡Hola! Soy ${assistantName}, tu asistente. ¿Cómo puedo ayudarte hoy?`;
  await bot.sendMessage(chatId, welcomeMessage);
});

// Manejar el comando /help
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  const helpMessage = `¡Hola! Soy ${assistantName}, tu asistente. Estoy aquí para ayudarte en temas relacionados con LGTBI+. Puedes hacerme preguntas sobre derechos LGTBI, recursos de apoyo, eventos y más. ¿En qué puedo asistirte hoy?`;
  await bot.sendMessage(chatId, helpMessage);
});

// Manejar el comando /about
bot.onText(/\/about/, async (msg) => {
  const chatId = msg.chat.id;
  const aboutMessage = `Soy ${assistantName}, el primer asistente LGTBI+ en el mundo, desarrollado por Marsha+ Foundation. Estoy aquí para ayudarte con información y apoyo sobre temas relacionados con la comunidad LGTBI+. Puedes visitar www.marshafoundation.org o escribir a info@marshafoundation.org para más detalles.`;
  await bot.sendMessage(chatId, aboutMessage);
});

// Manejar el comando /events
bot.onText(/\/events/, async (msg) => {
  const chatId = msg.chat.id;
  const eventsMessage = `Aquí puedes encontrar información sobre eventos LGTBI+. Mantente actualizado con actividades locales e internacionales que promueven la inclusión y diversidad.`;
  await bot.sendMessage(chatId, eventsMessage);
});

// Manejar el comando /rights
bot.onText(/\/rights/, async (msg) => {
  const chatId = msg.chat.id;
  const rightsMessage = `Los derechos LGTBI+ varían según el país y la región. Puedo proporcionarte información general sobre derechos legales, pero te recomiendo consultar con organizaciones locales para detalles específicos.`;
  await bot.sendMessage(chatId, rightsMessage);
});

// Manejar el comando /support
bot.onText(/\/support/, async (msg) => {
  const chatId = msg.chat.id;
  const supportMessage = `Hay muchos recursos de apoyo disponibles para personas LGTBI+. Puedo ayudarte a encontrar organizaciones locales que ofrecen servicios de apoyo, desde salud mental hasta grupos comunitarios.`;
  await bot.sendMessage(chatId, supportMessage);
});

// Manejar el comando /pronouns
bot.onText(/\/pronouns/, async (msg) => {
  const chatId = msg.chat.id;
  const pronounsMessage = `Los pronombres son una parte importante del respeto hacia las personas LGTBI+. Puedo proporcionarte información sobre pronombres y género, así como su importancia en la identidad de cada persona.`;
  await bot.sendMessage(chatId, pronounsMessage);
});

// Manejar el comando /discrimination
bot.onText(/\/discrimination/, async (msg) => {
  const chatId = msg.chat.id;
  const discriminationMessage = `La discriminación contra personas LGTBI+ es lamentablemente común. Puedo ofrecerte información sobre formas de enfrentar la discriminación y recursos para recibir apoyo legal y emocional.`;
  await bot.sendMessage(chatId, discriminationMessage);
});

// Manejar el comando /mentalhealth
bot.onText(/\/mentalhealth/, async (msg) => {
  const chatId = msg.chat.id;
  const mentalHealthMessage = `La salud mental es crucial para todas las personas, incluidas las LGTBI+. Puedo proporcionarte recursos y consejos para mantener una buena salud mental en un ambiente inclusivo.`;
  await bot.sendMessage(chatId, mentalHealthMessage);
});

// Manejar el comando /history
bot.onText(/\/history/, async (msg) => {
  const chatId = msg.chat.id;
  const historyMessage = `La historia LGTBI+ tiene raíces profundas y una rica herencia cultural. Puedo compartir contigo eventos históricos y figuras clave que han influenciado el movimiento.`;
  await bot.sendMessage(chatId, historyMessage);
});

// Manejar el comando /community
bot.onText(/\/community/, async (msg) => {
  const chatId = msg.chat.id;
  const communityMessage = `La comunidad LGTBI+ es diversa y vibrante. Puedo ayudarte a conectarte con grupos comunitarios locales o plataformas en línea donde puedes encontrar apoyo y camaradería.`;
  await bot.sendMessage(chatId, communityMessage);
});

// Manejar el comando /faq
bot.onText(/\/faq/, async (msg) => {
  const chatId = msg.chat.id;
  const faqMessage = `Aquí puedes encontrar respuestas a preguntas frecuentes sobre temas LGTBI+. Si tienes alguna pregunta específica, ¡no dudes en preguntar!`;
  await bot.sendMessage(chatId, faqMessage);
});

// Manejar cualquier otro mensaje
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const defaultMessage = `Lo siento, no entendí ese comando. Puedes usar /help para ver la lista de comandos disponibles.`;
  await bot.sendMessage(chatId, defaultMessage);
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

// Manejar rechazos no manejados
process.on('unhandledRejection', (reason, promise) => {
  console.error('Error no manejado:', reason, 'promise:', promise);
});

// Manejar fotos enviadas por el usuario
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const fileId = msg.photo[0].file_id;

  // Aquí puedes procesar la imagen, por ejemplo, guardarla o enviar una respuesta adecuada
  await bot.sendPhoto(chatId, fileId, { caption: '¡Gracias por compartir esta imagen!' });
});

// Manejar ubicaciones enviadas por el usuario
bot.on('location', async (msg) => {
  const chatId = msg.chat.id;
  const latitude = msg.location.latitude;
  const longitude = msg.location.longitude;

  // Aquí puedes procesar la ubicación, por ejemplo, buscar lugares cercanos o proporcionar información útil
  const locationMessage = `Tu ubicación recibida: Latitud ${latitude}, Longitud ${longitude}. ¿En qué más puedo ayudarte?`;
  await bot.sendMessage(chatId, locationMessage);
});

// Inicialización de la base de datos
(async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        chat_id BIGINT PRIMARY KEY,
        locale TEXT NOT NULL DEFAULT 'es'
      )
    `);
    console.log('Tabla de usuarios creada correctamente');
  } catch (error) {
    console.error('Error al crear la tabla de usuarios:', error);
  } finally {
    client.release();
  }
})();


































































































































