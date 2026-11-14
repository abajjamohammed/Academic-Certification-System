const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CertificateRegistry Smart Contract", function () {
  let CertificateRegistry, registry, owner, admin, student1, student2;

  beforeEach(async function () {
    [owner, admin, student1, student2] = await ethers.getSigners();
    CertificateRegistry = await ethers.getContractFactory("CertificateRegistry");
    registry = await CertificateRegistry.deploy();
    await registry.waitForDeployment();
  });

  it("1. Doit définir le déployeur comme propriétaire (owner)", async function () {
    expect(await registry.owner()).to.equal(owner.address);
    expect(await registry.authorizedAdmins(owner.address)).to.be.true;
  });

  it("2. Permet l'émission unitaire d'un certificat (mintCertificate)", async function () {
    const tx = await registry.mintCertificate(
      student1.address,
      "Amina Benali",
      "2023-INF-042",
      "Licence Informatique",
      "2026-06-15",
      "Mention Bien"
    );
    await tx.wait();

    expect(await registry.totalCertificates()).to.equal(1);

    const cert = await registry.getCertificate(1);
    expect(cert.studentName).to.equal("Amina Benali");
    expect(cert.studentId).to.equal("2023-INF-042");
    expect(cert.revoked).to.be.false;
  });

  it("3. Bloque le double enregistrement du même studentId (Anti-doublon)", async function () {
    await registry.mintCertificate(
      student1.address,
      "Amina Benali",
      "2023-INF-042",
      "Licence Informatique",
      "2026-06-15",
      "Mention Bien"
    );

    // Tentative de réémission avec le même studentId
    await expect(
      registry.mintCertificate(
        student2.address,
        "Amina Doublon",
        "2023-INF-042",
        "Master Cyber",
        "2026-06-15",
        "Passable"
      )
    ).to.be.revertedWith("Erreur: Ce studentId possede deja un certificat !");
  });

  it("4. Refuse l'émission par un compte non autorisé", async function () {
    await expect(
      registry.connect(student1).mintCertificate(
        student1.address,
        "Fraudeur",
        "2023-FRAUD-01",
        "Diplôme Faux",
        "2026-06-15",
        "Très Bien"
      )
    ).to.be.revertedWith("Erreur: Seul l'administrateur de l'universite peut emettre.");
  });

  it("5. Permet l'émission par lot (batchMint)", async function () {
    const recipients = [student1.address, student2.address];
    const names = ["Youssef Alami", "Sara Bennani"];
    const ids = ["2023-INF-101", "2023-INF-102"];
    const diplomas = ["Master IA", "Licence Réseaux"];
    const dates = ["2026-06-15", "2026-06-15"];
    const grades = ["Mention Très Bien", "Mention Assez Bien"];

    await registry.batchMint(recipients, names, ids, diplomas, dates, grades);

    expect(await registry.totalCertificates()).to.equal(2);
    const cert2 = await registry.getCertificate(2);
    expect(cert2.studentName).to.equal("Sara Bennani");
  });

  it("6. Permet la révocation d'un certificat", async function () {
    await registry.mintCertificate(
      student1.address,
      "Karim Tazi",
      "2023-INF-099",
      "Licence",
      "2026-06-15",
      "Bien"
    );

    await registry.revoke(1, "Fraude sur note de stage");
    const cert = await registry.getCertificate(1);
    expect(cert.revoked).to.be.true;
  });
});