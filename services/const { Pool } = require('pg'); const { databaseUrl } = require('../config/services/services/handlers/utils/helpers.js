function matchPhrases(message, phrases) {
  const normalizedMessage = message.trim().toLowerCase();
  return phrases.includes(normalizedMessage);
}

function getRandomResponse(array) {
  return array[Math.floor(Math.random() * array.length)];
}

module.exports = { matchPhrases, getRandomResponse };
