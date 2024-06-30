const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios').default;
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
  }
});

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

// Función para manejar casos específicos de "niño perdido"
function handleLostChildCase(chatId) {
  const responseMessage = `¡Espero que encuentres a tu hijo pronto! ¿Puedo ayudarte con algo más?`;
  bot.sendMessage(chatId, responseMessage);
}

// Función para manejar mensajes
async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const messageText = msg.text;

  if (!messageText) return;

  try {
    const userLocale = await getUserLocale(chatId);
    const messageHistory = chatMessageHistory.get(chatId) || [];
    messageHistory.push({ role: 'user', content: messageText });

    // Definir frases relacionadas
    const relatedPhrases = [
      'frase1',
      'frase2',
      'frase3',
      // Agrega más frases según sea necesario
    ];

    // Lógica principal para manejar mensajes
    if (matchPhrases(messageText, greetings)) {
      await bot.sendMessage(chatId, responses.greeting);
    } else if (matchPhrases(messageText, askingNames)) {
      await bot.sendMessage(chatId, responses.name);
    } else if (matchPhrases(messageText, relatedPhrases)) {
      handleLostChildCase(chatId);
    } else {
      // Respuesta por defecto usando modelo GPT u otra lógica de respuesta
      const assistantIntro = { role: 'system', content: `¡Hola! Soy ${assistantName}, tu asistente virtual.` };
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

// Función para manejar consultas callback
async function handleCallbackQuery(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data.startsWith('setLocale_')) {
    const locale = data.split('_')[1];
    await setUserLocale(chatId, locale);
    bot.sendMessage(chatId, `Idioma configurado a ${locale}`);
  }
}

// Función para almacenar la ubicación en la base de datos
async function storeLocation(chatId, latitude, longitude) {
  let client;
  try {
    client = await pool.connect();
    const queryText = `
      INSERT INTO locations (chat_id, latitude, longitude, timestamp) 
      VALUES ($1, $2, $3, NOW())
    `;
    await client.query(queryText, [chatId, latitude, longitude]);
    console.log(`Ubicación de ${chatId} almacenada en la base de datos.`);
  } catch (error) {
    console.error('Error al almacenar la ubicación:', error);
  } finally {
    if (client) {
      await client.release();
    }
  }
}

// Manejar comandos
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const welcomeMessage = `¡Hola! Soy ${assistantName}, tu asistente. ¿Cómo puedo ayudarte hoy?`;
  bot.sendMessage(chatId, welcomeMessage);
});

bot.on('message', handleMessage);
bot.on('callback_query', handleCallbackQuery);

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




































