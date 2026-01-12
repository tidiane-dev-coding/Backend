const User = require('../models/User.model');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret', {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

const Service = require('../models/Service.model');

exports.register = async (req, res) => {
  try {
    const { username, email, password, role, service } = req.body;

    // service obligatoire pour les employés
    if (!service) {
      return res.status(400).json({ message: 'Le champ service est obligatoire.' });
    }

    // Vérifier que le service existe
    const serviceDoc = await Service.findById(service);
    if (!serviceDoc) {
      return res.status(400).json({ message: 'Service invalide.' });
    }

    // Vérifier si l'utilisateur existe
    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({ message: 'Utilisateur déjà existant' });
    }

    // Empêcher la création d'admins via l'inscription publique
    // Seul l'admin principal peut créer des admins via /api/users
    if (role === 'admin' || role === 'service_admin') {
      return res.status(403).json({ message: 'Vous ne pouvez pas créer un administrateur via l\'inscription publique.' });
    }

    // Créer l'utilisateur (toujours avec le rôle 'user')
    const user = await User.create({
      username,
      email,
      password,
      role: 'user', // Forcer le rôle à 'user' pour l'inscription publique
      service: serviceDoc._id
    });

    const populatedUser = await User.findById(user._id).select('-password').populate('service');

    const token = generateToken(user._id);

    res.status(201).json({
      token,
      user: {
        id: populatedUser._id,
        username: populatedUser.username,
        email: populatedUser.email,
        role: populatedUser.role,
        service: populatedUser.service
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis' });
    }
    
    console.log(`🔐 Tentative de connexion pour: ${email}`);
    
    // Vérifier l'utilisateur
    const user = await User.findOne({ email: email.toLowerCase().trim() }).populate('service');
    if (!user) {
      console.log(`❌ Email inexistant: ${email}`);
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }
    
    // Vérifier le mot de passe
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      console.log(`❌ Mot de passe incorrect pour: ${email}`);
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }
    
    const token = generateToken(user._id);
    console.log(`✅ Connexion réussie pour: ${email} (${user.role})`);
    
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        service: user.service
      }
    });
  } catch (error) {
    console.error('❌ Erreur lors de la connexion:', error);
    res.status(500).json({ message: error.message || 'Erreur serveur lors de la connexion' });
  }
};

exports.getMe = async (req, res) => {
  try {
    // Utiliser req.user._id ou req.user.id selon ce que le middleware fournit
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId).select('-password').populate('service');
    
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }
    
    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      service: user.service
    });
  } catch (error) {
    console.error('Erreur getMe:', error);
    res.status(500).json({ message: error.message });
  }
};

