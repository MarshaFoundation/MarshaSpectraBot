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

// Función para detectar saludos
function isGreeting(message) {
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

  const normalizedMessage = message.trim().toLowerCase();
  return greetings.includes(normalizedMessage);
}

// Función para detectar preguntas por el nombre del asistente
function isAskingName(message) {
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

  const normalizedMessage = message.trim().toLowerCase();
  return askingNames.includes(normalizedMessage);
}

// Función para detectar menciones relacionadas con el niño perdido llamado Loan
function mentionsLostChild(message) {
  const relatedPhrases = [
    'loan perdido','loan','vi a loan', 'encontré a loan', 'busco a loan', 'dónde está loan', 'ayuda con loan',
    'loan está perdido', 'buscando a loan', 'vimos a loan', 'he visto a loan', 'he encontrado a loan',
    'loan desapareció', 'loan se perdió', 'loan necesita ayuda', 'loan encontrado', 'tengo información sobre loan',
    'loan está solo', 'he encontrado a un niño llamado loan', 'un niño llamado loan', 'ví a un niño llamado loan',
    'vi a loan en el parque', 'loan fue visto cerca de mi casa', 'creo haber visto a loan ayer', 'loan podría estar en el centro comercial',
    'alguien vio a loan por aquí', 'loan desapareció hace una semana', 'me dijeron que loan fue visto en el parque',
    'loan fue encontrado por la policía', 'buscamos a loan por todos lados', 'loan necesita ser encontrado lo antes posible',
    'loan podría estar en problemas', 'me preocupa la seguridad de loan', 'he visto a un niño perdido llamado loan',
    'loan está a salvo?', 'alguien ha visto a loan?', 'necesitamos encontrar a loan', 'loan podría estar en el parque',
    'loan podría estar cerca de la escuela', 'vi a loan en la tienda', 'loan necesita ayuda urgentemente', 'loan podría estar en la estación de autobuses',
    'alguien ha visto a un niño llamado loan?', 'loan podría estar con alguien', 'necesitamos más información sobre loan',
    'loan fue visto por última vez en la plaza', 'alguien sabe dónde está loan?', 'loan está desaparecido', 'loan fue encontrado'
  ];

  const normalizedMessage = message.trim().toLowerCase();
  return relatedPhrases.includes(normalizedMessage);
}

// Manejar mensajes
async function handleMessage(bot, msg) {
  const chatId = msg.chat.id;
  const messageText = msg.text;

  if (!messageText) return;

  const userLocale = await getUserLocale(chatId);
  const messageHistory = chatMessageHistory.get(chatId) || [];
  messageHistory.push({ role: 'user', content: messageText });

  if (isGreeting(messageText)) {
    const greetingResponse = `¡Hola! Soy ${assistantName}, ${assistantDescription}`;
    bot.sendMessage(chatId, greetingResponse);
  } else if (isAskingName(messageText)) {
    const nameResponse = `Mi nombre es ${assistantName}.`;
    bot.sendMessage(chatId, nameResponse);
  } else if (mentionsLostChild(messageText)) {
    const childResponse = "Parece que mencionaste a Loan. Por favor proporciona más detalles.";
    bot.sendMessage(chatId, childResponse);
  } else {
    const assistantIntro = { role: 'system', content: `Eres un asistente llamado ${assistantName}. ${assistantDescription}` };
    const messagesWithIntro = [assistantIntro, ...messageHistory];

    const gptResponse = await getChatGPTResponse(messagesWithIntro);
    bot.sendMessage(chatId, gptResponse);

    messageHistory.push({ role: 'assistant', content: gptResponse });
    chatMessageHistory.set(chatId, messageHistory);
  }
}

// Manejar ubicación
async function handleLocation(bot, msg) {
  const chatId = msg.chat.id;
  const location = msg.location;

  if (location) {
    const response = `Recibí tu ubicación. Latitud: ${location.latitude}, Longitud: ${location.longitude}`;
    bot.sendMessage(chatId, response);
  }
}

// Manejar el comando /start
async function handleStartCommand(bot, msg) {
  const chatId = msg.chat.id;
  const welcomeMessage = `¡Hola! Soy ${assistantName}, tu asistente personal. ${assistantDescription}`;
  bot.sendMessage(chatId, welcomeMessage);
}

// Manejar consultas callback
async function handleCallbackQuery(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data.startsWith('setLocale_')) {
    const locale = data.split('_')[1];
    await setUserLocale(chatId, locale);
    bot.sendMessage(chatId, `Idioma configurado a ${locale}`);
  }
}

bot.on('message', (msg) => handleMessage(bot, msg));
bot.on('location', (msg) => handleLocation(bot, msg));
bot.onText(/\/start/, (msg) => handleStartCommand(bot, msg));
bot.on('callback_query', (callbackQuery) => handleCallbackQuery(bot, callbackQuery));

bot.on('polling_error', (error) => {
  console.error('Error de polling:', error);
});

process.on('uncaughtException', (err) => {
  console.error('Error no capturado:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Error no manejado:', reason, 'promise:', promise);
});

console.log('Configuración y manejo de eventos listos.');














