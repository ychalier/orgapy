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

/**
 * 
 * @param {string} url
 * @param {FormData | object} data 
 * @param {string | null} etag
 * @param {CallableFunction | null} onEtag
 * @returns {Promise<Response>}
 */
async function post(url, data, etag=null, onEtag=null) {
    if (!(data instanceof FormData)) {
        const formData = new FormData();
        for (const key in data) {
            formData.append(key, data[key]);
        }
        data = formData;
    }
    data.append("csrfmiddlewaretoken", CSRF_TOKEN);
    const headers = {
        "X-Requested-With": "XMLHttpRequest"
    };
    if (etag != null) {
        headers["If-Match"] = etag;
        data.append("etag", etag);
    }
    return fetch(url, {method: "post", body: data, headers: headers})
        .then(response => {
            if (response.status == 204) {
                if (onEtag != null) {
                    const newEtag = response.headers.get("ETag");
                    if (newEtag) onEtag(newEtag);
                }
            } else if (response.status == 412) {
                throw new Error("Conflict detected");
            } else {
                throw new Error(`Error ${response.status}`);
            }
        });
}

async function getEtag(url) {
    return fetch(url, {cache: "no-cache"})
        .then(async response => {
            const etag = response.headers.get("ETag").replaceAll("\"", "");
            return response.json().then(data => ({etag, data}));
        });
}

