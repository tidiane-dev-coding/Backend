const User = require('../models/User.model');
const Service = require('../models/Service.model');

// Récupérer tous les utilisateurs (admin seulement)
exports.getAllUsers = async (req, res) => {
  try {
    // Seul l'admin principal peut voir tous les utilisateurs
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès refusé. Seul l\'administrateur principal peut accéder à cette fonctionnalité.' });
    }

    const users = await User.find().select('-password').populate('service').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Récupérer un utilisateur par ID
exports.getUserById = async (req, res) => {
  try {
    // Seul l'admin principal peut voir les détails d'un utilisateur
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès refusé. Seul l\'administrateur principal peut accéder à cette fonctionnalité.' });
    }

    const user = await User.findById(req.params.id).select('-password').populate('service');
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Créer un utilisateur (admin seulement)
exports.createUser = async (req, res) => {
  try {
    // Seul l'admin principal peut créer des utilisateurs
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès refusé. Seul l\'administrateur principal peut créer des utilisateurs.' });
    }

    const { username, email, password, role, service } = req.body;

    // Vérifier que le service existe si fourni
    if (service) {
      const serviceDoc = await Service.findById(service);
      if (!serviceDoc) {
        return res.status(400).json({ message: 'Service invalide.' });
      }
    }

    // Vérifier si l'utilisateur existe
    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({ message: 'Utilisateur déjà existant' });
    }

    // Validation : service_admin doit avoir un service
    if (role === 'service_admin' && !service) {
      return res.status(400).json({ message: 'Un administrateur de service doit être assigné à un service.' });
    }

    // Créer l'utilisateur
    const user = await User.create({
      username,
      email,
      password,
      role: role || 'user',
      service: service || null
    });

    const populatedUser = await User.findById(user._id).select('-password').populate('service');
    res.status(201).json(populatedUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Modifier un utilisateur (admin seulement)
exports.updateUser = async (req, res) => {
  try {
    // Seul l'admin principal peut modifier des utilisateurs
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès refusé. Seul l\'administrateur principal peut modifier des utilisateurs.' });
    }

    const { username, email, role, service, password } = req.body;
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Vérifier que le service existe si fourni
    if (service) {
      const serviceDoc = await Service.findById(service);
      if (!serviceDoc) {
        return res.status(400).json({ message: 'Service invalide.' });
      }
    }

    // Validation : service_admin doit avoir un service
    if (role === 'service_admin' && !service) {
      return res.status(400).json({ message: 'Un administrateur de service doit être assigné à un service.' });
    }

    // Mettre à jour les champs
    if (username) user.username = username;
    if (email) user.email = email;
    if (role) user.role = role;
    if (service !== undefined) user.service = service || null;
    if (password) user.password = password; // Le hash sera fait automatiquement par le pre-save

    await user.save();
    const populatedUser = await User.findById(user._id).select('-password').populate('service');
    res.json(populatedUser);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email ou nom d\'utilisateur déjà existant' });
    }
    res.status(500).json({ message: error.message });
  }
};

// Supprimer un utilisateur (admin seulement)
exports.deleteUser = async (req, res) => {
  try {
    // Seul l'admin principal peut supprimer des utilisateurs
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès refusé. Seul l\'administrateur principal peut supprimer des utilisateurs.' });
    }

    // Empêcher la suppression de soi-même
    if (String(req.params.id) === String(req.user._id)) {
      return res.status(400).json({ message: 'Vous ne pouvez pas supprimer votre propre compte.' });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    res.json({ message: 'Utilisateur supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

