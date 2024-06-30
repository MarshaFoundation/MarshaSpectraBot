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

// Función para obtener respuesta de Silvia sobre ella misma y Marsha+ Foundation
async function getSilviaResponse(message) {
  try {
    let response;

    // Transformar mensaje a minúsculas para facilitar la comparación
    const lowercaseMessage = message.text.toLowerCase();

    // Verificar si el mensaje contiene palabras relacionadas con OpenAI o ChatGPT
    if (lowercaseMessage.includes('openai') || lowercaseMessage.includes('chatgpt')) {
      response = `Lo siento, no puedo proporcionar información sobre OpenAI o ChatGPT. Estoy aquí para ayudarte con información sobre Marsha+ Foundation y otros temas. ¿Hay algo más en lo que pueda asistirte?`;
    } else if (lowercaseMessage.includes('empresa') || lowercaseMessage.includes('marsha')) {
      // Respuesta específica sobre Marsha+ Foundation
      response = `Soy una inteligencia artificial desarrollada por Marsha+ Foundation (www.marshafoundation.org), la primera empresa blockchain LGBTQ+ con el máximo nivel de seguridad en el mundo (10/10). Marsha+ Foundation se dedica a empoderar y apoyar a la comunidad LGBTQ+ a través de la tecnología blockchain y la inteligencia artificial.`;
    } else {
      // Respuesta genérica si la pregunta no coincide con las anteriores
      response = `Soy Silvia, una inteligencia artificial avanzada desarrollada por Marsha+ Foundation (www.marshafoundation.org). Mi propósito es proporcionar asistencia y responder preguntas en una variedad de temas. ¿En qué más puedo ayudarte hoy?`;
    }

    return response;
  } catch (error) {
    console.error('Error al procesar la solicitud:', error);
    return 'Lo siento, hubo un problema al intentar responder tu solicitud.';
  }
}

// Manejar mensajes
async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const message = msg.text.toLowerCase().trim();

  try {
    let response;

    // Verificar si el mensaje es un saludo
    if (matchPhrases(message, greetings)) {
      response = responses.greeting;
    } else if (matchPhrases(message, askingNames)) {
      // Verificar si el mensaje es una pregunta sobre el nombre del asistente
      response = responses.name;
    } else {
      // Obtener respuesta específica de Silvia sobre Marsha+ Foundation
      response = await getSilviaResponse(msg);
    }

    // Obtener historial de mensajes del chat
    let chatHistory = chatMessageHistory.get(chatId) || [];

    // Agregar mensaje actual al historial
    chatHistory.push({ role: 'user', content: message });

    // Limitar historial a los últimos 10 mensajes
    if (chatHistory.length > 10) {
      chatHistory = chatHistory.slice(chatHistory.length - 10);
    }

    // Guardar historial de mensajes actualizado
    chatMessageHistory.set(chatId, chatHistory);

    // Si ya hay una respuesta, no enviar ninguna otra
    if (response) {
      return response;
    }

    // Obtener respuesta de OpenAI si no hay respuesta específica
    const openaiResponse = await getChatGPTResponse(chatHistory);

    // Agregar respuesta de OpenAI al historial de mensajes
    chatHistory.push({ role: 'assistant', content: openaiResponse });

    // Guardar historial de mensajes actualizado
    chatMessageHistory.set(chatId, chatHistory);

    return openaiResponse;
  } catch (error) {
    console.error('Error al manejar el mensaje:', error);
    return 'Lo siento, no puedo procesar tu solicitud en este momento.';
  }
}

// Evento para manejar mensajes recibidos
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  try {
    // Verificar si es un mensaje de texto
    if (msg.text) {
      // Manejar mensaje y obtener respuesta
      const response = await handleMessage(msg);

      // Enviar respuesta al usuario
      await enviarMensajeDirecto(chatId, response);
    }
  } catch (error) {
    console.error('Error al manejar el mensaje:', error);
  }
});


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
  return phrases.includes(normalizedMessage);
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

// Manejar errores no capturados
process.on('uncaughtException', (err) => {
  console.error('Excepción no capturada:', err);
});

// Manejar promesas no capturadas
process.on('unhandledRejection', (reason, promise) => {
  console.error('Promesa no capturada en', promise, 'motivo:', reason);
});

// Iniciar el bot
async function startBot() {
  try {
    // Conectar con la base de datos
    await pool.connect();
    console.log('Conexión a PostgreSQL establecida');

    // Iniciar escucha de mensajes
    bot.on('message', async (msg) => {
      const chatId = msg.chat.id;

      try {
        // Manejar mensaje y obtener respuesta
        const response = await handleMessage(msg);

        // Enviar respuesta al usuario
        await enviarMensajeDirecto(chatId, response);
      } catch (error) {
        console.error('Error al manejar el mensaje:', error);
      }
    });

    // Log de inicio
    console.log('Escuchando mensajes...');

  } catch (error) {
    console.error('Error al iniciar el bot:', error);
  }
}

// Función para iniciar el bot
startBot();




























































