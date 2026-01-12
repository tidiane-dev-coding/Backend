const Service = require('../models/Service.model');
const User = require('../models/User.model');

// Helper pour construire un arbre à partir d'une liste plate
const buildTree = (items) => {
  const map = {};
  const roots = [];

  items.forEach((item) => {
    map[item._id] = { ...item.toObject(), children: [] };
  });

  Object.values(map).forEach((node) => {
    if (node.parent) {
      const parent = map[node.parent];
      if (parent) parent.children.push(node);
      else roots.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
};

// Route publique pour l'inscription (retourne tous les services sans filtre)
exports.getAllServicesPublic = async (req, res) => {
  try {
    const services = await Service.find().sort({ createdAt: -1 });
    const tree = buildTree(services);
    res.json(tree);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllServices = async (req, res) => {
  try {
    // Si l'utilisateur est service_admin ou user, ne retourner que son service
    if (req.user && req.user.role !== 'admin') {
      const user = await User.findById(req.user._id || req.user.id).populate('service');
      if (!user || !user.service) {
        return res.json([]);
      }
      // Retourner uniquement le service de l'utilisateur (sans sous-services)
      const service = await Service.findById(user.service._id || user.service);
      if (!service) {
        return res.json([]);
      }
      return res.json([service]);
    }
    
    // Admin principal : retourner tous les services
    const services = await Service.find().sort({ createdAt: -1 });
    const tree = buildTree(services);
    res.json(tree);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getServiceById = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id).populate('parent').populate('children');
    if (!service) {
      return res.status(404).json({ message: 'Service non trouvé' });
    }
    
    // Si l'utilisateur est service_admin ou user, vérifier qu'il accède à son service
    if (req.user && req.user.role !== 'admin') {
      const user = await User.findById(req.user._id || req.user.id).populate('service');
      if (!user || !user.service) {
        return res.status(403).json({ message: 'Accès refusé. Vous n\'avez pas de service assigné.' });
      }
      const userServiceId = user.service._id ? user.service._id.toString() : user.service.toString();
      const requestedServiceId = service._id.toString();
      
      if (userServiceId !== requestedServiceId) {
        return res.status(403).json({ message: 'Accès refusé. Vous ne pouvez accéder qu\'à votre service.' });
      }
    }
    
    res.json(service);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createService = async (req, res) => {
  try {
    const { nom, description, parent } = req.body;
    const service = await Service.create({ nom, description, parent: parent || null });
    const populated = await Service.findById(service._id).populate('parent').populate('children');
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateService = async (req, res) => {
  try {
    const { nom, description, parent } = req.body;
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { nom, description, parent: parent || null },
      { new: true, runValidators: true }
    ).populate('parent').populate('children');
    if (!service) {
      return res.status(404).json({ message: 'Service non trouvé' });
    }
    res.json(service);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteService = async (req, res) => {
  try {
    // Vérifier s'il y a des sous-services
    const children = await Service.find({ parent: req.params.id }).limit(1);
    if (children.length > 0) {
      return res.status(400).json({ message: 'Impossible de supprimer un service qui a des sous-services. Supprimez ou réaffectez d\'abord les sous-services.' });
    }

    const service = await Service.findByIdAndDelete(req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Service non trouvé' });
    }
    res.json({ message: 'Service supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

