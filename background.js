chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {

        /*
         * Open extension settings
         */
        if (message.type === "openOptions") {
            chrome.tabs.create({
                url: chrome.runtime.getURL("options.html")
            });

            return;
        }


        /*
         * Test Gemini API key
         */
        if (message.type === "testApiKey") {
            testApiKey()
                .then(result => {
                    sendResponse({
                        success: true,
                        ...result
                    });
                })
                .catch(error => {
                    console.error(
                        "API key test error:",
                        error
                    );

                    sendResponse({
                        success: false,
                        error: error.message
                    });
                });

            return true;
        }


        /*
         * Load available Gemini models
         */
        if (message.type === "getModels") {
            getAvailableModels()
                .then(models => {
                    sendResponse({
                        success: true,
                        models
                    });
                })
                .catch(error => {
                    console.error(
                        "Model loading error:",
                        error
                    );

                    sendResponse({
                        success: false,
                        error: error.message
                    });
                });

            return true;
        }


        /*
         * Translation / dictionary request
         */
        if (message.type === "translate") {
            handleTranslation(
                message.text,
                message.targetLanguage
            )
                .then(result => {
                    sendResponse({
                        success: true,
                        result
                    });
                })
                .catch(error => {
                    console.error(
                        "Translation error:",
                        error
                    );

                    sendResponse({
                        success: false,
                        error: error.message
                    });
                });

            return true;
        }
    }
);


/*
 * Read extension settings
 */
async function getSettings() {
    return chrome.storage.local.get([
        "geminiApiKey",
        "geminiModel",
        "targetLanguage"
    ]);
}


/*
 * Fetch available Gemini models
 */
async function getAvailableModels() {
    const settings =
        await getSettings();

    const apiKey =
        settings.geminiApiKey;

    if (!apiKey) {
        throw new Error(
            "Gemini API key is not configured."
        );
    }


    const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
        {
            method: "GET",

            headers: {
                "x-goog-api-key": apiKey
            }
        }
    );


    if (!response.ok) {
        const errorText =
            await response.text();

        throw new Error(
            `Gemini API error ${response.status}: ${errorText}`
        );
    }


    const data =
        await response.json();


    return (data.models || [])
        .filter(model =>
            model.supportedGenerationMethods
                ?.includes("generateContent")
        )
        .map(model => ({
            id:
                model.name.replace(
                    "models/",
                    ""
                ),

            name:
                model.displayName ||
                model.name.replace(
                    "models/",
                    ""
                ),

            description:
                model.description || "",

            inputTokenLimit:
                model.inputTokenLimit || null,

            outputTokenLimit:
                model.outputTokenLimit || null
        }))
        .sort(
            (a, b) =>
                a.name.localeCompare(b.name)
        );
}


/*
 * API key test
 */
async function testApiKey() {
    const models =
        await getAvailableModels();

    if (!models.length) {
        throw new Error(
            "The API key is valid, but no generateContent models are available."
        );
    }

    return {
        modelCount: models.length,
        models
    };
}


/*
 * Translation handler
 */
async function handleTranslation(
    text,
    targetLanguage
) {
    const settings =
        await getSettings();

    const apiKey =
        settings.geminiApiKey;

    const model =
        settings.geminiModel;


    if (!apiKey) {
        throw new Error(
            "Gemini API key is not configured. Open the extension settings."
        );
    }


    if (!model) {
        throw new Error(
            "No Gemini model is selected. Open settings and choose a model."
        );
    }


    if (!text?.trim()) {
        throw new Error(
            "No text was selected."
        );
    }


    return askGemini(
        text.trim(),
        targetLanguage,
        apiKey,
        model
    );
}


/*
 * Force Gemini to return structured data
 */
