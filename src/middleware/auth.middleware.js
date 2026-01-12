const jwt = require('jsonwebtoken');
const User = require('../models/User.model');

// Middleware d'authentification
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Accès refusé. Token manquant.' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const user = await User.findById(decoded.id).select('-password').populate('service');
    
    if (!user) {
      return res.status(401).json({ message: 'Utilisateur non trouvé.' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Erreur d\'authentification:', error.message);
    res.status(401).json({ message: 'Token invalide.' });
  }
};

// Middleware admin (admin principal seulement)
const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Accès refusé. Administrateur principal requis.' });
  }
  next();
};

// Middleware pour admin principal ou service_admin
const adminOrServiceAdminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'service_admin') {
    return res.status(403).json({ message: 'Accès refusé. Administrateur requis.' });
  }
  next();
};

module.exports = { authMiddleware, adminMiddleware, adminOrServiceAdminMiddleware };

