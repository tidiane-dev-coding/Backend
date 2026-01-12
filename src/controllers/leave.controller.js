const Leave = require('../models/Leave.model');
const Employee = require('../models/Employee.model');
const User = require('../models/User.model');
const dayjs = require('dayjs');

exports.getAllLeaves = async (req, res) => {
  try {
    const { startDate, endDate, employeeId, statut, type } = req.query;
    let query = {};
    
    // Filtrer selon le rôle
    const requester = req.user;
    if (requester && requester.role !== 'admin' && requester.role !== 'service_admin') {
      // User normal : seulement ses propres congés
      const employee = await Employee.findOne({ user: requester._id || requester.id }).select('_id');
      if (!employee) {
        return res.json([]);
      }
      query.employee = employee._id;
    } else if (requester && requester.role === 'service_admin') {
      // Service_admin : congés des employés de son service
      const user = await User.findById(requester._id || requester.id).populate('service');
      if (user && user.service) {
        const userServiceId = user.service._id || user.service;
        const employeesInService = await Employee.find({ service: userServiceId }).select('_id');
        const employeeIds = employeesInService.map(emp => emp._id);
        if (employeeIds.length > 0) {
          query.employee = { $in: employeeIds };
        } else {
          return res.json([]);
        }
      } else {
        return res.json([]);
      }
    }
    
    // Filtre par employé
    if (employeeId) {
      query.employee = employeeId;
    }
    
    // Filtre par statut
    if (statut) {
      query.statut = statut;
    }
    
    // Filtre par type
    if (type) {
      query.type = type;
    }
    
    // Filtre par dates (si le congé chevauche la période)
    if (startDate || endDate) {
      query.$or = [];
      if (startDate && endDate) {
        // Trouver les congés qui chevauchent la période
        query.$or.push(
          { dateDebut: { $lte: dayjs(endDate).endOf('day').toDate() }, dateFin: { $gte: dayjs(startDate).startOf('day').toDate() } }
        );
      } else if (startDate) {
        query.$or.push({ dateFin: { $gte: dayjs(startDate).startOf('day').toDate() } });
      } else if (endDate) {
        query.$or.push({ dateDebut: { $lte: dayjs(endDate).endOf('day').toDate() } });
      }
    }
    
    const leaves = await Leave.find(query)
      .populate('employee', 'nom matricule poste')
      .populate('approuvePar', 'nom email')
      .sort({ dateDebut: -1, createdAt: -1 });
    
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getLeaveById = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id)
      .populate('employee')
      .populate('approuvePar', 'nom email');
    if (!leave) {
      return res.status(404).json({ message: 'Congé non trouvé' });
    }
    
    // Vérifier les permissions
    const requester = req.user;
    if (requester && requester.role !== 'admin' && requester.role !== 'service_admin') {
      const userEmployee = await Employee.findOne({ user: requester._id || requester.id }).select('_id');
      if (!userEmployee || String(userEmployee._id) !== String(leave.employee._id || leave.employee)) {
        return res.status(403).json({ message: 'Accès refusé' });
      }
    } else if (requester && requester.role === 'service_admin') {
      const user = await User.findById(requester._id || requester.id).populate('service');
      const employee = await Employee.findById(leave.employee._id || leave.employee).populate('service');
      if (user && user.service && employee && employee.service) {
        const userServiceId = user.service._id ? user.service._id.toString() : user.service.toString();
        const employeeServiceId = employee.service._id ? employee.service._id.toString() : employee.service.toString();
        if (userServiceId !== employeeServiceId) {
          return res.status(403).json({ message: 'Accès refusé' });
        }
      }
    }
    
    res.json(leave);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createLeave = async (req, res) => {
  try {
    const { employeeId, dateDebut, dateFin, type, raison, preuve } = req.body;
    
    // Validation
    if (!employeeId || !dateDebut || !dateFin || !type || !raison) {
      return res.status(400).json({ message: 'Tous les champs obligatoires doivent être remplis' });
    }
    
    const dateDebutObj = dayjs(dateDebut);
    const dateFinObj = dayjs(dateFin);
    
    if (dateFinObj.isBefore(dateDebutObj)) {
      return res.status(400).json({ message: 'La date de fin doit être supérieure ou égale à la date de début' });
    }
    
    // Récupérer l'employé
    let employee;
    const requester = req.user;
    if (requester.role !== 'admin' && requester.role !== 'service_admin') {
      // User normal : créer pour son propre profil
      employee = await Employee.findOne({ user: requester._id || requester.id });
      if (!employee) {
        return res.status(404).json({ message: 'Profil employé non trouvé' });
      }
    } else {
      employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({ message: 'Employé non trouvé' });
      }
      
      // Service_admin : vérifier que l'employé est dans son service
      if (requester.role === 'service_admin') {
        const user = await User.findById(requester._id || requester.id).populate('service');
        if (!user || !user.service) {
          return res.status(403).json({ message: 'Vous n\'avez pas de service assigné' });
        }
        const userServiceId = user.service._id ? user.service._id.toString() : user.service.toString();
        const employeeServiceId = employee.service._id ? employee.service._id.toString() : employee.service.toString();
        if (userServiceId !== employeeServiceId) {
          return res.status(403).json({ message: 'Vous ne pouvez créer des congés que pour les employés de votre service' });
        }
      }
    }
    
    const leave = await Leave.create({
      employee: employee._id,
      matricule: employee.matricule,
      nom: employee.nom,
      dateDebut: dateDebutObj.toDate(),
      dateFin: dateFinObj.toDate(),
      type,
      raison,
      preuve: preuve || null,
      statut: requester.role === 'admin' || requester.role === 'service_admin' ? 'approuve' : 'en_attente'
    });
    
    const populatedLeave = await Leave.findById(leave._id)
      .populate('employee', 'nom matricule poste')
      .populate('approuvePar', 'nom email');
    
    res.status(201).json(populatedLeave);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateLeave = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({ message: 'Congé non trouvé' });
    }
    
    // Vérifier les permissions
    const requester = req.user;
    if (requester.role !== 'admin' && requester.role !== 'service_admin') {
      const userEmployee = await Employee.findOne({ user: requester._id || requester.id }).select('_id');
      if (!userEmployee || String(userEmployee._id) !== String(leave.employee)) {
        return res.status(403).json({ message: 'Accès refusé' });
      }
      // User normal : ne peut modifier que certains champs avant approbation
      if (leave.statut === 'approuve') {
        return res.status(403).json({ message: 'Vous ne pouvez pas modifier un congé approuvé' });
      }
    }
    
    // Mise à jour
    const { dateDebut, dateFin, type, raison, preuve, statut, commentaireAdmin } = req.body;
    
    if (dateDebut) leave.dateDebut = dayjs(dateDebut).toDate();
    if (dateFin) leave.dateFin = dayjs(dateFin).toDate();
    if (type) leave.type = type;
    if (raison !== undefined) leave.raison = raison;
    if (preuve !== undefined) leave.preuve = preuve;
    
    // Seuls les admins peuvent approuver/refuser
    if (requester.role === 'admin' || requester.role === 'service_admin') {
      if (statut) {
        leave.statut = statut;
        if (statut === 'approuve' || statut === 'refuse') {
          leave.approuvePar = requester._id || requester.id;
          leave.dateApprobation = new Date();
        }
      }
      if (commentaireAdmin !== undefined) leave.commentaireAdmin = commentaireAdmin;
    }
    
    await leave.save();
    
    const populatedLeave = await Leave.findById(leave._id)
      .populate('employee', 'nom matricule poste')
      .populate('approuvePar', 'nom email');
    
    res.json(populatedLeave);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteLeave = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({ message: 'Congé non trouvé' });
    }
    
    // Vérifier les permissions
    const requester = req.user;
    if (requester.role !== 'admin' && requester.role !== 'service_admin') {
      const userEmployee = await Employee.findOne({ user: requester._id || requester.id }).select('_id');
      if (!userEmployee || String(userEmployee._id) !== String(leave.employee)) {
        return res.status(403).json({ message: 'Accès refusé' });
      }
      // User normal : ne peut supprimer que si en attente
      if (leave.statut !== 'en_attente') {
        return res.status(403).json({ message: 'Vous ne pouvez supprimer que les congés en attente' });
      }
    } else if (requester.role === 'service_admin') {
      const user = await User.findById(requester._id || requester.id).populate('service');
      const employee = await Employee.findById(leave.employee).populate('service');
      if (user && user.service && employee && employee.service) {
        const userServiceId = user.service._id ? user.service._id.toString() : user.service.toString();
        const employeeServiceId = employee.service._id ? employee.service._id.toString() : employee.service.toString();
        if (userServiceId !== employeeServiceId) {
          return res.status(403).json({ message: 'Accès refusé' });
        }
      }
    }
    
    await Leave.findByIdAndDelete(req.params.id);
    res.json({ message: 'Congé supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.approveLeave = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({ message: 'Congé non trouvé' });
    }
    
    const requester = req.user;
    if (requester.role !== 'admin' && requester.role !== 'service_admin') {
      return res.status(403).json({ message: 'Accès refusé' });
    }
    
    if (requester.role === 'service_admin') {
      const user = await User.findById(requester._id || requester.id).populate('service');
      const employee = await Employee.findById(leave.employee).populate('service');
      if (user && user.service && employee && employee.service) {
        const userServiceId = user.service._id ? user.service._id.toString() : user.service.toString();
        const employeeServiceId = employee.service._id ? employee.service._id.toString() : employee.service.toString();
        if (userServiceId !== employeeServiceId) {
          return res.status(403).json({ message: 'Accès refusé' });
        }
      }
    }
    
    leave.statut = 'approuve';
    leave.approuvePar = requester._id || requester.id;
    leave.dateApprobation = new Date();
    if (req.body.commentaireAdmin) {
      leave.commentaireAdmin = req.body.commentaireAdmin;
    }
    
    await leave.save();
    
    const populatedLeave = await Leave.findById(leave._id)
      .populate('employee', 'nom matricule poste')
      .populate('approuvePar', 'nom email');
    
    res.json(populatedLeave);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.rejectLeave = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({ message: 'Congé non trouvé' });
    }
    
    const requester = req.user;
    if (requester.role !== 'admin' && requester.role !== 'service_admin') {
      return res.status(403).json({ message: 'Accès refusé' });
    }
    
    if (requester.role === 'service_admin') {
      const user = await User.findById(requester._id || requester.id).populate('service');
      const employee = await Employee.findById(leave.employee).populate('service');
      if (user && user.service && employee && employee.service) {
        const userServiceId = user.service._id ? user.service._id.toString() : user.service.toString();
        const employeeServiceId = employee.service._id ? employee.service._id.toString() : employee.service.toString();
        if (userServiceId !== employeeServiceId) {
          return res.status(403).json({ message: 'Accès refusé' });
        }
      }
    }
    
    leave.statut = 'refuse';
    leave.approuvePar = requester._id || requester.id;
    leave.dateApprobation = new Date();
    if (req.body.commentaireAdmin) {
      leave.commentaireAdmin = req.body.commentaireAdmin;
    }
    
    await leave.save();
    
    const populatedLeave = await Leave.findById(leave._id)
      .populate('employee', 'nom matricule poste')
      .populate('approuvePar', 'nom email');
    
    res.json(populatedLeave);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

