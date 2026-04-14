function create(parent=null, tag="div", className=null) {
    const element = document.createElement(tag);
    if (parent != null) {
        parent.appendChild(element);
    }
    if (className != null) {
        element.className = className;
    }
    return element;
}

function remove(element) {
    element.parentElement.removeChild(element);
}

function pad2(x) {
    return x.toString().padStart(2, "0");
}

function zip(a, b) {
    return Array.from(Array(Math.max(b.length, a.length)), (_, i) => [a[i], b[i]]);
}

function dtf(dt, format) {
    return format
        .replace("YYYY", dt.getFullYear())
        .replace("mm", pad2(dt.getMonth() + 1))
        .replace("dd", pad2(dt.getDate()))
        .replace("HH", pad2(dt.getHours()))
        .replace("MM", pad2(dt.getMinutes()))
        .replace("SS", pad2(dt.getSeconds()))
}

function fetchApi(url, method, formData=null, onSuccess=null) {
    const requestInit = {};
    requestInit.method = method;
    if (formData != null) {
        requestInit.body = formData;
    }
    fetch(url, requestInit)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                if (onSuccess != null) {
                    onSuccess(data);
                }
            } else {
                if ("reason" in data) {
                    alert(data.reason);
                }
                toast("An error occured", 600);
            }
        })
        .catch(err => {
            console.error(err);
            toast("An error occured", 600);
        });
}

function apiPost(action, body, onSuccess=null) {
    let formData = new FormData();
    formData.set("csrfmiddlewaretoken", CSRF_TOKEN);
    for (const key in body) {
        formData.set(key, body[key]);
    }
    fetchApi(URL_API + "?action=" + action, "post", formData, onSuccess);
}

function bindSearch(searchEl, apiAction, inflateMenuItem, onElementClick) {

    const searchInput = searchEl.querySelector(".search-input");
    const suggestionsContainer = searchEl.querySelector(".search-suggestions");

    var clearedAt = new Date();
    var fetchedAt = clearedAt;

    const clear = () => {
        searchInput.value = "";
        searchInput.focus();
        if (suggestionsContainer != null){
            suggestionsContainer.innerHTML = "";
        }
        clearedAt = new Date();
    }

    const clearIcon = searchEl.querySelector(".search-icon");
    if (clearIcon != null) {
        clearIcon.onclick = () => {
            clear();
        }
    }

    var selected = null;
    var results;
    var lines = [];

    searchInput.addEventListener("input", () => {
        const query = searchInput.value.trim();
        fetchedAt = new Date();
        fetch(URL_API + `?action=${apiAction}&q=${encodeURIComponent(query)}`).then(res => res.json()).then(data => {
            if (clearedAt >= fetchedAt) return;
            results = data.results;
            suggestionsContainer.innerHTML = "";
            selected = null;
            lines = [];
            for (const [i, entry] of results.entries()) {
                const li = create(suggestionsContainer, "li", "menu-item");
                lines.push(li);
                inflateMenuItem({container: li, entry: entry, query: query});
                li.addEventListener("click", (e) => {
                    e.preventDefault();
                    onElementClick(entry);
                });
                li.addEventListener("mouseenter", () => {
                    selected = i;
                    lines.forEach(line => line.classList.remove("hover"));
                    li.classList.add("hover");
                });
                li.addEventListener("mouseleave", () => {
                    selected = null;
                    li.classList.remove("hover");
                });
            }
        });
    });

    searchInput.addEventListener("keydown", (e) => {
        if (e.key == "Enter") {
            if (selected != null) {
                e.preventDefault();
                e.stopPropagation();
                onElementClick(results[selected]);
            }
        } else if (e.key == "ArrowDown" && results.length > 0) {
            e.preventDefault();
            if (selected == null) {
                selected = 0;
            } else {
                selected = Math.min(selected + 1, results.length - 1);
            }
            lines.forEach(line => line.classList.remove("hover"));
            lines[selected].classList.add("hover");
        } else if (e.key == "ArrowUp" && results.length > 0) {
            e.preventDefault();
            if (selected == null) {
                selected = results.length - 1;
            } else if (selected == 0) {
                selected = null;
            } else {
                selected = Math.max(0, selected - 1);
            }
            lines.forEach(line => line.classList.remove("hover"));
            if (selected != null) {
                lines[selected].classList.add("hover");
            }
        } else if (e.key == "Escape") {
            e.preventDefault();
            if (searchInput.value == "") {
                onElementClick(null);
            } else {
                clear();
            }
        }
    });

    return { searchInput, suggestionsContainer, clear };

}

