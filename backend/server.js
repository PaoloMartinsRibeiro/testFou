// // server.js
// import express from "express";
// import dotenv from "dotenv";
// import OpenAI from "openai";
// import cors from "cors";

// dotenv.config();
// const app = express();

// app.use(express.json());
// app.use(cors());

// // Vérification clé
// if (!process.env.OPENAI_API_KEY) {
//   console.error("❌ ERREUR : OPENAI_API_KEY manquant");
//   process.exit(1);
// }

// const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// // ------------------------------------------
// //   ROUTE API
// // ------------------------------------------
// app.post("/api/analyze", async (req, res) => {
//   try {
//     const { type, user_text, system_prompt } = req.body;

//     if (!user_text || !system_prompt) {
//       return res.status(400).json({
//         error: "Champs requis : 'user_text' et 'system_prompt'",
//       });
//     }

//     const userPrompt =
//       type === "QQOCCQP"
//         ? `Texte d'introduction : """${user_text}"""`
//         : `Texte de ciblage client : """${user_text}"""`;

//     console.log("🟦 Appel OpenAI…");

//     const response = await client.chat.completions.create({
//       model: "gpt-4.1-mini",
//       messages: [
//         { role: "system", content: system_prompt },
//         { role: "user", content: userPrompt },
//       ],
//       temperature: 0,

//       // --- 🔥 SCHEMA JSON STRICT 🔥 ---
// response_format: {
//   type: "json_schema",
//   json_schema: {
//     name: "analysis_schema",
//     strict: false,
//     schema: {
//       type: "object",
//       additionalProperties: false,

//       properties: {
//         scores: {
//           type: "object",
//           description: "Liste flexible de scores par critère",
//           additionalProperties: {
//             type: "object",
//             properties: {
//               score: { type: "number" }
//             },
//             required: ["score"],
//             additionalProperties: false
//           }
//         },

//         score_total: { type: "number" },
//         next_action: { type: "string" },
//         next_question_key: { type: "string" },
//         reco_message: { type: "string" }
//       },

//       required: [
//         "scores",
//         "score_total",
//         "next_action",
//         "next_question_key",
//         "reco_message"
//       ]
//     }
//   }
// }


//     });

//     const content = response.choices?.[0]?.message?.content;
//     if (!content) {
//       return res.status(502).json({
//         error: "Aucun contenu retourné par OpenAI",
//       });
//     }

//     let parsed;
//     if (typeof content === "object") {
//       parsed = content;
//     } else {
//       parsed = JSON.parse(content);
//     }

//     console.log("🟩 Réponse IA OK");
//     return res.json(parsed);

//   } catch (err) {
//     console.error("🔥 ERREUR BACKEND :", err);
//     return res.status(500).json({
//       error: err.message || "Erreur serveur interne",
//     });
//   }
// });

// // ------------------------------------------
// const PORT = process.env.PORT || 3001;
// app.listen(PORT, () =>
//   console.log(`🚀 Backend opérationnel → http://localhost:${PORT}`)
// );


// server.js
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

// ------------------------------------------------------------------
// 📌 ROUTE API
// ------------------------------------------------------------------
app.post("/api/analyze", async (req, res) => {
  try {
    const { type, user_text, system_prompt } = req.body;

    if (!user_text || !system_prompt) {
      return res.status(400).json({
        error: "Champs requis : 'user_text' et 'system_prompt'",
      });
    }

    const userPrompt =
      type === "QQOCCQP"
        ? `Texte d'introduction : """${user_text}"""`
        : `Texte de ciblage client : """${user_text}"""`;

    console.log("🟦 Appel OpenAI…");

    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: system_prompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0,

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
                    score: { type: "number" }
                  },
                  required: ["score"],
                  additionalProperties: false
                }
              },

              score_total: { type: "number" },
              next_action: { type: "string" },
              next_question_key: { type: "string" },
              reco_message: { type: "string" }
            },

            required: [
              "scores",
              "score_total",
              "next_action",
              "next_question_key",
              "reco_message"
            ]
          }
        }
      }
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      return res.status(502).json({
        error: "Aucun contenu retourné par OpenAI",
      });
    }

    let parsed = typeof content === "object" ? content : JSON.parse(content);

    console.log("🟩 Réponse IA OK");

    return res.json(parsed);

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

// 👉 Le build React est à la racine du projet : ../build
const buildPath = path.join(__dirname, "../build");

app.use(express.static(buildPath));

// Toute route non-API renvoie le React index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(buildPath, "index.html"));
});

// ------------------------------------------------------------------
// 📌 LANCEMENT SERVEUR
// ------------------------------------------------------------------
const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`🚀 Serveur opérationnel → http://localhost:${PORT}`)
);
