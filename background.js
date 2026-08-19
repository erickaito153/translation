const memoryCache = new Map();

const CACHE_TTL_MS =
    1000 * 60 * 60 * 12;

const GEMINI_TIMEOUT_MS =
    12000;


/*
 * =========================================================
 * MESSAGE ROUTER
 * =========================================================
 */

chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {

        if (!message?.type) {
            return;
        }


        /*
         * Open settings
         */
        if (message.type === "openOptions") {

            chrome.tabs.create({
                url:
                    chrome.runtime.getURL(
                        "options.html"
                    )
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
                        success:
                            true,

                        ...result
                    });
                })
                .catch(error => {

                    console.error(
                        "API key test error:",
                        error
                    );


                    sendResponse({
                        success:
                            false,

                        error:
                        error.message
                    });
                });


            return true;
        }


        /*
         * Get Gemini models
         */
        if (message.type === "getModels") {

            getAvailableModels()
                .then(models => {

                    sendResponse({
                        success:
                            true,

                        models
                    });
                })
                .catch(error => {

                    console.error(
                        "Model loading error:",
                        error
                    );


                    sendResponse({
                        success:
                            false,

                        error:
                        error.message
                    });
                });


            return true;
        }


        /*
         * Translation / dictionary lookup
         */
        if (message.type === "translate") {

            handleTranslation(
                message.text,
                message.targetLanguage
            )
                .then(result => {

                    sendResponse({
                        success:
                            true,

                        result
                    });
                })
                .catch(error => {

                    console.error(
                        "Translation error:",
                        error
                    );


                    sendResponse({
                        success:
                            false,

                        error:
                        error.message
                    });
                });


            return true;
        }
    }
);


/*
 * =========================================================
 * SETTINGS
 * =========================================================
 */

async function getSettings() {

    return chrome.storage.local.get([
        "geminiApiKey",
        "geminiModel",
        "targetLanguage"
    ]);
}


/*
 * =========================================================
 * MODEL DISCOVERY
 * =========================================================
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


    const response =
        await fetchWithTimeout(
            "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",

            {
                method:
                    "GET",

                headers: {
                    "x-goog-api-key":
                    apiKey
                }
            },

            GEMINI_TIMEOUT_MS
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
                ?.includes(
                    "generateContent"
                )
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
                model.description ||
                "",

            inputTokenLimit:
                model.inputTokenLimit ||
                null,

            outputTokenLimit:
                model.outputTokenLimit ||
                null
        }))

        .sort(
            sortModelsForTranslator
        );
}


/*
 * Prefer Flash Lite first,
 * then Flash models.
 */
function sortModelsForTranslator(
    a,
    b
) {

    const aLite =
        /flash.*lite|lite.*flash/i.test(
            a.id
        );


    const bLite =
        /flash.*lite|lite.*flash/i.test(
            b.id
        );


    if (
        aLite &&
        !bLite
    ) {
        return -1;
    }


    if (
        !aLite &&
        bLite
    ) {
        return 1;
    }


    const aFlash =
        /flash/i.test(
            a.id
        );


    const bFlash =
        /flash/i.test(
            b.id
        );


    if (
        aFlash &&
        !bFlash
    ) {
        return -1;
    }


    if (
        !aFlash &&
        bFlash
    ) {
        return 1;
    }


    return a.name.localeCompare(
        b.name
    );
}


/*
 * =========================================================
 * API KEY TEST
 * =========================================================
 */

async function testApiKey() {

    const models =
        await getAvailableModels();


    if (!models.length) {

        throw new Error(
            "The API key is valid, but no compatible generateContent models were found."
        );
    }


    return {
        modelCount:
        models.length,

        models
    };
}


