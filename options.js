const apiKeyInput =
    document.getElementById(
        "apiKey"
    );


const apiKeyStatus =
    document.getElementById(
        "apiKeyStatus"
    );


const testApiKeyButton =
    document.getElementById(
        "testApiKey"
    );


const toggleApiKey =
    document.getElementById(
        "toggleApiKey"
    );


const geminiModel =
    document.getElementById(
        "geminiModel"
    );


const refreshModelsButton =
    document.getElementById(
        "refreshModels"
    );


const modelStatus =
    document.getElementById(
        "modelStatus"
    );


const targetLanguage =
    document.getElementById(
        "targetLanguage"
    );


const saveButton =
    document.getElementById(
        "save"
    );


const status =
    document.getElementById(
        "status"
    );


/*
 * Load current settings
 */
async function loadSettings() {
    const settings =
        await chrome.storage.local.get([
            "geminiApiKey",
            "geminiModel",
            "targetLanguage"
        ]);


    apiKeyInput.value =
        settings.geminiApiKey ||
        "";


    targetLanguage.value =
        settings.targetLanguage ||
        "English";


    if (settings.geminiApiKey) {

        apiKeyStatus.textContent =
            "Saved API key found.";

        await loadModels(
            settings.geminiModel,
            false
        );
    }
}


/*
 * Test API key
 */
async function testApiKey() {
    const apiKey =
        apiKeyInput.value.trim();


    if (!apiKey) {

        setApiStatus(
            "Enter an API key first.",
            "error"
        );

        return false;
    }


    testApiKeyButton.disabled =
        true;


    testApiKeyButton.textContent =
        "Testing…";


    setApiStatus(
        "Checking API key…",
        "normal"
    );


    try {

        /*
         * Background worker needs access
         * to current key for the test.
         */
        await chrome.storage.local.set({
            geminiApiKey:
            apiKey
        });


        const response =
            await chrome.runtime.sendMessage({
                type: "testApiKey"
            });


        if (!response?.success) {
            throw new Error(
                response?.error ||
                "API key test failed."
            );
        }


        setApiStatus(
            `✓ API key is valid. ${response.modelCount} compatible models found.`,
            "success"
        );


        populateModels(
            response.models,
            geminiModel.value
        );


        modelStatus.textContent =
            `${response.modelCount} compatible generateContent models available.`;


        return true;


    } catch (error) {

        console.error(
            "API test failed:",
            error
        );


        setApiStatus(
            `✕ API key test failed: ${getFriendlyError(error.message)}`,
            "error"
        );


        return false;


    } finally {

        testApiKeyButton.disabled =
            false;


        testApiKeyButton.textContent =
            "Test";
    }
}


/*
 * Load models
 */
async function loadModels(
    preferredModel = null,
    showLoading = true
) {
    const apiKey =
        apiKeyInput.value.trim();


    if (!apiKey) {

        modelStatus.textContent =
            "Enter and test your API key first.";

        return;
    }


    refreshModelsButton.disabled =
        true;


    if (showLoading) {

        modelStatus.textContent =
            "Loading available models…";
    }


    try {

        await chrome.storage.local.set({
            geminiApiKey:
            apiKey
        });


        const response =
            await chrome.runtime.sendMessage({
                type: "getModels"
            });


        if (!response?.success) {
            throw new Error(
                response?.error ||
                "Unable to load models."
            );
        }


        populateModels(
            response.models,
            preferredModel
        );


        modelStatus.textContent =
            `${response.models.length} compatible generateContent models available.`;


    } catch (error) {

        console.error(
            "Model loading failed:",
            error
        );


        modelStatus.textContent =
            getFriendlyError(
                error.message
            );


    } finally {

        refreshModelsButton.disabled =
            false;
    }
}


/*
 * Fill model dropdown
 */
