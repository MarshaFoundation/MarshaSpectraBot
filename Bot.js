const { Telegraf } = require('telegraf');
const axios = require('axios');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const { SVM } = require('svm');

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
const bot = new Telegraf(token);

// Middleware para manejar errores
bot.catch((err, ctx) => {
  console.error(`Error en el chat: ${ctx.updateType}`, err);
});

// Almacenamiento temporal para mensajes por chat
const chatMessageHistory = new Map();

// Mapa para cachear respuestas de OpenAI
const cachedResponses = new Map();

// Inicio del bot
bot.launch().then(() => {
  console.log('Bot iniciado correctamente');
}).catch(err => {
  console.error('Error al iniciar el bot', err);
});

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

// Función para ajustar los parámetros basados en el texto del usuario
function adjustParameters(userText) {
  let temperature = 0.7, maxTokens = 150, topP = 0.8;

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

  return { temperature, maxTokens, topP };
}

// Función para obtener respuesta de OpenAI
async function getChatGPTResponse(messages) {
  const messagesKey = JSON.stringify(messages);
  if (cachedResponses.has(messagesKey)) {
    return cachedResponses.get(messagesKey);
  }

  const lastUserMessage = messages.filter(msg => msg.role === 'user').pop();
  const userText = lastUserMessage ? lastUserMessage.content.toLowerCase() : '';

  const { temperature, maxTokens, topP } = adjustParameters(userText);

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
      gptResponse = `¡Claro! Aquí tienes algunos recursos útiles sobre la comunidad LGTBI+: [enlace a recursos] ${gptResponse}`;
    }

    cachedResponses.set(messagesKey, gptResponse);
    return gptResponse;
  } catch (error) {
    console.error('Error al obtener respuesta de OpenAI:', error);
    return 'Lo siento, no pude entender eso. ¿Podrías intentarlo de nuevo?';
  }
}

// Entrenamiento del clasificador SVM para categorizar preguntas
const classifier = new SVM();
classifier.addExample(['SilvIA+', 'Marsha+', 'hola', 'hola'], 1); // Ejemplo de saludo
classifier.addExample(['SilvIA+', 'Marsha+', '¿cuál es tu nombre?', 'nombre'], 1); // Ejemplo de pregunta sobre nombre
// Añade más ejemplos según sea necesario

// Función para manejar mensajes del usuario
bot.on('message', async (ctx) => {
  try {
    const chatId = ctx.message.chat.id;
    const userMessage = {
      role: 'user',
      content: ctx.message.text
    };

    // Guardar mensaje del usuario en el historial de chat
    if (chatMessageHistory.has(chatId)) {
      chatMessageHistory.get(chatId).push(userMessage);
    } else {
      chatMessageHistory.set(chatId, [userMessage]);
    }

    // Obtener respuesta de OpenAI
    const response = await getChatGPTResponse(chatMessageHistory.get(chatId));
    
    // Enviar respuesta al usuario
    await ctx.reply(response);

    // Guardar mensaje del bot en el historial de chat
    const botMessage = {
      role: 'bot',
      content: response
    };
    chatMessageHistory.get(chatId).push(botMessage);

    // Guardar chat en la base de datos (opcional)
    // Aquí puedes agregar código para guardar el historial del chat en la base de datos si es necesario

    // Clasificar la pregunta para alertar al administrador si es necesario
    const prediction = classifier.predict(['SilvIA+', 'Marsha+', response, ctx.message.text]);
    if (prediction === 1) {
      await ctx.telegram.sendMessage(ADMIN_CHAT_ID, `El usuario en el chat ${chatId} preguntó: "${ctx.message.text}"`);
    }
  } catch (error) {
    console.error('Error al manejar mensaje:', error);
    await ctx.reply('Lo siento, hubo un problema al procesar tu solicitud. Por favor, inténtalo de nuevo más tarde.');
  }
});

// Manejar comandos /start y /help
bot.start((ctx) => ctx.reply(`Hola! Soy ${assistantName}, ${assistantDescription}`));
bot.help((ctx) => ctx.reply('Envíame un mensaje y te responderé enseguida.'));

// Manejar cualquier otro comando no reconocido
bot.on('text', (ctx) => ctx.reply('Lo siento, no entendí ese comando.'));

// Iniciar el bot
bot.launch().then(() => {
  console.log('Bot iniciado correctamente');
}).catch(err => {
  console.error('Error al iniciar el bot', err);
});









































































































































