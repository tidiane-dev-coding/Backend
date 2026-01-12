const mongoose = require('mongoose');
const User = require('../models/User.model');
require('dotenv').config();

const initAdmin = async () => {
  try {
    // Connexion MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gestion-douk-rh', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connecté à MongoDB');
    
    // Vérifier si un admin existe déjà
    const existingAdmin = await User.findOne({ email: 'admin@douk.com' });
    
    if (existingAdmin) {
      console.log('ℹ️  Un administrateur existe déjà avec l\'email admin@douk.com');
      console.log('   Vous pouvez vous connecter avec:');
      console.log('   Email: admin@douk.com');
      console.log('   Mot de passe: (celui que vous avez défini)');
      process.exit(0);
    }
    
    // Créer l'admin par défaut
    const admin = await User.create({
      username: 'admin',
      email: 'admin@douk.com',
      password: 'admin123',
      role: 'admin'
    });
    
    console.log('✅ Administrateur créé avec succès!');
    console.log('   Email: admin@douk.com');
    console.log('   Mot de passe: admin123');
    console.log('   ⚠️  Changez ce mot de passe après la première connexion!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
};

initAdmin();


