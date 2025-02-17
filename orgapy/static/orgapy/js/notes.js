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
        ["pinned", "public"].forEach(name => {
            const primaryInput = primaryForm.querySelector(`input[name=${name}]`);
            const secondaryInput = secondaryForm.querySelector(`input[name=${name}]`);
            if (secondaryInput.checked) {
                primaryInput.setAttribute("checked", "");
            } else {
                primaryInput.removeAttribute("checked");
            }
        });
    }
    
    const buttonSaveNoteExit = document.getElementById("btn-save-note-exit");
    buttonSaveNoteExit.addEventListener("click", () => {
        mergeForms();
        primaryForm.submit();
    });

    const buttonSaveNoteContinue = document.getElementById("btn-save-note-continue");
    if (buttonSaveNoteContinue == null) return;
    buttonSaveNoteContinue.classList.add("disabled");
    buttonSaveNoteContinue.addEventListener("click", (event) => {
        event.preventDefault();
        buttonSaveNoteContinue.classList.add("disabled");
        mergeForms();
        const formdata = new FormData(primaryForm);
        fetch(primaryForm.action, {method: primaryForm.method, body: formdata}).then(res => {
            toast("Saved!", 600);
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