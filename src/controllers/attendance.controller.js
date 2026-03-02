const Attendance = require('../models/Attendance.model');
const Employee = require('../models/Employee.model');
const User = require('../models/User.model');
const dayjs = require('dayjs');

exports.getAllAttendance = async (req, res) => {
  try {
    const { startDate, endDate, employeeId } = req.query;
    let query = {};

    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        // Début de la journée pour startDate
        const start = dayjs(startDate).startOf('day').toDate();
        query.date.$gte = start;
      }
      if (endDate) {
        // Fin de la journée pour endDate (23:59:59.999)
        const end = dayjs(endDate).endOf('day').toDate();
        query.date.$lte = end;
      }
    }

    if (employeeId) {
      query.employee = employeeId;
    }

    // Filtrer selon le rôle
    const requester = req.user;
    if (requester && requester.role !== 'admin' && requester.role !== 'service_admin') {
      // User normal : seulement ses propres pointages
      const employee = await Employee.findOne({ user: requester._id || requester.id }).select('_id');
      if (!employee) {
        return res.json([]);
      }
      query.employee = employee._id;
    } else if (requester && requester.role === 'service_admin') {
      // Service_admin : pointages des employés de son service
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

    const attendance = await Attendance.find(query)
      .populate('employee', 'nom matricule poste')
      .sort({ date: -1, heureArrivee: -1 });

    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAttendanceById = async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id).populate('employee');
    if (!attendance) {
      return res.status(404).json({ message: 'Présence non trouvée' });
    }

    // Vérifier les permissions selon le rôle
    const requester = req.user;
    if (requester && requester.role !== 'admin' && requester.role !== 'service_admin') {
      // User normal : seulement son propre pointage
      const userEmployee = await Employee.findOne({ user: requester._id || requester.id }).select('_id');
      if (!userEmployee) {
        return res.status(403).json({ message: 'Accès refusé. Vous n\'avez pas de profil employé.' });
      }
      const attendanceEmployeeId = attendance.employee._id ? attendance.employee._id.toString() : attendance.employee.toString();
      const userEmployeeId = userEmployee._id.toString();
      if (attendanceEmployeeId !== userEmployeeId) {
        return res.status(403).json({ message: 'Accès refusé. Vous ne pouvez voir que vos propres pointages.' });
      }
    } else if (requester && requester.role === 'service_admin') {
      // Service_admin : pointages des employés de son service
      const user = await User.findById(requester._id || requester.id).populate('service');
      if (!user || !user.service) {
        return res.status(403).json({ message: 'Accès refusé. Vous n\'avez pas de service assigné.' });
      }
      const employee = await Employee.findById(attendance.employee._id || attendance.employee).populate('service');
      if (!employee || !employee.service) {
        return res.status(403).json({ message: 'Accès refusé.' });
      }
      const userServiceId = user.service._id ? user.service._id.toString() : user.service.toString();
      const employeeServiceId = employee.service._id ? employee.service._id.toString() : employee.service.toString();
      if (userServiceId !== employeeServiceId) {
        return res.status(403).json({ message: 'Accès refusé. Vous ne pouvez voir que les pointages des employés de votre service.' });
      }
    }

    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.checkIn = async (req, res) => {
  try {
    // Accept either { matricule } or { matricule, photo, photoTimestamp }
    const { matricule, photo, photoTimestamp } = req.body;

    // Trouver l'employé
    const employee = await Employee.findOne({ matricule });
    if (!employee) {
      return res.status(404).json({ message: 'Employé non trouvé' });
    }

    // Vérifier les permissions selon le rôle
    const requester = req.user;
    if (requester && requester.role !== 'admin' && requester.role !== 'service_admin') {
      // User normal : seulement pointer pour lui-même
      if (!employee.user || String(employee.user) !== String(requester._id)) {
        return res.status(403).json({ message: 'Accès refusé. Vous ne pouvez pointer que pour vous-même.' });
      }
    } else if (requester && requester.role === 'service_admin') {
      // Service_admin : peut pointer pour les employés de son service
      const user = await User.findById(requester._id || requester.id).populate('service');
      if (!user || !user.service) {
        return res.status(403).json({ message: 'Accès refusé. Vous n\'avez pas de service assigné.' });
      }
      const userServiceId = user.service._id ? user.service._id.toString() : user.service.toString();
      const employeeServiceId = employee.service._id ? employee.service._id.toString() : employee.service.toString();
      if (userServiceId !== employeeServiceId) {
        return res.status(403).json({ message: 'Accès refusé. Vous ne pouvez pointer que pour les employés de votre service.' });
      }
    }

    // Vérifier si déjà présent aujourd'hui
    const today = dayjs().startOf('day');
    const existingAttendance = await Attendance.findOne({
      employee: employee._id,
      date: {
        $gte: today.toDate(),
        $lt: today.add(1, 'day').toDate()
      }
    });

    if (existingAttendance) {
      return res.status(400).json({
        message: 'Pointage déjà effectué aujourd\'hui',
        attendance: existingAttendance
      });
    }

    // Create attendance payload
    const attendancePayload = {
      employee: employee._id,
      matricule: employee.matricule,
      nom: `${employee.nom} ${employee.prenom || ''}`.trim(),
      date: new Date(),
      heureArrivee: new Date()
    };

    if (photo) attendancePayload.photo = photo;
    if (photoTimestamp) attendancePayload.photoTimestamp = new Date(photoTimestamp);

    // Créer le pointage
    const attendance = await Attendance.create(attendancePayload);

    const populatedAttendance = await Attendance.findById(attendance._id).populate('employee');
    res.status(201).json(populatedAttendance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.checkOut = async (req, res) => {
  try {
    const { matricule } = req.body;

    // Trouver l'employé
    const employee = await Employee.findOne({ matricule });
    if (!employee) {
      return res.status(404).json({ message: 'Employé non trouvé' });
    }

    // Vérifier les permissions selon le rôle
    const requester = req.user;
    if (requester && requester.role !== 'admin' && requester.role !== 'service_admin') {
      // User normal : seulement pointer pour lui-même
      if (!employee.user || String(employee.user) !== String(requester._id)) {
        return res.status(403).json({ message: 'Accès refusé. Vous ne pouvez pointer que pour vous-même.' });
      }
    } else if (requester && requester.role === 'service_admin') {
      // Service_admin : peut pointer pour les employés de son service
      const user = await User.findById(requester._id || requester.id).populate('service');
      if (!user || !user.service) {
        return res.status(403).json({ message: 'Accès refusé. Vous n\'avez pas de service assigné.' });
      }
      const userServiceId = user.service._id ? user.service._id.toString() : user.service.toString();
      const employeeServiceId = employee.service._id ? employee.service._id.toString() : employee.service.toString();
      if (userServiceId !== employeeServiceId) {
        return res.status(403).json({ message: 'Accès refusé. Vous ne pouvez pointer que pour les employés de votre service.' });
      }
    }

    // Trouver le pointage du jour
    const today = dayjs().startOf('day');
    const attendance = await Attendance.findOne({
      employee: employee._id,
      date: {
        $gte: today.toDate(),
        $lt: today.add(1, 'day').toDate()
      }
    });

    if (!attendance) {
      return res.status(404).json({ message: 'Aucun pointage d\'arrivée trouvé pour aujourd\'hui' });
    }

    if (attendance.heureDepart) {
      return res.status(400).json({ message: 'Pointage de départ déjà effectué' });
    }

    // Enregistrer le départ
    attendance.heureDepart = new Date();
    await attendance.save();

    const populatedAttendance = await Attendance.findById(attendance._id).populate('employee');
    res.json(populatedAttendance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.markAbsence = async (req, res) => {
  try {
    const { employeeId, date, reason, proof } = req.body;

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employé non trouvé' });
    }

    const targetDay = dayjs(date || new Date()).startOf('day');

    const existingAttendance = await Attendance.findOne({
      employee: employee._id,
      date: {
        $gte: targetDay.toDate(),
        $lt: targetDay.add(1, 'day').toDate()
      }
    });

    if (existingAttendance) {
      return res.status(400).json({ message: 'Une présence existe déjà pour ce jour' });
    }

    // Validation: motif et preuve obligatoires
    if (!reason || reason.toString().trim() === '') {
      return res.status(400).json({ message: 'Le motif de l\'absence est obligatoire' });
    }
    if (!proof) {
      return res.status(400).json({ message: 'Une preuve (photo ou document) est requise pour l\'absence' });
    }

    const attendancePayload = {
      employee: employee._id,
      matricule: employee.matricule,
      nom: `${employee.nom} ${employee.prenom || ''}`.trim(),
      date: targetDay.toDate(),
      statut: 'absent'
    }

    attendancePayload.reason = reason
    attendancePayload.proof = proof

    // Vérifier la taille du proof (limite MongoDB: 16MB, mais on limite à 5MB pour sécurité)
    if (proof && proof.length > 5 * 1024 * 1024) {
      return res.status(400).json({
        message: 'La preuve est trop volumineuse. Veuillez utiliser une image plus petite (max 5MB).'
      });
    }

    try {
      const attendance = await Attendance.create(attendancePayload);
      const populatedAttendance = await Attendance.findById(attendance._id).populate('employee');
      res.status(201).json(populatedAttendance);
    } catch (dbError) {
      if (dbError.message && dbError.message.includes('too large')) {
        return res.status(400).json({
          message: 'La preuve est trop volumineuse. Veuillez utiliser une image plus petite.'
        });
      }
      throw dbError;
    }
  } catch (error) {
    console.error('Erreur markAbsence:', error);
    res.status(500).json({
      message: error.message || 'Erreur lors de l\'enregistrement de l\'absence. Veuillez réessayer.'
    });
  }
};

exports.updateAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('employee');

    if (!attendance) {
      return res.status(404).json({ message: 'Présence non trouvée' });
    }

    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.findByIdAndDelete(req.params.id);
    if (!attendance) {
      return res.status(404).json({ message: 'Présence non trouvée' });
    }
    res.json({ message: 'Présence supprimée avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