/*
 * =========================================================
 * TRANSLATION HANDLER
 * =========================================================
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
            "Gemini API key is not configured. Open settings."
        );
    }


    if (!model) {

        throw new Error(
            "No Gemini model is selected. Open settings and choose one."
        );
    }


    const cleanText =
        text?.trim();


    if (!cleanText) {

        throw new Error(
            "No text was selected."
        );
    }


    const language =
        normalizeTargetLanguage(
            targetLanguage ||
            settings.targetLanguage ||
            "English"
        );


    const cacheKey =
        createCacheKey(
            cleanText,
            language,
            model
        );


    /*
     * Memory cache
     */
    const memoryResult =
        getMemoryCache(
            cacheKey
        );


    if (memoryResult) {

        return memoryResult;
    }


    /*
     * Persistent cache
     */
    const storedResult =
        await getStoredCache(
            cacheKey
        );


    if (storedResult) {

        setMemoryCache(
            cacheKey,
            storedResult
        );


        return storedResult;
    }


    /*
     * Gemini request
     */
    const result =
        await askGemini(
            cleanText,
            language,
            apiKey,
            model
        );


    /*
     * Save caches
     */
    setMemoryCache(
        cacheKey,
        result
    );


    saveStoredCache(
        cacheKey,
        result
    ).catch(error => {

        console.warn(
            "Unable to persist translation cache:",
            error
        );
    });


    return result;
}


/*
 * =========================================================
 * TARGET LANGUAGE NORMALIZATION
 * =========================================================
 */

function normalizeTargetLanguage(
    language
) {

    const value =
        String(
            language || ""
        )
            .trim()
            .toLowerCase();


    if (
        value === "german" ||
        value === "de" ||
        value === "deutsch"
    ) {

        return "German";
    }


    if (
        value === "vietnamese" ||
        value === "vi" ||
        value === "tiếng việt"
    ) {

        return "Vietnamese";
    }


    return "English";
}


/*
 * =========================================================
 * PROMPT
 * =========================================================
 */

