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

// Función para obtener el idioma del usuario desde la base de datos
async function getUserLocale(chatId) {
  try {
    const client = await pool.connect();
    const query = 'SELECT locale FROM users WHERE chat_id = $1';
    const result = await client.query(query, [chatId]);
    client.release();

    if (result.rows.length > 0) {
      return result.rows[0].locale;
    } else {
      console.log(`No se encontró el usuario con chat_id ${chatId} en la base de datos.`);
      return 'es'; // Idioma predeterminado si no se encuentra el usuario
    }
  } catch (error) {
    console.error('Error al obtener el idioma del usuario:', error);
    return 'es'; // Valor por defecto en caso de error
  }
}

// Función para obtener respuesta de OpenAI
async function getChatGPTResponse(messages) {
  const messagesKey = JSON.stringify(messages);
  if (cachedResponses.has(messagesKey)) {
    return cachedResponses.get(messagesKey);
  }

  let { temperature, maxTokens, topP } = { temperature: 0.7, maxTokens: 150, topP: 0.8 };

  const lastUserMessage = messages.filter(msg => msg.role === 'user').pop();
  let userText = ''; // Variable para almacenar el texto del usuario

  if (lastUserMessage) {
    userText = lastUserMessage.content.toLowerCase(); // Asignar el contenido del último mensaje del usuario
    // Ajustar los parámetros basados en el texto del usuario
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
    } else if (userText.includes('recursos de apoyo lgtbi') || userText.includes('derechos lgtbi') ||
               userText.includes('definiciones lgtbi') || userText.includes('eventos lgtbi') ||
               userText.includes('pronombres y género') || userText.includes('discriminación lgtbi') ||
               userText.includes('apoyo familiar lgtbi') || userText.includes('historia lgtbi') ||
               userText.includes('salud mental lgtbi') || userText.includes('temas lgtbi') ||
               userText.includes('opinión lgtbi')) {
      temperature = 0.6;
      maxTokens = 180;
      topP = 0.85;
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
    
    // Añadir respuestas empáticas y variedad de estilos aquí
    if (userText.includes('ayuda')) {
      gptResponse = `Estoy aquí para ayudarte en lo que necesites. ${gptResponse}`;
    } else if (userText.includes('gracias') || userText.includes('agradecido')) {
      gptResponse = `De nada, es un placer ayudarte. ${gptResponse}`;
    } else if (userText.includes('adiós') || userText.includes('hasta luego')) {
      gptResponse = `¡Hasta luego! Siempre estaré aquí cuando me necesites. ${gptResponse}`;
    } else if (userText.includes('broma') || userText.includes('chiste')) {
      gptResponse = `¡Claro! Aquí va uno: ¿Por qué los pájaros no usan Facebook? Porque ya tienen Twitter. 😄 ${gptResponse}`;
    } else if (userText.includes('cuéntame más') || userText.includes('explícame')) {
      gptResponse = `¡Por supuesto! Estoy aquí para explicarte con detalle. ${gptResponse}`;
    } else if (userText.includes('eres un robot') || userText.includes('eres humano')) {
      gptResponse = `Soy un asistente virtual creado para ayudarte, pero estoy aquí para conversar contigo como lo haría un amigo. ${gptResponse}`;
    } else if (userText.includes('qué opinas de')) {
      gptResponse = `Mi opinión es que cada persona tiene su propia perspectiva. Me encantaría escuchar tu opinión sobre este tema. ${gptResponse}`;
    } else if (userText.includes('cuál es tu nombre')) {
      gptResponse = `Mi nombre es ${assistantName}. ¿Cómo puedo asistirte hoy? ${gptResponse}`;
    } else if (userText.includes('recursos de apoyo lgtbi') || userText.includes('derechos lgtbi') ||
               userText.includes('definiciones lgtbi') || userText.includes('eventos lgtbi') ||
               userText.includes('pronombres y género') || userText.includes('discriminación lgtbi') ||
               userText.includes('apoyo familiar lgtbi') || userText.includes('historia lgtbi') ||
               userText.includes('salud mental lgtbi') || userText.includes('temas lgtbi') ||
               userText.includes('opinión lgtbi')) {
      gptResponse = `Entiendo que estos temas son importantes. Estoy aquí para proporcionarte información y apoyo sobre temas LGBTQ+. ${gptResponse}`;
    }

    cachedResponses.set(messagesKey, gptResponse);

    return gptResponse;
  } catch (error) {
    console.error('Error al llamar a OpenAI:', error);
    return 'Lo siento, actualmente no puedo procesar tu solicitud.';
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

// Definiciones de respuestas para saludos y preguntas sobre el nombre
const responses = {
  greeting: `¡Hola! Soy ${assistantName}, tu asistente. ¿Cómo puedo ayudarte hoy?`,
  name: `Mi nombre es ${assistantName}. ${assistantDescription}`,
};

// Funciones para detectar saludos y preguntas por el nombre del asistente
const greetings = [
  // Español
  'hola', 'hi', 'qué tal', 'buenas', 'hey', 'buen día',
  '¿cómo estás?', 'saludos', '¿qué hay?', 'buenas tardes', 'buenas noches',
  '¿cómo va?', '¿qué pasa?', '¿qué hubo?', '¡buenos días!',
  '¿cómo te va?', '¿qué onda?', '¿estás ahí?',
  'buen día', 'buenas noches', 'buenas tardes', '¿cómo estás hoy?',
  'hola, ¿cómo estás?', '¿qué tal?', 'hola, ¿qué hay?', 'hey, ¿cómo estás?',
  'saludos, ¿qué tal?', 'buenos días, ¿cómo va?', 'buenas noches, ¿qué hay?',
  'buenas tardes, ¿cómo estás?', '¿estás ahí?', 'hey, ¿qué onda?',
  'hola, ¿estás ahí?', 'saludos, ¿qué pasa?', 'buenas, ¿qué hubo?',
  'buenos días, ¿cómo te va?', 'buenas noches, ¿cómo onda?',
  'buenas tardes, ¿estás ahí?', '¿cómo estás hoy?', 'hola, ¿qué tal?',
  'buen día, ¿cómo estás?', 'buenas noches, ¿qué tal?',
  'buenas tardes, ¿cómo te va?', 'saludos, ¿cómo onda?',
  'hey, ¿qué tal?', 'hola, ¿cómo va?', '¿qué hay?', 'buenos días',
  'buenas noches', 'buenas tardes', '¿cómo estás hoy?',
  'hola, ¿cómo estás?', '¿qué tal?', 'hola, ¿qué hay?', 'hey, ¿cómo estás?',
  'saludos, ¿qué tal?', 'buenos días, ¿cómo va?', 'buenas noches, ¿qué hay?',
  'buenas tardes, ¿cómo estás?', '¿estás ahí?', 'hey, ¿qué onda?',
  'hola, ¿estás ahí?', 'saludos, ¿qué pasa?', 'buenas, ¿qué hubo?',
  'buenos días, ¿cómo te va?', 'buenas noches, ¿cómo onda?',
  'buenas tardes, ¿estás ahí?', '¿cómo estás hoy?', 'hola, ¿qué tal?',
  'buen día, ¿cómo estás?', 'buenas noches, ¿qué tal?',
  'buenas tardes, ¿cómo te va?', 'saludos, ¿cómo onda?',
  'hey, ¿qué tal?', 'hola, ¿cómo va?', '¿qué hay?',

  // Inglés
  'good morning', 'good afternoon', 'good evening', 'hey there', 'howdy',
  'what’s up?', 'how are you?', 'greetings', 'how’s it going?', 'what’s new?',
  'how’s everything?', 'long time no see', 'how’s life?', 'hey man', 'hi there',
  'howdy-do', 'what’s happening?', 'how goes it?', 'hey buddy', 'hello there',
  'good day', 'what’s cracking?', 'hey dude', 'what’s the good word?', 'how’s your day?',
  'nice to see you', 'hiya', 'what’s happening?', 'hey friend', 'sup?',
  'how’s your day been?', 'yo', 'what’s popping?', 'how’s your day going?',
  'good morning, how are you?', 'hey, how’s it going?', 'what’s up, buddy?',
  'long time no see, how are things?', 'hello, how’s everything?', 'good afternoon, what’s new?',
  'hey there, how’s life?', 'howdy, what’s happening?', 'hi there, how goes it?',
  'good evening, how are you?', 'how’s your day today?', 'what’s new, how are you?',
  'hello there, what’s up?', 'what’s cracking, how are you?', 'hey dude, how’s your day?',
  'hiya, how’s it going?', 'sup, how are things?', 'good day, how are you doing?',
  'what’s the good word, how are you?', 'howdy-do, how are you today?',
  'nice to see you, how have you been?', 'yo, how’s everything going?',
  'what’s popping, how are things?', 'hey friend, how’s your day been?',
  'how’s your day been so far?', 'good morning, how’s your day?',
  'hello, how’s it going today?', 'hey, how’s your day been?', 'what’s new, how are you?',
  'how’s everything going today?', 'hey buddy, how’s your day?',
  'long time no see, how’s everything going?', 'how’s life been treating you?',
  'hi there, how’s your day been?', 'hey there, how are you doing?',
  'howdy, how’s everything been?', 'good evening, how’s it going?',
  'how’s your day going so far?', 'what’s happening, how are you?',
  'hey dude, how’s everything?', 'how’s your day treating you?',
  'hiya, how’s it going so far?', 'sup, how’s your day been?',
  'what’s going on, how are you?', 'how’s your day treating you today?',
  'hey friend, how have you been?', 'how’s everything going so far?',
  'how’s your day treating you so far?', 'hiya, how’s your day going?',
  'yo, how’s your day treating you?', 'what’s up, how have you been?',
  'what’s new, how’s everything been?', 'what’s happening, how are things?',
  'hey there, how’s everything been?', 'what’s cracking, how’s your day?',
  'how’s everything been so far?', 'what’s up, how’s everything going?',
  'hey dude, how have you been?', 'what’s the good word, how’s everything?',
  'howdy-do, how’s everything going?', 'what’s going on, how have you been?',
  'how’s your day been going?', 'hey friend, how’s everything?',
  'how’s your day been treating you so far?', 'how’s everything going today?',
  'hi there, how’s your day going?', 'hey there, how’s everything going?',
  'how’s everything been treating you?', 'how’s your day been today?',
  'how’s your day been going so far?'
];

// Lista de preguntas sobre el nombre del asistente en español e inglés
const askingNames = [
  // Español
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

  // Inglés
  'what is your name?', 'what\'s your name?', 'your name?', 'tell me your name', 'could you tell me your name',
  'can you tell me your name', 'may I know your name', 'what do they call you', 'how should I address you',
  'what should I call you', 'could you share your name', 'tell me the name you use', 'what name do you use',
  'may I have your name', 'your full name', 'how do you identify yourself', 'do you know your name',
  'what would you like me to call you', 'what should I know you as', 'may I know the name you use',
  'can I know your name', 'how are you known', 'what are you called', 'how do you name yourself',
  'what should I call you', 'how do you refer to yourself', 'what\'s your current name', 'what\'s your name',
  'could you give me your name', 'what\'s your identification', 'tell me the name people use for you',
  'what name do you go by', 'do you know what they call you', 'may I know your current name',
  'what is your name right now', 'may I ask your name', 'tell me your ID', 'tell me your current name',
  'what should I refer to you as', 'how do you identify', 'how do you identify yourself'
];

// Respuestas predefinidas para SilvIA+ y Marsha+
const silviaResponse = `
SilvIA+ es una avanzada inteligencia artificial diseñada por Marsha Foundation para proporcionar respuestas y asistencia basadas en lenguaje natural. 
Está construida sobre la arquitectura de su token nativo (MSA) y puede responder una amplia gama de preguntas sobre diversos temas.
`;

const marshaResponse = `
Introducing Marsha+: A revolutionary initiative designed to empower and support the LGBTQ+ community through blockchain technology. Our commitment is grounded in the belief that equality and human rights are fundamental, and Marsha+ stands as a beacon of positive change.

This innovative token, built on Ethereum and deployed on the Binance Smart Chain, is more than just a digital asset; it's a catalyst for meaningful action. Marsha+ will facilitate secure and transparent transactions, fundraising initiatives, and various applications within the community. Our mission is clear: to strengthen the LGBTQ+ community by providing the necessary tools to face contemporary challenges.

With a total supply of 8 billion tokens and an annual burn rate of 3%, Marsha+ represents a symbol of sustained commitment to equality, diversity, and a brighter future. Join Marsha+ and be part of the change!

For more information, visit [www.marshafoundation.org].
`;

module.exports = {
  greetings,
  askingNames
};

// Manejar mensajes
async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const messageText = msg.text;

  if (!messageText) return;

  try {
    const userLocale = await getUserLocale(chatId);
    const messageHistory = chatMessageHistory.get(chatId) || [];
    messageHistory.push({ role: 'user', content: messageText });

    // Añadir lógica de personalización basada en historial aquí

    if (matchPhrases(messageText, greetings)) {
      bot.sendMessage(chatId, responses.greeting);
    } else if (matchPhrases(messageText, askingNames)) {
      bot.sendMessage(chatId, responses.name);
    } else {
      const assistantIntro = { role: 'system', content: `Eres un asistente llamado ${assistantName}. ${assistantDescription}` };
      const messagesWithIntro = [assistantIntro, ...messageHistory];

      const gptResponse = await getChatGPTResponse(messagesWithIntro);
      bot.sendMessage(chatId, gptResponse);

      messageHistory.push({ role: 'assistant', content: gptResponse });
      chatMessageHistory.set(chatId, messageHistory);
    }
  } catch (error) {
    console.error('Error handling message:', error);
    bot.sendMessage(chatId, 'Lo siento, ocurrió un error al procesar tu mensaje.');
  }
}

// Manejar comandos
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const welcomeMessage = `¡Hola! Soy ${assistantName}, tu asistente. ¿Cómo puedo ayudarte hoy?`;
  bot.sendMessage(chatId, welcomeMessage);
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

// Datos de entrenamiento para SilvIA+ y Marsha+
const silviaTrainingData = [
  { input: '¿Qué es SilvIA+?', output: 'SilvIA+' },
  { input: 'Who is behind SilvIA+?', output: 'SilvIA+' },
  // Más datos de entrenamiento para SilvIA+
];

const marshaTrainingData = [
  { input: '¿Qué es Marsha+?', output: 'Marsha+' },
  { input: 'Who is behind Marsha+?', output: 'Marsha+' },
  // Más datos de entrenamiento para Marsha+
];

// Combinar todos los datos de entrenamiento
const combinedTrainingData = [...silviaTrainingData, ...marshaTrainingData];

// Inicialización de clasificadores SVM para SilvIA+ y Marsha+
const silviaClassifier = new SVM();
const marshaClassifier = new SVM();

// Entrenamiento de los clasificadores
combinedTrainingData.forEach(({ input, output }) => {
  const lowerCaseInput = input.toLowerCase();
  if (output === 'SilvIA+') {
    silviaClassifier.train(lowerCaseInput, 1);
  } else if (output === 'Marsha+') {
    marshaClassifier.train(lowerCaseInput, 1);
  }
});

// Función para predecir la categoría (SilvIA+ o Marsha+) de una pregunta
function predictCategory(question) {
  const lowerCaseQuestion = question.toLowerCase();
  const silviaPrediction = silviaClassifier.predict(lowerCaseQuestion);
  const marshaPrediction = marshaClassifier.predict(lowerCaseQuestion);

  return silviaPrediction > marshaPrediction ? 'SilvIA+' : 'Marsha+';
}

// Función para manejar mensajes sobre SilvIA+
async function handleSilviaQuestions(ctx) {
  const messageText = ctx.message.text.toLowerCase();
  const silviaQuestions = ['qué es silvia+', 'quién es silvia+', 'cuál es la misión de silvia+'];

  if (silviaQuestions.some(question => messageText.includes(question))) {
    await ctx.reply(silviaResponse);
  }
}

// Función para manejar mensajes sobre Marsha+
async function handleMarshaQuestions(ctx) {
  const messageText = ctx.message.text.toLowerCase();
  const marshaQuestions = ['qué es marsha+', 'quién es marsha+', 'cuál es la misión de marsha+'];

  if (marshaQuestions.some(question => messageText.includes(question))) {
    await ctx.reply(marshaResponse);
  }
}

// Manejar comandos o texto general
bot.hears(greetings, async (ctx) => {
  await ctx.reply(responses.greeting);
});

bot.hears(askingNames, async (ctx) => {
  await ctx.reply(responses.name);
});

bot.on('text', async (ctx) => {
  try {
    const category = predictCategory(ctx.message.text);
    if (category === 'SilvIA+') {
      await handleSilviaQuestions(ctx);
    } else if (category === 'Marsha+') {
      await handleMarshaQuestions(ctx);
    }
  } catch (error) {
    console.error('Error handling message:', error);
    await ctx.reply('Lo siento, ocurrió un error al procesar tu mensaje.');
  }
});

// Iniciar el bot de Telegram
bot.launch()
  .then(() => console.log('El bot de Telegram está listo para responder preguntas sobre SilvIA+ y Marsha+.'))
  .catch(err => console.error('Error al iniciar el bot:', err));

// Manejar errores no capturados
process.on('uncaughtException', (err) => {
  console.error('Error no capturado:', err);
  process.exit(1);
});

// Manejar promesas no manejadas
process.on('unhandledRejection', (reason, promise) => {
  console.error('Promesa no manejada:', reason, 'Promise:', promise);
});










































































































































