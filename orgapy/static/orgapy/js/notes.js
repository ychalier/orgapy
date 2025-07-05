function createToc(contentContainer, tocContainer) {    
    function removeToc() {
        if (tocContainer.previousElementSibling != null) {
            tocContainer.previousElementSibling.style.flexDirection = "column";
        }
        tocContainer.parentElement.removeChild(tocContainer);
    }
    let bounds = contentContainer.getBoundingClientRect();
    if (bounds.height <= 0.8 * window.innerHeight) {
        removeToc();
        return;
    };
    let titles = contentContainer.querySelectorAll("h2");
    if (titles.length < 2) {
        removeToc();
        return;
    }
    tocContainer.innerHTML = "<b>Contents</b>";
    titles.forEach(title => {
        let anchor = tocContainer.appendChild(document.createElement("a"));
        anchor.classList.add("link-hidden");
        anchor.textContent = title.textContent;
        anchor.href = `#${title.id}`;
    });
}

function setupCategoryInput() {
    const categoryIndex = {};
    const categoryReverseIndex = {};
    for (const category of CATEGORIES) {
        categoryIndex[category.id] = category.name;
        categoryReverseIndex[category.name] = category.id;
    }

    const inputHidden = document.getElementById("categories-input-hidden");
    const inputNew = document.getElementById("categories-input-new");
    const inputEndChars = " ,;";

    function readInputHiddenValues() {
        const baseValues = inputHidden.value.trim().split(";");
        const newValues = [];
        for (const v of baseValues) {
            if (v.trim() != "" && !newValues.includes(v.trim())) {
                newValues.push(v.trim());
            }
        }
        return newValues;
    }

    function cleanInputHiddenValue() {
        inputHidden.value = readInputHiddenValues().join(";");
    }

    function updateCategories() {
        const container = document.getElementById("categories-input-current");
        container.innerHTML = "";
        for (const categoryIdOrName of readInputHiddenValues()) {
            const element = document.createElement("span");
            element.classList.add("category")
            container.appendChild(element);
            if (categoryIdOrName in categoryIndex) {
                element.textContent = categoryIndex[categoryIdOrName];
            } else {
                element.textContent = categoryIdOrName;
            }
            const icon = document.createElement("i");
            icon.classList.add("ri-close-line");
            element.appendChild(icon);
            icon.addEventListener("click", () => {
                inputHidden.value = inputHidden.value.replace(categoryIdOrName, "");
                cleanInputHiddenValue();
                updateCategories();
            });
        }
    }

    function getSuggestions(prefix) {
        if (prefix == "") return [];
        const currentCategoryNames = [];
        for (const categoryIdOrName of readInputHiddenValues()) {
            if (categoryIdOrName in categoryIndex) {
                currentCategoryNames.push(categoryIndex[categoryIdOrName]);
            } else {
                currentCategoryNames.push(categoryIdOrName);
            }
        }
        const candidates = [];
        for (const categoryName in categoryReverseIndex) {
            if (categoryName.startsWith(prefix) && !currentCategoryNames.includes(categoryName)) {
                candidates.push(categoryName);
            }
        }
        return candidates;
    }

    function updateSuggestions(prefix) {
        const candidates = getSuggestions(prefix);
        const container = document.getElementById("categories-suggestions-items");
        container.innerHTML = "";
        if (candidates.length > 0) {
            for (const categoryName of candidates) {
                const element = document.createElement("div");
                element.textContent = categoryName;
                element.addEventListener("click", () => {
                    submitCategoryName(categoryName);
                });
                container.appendChild(element);
            }
        }
    }

    function submitCategoryName(categoryName) {
        let valueToAppend;
        if (categoryName in categoryReverseIndex) {
            valueToAppend = categoryReverseIndex[categoryName];
        } else {
            valueToAppend = categoryName;
        }
        inputHidden.value = [...readInputHiddenValues(), valueToAppend].join(";");
        cleanInputHiddenValue();
        inputNew.value = "";
        updateCategories();
        updateSuggestions();
        inputNew.focus();
    }
    
    inputNew.addEventListener("input", () => {
        const value = inputNew.value.toLowerCase().trimStart();
        if (inputEndChars.includes(value.charAt(value.length - 1))) {
            const categoryName = value.substring(0, value.length - 1);
            submitCategoryName(categoryName);
        } else {
            updateSuggestions(value.trim());
        }
    });

    inputNew.addEventListener("keydown", (event) => {
        if (event.key == "Tab") {
            event.preventDefault();
            const candidates = getSuggestions(inputNew.value.toLowerCase().trim());
            if (candidates.length == 1) {
                submitCategoryName(candidates[0]);
            }
            return false;
        } else if (event.key == "Enter") {
            const value = inputNew.value.toLowerCase().trim();
            event.preventDefault();
            if (value != "") {
                submitCategoryName(value);
            }
            return false;
        }
    });

    updateCategories();
}