function markdownToHtmlFancy(element, useKatex=false, embed=false) {
    const extensions = [];
    if (useKatex) {
        extensions.push(
            showdownKatex({
                displayMode: true,
                throwOnError: false,
                errorColor: '#ff0000',
                delimiters: [
                    { left: "$$", right: "$$", display: false },
                    { left: '~', right: '~', display: false, asciimath: true },
                ],
            })
        )
    }

    if (embed) {
        extensions.push(
            {
                type: "output",
                regex: /(@embedsheet\/(\d+))/g,
                replace: `<a class="reference label" ref-type="sheet" ref-id="$2"><i class="ri-table-line" title="Sheet"></i> <span>$1</span></a>`
            },
            {
                type: "output",
                regex: /(@embedmap\/(\d+))/g,
                replace: `<a class="reference label" ref-type="map" ref-id="$2"><i class="ri-map-2-line" title="Map"></i> <span>$1</span></a>`
            },
        );
    } else {
        extensions.push(
            {
                type: "output",
                regex: /@embedsheet\/(\d+)/g,
                replace: `<iframe src="../sheets/$1?embed=1"></iframe><a href="../sheets/$1"><small>Edit sheet</small></a>`
            },
            {
                type: "output",
                regex: /@embedmap\/(\d+)/g,
                replace: `<iframe src="../maps/$1?embed=1"></iframe><a href="../maps/$1"><small>Edit map</small></a>`
            },
        );
    }

    let converter = new showdown.Converter({
        omitExtraWLInCodeBlocks: true,
        customizedHeaderId: true,
        headerLevelStart: 2,
        simplifiedAutoLink: true,
        literalMidWordUnderscores: true,
        strikethrough: true,
        tables: true,
        tasklists: true,
        simpleLineBreaks: true,
        splitAdjacentBlockquotes: true,
        emoji: true,
        moreStyling: true,
        extensions: [
            ...extensions,
            {
                type: "lang",
                regex: /==([^=\n]+)==/g,
                replace: "<mark>$1</mark>",
            },
            {
                type: "output",
                regex: /<table>/g,
                replace: `<div class="table-wrapper"><table class="table">`,
            },
            {
                type: "output",
                regex: /<input type="checkbox" disabled="" style="([a-z: 0-9\-\.;]+)"( checked="")?> ?/g,
                replace: `<input type="checkbox" style="$1" class="widget widget-checkbox"$2>`,
            },
            {
                type: "output",
                regex: /&lt;/g,
                replace: `<`,
            },
            {
                type: "output",
                regex: /&gt;/g,
                replace: `>`,
            },
            {
                type: "output",
                regex: /&amp;/g,
                replace: `&`,
            },
            {
                type: "output",
                regex: /<\/table>/g,
                replace: `</table></div>`,
            },
            {
                type: "output",
                regex: /<pre><code class="(.*?) language-(.*?)">/g,
                replace: `<pre class="code" data-lang="$1"><code class="language-$2">`,
            },
            {
                type: "output",
                regex: /(@note\/(\d+))/g,
                replace: `<a class="reference label" ref-type="note" ref-id="$2"><i class="ri-sticky-note-line" title="Note"></i> <span>$1</span></a>`
            },
            {
                type: "output",
                regex: /(@sheet\/(\d+))/g,
                replace: `<a class="reference label" ref-type="sheet" ref-id="$2"><i class="ri-table-line" title="Sheet"></i> <span>$1</span></a>`
            },
            {
                type: "output",
                regex: /(@map\/(\d+))/g,
                replace: `<a class="reference label" ref-type="map" ref-id="$2"><i class="ri-map-2-line" title="Map"></i> <span>$1</span></a>`
            },
            {
                type: "output",
                regex: /(✅|❌|⏺️)/g,
                replace: `<span class="widget widget-status">$1</span>`
            },
            {
                type: "output",
                regex: /(🔴|🟠|🟡|🟢|🔵|🟣|🟤|⚫|⚪)/g,
                replace: `<span class="widget widget-color-round">$1</span>`
            },
            {
                type: "output",
                regex: /(🟥|🟧|🟨|🟩|🟦|🟪|🟫|⬛|⬜)/g,
                replace: `<span class="widget widget-color-square">$1</span>`
            }
        ]
    });
    element.innerHTML = converter.makeHtml(element.innerHTML.replaceAll("&gt;", ">"));
    element.querySelectorAll("p").forEach(paragraph => {
        paragraph.innerHTML = paragraph.innerHTML.replace(/(\w) ([:\?!;»€°])/g, "$1 $2").replace(/([«°]) (\w)/g, "$1 $2");;
    });
    const refArgs = [];
    const refEls = element.querySelectorAll(".reference");
    const refIndex = {"note": {}, "sheet": {}, "map": {}};
    for (const refEl of refEls) {
        const refId = refEl.getAttribute("ref-id");
        const refType = refEl.getAttribute("ref-type");
        if (refId == null || refId == "" || refType == null || refType == "") {
            console.warn("Invalid reference:", refType, refId);
            continue;
        }
        refArgs.push(`${refType}=${refId}`);
        if (!(refId in refIndex[refType])) {
            refIndex[refType][refId] = [];
        }
        refIndex[refType][refId].push(refEl);
    }
    if (refArgs.length > 0) {
        fetch(URL_API + `?action=reference&${refArgs.join("&")}`).then(res => res.json()).then(data => {
            for (const result of data.results) {
                if (!(result.type in refIndex) || !(result.id in refIndex[result.type])) {
                    console.warn("Unbound reference result", result.type, result.id);
                    continue;
                }
                for (const refEl of refIndex[result.type][result.id]) {
                    if (result.error == null) {
                        refEl.querySelector("span").textContent = result.title;
                        refEl.setAttribute("href", result.href);
                    } else {
                        const refId = refEl.getAttribute("ref-id");
                        const refType = refEl.getAttribute("ref-type");
                        refEl.querySelector("span").textContent = `${result.error}`;
                        refEl.setAttribute("title", `@${refType}/${refId}`);
                        refEl.classList.add("error");
                    }
                }
            }
        });
    }
    window.addEventListener("load", () => {
        hljs.highlightAll();
    });
}

