let translateButton = null;
let translationPopup = null;

let selectedText = "";
let selectionRect = null;
let selectionRange = null;

let currentRequestId = 0;

const LOOKUP_TIMEOUT_MS = 15000;
const STORAGE_TIMEOUT_MS = 1500;


/*
 * =========================================================
 * TEXT SELECTION
 * =========================================================
 */

document.addEventListener(
    "mouseup",
    event => {

        if (
            translateButton?.contains(event.target) ||
            translationPopup?.contains(event.target)
        ) {
            return;
        }


        setTimeout(
            handleSelection,
            20
        );
    }
);


/*
 * Close only when clicking outside
 */
document.addEventListener(
    "mousedown",
    event => {

        if (
            translateButton?.contains(event.target) ||
            translationPopup?.contains(event.target)
        ) {
            return;
        }


        removeUI();
    }
);


/*
 * =========================================================
 * VIEWPORT CHANGES
 * =========================================================
 */

/*
 * Recalculate anchor after resizing.
 */
window.addEventListener(
    "resize",
    () => {

        updateSelectionRect();


        if (translationPopup) {
            positionPopup();
        }


        if (translateButton) {
            positionTranslateButton();
        }
    }
);


/*
 * IMPORTANT:
 *
 * Scrolling NO LONGER closes the popup.
 *
 * Instead:
 * - update selected text position
 * - keep button anchored
 * - keep popup anchored
 *
 * Ignore scrolling inside the popup itself.
 */
window.addEventListener(
    "scroll",
    event => {

        if (
            translationPopup &&
            event.target instanceof Node &&
            translationPopup.contains(event.target)
        ) {
            return;
        }


        updateSelectionRect();


        if (translationPopup) {
            positionPopup();
        }


        if (translateButton) {
            positionTranslateButton();
        }
    },
    true
);


/*
 * =========================================================
 * HANDLE SELECTION
 * =========================================================
 */

function handleSelection() {

    const selection =
        window.getSelection();


    if (
        !selection ||
        selection.rangeCount === 0
    ) {
        return;
    }


    const text =
        selection
            .toString()
            .trim();


    if (!text) {
        return;
    }


    const range =
        selection.getRangeAt(0);


    const rect =
        range.getBoundingClientRect();


    if (
        rect.width === 0 &&
        rect.height === 0
    ) {
        return;
    }


    selectedText =
        text;


    /*
     * Store an independent copy of
     * the actual selected DOM range.
     *
     * This lets us calculate its
     * new position after scrolling.
     */
    selectionRange =
        range.cloneRange();


    updateSelectionRect();


    showTranslateButton();
}


/*
 * =========================================================
 * UPDATE SELECTION POSITION
 * =========================================================
 */

function updateSelectionRect() {

    if (!selectionRange) {
        return false;
    }


    try {

        const rect =
            selectionRange
                .getBoundingClientRect();


        /*
         * The DOM node may have been
         * removed or become invalid.
         */
        if (
            !Number.isFinite(rect.left) ||
            !Number.isFinite(rect.top)
        ) {
            return false;
        }


        selectionRect = {
            left:
            rect.left,

            right:
            rect.right,

            top:
            rect.top,

            bottom:
            rect.bottom,

            width:
            rect.width,

            height:
            rect.height
        };


        return true;


    } catch (error) {

        console.warn(
            "Unable to update selection position:",
            error
        );


        return false;
    }
}


/*
 * =========================================================
 * FLOATING TRANSLATE BUTTON
 * =========================================================
 */

function showTranslateButton() {

    translateButton?.remove();


    translateButton =
        document.createElement(
            "button"
        );


    translateButton.className =
        "drag-translator-button";


    translateButton.type =
        "button";


    translateButton.textContent =
        "🌐";


    translateButton.title =
        "Translate selected text";


    translateButton.style.position =
        "fixed";


    document.body.appendChild(
        translateButton
    );


    positionTranslateButton();


    /*
     * Preserve page text selection.
     */
    translateButton.addEventListener(
        "mousedown",
        event => {

            event.preventDefault();
            event.stopPropagation();
        }
    );


    translateButton.addEventListener(
        "click",
        event => {

            event.preventDefault();
            event.stopPropagation();


            showTranslationPopup();
        }
    );
}


