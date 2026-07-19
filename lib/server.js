const http = require('http');

/**
 * Tiny HTTP server so hosting platforms (Railway, Render, etc.) that expect
 * a bound port see the service as healthy. Not required for local use.
 */
function startServer(settings) {
  const port = process.env.PORT || 3000;

  http
    .createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'online',
          bot: settings.botName,
          owner: settings.ownerName,
          github: settings.github
        })
      );
    })
    .listen(port, () => console.log(`🌐 Health server running on port ${port}`));
}

module.exports = { startServer };
