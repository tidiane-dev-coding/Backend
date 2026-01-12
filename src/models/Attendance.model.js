const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  matricule: {
    type: String,
    required: true
  },
  nom: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  heureArrivee: {
    type: Date
  },
  heureDepart: {
    type: Date
  },
  heuresTotales: {
    type: Number,
    default: 0
  },
  statut: {
    type: String,
    enum: ['present', 'absent', 'retard'],
    default: 'present'
  }
  ,
  // Photo (data URL or stored URL) captured lors du check-in
  photo: {
    type: String
  },
  photoTimestamp: {
    type: Date
  },
  // Motif pour une absence (optionnel)
  reason: {
    type: String
  }
  ,
  // Preuve jointe pour l'absence (data URL ou URL stockée)
  proof: {
    type: String
  }
}, {
  timestamps: true
});

// Calculer les heures totales avant sauvegarde
attendanceSchema.pre('save', function(next) {
  if (this.heureArrivee && this.heureDepart) {
    const arrivee = new Date(this.heureArrivee);
    const depart = new Date(this.heureDepart);
    
    // Plage horaire: 8h-17h avec pause 13h-14h
    const heureDebutJournee = new Date(arrivee);
    heureDebutJournee.setHours(8, 0, 0, 0);
    
    const heureFinJournee = new Date(depart);
    heureFinJournee.setHours(17, 0, 0, 0);
    
    const pauseDebut = new Date(arrivee);
    pauseDebut.setHours(13, 0, 0, 0);
    
    const pauseFin = new Date(depart);
    pauseFin.setHours(14, 0, 0, 0);
    
    // Calculer les heures travaillées
    let heuresTravaillees = (depart - arrivee) / (1000 * 60 * 60);
    
    // Soustraire la pause si elle est dans la plage
    if (arrivee < pauseFin && depart > pauseDebut) {
      const pauseDeduite = Math.min(depart, pauseFin) - Math.max(arrivee, pauseDebut);
      heuresTravaillees -= pauseDeduite / (1000 * 60 * 60);
    }
    
    // Limiter aux heures de travail normales (8h-17h)
    const debutEffectif = arrivee < heureDebutJournee ? heureDebutJournee : arrivee;
    const finEffectif = depart > heureFinJournee ? heureFinJournee : depart;
    
    heuresTravaillees = Math.max(0, (finEffectif - debutEffectif) / (1000 * 60 * 60));
    
    // Soustraire la pause si nécessaire
    if (debutEffectif < pauseFin && finEffectif > pauseDebut) {
      const pauseDeduite = Math.min(finEffectif, pauseFin) - Math.max(debutEffectif, pauseDebut);
      heuresTravaillees -= pauseDeduite / (1000 * 60 * 60);
    }
    
    this.heuresTotales = Math.round(heuresTravaillees * 100) / 100;
  }
  next();
});

module.exports = mongoose.model('Attendance', attendanceSchema);

