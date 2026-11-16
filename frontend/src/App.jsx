import React, { useState } from "react";
import { ethers } from "ethers";
import * as XLSX from "xlsx";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./contractConfig";

export default function App() {
  const [account, setAccount] = useState(null);
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [activeTab, setActiveTab] = useState("admin"); // 'admin' ou 'public'

  // Formulaire unitaire
  const [singleForm, setSingleForm] = useState({
    studentName: "",
    studentId: "",
    diplomaTitle: "",
    issueDate: new Date().toISOString().split("T")[0],
    grade: "Mention Bien",
    recipientAddress: ""
  });

  // Import Excel
  const [excelData, setExcelData] = useState([]);
  const [selectedRows, setSelectedRows] = useState({});
  const [fileName, setFileName] = useState("");

  // Recherche publique
  const [searchId, setSearchId] = useState("");
  const [searchedCert, setSearchedCert] = useState(null);
  const [searchError, setSearchError] = useState("");

  // Alertes & Statuts
  const [status, setStatus] = useState({ message: "", type: "" });
  const [txHash, setTxHash] = useState("");
  const [loading, setLoading] = useState(false);

  // 1. Connexion via MetaMask
  async function connectWallet() {
    if (!window.ethereum) {
      alert("Veuillez installer MetaMask !");
      return;
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const userAddr = await signer.getAddress();
      setAccount(userAddr);
      setIsLocalMode(false);
      setStatus({ message: "Portefeuille MetaMask connecté avec succès !", type: "success" });
    } catch (err) {
      setStatus({ message: "Erreur connexion MetaMask : " + err.message, type: "error" });
    }
  }

  // 1.bis Connexion directe au nœud local Hardhat (sans MetaMask)
  async function connectHardhatLocal() {
    try {
      const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
      const signer = await provider.getSigner(0); // Compte #0 Admin
      const userAddr = await signer.getAddress();
      setAccount(userAddr);
      setIsLocalMode(true);
      setStatus({ message: "Connecté directement au nœud local Hardhat (Compte #0 Admin) !", type: "success" });
    } catch (err) {
      setStatus({ message: "Erreur : Assurez-vous que 'npx hardhat node' tourne bien dans un terminal.", type: "error" });
    }
  }

  // Helper : récupère le bon signer (Local Hardhat ou MetaMask)
  async function getSigner() {
    if (isLocalMode || !window.ethereum) {
      const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
      return await provider.getSigner(0);
    } else {
      const provider = new ethers.BrowserProvider(window.ethereum);
      return await provider.getSigner();
    }
  }

  // 2. Émission Unitaire
  async function handleSingleMint(e) {
    e.preventDefault();
    if (!account) return alert("Veuillez d'abord connecter votre compte (Local ou MetaMask) !");

    setLoading(true);
    setStatus({ message: "Émission du certificat en cours sur la Blockchain...", type: "info" });
    setTxHash("");

    try {
      const signer = await getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const recipient = singleForm.recipientAddress && ethers.isAddress(singleForm.recipientAddress)
        ? singleForm.recipientAddress
        : account;

      const tx = await contract.mintCertificate(
        recipient,
        singleForm.studentName,
        singleForm.studentId,
        singleForm.diplomaTitle,
        singleForm.issueDate,
        singleForm.grade
      );

      setStatus({ message: "Transaction soumise ! Minage du bloc en cours...", type: "info" });
      const receipt = await tx.wait();
      setTxHash(receipt.hash);
      setStatus({ message: "Certificat académique émis et scellé sur la Blockchain avec succès !", type: "success" });

      setSingleForm({
        studentName: "",
        studentId: "",
        diplomaTitle: "",
        issueDate: new Date().toISOString().split("T")[0],
        grade: "Mention Bien",
        recipientAddress: ""
      });
    } catch (err) {
      setStatus({ message: "Échec : " + (err.reason || err.message), type: "error" });
    } finally {
      setLoading(false);
    }
  }

  // 3. Import Excel (SheetJS)
  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          alert("Le fichier Excel est vide !");
          return;
        }

        setExcelData(data);
        const initialSelected = {};
        data.forEach((_, idx) => { initialSelected[idx] = true; });
        setSelectedRows(initialSelected);

        setStatus({ message: `${data.length} étudiants chargés depuis ${file.name} !`, type: "success" });
      } catch (err) {
        alert("Erreur lors de la lecture du fichier Excel : " + err.message);
      }
    };
    reader.readAsBinaryString(file);
  }

  function toggleSelectRow(idx) {
    setSelectedRows(prev => ({ ...prev, [idx]: !prev[idx] }));
  }

  // 4. Émission par Lot (batchMint)
  async function handleBatchMint() {
    const rowsToMint = excelData.filter((_, idx) => selectedRows[idx]);
    if (rowsToMint.length === 0) {
      alert("Veuillez sélectionner au moins un étudiant à émettre !");
      return;
    }

    setLoading(true);
    setStatus({ message: `Émission par lot de ${rowsToMint.length} certificat(s)...`, type: "info" });
    setTxHash("");

    try {
      const signer = await getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const recipients = [];
      const names = [];
      const ids = [];
      const diplomas = [];
      const dates = [];
      const grades = [];

      rowsToMint.forEach(row => {
        const rec = row.recipientAddress && ethers.isAddress(row.recipientAddress)
          ? row.recipientAddress
          : account;
        recipients.push(rec);
        names.push(String(row.studentName || ""));
        ids.push(String(row.studentId || ""));
        diplomas.push(String(row.diplomaTitle || ""));
        dates.push(String(row.issueDate || ""));
        grades.push(String(row.grade || "Mention"));
      });

      const tx = await contract.batchMint(recipients, names, ids, diplomas, dates, grades);
      setStatus({ message: "Lot soumis à la Blockchain ! Minage en cours...", type: "info" });

      const receipt = await tx.wait();
      setTxHash(receipt.hash);
      setStatus({ message: `Succès : ${rowsToMint.length} certificats émis en une seule transaction !`, type: "success" });

      setExcelData(prev => prev.filter((_, idx) => !selectedRows[idx]));
      setSelectedRows({});
    } catch (err) {
      setStatus({ message: "Échec du lot : " + (err.reason || err.message), type: "error" });
    } finally {
      setLoading(false);
    }
  }

  // 5. Recherche et Consultation Publique
