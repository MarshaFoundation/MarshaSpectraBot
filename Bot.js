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

async function getChatGPTResponse(messages) {
  const messagesKey = JSON.stringify(messages);
  if (cachedResponses.has(messagesKey)) {
    return cachedResponses.get(messagesKey);
  }

  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4',
      messages: messages,
      temperature: 0.7,
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      }
    });

    let gptResponse = response.data.choices[0].message.content.trim();

    // Filtrar cualquier mención a OpenAI o ChatGPT
    gptResponse = gptResponse.replace(/\b(chat\s*GPT|GPT|OpenAI|AI)\b/gi, 'esta asistente');

    cachedResponses.set(messagesKey, gptResponse);
    setTimeout(() => cachedResponses.delete(messagesKey), 30 * 60 * 1000); // Eliminar después de 30 minutos

    return gptResponse;
  } catch (error) {
    console.error('Error al llamar a OpenAI:', error.response ? error.response.data : error.message);
    return 'Lo siento, ocurrió un error al procesar tu solicitud.';
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

// Función genérica para comparar mensajes
function matchPhrases(message, phrases) {
  const normalizedMessage = message.trim().toLowerCase();
  return phrases.includes(normalizedMessage);
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

    if (matchPhrases(messageText, greetings)) {
      // Respuesta de saludo variada
      const randomGreetingResponse = getRandomResponse(responses.greetings);
      bot.sendMessage(chatId, randomGreetingResponse);
    } else if (matchPhrases(messageText, askingNames)) {
      // Respuesta sobre el nombre del asistente
      bot.sendMessage(chatId, responses.name);
    } else {
      // Introducción del asistente seguida de una respuesta generada por GPT
      const assistantIntro = `¡Hola! Soy ${assistantName}, ${assistantDescription}`;
      const messagesWithIntro = [assistantIntro, ...messageHistory];

      let gptResponse = await getChatGPTResponse(messagesWithIntro);
      
      // Verificar si la respuesta de GPT es la misma que la anterior para evitar duplicados
      const lastMessage = messageHistory[messageHistory.length - 1];
      const lastAssistantResponse = lastMessage && lastMessage.role === 'assistant' ? lastMessage.content : null;
      
      if (gptResponse === lastAssistantResponse) {
        // Si la respuesta es la misma, intentamos obtener una respuesta diferente
        gptResponse = await getChatGPTResponse([...messageHistory, `¿En qué más puedo ayudarte?`]);
      }

      if (isChatGPTQuestion(messageText)) {
        // Si la pregunta está relacionada con "ChatGPT" u otros términos, enviar respuesta específica
        bot.sendMessage(chatId, responses.notChatGPTResponse);
      } else {
        bot.sendMessage(chatId, gptResponse);
        messageHistory.push({ role: 'assistant', content: gptResponse });
        chatMessageHistory.set(chatId, messageHistory);
      }
    }
  } catch (error) {
    console.error('Error handling message:', error);
    bot.sendMessage(chatId, 'Lo siento, ocurrió un error al procesar tu mensaje.');
  }
}

// Función para detectar preguntas dirigidas a ChatGPT o relacionadas
function isChatGPTQuestion(text) {
  const normalizedText = text.trim().toLowerCase();
  return relatedPhrases.some(phrase => normalizedText.includes(phrase));
}

// Respuestas específicas según idioma
const responses = {
  greetings: [
    "¡Hola! Soy SilvIA+, tu asistente LGTBI+. ¿En qué puedo ayudarte?",
    "¡Hola! ¿Cómo estás? Soy SilvIA+, aquí para ayudarte."
  ],
  name: `Mi nombre es ${assistantName}. ${assistantDescription}`,
  notChatGPTResponse: "No, no soy un modelo de chat GPT. Soy el primer asistente LGTBI+ en el mundo, desarrollado por Marsha+ Foundation. Tengo acceso a recursos de OpenAI y diversas fuentes, lo que me hace una IA avanzada y potente. Visita www.marshafoundation.org para más información."
};

// Definición de respuestas para saludos y preguntas sobre el nombre
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

// Función para detectar preguntas relacionadas con "chat gpt"
const relatedPhrases = [
  'chat gpt', 'silvia', 'assistant', 'ai'
];

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

// Función genérica para obtener una respuesta aleatoria de un array
function getRandomResponse(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Definir el evento para manejar mensajes
bot.on('message', handleMessage);

// Manejar errores no capturados
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

console.log('Bot listo para recibir mensajes.');



















































