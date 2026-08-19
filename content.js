let translateButton = null;
let translationPopup = null;

let selectedText = "";
let selectionRect = null;


/*
 * Detect text selection
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
 * Close UI when clicking somewhere else
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
 * Detect selected text
 */
function handleSelection() {
    const selection =
        window.getSelection();

    if (!selection) {
        return;
    }

    const text =
        selection
            .toString()
            .trim();

    if (
        !text ||
        selection.rangeCount === 0
    ) {
        return;
    }

    selectedText =
        text;

    const range =
        selection.getRangeAt(0);

    selectionRect =
        range.getBoundingClientRect();

    showTranslateButton(
        selectionRect
    );
}


/*
 * Floating translate button
 */
function showTranslateButton(rect) {
    translateButton?.remove();

    translateButton =
        document.createElement(
            "button"
        );

    translateButton.className =
        "drag-translator-button";

    translateButton.textContent =
        "🌐";

    translateButton.title =
        "Translate selected text";


    const position =
        calculatePosition(
            rect.right +
            window.scrollX +
            8,

            rect.bottom +
            window.scrollY +
            8,

            36,
            36
        );


    translateButton.style.left =
        `${position.left}px`;

    translateButton.style.top =
        `${position.top}px`;


    document.body.appendChild(
        translateButton
    );


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
 * Main translation popup
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


    translationPopup.innerHTML = `
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


        <div class="dt-result">

            <div class="dt-loading">
                <span class="dt-spinner"></span>
                Looking up…
            </div>

        </div>
    `;


    document.body.appendChild(
        translationPopup
    );


    const originalElement =
        translationPopup.querySelector(
            ".dt-original"
        );

    originalElement.textContent =
        selectedText;


    /*
     * Hide original strip for short terms.
     * The term will appear as the dictionary title.
     */
    if (isShortTerm(selectedText)) {
        originalElement.classList.add(
            "dt-original-hidden"
        );
    }


    positionPopup();


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


    /*
     * Restore language
     */
    const settings =
        await chrome.storage.local.get([
            "targetLanguage"
        ]);


    const savedLanguage =
        settings.targetLanguage ||
        "English";


    dropdown.value =
        savedLanguage;


    translateSelectedText(
        savedLanguage
    );


    /*
     * Language change
     */
    dropdown.addEventListener(
        "change",
        async () => {

            const language =
                dropdown.value;


            await chrome.storage.local.set({
                targetLanguage:
                language
            });


            translateSelectedText(
                language
            );
        }
    );


    closeButton.addEventListener(
        "click",
        removeUI
    );


    settingsButton.addEventListener(
        "click",
        openSettings
    );
}


/*
 * Determine whether the original strip
 * should be hidden.
 */
function isShortTerm(text) {
    const words =
        text.trim().split(/\s+/);

    return (
        words.length <= 6 &&
        text.length <= 70
    );
}


/*
 * Open extension settings
 */
function openSettings() {
    chrome.runtime.sendMessage({
        type: "openOptions"
    });
}


/*
 * Ask background worker
 */
async function translateSelectedText(
    targetLanguage
) {
    if (!translationPopup) {
        return;
    }


    const resultElement =
        translationPopup.querySelector(
            ".dt-result"
        );


    resultElement.innerHTML = `
        <div class="dt-loading">
            <span class="dt-spinner"></span>
            Looking up…
        </div>
    `;


    try {

        const response =
            await chrome.runtime.sendMessage({
                type: "translate",
                text: selectedText,
                targetLanguage
            });


        if (!response?.success) {
            throw new Error(
                response?.error ||
                "Unknown translation error."
            );
        }


        if (!translationPopup) {
            return;
        }


        renderDictionaryResult(
            resultElement,
            response.result
        );


    } catch (error) {

        console.error(
            "Translation failed:",
            error
        );


        if (!translationPopup) {
            return;
        }


        renderError(
            resultElement,
            error
        );
    }
}


/*
 * Render structured dictionary result
 */
