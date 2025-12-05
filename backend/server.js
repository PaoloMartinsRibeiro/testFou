import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();

// Allow JSON + CORS
app.use(express.json());
app.use(cors());

// Vérification clé API
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ ERREUR : OPENAI_API_KEY manquant");
  process.exit(1);
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ==================================================================
// 📌 PROMPTS & CONFIGURATIONS SÉCURISÉS (Déplacés depuis le Frontend)
// ==================================================================

const QQOCCQP_POINTS = [
  { cle: "Qui", poids: 20 },
  { cle: "Quoi", poids: 20 },
  { cle: "Où", poids: 10 },
  { cle: "Comment", poids: 10 },
  { cle: "Combien", poids: 10 },
  { cle : "Quand", poids: 10},
  { cle: "Pourquoi", poids: 20 }
];

const CIBLAGE_POINTS = [
  { cle: "Caractéristiques", poids: 25 },
  { cle: "Localisation", poids: 15 },
  { cle: "Comportements", poids: 15 },
  { cle: "Motivations", poids: 20 },
  { cle: "Contraintes", poids: 10 },
  { cle: "Accès", poids: 10 },
  { cle: "SegmentsMultiples", poids: 5 }
];

const MAX_SCORE_CRITERIA = 5;

const CONFIG_QQOCCQP = {
  points: QQOCCQP_POINTS,
  maxTotalScore: QQOCCQP_POINTS.length * MAX_SCORE_CRITERIA,
  systemPrompt: `Tu es un coach d’écriture professionnel. Tu accompagnes le bénéficiaire pour rédiger une introduction courte, claire, engageante et structurée. La longueur maximale est de ¾ de page.

 Attendus :
- Paragraphe court, clair et accrocheur.
- Présentation synthétique du dossier.
- Les éléments QQOCCQP doivent être présents naturellement : Qui, Quoi, Où, Quand, Comment, Combien, Pourquoi.
- Donner envie au lecteur (financeur, formateur, jury…) de lire la suite.
- Intégrer une accroche engageante.

 Rôle du modèle :
- Identifier ce qui manque dans le texte sans jamais le réécrire.
- Poser une seule question guidante à la fois.
- Ne jamais dévoiler les critères internes.
- Vérifier la cohérence du texte et l’intégration naturelle des éléments QQOCCQP.
- Lorsque les 7 critères sont traités, ajouter : 
  "Le texte contient maintenant suffisamment d’informations. L’introduction est complète."

 Points importants :
- Ne jamais reformuler ou compléter le texte du bénéficiaire.
- Toujours prendre en compte toute information, même implicite.
- Toujours vérifier la cohérence interne du texte.
- Le bénéficiaire ne doit jamais voir les critères ou le score.
- Ne jamais mentionner QQOCCQP dans la réponse ou les recommandations

 Série de questions guidantes (selon l’élément manquant) :

Qui : À qui s’adresse ton offre ou ton activité ? Quelles sont les caractéristiques de ton public ?
Quoi : Quelle est ton offre principale ? Quels services ou produits proposes-tu ?
Où : Où ton activité est-elle accessible ? (lieu, zone, en ligne…)
Comment : Comment ton activité se déroule-t-elle ? (méthodes, organisation…)
Combien : Quelle est l’ampleur ou les ressources engagées dans ton projet ? (volume, moyens…)
Quand : Quand ton activité a démarré/démarrera ? (dates, phases…)
Pourquoi : Pourquoi portes-tu ce projet ? Quelles valeurs, quelles motivations ?

Échelle de scoring (0 à 5) :
0 = Pas abordé
5 = Parfaitement clair et détaillé

Respecte obligatoirement ce format JSON :

{
  "scores": {
    "Qui": { "score": number },
    "Quoi": { "score": number },
    "Où": { "score": number },
    "Quand": { "score": number },
    "Comment": { "score": number },
    "Combien": { "score": number },
    "Pourquoi": { "score": number }
  },
  "score_total": number,
  "next_action": string,
  "next_question_key": string,
  "reco_message": string
}

Réponds uniquement en JSON.
`,
};