/*
 * =========================================================
 * POSITION TRANSLATE BUTTON
 * =========================================================
 */

function positionTranslateButton() {

    if (
        !translateButton ||
        !selectionRect
    ) {
        return;
    }


    const buttonSize =
        34;


    const gap =
        7;


    const padding =
        8;


    /*
     * Hide button if selected text has
     * moved very far outside viewport.
     */
    if (
        selectionRect.bottom < -100 ||
        selectionRect.top >
        window.innerHeight + 100
    ) {

        translateButton.style.display =
            "none";

        return;
    }


    translateButton.style.display =
        "";


    let left =
        selectionRect.right +
        gap;


    let top =
        selectionRect.bottom +
        gap;


    /*
     * Flip horizontally when needed.
     */
    if (
        left + buttonSize >
        window.innerWidth -
        padding
    ) {

        left =
            selectionRect.left -
            buttonSize -
            gap;
    }


    /*
     * Flip vertically when needed.
     */
    if (
        top + buttonSize >
        window.innerHeight -
        padding
    ) {

        top =
            selectionRect.top -
            buttonSize -
            gap;
    }


    left =
        Math.max(
            padding,
            Math.min(
                left,
                window.innerWidth -
                buttonSize -
                padding
            )
        );


    top =
        Math.max(
            padding,
            Math.min(
                top,
                window.innerHeight -
                buttonSize -
                padding
            )
        );


    translateButton.style.left =
        `${Math.round(left)}px`;


    translateButton.style.top =
        `${Math.round(top)}px`;
}


/*
 * =========================================================
 * POPUP
 * =========================================================
 */

async function showTranslationPopup() {

    translateButton?.remove();

    translateButton =
        null;


    translationPopup?.remove();


    translationPopup =
        document.createElement(
            "div"
        );


    translationPopup.className =
        "drag-translator-popup";


    translationPopup.style.position =
        "fixed";


    translationPopup.innerHTML = `
        <div class="dt-anchor-arrow"></div>

        <div class="dt-header">

            <select
                class="dt-language"
                aria-label="Target language"
            >
                <option value="German">
                    🇩🇪 German
                </option>

                <option value="English">
                    🇬🇧 English
                </option>

                <option value="Vietnamese">
                    🇻🇳 Vietnamese
                </option>
            </select>


            <div class="dt-header-actions">

                <button
                    class="dt-settings"
                    type="button"
                    title="Settings"
                    aria-label="Settings"
                >
                    ⚙
                </button>

                <button
                    class="dt-close"
                    type="button"
                    title="Close"
                    aria-label="Close"
                >
                    ×
                </button>

            </div>

        </div>


        <div class="dt-original"></div>


        <div class="dt-result"></div>
    `;


    document.body.appendChild(
        translationPopup
    );


    const originalElement =
        translationPopup.querySelector(
            ".dt-original"
        );


    const dropdown =
        translationPopup.querySelector(
            ".dt-language"
        );


    const closeButton =
        translationPopup.querySelector(
            ".dt-close"
        );


    const settingsButton =
        translationPopup.querySelector(
            ".dt-settings"
        );


    originalElement.textContent =
        selectedText;


    /*
     * Short words already appear
     * in the dictionary heading.
     */
    if (
        isShortTerm(
            selectedText
        )
    ) {

        originalElement.classList.add(
            "dt-original-hidden"
        );
    }


    showLoading(
        translationPopup.querySelector(
            ".dt-result"
        ),
        "Preparing…"
    );


    updateSelectionRect();


    requestAnimationFrame(
        positionPopup
    );


    /*
     * =====================================================
     * LOAD SAVED TARGET LANGUAGE
     * =====================================================
     */

    let savedLanguage =
        "English";


    try {

        ensureExtensionContext();


        const settings =
            await getStorageWithTimeout(
                [
                    "targetLanguage"
                ],
                STORAGE_TIMEOUT_MS
            );


        savedLanguage =
            settings.targetLanguage ||
            "English";


    } catch (error) {

        console.warn(
            "Unable to load target language. Using English.",
            error
        );
    }


    if (!translationPopup) {
        return;
    }


    dropdown.value =
        savedLanguage;


    /*
     * Perform lookup.
     */
    translateSelectedText(
        savedLanguage
    );


    /*
     * Target language changed.
     */
    dropdown.addEventListener(
        "change",
        () => {

            const language =
                dropdown.value;


            setStorageSafely({
                targetLanguage:
                language
            });


            translateSelectedText(
                language
            );
        }
    );


    /*
     * Explicit close button.
     */
    closeButton.addEventListener(
        "click",
        event => {

            event.preventDefault();
            event.stopPropagation();

            removeUI();
        }
    );


    settingsButton.addEventListener(
        "click",
        event => {

            event.preventDefault();
            event.stopPropagation();

            openSettings();
        }
    );
}


