const hre = require("hardhat");
const XLSX = require("xlsx");

async function main() {
  console.log("===============================================================");
  console.log("   TEST D'INTEGRATION 100% LOCAL HARDHAT (SANS METAMASK)       ");
  console.log("===============================================================\n");

  // 1. Récupération des comptes locaux Hardhat
  const [admin, student1] = await hre.ethers.getSigners();
  console.log("[1] Compte Administrateur Hardhat #0 :", admin.address);

  // 2. Déploiement frais du contrat sur le nœud local
  const CertificateRegistry = await hre.ethers.getContractFactory("CertificateRegistry");
  const registry = await CertificateRegistry.deploy();
  await registry.waitForDeployment();
  const contractAddress = await registry.getAddress();
  console.log("[2] Contrat deploye localement a l'adresse :", contractAddress);

  // 3. Test d'un mint unitaire
  console.log("\n[3] Test de Mint Unitaire...");
  const tx1 = await registry.mintCertificate(
    student1.address,
    "Amina Benali",
    "2023-INF-042",
    "Licence Informatique",
    "2026-06-15",
    "Mention Bien"
  );
  await tx1.wait();
  console.log("  -> Certificat #1 emis avec succes ! TxHash :", tx1.hash);

  // 4. Lecture du fichier Excel et Test du Batch Mint
  console.log("\n[4] Lecture du fichier 'etudiants.xlsx' avec SheetJS...");
  const workbook = XLSX.readFile("etudiants.xlsx");
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);
  console.log(`  -> ${rows.length} etudiants detectes dans le fichier Excel.`);

  const recipients = [];
  const names = [];
  const ids = [];
  const diplomas = [];
  const dates = [];
  const grades = [];

  rows.forEach((r) => {
    recipients.push(r.recipientAddress && hre.ethers.isAddress(r.recipientAddress) ? r.recipientAddress : admin.address);
    names.push(r.studentName);
    ids.push(r.studentId);
    diplomas.push(r.diplomaTitle);
    dates.push(r.issueDate);
    grades.push(r.grade);
  });

  console.log("\n[5] Envoi de la transaction batchMint pour le lot Excel...");
  const txBatch = await registry.batchMint(recipients, names, ids, diplomas, dates, grades);
  const receiptBatch = await txBatch.wait();
  console.log("  -> Lot valide en 1 seule transaction ! TxHash :", receiptBatch.hash);

  // 5. Vérification publique de tous les certificats créés
  const total = await registry.totalCertificates();
  console.log(`\n===============================================================`);
  console.log(`  VERIFICATION FINALE ON-CHAIN : ${total} CERTIFICATS ACTIFS`);
  console.log(`===============================================================`);

  for (let i = 1; i <= total; i++) {
    const cert = await registry.getCertificate(i);
    console.log(`Certificat #${i} : [${cert.studentId}] ${cert.studentName} - ${cert.diplomaTitle} (${cert.grade})`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});