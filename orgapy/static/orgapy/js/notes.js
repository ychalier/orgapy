function createToc(contentContainer, tocContainer) {    
    function removeToc() {
        remove(tocContainer.parentElement.parentElement);
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
    tocContainer.innerHTML = "";
    titles.forEach(title => {
        let anchor = tocContainer.appendChild(document.createElement("a"));
        anchor.tabIndex = 3;
        anchor.classList.add("link-hidden");
        anchor.textContent = title.textContent;
        anchor.href = `#${title.id}`;
    });
}

function bindWidgets() {

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
            const etagMeta = document.querySelector("meta[name='etag']");
            const formData = new FormData();
            formData.append("csrfmiddlewaretoken", CSRF_TOKEN);
            formData.append("widgets", JSON.stringify(selectedUpdates));
            formData.append("etag", etagMeta.content);
            formData.append("action", "continue");
            fetch("", {
                method: "POST",
                body: formData,
                headers: {
                    "If-Match": etagMeta.content,
                    "X-Requested-With": "XMLHttpRequest"
                }
            }).then(res => {
                if (res.status == 204) {
                    const newEtag = res.headers.get("ETag");
                    if (newEtag) etagMeta.content = newEtag; 
                    toast("Saved widgets!", 600);
                } else if (res.status == 412) {
                    toast("Conflict detected", 600);
                } else {
                    toast(`An error occurred: ${res.status}`, 600);
                }
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
function openSmdeDropdown(cmInstance, word, suggestionsUrl, documentsUrl) {
    
    // Close any previously opened dropdown
    closeSmdeDropdown();
    
    // Create and position the dropdown itself
    const dropdown = create(document.body, "div", "smde-dropdown search");
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
    const spanCharOffset = maxLength - span.textContent.length;
    const wordStart = getCharPosition(span, iStart - spanCharOffset);
    const verticalPadding = 4; // px
    dropdown.style.top = (wordStart.bottom + verticalPadding) + "px";
    dropdown.style.left = wordStart.left + "px";

    // Parse current widget
    const [match, objectTypeKey, objectNonce] = word.match(/@(\w+)\/([a-zA-Z0-9]+)?/);
    const objectType = {
        note: "note",
        sheet: "sheet",
        map: "map",
        embednote: "note",
        embedsheet: "sheet",
        embedmap: "map"
    }[objectTypeKey];
    if (objectType == null || objectType == undefined) {
        console.error("Invalid type key", objectTypeKey);
    }
    const iEnd = iStart + match.length;

    // Highlight text node

    const textAreaContainer = document.querySelector(".CodeMirror");
    for (let i = iStart; i < iEnd; i++) {
        const bounds = getCharPosition(span, i - spanCharOffset);
        const highlight = create(textAreaContainer, "div", "smde-highlight");
        highlight.style.top = bounds.top + "px";
        highlight.style.left = bounds.left + "px";
        highlight.style.width = bounds.width + "px";
        highlight.style.height = bounds.height + "px";
    }

    function setNonce(newNonce, origin) {
        smdeDropdownState = origin;
        const replaceFrom = {line: cursor.line, ch: iStart};
        const replaceTo = {line: cursor.line, ch: iEnd};
        cmInstance.replaceRange(`@${objectTypeKey}/${newNonce}`, replaceFrom, replaceTo, origin);
    }

    const searchbar = create(create(dropdown, "div", "search-bar"), "input", "search-input");

    // Set pinned value
    if (objectNonce != undefined) {
        const pinnedButton = create(dropdown, "button", "search-pin ellipsis");
        fetch(`${documentsUrl}?part=snippet&nonce=${objectNonce}`)
            .then(res => res.json())
            .then(data => {
                const result = data.results[0];
                if (result.error == null) {
                    pinnedButton.title = result.title;
                    pinnedButton.innerHTML = `${result.title} <i class="ri-close-line"></i>`;
                } else {
                    pinnedButton.textContent = result.error;
                }
        });
        pinnedButton.addEventListener("click", () => { setNonce("", "interlink-reset") });
    }

    create(dropdown, "ul", "search-suggestions menu");

    bindSearch(dropdown, suggestionsUrl, {t: objectType},
        (entry) => {
            if (entry == null) {
                unfocusSmdeDropdown();
            } else {
                setNonce(entry.ref, "interlink-set")
            }
        });

    function unfocusSmdeDropdown() {
        smdeDropdownState = "interlink-set";
        cmInstance.setCursor({line: cursor.line, ch: iEnd});
        cmInstance.focus();
    }
    
    if (smdeDropdownState == "interlink-set") {
        cmInstance.focus(); 
    } else {
        setTimeout(() => { searchbar.focus(); }, 50);
    }

    smdeDropdownState = null;

}

function closeSmdeDropdown() {
    document.querySelectorAll(".smde-dropdown, .smde-highlight").forEach(remove);
}

function onCmCursorActivity(cmInstance, suggestionsUrl, documentsUrl) {
    const cursor = cmInstance.getCursor();
    const line = cmInstance.getLine(cursor.line);
    let iStart = Math.max(0, cursor.ch - 1);
    while (iStart > 0 && line.charAt(iStart) != " ") iStart--;
    let iEnd = iStart + 1;
    while (iEnd < line.length && line.charAt(iEnd) != " ") iEnd++;
    const word = line.substring(iStart, iEnd).trim();
    if (word.match(/^@(note|sheet|map|embednote|embedsheet|embedmap)\/([a-zA-Z0-9]+)?$/)) {
        setTimeout(() => { openSmdeDropdown(cmInstance, word, suggestionsUrl, documentsUrl); }, 1);
    } else {
        closeSmdeDropdown();
    }
}