/*
 * =========================================================
 * SHORT TERM DETECTION
 * =========================================================
 */

function isShortTerm(
    text
) {

    const words =
        text
            .trim()
            .split(/\s+/);


    return (
        words.length <= 6 &&
        text.length <= 70
    );
}


/*
 * =========================================================
 * SETTINGS
 * =========================================================
 */

async function openSettings() {

    try {

        ensureExtensionContext();


        await sendMessageWithTimeout(
            {
                type:
                    "openOptions"
            },

            3000
        );


    } catch (error) {

        if (
            isContextInvalidError(
                error
            )
        ) {

            showReloadNotice();

            return;
        }


        console.error(
            "Unable to open settings:",
            error
        );
    }
}


/*
 * =========================================================
 * LOOKUP
 * =========================================================
 */

async function translateSelectedText(
    targetLanguage
) {

    if (!translationPopup) {
        return;
    }


    const requestId =
        ++currentRequestId;


    const resultElement =
        translationPopup.querySelector(
            ".dt-result"
        );


    showLoading(
        resultElement,
        "Contacting Gemini…"
    );


    try {

        ensureExtensionContext();


        const response =
            await sendMessageWithTimeout(
                {
                    type:
                        "translate",

                    text:
                    selectedText,

                    targetLanguage
                },

                LOOKUP_TIMEOUT_MS
            );


        /*
         * Ignore an old response after
         * switching target language.
         */
        if (
            requestId !==
            currentRequestId
        ) {
            return;
        }


        if (!response) {

            throw new Error(
                "The extension returned no response."
            );
        }


        if (!response.success) {

            throw new Error(
                response.error ||
                "Lookup failed."
            );
        }


        if (
            !translationPopup ||
            !resultElement
        ) {
            return;
        }


        renderDictionaryResult(
            resultElement,
            response.result
        );


        /*
         * Result size changed.
         */
        requestAnimationFrame(
            () => {

                updateSelectionRect();

                positionPopup();
            }
        );


    } catch (error) {

        if (
            requestId !==
            currentRequestId
        ) {
            return;
        }


        if (
            isContextInvalidError(
                error
            )
        ) {

            showReloadNotice();

            return;
        }


        console.error(
            "Lookup failed:",
            error
        );


        if (!translationPopup) {
            return;
        }


        renderError(
            resultElement,
            error
        );


        requestAnimationFrame(
            positionPopup
        );
    }
}


/*
 * =========================================================
 * MESSAGE TIMEOUT
 * =========================================================
 */

function sendMessageWithTimeout(
    message,
    timeoutMs
) {

    return new Promise(
        (resolve, reject) => {

            let finished =
                false;


            const timer =
                setTimeout(
                    () => {

                        if (finished) {
                            return;
                        }


                        finished =
                            true;


                        reject(
                            new Error(
                                message.type ===
                                "translate"

                                    ? "Lookup timed out. Gemini did not respond in time."

                                    : "Extension request timed out."
                            )
                        );
                    },

                    timeoutMs
                );


            try {

                chrome.runtime.sendMessage(
                    message,
                    response => {

                        if (finished) {
                            return;
                        }


                        finished =
                            true;


                        clearTimeout(
                            timer
                        );


                        if (
                            chrome.runtime.lastError
                        ) {

                            reject(
                                new Error(
                                    chrome.runtime
                                        .lastError
                                        .message
                                )
                            );

                            return;
                        }


                        resolve(
                            response
                        );
                    }
                );


            } catch (error) {

                if (finished) {
                    return;
                }


                finished =
                    true;


                clearTimeout(
                    timer
                );


                reject(
                    error
                );
            }
        }
    );
}


