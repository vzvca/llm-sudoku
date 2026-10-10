(function (global) {
  "use strict";

  var API_URL = "https://api.mistral.ai/v1/chat/completions";
  var DEFAULT_MODEL = "mistral-small-latest";

  var DIFFICULTIES = ["facile", "moyen", "difficile"];

  var TOOLS = [
    {
      type: "function",
      function: {
        name: "new_grid",
        description: "Génère et affiche une nouvelle grille de sudoku. À appeler quand l'utilisateur demande une nouvelle grille, une nouvelle partie, ou un changement de difficulté.",
        parameters: {
          type: "object",
          properties: {
            difficulty: {
              type: "string",
              enum: DIFFICULTIES,
              description: "Difficulté de la grille. 'facile' par défaut."
            }
          },
          required: []
        }
      }
    },
    {
      type: "function",
      function: {
        name: "check_grid",
        description: "Vérifie la grille en cours : indique si elle est complète, correcte, et signale les conflits. Sans paramètre.",
        parameters: { type: "object", properties: {}, required: [] }
      }
    },
    {
      type: "function",
      function: {
        name: "place_value",
        description: "Place une valeur dans une case de la grille courante.",
        parameters: {
          type: "object",
          properties: {
            row: { type: "integer", description: "Numéro de ligne de 1 (haut) à 9 (bas)" },
            column: { type: "integer", description: "Numéro de colonne de 1 (gauche) à 9 (droite)" },
            value: { type: "integer", description: "Valeur de 1 à 9" }
          },
          required: ["row", "column", "value"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "clear_cell",
        description: "Efface une case de la grille courante.",
        parameters: {
          type: "object",
          properties: {
            row: { type: "integer", description: "Numéro de ligne de 1 à 9" },
            column: { type: "integer", description: "Numéro de colonne de 1 à 9" }
          },
          required: ["row", "column"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "get_hint",
        description: "Donne un coup de main : révèle ou met en évidence la case la plus facile à déduire. Sans paramètre.",
        parameters: { type: "object", properties: {}, required: [] }
      }
    },
    {
      type: "function",
      function: {
        name: "solve_grid",
        description: "Résout entièrement la grille courante automatiquement. Sans paramètre.",
        parameters: { type: "object", properties: {}, required: [] }
      }
    },
    {
      type: "function",
      function: {
        name: "reset_grid",
        description: "Réinitialise la grille courante aux indices de départ. Sans paramètre.",
        parameters: { type: "object", properties: {}, required: [] }
      }
    }
  ];

  var SYSTEM_PROMPT = [
    "Tu es l'assistant vocal/texte d'un jeu de sudoku dans le navigateur.",
    "L'utilisateur te parle en français, par écrit ou via la reconnaissance vocale (le texte peut contenir des erreurs de transcription).",
    "Tu dois répondre en appelant les fonctions JSON disponibles, en français.",
    "Règles :",
    "- Déduis les paramètres de la phrase de l'utilisateur (ex. « prépare-moi une grille difficile » -> new_grid avec difficulty=\"difficile\").",
    "- Les lignes et colonnes vont de 1 à 9 ; la case (1,1) est en haut à gauche.",
    "- Tu peux appeler plusieurs fonctions dans un même tour, dans un ordre logique.",
    "- Si la demande est ambiguë ou hors sudoku, réponds par un message simple sans appeler de fonction, en français.",
    "- Sois bref et amical."
  ].join("\n");

  function MistralClient(apiKey, model) {
    this.apiKey = apiKey;
    this.model = model || DEFAULT_MODEL;
  }

  MistralClient.prototype.chat = function (messages, options) {
    options = options || {};
    var body = {
      model: this.model,
      messages: messages,
      temperature: typeof options.temperature === "number" ? options.temperature : 0.2
    };
    if (options.tools) body.tools = options.tools;
    if (options.toolChoice) body.tool_choice = options.toolChoice;
    return fetch(API_URL, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + this.apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error("API Mistral " + res.status + " : " + t.slice(0, 300));
        });
      }
      return res.json();
    }).then(function (data) {
      var choice = data.choices && data.choices[0];
      if (!choice || !choice.message) throw new Error("Réponse vide de l'API Mistral");
      return choice.message;
    });
  };

  function parseToolCalls(message) {
    if (!message || !Array.isArray(message.tool_calls)) return [];
    return message.tool_calls.map(function (tc) {
      var fn = tc.function || {};
      var args = {};
      if (typeof fn.arguments === "string" && fn.arguments.trim()) {
        args = JSON.parse(fn.arguments);
      } else if (fn.arguments && typeof fn.arguments === "object") {
        args = fn.arguments;
      }
      return { name: fn.name, arguments: args };
    }).filter(function (c) { return !!c.name; });
  }

  MistralClient.prototype.interpret = function (userText, context) {
    var messages = [{ role: "system", content: SYSTEM_PROMPT }];
    if (context) {
      messages.push({
        role: "system",
        content: "État du jeu : " + JSON.stringify(context)
      });
    }
    messages.push({ role: "user", content: userText });
    return this.chat(messages, { tools: TOOLS, toolChoice: "auto" }).then(function (message) {
      return {
        content: typeof message.content === "string" ? message.content : "",
        toolCalls: safeParseToolCalls(message)
      };
    });
  };

  function safeParseToolCalls(message) {
    try {
      return parseToolCalls(message);
    } catch (e) {
      return [];
    }
  }

  MistralClient.DEFAULT_MODEL = DEFAULT_MODEL;
  MistralClient.DIFFICULTIES = DIFFICULTIES;
  MistralClient.TOOLS = TOOLS;
  MistralClient.SYSTEM_PROMPT = SYSTEM_PROMPT;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = MistralClient;
  } else {
    global.MistralClient = MistralClient;
  }
})(typeof window !== "undefined" ? window : globalThis);