function bindSaveNoteButtons() {

    const primaryForm = document.getElementById("form-note-edit-primary");
    const secondaryForm = document.getElementById("form-note-edit-secondary");
    
    function mergeForms() {        
        ["pinned", "public", "hidden"].forEach(name => {
            const primaryInput = primaryForm.querySelector(`input[name=${name}]`);
            const secondaryInput = secondaryForm.querySelector(`input[name=${name}]`);
            if (secondaryInput.checked) {
                primaryInput.setAttribute("checked", "");
            } else {
                primaryInput.removeAttribute("checked");
            }
        });
    }
    
    function saveNoteAndExit() {
        mergeForms();
        primaryForm.submit();
    }
    document.getElementById("btn-save-note-exit").addEventListener("click", saveNoteAndExit);
    document.getElementById("btn-save-note-exit-menu").addEventListener("click", saveNoteAndExit);

    const buttonSaveNoteContinue = document.getElementById("btn-save-note-continue");
    if (buttonSaveNoteContinue == null) return;
    buttonSaveNoteContinue.classList.add("disabled");
    buttonSaveNoteContinue.addEventListener("click", (event) => {
        event.preventDefault();
        buttonSaveNoteContinue.classList.add("disabled");
        mergeForms();
        const formdata = new FormData(primaryForm);
        fetch(primaryForm.action, {method: primaryForm.method, body: formdata}).then(res => {
            if (res.status == 200) {
                toast("Saved!", 600);
                document.querySelector("input[name=modification]").value = new Date() / 1000;
            } else {
                res.text().then(resText => {
                    toast(`An error occurred: ${res.status} ${resText}`, 600);
                });
            }
        });
    });
    document.querySelectorAll("input,textarea").forEach(input => {
        input.addEventListener("input", () => {
            buttonSaveNoteContinue.classList.remove("disabled");
        });
    });
}

