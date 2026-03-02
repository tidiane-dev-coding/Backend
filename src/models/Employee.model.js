const mongoose = require('mongoose');
const dayjs = require('dayjs');

const employeeSchema = new mongoose.Schema({
  numero: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  matricule: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  nom: {
    type: String,
    required: true,
    trim: true
  },
  prenom: {
    type: String,
    required: true,
    trim: true
  },
  poste: {
    type: String,
    required: true,
    trim: true
  },
  photo: {
    type: String, // Chemin relatif vers le fichier
    default: null
  },
  genre: {
    type: String,
    enum: ['Homme', 'Femme'],
    required: true
  },
  dateNaissance: {
    type: Date,
    required: true
  },
  lieuNaissance: {
    type: String,
    required: true,
    trim: true
  },
  lieuResidence: {
    type: String,
    required: true,
    trim: true
  },
  nationalite: {
    type: String,
    required: true,
    trim: true
  },
  dateEmbauche: {
    type: Date
  },
  anciennete: {
    type: Number,
    default: 0,
    min: 0
  },
  filiation: {
    type: String,
    trim: true
  },
  situationMatrimoniale: {
    type: String,
    enum: ['Célibataire', 'Marié(e)', 'Divorcé(e)', 'Veuf(ve)'],
    required: true
  },
  nombreEnfants: {
    type: Number,
    default: 0,
    min: 0
  },
  statutJuridique: {
    type: String,
    enum: ['Décret', 'Affecter', 'Détacher', 'CDI', 'CDD'],
    required: true
  },
  niveauEtude: {
    type: String,
    enum: ['Primaire', 'Secondaire', 'Baccalauréat', 'BTS', 'Licence', 'Master', 'Doctorat', 'Autre'],
    trim: true
  },
  cadre: {
    type: String,
    enum: ['Cadre supérieur', 'Cadre moyen', 'Employé', 'Cadre', 'Chargé d\'étude', 'Agent de maîtrise', 'Cadre dirigeant', 'Autre'],
    trim: true
  },
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    unique: true,
    sparse: true
  },
  qrCode: {
    type: String,
    unique: true
  }
}, {
  timestamps: true
});

// Générer le QR code et calculer l'ancienneté avant sauvegarde
employeeSchema.pre('save', async function (next) {
  // Calculer l'ancienneté automatiquement à partir de la date d'embauche
  if (this.dateEmbauche) {
    const today = dayjs();
    const hireDate = dayjs(this.dateEmbauche);

    if (hireDate.isBefore(today) || hireDate.isSame(today, 'day')) {
      // Calculer la différence en années
      const years = today.diff(hireDate, 'year');
      // Stocker l'ancienneté en années (nombre entier)
      this.anciennete = years;
    } else {
      // Date d'embauche dans le futur, ancienneté = 0
      this.anciennete = 0;
    }
  } else {
    // Pas de date d'embauche, ancienneté = 0
    this.anciennete = 0;
  }

  // Générer le QR code
  if (!this.qrCode) {
    const QRCode = require('qrcode');
    try {
      this.qrCode = await QRCode.toDataURL(this.matricule);
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Méthode virtuelle pour obtenir l'ancienneté détaillée (années, mois, jours)
employeeSchema.virtual('ancienneteDetaillee').get(function () {
  if (!this.dateEmbauche) {
    return { annees: 0, mois: 0, jours: 0 };
  }

  const today = dayjs();
  const hireDate = dayjs(this.dateEmbauche);

  if (hireDate.isAfter(today)) {
    return { annees: 0, mois: 0, jours: 0 };
  }

  let years = today.diff(hireDate, 'year');
  let months = today.diff(hireDate.add(years, 'year'), 'month');
  let days = today.diff(hireDate.add(years, 'year').add(months, 'month'), 'day');

  return { annees: years, mois: months, jours: days };
});

// Inclure les propriétés virtuelles dans JSON
employeeSchema.set('toJSON', { virtuals: true });
employeeSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Employee', employeeSchema);

