const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const Employee = require('../models/Employee.model');
const Attendance = require('../models/Attendance.model');
const Service = require('../models/Service.model');
const dayjs = require('dayjs');

exports.exportEmployeesPDF = async (req, res) => {
  try {
    const employees = await Employee.find().populate('service').sort({ nom: 1 });
    
    const doc = new PDFDocument({ 
      size: 'A4',
      margins: { top: 40, bottom: 40, left: 35, right: 35 }
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=employees-directory.pdf');
    
    // Gestionnaire d'erreur pour le document PDF
    doc.on('error', (err) => {
      console.error('❌ Erreur PDF exportEmployeesPDF:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Erreur lors de la génération du PDF', error: err.message });
      }
    });
    
    // Gestionnaire d'erreur pour la réponse
    res.on('error', (err) => {
      console.error('❌ Erreur réponse exportEmployeesPDF:', err.message);
      try {
        doc.destroy();
      } catch (e) {
        console.error('Erreur lors de la destruction du doc:', e.message);
      }
    });
    
    doc.pipe(res);
    
    // Couleurs modernes et professionnelles
    const primaryColor = '#0066cc'; // Bleu moderne
    const secondaryColor = '#00a3ff'; // Bleu ciel
    const accentColor = '#ff6b6b'; // Rouge moderne
    const lightBg = '#f8fafc';
    const lightGray = '#f3f4f6';
    const darkText = '#1e293b';
    const lightText = '#64748b';
    const darkGray = '#475569';
    const borderColor = '#cbd5e1';
    
    let pageNumber = 1;
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 40;
    
    // Fonction pour dessiner l'en-tête
    const drawHeader = () => {
      // Bande de couleur en haut
      doc.rect(0, 0, pageWidth, 120)
        .fill(primaryColor);
      
      // Cercle décoratif pour logo
      doc.circle(60, 60, 25)
        .fill('#ffffff')
        .stroke(secondaryColor, 2);
      
      // Icône dans le cercle (simulation d'un logo)
      doc.fontSize(20)
        .fillColor(primaryColor)
        .text('RH', 50, 50, { align: 'center', width: 20 });
      
      // Nom de l'entreprise
      doc.fontSize(24)
        .font('Helvetica-Bold')
        .fillColor('#ffffff')
        .text('GESTION RH DOUK', 100, 35);
      
      // Sous-titre
      doc.fontSize(11)
        .font('Helvetica')
        .fillColor('#e0e7ff')
        .text('Système de Gestion des Ressources Humaines', 100, 60);
      
      // Date et numéro de document
      const currentDate = dayjs().format('DD/MM/YYYY à HH:mm');
      doc.fontSize(9)
        .fillColor('#c7d2fe')
        .text(`Généré le ${currentDate}`, pageWidth - margin - 150, 35, { width: 150, align: 'right' });
      
      doc.text(`Document confidentiel`, pageWidth - margin - 150, 50, { width: 150, align: 'right' });
    };
    
    // Fonction pour dessiner le pied de page
    const drawFooter = () => {
      const footerY = pageHeight - 40;
      
      // Ligne de séparation
      doc.moveTo(margin, footerY - 10)
        .lineTo(pageWidth - margin, footerY - 10)
        .stroke(borderColor, 1);
      
      // Numéro de page
      doc.fontSize(9)
        .fillColor(darkGray)
        .text(`Page ${pageNumber}`, margin, footerY, { align: 'left' });
    };
    
    // Fonction pour ajouter une nouvelle page
    const addNewPage = () => {
      doc.addPage();
      pageNumber++;
      drawHeader();
    };
    
    // Dessiner l'en-tête de la première page
    drawHeader();
    
    // Titre du document
    let y = 150;
    doc.fontSize(18)
      .font('Helvetica-Bold')
      .fillColor(primaryColor)
      .text('RÉPERTOIRE DES EMPLOYÉS', margin, y, { align: 'center' });
    
    y += 25;
    
    // Informations du document
    doc.fontSize(10)
      .font('Helvetica')
      .fillColor(darkGray)
      .text(`Total des employés: ${employees.length}`, margin, y);
    
    y += 20;
    
    // Statistiques rapides
    const statsY = y;
    const statsWidth = (pageWidth - 2 * margin) / 4;
    
    // Compter par genre
    const hommes = employees.filter(e => e.genre === 'Homme').length;
    const femmes = employees.filter(e => e.genre === 'Femme').length;
    const services = [...new Set(employees.map(e => e.service?.nom).filter(Boolean))].length;
    
    // Box statistiques
    const stats = [
      { label: 'Total', value: employees.length, color: primaryColor },
      { label: 'Hommes', value: hommes, color: secondaryColor },
      { label: 'Femmes', value: femmes, color: '#ec4899' },
      { label: 'Services', value: services, color: accentColor }
    ];
    
    stats.forEach((stat, index) => {
      const boxX = margin + (index * statsWidth);
      const boxY = statsY;
      
      // Fond de la box
      doc.rect(boxX, boxY, statsWidth - 10, 50)
        .fill(lightGray)
        .stroke(borderColor, 1);
      
      // Valeur
      doc.fontSize(20)
        .font('Helvetica-Bold')
        .fillColor(stat.color)
        .text(stat.value.toString(), boxX + 5, boxY + 8, { width: statsWidth - 20, align: 'center' });
      
      // Label
      doc.fontSize(9)
        .font('Helvetica')
        .fillColor(darkGray)
        .text(stat.label, boxX + 5, boxY + 30, { width: statsWidth - 20, align: 'center' });
    });
    
    y = statsY + 70;
    
    // RÉPERTOIRE SIMPLE - LISTE NUMÉROTÉE
    doc.fontSize(14)
      .font('Helvetica-Bold')
      .fillColor(primaryColor)
      .text('RÉPERTOIRE COMPLET', margin, y);
    
    y += 20;
    doc.moveTo(margin, y)
      .lineTo(pageWidth - margin, y)
      .strokeColor(borderColor)
      .lineWidth(1)
      .stroke();
    
    y += 15;
    
    let empCount = 0;
    let listY = y;
    
    employees.forEach((emp, index) => {
      // Nouvelle page tous les 25 employés
      if (empCount > 0 && empCount % 25 === 0) {
        drawFooter();
        addNewPage();
        listY = 120;
      }
      
      // Format: N° | NOM | POSTE
      const empNum = `${empCount + 1}.`;
      const empName = String(emp.nom || 'N/A').substring(0, 25);
      const empPost = String(emp.poste || 'N/A').substring(0, 20);
      const empLine = `${empName} - ${empPost}`;
      
      doc.fontSize(10)
        .font('Helvetica-Bold')
        .fillColor(darkText)
        .text(empNum, margin, listY, { width: 25 });
      
      doc.fontSize(10)
        .font('Helvetica')
        .fillColor(darkGray)
        .text(empLine, margin + 30, listY, { width: pageWidth - margin - 30 - margin, ellipsis: true });
      
      listY += 18;
      empCount++;
    });
    
    // Pied du répertoire
    doc.fontSize(8)
      .font('Helvetica')
      .fillColor(lightText)
      .text(`Total: ${employees.length} employés`, margin, listY + 10);
    
    // Vue détaillée - UNE PAGE PAR EMPLOYÉ AVEC DESIGN MODERNE
    employees.forEach((emp, index) => {
      // Ajouter une nouvelle page pour chaque employé (sauf le premier qui est déjà créé)
      if (index > 0) {
        drawFooter();
        addNewPage();
      }
      
      y = 150;
      const age = emp.dateNaissance ? dayjs().diff(dayjs(emp.dateNaissance), 'year') : null;
      
      // En-tête moderne
      doc.fontSize(16)
        .font('Helvetica-Bold')
        .fillColor(primaryColor)
        .text('FICHE EMPLOYÉ', margin, y);
      
      // Ligne décoration
      doc.moveTo(margin, y + 20)
        .lineTo(pageWidth - margin, y + 20)
        .strokeColor(secondaryColor)
        .lineWidth(2)
        .stroke();
      
      y += 35;
      
      // Carte de présentation principale
      doc.rect(margin, y, pageWidth - 2 * margin, 70)
        .fill(lightBg)
        .strokeColor(primaryColor)
        .lineWidth(1)
        .stroke();
      
      // Nom en grand
      doc.fontSize(22)
        .font('Helvetica-Bold')
        .fillColor(primaryColor)
        .text(`${emp.nom || '-'}`, margin + 15, y + 10);
      
      // Matricule et numéro en gris
      doc.fontSize(9)
        .font('Helvetica')
        .fillColor(lightText)
        .text(`Mat: ${emp.matricule || '-'} | N°: ${emp.numero || '-'} | ${emp.poste || '-'}`, margin + 15, y + 35);
      
      // Service et statut
      doc.fontSize(9)
        .fillColor(lightText)
        .text(`${emp.service?.nom || '-'} | ${emp.statutJuridique || '-'}`, margin + 15, y + 48);
      
      y += 85;
      
      // Section 1: INFORMATIONS PERSONNELLES
      doc.fontSize(11)
        .font('Helvetica-Bold')
        .fillColor(primaryColor)
        .text('INFORMATIONS PERSONNELLES', margin, y);
      
      y += 12;
      
      const col1X = margin + 10;
      const col2X = pageWidth / 2 + 10;
      const fieldHeight = 11;
      const colWidth = (pageWidth - 2 * margin) / 2 - 20;
      
      // Fonction simple pour afficher un champ
      const drawField = (label, value, x, yPos) => {
        doc.fontSize(8)
          .font('Helvetica-Bold')
          .fillColor(darkText)
          .text(label, x, yPos, { width: 55 });
        
        const strValue = String(value || '-').substring(0, 30);
        doc.fontSize(8)
          .font('Helvetica')
          .fillColor(darkGray)
          .text(strValue, x + 60, yPos, { width: colWidth - 60, ellipsis: true });
      };
      
      // Colonne 1
      let yPos = y;
      drawField('Genre:', emp.genre, col1X, yPos);
      yPos += fieldHeight;
      drawField('Naissance:', emp.dateNaissance ? dayjs(emp.dateNaissance).format('DD/MM/YYYY') : '-', col1X, yPos);
      yPos += fieldHeight;
      drawField('Âge:', age ? `${age} ans` : '-', col1X, yPos);
      yPos += fieldHeight;
      drawField('Nationalité:', emp.nationalite || '-', col1X, yPos);
      yPos += fieldHeight;
      drawField('Résidence:', emp.lieuResidence || '-', col1X, yPos);
      
      // Colonne 2
      yPos = y;
      drawField('Embauche:', emp.dateEmbauche ? dayjs(emp.dateEmbauche).format('DD/MM/YYYY') : '-', col2X, yPos);
      yPos += fieldHeight;
      drawField('Ancienneté:', emp.anciennete ? `${emp.anciennete} ans` : '-', col2X, yPos);
      yPos += fieldHeight;
      drawField('Situation:', emp.situationMatrimoniale || '-', col2X, yPos);
      yPos += fieldHeight;
      drawField('Enfants:', emp.nombreEnfants !== undefined ? emp.nombreEnfants : '-', col2X, yPos);
      yPos += fieldHeight;
      drawField('Étude:', emp.niveauEtude || '-', col2X, yPos);
      
      y += 75;
      
      // Ligne de séparation
      doc.moveTo(margin, y)
        .lineTo(pageWidth - margin, y)
        .strokeColor(borderColor)
        .lineWidth(0.5)
        .stroke();
      
      y += 12;
      
      // Section 2: INFORMATIONS SUPPLÉMENTAIRES
      doc.fontSize(11)
        .font('Helvetica-Bold')
        .fillColor(primaryColor)
        .text('INFORMATIONS SUPPLÉMENTAIRES', margin, y);
      
      y += 12;
      drawField('Filiation:', emp.filiation || '-', col1X, y);
      y += fieldHeight;
      drawField('CADRE/S/M:', emp.cadre || '-', col1X, y);
      
      y += 30;
      
      // Pied de page professionnel
      doc.fontSize(7)
        .font('Helvetica')
        .fillColor(lightText)
        .text('Document confidentiel - RH', margin, pageHeight - 50, { align: 'center' });
    });
    
    // Dessiner le pied de page de la dernière page
    drawFooter();
    
    doc.end();
  } catch (error) {
    console.error('❌ Erreur exportEmployeesPDF:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ message: error.message });
    }
  }
};