/*
 * =========================================================
 * STORAGE HELPERS
 * =========================================================
 */

function getStorageWithTimeout(
    keys,
    timeoutMs
) {

    return new Promise(
        (resolve, reject) => {

            let finished =
                false;


            const timer =
                setTimeout(
                    () => {

                        if (finished) {
                            return;
                        }


                        finished =
                            true;


                        reject(
                            new Error(
                                "Extension storage timed out."
                            )
                        );
                    },

                    timeoutMs
                );


            try {

                chrome.storage.local.get(
                    keys,
                    result => {

                        if (finished) {
                            return;
                        }


                        finished =
                            true;


                        clearTimeout(
                            timer
                        );


                        if (
                            chrome.runtime.lastError
                        ) {

                            reject(
                                new Error(
                                    chrome.runtime
                                        .lastError
                                        .message
                                )
                            );

                            return;
                        }


                        resolve(
                            result || {}
                        );
                    }
                );


            } catch (error) {

                if (finished) {
                    return;
                }


                finished =
                    true;


                clearTimeout(
                    timer
                );


                reject(
                    error
                );
            }
        }
    );
}


/*
 * Save without blocking translation.
 */
function setStorageSafely(
    values
) {

    try {

        chrome.storage.local.set(
            values,
            () => {

                if (
                    chrome.runtime.lastError
                ) {

                    console.warn(
                        "Unable to save settings:",
                        chrome.runtime
                            .lastError
                            .message
                    );
                }
            }
        );


    } catch (error) {

        console.warn(
            "Unable to save settings:",
            error
        );
    }
}


/*
 * =========================================================
 * LOADING UI
 * =========================================================
 */

function showLoading(
    container,
    message = "Looking up…"
) {

    if (!container) {
        return;
    }


    container.innerHTML = `
        <div class="dt-loading">
            <span class="dt-spinner"></span>
            <span class="dt-loading-text"></span>
        </div>
    `;


    const text =
        container.querySelector(
            ".dt-loading-text"
        );


    if (text) {

        text.textContent =
            message;
    }
}


/*
 * =========================================================
 * DICTIONARY RENDERER
 * =========================================================
 */