function markdownToHtmlBasic(element) {
    let converter = new showdown.Converter({
        omitExtraWLInCodeBlocks: true,
        customizedHeaderId: true,
        headerLevelStart: 1,
        simplifiedAutoLink: true,
        literalMidWordUnderscores: true,
        strikethrough: true,
        tables: false,
        tasklists: false,
        simpleLineBreaks: true,
        emoji: true,
        moreStyling: true,
        extensions: []
    });
    element.innerHTML = converter.makeHtml(element.innerHTML);
    if (element.children.length == 1) {
        element.innerHTML = element.children[0].innerHTML;
    }
}

function markdownToHtml(selector, fancy=false, useKatex=false, embed=false) {
    document.querySelectorAll(selector).forEach(element => {
        if (fancy) {
            markdownToHtmlFancy(element, useKatex, embed);
        } else {
            markdownToHtmlBasic(element);
        }
    });
}

const TOAST_LONG = 3500;
const TOAST_SHORT = 2000;

function toast(message, duration) {
    snackbar.textContent = message;
    snackbar.classList.add("show");
    setTimeout(function() {
        snackbar.classList.add("hide");
        setTimeout(function() {
            snackbar.classList.remove("show");
            snackbar.classList.remove("hide");
            snackbar.textContent = "";
        }, 450);
    }, duration);
}