function buildPrompt(
    text,
    targetLanguage
) {

    return `
You are a contextual translation and dictionary assistant.

ORIGINAL SELECTED TEXT:
"${text}"

TARGET LANGUAGE:
${targetLanguage}

Detect the source language automatically.


============================================================
CORE FIELD LANGUAGE RULES
============================================================

Preserve the ORIGINAL SOURCE LANGUAGE for:

- word
- phonetic
- partOfSpeech
- meanings[].examples
- synonyms

Use the TARGET LANGUAGE (${targetLanguage}) for:

- translation
- meanings[].definition
- meanings[].explanation
- usage


============================================================
WORD RULE
============================================================

The "word" field MUST always contain the exact original selected text:

"${text}"

Never translate the "word" field.

Never replace the original selected term with its translation.


Example:

Selected text:
"premise"

Target:
Vietnamese

Correct:

"word": "premise"
"translation": "tiền đề"

Incorrect:

"word": "tiền đề"


============================================================
PRONUNCIATION RULE
============================================================

The "phonetic" field describes the ORIGINAL selected word.

Never provide pronunciation for the translated word.

Example:

Selected:
"premise"

Correct:

"word": "premise"
"phonetic": "/ˈprem.ɪs/"
"translation": "tiền đề"


============================================================
PART OF SPEECH RULE
============================================================

The "partOfSpeech" field describes the ORIGINAL selected word.

Use a normal dictionary-style label appropriate to the source language.

Examples:

noun
verb
adjective
adverb

Do not translate the part-of-speech label merely because the target language changes.


============================================================
TRANSLATION RULE
============================================================

If source language and target language are different:

- mode = "translation"
- translation = natural equivalent in ${targetLanguage}

The translation should preserve:

- contextual meaning
- idiomatic meaning
- tone
- grammatical role


============================================================
DEFINITION RULE
============================================================

meanings[].definition MUST be written in ${targetLanguage}.

The definition should explain the original selected word using the target language.

Return the most contextually useful meaning first.

Prefer one primary meaning.

Use a second meaning only when genuinely useful.


============================================================
EXPLANATION RULE
============================================================

meanings[].explanation MUST be written in ${targetLanguage}.

Use it for:

- nuance
- context
- typical interpretation
- useful distinctions

Keep it concise.


============================================================
EXAMPLE RULE
============================================================

Every item in meanings[].examples MUST stay in the ORIGINAL SOURCE LANGUAGE.

Never translate example sentences into the target language.

The example should naturally demonstrate the ORIGINAL selected term.

The example should actually contain the selected term,
or a grammatically appropriate inflected form of it.

Examples:

Source word:
"premise"

Target:
Vietnamese

Correct example:
"The argument rests on a false premise."

Incorrect example:
"Toàn bộ lập luận dựa trên một tiền đề sai."


Source word:
"compromise"

Target:
German

Correct example:
"They eventually reached a compromise."

Incorrect example:
"Sie einigten sich schließlich auf einen Kompromiss."


============================================================
SYNONYM RULE
============================================================

The "synonyms" array MUST remain in the ORIGINAL SOURCE LANGUAGE.

Never translate synonyms into the target language.

Synonyms must be:

- genuine synonyms
- close semantic alternatives
- relevant to the selected meaning

Do not put the translation itself in the synonym list.

Examples:

Selected:
"premise"

Target:
Vietnamese

Good synonyms:

[
  "assumption",
  "proposition",
  "basis",
  "presupposition"
]

Bad synonyms:

[
  "tiền đề",
  "giả định",
  "cơ sở"
]


Selected:
"psychologist"

Target:
Vietnamese

Good synonyms or close professional alternatives may include:

[
  "therapist",
  "clinician",
  "counselor"
]

Do not translate them into Vietnamese.


============================================================
USAGE RULE
============================================================

The "usage" field MUST be written in ${targetLanguage}.

Explain:

- common constructions
- typical contexts
- register
- useful collocations

When mentioning an original-language expression,
keep that expression in the original language.

Example for English "compromise":

Vietnamese usage may say that the word commonly appears in:

"reach a compromise"

Do not translate the quoted collocation unless needed for explanation.


============================================================
ENGLISH -> ENGLISH
============================================================

If source language is English
AND target language is English:

- mode = "definition"
- word = exact selected English text
- translation = ""
- phonetic = English pronunciation if confidently known
- partOfSpeech = English dictionary label
- definitions = English
- explanations = English
- examples = English
- synonyms = English
- usage = English


============================================================
ENGLISH -> VIETNAMESE
============================================================

If source language is English
AND target language is Vietnamese:

- mode = "translation"
- word = original English term
- phonetic = pronunciation of original English term
- partOfSpeech = English dictionary label
- translation = Vietnamese
- definition = Vietnamese
- explanation = Vietnamese
- example = English
- synonyms = English
- usage = Vietnamese


Example desired structure:

word:
"premise"

phonetic:
"/ˈprem.ɪs/"

partOfSpeech:
"noun"

translation:
"tiền đề"

definition:
Vietnamese explanation of "premise"

example:
"The argument rests on a false premise."

synonyms:
"assumption", "proposition", "basis", "presupposition"

usage:
Vietnamese explanation


============================================================
ENGLISH -> GERMAN
============================================================

If source language is English
AND target language is German:

- mode = "translation"
- word = original English term
- phonetic = pronunciation of original English term
- partOfSpeech = English dictionary label
- translation = German
- definition = German
- explanation = German
- example = English
- synonyms = English
- usage = German


============================================================
GERMAN -> ENGLISH
============================================================

If source language is German
AND target language is English:

- mode = "translation"
- word = original German term
- phonetic = pronunciation of original German term if confidently known
- partOfSpeech = source-language dictionary label
- translation = English
- definition = English
- explanation = English
- example = German
- synonyms = German
- usage = English


============================================================
VIETNAMESE -> ENGLISH
============================================================

If source language is Vietnamese
AND target language is English:

- mode = "translation"
- word = original Vietnamese term
- phonetic = pronunciation only when confidently useful
- partOfSpeech = source-language dictionary label
- translation = English
- definition = English
- explanation = English
- example = Vietnamese
- synonyms = Vietnamese
- usage = English


============================================================
SAME LANGUAGE
============================================================

If source language and target language are the same:

- mode = "definition"
- translation = ""
- word remains unchanged
- definition uses that language
- explanation uses that language
- example uses that language
- synonyms use that language
- usage uses that language


============================================================
CONTENT RULES
============================================================

- Preserve the exact original selected text in "word".
- Give the most relevant contextual meaning.
- Maximum 2 meanings.
- Prefer 1 meaning.
- Maximum 1 example per meaning.
- Maximum 4 synonyms.
- Keep definitions concise.
- Keep explanations concise.
- Keep usage concise.
- Never output Markdown.
- Never use Markdown bullets in field values.
- Never mix languages unless required by the rules above.
`;
}