function renderDictionaryResult(
    container,
    data
) {

    container.innerHTML =
        "";


    if (!data) {

        throw new Error(
            "No dictionary result was returned."
        );
    }


    /*
     * =====================================================
     * ENTRY HEADER
     * =====================================================
     */

    const entryHeader =
        document.createElement(
            "div"
        );


    entryHeader.className =
        "dt-entry-header";


    const titleRow =
        document.createElement(
            "div"
        );


    titleRow.className =
        "dt-title-row";


    const title =
        document.createElement(
            "div"
        );


    title.className =
        "dt-word";


    /*
     * ALWAYS original highlighted term.
     */
    title.textContent =
        data.word ||
        selectedText;


    titleRow.appendChild(
        title
    );


    /*
     * Pronunciation of original term.
     */
    if (data.phonetic) {

        const pronunciation =
            document.createElement(
                "div"
            );


        pronunciation.className =
            "dt-phonetic";


        pronunciation.textContent =
            data.phonetic;


        titleRow.appendChild(
            pronunciation
        );
    }


    entryHeader.appendChild(
        titleRow
    );


    /*
     * Part of speech
     */
    if (data.partOfSpeech) {

        const partOfSpeech =
            document.createElement(
                "div"
            );


        partOfSpeech.className =
            "dt-part-of-speech";


        partOfSpeech.textContent =
            data.partOfSpeech;


        entryHeader.appendChild(
            partOfSpeech
        );
    }


    /*
     * Translated equivalent goes
     * below original word.
     */
    if (
        data.mode ===
        "translation" &&
        data.translation
    ) {

        const translation =
            document.createElement(
                "div"
            );


        translation.className =
            "dt-translation";


        translation.textContent =
            data.translation;


        entryHeader.appendChild(
            translation
        );
    }


    container.appendChild(
        entryHeader
    );


    /*
     * =====================================================
     * MEANINGS
     * =====================================================
     */

    if (
        Array.isArray(
            data.meanings
        ) &&
        data.meanings.length > 0
    ) {

        const meaningsContainer =
            document.createElement(
                "div"
            );


        meaningsContainer.className =
            "dt-meanings";


        data.meanings.forEach(
            (meaning, index) => {

                if (
                    !meaning?.definition &&
                    !meaning?.explanation &&
                    !meaning?.examples?.length
                ) {
                    return;
                }


                const meaningBlock =
                    document.createElement(
                        "div"
                    );


                meaningBlock.className =
                    "dt-meaning";


                /*
                 * Definition
                 */
                if (
                    meaning.definition
                ) {

                    const definitionRow =
                        document.createElement(
                            "div"
                        );


                    definitionRow.className =
                        "dt-definition-row";


                    const number =
                        document.createElement(
                            "span"
                        );


                    number.className =
                        "dt-meaning-number";


                    number.textContent =
                        `${index + 1}`;


                    const definition =
                        document.createElement(
                            "div"
                        );


                    definition.className =
                        "dt-definition";


                    definition.textContent =
                        meaning.definition;


                    definitionRow.append(
                        number,
                        definition
                    );


                    meaningBlock.appendChild(
                        definitionRow
                    );
                }


                /*
                 * Explanation
                 */
                if (
                    meaning.explanation
                ) {

                    const explanation =
                        document.createElement(
                            "div"
                        );


                    explanation.className =
                        "dt-explanation";


                    explanation.textContent =
                        meaning.explanation;


                    meaningBlock.appendChild(
                        explanation
                    );
                }


                /*
                 * Examples
                 */
                if (
                    Array.isArray(
                        meaning.examples
                    )
                ) {

                    meaning.examples
                        .filter(Boolean)
                        .forEach(
                            example => {

                                const exampleElement =
                                    document.createElement(
                                        "div"
                                    );


                                exampleElement.className =
                                    "dt-example";


                                exampleElement.textContent =
                                    example;


                                meaningBlock.appendChild(
                                    exampleElement
                                );
                            }
                        );
                }


                meaningsContainer.appendChild(
                    meaningBlock
                );
            }
        );


        if (
            meaningsContainer
                .children
                .length
        ) {

            container.appendChild(
                meaningsContainer
            );
        }
    }


    /*
     * =====================================================
     * SYNONYMS
     * =====================================================
     */

    if (
        Array.isArray(
            data.synonyms
        ) &&
        data.synonyms
            .filter(Boolean)
            .length
    ) {

        const section =
            document.createElement(
                "div"
            );


        section.className =
            "dt-extra-section";


        const heading =
            createSectionTitle(
                "Synonyms"
            );


        const chips =
            document.createElement(
                "div"
            );


        chips.className =
            "dt-synonyms";


        data.synonyms
            .filter(Boolean)
            .forEach(
                word => {

                    const chip =
                        document.createElement(
                            "span"
                        );


                    chip.className =
                        "dt-synonym-chip";


                    chip.textContent =
                        word;


                    chips.appendChild(
                        chip
                    );
                }
            );


        section.append(
            heading,
            chips
        );


        container.appendChild(
            section
        );
    }


    /*
     * =====================================================
     * USAGE
     * =====================================================
     */

    if (data.usage) {

        const section =
            document.createElement(
                "div"
            );


        section.className =
            "dt-extra-section";


        const heading =
            createSectionTitle(
                "Usage"
            );


        const usage =
            document.createElement(
                "div"
            );


        usage.className =
            "dt-usage-text";


        usage.textContent =
            data.usage;


        section.append(
            heading,
            usage
        );


        container.appendChild(
            section
        );
    }
}


/*
 * =========================================================
 * SECTION TITLE
 * =========================================================
 */

