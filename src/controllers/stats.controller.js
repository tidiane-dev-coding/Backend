const Employee = require('../models/Employee.model');
const Attendance = require('../models/Attendance.model');
const Service = require('../models/Service.model');
const User = require('../models/User.model');
const dayjs = require('dayjs');

exports.getDashboardStats = async (req, res) => {
  try {
    // Déterminer le filtre selon le rôle de l'utilisateur
    let employeeFilter = {};
    const requester = req.user;
    
    if (requester && requester.role !== 'admin' && requester.role !== 'service_admin') {
      // User normal : seulement son propre profil
      const userEmployee = await Employee.findOne({ user: requester._id || requester.id }).select('_id');
      if (!userEmployee) {
        return res.json({
          effectifTotal: 0,
          employeesByService: [],
          tranchesAge: { '18-25': 0, '26-35': 0, '36-45': 0, '46-55': 0, '56+': 0 },
          repartitionGenre: [],
          situationMatrimoniale: [],
          ancienneteStats: {},
          enfantsStats: {},
          presencesMois: 0
        });
      }
      employeeFilter = { _id: userEmployee._id };
    } else if (requester && requester.role === 'service_admin') {
      // Service_admin : stats de son service
      const user = await User.findById(requester._id || requester.id).populate('service');
      if (!user || !user.service) {
        return res.json({
          effectifTotal: 0,
          employeesByService: [],
          tranchesAge: { '18-25': 0, '26-35': 0, '36-45': 0, '46-55': 0, '56+': 0 },
          repartitionGenre: [],
          situationMatrimoniale: [],
          ancienneteStats: {},
          enfantsStats: {},
          presencesMois: 0
        });
      }
      const userServiceId = user.service._id || user.service;
      employeeFilter = { service: userServiceId };
    }
    
    // Effectif total (filtré par employé si non-admin)
    const effectifTotal = await Employee.countDocuments(employeeFilter);
    
    // Employés par service - TOUJOURS montrer tous les services avec leur nombre d'employés
    // (même pour les non-admins, ils peuvent voir le nombre mais pas les détails)
    const employeesByServiceAggregation = [
      {
        $group: {
          _id: '$service',
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'services',
          localField: '_id',
          foreignField: '_id',
          as: 'serviceInfo'
        }
      },
      {
        $unwind: '$serviceInfo'
      },
      {
        $project: {
          service: '$serviceInfo.nom',
          count: 1
        }
      }
    ];
    
    // Pour les non-admins, on montre quand même le nombre d'employés par service
    // mais ils ne peuvent pas voir les détails individuels (géré dans employee.controller)
    const employeesByService = await Employee.aggregate(employeesByServiceAggregation);
    
    // Tranche d'âge (filtré par employé si non-admin)
    const employees = await Employee.find(employeeFilter, 'dateNaissance');
    const currentYear = dayjs().year();
    const tranchesAge = {
      '18-25': 0,
      '26-35': 0,
      '36-45': 0,
      '46-55': 0,
      '56+': 0
    };
    
    employees.forEach(emp => {
      const age = currentYear - dayjs(emp.dateNaissance).year();
      if (age >= 18 && age <= 25) tranchesAge['18-25']++;
      else if (age >= 26 && age <= 35) tranchesAge['26-35']++;
      else if (age >= 36 && age <= 45) tranchesAge['36-45']++;
      else if (age >= 46 && age <= 55) tranchesAge['46-55']++;
      else if (age >= 56) tranchesAge['56+']++;
    });
    
    // Répartition par genre (filtré par employé si non-admin)
    let repartitionGenreAggregation = [
      {
        $group: {
          _id: '$genre',
          count: { $sum: 1 }
        }
      }
    ];
    
    if (requester && requester.role !== 'admin' && requester.role !== 'service_admin') {
      const userEmployee = await Employee.findOne({ user: requester._id || requester.id }).select('_id');
      if (userEmployee) {
        repartitionGenreAggregation.unshift({
          $match: { _id: userEmployee._id }
        });
      }
    } else if (requester && requester.role === 'service_admin') {
      const user = await User.findById(requester._id || requester.id).populate('service');
      if (user && user.service) {
        const userServiceId = user.service._id || user.service;
        repartitionGenreAggregation.unshift({
          $match: { service: userServiceId }
        });
      }
    }
    
    const repartitionGenre = await Employee.aggregate(repartitionGenreAggregation);
    
    // Situation matrimoniale (filtré par employé si non-admin)
    let situationMatrimonialeAggregation = [
      {
        $group: {
          _id: '$situationMatrimoniale',
          count: { $sum: 1 }
        }
      }
    ];
    
    if (requester && requester.role !== 'admin') {
      const userEmployee = await Employee.findOne({ user: requester._id || requester.id }).select('_id');
      if (userEmployee) {
        situationMatrimonialeAggregation.unshift({
          $match: { _id: userEmployee._id }
        });
      }
    }
    
    const situationMatrimoniale = await Employee.aggregate(situationMatrimonialeAggregation);
    
    // Ancienneté (filtré par employé si non-admin)
    let ancienneteAggregation = [
      {
        $group: {
          _id: null,
          moyenne: { $avg: '$anciennete' },
          min: { $min: '$anciennete' },
          max: { $max: '$anciennete' }
        }
      }
    ];
    
    if (requester && requester.role !== 'admin') {
      const userEmployee = await Employee.findOne({ user: requester._id || requester.id }).select('_id');
      if (userEmployee) {
        ancienneteAggregation.unshift({
          $match: { _id: userEmployee._id }
        });
      }
    }
    
    const ancienneteStats = await Employee.aggregate(ancienneteAggregation);
    
    // Nombre d'enfants (filtré par employé si non-admin)
    let enfantsAggregation = [
      {
        $group: {
          _id: null,
          moyenne: { $avg: '$nombreEnfants' },
          total: { $sum: '$nombreEnfants' }
        }
      }
    ];
    
    if (requester && requester.role !== 'admin') {
      const userEmployee = await Employee.findOne({ user: requester._id || requester.id }).select('_id');
      if (userEmployee) {
        enfantsAggregation.unshift({
          $match: { _id: userEmployee._id }
        });
      }
    }
    
    const enfantsStats = await Employee.aggregate(enfantsAggregation);
    
    // Présences du mois (filtré par employé si non-admin)
    const startOfMonth = dayjs().startOf('month').toDate();
    const endOfMonth = dayjs().endOf('month').toDate();
    
    let attendanceQuery = {
      date: { $gte: startOfMonth, $lte: endOfMonth }
    };
    
    if (requester && requester.role !== 'admin' && requester.role !== 'service_admin') {
      const userEmployee = await Employee.findOne({ user: requester._id || requester.id }).select('_id');
      if (userEmployee) {
        attendanceQuery.employee = userEmployee._id;
      } else {
        attendanceQuery.employee = { $in: [] };
      }
    } else if (requester && requester.role === 'service_admin') {
      const user = await User.findById(requester._id || requester.id).populate('service');
      if (user && user.service) {
        const userServiceId = user.service._id || user.service;
        const employeesInService = await Employee.find({ service: userServiceId }).select('_id');
        const employeeIds = employeesInService.map(emp => emp._id);
        if (employeeIds.length > 0) {
          attendanceQuery.employee = { $in: employeeIds };
        } else {
          attendanceQuery.employee = { $in: [] };
        }
      } else {
        attendanceQuery.employee = { $in: [] };
      }
    }
    
    const presencesMois = await Attendance.countDocuments(attendanceQuery);
    
    res.json({
      effectifTotal,
      employeesByService,
      tranchesAge,
      repartitionGenre,
      situationMatrimoniale,
      ancienneteStats: ancienneteStats[0] || {},
      enfantsStats: enfantsStats[0] || {},
      presencesMois
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

