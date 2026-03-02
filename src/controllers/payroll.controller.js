const Payroll = require('../models/Payroll.model');
const Employee = require('../models/Employee.model');

// Lister les bulletins de paie (avec filtres optionnels)
exports.getPayrolls = async (req, res) => {
  try {
    const { month, year, employeeId } = req.query;

    const query = {};

    if (month) query.periodMonth = Number(month);
    if (year) query.periodYear = Number(year);
    if (employeeId) query.employee = employeeId;

    // Filtrage selon le rôle
    const requester = req.user;
    if (requester.role !== 'admin' && requester.role !== 'service_admin') {
      // Utilisateur normal : ne voir que ses propres bulletins
      const employee = await Employee.findOne({ user: requester._id || requester.id }).select('_id');
      if (!employee) {
        return res.json([]);
      }
      query.employee = employee._id;
    } else if (requester.role === 'service_admin') {
      // Service_admin : seulement les employés de son service
      const employeesInService = await Employee.find({ service: requester.service?._id || requester.service }).select('_id');
      const ids = employeesInService.map(e => e._id);
      if (ids.length === 0) {
        return res.json([]);
      }
      if (query.employee) {
        // Si un employeeId est fourni, vérifier qu'il est bien dans le service
        if (!ids.find(id => String(id) === String(query.employee))) {
          return res.status(403).json({ message: 'Accès refusé à cet employé.' });
        }
      } else {
        query.employee = { $in: ids };
      }
    }

    const payrolls = await Payroll.find(query)
      .populate('employee')
      .sort({ periodYear: -1, periodMonth: -1, createdAt: -1 });

    res.json(payrolls);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Récupérer un bulletin par ID
exports.getPayrollById = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id).populate('employee');
    if (!payroll) {
      return res.status(404).json({ message: 'Bulletin non trouvé' });
    }

    const requester = req.user;
    if (requester.role !== 'admin' && requester.role !== 'service_admin') {
      const employee = await Employee.findOne({ user: requester._id || requester.id }).select('_id');
      if (!employee || String(payroll.employee._id) !== String(employee._id)) {
        return res.status(403).json({ message: 'Accès refusé à ce bulletin.' });
      }
    } else if (requester.role === 'service_admin') {
      const employeesInService = await Employee.find({ service: requester.service?._id || requester.service }).select('_id');
      const ids = employeesInService.map(e => String(e._id));
      if (!ids.includes(String(payroll.employee._id))) {
        return res.status(403).json({ message: 'Accès refusé à ce bulletin.' });
      }
    }

    res.json(payroll);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Créer un bulletin de paie
exports.createPayroll = async (req, res) => {
  try {
    const { employee: employeeId, periodMonth, periodYear, baseSalary, allowances, deductions, currency, note } = req.body;

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(400).json({ message: 'Employé invalide' });
    }

    const payroll = await Payroll.create({
      employee: employeeId,
      periodMonth,
      periodYear,
      baseSalary,
      allowances,
      deductions,
      currency,
      note
    });

    await payroll.populate('employee');
    res.status(201).json(payroll);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Un bulletin existe déjà pour cet employé et cette période.' });
    }
    res.status(500).json({ message: error.message });
  }
};

// Mettre à jour un bulletin
exports.updatePayroll = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) {
      return res.status(404).json({ message: 'Bulletin non trouvé' });
    }

    // Mettre à jour les champs autorisés
    const updatableFields = ['baseSalary', 'allowances', 'deductions', 'currency', 'status', 'note'];
    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        payroll[field] = req.body[field];
      }
    });

    await payroll.save();
    await payroll.populate('employee');
    res.json(payroll);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Supprimer un bulletin
exports.deletePayroll = async (req, res) => {
  try {
    const payroll = await Payroll.findByIdAndDelete(req.params.id);
    if (!payroll) {
      return res.status(404).json({ message: 'Bulletin non trouvé' });
    }
    res.json({ message: 'Bulletin supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

