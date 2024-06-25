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
    'loan podría estar en problemas', 'me preocupa la seguridad de loan', 'he visto a un niño solo que parece estar perdido, podría ser loan',
    'loan fue encontrado sano y salvo', 'una persona dijo haber visto a loan en el metro', 'loan podría estar en la escuela',
    'tengo un dato importante sobre loan', 'loan está conmocionado y necesita ayuda', 'loan tiene familiares buscándolo',
    'necesitamos encontrar a loan rápidamente', 'loan se perdió en el parque de diversiones', 'hace horas que loan se perdió',
    'loan está perdido en la zona norte', 'loan está perdido en la zona sur', 'loan está perdido en la zona este',
    'loan está perdido en la zona oeste', 'loan necesita ayuda urgente', 'vi a un niño solo que podría ser loan',
    'loan está perdido desde ayer por la tarde', 'loan está perdido desde la mañana', 'no he visto a loan desde ayer',
    'loan fue visto por última vez en el centro de la ciudad', 'loan podría estar en el parque de atracciones',
    'me dijeron que loan podría estar cerca del río', 'loan podría estar en el vecindario'
  ];

  const normalizedMessage = message.trim().toLowerCase();
  return relatedPhrases.some(phrase => normalizedMessage.includes(phrase));
}

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
      const responseMessage = `¡Hola! Soy ${assistantName}, ${assistantDescription}. ¿En qué puedo ayudarte hoy?`;
      bot.sendMessage(chatId, responseMessage);
    }
    // Pregunta por el nombre del asistente
    else if (isAskingName(userMessage)) {
      const responseMessage = `Mi nombre es ${assistantName}, ${assistantDescription}`;
      bot.sendMessage(chatId, responseMessage);
    }
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
      const responseMessage = `¡Hola! Soy ${assistantName}, ${assistantDescription}. ¿En qué puedo ayudarte hoy?`;
      bot.sendMessage(chatId, responseMessage);
    }
    // Pregunta por el nombre del asistente
    else if (isAskingName(userMessage)) {
      const responseMessage = `Mi nombre es ${assistantName}, ${assistantDescription}`;
      bot.sendMessage(chatId, responseMessage);
    }
    // Mención relacionada con un niño perdido
    else if (mentionsLostChild(userMessage)) {
      const request = `
        🚨 ¡Atención! Protocolo de seguridad activado 🚨 Usted está compartiendo información valiosa, la misma será enviada a las autoridades!
        Es crucial que compartas tu ubicación actual para ayudarnos en su búsqueda.

        Por favor, pulsa el botón "Compartir ubicación" a continuación. Tu colaboración es vital para garantizar la seguridad de Loan. 🙏
      `;
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
    }
    // Respuesta predeterminada del asistente
    else {
      const prompt = { role: 'user', content: userMessage };
      const messages = [...messageHistory, prompt];
      const gptResponse = await getChatGPTResponse(messages);
      bot.sendMessage(chatId, gptResponse || 'No entiendo tu solicitud. ¿Podrías reformularla?');
    }
  } catch (error) {
    console.error('Error al manejar mensaje:', error);
  }
});

// Manejar el evento de ubicación del usuario
bot.on('location', async (msg) => {
  try {
    const chatId = msg.chat.id;
    const latitude = msg.location.latitude;
    const longitude = msg.location.longitude;

    // Agradecimiento por compartir la ubicación de manera amigable
    const thankYouMessage = "¡Gracias por compartir tu ubicación! Esto nos ayuda mucho en la búsqueda del niño perdido.";
    await bot.sendMessage(chatId, thankYouMessage);
  } catch (error) {
    console.error('Error al manejar ubicación:', error);
  }
});

// Manejar el evento de inicio del bot (/start)
bot.onText(/\/start/, async (msg) => {
  try {
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
    const responseMessage = `¡Hola! Soy ${assistantName}, ${assistantDescription}. ¿En qué puedo ayudarte hoy?`;
    bot.sendMessage(chatId, responseMessage, opts);
  } catch (error) {
    console.error('Error al manejar comando /start:', error);
  }
});

// Manejar el cambio de idioma desde los botones de selección
bot.on('callback_query', async (callbackQuery) => {
  try {
    const chatId = callbackQuery.message.chat.id;
    const locale = callbackQuery.data;
    await setUserLocale(chatId, locale);
    bot.sendMessage(chatId, `Idioma cambiado a ${locale}`);
  } catch (error) {
    console.error('Error al manejar callback de cambio de idioma:', error);
  }
});

// Manejar errores de polling del bot
bot.on('polling_error', (error) => {
  console.error('Error de polling:', error);
});

// Manejar errores no capturados en el proceso
process.on('uncaughtException', (err) => {
  console.error('Error no capturado:', err);
  // Aquí podrías implementar lógica adicional, como enviar un mensaje al administrador
  process.exit(1); // Salir del proceso con un código de error
});

// Manejar rechazos no manejados en promesas
process.on('unhandledRejection', (reason, promise) => {
  console.error('Error no manejado:', reason, 'promise:', promise);
});

console.log('Configuración y manejo de eventos listos.');