/*
 * =========================================================
 * STRUCTURED OUTPUT SCHEMA
 * =========================================================
 */

function getResponseSchema() {

    return {

        type:
            "object",

        properties: {

            mode: {

                type:
                    "string",

                enum: [
                    "definition",
                    "translation"
                ]
            },


            sourceLanguage: {

                type:
                    "string"
            },


            targetLanguage: {

                type:
                    "string"
            },


            word: {

                type:
                    "string"
            },


            phonetic: {

                type:
                    "string"
            },


            partOfSpeech: {

                type:
                    "string"
            },


            translation: {

                type:
                    "string"
            },


            meanings: {

                type:
                    "array",

                maxItems:
                    2,

                items: {

                    type:
                        "object",

                    properties: {

                        definition: {

                            type:
                                "string"
                        },


                        explanation: {

                            type:
                                "string"
                        },


                        examples: {

                            type:
                                "array",

                            maxItems:
                                1,

                            items: {

                                type:
                                    "string"
                            }
                        }
                    },

                    required: [
                        "definition",
                        "explanation",
                        "examples"
                    ]
                }
            },


            synonyms: {

                type:
                    "array",

                maxItems:
                    4,

                items: {

                    type:
                        "string"
                }
            },


            usage: {

                type:
                    "string"
            }
        },


        required: [
            "mode",
            "sourceLanguage",
            "targetLanguage",
            "word",
            "phonetic",
            "partOfSpeech",
            "translation",
            "meanings",
            "synonyms",
            "usage"
        ]
    };
}


