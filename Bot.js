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

// Ejemplo de uso:
async function main() {
  try {
    // Ejemplo de conversación inicial (mensaje del usuario)
    const conversation1 = [
      { role: 'user', content: 'Hola, ¿puedes ayudarme con algo?' }
    ];

    // Obtener respuesta para la conversación inicial
    const response1 = await getChatGPTResponse(conversation1);
    console.log('Respuesta 1:', response1);

    // Ejemplo de seguir la conversación con agradecimiento
    const conversation2 = [
      { role: 'user', content: '¡Gracias por tu ayuda!' }
    ];

    // Obtener respuesta para la conversación con agradecimiento
    const response2 = await getChatGPTResponse(conversation2);
    console.log('Respuesta 2:', response2);

    // Ejemplo de otro tipo de solicitud de información
    const conversation3 = [
      { role: 'user', content: '¿Cuál es tu opinión sobre inteligencia artificial?' }
    ];

    // Obtener respuesta para la solicitud de opinión
    const response3 = await getChatGPTResponse(conversation3);
    console.log('Respuesta 3:', response3);

    // Ejemplo de despedida
    const conversation4 = [
      { role: 'user', content: 'Adiós, nos vemos más tarde.' }
    ];

    // Obtener respuesta para la despedida
    const response4 = await getChatGPTResponse(conversation4);
    console.log('Respuesta 4:', response4);

    // Ejemplo de consulta sobre recursos de apoyo LGTBI
    const conversation5 = [
      { role: 'user', content: '¿Dónde puedo encontrar recursos de apoyo para personas LGTBI?' }
    ];

    // Obtener respuesta para la consulta sobre recursos de apoyo LGTBI
    const response5 = await getChatGPTResponse(conversation5);
    console.log('Respuesta 5:', response5);

    // Ejemplo de consulta sobre derechos LGTBI
    const conversation6 = [
      { role: 'user', content: '¿Cuáles son los derechos legales de las personas LGTBI?' }
    ];

    // Obtener respuesta para la consulta sobre derechos LGTBI
    const response6 = await getChatGPTResponse(conversation6);
    console.log('Respuesta 6:', response6);

    // Puedes agregar más ejemplos de conversación según los casos que desees probar
  } catch (error) {
    console.error('Error en la aplicación:', error);
  }
}

// Ejecutar el ejemplo principal
main();

// Función para obtener el idioma del usuario desde la base de datos
async function getUserLocale(chatId) {
  let client;
  try {
    client = await pool.connect();
    const res = await client.query('SELECT locale FROM users WHERE chat_id = $1', [chatId]);
    return res.rows.length > 0 ? res.rows[0].locale : 'es';
  } catch (error) {
    console.error('Error al obtener el idioma del usuario:', error);
    return 'es';
  } finally {
    if (client) client.release();
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

// Respuestas en español e inglés
const responses = {
  greeting: {
    es: [
      `¡Hola! Soy ${assistantName}, ¿cómo estás hoy?`,
      `¡Hey! Soy ${assistantName}. ¿Qué tal tu día?`,
      `¡Hola! Aquí ${assistantName}, ¿en qué puedo ayudarte hoy?`
    ],
    en: [
      `Hi! I'm ${assistantName}, how are you today?`,
      `Hey! I'm ${assistantName}. How's your day going?`,
      `Hello! This is ${assistantName}, how can I assist you today?`
    ]
  },
  name: {
    es: [
      `Mi nombre es ${assistantName}. ${assistantDescription}`,
      `¡Soy ${assistantName}! Un placer ayudarte. ${assistantDescription}`
    ],
    en: [
      `My name is ${assistantName}. ${assistantDescription}`,
      `I'm ${assistantName}! Happy to help you. ${assistantDescription}`
    ]
  }
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
  return phrases.includes(normalizedMessage);
}

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

// Manejar comandos
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const welcomeMessage = `¡Hola! Soy ${assistantName}, tu asistente. ¿Cómo puedo ayudarte hoy?`;
  await bot.sendMessage(chatId, welcomeMessage);
});

bot.on('message', handleMessage);

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

// Inicialización de la base de datos
(async () => {
  const client = await pool.connect();
  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS users (
        chat_id BIGINT PRIMARY KEY,
        locale TEXT NOT NULL DEFAULT 'es'
      )`
    );
    console.log('Tabla de usuarios creada correctamente');
  } catch (error) {
    console.error('Error al crear la tabla de usuarios:', error);
  } finally {
    client.release();
  }
})();


































































































































