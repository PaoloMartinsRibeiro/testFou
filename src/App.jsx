import React, { useState, useEffect, useCallback } from "react";

// Constante pour le score maximal par critère (utilisée dans l'affichage 3/5)
const MAX_SCORE_PER_CRITERIA = 5;

// -------------------------------
//     FONCTION : Appel backend (MODIFIÉ)
// -------------------------------
// Le backend gère maintenant le prompt système
const API_BASE_URL =  "http://localhost:3001" || process.env.REACT_APP_API_BASE_URL;
const backendUrl = `${API_BASE_URL}/api/analyze`;

// L'argument 'systemPrompt' a été retiré, car le backend s'en occupe
async function callBackend(type, text) {
const response = await fetch(backendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        user_text: text,
        // Le champ system_prompt n'est plus envoyé
      }),
    });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Erreur API");

  // Les données retournées incluent maintenant 'points' et 'maxTotalScore'
  return data;
}

// -------------------------------
//   UI BADGE DE STATUT D'UN SCORE
// -------------------------------
const StatusBadge = ({ score }) => {
  if (score >= 4)
    return <span className="text-green-600 font-bold">✔ Traité</span>;
  if (score >= 2)
    return <span className="text-yellow-600 font-bold">⚠ Partiel</span>;
  return <span className="text-red-600 font-bold">✖ Manquant</span>;
};

// -------------------------------
//         APP PRINCIPALE
// -------------------------------
export default function App() {
  const [tab, setTab] = useState("QQOCCQP");

  // Deux inputs séparés
  const [inputQQ, setInputQQ] = useState("");
  const [inputCIB, setInputCIB] = useState("");

  // Deux résultats indépendants, qui incluent désormais les métadonnées
  const [resultQQ, setResultQQ] = useState(null);
  const [resultCIB, setResultCIB] = useState(null);

  // Loading
  const [loading, setLoading] = useState(false);

  // Dernière valeur analysée pour éviter doublons
  const [lastAnalyzedQQ, setLastAnalyzedQQ] = useState("");
  const [lastAnalyzedCIB, setLastAnalyzedCIB] = useState("");

  // Sélection dynamique de l'entrée utilisateur
  const input = tab === "QQOCCQP" ? inputQQ : inputCIB;
  
  // NOUVEAU: Récupération des métadonnées (points, maxScore) du résultat
  const result = tab === "QQOCCQP" ? resultQQ : resultCIB;
  const points = result?.points || []; // Récupéré du backend
  const maxTotalScore = result?.maxTotalScore || 0; // Récupéré du backend


  const analyze = useCallback(async () => {
    if (!input.trim()) return;

    // Gestion anti-doublons adaptée à chaque tab
    const isAlreadyAnalyzed =
      (tab === "QQOCCQP" && input.trim() === lastAnalyzedQQ) ||
      (tab === "CIBLAGE" && input.trim() === lastAnalyzedCIB);
    
    if (isAlreadyAnalyzed) {
      return;
    }

    try {
      setLoading(true);

      // Appel API simplifié (sans le prompt)
      const aiResult = await callBackend(tab, input);

      if (tab === "QQOCCQP") {
        setResultQQ(aiResult);
        setLastAnalyzedQQ(input.trim());
      } else {
        setResultCIB(aiResult);
        setLastAnalyzedCIB(input.trim());
      }
    } catch (e) {
      const errorResult = {
        scores: {},
        score_total: 0,
        points: [], // Pour éviter les erreurs si l'API échoue
        maxTotalScore: 0,
        reco_message: "❌ " + e.message,
      };

      if (tab === "QQOCCQP") setResultQQ(errorResult);
      else setResultCIB(errorResult);
    } finally {
      setLoading(false);
    }
  }, [input, tab, lastAnalyzedQQ, lastAnalyzedCIB]);


  // Auto-analyse debounce
  useEffect(() => {
    if (!input.trim()) return;
    const timer = setTimeout(() => analyze(), 1200);
    return () => clearTimeout(timer);
  }, [input, analyze]);


  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <h1 className="text-center text-2xl font-bold mb-6">
        Assistant Rédaction Projet
      </h1>


      <div className="max-w-4xl mx-auto bg-white shadow p-6 rounded-xl">
        {/* TABS */}
        <div className="flex border-b mb-4">
          <button
            onClick={() => setTab("QQOCCQP")}
            className={`px-4 py-2 font-semibold ${
              tab === "QQOCCQP"
                ? "text-blue-600 border-b-2 border-blue-600"
                : ""
            }`}
          >
            1. Introduction
          </button>

          <button
            onClick={() => setTab("CIBLAGE")}
            className={`px-4 py-2 ml-2 font-semibold ${
              tab === "CIBLAGE"
                ? "text-blue-600 border-b-2 border-blue-600"
                : ""
            }`}
          >
            2. Ciblage Client
          </button>
        </div>

        {/* TEXTAREA */}
        <textarea
          rows={8}
          placeholder={
            tab === "QQOCCQP"
              ? "Texte d'introduction..."
              : "Texte de ciblage..."
          }
          value={input}
          onChange={(e) =>
            tab === "QQOCCQP"
              ? setInputQQ(e.target.value)
              : setInputCIB(e.target.value)
          }
          className="w-full border p-3 rounded mb-3"
        />

        {/* BOUTON */}
        <button
          onClick={analyze}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold"
        >
          {loading ? "Analyse en cours…" : "Analyser maintenant"}
        </button>

        {/* SCORE */}
        {result && (
          <div className="bg-gray-50 p-4 rounded-lg shadow mt-4">
            <h3 className="font-bold text-lg">
              Score total : {result.score_total} / {maxTotalScore}
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
              {points.map((p) => (
                <div key={p.cle} className="p-2 bg-white shadow rounded">
                  <StatusBadge
                    score={result.scores[p.cle]?.score || 0}
                  />
                  <div className="mt-1 text-sm">
                    <b>{p.cle}</b> ({p.poids}%)
                    <br />
                    Score : {result.scores[p.cle]?.score || 0} / {MAX_SCORE_PER_CRITERIA}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MESSAGE IA */}
        {result && (
          <div className="bg-gray-900 text-white p-4 rounded-lg mt-4 whitespace-pre-wrap">
            {loading ? "⏳ Analyse en cours…" : result.reco_message}
          </div>
        )}
      </div>
    </div>
  );
}