function bindDropdown(dropdown) {

    var isToggleFocused = false;
    var isElementFocused = false;
    var isMenuHovered = false;
    var hideTimeout = null;

    const toggle = dropdown.querySelector(".dropdown-toggle");
    const menu = dropdown.querySelector(".menu");

    function hideDropdown(timeout=1) {
        hideTimeout = setTimeout(() => {
            dropdown.appendChild(menu);
        }, timeout);
    }

    menu.querySelectorAll("a, button").forEach(element => {
        function onActiveIn() {
            if (hideTimeout != null) {
                clearTimeout(hideTimeout);
                hideTimeout = null;
            }
            isElementFocused = true;
        }
        function onActiveOut() {
            isElementFocused = false;
            if (!isToggleFocused && !isMenuHovered && hideTimeout == null) {
                hideDropdown();
            }
        }
        element.addEventListener("mousedown", onActiveIn);
        element.addEventListener("mouseup", onActiveOut);
        element.addEventListener("touchstart", onActiveIn);
        element.addEventListener("touchend", onActiveOut);
        element.addEventListener("click", () => {
            if (hideTimeout == null) {
                hideDropdown(1);
            }
        });
    });

    menu.addEventListener("mouseenter", () => {
        isMenuHovered = true;
        if (hideTimeout != null) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }
    });

    menu.addEventListener("mouseleave", () => {
        isMenuHovered = false;
        if (!isToggleFocused && !isElementFocused) {
            hideDropdown();
        }
    });

    toggle.addEventListener("focusin", () => {
        isToggleFocused = true;
        menu.style.position = "absolute";
        menu.style.zIndex = 9999;
        const dropdownBounds = dropdown.getBoundingClientRect();
        const toggleBounds = toggle.getBoundingClientRect();
        const menuBounds = menu.getBoundingClientRect();
        if (toggleBounds.bottom + menuBounds.height <= window.innerHeight) {
            // fits under, thus placing under
            menu.style.top = (toggleBounds.top - dropdownBounds.top + toggleBounds.height) + "px";
            menu.style.bottom = "unset";
        } else {
            // placing above
            menu.style.top = "unset";
            menu.style.bottom = (dropdownBounds.bottom - toggleBounds.bottom + toggleBounds.height) + "px";
        }
        if (toggleBounds.left + menuBounds.width <= window.innerWidth) {
            console.log(toggleBounds.left, menuBounds.width, window.innerWidth);
            // align to the left
            menu.style.left = (toggleBounds.left - dropdownBounds.left) + "px";
            menu.style.right = "unset";
        } else {
            // align to the right
            menu.style.left = "unset";
            menu.style.right = (dropdownBounds.right - toggleBounds.right) + "px";
        }
    });

    toggle.addEventListener("focusout", (event) => {
        isToggleFocused = false;
        if (!isElementFocused && !isMenuHovered) {
            hideDropdown();
        }
    });

}

function bindGotoPaginatorButton(buttonSelector, currentPage, maxPage, attrString) {
    const button = document.querySelector(buttonSelector);
    button.addEventListener("click", () => {
        const page = prompt(`Go to page (1-${maxPage}):`, currentPage.toString());
        if (page) {
            const pageNumber = Math.max(1, Math.min(maxPage, parseInt(page)));
            const baseUrl = window.location.protocol + '//' + window.location.host + window.location.pathname;
            const newUrl = baseUrl + `?page=${pageNumber}${attrString}`;
            window.location.href = newUrl;
        }
    });
}

function bindSearchButton(form, button) {
    button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const input = form.querySelector("input[name=query]");
        const query = prompt("Search", input.value);
        if (query) {
            input.value = query;
            form.submit();
        }
        return false;
    });
}