// 5. Recherche et Consultation Publique (avec auto-diagnostic)
  async function handleSearch(e) {
    e.preventDefault();
    setSearchedCert(null);
    setSearchError("");

    if (!searchId || searchId <= 0) {
      setSearchError("Veuillez renseigner un ID de certificat supérieur à 0.");
      return;
    }

    try {
      // Connexion directe au nœud local Hardhat pour la lecture
      const provider = (isLocalMode || !window.ethereum)
        ? new ethers.JsonRpcProvider("http://127.0.0.1:8545")
        : new ethers.BrowserProvider(window.ethereum);

      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

      // 1. Vérifier d'abord le total de certificats sur le contrat
      const total = await contract.totalCertificates();
      const totalNum = Number(total);

      if (totalNum === 0) {
        setSearchError("Le contrat est actuellement vide (total = 0 certificat). Si vous avez redémarré Hardhat, veuillez ré-émettre un certificat.");
        return;
      }

      if (Number(searchId) > totalNum) {
        setSearchError(`L'identifiant #${searchId} n'existe pas encore. Il n'y a que ${totalNum} certificat(s) émis sur ce contrat.`);
        return;
      }

      // 2. Récupérer les données du certificat
      const cert = await contract.getCertificate(Number(searchId));

      setSearchedCert({
        id: searchId,
        studentName: cert.studentName || cert[0],
        studentId: cert.studentId || cert[1],
        diplomaTitle: cert.diplomaTitle || cert[2],
        issueDate: cert.issueDate || cert[3],
        grade: cert.grade || cert[4],
        recipient: cert.recipient || cert[5],
        revoked: cert.revoked !== undefined ? cert.revoked : cert[6]
      });
    } catch (err) {
      console.error("DÉTAIL ERREUR :", err);
      setSearchError("Erreur technique : " + (err.reason || err.shortMessage || err.message));
    }
  }

  return (
    <div style={ui.wrapper}>
      <div style={ui.container}>

        {/* HEADER BAR AVEC LES DEUX BOUTONS */}
        <header style={ui.header}>
          <div>
            <div style={ui.appBadge}>Plateforme Officielle Web3</div>
            <h1 style={ui.title}>Certification Académique Blockchain</h1>
            <p style={ui.subtitle}>Émission décentralisée et vérification publique infalsifiable</p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {account ? (
              <div style={ui.walletConnected}>
                <span style={ui.dotGreen}></span>
                {account.slice(0, 6)}...{account.slice(-4)}
                <span style={{ fontSize: "11px", color: isLocalMode ? "#4f46e5" : "#0284c7" }}>
                  ({isLocalMode ? "Local Hardhat" : "MetaMask"})
                </span>
              </div>
            ) : (
              <>
                <button onClick={connectHardhatLocal} style={{ ...ui.btnConnect, background: "#0f172a" }}>
                  Mode Local Hardhat
                </button>
                <button onClick={connectWallet} style={ui.btnConnect}>
                  Connecter MetaMask
                </button>
              </>
            )}
          </div>
        </header>

        {/* TABS DE NAVIGATION */}
        <div style={ui.tabsWrapper}>
          <button
            onClick={() => setActiveTab("admin")}
            style={{ ...ui.tabItem, ...(activeTab === "admin" ? ui.tabActive : ui.tabInactive) }}
          >
            Zone Administration (Émission & Excel)
          </button>
          <button
            onClick={() => setActiveTab("public")}
            style={{ ...ui.tabItem, ...(activeTab === "public" ? ui.tabActive : ui.tabInactive) }}
          >
            Zone Publique (Vérification de Diplôme)
          </button>
        </div>

        {/* NOTIFICATIONS & STATUS */}
        {status.message && (
          <div style={{
            ...ui.statusBox,
            backgroundColor: status.type === "error" ? "#fef2f2" : status.type === "success" ? "#f0fdf4" : "#eff6ff",
            borderColor: status.type === "error" ? "#fca5a5" : status.type === "success" ? "#86efac" : "#bfdbfe",
            color: status.type === "error" ? "#991b1b" : status.type === "success" ? "#166534" : "#1e40af"
          }}>
            <div style={{ fontWeight: 600 }}>{status.message}</div>
            {txHash && (
              <div style={ui.txHash}>
                Hash Transaction : <span>{txHash}</span>
              </div>
            )}
          </div>
        )}

        {/* ===================== VUE ADMIN ===================== */}
        {activeTab === "admin" && (
          <div>
            {/* Formulaire Unitaire */}
            <div style={ui.card}>
              <div style={ui.cardHeader}>
                <h2 style={ui.cardTitle}>1. Émission Unitaire d'un Certificat</h2>
                <span style={ui.tag}>Saisie Manuelle</span>
              </div>

              <form onSubmit={handleSingleMint} style={ui.gridTwo}>
                <div style={ui.formGroup}>
                  <label style={ui.label}>Nom complet de l'étudiant *</label>
                  <input
                    type="text"
                    placeholder="ex: Amina Benali"
                    value={singleForm.studentName}
                    onChange={e => setSingleForm({ ...singleForm, studentName: e.target.value })}
                    required
                    style={ui.input}
                  />
                </div>

                <div style={ui.formGroup}>
                  <label style={ui.label}>Identifiant CNE (studentId) *</label>
                  <input
                    type="text"
                    placeholder="ex: 2023-INF-042"
                    value={singleForm.studentId}
                    onChange={e => setSingleForm({ ...singleForm, studentId: e.target.value })}
                    required
                    style={ui.input}
                  />
                </div>

                <div style={ui.formGroup}>
                  <label style={ui.label}>Intitulé officiel du diplôme *</label>
                  <input
                    type="text"
                    placeholder="ex: Licence Informatique"
                    value={singleForm.diplomaTitle}
                    onChange={e => setSingleForm({ ...singleForm, diplomaTitle: e.target.value })}
                    required
                    style={ui.input}
                  />
                </div>

                <div style={ui.formGroup}>
                  <label style={ui.label}>Date d'émission *</label>
                  <input
                    type="date"
                    value={singleForm.issueDate}
                    onChange={e => setSingleForm({ ...singleForm, issueDate: e.target.value })}
                    required
                    style={ui.input}
                  />
                </div>

                <div style={ui.formGroup}>
                  <label style={ui.label}>Mention attribuée</label>
                  <select
                    value={singleForm.grade}
                    onChange={e => setSingleForm({ ...singleForm, grade: e.target.value })}
                    style={ui.input}
                  >
                    <option value="Mention Très Bien">Mention Très Bien</option>
                    <option value="Mention Bien">Mention Bien</option>
                    <option value="Mention Assez Bien">Mention Assez Bien</option>
                    <option value="Passable">Passable</option>
                  </select>
                </div>

                <div style={ui.formGroup}>
                  <label style={ui.label}>Adresse Wallet destinataire (optionnel)</label>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={singleForm.recipientAddress}
                    onChange={e => setSingleForm({ ...singleForm, recipientAddress: e.target.value })}
                    style={ui.input}
                  />
                </div>

                <div style={{ gridColumn: "span 2", marginTop: "10px" }}>
                  <button type="submit" disabled={loading} style={ui.btnPrimaryFull}>
                    {loading ? "Enregistrement sur la Blockchain..." : "Émettre le Certificat"}
                  </button>
                </div>
              </form>
            </div>

            {/* Importation Excel */}
            <div style={ui.card}>
              <div style={ui.cardHeader}>
                <h2 style={ui.cardTitle}>2. Émission en Masse par Fichier Excel (.xlsx / .csv)</h2>
                <span style={ui.tag}>Batch Minting</span>
              </div>
              <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "16px" }}>
                Importez votre liste d'étudiants (colonnes : <code>studentName</code>, <code>studentId</code>, <code>diplomaTitle</code>, <code>issueDate</code>, <code>grade</code>).
              </p>

              {/* Upload Zone */}
              <div style={ui.dropzone}>
                <input
                  type="file"
                  id="excelInput"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                />
                <label htmlFor="excelInput" style={ui.dropzoneLabel}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" style={{ marginBottom: "8px" }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  <span style={{ fontWeight: 600, color: "#1e293b" }}>
                    {fileName ? `Fichier chargé : ${fileName}` : "Cliquez ici pour choisir le fichier etudiants.xlsx"}
                  </span>
                  <span style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                    Feuille de calcul Excel (.xlsx, .xls) ou CSV
                  </span>
                </label>
              </div>

              {/* Tableau d'aperçu */}
              {excelData.length > 0 && (
                <div style={{ marginTop: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <span style={{ fontWeight: 600, fontSize: "14px", color: "#334155" }}>
                      {excelData.length} étudiants détectés :
                    </span>
                    <button onClick={handleBatchMint} disabled={loading} style={ui.btnSuccess}>
                      {loading ? "Émission du lot..." : "Émettre la sélection par Lot (Batch)"}
                    </button>
                  </div>

                  <div style={ui.tableWrapper}>
                    <table style={ui.table}>
                      <thead>
                        <tr>
                          <th style={{ width: "40px", textAlign: "center" }}>✓</th>
                          <th>Nom Étudiant</th>
                          <th>CNE (studentId)</th>
                          <th>Diplôme</th>
                          <th>Date</th>
                          <th>Mention</th>
                        </tr>
                      </thead>
                      <tbody>
                        {excelData.map((row, idx) => (
                          <tr key={idx} style={selectedRows[idx] ? ui.trSelected : ui.tr}>
                            <td style={{ textAlign: "center" }}>
                              <input
                                type="checkbox"
                                checked={!!selectedRows[idx]}
                                onChange={() => toggleSelectRow(idx)}
                                style={{ cursor: "pointer" }}
                              />
                            </td>
                            <td style={{ fontWeight: 600 }}>{row.studentName}</td>
                            <td style={{ fontFamily: "monospace", color: "#2563eb" }}>{row.studentId}</td>
                            <td>{row.diplomaTitle}</td>
                            <td>{row.issueDate}</td>
                            <td>
                              <span style={ui.gradeBadge}>{row.grade}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== VUE PUBLIQUE ===================== */}
        {activeTab === "public" && (
          <div style={ui.card}>
            <div style={ui.cardHeader}>
              <h2 style={ui.cardTitle}>Vérification Officielle d'un Diplôme Académique</h2>
              <span style={ui.tagPublic}>Registre Public</span>
            </div>
            <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "20px" }}>
              Ce registre décentralisé permet aux recruteurs et institutions de vérifier l'authenticité d'un diplôme émis sur la Blockchain.
            </p>

            <form onSubmit={handleSearch} style={{ display: "flex", gap: "10px" }}>
              <input
                type="number"
                placeholder="Entrez le numéro du certificat (certId, ex: 1)"
                value={searchId}
                onChange={e => setSearchId(e.target.value)}
                style={{ ...ui.input, flex: 1, fontSize: "15px" }}
              />
              <button type="submit" style={ui.btnSearch}>
                Vérifier l'authenticité
              </button>
            </form>

            {searchError && (
              <div style={{ ...ui.statusBox, backgroundColor: "#fef2f2", borderColor: "#fca5a5", color: "#991b1b", marginTop: "16px" }}>
                {searchError}
              </div>
            )}

            {/* CARTE DIPLÔME OFFICIEL */}
            {searchedCert && (
              <div style={ui.certificate}>
                <div style={ui.certHeader}>
                  <div>
                    <span style={ui.certPretitle}>ATTESTATION DE RÉUSSITE DÉCENTRALISÉE</span>
                    <h3 style={ui.certTitle}>{searchedCert.diplomaTitle}</h3>
                  </div>
                  <div>
                    {searchedCert.revoked ? (
                      <span style={ui.badgeRevoked}>RÉVOQUÉ / NON VALIDE</span>
                    ) : (
                      <span style={ui.badgeValid}>DIPLÔME AUTHENTIFIÉ</span>
                    )}
                  </div>
                </div>

                <div style={ui.certBody}>
                  <p style={{ fontSize: "15px", color: "#475569", margin: "0 0 6px 0" }}>Diplôme décerné à l'étudiant(e) :</p>
                  <h2 style={{ fontSize: "24px", color: "#0f172a", margin: "0 0 20px 0" }}>{searchedCert.studentName}</h2>

                  <div style={ui.certGrid}>
                    <div style={ui.certItem}>
                      <span style={ui.certLabel}>Code Étudiant (CNE)</span>
                      <span style={ui.certValue}>{searchedCert.studentId}</span>
                    </div>
                    <div style={ui.certItem}>
                      <span style={ui.certLabel}>Date d'Émission</span>
                      <span style={ui.certValue}>{searchedCert.issueDate}</span>
                    </div>
                    <div style={ui.certItem}>
                      <span style={ui.certLabel}>Mention Attribuée</span>
                      <span style={ui.certValue}>{searchedCert.grade}</span>
                    </div>
                    <div style={ui.certItem}>
                      <span style={ui.certLabel}>Identifiant Blockchain</span>
                      <span style={{ ...ui.certValue, color: "#2563eb", fontWeight: "bold" }}>Certificat #{searchedCert.id}</span>
                    </div>
                    <div style={{ ...ui.certItem, gridColumn: "span 2" }}>
                      <span style={ui.certLabel}>Adresse du Titulaire (Wallet)</span>
                      <span style={{ ...ui.certValue, fontFamily: "monospace", fontSize: "13px" }}>{searchedCert.recipient}</span>
                    </div>
                  </div>
                </div>

                <div style={ui.certFooter}>
                  <span>Vérifié sur smart contract Ethereum : {CONTRACT_ADDRESS.slice(0, 10)}...</span>
                  <span style={{ color: "#166534", fontWeight: 600 }}>Immuable & Infalsifiable</span>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// STYLES
const ui = {
  wrapper: { backgroundColor: "#f8fafc", minHeight: "100vh", padding: "40px 20px" },
  container: { maxWidth: "860px", margin: "0 auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" },
  appBadge: { display: "inline-block", background: "#e0e7ff", color: "#4338ca", fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "12px", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" },
  title: { fontSize: "22px", fontWeight: 800, color: "#0f172a", margin: 0 },
  subtitle: { fontSize: "14px", color: "#64748b", margin: 0 },
  btnConnect: { background: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", padding: "10px 18px", fontWeight: 600, fontSize: "14px", cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" },
  walletConnected: { background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "8px 14px", fontSize: "13px", fontWeight: 600, fontFamily: "monospace", color: "#334155", display: "flex", alignItems: "center", gap: "8px" },
  dotGreen: { width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e" },

  tabsWrapper: { display: "flex", background: "#e2e8f0", padding: "4px", borderRadius: "10px", marginBottom: "24px", gap: "4px" },
  tabItem: { flex: 1, padding: "10px 16px", borderRadius: "8px", border: "none", fontSize: "14px", fontWeight: 600, cursor: "pointer", transition: "0.2s" },
  tabActive: { background: "#ffffff", color: "#0f172a", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" },
  tabInactive: { background: "transparent", color: "#64748b" },

  card: { background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "24px", marginBottom: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" },
  cardTitle: { fontSize: "17px", fontWeight: 700, color: "#1e293b", margin: 0 },
  tag: { background: "#f1f5f9", color: "#475569", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 600 },
  tagPublic: { background: "#dbeafe", color: "#1e40af", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 600 },

  gridTwo: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" },
  formGroup: { display: "flex", flexDirection: "column", gap: "6px" },
  label: { fontSize: "13px", fontWeight: 600, color: "#334155" },
  input: { background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "10px 12px", fontSize: "14px", color: "#0f172a", outline: "none" },
  btnPrimaryFull: { width: "100%", background: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", padding: "12px", fontWeight: 700, fontSize: "15px", cursor: "pointer" },
  btnSuccess: { background: "#16a34a", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 16px", fontWeight: 600, fontSize: "13px", cursor: "pointer" },
  btnSearch: { background: "#0f172a", color: "#fff", border: "none", borderRadius: "8px", padding: "10px 20px", fontWeight: 600, fontSize: "14px", cursor: "pointer" },

  dropzone: { border: "2px dashed #cbd5e1", borderRadius: "10px", padding: "24px", textAlign: "center", background: "#f8fafc", cursor: "pointer" },
  dropzoneLabel: { display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" },

  tableWrapper: { overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: "8px" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" },
  tr: { borderBottom: "1px solid #f1f5f9" },
  trSelected: { background: "#f0fdf4", borderBottom: "1px solid #e2e8f0" },
  gradeBadge: { background: "#f1f5f9", padding: "3px 8px", borderRadius: "4px", fontWeight: 600, color: "#334155" },

  statusBox: { padding: "14px 16px", borderRadius: "8px", border: "1px solid", marginBottom: "20px", fontSize: "14px" },
  txHash: { marginTop: "6px", fontSize: "12px", fontFamily: "monospace", color: "#475569" },

  certificate: { marginTop: "24px", border: "2px solid #3b82f6", borderRadius: "14px", background: "#ffffff", padding: "28px", boxShadow: "0 10px 15px -3px rgba(59,130,246,0.08)" },
  certHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #e2e8f0", paddingBottom: "16px", marginBottom: "20px" },
  certPretitle: { fontSize: "11px", fontWeight: 800, color: "#64748b", letterSpacing: "1px" },
  certTitle: { fontSize: "20px", fontWeight: 800, color: "#1e3a8a", margin: "4px 0 0 0" },
  badgeValid: { background: "#dcfce7", color: "#15803d", border: "1px solid #86efac", padding: "6px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 700 },
  badgeRevoked: { background: "#fee2e2", color: "#b91c1c", border: "1px solid #fca5a5", padding: "6px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 700 },
  certBody: { marginBottom: "24px" },
  certGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", background: "#f8fafc", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0" },
  certItem: { display: "flex", flexDirection: "column", gap: "2px" },
  certLabel: { fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: 600 },
  certValue: { fontSize: "14px", color: "#1e293b", fontWeight: 600 },
  certFooter: { display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#94a3b8", borderTop: "1px solid #f1f5f9", paddingTop: "14px" }
};