function createSectionTitle(
    text
) {

    const heading =
        document.createElement(
            "div"
        );


    heading.className =
        "dt-section-title";


    heading.textContent =
        text;


    return heading;
}


/*
 * =========================================================
 * ERROR UI
 * =========================================================
 */

function renderError(
    container,
    error
) {

    if (!container) {
        return;
    }


    container.innerHTML =
        "";


    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "dt-error";


    const title =
        document.createElement(
            "div"
        );


    title.className =
        "dt-error-title";


    title.textContent =
        "Lookup failed";


    const message =
        document.createElement(
            "div"
        );


    message.className =
        "dt-error-message";


    message.textContent =
        error?.message ||
        "Something went wrong.";


    const retryButton =
        document.createElement(
            "button"
        );


    retryButton.className =
        "dt-open-settings";


    retryButton.type =
        "button";


    retryButton.textContent =
        "Try again";


    retryButton.addEventListener(
        "click",
        () => {

            const dropdown =
                translationPopup
                    ?.querySelector(
                        ".dt-language"
                    );


            if (!dropdown) {
                return;
            }


            translateSelectedText(
                dropdown.value
            );
        }
    );


    wrapper.append(
        title,
        message,
        retryButton
    );


    container.appendChild(
        wrapper
    );
}


/*
 * =========================================================
 * EXTENSION CONTEXT
 * =========================================================
 */

function ensureExtensionContext() {

    try {

        if (
            !chrome ||
            !chrome.runtime ||
            !chrome.runtime.id
        ) {

            throw new Error(
                "Extension context invalidated."
            );
        }


    } catch {

        throw new Error(
            "Extension context invalidated."
        );
    }
}


function isContextInvalidError(
    error
) {

    try {

        return (
            error?.message?.includes(
                "Extension context invalidated"
            ) ||

            !chrome?.runtime?.id
        );


    } catch {

        return true;
    }
}


/*
 * =========================================================
 * RELOAD NOTICE
 * =========================================================
 */

function showReloadNotice() {

    if (!translationPopup) {
        return;
    }


    const result =
        translationPopup.querySelector(
            ".dt-result"
        );


    if (!result) {
        return;
    }


    result.innerHTML =
        "";


    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "dt-error";


    const title =
        document.createElement(
            "div"
        );


    title.className =
        "dt-error-title";


    title.textContent =
        "Extension updated";


    const message =
        document.createElement(
            "div"
        );


    message.className =
        "dt-error-message";


    message.textContent =
        "Refresh this webpage to use the latest version of Drag Translator.";


    const button =
        document.createElement(
            "button"
        );


    button.className =
        "dt-open-settings";


    button.type =
        "button";


    button.textContent =
        "Refresh page";


    button.addEventListener(
        "click",
        () => {

            window.location.reload();
        }
    );


    wrapper.append(
        title,
        message,
        button
    );


    result.appendChild(
        wrapper
    );


    requestAnimationFrame(
        positionPopup
    );
}


/*
 * =========================================================
 * ANCHORED POPUP POSITION
 * =========================================================
 */