function setupCategoryInput(container) {

    const currentContainer = container.querySelector(".categories-input-current");
    const searchInput = container.querySelector(".search-input");
    var categories;

    function parseHiddenValue() {
        const value = container.querySelector("input[type=hidden]").value;
        categories = new Set();
        for (const part of value.split(";")) {
            if (part.length > 0) {
                categories.add(part);
            }
        }
    }

    function formatHiddenValue() {
        container.querySelector("input[type=hidden]").value = Array.from(categories).join(";");
    }

    function updateCurrentContainer() {
        currentContainer.innerHTML = "";
        for (const category of categories) {
            const element = create(currentContainer, "button", "button-accent");
            element.innerHTML = `${category} <i class="ri-close-line"></i>`;
            element.onclick = (e) => {
                e.preventDefault();
                popCategory(category);
            }
        }
    }

    function update() {
        formatHiddenValue();
        updateCurrentContainer();
        searchObject.clear();
    }

    function popCategory(category) {
        categories.delete(category);
        update()
    }

    function pushCategory(category) {
        categories.add(category);
        update()
    }

    parseHiddenValue();
    updateCurrentContainer();

    const searchObject = bindSearch(container, "suggestions-categories", (state) => {
        const element = create(state.container, "button");
        element.textContent = state.entry.title.slice(1);
        return element;
    }, (entry) => {
        pushCategory(entry.title.slice(1));
    });

    const inputEndChars = " ,;";

    searchInput.addEventListener("input", () => {
        const value = searchInput.value;
        if (inputEndChars.includes(value.charAt(value.length - 1))) {
            const category = value.substring(0, value.length - 1).trim();
            if (category.length > 0) {
                pushCategory(category);
            }
        }
    });

    searchInput.addEventListener("keydown", (e) => {
        if (e.key == "Enter") {
            e.preventDefault();
            e.stopPropagation();
            const value = searchInput.value.trim();
            if (value.length > 0) {
                pushCategory(value);
            }
        }
    });

}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

function bindEditable(editable) {
    const objectId = editable.getAttribute("object_id");
    const apiAction = editable.getAttribute("action");
    var editableText;
    function rebuildEditable(value) {
        editable.innerHTML = "";
        editableText = create(editable, "span", "editable-text");
        editableText.textContent = value;
        editableText.addEventListener("click", onEditableTextClick);
    }
    function onEditableTextClick() {
        const currentValue = editable.textContent;
        const input = document.createElement("input");
        input.className = "editable-input input-slim";
        input.size = Math.floor(currentValue.length * 1.1);
        input.value = currentValue;
        if (editableText == undefined) throw new Error();
        editableText.replaceWith(input);
        input.focus();
        function submitInput() {
            let newValue = input.value.trim();
            if (newValue == "") {
                rebuildEditable(currentValue);
            } else {
                apiPost(apiAction, {id: objectId, value: newValue}, () => {
                    rebuildEditable(newValue);
                    toast("Renamed subscription", TOAST_SHORT);
                });
            }
        }
        input.addEventListener("focusout", submitInput);
        input.addEventListener("keydown", (event) => {
            if (event.key == "Enter") {
                submitInput();
            }
        });
    }
    const defaultValue = editable.textContent;
    rebuildEditable(defaultValue);
}

function askUserToSubscribeToNotifications(serviceWorkerUrl, publicKeyBase64) {
    if ("serviceWorker" in navigator && "PushManager" in window) {
        navigator.serviceWorker.register(serviceWorkerUrl).then(function(registration) {
            console.log("Service Worker registered with scope:", registration.scope);
            Notification.requestPermission().then(async function(permission) {
                if (permission === "granted") {
                    console.log("User accepted notifications");
                    registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlBase64ToUint8Array(publicKeyBase64)
                    }).then(function(subscription) {
                        const body = JSON.stringify(subscription);
                        apiPost("save-subscription", {"subscription": body}, () => {
                            window.location.reload();
                        });
                    });
                } else {
                    console.log("User rejected notifications");
                }
            });
        });
    } else {
        console.error("Could not ask user for notifications, not supported");
    }
}

/**
 *
 * @param {HTMLElement} container
 * @param {Object} data Map[Year, Map[Day, Array[Elements]]
 * @param {Object} options { currentYear, showHeader, weekly, relative }
 */