function bindWidgets(noteId) {

    const WIDGET_UPDATE_TIMEOUT = 1000;

    var widgetUpdateBuffer = [];
    var widgetUpdateTimeout = null;

    function submitWidgetUpdates() {
        const seenKeys = [];
        var selectedUpdates = [];
        while (widgetUpdateBuffer.length > 0) {
            const update = widgetUpdateBuffer.pop();
            const key = `${update.type}${update.index}`;
            if (seenKeys.includes(key)) {
                continue;
            }
            seenKeys.push(key);
            selectedUpdates.push(update);
        }
        if (selectedUpdates.length > 0) {
            apiPost("edit-widgets", {
                nid: noteId,
                updates: JSON.stringify(selectedUpdates)
            }, () => {
                toast(`Saved widgets`, TOAST_SHORT);
            });
        }
        widgetUpdateTimeout = null;
    }

    function updateWidget(type, index, value) {
        widgetUpdateBuffer.push({type: type, index: index, value: value});
        if (widgetUpdateTimeout != null) {
            clearTimeout(widgetUpdateTimeout);
        }
        widgetUpdateTimeout = setTimeout(submitWidgetUpdates, WIDGET_UPDATE_TIMEOUT);
    }

    document.querySelectorAll(".widget-status").forEach((widget, index) => {
        widget.setAttribute("index", index);
        widget.addEventListener("click", () => {
            let newTextContent = null;
            if (widget.textContent == "✅") {
                newTextContent = "⏺️";
            } else if (widget.textContent == "⏺️") {
                newTextContent = "❌";
            } else {
                newTextContent = "✅";
            }
            widget.textContent = newTextContent;
            updateWidget("status", index, newTextContent);
        });
    });

    document.querySelectorAll(".widget-checkbox").forEach((widget, index) => {
        widget.setAttribute("index", index);
        widget.addEventListener("input", () => {
            updateWidget("checkbox", index, widget.checked);
        });
    });

    document.querySelectorAll(".widget-color-round").forEach((widget, index) => {
        widget.setAttribute("index", index);
        widget.addEventListener("click", () => {
            const color = ["🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "🟤", "⚫", "⚪"];
            const oldEmojiIndex = color.indexOf(widget.textContent);
            const newEmojiIndex = (oldEmojiIndex + 1) % color.length;
            const newTextContent = color[newEmojiIndex];
            widget.textContent = newTextContent;
            updateWidget("color_round", index, newTextContent);
        });
    });

    document.querySelectorAll(".widget-color-square").forEach((widget, index) => {
        widget.setAttribute("index", index);
        widget.addEventListener("click", () => {
            const color = ["🟥", "🟧", "🟨", "🟩", "🟦", "🟪", "🟫", "⬛", "⬜"];
            const oldEmojiIndex = color.indexOf(widget.textContent);
            const newEmojiIndex = (oldEmojiIndex + 1) % color.length;
            const newTextContent = color[newEmojiIndex];
            widget.textContent = newTextContent;
            updateWidget("color_square", index, newTextContent);
        });
    });

}

function getCharPosition(span, charIndex) {
    const range = document.createRange();
    let textNode = span.firstChild;
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
        console.warn("Span does not contain a valid text node.");
        return null;
    }
    range.setStart(textNode, charIndex);
    range.setEnd(textNode, charIndex + 1);
    const rects = range.getClientRects();
    if (rects.length > 0) {
        return rects[0];
    } else {
        return null;
    }
}

/**
 * @see https://codemirror.net/5/doc/manual.html
 */
