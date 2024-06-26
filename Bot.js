const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// Variables de entorno
const token = process.env.TELEGRAM_API_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;
const assistantName = 'SilvIA+';
const assistantDescription = 'el primer asistente LGTBI+ en el mundo =) Desarrollado por Marsha+ Foundation. www.marshafoundation.org.';
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
    return res.rows.length > 0 ? res.rows[0].locale : null; // Devuelve el idioma si está registrado, o null si no lo está
  } catch (error) {
    console.error('Error al obtener el idioma del usuario:', error);
    return null; // Devuelve null en caso de error
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

// Función para detectar menciones relacionadas con el niño perdido llamado Loan
  const relatedPhrases = [
    'loan perdido','loan','vi a loan', 'encontré a loan', 'busco a loan', 'dónde está loan', 'ayuda con loan',
    'loan está perdido', 'buscando a loan', 'vimos a loan', 'he visto a loan', 'he encontrado a loan',
    'loan desapareció', 'loan se perdió', 'loan necesita ayuda', 'loan encontrado', 'tengo información sobre loan',
    'loan está solo', 'he encontrado a un niño llamado loan', 'un niño llamado loan', 'ví a un niño llamado loan',
    'vi a loan en el parque', 'loan fue visto cerca de mi casa', 'creo haber visto a loan ayer', 'loan podría estar en el centro comercial',
    'alguien vio a loan por aquí', 'loan desapareció hace una semana', 'me dijeron que loan fue visto en el parque',
    'loan fue encontrado por la policía', 'buscamos a loan por todos lados', 'loan necesita ser encontrado lo antes posible',
    'loan podría estar en problemas', 'me preocupa la seguridad de loan', 'no hemos encontrado a loan todavía',
    'loan estaba jugando en el parque antes de desaparecer', 'creemos que loan se perdió en el centro',
    'loan estaba usando una camiseta roja', 'alguien reportó haber visto a loan en la estación de tren',
    'ayúdanos a encontrar a loan', 'loan está desaparecido desde ayer', 'loan se fue de casa',
    'loan podría estar en peligro', 'si ves a loan, por favor contacta a las autoridades', 'loan se extravió en el supermercado',
    'loan se perdió en el centro de la ciudad', 'loan fue visto por última vez cerca de la escuela',
    'necesitamos encontrar a loan rápidamente', 'loan estaba con un adulto desconocido', 'alguien tiene información sobre loan',
    'por favor, ayúdanos a encontrar a loan', 'se busca a un niño llamado loan', 'alguien ha visto a loan?',
    'loan fue reportado como desaparecido', 'alguien ha visto a loan recientemente?', 'loan se fue de su casa',
    'loan estaba jugando fuera antes de desaparecer', 'alguien ha visto a un niño pequeño llamado loan?',
    'la familia de loan lo está buscando desesperadamente', 'loan fue visto en las cercanías del parque',
    'loan está desaparecido desde hace horas', 'por favor, informa si tienes alguna noticia de loan',
    'loan podría estar en el vecindario', 'alguien ha visto a loan hoy?', 'loan fue visto por última vez con una camiseta roja',
    'alguien dijo haber visto a loan en la tienda', 'loan fue visto cerca de la estación de trenes',
    'necesitamos ayuda para encontrar a loan', 'alguien ha encontrado a loan?', 'loan fue visto en el parque central',
    'ayúdanos a localizar a loan', 'loan estaba solo cuando desapareció', 'necesitamos información sobre loan',
    'loan fue visto en las inmediaciones', 'alguien ha visto a loan por aquí?', 'loan podría estar en el centro de la ciudad',
    'se ha perdido un niño llamado loan', 'alguien ha visto a loan en el barrio?', 'loan podría estar en peligro',
    'loan fue visto en la estación de autobuses', 'loan podría estar en el parque', 'loan estaba en el centro comercial antes de desaparecer',
    'ayuda a buscar a loan', 'la familia de loan está muy preocupada', 'alguien tiene noticias de loan?', 'loan está desaparecido desde hace días',
    'alguien ha visto a un niño perdido llamado loan?', 'necesitamos encontrar a loan urgentemente', 'loan podría estar herido',
    'la policía está buscando a loan', 'loan podría estar con un adulto', 'alguien sabe algo sobre loan?',
    'loan estaba jugando en el parque antes de desaparecer', 'loan podría estar cerca de aquí', 'necesitamos ayuda para localizar a loan',
    'alguien tiene información sobre el paradero de loan?', 'loan fue visto por última vez en la plaza del pueblo', 'alguien ha visto a loan en el vecindario?',
    'loan fue visto en el centro de la ciudad', 'alguien tiene noticias sobre loan?', 'loan se perdió cerca de la escuela',
    'necesitamos saber dónde está loan', 'loan fue visto con un hombre desconocido', 'alguien ha visto a un niño pequeño llamado loan?',
    'loan fue reportado como perdido', 'loan se perdió en el parque central', 'alguien ha encontrado a loan?', 'loan está a salvo?',
    'alguien ha visto a loan?', 'necesitamos encontrar a loan', 'loan podría estar en el parque', 'loan podría estar cerca de la escuela',
    'vi a loan en la tienda', 'loan necesita ayuda urgentemente', 'loan podría estar en la estación de autobuses',
    'alguien ha visto a un niño llamado loan?', 'loan podría estar con alguien', 'necesitamos más información sobre loan',
    'loan fue visto por última vez en la plaza', 'alguien sabe dónde está loan?', 'loan está desaparecido', 'loan fue encontrado'
  ];

// Definir respuestas en diferentes idiomas
const responses = {
  es: {
    greeting: "¡Hola! Soy SilvIA+, tu asistente LGTBI+. ¿En qué puedo ayudarte?",
    name: `Mi nombre es ${assistantName}. ${assistantDescription}`,
    lostChild: `🚨 ¡Atención! Usted está compartiendo información valiosa, la misma será enviada a las autoridades 🚨
Es crucial que comparta su ubicación actual y cualquier detalle adicional que pueda ayudar en la búsqueda.

Por favor, pulse el botón "Compartir ubicación" a continuación. Tu colaboración es vital para garantizar la seguridad de Loan. 🙏`
  },
  en: {
    greeting: "Hello! I'm SilvIA+, your LGBTI+ assistant. How can I help you today?",
    name: `My name is ${assistantName}. ${assistantDescription}`,
    lostChild: `🚨 Attention! You are sharing valuable information, which will be forwarded to the authorities 🚨
It's crucial that you share your current location and any additional details that could aid in the search.

Please press the "Share Location" button below. Your collaboration is vital to ensure Loan's safety. 🙏`
  }
  // Puedes agregar más idiomas según sea necesario
};

// Función para enviar mensajes según el idioma del usuario
async function sendMessageInUserLocale(chatId, messageText) {
  try {
    const userLocale = await getUserLocale(chatId);
    let responseText = '';

    if (userLocale && responses[userLocale]) {
      // Determinar qué tipo de mensaje enviar según el contenido de messageText
      if (matchPhrases(messageText, greetings)) {
        responseText = responses[userLocale].greeting;
      } else if (matchPhrases(messageText, askingNames)) {
        responseText = responses[userLocale].name;
      } else if (matchPhrases(messageText, relatedPhrases)) {
        await handleLostChildCase(chatId);
        return; // No enviar mensaje directamente aquí si se maneja un caso especial como 'lostChild'
      } else {
        // Si no se identifica el tipo de mensaje, obtener una respuesta del modelo GPT
        const assistantIntro = { role: 'system', content: `Eres un asistente llamado ${assistantName}. ${assistantDescription}` };
        const messagesWithIntro = [assistantIntro, ...messageHistory];

        const gptResponse = await getChatGPTResponse(messagesWithIntro);
        responseText = gptResponse;

        messageHistory.push({ role: 'assistant', content: gptResponse });
        chatMessageHistory.set(chatId, messageHistory);
      }
    } else {
      // Si el idioma del usuario no está definido o es desconocido, enviar en inglés como opción predeterminada
      responseText = responses.en.greeting;
    }

    await bot.sendMessage(chatId, responseText, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    // Manejar el error de manera apropiada (puede ser útil enviar un mensaje genérico de error al usuario)
    await bot.sendMessage(chatId, 'Lo siento, ocurrió un error al enviar el mensaje.');
  }
}

// Función para emparejar frases
function matchPhrases(text, phrases) {
  const normalizedText = text.trim().toLowerCase();
  return phrases.some(phrase => normalizedText.includes(phrase));
}

// Manejar consultas callback
async function handleCallbackQuery(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data.startsWith('setLocale_')) {
    const locale = data.split('_')[1];
    await setUserLocale(chatId, locale);
    bot.sendMessage(chatId, `Idioma configurado a ${locale}`);
  }
}

// Manejar ubicación
bot.on('location', (msg) => {
  const chatId = msg.chat.id;
  const location = msg.location;

  console.log(`Ubicación recibida de ${chatId}: ${location.latitude}, ${location.longitude}`);

  // 1. Notificar a las autoridades (simulado con console.log)
  console.log(`Notificar a las autoridades: Ubicación recibida de ${chatId}: ${location.latitude}, ${location.longitude}`);

  // 2. Almacenar la ubicación en la base de datos
  storeLocation(chatId, location.latitude, location.longitude);

  // 3. Respuesta personalizada
  const confirmationMessage = "Gracias por compartir tu ubicación. Estamos procesando tu información.";
  bot.sendMessage(chatId, confirmationMessage);
});

// Función para almacenar la ubicación en la base de datos
async function storeLocation(chatId, latitude, longitude) {
  try {
    const client = await pool.connect();
    const queryText = `
      INSERT INTO locations (chat_id, latitude, longitude, timestamp) 
      VALUES ($1, $2, $3, NOW())
    `;
    await client.query(queryText, [chatId, latitude, longitude]);
    client.release();
    console.log(`Ubicación de ${chatId} almacenada en la base de datos.`);
  } catch (error) {
    console.error('Error al almacenar la ubicación:', error);
  }
}

// Manejar comandos
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const welcomeMessage = `¡Hola! Soy ${assistantName}, tu asistente. ¿Cómo puedo ayudarte hoy?`;
  bot.sendMessage(chatId, welcomeMessage);
});

// Manejar todos los mensajes
bot.on('message', handleMessage);
bot.on('callback_query', handleCallbackQuery);

// Manejar errores de polling
bot.on('polling_error', (error) => {
  console.error('Error de polling:', error);
});

// Manejar excepciones no capturadas
process.on('uncaughtException', (err) => {
  console.error('Error no capturado:', err);
  process.exit(1);
});

// Manejar promesas rechazadas no manejadas
process.on('unhandledRejection', (reason, promise) => {
  console.error('Error no manejado:', reason, 'promise:', promise);
});