/*
 * =========================================================
 * GEMINI REQUEST
 * =========================================================
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


    const body = {

        contents: [
            {
                role:
                    "user",

                parts: [
                    {
                        text:
                        prompt
                    }
                ]
            }
        ],


        generationConfig: {

            temperature:
                0.05,

            maxOutputTokens:
                800,

            responseMimeType:
                "application/json",

            responseSchema:
                getResponseSchema()
        }
    };


    addThinkingOptimization(
        body,
        model
    );


    let response =
        await sendGeminiRequest(
            url,
            apiKey,
            body
        );


    /*
     * Retry once without thinking config
     * when the selected model rejects it.
     */
    if (
        !response.ok &&
        body.generationConfig
            .thinkingConfig
    ) {

        const firstError =
            await response.text();


        if (
            /thinking/i.test(
                firstError
            )
        ) {

            delete body
                .generationConfig
                .thinkingConfig;


            response =
                await sendGeminiRequest(
                    url,
                    apiKey,
                    body
                );


        } else {

            throw new Error(
                `Gemini API error ${response.status}: ${firstError}`
            );
        }
    }


    if (!response.ok) {

        const errorText =
            await response.text();


        throw new Error(
            `Gemini API error ${response.status}: ${errorText}`
        );
    }


    const data =
        await response.json();


    const candidate =
        data.candidates?.[0];


    const finishReason =
        candidate?.finishReason;


    let raw =
        candidate
            ?.content?.parts
            ?.map(
                part =>
                    part.text ||
                    ""
            )
            .join("")
            .trim();


    if (!raw) {

        console.error(
            "Empty Gemini response:",
            data
        );


        throw new Error(
            "Gemini returned no usable response."
        );
    }


    if (
        finishReason &&
        finishReason !==
        "STOP"
    ) {

        console.warn(
            "Gemini finish reason:",
            finishReason
        );
    }


    /*
     * Defensive cleanup.
     */
    raw =
        raw
            .replace(
                /^```json\s*/i,
                ""
            )
            .replace(
                /^```\s*/i,
                ""
            )
            .replace(
                /\s*```$/i,
                ""
            )
            .trim();


    try {

        const parsed =
            JSON.parse(
                raw
            );


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
            "Gemini returned invalid structured data."
        );
    }
}


/*
 * =========================================================
 * THINKING OPTIMIZATION
 * =========================================================
 */

function addThinkingOptimization(
    body,
    model
) {

    /*
     * Gemini 3 family
     */
    if (
        /gemini-3/i.test(
            model
        )
    ) {

        body.generationConfig
            .thinkingConfig = {

            thinkingLevel:
                "low"
        };


        return;
    }


    /*
     * Gemini 2.5 Flash family
     */
    if (
        /gemini-2\.5.*flash/i.test(
            model
        )
    ) {

        body.generationConfig
            .thinkingConfig = {

            thinkingBudget:
                0
        };
    }
}


/*
 * =========================================================
 * GEMINI HTTP REQUEST
 * =========================================================
 */

async function sendGeminiRequest(
    url,
    apiKey,
    body
) {

    return fetchWithTimeout(
        url,

        {
            method:
                "POST",

            headers: {

                "Content-Type":
                    "application/json",

                "x-goog-api-key":
                apiKey
            },

            body:
                JSON.stringify(
                    body
                )
        },

        GEMINI_TIMEOUT_MS
    );
}


/*
 * =========================================================
 * FETCH TIMEOUT
 * =========================================================
 */

async function fetchWithTimeout(
    url,
    options,
    timeoutMs
) {

    const controller =
        new AbortController();


    const timer =
        setTimeout(
            () => {

                controller.abort();
            },

            timeoutMs
        );


    try {

        return await fetch(
            url,

            {
                ...options,

                signal:
                controller.signal
            }
        );


    } catch (error) {

        if (
            error.name ===
            "AbortError"
        ) {

            throw new Error(
                "Gemini request timed out."
            );
        }


        throw error;


    } finally {

        clearTimeout(
            timer
        );
    }
}


/*
 * =========================================================
 * NORMALIZE RESULT
 * =========================================================
 */

function normalizeResult(
    data,
    selectedText,
    targetLanguage
) {

    const sourceLanguage =
        String(
            data.sourceLanguage ||
            ""
        )
            .trim();


    const sameLanguage =
        isSameLanguage(
            sourceLanguage,
            targetLanguage
        );


    /*
     * Determine mode ourselves.
     */
    const mode =
        sameLanguage
            ? "definition"
            : "translation";


    return {

        mode,


        sourceLanguage,


        /*
         * Always trust the dropdown,
         * not Gemini's returned target.
         */
        targetLanguage,


        /*
         * The original highlighted value
         * is always the dictionary heading.
         */
        word:
        selectedText,


        /*
         * Pronunciation belongs to
         * the original term.
         */
        phonetic:
            sanitizeText(
                data.phonetic
            ),


        /*
         * Part of speech belongs to
         * the original term.
         */
        partOfSpeech:
            sanitizeText(
                data.partOfSpeech
            ),


        /*
         * Translation only for
         * different languages.
         */
        translation:
            mode ===
            "translation"

                ? sanitizeText(
                    data.translation
                )

                : "",


        meanings:
            normalizeMeanings(
                data.meanings
            ),


        /*
         * Synonyms are intentionally
         * left exactly as Gemini returns
         * them because the prompt requires
         * the original source language.
         */
        synonyms:
            normalizeSynonyms(
                data.synonyms
            ),


        usage:
            sanitizeText(
                data.usage
            )
    };
}


/*
 * =========================================================
 * NORMALIZE MEANINGS
 * =========================================================
 */

function normalizeMeanings(
    meanings
) {

    if (
        !Array.isArray(
            meanings
        )
    ) {

        return [];
    }


    return meanings
        .slice(
            0,
            2
        )
        .map(
            meaning => ({

                definition:
                    sanitizeText(
                        meaning?.definition
                    ),

                explanation:
                    sanitizeText(
                        meaning?.explanation
                    ),

                /*
                 * Example remains in
                 * the source language.
                 */
                examples:
                    Array.isArray(
                        meaning?.examples
                    )

                        ? meaning.examples
                            .map(
                                sanitizeText
                            )
                            .filter(Boolean)
                            .slice(
                                0,
                                1
                            )

                        : []
            })
        );
}


/*
 * =========================================================
 * NORMALIZE SYNONYMS
 * =========================================================
 */

function normalizeSynonyms(
    synonyms
) {

    if (
        !Array.isArray(
            synonyms
        )
    ) {

        return [];
    }


    const cleaned =
        synonyms
            .map(
                sanitizeText
            )
            .filter(Boolean);


    /*
     * Avoid duplicate synonyms.
     */
    const unique =
        [];


    const seen =
        new Set();


    for (
        const synonym
        of cleaned
        ) {

        const key =
            synonym.toLocaleLowerCase();


        if (
            seen.has(
                key
            )
        ) {

            continue;
        }


        seen.add(
            key
        );


        unique.push(
            synonym
        );


        if (
            unique.length >=
            4
        ) {

            break;
        }
    }


    return unique;
}


/*
 * =========================================================
 * TEXT SANITIZATION
 * =========================================================
 */

function sanitizeText(
    value
) {

    if (
        typeof value !==
        "string"
    ) {

        return "";
    }


    return value
        .trim();
}


/*
 * =========================================================
 * SAME-LANGUAGE DETECTION
 * =========================================================
 */

function isSameLanguage(
    sourceLanguage,
    targetLanguage
) {

    const source =
        String(
            sourceLanguage ||
            ""
        )
            .toLowerCase()
            .trim();


    const target =
        String(
            targetLanguage ||
            ""
        )
            .toLowerCase()
            .trim();


    /*
     * English
     */
    if (
        target ===
        "english"
    ) {

        return (
            source.includes(
                "english"
            ) ||
            source ===
            "en"
        );
    }


    /*
     * German
     */
    if (
        target ===
        "german"
    ) {

        return (
            source.includes(
                "german"
            ) ||
            source.includes(
                "deutsch"
            ) ||
            source ===
            "de"
        );
    }


    /*
     * Vietnamese
     */
    if (
        target ===
        "vietnamese"
    ) {

        return (
            source.includes(
                "vietnamese"
            ) ||
            source.includes(
                "tiếng việt"
            ) ||
            source ===
            "vi"
        );
    }


    return false;
}


/*
 * =========================================================
 * CACHE KEY
 * =========================================================
 */

function createCacheKey(
    text,
    targetLanguage,
    model
) {

    /*
     * Increment this whenever prompt
     * behavior changes.
     *
     * This automatically prevents old
     * cached translated examples/synonyms
     * from being reused.
     */
    const promptVersion =
        "v6-source-examples-synonyms";


    return [
        "dragTranslator",
        promptVersion,
        model,
        targetLanguage,

        text
            .toLowerCase()
            .replace(
                /\s+/g,
                " "
            )

    ].join(
        "::"
    );
}


/*
 * =========================================================
 * MEMORY CACHE
 * =========================================================
 */

function getMemoryCache(
    key
) {

    const cached =
        memoryCache.get(
            key
        );


    if (!cached) {

        return null;
    }


    if (
        Date.now() -
        cached.timestamp >
        CACHE_TTL_MS
    ) {

        memoryCache.delete(
            key
        );


        return null;
    }


    return cached.result;
}


function setMemoryCache(
    key,
    result
) {

    memoryCache.set(
        key,

        {
            timestamp:
                Date.now(),

            result
        }
    );


    /*
     * Prevent unlimited growth.
     */
    if (
        memoryCache.size >
        100
    ) {

        const firstKey =
            memoryCache
                .keys()
                .next()
                .value;


        memoryCache.delete(
            firstKey
        );
    }
}


/*
 * =========================================================
 * PERSISTENT CACHE
 * =========================================================
 */

async function getStoredCache(
    key
) {

    const storageKey =
        hashCacheKey(
            key
        );


    const data =
        await chrome.storage.local.get(
            storageKey
        );


    const cached =
        data[
            storageKey
            ];


    if (!cached) {

        return null;
    }


    if (
        Date.now() -
        cached.timestamp >
        CACHE_TTL_MS
    ) {

        await chrome.storage.local.remove(
            storageKey
        );


        return null;
    }


    return cached.result;
}


async function saveStoredCache(
    key,
    result
) {

    const storageKey =
        hashCacheKey(
            key
        );


    await chrome.storage.local.set({

        [storageKey]: {

            timestamp:
                Date.now(),

            result
        }
    });
}


/*
 * =========================================================
 * CACHE HASH
 * =========================================================
 */

function hashCacheKey(
    value
) {

    let hash =
        2166136261;


    for (
        let i = 0;
        i < value.length;
        i++
    ) {

        hash ^=
            value.charCodeAt(
                i
            );


        hash =
            Math.imul(
                hash,
                16777619
            );
    }


    return (
        "dt_cache_" +
        (hash >>> 0)
            .toString(
                16
            )
    );
}