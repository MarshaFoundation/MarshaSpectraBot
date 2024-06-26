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

// Función para obtener respuesta de OpenAI
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
  const queryText = `
    INSERT INTO users (chat_id, locale) 
    VALUES ($1, $2) 
    ON CONFLICT (chat_id) 
    DO UPDATE SET locale = $2
  `;
  
  try {
    const client = await pool.connect();
    await client.query(queryText, [chatId, locale]);
    client.release();
    console.log(`Idioma del usuario ${chatId} actualizado a ${locale}`);
  } catch (error) {
    console.error('Error al configurar el idioma del usuario:', error);
  }
}

// Definición de respuestas para saludos y preguntas sobre el nombre
const responses = {
  greeting: "¡Hola! Soy SilvIA+, tu asistente LGTBI+. ¿En qué puedo ayudarte?",
  name: `Mi nombre es ${assistantName}. ${assistantDescription}`,
};

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
  return phrases.some(phrase => normalizedMessage.includes(phrase));
}

// Función para detectar saludos
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

// Función para detectar preguntas por el nombre del asistente
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

// Función para detectar menciones relacionadas con el niño perdido llamado Loan
const relatedPhrases = [
  'loan perdido','loan','dónde está loan','información de loan','buscando a loan',
  'quién es loan','dime de loan','desaparecido loan','ayuda loan','perdí a loan',
  'perdi a loan','ayuda con loan','sobre loan','que pasó con loan','que paso con loan',
  'situación de loan','estado de loan','dónde está loan','donde está loan','quien es loan',
  'loan information', 'lost loan', 'help find loan', 'loan missing', 'loan gone',
  'where is loan', 'information about loan', 'who is loan', 'tell me about loan', 'lost child loan',
  'loan whereabouts', 'loan situation', 'loan status', 'loan help', 'looking for loan',
  'loan case', 'case of loan', 'find loan', 'seeking loan', 'loan search'
];

// Configurar comandos del bot
bot.setMyCommands([
  { command: '/start', description: 'Iniciar el bot' },
  { command: '/help', description: 'Obtener ayuda' },
  { command: '/about', description: 'Acerca de' },
  { command: '/es', description: 'Cambiar idioma a español' },
  { command: '/en', description: 'Change language to English' }
]);

// Manejar el comando /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userFirstName = msg.from.first_name || '';

  const welcomeMessage = `¡Hola ${userFirstName}! Soy ${assistantName}, tu asistente LGTBI+. ¿En qué puedo ayudarte hoy?`;
  await bot.sendMessage(chatId, welcomeMessage);
});

// Manejar el comando /help
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;

  const helpMessage = `Puedo ayudarte con diversas consultas y tareas. Intenta preguntarme algo o usa los comandos disponibles.`;
  await bot.sendMessage(chatId, helpMessage);
});

// Manejar el comando /about
bot.onText(/\/about/, async (msg) => {
  const chatId = msg.chat.id;

  const aboutMessage = `Soy ${assistantName}, un asistente desarrollado por la Fundación Marsha+ para apoyar a la comunidad LGTBI+. ${assistantDescription}`;
  await bot.sendMessage(chatId, aboutMessage);
});

// Manejar el comando /es
bot.onText(/\/es/, async (msg) => {
  const chatId = msg.chat.id;

  await setUserLocale(chatId, 'es');
  await bot.sendMessage(chatId, 'Idioma cambiado a español.');
});

// Manejar el comando /en
bot.onText(/\/en/, async (msg) => {
  const chatId = msg.chat.id;

  await setUserLocale(chatId, 'en');
  await bot.sendMessage(chatId, 'Language changed to English.');
});

// Manejar mensajes de texto
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text.trim().toLowerCase();

  // Detectar comandos o palabras específicas
  if (matchPhrases(messageText, greetings)) {
    await bot.sendMessage(chatId, responses.greeting);
    return;
  }

  if (matchPhrases(messageText, askingNames)) {
    await bot.sendMessage(chatId, responses.name);
    return;
  }

  if (matchPhrases(messageText, relatedPhrases)) {
    await bot.sendMessage(chatId, 'Lo siento, no tengo información sobre Loan en este momento.');
    return;
  }

  // Obtener historial de mensajes para el chat
  if (!chatMessageHistory.has(chatId)) {
    chatMessageHistory.set(chatId, []);
  }
  const messageHistory = chatMessageHistory.get(chatId);

  // Añadir el mensaje del usuario al historial
  messageHistory.push({ role: 'user', content: msg.text });

  // Limitar el historial a las últimas 10 interacciones para mantener el contexto
  if (messageHistory.length > 10) {
    messageHistory.shift();
  }

  // Obtener respuesta de OpenAI
  const gptResponse = await getChatGPTResponse(messageHistory);

  // Añadir la respuesta de OpenAI al historial
  messageHistory.push({ role: 'assistant', content: gptResponse });

  // Enviar respuesta al usuario
  await bot.sendMessage(chatId, gptResponse);
});

// Manejar errores
bot.on('polling_error', (error) => {
  console.error('Error en el polling:', error);
  // Notificar al administrador
  enviarMensajeDirecto(ADMIN_CHAT_ID, `Error en el bot: ${error.message}`);
});



































