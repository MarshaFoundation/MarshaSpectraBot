const axios = require('axios');
const { openaiApiKey } = require('../config/config');
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

    gptResponse = gptResponse.replace(/\b(chat\s*GPT|GPT|OpenAI|AI)\b/gi, 'esta asistente');

    cachedResponses.set(messagesKey, gptResponse);
    setTimeout(() => cachedResponses.delete(messagesKey), 30 * 60 * 1000); 

    return gptResponse;
  } catch (error) {
    console.error('Error al llamar a OpenAI:', error);
    return 'Lo siento, actualmente no puedo procesar tu solicitud.';
  }
}

module.exports = { getChatGPTResponse };