exports.exportEmployeesExcel = async (req, res) => {
  try {
    const employees = await Employee.find().populate('service').sort({ nom: 1 });
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Employés');
    
    // En-têtes
    worksheet.columns = [
      { header: 'Numéro', key: 'numero', width: 15 },
      { header: 'Matricule', key: 'matricule', width: 15 },
      { header: 'Nom', key: 'nom', width: 25 },
      { header: 'Poste', key: 'poste', width: 20 },
      { header: 'Genre', key: 'genre', width: 10 },
      { header: 'Date Naissance', key: 'dateNaissance', width: 15 },
      { header: 'Lieu Résidence', key: 'lieuResidence', width: 25 },
      { header: 'Nationalité', key: 'nationalite', width: 15 },
      { header: 'Ancienneté', key: 'anciennete', width: 12 },
      { header: 'Situation Matrimoniale', key: 'situationMatrimoniale', width: 20 },
      { header: 'Nombre Enfants', key: 'nombreEnfants', width: 15 },
      { header: 'Statut Juridique', key: 'statutJuridique', width: 15 },
      { header: 'Service', key: 'service', width: 20 }
    ];
    
    // Style des en-têtes
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    // Données
    employees.forEach(emp => {
      worksheet.addRow({
        numero: emp.numero,
        matricule: emp.matricule,
        nom: emp.nom,
        poste: emp.poste,
        genre: emp.genre,
        dateNaissance: dayjs(emp.dateNaissance).format('DD/MM/YYYY'),
        lieuResidence: emp.lieuResidence,
        nationalite: emp.nationalite,
        anciennete: emp.anciennete,
        situationMatrimoniale: emp.situationMatrimoniale,
        nombreEnfants: emp.nombreEnfants,
        statutJuridique: emp.statutJuridique,
        service: emp.service?.nom || ''
      });
    });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=employees.xlsx');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.exportAttendancePDF = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = {};
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    
    const attendance = await Attendance.find(query)
      .populate('employee', 'nom matricule poste')
      .sort({ date: -1 });
    
    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=attendance.pdf');
    
    doc.pipe(res);
    
    doc.fontSize(20).text('Fiches de Présence', { align: 'center' });
    doc.moveDown();
    
    let y = 100;
    const startX = 50;
    const rowHeight = 30;
    
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Date', startX, y);
    doc.text('Matricule', startX + 80, y);
    doc.text('Nom', startX + 150, y);
    doc.text('Arrivée', startX + 250, y);
    doc.text('Départ', startX + 320, y);
    doc.text('Heures', startX + 390, y);
    
    y += rowHeight;
    doc.moveTo(startX, y).lineTo(550, y).stroke();
    
    doc.font('Helvetica');
    attendance.forEach(att => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      
      doc.text(dayjs(att.date).format('DD/MM/YYYY'), startX, y);
      doc.text(att.matricule || '', startX + 80, y);
      doc.text(att.nom || '', startX + 150, y);
      doc.text(att.heureArrivee ? dayjs(att.heureArrivee).format('HH:mm') : '-', startX + 250, y);
      doc.text(att.heureDepart ? dayjs(att.heureDepart).format('HH:mm') : '-', startX + 320, y);
      doc.text(att.heuresTotales ? att.heuresTotales + 'h' : '-', startX + 390, y);
      
      y += rowHeight;
      doc.moveTo(startX, y).lineTo(550, y).stroke();
    });
    
    doc.end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.exportServiceEmployeesPDF = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const requester = req.user;
    
    if (!serviceId) {
      return res.status(400).json({ message: 'Service ID requis' });
    }
    
    // Récupérer le service pour avoir son nom
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ message: 'Service non trouvé' });
    }
    
    // Vérification des permissions : service_admin ne peut télécharger que son service
    if (requester && requester.role === 'service_admin') {
      const userServiceId = requester.service?._id || requester.service;
      if (String(userServiceId) !== String(serviceId)) {
        return res.status(403).json({ message: 'Accès refusé : vous ne pouvez télécharger que les employés de votre service' });
      }
    }
    
    const employees = await Employee.find({ service: serviceId })
      .populate('service')
      .sort({ nom: 1 });
    
    const doc = new PDFDocument({ 
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 40, right: 40 }
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=employes-${service.nom.replace(/\s+/g, '-')}.pdf`);
    
    doc.pipe(res);
    
    // Couleurs professionnelles
    const primaryColor = '#1e3a8a';
    const secondaryColor = '#3b82f6';
    const accentColor = '#f59e0b';
    const lightGray = '#f3f4f6';
    const darkGray = '#374151';
    const borderColor = '#e5e7eb';
    
    let pageNumber = 1;
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 40;
    
    // Fonction pour dessiner l'en-tête
    const drawHeader = () => {
      doc.rect(0, 0, pageWidth, 120)
        .fill(primaryColor);
      
      doc.circle(60, 60, 25)
        .fill('#ffffff')
        .stroke(secondaryColor, 2);
      
      doc.fontSize(20)
        .fillColor(primaryColor)
        .text('RH', 50, 50, { align: 'center', width: 20 });
      
      doc.fontSize(24)
        .font('Helvetica-Bold')
        .fillColor('#ffffff')
        .text('GESTION RH DOUK', 100, 35);
      
      doc.fontSize(11)
        .font('Helvetica')
        .fillColor('#e0e7ff')
        .text('Système de Gestion des Ressources Humaines', 100, 60);
      
      const currentDate = dayjs().format('DD/MM/YYYY à HH:mm');
      doc.fontSize(9)
        .fillColor('#c7d2fe')
        .text(`Généré le ${currentDate}`, pageWidth - margin - 150, 35, { width: 150, align: 'right' });
      
      doc.text(`Document confidentiel`, pageWidth - margin - 150, 50, { width: 150, align: 'right' });
    };
    
    // Fonction pour dessiner le pied de page
    const drawFooter = () => {
      const footerY = pageHeight - 40;
      
      doc.moveTo(margin, footerY - 10)
        .lineTo(pageWidth - margin, footerY - 10)
        .stroke(borderColor, 1);
      
      doc.fontSize(9)
        .fillColor(darkGray)
        .text(`Page ${pageNumber}`, margin, footerY, { align: 'left' });
      
      doc.text('© Gestion RH Douk - Tous droits réservés', 
        pageWidth - margin - 200, footerY, { width: 200, align: 'right' });
    };
    
    // Fonction pour ajouter une nouvelle page
    const addNewPage = () => {
      doc.addPage();
      pageNumber++;
      drawHeader();
    };
    
    drawHeader();
    
    // Titre du document avec nom du service
    let y = 150;
    doc.fontSize(18)
      .font('Helvetica-Bold')
      .fillColor(primaryColor)
      .text(`EMPLOYÉS DU SERVICE: ${service.nom.toUpperCase()}`, margin, y, { align: 'center' });
    
    y += 25;
    
    doc.fontSize(10)
      .font('Helvetica')
      .fillColor(darkGray)
      .text(`Total des employés: ${employees.length}`, margin, y);
    
    y += 20;
    
    // Statistiques rapides
    const statsY = y;
    const statsWidth = (pageWidth - 2 * margin) / 4;
    
    const hommes = employees.filter(e => e.genre === 'Homme').length;
    const femmes = employees.filter(e => e.genre === 'Femme').length;
    
    const stats = [
      { label: 'Total', value: employees.length, color: primaryColor },
      { label: 'Hommes', value: hommes, color: secondaryColor },
      { label: 'Femmes', value: femmes, color: '#ec4899' },
      { label: 'Service', value: service.nom.substring(0, 15), color: accentColor }
    ];
    
    stats.forEach((stat, index) => {
      const boxX = margin + (index * statsWidth);
      const boxY = statsY;
      
      doc.rect(boxX, boxY, statsWidth - 10, 50)
        .fill(lightGray)
        .stroke(borderColor, 1);
      
      doc.fontSize(20)
        .font('Helvetica-Bold')
        .fillColor(stat.color)
        .text(stat.value.toString(), boxX + 5, boxY + 8, { width: statsWidth - 20, align: 'center' });
      
      doc.fontSize(9)
        .font('Helvetica')
        .fillColor(darkGray)
        .text(stat.label, boxX + 5, boxY + 30, { width: statsWidth - 20, align: 'center' });
    });
    
    y = statsY + 70;
    
    // Vue détaillée par employé avec TOUTES les informations
    employees.forEach((emp, index) => {
      // Vérifier si on a besoin d'une nouvelle page (chaque employé prend environ 180px)
      if (y + 180 > pageHeight - 80) {
        drawFooter();
        addNewPage();
        y = 150;
      }
      
      // Carte de l'employé avec fond alterné
      const cardHeight = 170;
      if (index % 2 === 0) {
        doc.rect(margin, y, pageWidth - 2 * margin, cardHeight)
          .fill(lightGray)
          .stroke(borderColor, 1);
      } else {
        doc.rect(margin, y, pageWidth - 2 * margin, cardHeight)
          .fill('#ffffff')
          .stroke(borderColor, 1);
      }
      
      let currentY = y + 10;
      
      // En-tête de la carte avec nom et matricule
      doc.fontSize(14)
        .font('Helvetica-Bold')
        .fillColor(primaryColor)
        .text(`${emp.nom || '-'}`, margin + 10, currentY);
      
      doc.fontSize(10)
        .font('Helvetica')
        .fillColor(darkGray)
        .text(`Matricule: ${emp.matricule || '-'} | Numéro: ${emp.numero || '-'}`, margin + 10, currentY + 18);
      
      currentY += 35;
      
      // Ligne de séparation
      doc.moveTo(margin + 10, currentY)
        .lineTo(pageWidth - margin - 10, currentY)
        .stroke(borderColor, 0.5);
      
      currentY += 10;
      
      // Informations en deux colonnes
      const leftColumnX = margin + 10;
      const rightColumnX = (pageWidth - 2 * margin) / 2 + margin;
      const lineHeight = 14;
      let leftY = currentY;
      let rightY = currentY;
      
      // Colonne gauche
      doc.fontSize(8).font('Helvetica-Bold').fillColor(darkGray);
      doc.text('Poste:', leftColumnX, leftY);
      doc.font('Helvetica').fillColor(darkGray);
      doc.text(emp.poste || '-', leftColumnX + 40, leftY);
      leftY += lineHeight;
      
      doc.font('Helvetica-Bold').fillColor(darkGray);
      doc.text('Service:', leftColumnX, leftY);
      doc.font('Helvetica').fillColor(darkGray);
      doc.text(emp.service?.nom || '-', leftColumnX + 40, leftY);
      leftY += lineHeight;
      
      doc.font('Helvetica-Bold').fillColor(darkGray);
      doc.text('Genre:', leftColumnX, leftY);
      doc.font('Helvetica').fillColor(darkGray);
      doc.text(emp.genre || '-', leftColumnX + 40, leftY);
      leftY += lineHeight;
      
      doc.font('Helvetica-Bold').fillColor(darkGray);
      doc.text('Date Naissance:', leftColumnX, leftY);
      doc.font('Helvetica').fillColor(darkGray);
      doc.text(emp.dateNaissance ? dayjs(emp.dateNaissance).format('DD/MM/YYYY') : '-', leftColumnX + 70, leftY);
      leftY += lineHeight;
      
      const age = emp.dateNaissance ? dayjs().diff(dayjs(emp.dateNaissance), 'year') : null;
      doc.font('Helvetica-Bold').fillColor(darkGray);
      doc.text('Âge:', leftColumnX, leftY);
      doc.font('Helvetica').fillColor(darkGray);
      doc.text(age ? `${age} ans` : '-', leftColumnX + 40, leftY);
      leftY += lineHeight;
      
      doc.font('Helvetica-Bold').fillColor(darkGray);
      doc.text('Lieu Résidence:', leftColumnX, leftY);
      doc.font('Helvetica').fillColor(darkGray);
      doc.text(emp.lieuResidence || '-', leftColumnX + 70, leftY, { width: 200, ellipsis: true });
      leftY += lineHeight;
      
      doc.font('Helvetica-Bold').fillColor(darkGray);
      doc.text('Nationalité:', leftColumnX, leftY);
      doc.font('Helvetica').fillColor(darkGray);
      doc.text(emp.nationalite || '-', leftColumnX + 60, leftY);
      leftY += lineHeight;
      
      // Colonne droite
      doc.font('Helvetica-Bold').fillColor(darkGray);
      doc.text('Date Embauche:', rightColumnX, rightY);
      doc.font('Helvetica').fillColor(darkGray);
      doc.text(emp.dateEmbauche ? dayjs(emp.dateEmbauche).format('DD/MM/YYYY') : '-', rightColumnX + 70, rightY);
      rightY += lineHeight;
      
      doc.font('Helvetica-Bold').fillColor(darkGray);
      doc.text('Ancienneté:', rightColumnX, rightY);
      doc.font('Helvetica').fillColor(darkGray);
      doc.text(emp.anciennete ? `${emp.anciennete} an(s)` : '-', rightColumnX + 60, rightY);
      rightY += lineHeight;
      
      doc.font('Helvetica-Bold').fillColor(darkGray);
      doc.text('Situation Matrimoniale:', rightColumnX, rightY);
      doc.font('Helvetica').fillColor(darkGray);
      doc.text(emp.situationMatrimoniale || '-', rightColumnX + 100, rightY);
      rightY += lineHeight;
      
      doc.font('Helvetica-Bold').fillColor(darkGray);
      doc.text('Nombre Enfants:', rightColumnX, rightY);
      doc.font('Helvetica').fillColor(darkGray);
      doc.text(emp.nombreEnfants !== undefined ? emp.nombreEnfants.toString() : '-', rightColumnX + 80, rightY);
      rightY += lineHeight;
      
      doc.font('Helvetica-Bold').fillColor(darkGray);
      doc.text('Statut Juridique:', rightColumnX, rightY);
      doc.font('Helvetica').fillColor(darkGray);
      doc.text(emp.statutJuridique || '-', rightColumnX + 80, rightY);
      rightY += lineHeight;
      
      doc.font('Helvetica-Bold').fillColor(darkGray);
      doc.text('Niveau d\'étude:', rightColumnX, rightY);
      doc.font('Helvetica').fillColor(darkGray);
      doc.text(emp.niveauEtude || '-', rightColumnX + 70, rightY);
      rightY += lineHeight;
      
      doc.font('Helvetica-Bold').fillColor(darkGray);
      doc.text('CADRE/S/M:', rightColumnX, rightY);
      doc.font('Helvetica').fillColor(darkGray);
      doc.text(emp.cadre || '-', rightColumnX + 70, rightY);
      rightY += lineHeight;
      
      doc.font('Helvetica-Bold').fillColor(darkGray);
      doc.text('Filiation:', rightColumnX, rightY);
      doc.font('Helvetica').fillColor(darkGray);
      doc.text(emp.filiation || '-', rightColumnX + 50, rightY, { width: 150, ellipsis: true });
      
      y += cardHeight + 10;
    });
    
    // Section résumé
    y += 20;
    
    if (y > pageHeight - 120) {
      drawFooter();
      addNewPage();
      y = 150;
    }
    
    doc.moveTo(margin, y)
      .lineTo(pageWidth - margin, y)
      .stroke(borderColor, 1);
    
    y += 15;
    
    doc.fontSize(10)
      .font('Helvetica-Bold')
      .fillColor(primaryColor)
      .text('RÉSUMÉ', margin, y);
    
    y += 20;
    
    const summaryItems = [
      `Service: ${service.nom}`,
      `Nombre total d'employés: ${employees.length}`,
      `Hommes: ${hommes} (${employees.length > 0 ? ((hommes / employees.length) * 100).toFixed(1) : 0}%)`,
      `Femmes: ${femmes} (${employees.length > 0 ? ((femmes / employees.length) * 100).toFixed(1) : 0}%)`
    ];
    
    summaryItems.forEach((item) => {
      doc.fontSize(9)
        .font('Helvetica')
        .fillColor(darkGray)
        .text(`• ${item}`, margin + 10, y);
      y += 15;
    });
    
    drawFooter();
    
    doc.end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.exportEmployeePDF = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const requester = req.user;
    
    console.log('📥 Requête de PDF pour employeeId:', employeeId);
    
    if (!employeeId) {
      return res.status(400).json({ message: 'Employee ID requis' });
    }
    
    const employee = await Employee.findById(employeeId).populate('service');
    if (!employee) {
      return res.status(404).json({ message: 'Employé non trouvé' });
    }
    
    console.log('✅ Employé trouvé:', employee.nom);
    
    // Vérification des permissions
    if (requester && requester.role === 'service_admin') {
      const userServiceId = requester.service?._id || requester.service;
      if (String(userServiceId) !== String(employee.service?._id || employee.service)) {
        return res.status(403).json({ message: 'Accès refusé' });
      }
    }
    
    const doc = new PDFDocument({ 
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 40, right: 40 }
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=fiche-${employee.matricule || employee.nom.replace(/\s+/g, '-')}.pdf`);
    
    // Gestionnaire d'erreur pour le document PDF
    doc.on('error', (err) => {
      console.error('❌ Erreur PDF:', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Erreur lors de la génération du PDF', error: err.message });
      }
    });
    
    // Gestionnaire d'erreur pour la réponse
    res.on('error', (err) => {
      console.error('❌ Erreur réponse:', err);
      doc.destroy();
    });
    
    doc.pipe(res);
    
    // Couleurs professionnelles
    const primaryColor = '#1e3a8a';
    const secondaryColor = '#3b82f6';
    const accentColor = '#f59e0b';
    const lightGray = '#f3f4f6';
    const darkGray = '#374151';
    const borderColor = '#e5e7eb';
    
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 40;
    
    // En-tête professionnel
    doc.rect(0, 0, pageWidth, 140)
      .fill(primaryColor);
    
    doc.circle(70, 70, 30)
      .fill('#ffffff')
      .stroke(secondaryColor, 2);
    
    doc.fontSize(24)
      .fillColor(primaryColor)
      .text('RH', 60, 60, { align: 'center', width: 20 });
    
    doc.fontSize(28)
      .font('Helvetica-Bold')
      .fillColor('#ffffff')
      .text('GESTION RH DOUK', 120, 40);
    
    doc.fontSize(12)
      .font('Helvetica')
      .fillColor('#e0e7ff')
      .text('Fiche Individuelle de l\'Employé', 120, 70);
    
    const currentDate = dayjs().format('DD/MM/YYYY à HH:mm');
    doc.fontSize(9)
      .fillColor('#c7d2fe')
      .text(`Généré le ${currentDate}`, pageWidth - margin - 150, 50, { width: 150, align: 'right' });
    
    doc.text(`Document confidentiel`, pageWidth - margin - 150, 65, { width: 150, align: 'right' });
    
    let y = 170;
    doc.fontSize(22)
      .font('Helvetica-Bold')
      .fillColor(primaryColor)
      .text((employee.nom || '-').toUpperCase(), margin, y);
    
    y += 30;
    
    // Badge avec matricule et numéro
    doc.rect(margin, y, 200, 30)
      .fill(lightGray)
      .stroke(borderColor, 1);
    
    doc.fontSize(11)
      .font('Helvetica-Bold')
      .fillColor(darkGray)
      .text(`Matricule: ${employee.matricule || '-'}`, margin + 10, y + 8);
    
    doc.text(`Numéro: ${employee.numero || '-'}`, margin + 10, y + 20);
    
    y += 50;
    
    // Ligne de séparation
    doc.moveTo(margin, y)
      .lineTo(pageWidth - margin, y)
      .stroke(primaryColor, 2);
    
    y += 20;
    
    // Section Informations Personnelles
    doc.fontSize(14)
      .font('Helvetica-Bold')
      .fillColor(primaryColor)
      .text('INFORMATIONS PERSONNELLES', margin, y);
    
    y += 25;
    
    const infoY = y;
    const leftColumnX = margin + 10;
    const rightColumnX = (pageWidth - 2 * margin) / 2 + margin + 10;
    const lineHeight = 16;
    const colWidth = (pageWidth - 2 * margin) / 2 - 20;
    let leftY = infoY;
    let rightY = infoY;
    
    // Fonction pour afficher un champ
    const drawInfoField = (label, value, x, yPos, maxWidth) => {
      doc.fontSize(8).font('Helvetica-Bold').fillColor(darkGray);
      doc.text(label, x, yPos, { width: 65, ellipsis: false });
      doc.font('Helvetica').fillColor(darkGray);
      doc.text(value || '-', x + 70, yPos, { width: maxWidth - 70, ellipsis: true });
    };
    
    // Colonne gauche
    drawInfoField('Genre:', employee.genre, leftColumnX, leftY, colWidth);
    leftY += lineHeight;
    
    drawInfoField('Date Naissance:', employee.dateNaissance ? dayjs(employee.dateNaissance).format('DD/MM/YYYY') : '-', leftColumnX, leftY, colWidth);
    leftY += lineHeight;
    
    const age = employee.dateNaissance ? dayjs().diff(dayjs(employee.dateNaissance), 'year') : null;
    drawInfoField('Âge:', age ? `${age} ans` : '-', leftColumnX, leftY, colWidth);
    leftY += lineHeight;
    
    drawInfoField('Lieu Résidence:', employee.lieuResidence || '-', leftColumnX, leftY, colWidth);
    leftY += lineHeight;
    
    drawInfoField('Nationalité:', employee.nationalite || '-', leftColumnX, leftY, colWidth);
    leftY += lineHeight;
    
    drawInfoField('Filiation:', employee.filiation || '-', leftColumnX, leftY, colWidth);
    leftY += lineHeight;
    
    // Colonne droite - Situation familiale
    drawInfoField('Situation:', employee.situationMatrimoniale || '-', rightColumnX, rightY, colWidth);
    rightY += lineHeight;
    
    drawInfoField('Enfants:', employee.nombreEnfants !== undefined ? employee.nombreEnfants.toString() : '-', rightColumnX, rightY, colWidth);
    
    y = Math.max(leftY, rightY) + 20;
    
    // Ligne de séparation
    doc.moveTo(margin, y)
      .lineTo(pageWidth - margin, y)
      .stroke(borderColor, 1);
    
    y += 20;
    
    // Section Informations Professionnelles
    doc.fontSize(14)
      .font('Helvetica-Bold')
      .fillColor(primaryColor)
      .text('INFORMATIONS PROFESSIONNELLES', margin, y);
    
    y += 25;
    
    leftY = y;
    rightY = y;
    
    // Colonne gauche - Informations professionnelles
    drawInfoField('Poste:', employee.poste || '-', leftColumnX, leftY, colWidth);
    leftY += lineHeight;
    
    drawInfoField('Service:', employee.service?.nom || '-', leftColumnX, leftY, colWidth);
    leftY += lineHeight;
    
    drawInfoField('Date Embauche:', employee.dateEmbauche ? dayjs(employee.dateEmbauche).format('DD/MM/YYYY') : '-', leftColumnX, leftY, colWidth);
    leftY += lineHeight;
    
    drawInfoField('Ancienneté:', employee.anciennete ? `${employee.anciennete} an(s)` : '-', leftColumnX, leftY, colWidth);
    leftY += lineHeight;
    
    // Colonne droite - Statut et qualifications
    drawInfoField('Statut Juridique:', employee.statutJuridique || '-', rightColumnX, rightY, colWidth);
    rightY += lineHeight;
    
    drawInfoField('Niveau d\'Étude:', employee.niveauEtude || '-', rightColumnX, rightY, colWidth);
    rightY += lineHeight;
    
    drawInfoField('CADRE/S/M:', employee.cadre || '-', rightColumnX, rightY, colWidth);
    
    y = Math.max(leftY, rightY) + 30;
    
    // Pied de page
    const footerY = pageHeight - 40;
    doc.moveTo(margin, footerY - 10)
      .lineTo(pageWidth - margin, footerY - 10)
      .stroke(borderColor, 1);
    
    doc.fontSize(9)
      .fillColor(darkGray)
      .text(`Fiche générée le ${currentDate}`, margin, footerY, { align: 'center' });
    
    doc.end();
    console.log('✅ PDF généré avec succès pour:', employee.nom);
  } catch (error) {
    console.error('❌ Erreur lors de la génération du PDF:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ message: error.message, details: error.stack });
  }
};

exports.exportAttendanceExcel = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = {};
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    
    const attendance = await Attendance.find(query)
      .populate('employee', 'nom matricule poste')
      .sort({ date: -1 });
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Présences');
    
    worksheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Matricule', key: 'matricule', width: 15 },
      { header: 'Nom', key: 'nom', width: 25 },
      { header: 'Heure Arrivée', key: 'heureArrivee', width: 15 },
      { header: 'Heure Départ', key: 'heureDepart', width: 15 },
      { header: 'Heures Totales', key: 'heuresTotales', width: 15 },
      { header: 'Statut', key: 'statut', width: 15 }
    ];
    
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    attendance.forEach(att => {
      worksheet.addRow({
        date: dayjs(att.date).format('DD/MM/YYYY'),
        matricule: att.matricule,
        nom: att.nom,
        heureArrivee: att.heureArrivee ? dayjs(att.heureArrivee).format('HH:mm') : '-',
        heureDepart: att.heureDepart ? dayjs(att.heureDepart).format('HH:mm') : '-',
        heuresTotales: att.heuresTotales || 0,
        statut: att.statut || 'present'
      });
    });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=attendance.xlsx');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

