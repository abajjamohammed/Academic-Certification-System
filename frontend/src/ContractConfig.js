// ⚠️ Mets ici l'adresse obtenue lors du déploiement (npx hardhat run scripts/deploy.js --network localhost)
export const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

export const CONTRACT_ABI = [
  "function owner() view returns (address)",
  "function authorizedAdmins(address) view returns (bool)",
  "function totalCertificates() view returns (uint256)",
  "function mintCertificate(address to, string studentName, string studentId, string diplomaTitle, string issueDate, string grade) returns (uint256)",
  "function batchMint(address[] recipients, string[] studentNames, string[] studentIds, string[] diplomaTitles, string[] issueDates, string[] grades)",
  "function getCertificate(uint256 certId) view returns (tuple(string studentName, string studentId, string diplomaTitle, string issueDate, string grade, address recipient, bool revoked))",
  "function revoke(uint256 certId, string reason)"
];