// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title CertificateRegistry
 * @dev Système de certification académique sécurisé sur la Blockchain
 */
contract CertificateRegistry {

    // 1. Structure du Certificat 
    struct Certificate {
        string studentName;
        string studentId;      // CNE ou identifiant unique étudiant
        string diplomaTitle;
        string issueDate;      // Format ISO (YYYY-MM-DD)
        string grade;          // Mention (ex: Mention Bien)
        address recipient;     // Wallet étudiant (optionnel)
        bool revoked;          // Statut de validité
    }

    address public owner;
    uint256 private nextCertId = 1; // Les identifiants commencent à 1

    // Stockage des certificats par identifiant unique (certId)
    mapping(uint256 => Certificate) private certificates;

    // Règle de robustesse : Anti-doublon sur le studentId (CNE)
    mapping(string => bool) private studentRegistered;

    // Recherche directe du certificat d'un étudiant par son studentId
    mapping(string => uint256) public studentToCertId;

    // Administrateurs autorisés à émettre des certificats
    mapping(address => bool) public authorizedAdmins;

    // Événements
    event CertificateMinted(
        uint256 indexed certId,
        address indexed recipient,
        string studentId,
        string studentName,
        string diplomaTitle
    );
    event CertificateRevoked(uint256 indexed certId, string reason);
    event AdminUpdated(address indexed admin, bool status);

    modifier onlyAuthorized() {
        require(
            msg.sender == owner || authorizedAdmins[msg.sender],
            "Erreur: Seul l'administrateur de l'universite peut emettre."
        );
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Erreur: Action reservee au proprietaire.");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedAdmins[msg.sender] = true;
    }

    /**
     * @dev Ajoute ou supprime un administrateur autorisé
     */
    function setAdmin(address admin, bool status) external onlyOwner {
        authorizedAdmins[admin] = status;
        emit AdminUpdated(admin, status);
    }

    /**
     * @notice Émission unitaire d'un certificat académique
     */
    function mintCertificate(
        address to,
        string calldata studentName,
        string calldata studentId,
        string calldata diplomaTitle,
        string calldata issueDate,
        string calldata grade
    ) external onlyAuthorized returns (uint256 certId) {
        // Validation des entrées obligatoires
        require(bytes(studentName).length > 0, "Nom etudiant requis");
        require(bytes(studentId).length > 0, "Student ID (CNE) requis");
        require(bytes(diplomaTitle).length > 0, "Intitule diplome requis");

        // Règle de robustesse : Interdiction du double enregistrement
        require(!studentRegistered[studentId], "Erreur: Ce studentId possede deja un certificat !");

        certId = nextCertId++;

        certificates[certId] = Certificate({
            studentName: studentName,
            studentId: studentId,
            diplomaTitle: diplomaTitle,
            issueDate: issueDate,
            grade: grade,
            recipient: to,
            revoked: false
        });

        studentRegistered[studentId] = true;
        studentToCertId[studentId] = certId;

        emit CertificateMinted(certId, to, studentId, studentName, diplomaTitle);
    }

    /**
     * @notice Émission par lot (Batch Minting) pour l'import Excel
     */
    function batchMint(
        address[] calldata recipients,
        string[] calldata studentNames,
        string[] calldata studentIds,
        string[] calldata diplomaTitles,
        string[] calldata issueDates,
        string[] calldata grades
    ) external onlyAuthorized {
        uint256 total = studentNames.length;
        require(total > 0, "Le lot ne peut pas etre vide");
        require(
            recipients.length == total &&
            studentIds.length == total &&
            diplomaTitles.length == total &&
            issueDates.length == total &&
            grades.length == total,
            "Incoherence de taille dans les tableaux"
        );

        for (uint256 i = 0; i < total; i++) {
            require(bytes(studentNames[i]).length > 0, "Nom vide detecte dans le lot");
            require(bytes(studentIds[i]).length > 0, "ID vide detecte dans le lot");

            // Ignore les doublons ou stoppe selon la rigueur
            require(!studentRegistered[studentIds[i]], "Doublon de studentId detecte dans le lot");

            uint256 certId = nextCertId++;

            certificates[certId] = Certificate({
                studentName: studentNames[i],
                studentId: studentIds[i],
                diplomaTitle: diplomaTitles[i],
                issueDate: issueDates[i],
                grade: grades[i],
                recipient: recipients[i],
                revoked: false
            });

            studentRegistered[studentIds[i]] = true;
            studentToCertId[studentIds[i]] = certId;

            emit CertificateMinted(certId, recipients[i], studentIds[i], studentNames[i], diplomaTitles[i]);
        }
    }

    /**
     * @notice Consultation publique d'un certificat par son identifiant
     */
    function getCertificate(uint256 certId) external view returns (Certificate memory) {
        require(certId > 0 && certId < nextCertId, "Certificat inexistant");
        return certificates[certId];
    }

    /**
     * @notice Révocation officielle d'un certificat erroné ou frauduleux
     */
    function revoke(uint256 certId, string calldata reason) external onlyAuthorized {
        require(certId > 0 && certId < nextCertId, "Certificat inexistant");
        require(!certificates[certId].revoked, "Certificat deja revoque");

        certificates[certId].revoked = true;
        emit CertificateRevoked(certId, reason);
    }

    /**
     * @notice Retourne le nombre total de certificats émis
     */
    function totalCertificates() external view returns (uint256) {
        return nextCertId - 1;
    }
}