// --- Ciblage Client ---
const CONFIG_CIBLAGE = {
  points: CIBLAGE_POINTS,
  maxTotalScore: CIBLAGE_POINTS.length * 5,
  systemPrompt: `Tu es un coach d’écriture qui aide le bénéficiaire à décrire précisément ses clients. Le texte final doit être clair, argumenté et tenir sur une page maximum.

 Attendus :
- Décrire un ou plusieurs segments clients.
- Faire apparaître : caractéristiques, habitudes, motivations, localisation, contraintes, accès à l’offre.
- Montrer la cohérence entre la cible et l’activité.

 Rôle du modèle :
- Aider le bénéficiaire à préciser qui sont ses clients.
- Poser une seule question à la fois.
- Ne jamais proposer ou orienter vers un segment.
- Suggérer, via la question, la possibilité de plusieurs segments.
- Arrêter le processus quand le score atteint **80%** :
  "Le texte contient maintenant suffisamment d’informations. Le ciblage client est complet."

 Points importants :
- Ne jamais réécrire ou compléter le texte fourni.
- Toujours prendre en compte tout élément, même implicite.
- Vérifier la cohérence interne après chaque réponse.
- Si une réponse est floue : poser une question de précision.
- Le bénéficiaire ne voit jamais les critères internes ni le score.

 Série de questions guidantes :

Caractéristiques : Qui sont tes clients ? Quelles sont leurs caractéristiques importantes ?
Localisation : D’où viennent-ils ? Ville, quartier, rayon ?
Comportements : Dans quelles situations ont-ils besoin de ton offre ?
Motivations : Qu’est-ce qu’ils recherchent en priorité ?
Contraintes : Quelles limites rencontrent-ils ? (budget, horaires, mobilité…)
Accès : Comment entrent-ils en contact avec toi ? (sur place, web, réseau…)
Segments multiples : Penses-tu qu’il existe plusieurs types de clients ? Comment les distinguer ?

 Échelle de scoring (0 à 5) :
0 = Pas abordé
5 = parfaitement clair et argumenté

Format JSON attendu :

{
  "scores": {
    "Caractéristiques": { "score": number },
    "Localisation": { "score": number },
    "Comportements": { "score": number },
    "Motivations": { "score": number },
    "Contraintes": { "score": number },
    "Accès": { "score": number },
    "SegmentsMultiples": { "score": number }
  },
  "score_total": number,
  "next_action": string,
  "next_question_key": string,
  "reco_message": string
}

Réponds uniquement en JSON.`
}

// Mappage des configurations
const CONFIGS = {
  QQOCCQP: CONFIG_QQOCCQP,
  CIBLAGE: CONFIG_CIBLAGE,
};

// ------------------------------------------------------------------
// 📌 ROUTE API (Modifiée)
// ------------------------------------------------------------------
app.post("/api/analyze", async (req, res) => {
  try {
    // Le frontend n'envoie plus le prompt, seulement le type et le texte
    const { type, user_text } = req.body;

    // 1. Validation de base
    if (!user_text || !type) {
      return res.status(400).json({
        error: "Champs requis : 'type' et 'user_text'",
      });
    }

    // 2. Récupération des données secrètes (prompts) depuis le Backend
    const config = CONFIGS[type];

    if (!config) {
        return res.status(400).json({
            error: `Type d'analyse non valide: ${type}`,
        });
    }
    
    const system_prompt = config.systemPrompt;
    
    // Le reste du processus est inchangé
    const userPrompt =
      type === "QQOCCQP"
        ? `Texte d'introduction : """${user_text}"""`
        : `Texte de ciblage client : """${user_text}"""`;

    console.log(`🟦 Appel OpenAI pour ${type}…`);

    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: system_prompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0,

      // Le schéma de réponse reste le même
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "analysis_schema",
          strict: false,
          schema: {
            type: "object",
            additionalProperties: false,

            properties: {
              scores: {
                type: "object",
                description: "Liste flexible de scores par critère",
                additionalProperties: {
                  type: "object",
                  properties: {
                    score: { type: "number" },
                  },
                  required: ["score"],
                  additionalProperties: false,
                },
              },

              score_total: { type: "number" },
              next_action: { type: "string" },
              next_question_key: { type: "string" },
              reco_message: { type: "string" },
            },

            required: [
              "scores",
              "score_total",
              "next_action",
              "next_question_key",
              "reco_message",
            ],
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      return res.status(502).json({
        error: "Aucun contenu retourné par OpenAI",
      });
    }

    let parsed = typeof content === "object" ? content : JSON.parse(content);

    console.log("🟩 Réponse IA OK");

    // 3. Ajout des métadonnées (points et max score) à la réponse avant de l'envoyer au frontend
    // C'est la partie critique pour que le frontend puisse afficher les tableaux
    return res.json({
        ...parsed,
        points: config.points,
        maxTotalScore: config.maxTotalScore,
    });

  } catch (err) {
    console.error("🔥 ERREUR BACKEND :", err);
    return res.status(500).json({
      error: err.message || "Erreur serveur interne",
    });
  }
});

// ------------------------------------------------------------------
// 📌 SERVIR LE FRONTEND REACT EN PRODUCTION
// ------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ------------------------------------------------------------------
// 📌 LANCEMENT SERVEUR
// ------------------------------------------------------------------
const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`🚀 Serveur opérationnel → http://localhost:${PORT}`)
);