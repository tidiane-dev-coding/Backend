const Employee = require('../models/Employee.model');
const User = require('../models/User.model');
const Service = require('../models/Service.model');
const QRCode = require('qrcode');

exports.getAllEmployees = async (req, res) => {
  try {
    // Récupérer l'utilisateur connecté avec son service
    const user = await User.findById(req.user._id || req.user.id).populate('service');

    let query = {};

    // Si l'utilisateur n'est pas admin ou service_admin, ne retourner que SON propre profil employé
    if (user.role !== 'admin' && user.role !== 'service_admin') {
      // Filtrer uniquement l'employé lié à cet utilisateur
      query.user = user._id;
    } else if (user.role === 'service_admin' && user.service) {
      // Service_admin : voir tous les employés de son service
      const userServiceId = user.service._id || user.service;
      query.service = userServiceId;
    }

    const employees = await Employee.find(query).populate('service').sort({ createdAt: -1 });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getEmployeeById = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id).populate('service');
    if (!employee) {
      return res.status(404).json({ message: 'Employé non trouvé' });
    }

    // Vérifier les permissions selon le rôle
    const requester = req.user;
    if (requester && requester.role !== 'admin' && requester.role !== 'service_admin') {
      // User normal : seulement son propre profil
      if (!employee.user || String(employee.user) !== String(requester._id)) {
        return res.status(403).json({ message: 'Accès refusé. Vous ne pouvez voir que votre propre profil.' });
      }
    } else if (requester && requester.role === 'service_admin') {
      // Service_admin : seulement les employés de son service
      const user = await User.findById(requester._id || requester.id).populate('service');
      if (!user || !user.service) {
        return res.status(403).json({ message: 'Accès refusé. Vous n\'avez pas de service assigné.' });
      }
      const userServiceId = user.service._id ? user.service._id.toString() : user.service.toString();
      const employeeServiceId = employee.service._id ? employee.service._id.toString() : employee.service.toString();
      if (userServiceId !== employeeServiceId) {
        return res.status(403).json({ message: 'Accès refusé. Vous ne pouvez voir que les employés de votre service.' });
      }
    }

    res.json(employee);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getEmployeeByMatricule = async (req, res) => {
  try {
    const employee = await Employee.findOne({ matricule: req.params.matricule }).populate('service');
    if (!employee) {
      return res.status(404).json({ message: 'Employé non trouvé' });
    }

    // Vérifier les permissions selon le rôle
    const requester = req.user;
    if (requester && requester.role !== 'admin' && requester.role !== 'service_admin') {
      // User normal : seulement son propre profil
      if (!employee.user || String(employee.user) !== String(requester._id)) {
        return res.status(403).json({ message: 'Accès refusé. Vous ne pouvez voir que votre propre profil.' });
      }
    } else if (requester && requester.role === 'service_admin') {
      // Service_admin : seulement les employés de son service
      const user = await User.findById(requester._id || requester.id).populate('service');
      if (!user || !user.service) {
        return res.status(403).json({ message: 'Accès refusé. Vous n\'avez pas de service assigné.' });
      }
      const userServiceId = user.service._id ? user.service._id.toString() : user.service.toString();
      const employeeServiceId = employee.service._id ? employee.service._id.toString() : employee.service.toString();
      if (userServiceId !== employeeServiceId) {
        return res.status(403).json({ message: 'Accès refusé. Vous ne pouvez voir que les employés de votre service.' });
      }
    }

    res.json(employee);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createEmployee = async (req, res) => {
  try {
    const employeeData = req.body;

    // Supprimer l'ancienneté des données car elle sera calculée automatiquement à partir de dateEmbauche
    delete employeeData.anciennete;

    // Gérer les permissions selon le rôle
    const requestingUser = req.user; // peuplé par auth middleware
    if (requestingUser.role !== 'admin' && requestingUser.role !== 'service_admin') {
      // User normal : créer son propre profil
      if (!requestingUser.service) {
        return res.status(400).json({ message: 'Votre compte n\'est pas rattaché à un service.' });
      }
      // Empêcher création multiple de profil employé pour un même user
      const existing = await Employee.findOne({ user: requestingUser._id });
      if (existing) {
        return res.status(400).json({ message: 'Vous avez déjà un profil employé.' });
      }
      employeeData.service = requestingUser.service._id || requestingUser.service;
      employeeData.user = requestingUser._id;
    } else if (requestingUser.role === 'service_admin') {
      // Service_admin : peut créer des employés dans son service
      if (!requestingUser.service) {
        return res.status(400).json({ message: 'Votre compte n\'est pas rattaché à un service.' });
      }
      // Forcer le service de l'employé au service de l'admin
      employeeData.service = requestingUser.service._id || requestingUser.service;
      // Ne pas lier automatiquement à un user (peut être créé sans user)
    }

    // Générer le QR code
    const qrCodeDataUrl = await QRCode.toDataURL(employeeData.matricule);
    employeeData.qrCode = qrCodeDataUrl;

    // Gérer l'upload de photo
    if (req.file) {
      // Stocker le chemin relatif normalized.ex: uploads\file.jpg -> uploads/file.jpg
      employeeData.photo = req.file.path.replace(/\\/g, '/').split('uploads/').pop();
      // On stocke seulement le nom du fichier ou le chemin relatif
      // Pour être plus simple, stockons 'uploads/filename'
      employeeData.photo = 'uploads/' + req.file.filename;
    }

    const employee = await Employee.create(employeeData);
    const populatedEmployee = await Employee.findById(employee._id).populate('service');
    res.status(201).json(populatedEmployee);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Numéro ou matricule déjà existant' });
    }
    res.status(500).json({ message: error.message });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employé non trouvé' });
    }

    // Autorisations selon le rôle
    const requester = req.user;
    if (requester.role !== 'admin' && requester.role !== 'service_admin') {
      // User normal : seulement son propre profil
      if (!employee.user || String(employee.user) !== String(requester._id)) {
        return res.status(403).json({ message: 'Accès refusé. Vous ne pouvez modifier que votre propre profil.' });
      }
      // Forcer que le service reste le même et user reste le même
      if (req.body.service && String(req.body.service) !== String(employee.service)) {
        return res.status(400).json({ message: 'Vous ne pouvez pas modifier le service.' });
      }
      delete req.body.user; // empêcher changement du lien user
    } else if (requester.role === 'service_admin') {
      // Service_admin : peut modifier les employés de son service
      const user = await User.findById(requester._id || requester.id).populate('service');
      if (!user || !user.service) {
        return res.status(403).json({ message: 'Accès refusé. Vous n\'avez pas de service assigné.' });
      }
      const userServiceId = user.service._id ? user.service._id.toString() : user.service.toString();
      const employeeServiceId = employee.service._id ? employee.service._id.toString() : employee.service.toString();
      if (userServiceId !== employeeServiceId) {
        return res.status(403).json({ message: 'Accès refusé. Vous ne pouvez modifier que les employés de votre service.' });
      }
      // Forcer que le service reste le même
      if (req.body.service && String(req.body.service) !== String(employee.service)) {
        return res.status(400).json({ message: 'Vous ne pouvez pas modifier le service.' });
      }
    }

    // Supprimer l'ancienneté des données car elle sera calculée automatiquement à partir de dateEmbauche
    const updateData = { ...req.body };
    delete updateData.anciennete;

    // Appliquer les modifications
    Object.assign(employee, updateData);

    // Gérer l'upload de photo
    if (req.file) {
      employee.photo = 'uploads/' + req.file.filename;
    }

    // Régénérer QR si matricule modifié
    if (req.body.matricule && req.body.matricule !== employee.matricule) {
      const qrCodeDataUrl = await QRCode.toDataURL(req.body.matricule);
      employee.qrCode = qrCodeDataUrl;
    }
    await employee.save();
    await employee.populate('service');

    res.json(employee);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMyEmployee = async (req, res) => {
  try {
    const emp = await Employee.findOne({ user: req.user._id }).populate('service');
    if (!emp) return res.status(404).json({ message: 'Profil employé non trouvé.' });
    res.json(emp);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByIdAndDelete(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employé non trouvé' });
    }
    res.json({ message: 'Employé supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getQRCode = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employé non trouvé' });
    }

    // Vérifier les permissions selon le rôle
    const requester = req.user;
    if (requester && requester.role !== 'admin' && requester.role !== 'service_admin') {
      // User normal : seulement son propre QR code
      if (!employee.user || String(employee.user) !== String(requester._id)) {
        return res.status(403).json({ message: 'Accès refusé. Vous ne pouvez voir que votre propre QR code.' });
      }
    } else if (requester && requester.role === 'service_admin') {
      // Service_admin : peut voir les QR codes des employés de son service
      const user = await User.findById(requester._id || requester.id).populate('service');
      if (!user || !user.service) {
        return res.status(403).json({ message: 'Accès refusé. Vous n\'avez pas de service assigné.' });
      }
      const userServiceId = user.service._id ? user.service._id.toString() : user.service.toString();
      const employeeServiceId = employee.service._id ? employee.service._id.toString() : employee.service.toString();
      if (userServiceId !== employeeServiceId) {
        return res.status(403).json({ message: 'Accès refusé. Vous ne pouvez voir que les QR codes des employés de votre service.' });
      }
    }

    res.json({ qrCode: employee.qrCode });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