function renderDictionaryResult(
    container,
    data
) {
    container.innerHTML =
        "";


    /*
     * Main entry header
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


    if (
        data.mode === "translation" &&
        data.translation
    ) {
        title.textContent =
            data.translation;
    } else {
        title.textContent =
            data.word ||
            selectedText;
    }


    titleRow.appendChild(
        title
    );


    /*
     * Pronunciation
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
     * Original word under a translation
     */
    if (
        data.mode === "translation" &&
        data.word &&
        data.translation &&
        data.word !== data.translation
    ) {

        const source =
            document.createElement(
                "div"
            );

        source.className =
            "dt-source-term";

        source.textContent =
            data.word;

        entryHeader.appendChild(
            source
        );
    }


    container.appendChild(
        entryHeader
    );


    /*
     * Meanings
     */
    if (
        Array.isArray(data.meanings) &&
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
                    !meaning.definition &&
                    !meaning.explanation &&
                    !meaning.examples?.length
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
                 * Definition row
                 */
                if (meaning.definition) {

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
                 * Explanation / nuance
                 */
                if (meaning.explanation) {

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
                        .forEach(example => {

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
                        });
                }


                meaningsContainer.appendChild(
                    meaningBlock
                );
            }
        );


        if (
            meaningsContainer.children.length
        ) {
            container.appendChild(
                meaningsContainer
            );
        }
    }


    /*
     * Synonyms
     */
    if (
        Array.isArray(data.synonyms) &&
        data.synonyms.filter(Boolean).length
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
            .forEach(word => {

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
            });


        section.append(
            heading,
            chips
        );


        container.appendChild(
            section
        );
    }


    /*
     * Usage
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
 * Reusable section heading
 */
function createSectionTitle(text) {
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
 * Error renderer
 */
function renderError(
    container,
    error
) {
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
        "Translation failed";


    const message =
        document.createElement(
            "div"
        );

    message.className =
        "dt-error-message";

    message.textContent =
        error.message;


    const button =
        document.createElement(
            "button"
        );

    button.className =
        "dt-open-settings";

    button.textContent =
        "Open settings";


    button.addEventListener(
        "click",
        openSettings
    );


    wrapper.append(
        title,
        message,
        button
    );


    container.appendChild(
        wrapper
    );
}


/*
 * Position popup
 */
function positionPopup() {
    if (
        !translationPopup ||
        !selectionRect
    ) {
        return;
    }


    const popupWidth =
        410;

    const popupHeight =
        500;


    const desiredLeft =
        selectionRect.left +
        window.scrollX;


    const desiredTop =
        selectionRect.bottom +
        window.scrollY +
        10;


    const position =
        calculatePosition(
            desiredLeft,
            desiredTop,
            popupWidth,
            popupHeight
        );


    translationPopup.style.left =
        `${position.left}px`;

    translationPopup.style.top =
        `${position.top}px`;
}


/*
 * Keep popup inside viewport
 */
function calculatePosition(
    left,
    top,
    width,
    height
) {
    const padding =
        12;


    const viewportLeft =
        window.scrollX;

    const viewportTop =
        window.scrollY;

    const viewportRight =
        viewportLeft +
        window.innerWidth;

    const viewportBottom =
        viewportTop +
        window.innerHeight;


    let finalLeft =
        left;

    let finalTop =
        top;


    if (
        finalLeft + width >
        viewportRight - padding
    ) {
        finalLeft =
            viewportRight -
            width -
            padding;
    }


    if (
        finalLeft <
        viewportLeft + padding
    ) {
        finalLeft =
            viewportLeft +
            padding;
    }


    if (
        finalTop + height >
        viewportBottom - padding
    ) {
        finalTop =
            Math.max(
                viewportTop + padding,
                top - height - 50
            );
    }


    return {
        left: finalLeft,
        top: finalTop
    };
}


/*
 * Remove popup and floating button
 */
function removeUI() {
    translateButton?.remove();
    translationPopup?.remove();

    translateButton =
        null;

    translationPopup =
        null;
}