function populateModels(
    models,
    preferredModel = null
) {
    geminiModel.innerHTML =
        "";


    if (
        !models ||
        models.length === 0
    ) {

        const option =
            document.createElement(
                "option"
            );


        option.value =
            "";


        option.textContent =
            "No compatible models found";


        geminiModel.appendChild(
            option
        );


        return;
    }


    for (const model of models) {

        const option =
            document.createElement(
                "option"
            );


        option.value =
            model.id;


        option.textContent =
            model.name;


        if (model.description) {
            option.title =
                model.description;
        }


        geminiModel.appendChild(
            option
        );
    }


    /*
     * Restore selected model
     */
    if (
        preferredModel &&
        models.some(
            model =>
                model.id ===
                preferredModel
        )
    ) {

        geminiModel.value =
            preferredModel;

        return;
    }


    /*
     * Prefer a Flash model automatically.
     */
    const preferredFlash =
        models.find(
            model =>
                /flash/i.test(
                    model.id
                )
        );


    if (preferredFlash) {

        geminiModel.value =
            preferredFlash.id;
    }
}


/*
 * Save settings
 */
async function saveSettings() {
    const apiKey =
        apiKeyInput.value.trim();


    const model =
        geminiModel.value;


    const language =
        targetLanguage.value;


    if (!apiKey) {

        setSaveStatus(
            "Enter your Gemini API key.",
            "error"
        );

        return;
    }


    if (!model) {

        setSaveStatus(
            "Select a Gemini model.",
            "error"
        );

        return;
    }


    await chrome.storage.local.set({

        geminiApiKey:
        apiKey,

        geminiModel:
        model,

        targetLanguage:
        language

    });


    setSaveStatus(
        "Saved ✓",
        "success"
    );


    setTimeout(
        () => {

            status.textContent =
                "";

            status.className =
                "";

        },
        2000
    );
}


/*
 * Show/hide key
 */
toggleApiKey.addEventListener(
    "click",
    () => {

        const hidden =
            apiKeyInput.type ===
            "password";


        apiKeyInput.type =
            hidden
                ? "text"
                : "password";


        toggleApiKey.textContent =
            hidden
                ? "Hide"
                : "Show";
    }
);


/*
 * Test key
 */
testApiKeyButton.addEventListener(
    "click",
    testApiKey
);


/*
 * Refresh models
 */
refreshModelsButton.addEventListener(
    "click",
    () => {

        loadModels(
            geminiModel.value,
            true
        );
    }
);


/*
 * Save
 */
saveButton.addEventListener(
    "click",
    saveSettings
);


/*
 * If API key changes,
 * make user test it again.
 */
apiKeyInput.addEventListener(
    "input",
    () => {

        setApiStatus(
            "API key changed. Click Test to verify it.",
            "normal"
        );
    }
);


/*
 * Status helper
 */
function setApiStatus(
    message,
    type
) {
    apiKeyStatus.textContent =
        message;


    apiKeyStatus.className =
        "hint";


    if (type === "success") {
        apiKeyStatus.classList.add(
            "status-success"
        );
    }


    if (type === "error") {
        apiKeyStatus.classList.add(
            "status-error"
        );
    }
}


/*
 * Save status helper
 */
function setSaveStatus(
    message,
    type
) {
    status.textContent =
        message;


    status.className =
        "";


    if (type === "success") {
        status.classList.add(
            "status-success"
        );
    }


    if (type === "error") {
        status.classList.add(
            "status-error"
        );
    }
}


/*
 * Shorten ugly Gemini errors
 */
function getFriendlyError(
    message
) {
    if (
        message.includes(
            "API_KEY_INVALID"
        )
    ) {
        return "The Gemini API key is invalid.";
    }


    if (
        message.includes(
            "PERMISSION_DENIED"
        )
    ) {
        return "The API key does not have permission to use the Gemini API.";
    }


    if (
        message.includes(
            "RESOURCE_EXHAUSTED"
        )
    ) {
        return "Gemini quota has been exceeded.";
    }


    if (
        message.includes(
            "429"
        )
    ) {
        return "Gemini rate limit or quota exceeded.";
    }


    return message;
}


/*
 * Start
 */
loadSettings();