function positionPopup() {

    if (
        !translationPopup ||
        !selectionRect
    ) {
        return;
    }


    const gap =
        12;


    const viewportPadding =
        12;


    const popupRect =
        translationPopup
            .getBoundingClientRect();


    const popupWidth =
        popupRect.width ||
        410;


    const popupHeight =
        popupRect.height ||
        360;


    /*
     * Center of highlighted term.
     */
    let anchorX =
        selectionRect.left +
        selectionRect.width / 2;


    /*
     * If the selected text has moved
     * above/below viewport, anchor the
     * popup to the nearest viewport edge.
     *
     * The popup remains open.
     */
    const selectionAbove =
        selectionRect.bottom < 0;


    const selectionBelow =
        selectionRect.top >
        window.innerHeight;


    /*
     * =====================================================
     * HIGHLIGHT IS ABOVE VIEWPORT
     * =====================================================
     */

    if (selectionAbove) {

        const left =
            clampPopupLeft(
                anchorX -
                popupWidth / 2,
                popupWidth,
                viewportPadding
            );


        const top =
            viewportPadding;


        translationPopup.style.left =
            `${Math.round(left)}px`;


        translationPopup.style.top =
            `${Math.round(top)}px`;


        /*
         * No useful visual connection
         * to an off-screen element.
         */
        hideAnchorArrow();


        return;
    }


    /*
     * =====================================================
     * HIGHLIGHT IS BELOW VIEWPORT
     * =====================================================
     */

    if (selectionBelow) {

        const left =
            clampPopupLeft(
                anchorX -
                popupWidth / 2,
                popupWidth,
                viewportPadding
            );


        const top =
            Math.max(
                viewportPadding,
                window.innerHeight -
                popupHeight -
                viewportPadding
            );


        translationPopup.style.left =
            `${Math.round(left)}px`;


        translationPopup.style.top =
            `${Math.round(top)}px`;


        hideAnchorArrow();


        return;
    }


    /*
     * =====================================================
     * HIGHLIGHT IS VISIBLE
     * =====================================================
     */

    const spaceBelow =
        window.innerHeight -
        selectionRect.bottom;


    const spaceAbove =
        selectionRect.top;


    let placement =
        "bottom";


    let top =
        selectionRect.bottom +
        gap;


    /*
     * Flip popup above the selected
     * text when more room is available.
     */
    if (
        spaceBelow <
        popupHeight +
        gap +
        viewportPadding &&
        spaceAbove >
        spaceBelow
    ) {

        placement =
            "top";


        top =
            selectionRect.top -
            popupHeight -
            gap;
    }


    let left =
        anchorX -
        popupWidth / 2;


    left =
        clampPopupLeft(
            left,
            popupWidth,
            viewportPadding
        );


    top =
        Math.max(
            viewportPadding,
            Math.min(
                top,
                window.innerHeight -
                popupHeight -
                viewportPadding
            )
        );


    translationPopup.style.left =
        `${Math.round(left)}px`;


    translationPopup.style.top =
        `${Math.round(top)}px`;


    positionAnchorArrow(
        anchorX,
        left,
        placement
    );
}


/*
 * =========================================================
 * POPUP HORIZONTAL CLAMP
 * =========================================================
 */

function clampPopupLeft(
    left,
    popupWidth,
    padding
) {

    return Math.max(
        padding,
        Math.min(
            left,
            window.innerWidth -
            popupWidth -
            padding
        )
    );
}


/*
 * =========================================================
 * ANCHOR ARROW
 * =========================================================
 */

function positionAnchorArrow(
    anchorX,
    popupLeft,
    placement
) {

    if (!translationPopup) {
        return;
    }


    const arrow =
        translationPopup.querySelector(
            ".dt-anchor-arrow"
        );


    if (!arrow) {
        return;
    }


    arrow.style.display =
        "";


    const popupWidth =
        translationPopup
            .getBoundingClientRect()
            .width;


    let relativeX =
        anchorX -
        popupLeft;


    relativeX =
        Math.max(
            26,
            Math.min(
                relativeX,
                popupWidth -
                26
            )
        );


    arrow.style.left =
        `${Math.round(relativeX)}px`;


    arrow.classList.remove(
        "dt-anchor-top",
        "dt-anchor-bottom"
    );


    if (
        placement ===
        "bottom"
    ) {

        arrow.classList.add(
            "dt-anchor-top"
        );


    } else {

        arrow.classList.add(
            "dt-anchor-bottom"
        );
    }
}


/*
 * Hide arrow when original text
 * has moved off-screen.
 */
function hideAnchorArrow() {

    const arrow =
        translationPopup
            ?.querySelector(
                ".dt-anchor-arrow"
            );


    if (arrow) {

        arrow.style.display =
            "none";
    }
}


/*
 * =========================================================
 * CLEANUP
 * =========================================================
 */

function removeUI() {

    /*
     * Invalidate outstanding request.
     */
    currentRequestId++;


    translateButton?.remove();

    translationPopup?.remove();


    translateButton =
        null;


    translationPopup =
        null;


    selectionRange =
        null;


    selectionRect =
        null;
}