function bindSearch(searchEl, suggestionsUrl, suggestionsParams, onElementClick) {

    const searchInput = searchEl.querySelector(".search-input");
    const suggestionsContainer = searchEl.querySelector(".search-suggestions");

    if (onElementClick == undefined) {
        onElementClick = (entry) => {if (entry != null) window.location.href = entry.url};
    }

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
        const searchParams = new URLSearchParams();
        searchParams.set("q", query);
        for (const key in suggestionsParams) {
            searchParams.set(key, suggestionsParams[key]);
        }
        fetch(suggestionsUrl + "?" + searchParams.toString())
            .then(res => res.json())
            .then(data => {
            if (clearedAt >= fetchedAt) return;
            results = data.results;
            suggestionsContainer.innerHTML = "";
            selected = null;
            lines = [];
            for (const [i, entry] of results.entries()) {
                const li = create(suggestionsContainer, "li", "menu-item");
                lines.push(li);
                const menuItem = create(li, "a");
                menuItem.href = entry.url;
                menuItem.innerHTML = `<i class="${entry.icon}"></i> ${entry.label}`;
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

    searchInput.addEventListener("focusout", (event) => {
        if (!suggestionsContainer.contains(event.relatedTarget)) {
            suggestionsContainer.innerHTML = "";
        }
    });

    return { searchInput, suggestionsContainer, clear };

}

function markdownToHtmlFancy(element, options) {
    if (!("useKatex" in options)) options.useKatex = false;
    if (!("embed" in options)) options.embed = false;
    if (!("fetchReferences" in options)) options.fetchReferences = false;
    const extensions = [];
    if (options.useKatex) {
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
    if (options.embed) {
        extensions.push(
            {
                type: "output",
                regex: /@embed(note|sheet|map)\/([a-zA-Z0-9]+)/g,
                replace: `<div class="iframe-container"><iframe src="$2?embed=1"></iframe><div class="iframe-actions"><a class="button" href="$2"><i class="ri-arrow-right-circle-line"></i> View $1</a></div></div>`
            }
        );
    } else if (options.fetchReferences) {
        extensions.push(
            {
                type: "output",
                regex: /(@embednote\/([a-zA-Z0-9]+))/g,
                replace: `<a class="reference label" ref-type="note" ref-nonce="$2"><i class="ri-sticky-note-line" title="Note"></i> <span>$1</span></a>`
            },
            {
                type: "output",
                regex: /(@embedsheet\/([a-zA-Z0-9]+))/g,
                replace: `<a class="reference label" ref-type="sheet" ref-nonce="$2"><i class="ri-table-line" title="Sheet"></i> <span>$1</span></a>`
            },
            {
                type: "output",
                regex: /(@embedmap\/([a-zA-Z0-9]+))/g,
                replace: `<a class="reference label" ref-type="map" ref-nonce="$2"><i class="ri-map-2-line" title="Map"></i> <span>$1</span></a>`
            }
        );
    } else {
        extensions.push(
            {
                type: "output",
                regex: /(@embed(note|sheet|map)\/[a-zA-Z0-9]+)/g,
                replace: `<a class="label">$1</a>`
            }
        );
    }
    if (options.fetchReferences) {
        extensions.push(
            {
                type: "output",
                regex: /(@note\/([a-zA-Z0-9]+))/g,
                replace: `<a class="reference label" ref-type="note" ref-nonce="$2"><i class="ri-sticky-note-line" title="Note"></i> <span>$1</span></a>`
            },
            {
                type: "output",
                regex: /(@sheet\/([a-zA-Z0-9]+))/g,
                replace: `<a class="reference label" ref-type="sheet" ref-nonce="$2"><i class="ri-table-line" title="Sheet"></i> <span>$1</span></a>`
            },
            {
                type: "output",
                regex: /(@map\/([a-zA-Z0-9]+))/g,
                replace: `<a class="reference label" ref-type="map" ref-nonce="$2"><i class="ri-map-2-line" title="Map"></i> <span>$1</span></a>`
            }
        );
    } else {
        extensions.push(
            {
                type: "output",
                regex: /(@(note|sheet|map)\/([a-zA-Z0-9]+))/g,
                replace: `<a class="label">$1</a>`
            }
        );
    }
    const converter = new showdown.Converter({
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
                regex: /:::details\s+([^\n]+)\n([\s\S]+?)\n:::/g,
                replace: (match, summary, content) => {return `<details><summary>${summary}</summary>\n\n${content}\n\n</details>`;}
            },
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

    const referenceElements = element.querySelectorAll(".reference");
    if (referenceElements.length > 0) {
        const getParams = new URLSearchParams();
        getParams.append("part", "snippet");
        const referenceMap = new Map();
        for (const el of referenceElements) {
            const nonce = el.getAttribute("ref-nonce");
            getParams.append("nonce", nonce);
            if (referenceMap.has(nonce)) {
                referenceMap[nonce].push(el);
            } else {
                referenceMap.set(nonce, [el]);
            }
        }
        fetch(options.documentsUrl + "?" + getParams.toString())
            .then(res => res.json())
            .then(data => {
                for (const result of data.results) {
                    if (!referenceMap.has(result.nonce)) {
                        console.warn("Unbound reference result:", result);
                        continue;
                    }
                    for (const el of referenceMap.get(result.nonce)) {
                        if (result.error == null) {
                            el.querySelector("span").textContent = result.title;
                            el.setAttribute("href", result.href);
                        } else {
                            el.setAttribute("title", el.textContent.trim());
                            el.querySelector("span").textContent = `${result.error}`;
                            el.classList.add("error");
                        }
                    }
                }
        });
    }

    window.addEventListener("load", () => {
        hljs.highlightAll();
    });

    for (const pre of element.querySelectorAll("pre")) {
        const copyButton = create(pre, "button");
        copyButton.innerHTML = `<i class="ri-file-copy-2-line"></i>`;
        copyButton.onclick = () => {
            navigator.clipboard.writeText(pre.querySelector("code").textContent);
            showToast("Copied code to clipboard");
        }
    }
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

function markdownToHtml(selector, options) {
    if (options == undefined) options = {};
    if (!("fancy" in options)) options.fancy = false;
    document.querySelectorAll(selector).forEach(element => {
        if (options.fancy) {
            markdownToHtmlFancy(element, options);
        } else {
            markdownToHtmlBasic(element);
        }
    });
}

function moveToastsUp() {
    document.querySelectorAll(".toast").forEach((toast) => {
        if (toast.classList.contains("newest")) {
            toast.style.bottom = `1rem`;
            toast.classList.remove("newest");
        } else {
            const prevValue = toast.style.bottom.replace("rem", "");
            const newValue = parseFloat(prevValue) + 2.6;
            toast.style.bottom = `${newValue}rem`;
        }
    });
}

function showToast(message, error=false, duration=2000) {

    const popover = document.createElement("article");
    popover.popover = "manual";
    popover.classList.add("toast");
    popover.classList.add("newest");
    if (error) {
        popover.classList.add("error");
    }

    popover.textContent = message;
    document.body.appendChild(popover);
    popover.showPopover();

    setTimeout(() => {
        popover.hidePopover();
        popover.remove();
    }, duration);

    popover.addEventListener("toggle", (event) => {
        if (event.newState === "open") {
            moveToastsUp();
        }
    });

}

function bindDropdown(dropdown, delay=10) {

    var hideTimeout = null;

    const toggle = dropdown.querySelector(".dropdown-toggle");
    const menu = dropdown.querySelector(".menu");
    const isMainMenu = !dropdown.parentElement.classList.contains("menu-item");

    function showMenu() {
        menu.style.position = "fixed";
        menu.style.width = "fit-content";
        menu.style.zIndex = 9999;
        menu.classList.add("show");

        const dropdownBounds = dropdown.getBoundingClientRect();
        const toggleBounds = toggle.getBoundingClientRect();
        const menuBounds = menu.getBoundingClientRect();

        menu.classList.remove("show");

        if (hideTimeout != null) {
            clearTimeout(hideTimeout);
        }

        if (isMainMenu) {
            if (toggleBounds.bottom + menuBounds.height <= window.innerHeight) {
                // fits under, thus placing under
                menu.style.top = (toggleBounds.top + toggleBounds.height) + "px";
                menu.style.bottom = "unset";
            } else {
                // placing above
                menu.style.top = "unset";
                menu.style.top = (toggleBounds.top - menuBounds.height) + "px";
            }
            if (toggleBounds.left + menuBounds.width <= window.innerWidth) {
                // align to the left
                menu.style.left = toggleBounds.left + "px";
                menu.style.right = "unset";
            } else {
                // align to the right
                menu.style.left = "unset";
                menu.style.right = (window.innerWidth - toggleBounds.right) + "px";
            }
        } else {
            menu.style.top = toggleBounds.top + "px";
            if (dropdownBounds.right + menuBounds.width <= window.innerWidth) {
                menu.style.left = (dropdownBounds.left + dropdownBounds.width) + "px";
                menu.style.right = "unset";
            } else {
                // align to the right
                menu.style.left = "unset";
                menu.style.left = (dropdownBounds.left - menuBounds.width) + "px";
            }
        }
        menu.classList.add("show");
        toggle.classList.add("active");
        document.body.appendChild(menu);
    }

    function hideMenu() {
        if (hideTimeout != null) {
            clearTimeout(hideTimeout);
        }
        hideTimeout = setTimeout(() => {
            hideTimeout = null;
            menu.classList.remove("show");
            toggle.classList.remove("active");
            dropdown.appendChild(menu);
        }, delay);
    }

    dropdown.addEventListener("focusin", showMenu);
    dropdown.addEventListener("focusout", (e) => {
        const next = e.relatedTarget;
        if (!dropdown.contains(next) && !menu.contains(next)) {
            hideMenu();
        }
    });

    menu.addEventListener("click", (e) => {
        const item = e.target.closest("a, button");
        if (item && !item.closest(".dropdown-toggle")) {
            hideMenu();
        }
    });

    document.addEventListener("click", (e) => {
        if (!dropdown.contains(e.target) && !menu.contains(e.target)) {
            hideMenu();
        }
    });

}

function bindGotoPaginatorButton(gotoButton, currentPage, maxPage) {
    gotoButton.addEventListener("click", () => {
        const page = prompt(`Go to page (1-${maxPage}):`, currentPage.toString());
        if (page) {
            const params = new URLSearchParams(document.location.search);
            params.set("page", Math.max(1, Math.min(maxPage, parseInt(page))));
            window.location.href = "?" + params.toString();
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

function setupTagInput(container, suggestionsUrl) {

    const currentContainer = container.querySelector(".input-tags-current");
    const searchInput = container.querySelector(".search-input");
    var tags;

    function parseHiddenValue() {
        const value = container.querySelector("input[type=hidden]").value;
        tags = new Set();
        for (const part of value.split(";")) {
            if (part.length > 0) {
                tags.add(part);
            }
        }
    }

    function formatHiddenValue() {
        container.querySelector("input[type=hidden]").value = Array.from(tags).join(";");
    }

    function updateCurrentContainer() {
        currentContainer.innerHTML = "";
        for (const tag of tags) {
            const element = create(currentContainer, "button", "button-accent");
            element.innerHTML = `${tag} <i class="ri-close-line"></i>`;
            element.onclick = (e) => {
                e.preventDefault();
                popTag(tag);
            }
        }
    }

    function update() {
        formatHiddenValue();
        updateCurrentContainer();
        searchObject.clear();
        container.querySelector("input[type=hidden]").dispatchEvent(new Event("change"));
    }

    function popTag(tag) {
        tags.delete(tag);
        update()
    }

    function pushTag(tag) {
        tags.add(tag);
        update()
    }

    parseHiddenValue();
    updateCurrentContainer();

    const searchObject = bindSearch(container, suggestionsUrl, {t: "tag"},
        (entry) => {
            if (entry != null) pushTag(entry.label);
            searchObject.clear();
        });

    const inputEndChars = " ,;";

    searchInput.addEventListener("input", () => {
        const value = searchInput.value;
        if (inputEndChars.includes(value.charAt(value.length - 1))) {
            const tag = value.substring(0, value.length - 1).trim();
            if (tag.length > 0) {
                pushTag(tag);
            }
        }
    });

    searchInput.addEventListener("keydown", (e) => {
        if (e.key == "Enter") {
            e.preventDefault();
            e.stopPropagation();
            const value = searchInput.value.trim();
            if (value.length > 0) {
                pushTag(value);
            }
        } else if (e.key == "Backspace") {
            if (searchInput.value == "") {
                const lastTagButton = container.querySelector(".input-tags-current button:last-child");
                if (lastTagButton != null) {
                    popTag(lastTagButton.textContent.trim());
                }
            }
        }
    });

}

function bindCalendar(container, exportButton, options) {

    const monthLabels = ["jan.", "feb.", "mar.", "apr.", "may", "june", "july", "aug.", "sep.", "oct.", "nov.", "dec."];
    const dayLabels = ["mon.", "tue.", "wed.", "thu.", "fri.", "sat.", "sun."];
    const levelsCount = 10; // 0 to 9 included, and "more"

    const baseUrl = location.origin + location.pathname;
    const baseParams = new URLSearchParams(document.location.search);

    if (options == undefined) options = {};
    if (!("showHeader" in options)) options.showHeader = true;
    if (!("defaultMode" in options)) options.defaultMode = "yearly";
    if (!("relativeLevels" in options)) options.relativeLevels = false;
    if (!("levelKey" in options)) options.levelKey = null;
    if (!("additionnalClassName" in options)) options.additionnalClassName = null;
    if (!("inflateDetails" in options)) options.inflateDetails = (detailsContainer, entries, isPopover) => {
        for (const entry of entries) {
            let el;
            if ("href" in entry) {
                el = create(detailsContainer, "a", "ellipsis link-hidden");
                el.href = entry.href;
            } else {
                el = create(detailsContainer, "span", "ellipsis");
            }
            if ("icon" in entry) {
                create(el, "i").className = entry.icon;
            }
            create(el, "span").textContent = entry.label;
        }
    }

    const now = new Date();
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth();

    function fetchData(mode, dtStart, dtEnd) {
        
        const getParams = new URLSearchParams(baseParams);
        getParams.set("format", "json");
        getParams.set("start", dtf(dtStart, "YYYY-mm-dd"));
        getParams.set("end", dtf(dtEnd, "YYYY-mm-dd"));
        const url = baseUrl + "?" + getParams.toString();

        const exportParams = new URLSearchParams(getParams);
        exportParams.set("format", "tsv");
        exportButton.href = baseUrl + "?" + exportParams.toString();

        fetch(url).then(res => res.json()).then(flatData => {
            const data = {};
            for (const entry of flatData.entries) {
                const key = dtf(new Date(entry.dt), "YYYY-mm-dd");
                if (!(key in data)) {
                    data[key] = [];
                }
                data[key].push(entry);
            }
            let maxDt = Math.max(new Date(), new Date(flatData.maxdt));
            inflateData(mode, dtStart, dtEnd, data, new Date(flatData.mindt), maxDt);
        });
    }

    function getPeriodLabel(mode, dtStart) {
        if (mode == "yearly" || mode == "weekly") {
            return dtStart.getFullYear();
        } else if (mode == "monthly") {
            return `${monthLabels[dtStart.getMonth()]} ${dtStart.getFullYear()}`;
        } else {
            throw new Error(`Invalid mode ${mode}`);
        }
    }

    function getPreviousPeriod(mode, dtStart) {
        if (mode == "yearly" || mode == "weekly") {
            return {dtStart: new Date(dtStart.getFullYear() - 1, 0, 1), dtEnd: new Date(dtStart.getFullYear() - 1, 11, 31)};
        } else if (mode == "monthly") {
            return {dtStart: new Date(dtStart.getFullYear(), dtStart.getMonth() - 1, 1), dtEnd: new Date(dtStart.getFullYear(), dtStart.getMonth(), 0)};
        } else {
            throw new Error(`Invalid mode ${mode}`);
        }
    }

    function getNextPeriod(mode, dtStart) {
        if (mode == "yearly" || mode == "weekly") {
            return {dtStart: new Date(dtStart.getFullYear() + 1, 0, 1), dtEnd: new Date(dtStart.getFullYear() + 1, 11, 31)};
        } else if (mode == "monthly") {
            return {dtStart: new Date(dtStart.getFullYear(), dtStart.getMonth() + 1, 1), dtEnd: new Date(dtStart.getFullYear(), dtStart.getMonth() + 2, 0)};
        } else {
            throw new Error(`Invalid mode ${mode}`);
        }
    }

    function inflateData(mode, dtStart, dtEnd, data, minDt, maxDt) {

        container.innerHTML = "";
        container.className = `calendar calendar--${mode}`;
        if (options.additionnalClassName != null) container.classList.add(options.additionnalClassName);

        if (options.showHeader) {
            const header = create(container, "div", "calendar-header");

            const prevButton = create(header, "button", "calendar-button");
            prevButton.textContent = "‹";
            prevButton.title = getPeriodLabel(mode, getPreviousPeriod(mode, dtStart).dtStart);
            const prevPeriod = getPreviousPeriod(mode, dtStart);
            if (prevPeriod.dtEnd < minDt) {
                prevButton.setAttribute("disabled", "");
            } else {
                prevButton.onclick = () => {fetchData(mode, prevPeriod.dtStart, prevPeriod.dtEnd)};
            }

            create(header, "span", "calendar-year").textContent = getPeriodLabel(mode, dtStart);

            const nextButton = create(header, "button", "calendar-button");
            nextButton.textContent = "›";
            nextButton.title = getPeriodLabel(mode, getNextPeriod(mode, dtStart).dtStart);
            const nextPeriod = getNextPeriod(mode, dtStart);
            if (nextPeriod.dtStart > maxDt) {
                nextButton.setAttribute("disabled", "");
            } else {
                nextButton.onclick = () => {fetchData(mode, nextPeriod.dtStart, nextPeriod.dtEnd)};
            }

            const changeModeButton = create(header, "button", "button-inline");
            changeModeButton.textContent = "❖";
            changeModeButton.title = "Change view mode";
            changeModeButton.onclick = () => {
                let newMode, newDtStart, newDtEnd;
                switch(mode) {
                    case "yearly":
                        newMode = "weekly";
                        newDtStart = dtStart;
                        newDtEnd = dtEnd;
                        break;
                    case "weekly":
                        newMode = "monthly";
                        newDtStart = new Date(nowYear, nowMonth, 1);
                        newDtEnd = new Date(nowYear, nowMonth + 1, 0);
                        break;
                    case "monthly":
                        newMode = "yearly";
                        newDtStart = new Date(nowYear, 0, 1);
                        newDtEnd = new Date(nowYear, 11, 31);
                        break;
                    default:
                        throw new Error(`Invalid mode ${mode}`);
                }
                fetchData(newMode, newDtStart, newDtEnd);
            }
        }

        const body = create(container, "div", "calendar-body");
        const cells = [];

        if (mode == "weekly") {
            const currentYear = dtStart.getFullYear();
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
        } else if (mode == "yearly") {
            const currentYear = dtStart.getFullYear();
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
                    create(monthRow, "div", "calendar-month-name").textContent = monthLabels[dt.getMonth()];
                }
                const dayCell = create(monthRow, "div", "calendar-day");
                const key = dtf(dt, "YYYY-mm-dd");
                dayCell.setAttribute("date", key);
                cells.push(dayCell);
                dt.setDate(dt.getDate() + 1);
            }
        } else if (mode == "monthly") {

            const weekdayOffset = (dtStart.getDay() + 6) % 7;
            const daysInMonth = dtEnd.getDate();
            const weekCount = Math.ceil((daysInMonth + weekdayOffset) / 7);

            const firstRow = create(body, "div", "calendar-row");
            for (let i = 0; i < 7; i++) {
                const cell = create(firstRow, "div", "calendar-day-number");
                cell.textContent = dayLabels[i];
            }

            const rows = [];
            for (let i = 0; i < weekCount; i++) {
                rows.push(create(body, "div", "calendar-row"));
            }
            for (let i = 0; i < weekCount; i++) {
                for (let j = 0; j < 7; j++) {
                    cells.push(create(rows[i], "div", "calendar-day"));
                }
            }

            for (let i = 0; i < weekdayOffset; i++) cells[i].classList.add("disabled");
            for (let i = daysInMonth + weekdayOffset; i < cells.length; i++) cells[i].classList.add("disabled");
            for (let i = weekdayOffset; i < daysInMonth + weekdayOffset; i++) {
                const dt = new Date(dtStart);
                dt.setDate(dt.getDate() + i - weekdayOffset);
                const key = dtf(dt, "YYYY-mm-dd");
                cells[i].setAttribute("date", key);
                if (key in data) {
                    options.inflateDetails(create(cells[i], "div", "calendar-day-body"), data[key], false);
                }
            }

        }

        let maxValue = -1;
        if (options.relativeLevels) {
            for (let i = 0; i < cells.length; i++) {
                const key = cells[i].getAttribute("date");
                if (key in data) {
                    let value = 0;
                    if (options.levelKey == null) {
                        value = data[key].length;
                    } else if (data[key].length > 0) {
                        value = data[key][0][options.levelKey];
                    }
                    maxValue = Math.max(maxValue, value);
                }
            }
        }

        for (let i = 0; i < cells.length; i++) {
            const dayCell = cells[i];
            const key = dayCell.getAttribute("date");
            if (key in data) {
                let value = 0;
                if (options.levelKey == null) {
                    value = data[key].length;
                } else if (data[key].length > 0) {
                    value = data[key][0][options.levelKey];
                }
                if (options.relativeLevels) {
                    value = Math.ceil(levelsCount * value / maxValue);
                }
                if (value >= levelsCount) {
                    dayCell.classList.add("filled-more");
                } else {
                    dayCell.classList.add(`filled-${value}`);
                }
                if ("href" in data[key][0]) {
                    dayCell.addEventListener("click", () => {
                        window.location.href = data[key][0].href;
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
                    create(popover, "span", "hint").textContent = key;
                    options.inflateDetails(popover, data[key], true);
                    const cellBounds = dayCell.getBoundingClientRect();
                    const popoverBounds = popover.getBoundingClientRect();
                    const maxLeft = window.innerWidth - popoverBounds.width;
                    const minLeft = 0;
                    const centeredLeft = cellBounds.left + (cellBounds.width - popoverBounds.width) / 2;
                    popover.style.left = Math.min(maxLeft, Math.max(minLeft, (centeredLeft))) + "px";
                    popover.style.top = (cellBounds.top + cellBounds.height) + "px";
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

    if (options.defaultMode == "yearly" || options.defaultMode == "weekly") {
        fetchData(options.defaultMode, new Date(nowYear, 0, 1), new Date(nowYear, 11, 31));
    } else if (options.defaultMode == "monthly") {
        fetchData(options.defaultMode, new Date(nowYear, nowMonth, 1), new Date(nowYear, nowMonth + 1, 0));
    } else {
        throw new Error(`Invalid mode ${mode}`);
    }

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

function bindSubmitConfirm(input) {
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
}

function bindDocumentInput(container, suggestionsUrl, documentsUrl) {
    const inputText = container.querySelector(".search-input");
    const inputNonce = container.querySelector("input[name='document']");
    const searchSuggestions = container.querySelector(".search-suggestions");
    const searchCurrent = container.querySelector(".search-current");
    const searchCurrentLabel = searchCurrent.querySelector("span");
    const searchCurrentButton = searchCurrent.querySelector("button");
    bindSearch(
        container,
        suggestionsUrl,
        {t: "document"},
        (entry) => {
            if (entry != null) {
                inputText.value = "";
                searchSuggestions.innerHTML = "";
                searchCurrent.classList.add("show");
                searchCurrentLabel.textContent = entry.label;
                inputNonce.value = entry.ref;
            }
        });
    searchCurrentButton.onclick = (e) => {
        e.preventDefault();
        searchCurrent.classList.remove("show");
        inputText.focus();
        inputNonce.value = "";
    }
    if (inputNonce.value != "") {
        fetch(`${documentsUrl}?part=snippet&nonce=${inputNonce.value}`)
            .then(res => res.json())
            .then(data => {
            if (data.results.length > 0) {
                const snippet = data.results[0];
                searchCurrent.classList.add("show");
                searchCurrentLabel.textContent = snippet.title;
            }
        });
    }
}

function bindCreateForm(form, elementName) {
    form.onsubmit = (e) => {
        e.preventDefault();
        setTimeout(() => {
            if (elementName == undefined) elementName = e.submitter.value;
            const title = prompt(`Create ${elementName}`, "Untitled");
            if (title == null || title.trim() == "") return;
            form.querySelector("input[name=title]").value = title.trim();
            form.submit();
        }, 1);
    }
}