var smdeDropdownState = null;
var smdeSelectedResult = 0;
var smdeResultCount = 0;
function openSmdeDropdown(cmInstance, word) {
    
    // Close any previously opened dropdown
    closeSmdeDropdown();
    
    // Create and position the dropdown itself
    const dropdown = create(document.body, "div", "smde-dropdown");
    const cursor = cmInstance.getCursor();
    const line = cmInstance.getLine(cursor.line);
    let iStart = cursor.ch;
    while (iStart > 0 && line.charAt(iStart) != "@") iStart--;
    const lineNode = cmInstance.display.view[cursor.line].node;
    let textLength = null;
    let span = null;
    let maxLength = null;
    for (const candidateSpan of lineNode.querySelectorAll("span")) {
        if (maxLength == null || candidateSpan.textContent.length > maxLength) {
            maxLength = candidateSpan.textContent.length;
        }
        if (candidateSpan.textContent.includes(word) && (textLength == null || candidateSpan.textContent.length < textLength)) {
            span = candidateSpan;
            textLength = candidateSpan.textContent.length;
        }
    }
    if (span == null) {
        throw new Error("Could not find span with target word");
    }
    iStart -= maxLength - span.textContent.length;
    const wordStart = getCharPosition(span, iStart);
    console.log("Wordstart", wordStart);
    const verticalPadding = 4; // px
    dropdown.style.top = (wordStart.bottom + verticalPadding) + "px";
    dropdown.style.left = wordStart.left + "px";

    // Parse current widget
    const [match, objectType, objectId] = word.match(/@(\w+)\/(\d+)?/);
    if (objectType != "note" && objectType != "sheet" && objectType != "map") {
        console.error("Invalid objectif type", objectType);
    }
    const iEnd = iStart + match.length;

    // Highlight text node
    for (let i = iStart; i < iEnd; i++) {
        const bounds = getCharPosition(span, i);
        const highlight = create(document.body, "div", "smde-highlight");
        highlight.style.top = bounds.top + "px";
        highlight.style.left = bounds.left + "px";
        highlight.style.width = bounds.width + "px";
        highlight.style.height = bounds.height + "px";
    }

    function setObjectId(newId, origin) {
        smdeDropdownState = origin;
        const replaceFrom = {line: cursor.line, ch: iStart};
        const replaceTo = {line: cursor.line, ch: iEnd};
        cmInstance.replaceRange(`@${objectType}/${newId}`, replaceFrom, replaceTo, origin);
    }

    const searchbar = create(dropdown, "input", "smde-dropdown-searchbar");

    // Set pinned value
    if (objectId != undefined) {
        const pinned = create(dropdown, "div", "smde-dropdown-pinned");
        const pinnedSpan = create(pinned, "span");
        const pinnedButton = create(pinned, "i", "ri-close-line");
        fetch(URL_API + `?action=title&type=${objectType}&id=${objectId}`).then(res => res.text()).then(text => {
            pinnedSpan.textContent = text;
        });
        pinnedButton.addEventListener("click", () => { setObjectId("", "interlink-reset") });
    }

    const results = create(dropdown, "div", "smde-dropdown-results");

    // Bind searchbar
    const apiAction = `${objectType}-suggestions`;
    searchbar.addEventListener("input", () => {
        const query = searchbar.value.trim();
        fetch(URL_API + `?action=${apiAction}&q=${query}`).then(res => res.json()).then(data => {
            results.innerHTML = "";
            smdeResultCount = data.results.length;
            smdeSelectedResult = -1;
            for (const entry of data.results) {
                const result = create(results, "div", "smde-dropdown-result")
                result.textContent = entry.title;
                result.setAttribute("object-id", entry.id);
                result.addEventListener("click", () => { setObjectId(entry.id, "interlink-set"); });
            }
        });
    });

    function updateSelectedResult() {
        results.querySelectorAll(".smde-dropdown-result").forEach((result, i) => {
            if (i == smdeSelectedResult) {
                result.classList.add("active");
            } else {
                result.classList.remove("active");
            }
        });
    }

    function unfocusSmdeDropdown() {
        smdeDropdownState = "interlink-set";
        cmInstance.setCursor({line: cursor.line, ch: iEnd});
        cmInstance.focus();
    }

    searchbar.addEventListener("keydown", (event) => {
        if (event.key == "ArrowDown" && smdeSelectedResult < smdeResultCount - 1) {
            event.preventDefault();
            smdeSelectedResult++;
            updateSelectedResult();
        } else if (event.key == "ArrowUp" && smdeSelectedResult > 0) {
            event.preventDefault();
            smdeSelectedResult--;
            updateSelectedResult();
        } else if (event.key == "Enter") {
            event.preventDefault();
            if (smdeSelectedResult != undefined && smdeSelectedResult >= 0 && smdeSelectedResult < results.children.length) {
                setObjectId(results.children[smdeSelectedResult].getAttribute("object-id"), "interlink-set")
            } else {
                unfocusSmdeDropdown();
            }
        } else if (event.key == "Escape") {
            unfocusSmdeDropdown();
        }
    });
    
    if (smdeDropdownState == "interlink-set") {
        cmInstance.focus(); 
    } else {
        setTimeout(() => { searchbar.focus(); }, 50);
    }

    smdeDropdownState = null;

}

function closeSmdeDropdown() {
    document.querySelectorAll("div.smde-dropdown, div.smde-highlight").forEach(remove);
}

function onCmCursorActivity(cmInstance) {
    const cursor = cmInstance.getCursor();
    const line = cmInstance.getLine(cursor.line);
    let iStart = Math.max(0, cursor.ch - 1);
    while (iStart > 0 && line.charAt(iStart) != " ") iStart--;
    let iEnd = iStart + 1;
    while (iEnd < line.length && line.charAt(iEnd) != " ") iEnd++;
    const word = line.substring(iStart, iEnd).trim();
    if (word.match(/^@(note|map|sheet)\/(\d+)?$/)) {
        setTimeout(() => { openSmdeDropdown(cmInstance, word); }, 1);
    } else {
        closeSmdeDropdown();
    }
}