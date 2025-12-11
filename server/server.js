const app = require('./src/app');
const db = require('./src/config/database');
const { initializeDefaults } = require('./src/controllers/settingsController');

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0'; // Allow network access

// Initialize default settings
initializeDefaults();

// Start server
const server = app.listen(PORT, HOST, () => {
  console.log('\n=================================');
  console.log('🚀 Mini ERP Server Started');
  console.log('=================================');
  console.log(`📍 Local:    http://localhost:${PORT}`);
  console.log(`📍 Network:  http://${getLocalIP()}:${PORT}`);
  console.log(`🗄️  Database: SQLite (./database/erp.db)`);
  console.log(`👤 Default:  admin / admin123`);
  console.log('=================================\n');
});

// Get local IP address
function getLocalIP() {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '0.0.0.0';
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Closing server...');
  server.close(() => {
    console.log('Server closed');
    db.close();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received. Closing server...');
  server.close(() => {
    console.log('Server closed');
    db.close();
    process.exit(0);
  });
});