function inflateCalendar(container, data, options) {

    if (options == undefined) options = {};
    if (!("currentYear" in options)) options.currentYear = null;
    if (!("showHeader" in options)) options.showHeader = true;
    if (!("weekly" in options)) options.weekly = false;
    if (!("relative" in options)) options.relative = false;
    if (!("key" in options)) options.key = null;
    if (!("classname" in options)) options.classname = null;
    if (!("inflatePopover" in options)) options.inflatePopover = (popover, entries) => {
        for (const entry of entries) {
            let el;
            if ("href" in entry) {
                el = create(popover, "a", "ellipsis link-hidden");
                el.href = entry.href;
            } else {
                el = create(popover, "span", "ellipsis");
            }
            el.textContent = entry.title;
        }
    }

    const minYear = Math.min(...Object.keys(data));
    const maxYear = Math.max(...Object.keys(data));

    const months = ["jan.", "feb.", "mar.", "apr.", "may", "june", "july", "aug.", "sep.", "oct.", "nov.", "dec."];
    const levels = 10; // 0 to 9 included, and "more"

    function inflateYear(currentYear) {

        const yearData = data[currentYear];

        container.innerHTML = "";
        container.classList.add("calendar");
        if (options.weekly) {
            container.classList.add("calendar--weekly");
        } else {
            container.classList.remove("calendar--weekly");
        }
        if (options.classname != null) {
            container.classList.add(options.classname);
        }

        if (options.showHeader) {

            const header = create(container, "div", "calendar-header");

            const prevButton = create(header, "button", "calendar-button");
            prevButton.textContent = "‹";
            prevButton.title = currentYear - 1;
            if (currentYear == minYear) {
                prevButton.setAttribute("disabled", "");
            } else {
                prevButton.addEventListener("click", () => {inflateYear(currentYear - 1);});
            }

            create(header, "span", "calendar-year").textContent = currentYear;

            const nextButton = create(header, "button", "calendar-button");
            nextButton.textContent = "›";
            nextButton.title = currentYear + 1;
            if (currentYear == maxYear) {
                nextButton.setAttribute("disabled", "");
            } else {
                nextButton.addEventListener("click", () => {inflateYear(currentYear + 1);});
            }
            
            const toggleWeeklyButton = create(header, "button", "button-inline");
            toggleWeeklyButton.textContent = "❖";
            toggleWeeklyButton.title = "Toggle weekly view";
            toggleWeeklyButton.addEventListener("click", () => {
                options.weekly = !options.weekly;
                inflateYear(currentYear);
            });

        }

        const body = create(container, "div", "calendar-body");
        const cells = [];

        if (options.weekly) {
            const dateStart = new Date(currentYear, 0, 1);
            const weekdayOffset = (dateStart.getDay() + 6) % 7;
            const daysInYear = (currentYear % 4 == 0 && currentYear % 100 != 0) || currentYear % 400 == 0 ? 366 : 365;
            const weekCount = Math.ceil((daysInYear + weekdayOffset) / 7);
            const rows = [];
            for (let i = 0; i < 7; i++) {
                rows.push(create(body, "div", "calendar-row"));
            }
            for (let j = 0; j < weekCount; j++) {
                for (let i = 0; i < 7; i++) {
                    cells.push(create(rows[i], "div", "calendar-day"));
                }
            }
            for (let i = 0; i < weekdayOffset; i++) cells[i].classList.add("disabled");
            for (let i = daysInYear + weekdayOffset; i < cells.length; i++) cells[i].classList.add("disabled");
            for (let i = weekdayOffset; i < daysInYear + weekdayOffset; i++) {
                const dt = new Date(dateStart);
                dt.setDate(dt.getDate() + i - weekdayOffset);
                const key = dtf(dt, "YYYY-mm-dd");
                cells[i].setAttribute("date", key);
            }
        } else {
            const dt = new Date(currentYear, 0, 1);
            const firstRow = create(body, "div", "calendar-row");
            for (let i = 0; i <= 31; i++) {
                const cell = create(firstRow, "div", "calendar-day-number");
                if (i > 0) {
                    cell.textContent = i;
                }
            }
            let monthRow = null;
            while (dt.getFullYear() == currentYear) {
                if (dt.getDate() == 1) {
                    monthRow = create(body, "div", "calendar-row");
                    create(monthRow, "div", "calendar-month-name").textContent = months[dt.getMonth()];
                }
                const dayCell = create(monthRow, "div", "calendar-day");
                const key = dtf(dt, "YYYY-mm-dd");
                dayCell.setAttribute("date", key);
                cells.push(dayCell);
                dt.setDate(dt.getDate() + 1);
            }
        }

        let maxValue = -1;
        if (options.relative) {
            for (let i = 0; i < cells.length; i++) {
                const key = cells[i].getAttribute("date");
                if (key in yearData) {
                    let value = 0;
                    if (options.key == null) {
                        value = yearData[key].length;
                    } else if (yearData[key].length > 0) {
                        value = yearData[key][0][options.key];
                    }
                    maxValue = Math.max(maxValue, value);
                }
            }
        }

        for (let i = 0; i < cells.length; i++) {
            const dayCell = cells[i];
            const key = dayCell.getAttribute("date");
            if (key in yearData) {
                let value = 0;
                if (options.key == null) {
                    value = yearData[key].length;
                } else if (yearData[key].length > 0) {
                    value = yearData[key][0][options.key];
                }
                if (options.relative) {
                    value = Math.ceil(levels * value / maxValue);
                }
                if (value > levels) {
                    dayCell.classList.add("filled-more");
                } else {
                    dayCell.classList.add(`filled-${value}`);
                }
                if ("href" in yearData[key][0]) {
                    dayCell.addEventListener("click", () => {
                        window.location.href = yearData[key][0].href;
                    });
                }
                let popover;
                let shouldClose = false;
                function showPopover() {
                    document.querySelectorAll(".calendar-popover").forEach(remove);
                    popover = create(document.body, "div", "calendar-popover");
                    popover.addEventListener("mouseenter", () => {
                        shouldClose = false;
                    });
                    popover.addEventListener("mouseleave", () => {
                        shouldClose = true;
                        setTimeout(closePopover, 100);
                    });
                    const cellBounds = dayCell.getBoundingClientRect();
                    popover.style.left = (cellBounds.left + cellBounds.width/2) + "px";
                    popover.style.top = (cellBounds.top + cellBounds.height) + "px";
                    create(popover, "span", "hint").textContent = key;
                    options.inflatePopover(popover, yearData[key]);
                }
                function closePopover() {
                    if (popover == null) return;
                    if (!shouldClose) return;
                    try {
                        document.body.removeChild(popover);
                    } catch { // popover could have already been deleted by showPopover
                        //pass
                    }
                    popover = null;
                }
                dayCell.addEventListener("mouseenter", () => {
                    shouldClose = false;
                    showPopover();
                });
                dayCell.addEventListener("mouseleave", () => {
                    shouldClose = true;
                    setTimeout(closePopover, 100);
                });
            }
        }

    }

    inflateYear(options.currentYear != null ? options.currentYear : (new Date()).getFullYear());

}

function bindLinkConfirm(link) {
    link.onclick = (e) => {
        e.preventDefault();
        let message = link.getAttribute("message");
        if (message == null) {
            message = "This can not be undone. Please confirm your decision.";
        }
        if (confirm(message)) {
            window.location.href = link.href;
        }
    };
}

window.addEventListener("load", () => {
    document.querySelectorAll(".link-confirm").forEach(bindLinkConfirm);
    document.querySelectorAll(".submit-confirm").forEach(input => {
        input.addEventListener("click", (event) => {
            event.preventDefault();
            let message = input.getAttribute("message");
            if (message == null) {
                message = "This can not be undone. Please confirm your decision.";
            }
            if (confirm(message)) {
                let node = input.parentElement;
                while (node.tagName != "FORM") {
                    node = node.parentElement;
                }
                const form = node;
                if (input.hasAttribute("name")) {
                    const hiddenInput = document.createElement("input");
                    hiddenInput.type = "hidden";
                    hiddenInput.name = input.name;
                    hiddenInput.value = input.value;
                    form.appendChild(hiddenInput);
                }
                form.submit();
            }
        });
    });
    document.querySelectorAll(".editable").forEach(bindEditable);
});