function buildPrompt(
    text,
    targetLanguage
) {
    return `
You are a translation and dictionary assistant.

Selected text:
"""
${text}
"""

Target language:
${targetLanguage}

Detect the source language automatically.

Return ONLY valid JSON.

Do NOT use Markdown.
Do NOT wrap the answer in code fences.
Do NOT add commentary before or after the JSON.

Use exactly this JSON structure:

{
  "mode": "definition",
  "sourceLanguage": "",
  "targetLanguage": "${targetLanguage}",
  "word": "",
  "phonetic": "",
  "partOfSpeech": "",
  "translation": "",
  "meanings": [
    {
      "definition": "",
      "explanation": "",
      "examples": []
    }
  ],
  "synonyms": [],
  "usage": ""
}

MODE RULES:

1. If the source language is English
   AND target language is English:

   Set:
   "mode": "definition"

   Do not translate.

   For a single word:
   - normalize the word in "word"
   - provide IPA pronunciation if confidently known
   - provide part of speech
   - provide 1 to 3 useful meanings
   - definitions should be concise and dictionary-like
   - explanations should give nuance or contextual meaning
   - provide 1 to 2 natural examples per important meaning
   - provide useful synonyms
   - provide a short usage note when useful

   For a phrase, idiom, expression, or term:
   - explain its meaning
   - explain typical usage
   - provide examples
   - provide related expressions when useful

   For a complete sentence:
   - explain its overall meaning
   - explain important nuances or expressions
   - do not define every simple word

2. If source language and target language are different:

   Set:
   "mode": "translation"

   Put the natural ${targetLanguage} translation
   in "translation".

   Preserve:
   - tone
   - meaning
   - idiomatic meaning
   - context

   For a word or short expression:
   also include useful meanings,
   examples, part of speech,
   synonyms, and usage when appropriate.

3. Keep information concise enough
   for a browser dictionary popup.

4. Never output Markdown characters.

5. Every field must exist.
   Use empty strings or empty arrays
   when information is not applicable.
`;
}


/*
 * Send request to Gemini
 */
async function askGemini(
    text,
    targetLanguage,
    apiKey,
    model
) {
    const prompt =
        buildPrompt(
            text,
            targetLanguage
        );


    const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;


    const response = await fetch(
        url,
        {
            method: "POST",

            headers: {
                "Content-Type":
                    "application/json",

                "x-goog-api-key":
                apiKey
            },

            body: JSON.stringify({
                contents: [
                    {
                        role: "user",

                        parts: [
                            {
                                text: prompt
                            }
                        ]
                    }
                ],

                generationConfig: {
                    temperature: 0.15,
                    maxOutputTokens: 1600
                }
            })
        }
    );


    if (!response.ok) {
        const errorText =
            await response.text();

        throw new Error(
            `Gemini API error ${response.status}: ${errorText}`
        );
    }


    const data =
        await response.json();


    let raw =
        data.candidates?.[0]
            ?.content?.parts
            ?.map(
                part =>
                    part.text || ""
            )
            .join("")
            .trim();


    if (!raw) {
        throw new Error(
            "Gemini returned an empty response."
        );
    }


    /*
     * Remove accidental Markdown fences
     */
    raw =
        raw
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();


    try {
        const parsed =
            JSON.parse(raw);

        return normalizeResult(
            parsed,
            text,
            targetLanguage
        );

    } catch (error) {
        console.error(
            "Invalid Gemini JSON:",
            raw
        );

        throw new Error(
            "Gemini returned an invalid dictionary response. Try again."
        );
    }
}


/*
 * Make renderer resilient to missing fields
 */
function normalizeResult(
    data,
    selectedText,
    targetLanguage
) {
    return {
        mode:
            data.mode === "translation"
                ? "translation"
                : "definition",

        sourceLanguage:
            data.sourceLanguage || "",

        targetLanguage:
            data.targetLanguage ||
            targetLanguage,

        word:
            data.word ||
            selectedText,

        phonetic:
            data.phonetic || "",

        partOfSpeech:
            data.partOfSpeech || "",

        translation:
            data.translation || "",

        meanings:
            Array.isArray(data.meanings)
                ? data.meanings.map(
                    meaning => ({
                        definition:
                            meaning?.definition || "",

                        explanation:
                            meaning?.explanation || "",

                        examples:
                            Array.isArray(
                                meaning?.examples
                            )
                                ? meaning.examples.filter(Boolean)
                                : []
                    })
                )
                : [],

        synonyms:
            Array.isArray(data.synonyms)
                ? data.synonyms.filter(Boolean)
                : [],

        usage:
            data.usage || ""
    };
}