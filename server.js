const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Servir les fichiers statiques (photos)
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Servir également les assets (logo, images statiques)
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Connexion MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gestion-douk-rh', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(async () => {
    console.log('✅ MongoDB connecté');

    // Initialiser l'admin par défaut si il n'existe pas
    await initDefaultAdmin();
  })
  .catch(err => console.error('❌ Erreur MongoDB:', err));

// Fonction pour initialiser l'admin par défaut
const initDefaultAdmin = async () => {
  try {
    const User = require('./src/models/User.model');
    const existingAdmin = await User.findOne({ email: 'admin@douk.com' });

    if (!existingAdmin) {
      const admin = await User.create({
        username: 'admin',
        email: 'admin@douk.com',
        password: 'admin123',
        role: 'admin'
      });
      console.log('✅ Administrateur par défaut créé:');
      console.log('   📧 Email: admin@douk.com');
      console.log('   🔑 Mot de passe: admin123');
      console.log('   ⚠️  Changez ce mot de passe après la première connexion!');
    } else {
      console.log('ℹ️  Administrateur existe déjà');
    }
  } catch (error) {
    console.error('⚠️  Erreur lors de l\'initialisation de l\'admin:', error.message);
  }
};

// Routes
app.use('/api/auth', require('./src/routes/auth.routes'));
app.use('/api/users', require('./src/routes/user.routes'));
app.use('/api/services', require('./src/routes/service.routes'));
app.use('/api/employees', require('./src/routes/employee.routes'));
app.use('/api/attendance', require('./src/routes/attendance.routes'));
app.use('/api/leaves', require('./src/routes/leave.routes'));
app.use('/api/stats', require('./src/routes/stats.routes'));
app.use('/api/exports', require('./src/routes/export.routes'));
app.use('/api/payrolls', require('./src/routes/payroll.routes'));

// Log des routes pour débogage
console.log('📋 Routes disponibles:');
console.log('   POST /api/auth/register');
console.log('   POST /api/auth/login');
console.log('   GET  /api/auth/me');
console.log('   GET  /api/test');
console.log('   CRUD /api/payrolls');

// Route de test
app.get('/api/test', (req, res) => {
  res.json({ message: 'API fonctionnelle' });
});

// Route health check (anti-sommeil)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Erreur serveur', error: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});

