const TelegramBot = require('node-telegram-bot-api');
const i18n = require('i18n');
const wtf = require('wtf_wikipedia');
const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config();
const { Pool } = require('pg');

// Configuración de la conexión a PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Permite conexiones SSL sin validación explícita
  }
});

// Verificar la conexión y crear la tabla "users" si no existe
pool.connect()
  .then(client => {
    console.log('Conexión exitosa a PostgreSQL');
    return client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        chat_id BIGINT UNIQUE NOT NULL,
        username VARCHAR(255),
        locale VARCHAR(10) DEFAULT 'es'
      );
    `).then(() => {
      return client.query(`
        CREATE TABLE IF NOT EXISTS blog_posts (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          url VARCHAR(255) NOT NULL
        );
      `);
    }).then(() => {
      client.release();
      console.log('Tablas verificadas o creadas: "users" y "blog_posts"');
    });
  })
  .catch(err => {
    console.error('Error de conexión a PostgreSQL:', err);
  });

// Verificar que las variables de entorno están cargadas correctamente
console.log('TELEGRAM_API_KEY:', process.env.TELEGRAM_API_KEY);
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY);
console.log('DATABASE_URL:', process.env.DATABASE_URL);

const token = process.env.TELEGRAM_API_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;
const assistantName = 'SilvIA+'; // Nombre del asistente

// Configuración de i18n
i18n.configure({
  locales: ['en', 'es'],
  directory: __dirname + '/locales',
  defaultLocale: 'es',
  queryParameter: 'lang',
  cookie: 'locale',
});

// Crear instancia del bot después de haber definido TelegramBot
const bot = new TelegramBot(token, { polling: true });
console.log('Bot iniciado correctamente');

// Función para hacer la llamada a OpenAI y cachear respuestas
const cachedResponses = new Map(); // Caché para almacenar respuestas de OpenAI

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
    const res = await pool.query('SELECT locale FROM users WHERE chat_id = $1', [chatId]);
    if (res.rows.length > 0) {
      return res.rows[0].locale;
    } else {
      return 'es'; // Idioma predeterminado si no se encuentra en la base de datos
    }
  } catch (error) {
    console.error('Error al obtener el idioma del usuario:', error);
    return 'es';
  }
}

// Función para actualizar/guardar el idioma del usuario en la base de datos
async function setUserLocale(chatId, locale) {
  try {
    await pool.query('INSERT INTO users (chat_id, locale) VALUES ($1, $2) ON CONFLICT (chat_id) DO UPDATE SET locale = $2', [chatId, locale]);
  } catch (error) {
    console.error('Error al configurar el idioma del usuario:', error);
  }
}

// Función para obtener el nombre de usuario desde la base de datos
async function getUsername(chatId) {
  try {
    const res = await pool.query('SELECT username FROM users WHERE chat_id = $1', [chatId]);
    if (res.rows.length > 0) {
      return res.rows[0].username;
    } else {
      return null; // No se ha encontrado el nombre de usuario
    }
  } catch (error) {
    console.error('Error al obtener el nombre de usuario:', error);
    return null;
  }
}

// Función para actualizar/guardar el nombre de usuario en la base de datos
async function setUsername(chatId, username) {
  try {
    await pool.query('INSERT INTO users (chat_id, username) VALUES ($1, $2) ON CONFLICT (chat_id) DO UPDATE SET username = $2', [chatId, username]);
  } catch (error) {
    console.error('Error al configurar el nombre de usuario:', error);
  }
}

// Función para scrapear los títulos de las publicaciones del blog en Wix
async function scrapeBlogPosts() {
  try {
    const response = await axios.get('https://www.marshafoundation.org/blog');
    const $ = cheerio.load(response.data);
    const posts = [];
    $('h2.blog-post-title').each((index, element) => {
      const title = $(element).text().trim();
      const url = $(element).find('a').attr('href');
      posts.push({ title, url });
    });
    return posts;
  } catch (error) {
    console.error('Error al hacer scraping del blog:', error);
    return [];
  }
}

// Función para almacenar los títulos de las publicaciones del blog en la base de datos
async function saveBlogPostsToDB(posts) {
  try {
    const client = await pool.connect();
    await client.query('DELETE FROM blog_posts'); // Limpiar tabla antes de insertar nuevos datos
    for (const post of posts) {
      await client.query('INSERT INTO blog_posts (title, url) VALUES ($1, $2)', [post.title, post.url]);
    }
    client.release();
    console.log('Datos del blog almacenados en PostgreSQL');
  } catch (error) {
    console.error('Error al almacenar datos del blog en PostgreSQL:', error);
  }
}

// Función para mostrar los títulos de las publicaciones del blog
async function showBlogPosts(chatId) {
  try {
    const res = await pool.query('SELECT title, url FROM blog_posts');
    if (res.rows.length > 0) {
      const posts = res.rows.map(post => `${post.title}: ${post.url}`).join('\n');
      bot.sendMessage(chatId, `Publicaciones del Blog:\n\n${posts}`);
    } else {
      bot.sendMessage(chatId, 'No hay publicaciones en el blog.');
    }
  } catch (error) {
    console.error('Error al obtener las publicaciones del blog:', error);
    bot.sendMessage(chatId, 'Ocurrió un error al obtener las publicaciones del blog.');
  }
}

// Escuchar todos los mensajes entrantes
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userMessage = msg.text;

  try {
    if (userMessage.toLowerCase().includes('/blog')) {
      // Comando para mostrar las publicaciones del blog
      const locale = await getUserLocale(chatId);
      i18n.setLocale(locale);
      showBlogPosts(chatId);
    } else {
      // Otro tipo de mensaje, procesar según sea necesario
      const prompt = { role: 'user', content: userMessage };
      const gptResponse = await getChatGPTResponse([prompt]);

      if (!gptResponse) {
        const doc = await wtf.fetch(userMessage, locale);
        const summary = doc && doc.sections(0).paragraphs(0).sentences(0).text();
        const username = await getUsername(chatId);
        const personalizedMessage = username ? `${username}, ${summary || i18n.__('Lo siento, no entiendo eso. ¿Podrías reformularlo?')}` : summary || i18n.__('Lo siento, no entiendo eso. ¿Podrías reformularlo?');
        bot.sendMessage(chatId, personalizedMessage);
      } else {
        bot.sendMessage(chatId, gptResponse);
      }
    }
  } catch (error) {
    console.error('Error al procesar el mensaje:', error);
    bot.sendMessage(chatId, i18n.__('Ha ocurrido un error al procesar tu mensaje. Intenta nuevamente más tarde.'));
  }
});

// Manejar el evento de inicio del bot (/start)
bot.onText(/\/start/, async (msg) => {
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
  i18n.setLocale(locale);
  bot.sendMessage(chatId, i18n.__('¡Hola! Por favor, elige tu idioma.'), opts);
});

// Manejar el cambio de idioma desde los botones de selección
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const locale = callbackQuery.data;
  i18n.setLocale(locale);
  await setUserLocale(chatId, locale);
  bot.sendMessage(chatId, i18n.__('Idioma cambiado a %s', i18n.getLocale()));
});

// Manejar errores de polling del bot
bot.on('polling_error', (error) => {
  console.error('Error de polling:', error);
});

// Manejar errores no capturados en el proceso
process.on('uncaughtException', (err) => {
  console.error('Error no capturado:', err);
});

// Manejar rechazos no manejados en promesas
process.on('unhandledRejection', (reason, promise) => {
  console.error('Error no manejado:', reason, 'promise:', promise);
});

// Ejecutar scraping y almacenamiento de datos del blog al iniciar el bot
(async () => {
  const blogPosts = await scrapeBlogPosts();
  await saveBlogPostsToDB(blogPosts);
  console.log('Proceso de scraping y almacenamiento completado');
})();

