const XLSX = require("xlsx");

const data = [
  {
    studentName: "Amina Benali",
    studentId: "2023-INF-042",
    diplomaTitle: "Licence Informatique",
    issueDate: "2026-06-15",
    recipientAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    grade: "Mention Bien"
  },
  {
    studentName: "Youssef Alami",
    studentId: "2023-INF-043",
    diplomaTitle: "Master Cyber-Securite",
    issueDate: "2026-06-15",
    recipientAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    grade: "Mention Tres Bien"
  },
  {
    studentName: "Sara Bennani",
    studentId: "2023-INF-044",
    diplomaTitle: "Licence Intelligence Artificielle",
    issueDate: "2026-06-15",
    recipientAddress: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    grade: "Mention Assez Bien"
  },
  {
    studentName: "Karim Tazi",
    studentId: "2023-INF-045",
    diplomaTitle: "Master Big Data",
    issueDate: "2026-06-15",
    recipientAddress: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    grade: "Mention Bien"
  }
];

const ws = XLSX.utils.json_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Etudiants");
XLSX.writeFile(wb, "etudiants.xlsx");

console.log("[SUCCES] Fichier 'etudiants.xlsx' genere avec succes !");