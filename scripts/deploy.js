const hre = require("hardhat");

async function main() {
  console.log("--> Déploiement de CertificateRegistry en cours...");

  const CertificateRegistry = await hre.ethers.getContractFactory("CertificateRegistry");
  const registry = await CertificateRegistry.deploy();
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log("=================================================");
  console.log(" CertificateRegistry déployé avec succès à :");
  console.log(" Adresse :", address);
  console.log("=================================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});