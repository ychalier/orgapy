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

function showModal(modalId) {
    document.getElementById(modalId).classList.add("active");
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove("active");
}

function bindSearchbarClearIcon(searchbar) {
    window.addEventListener("load", () => {
        const input = searchbar.querySelector(".searchbar-input");
        const icon = searchbar.querySelector(".searchbar-icon");
        const suggestionsContainer = searchbar.querySelector(".searchbar-suggestions");
        icon.addEventListener("click", () => {
            input.value = "";
            input.focus();
            if (suggestionsContainer != null) {
                suggestionsContainer.innerHTML = "";
            }
        });
    });
}

function bindSearchbarSuggestions(searchbar, apiAction) {
    window.addEventListener("load", () => {
        const input = searchbar.querySelector(".searchbar-input");
        const container = searchbar.querySelector(".searchbar-suggestions");
        var selected = null;
        var results;
        var elements = [];
        input.addEventListener("input", () => {
            const query = input.value.trim();
            fetch(URL_API + `?action=${apiAction}&q=${encodeURIComponent(query)}`).then(res => res.json()).then(data => {
                results = data.results;
                container.innerHTML = "";
                selected = null;
                elements = [];
                for (const [i, entry] of results.entries()) {
                    const element = document.createElement("a");
                    elements.push(element);
                    element.className = "searchbar-suggestion";
                    container.appendChild(element);
                    element.href = entry.url;               
                    element.innerHTML = `<mark>${ entry.title.slice(0, query.length) }</mark>${ entry.title.slice(query.length) }`;
                    element.addEventListener("mouseenter", () => {
                        selected = i;
                        element.classList.add("hovered");
                    });
                    element.addEventListener("mouseleave", () => {
                        selected = null;
                        element.classList.remove("hovered");
                    });
                }
            });
        });
        input.addEventListener("keydown", (event) => {
            if (event.key == "Enter") {
                if (selected != null) {
                    event.preventDefault();
                    window.location.href = results[selected].url;
                }
            } else if (event.key == "ArrowDown" && results.length > 0) {
                event.preventDefault();
                if (selected == null) {
                    selected = 0;
                } else {
                    selected = Math.min(selected + 1, results.length - 1);
                }
                container.querySelectorAll(".hovered").forEach(element => {
                    element.classList.remove("hovered");
                });
                elements[selected].classList.add("hovered");
            } else if (event.key == "ArrowUp" && results.length > 0) {
                event.preventDefault();
                if (selected == null) {
                    selected = results.length - 1;
                } else if (selected == 0) {
                    selected = null;
                } else {
                    selected = Math.max(0, selected - 1);
                }
                container.querySelectorAll(".hovered").forEach(element => {
                    element.classList.remove("hovered");
                });
                if (selected != null) {
                    elements[selected].classList.add("hovered");
                }
            }
        });
    });
}

function markdownToHtmlFancy(element, useKatex=false) {
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
                replace: `<a class="reference" href="$2" ref-id="$2">$1</a>`
            },
            {
                type: "output",
                regex: /@sheet\/(\d+)/g,
                replace: `<iframe src="../sheets/$1?embed=1"></iframe><a href="../sheets/$1"><small>Edit sheet</small></a>`
            },
            {
                type: "output",
                regex: /@map\/(\d+)/g,
                replace: `<iframe src="../maps/$1?embed=1"></iframe><a href="../maps/$1"><small>Edit map</small></a>`
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
    element.querySelectorAll(".reference").forEach(noteReference => {
        fetch(URL_API + `?action=note-title&objectId=${noteReference.getAttribute("ref-id")}`).then(res => {
            if (res.status == 404) {
                return "<404 Not Found>";
            } else {
                return res.text();
            }
        }).then(text => {
            noteReference.textContent = text;
        });
    });
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

function markdownToHtml(selector, fancy=false, useKatex=false) {
    document.querySelectorAll(selector).forEach(element => {
        if (fancy) {
            markdownToHtmlFancy(element, useKatex);
        } else {
            markdownToHtmlBasic(element);
        }
    });
}

const TOAST_LONG = 3500;
const TOAST_SHORT = 2000;

function toast(message, duration) {
    let snackbar = document.getElementById("snackbar");
    snackbar.textContent = message;
    snackbar.className = "show";
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

    function hideDropdown(timeout=300) {
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
        const padding = 14;
        menu.style.position = "absolute";
        menu.style.zIndex = 9999;
        const toggleBounds = toggle.getBoundingClientRect();
        const menuBounds = menu.getBoundingClientRect();
        const fitsUnder = toggleBounds.bottom + padding + menuBounds.height <= window.innerHeight;
        const baseLeft = toggleBounds.left;
        const maxLeft = window.innerWidth - padding - menuBounds.width;
        const left = Math.max(padding, Math.min(baseLeft, maxLeft));
        menu.style.left = left + "px";
        if (fitsUnder) {
            menu.style.top = (toggleBounds.bottom + padding + window.scrollY) + "px";
        } else {
            menu.style.top = (toggleBounds.top - padding - menuBounds.height + window.scrollY) + "px";
        }
        document.body.prepend(menu);
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
            console.log(pageNumber);
            const baseUrl = window.location.protocol + '//' + window.location.host + window.location.pathname;
            console.log(baseUrl);
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

window.addEventListener("load", () => {
    document.querySelectorAll(".link-confirm").forEach(link => {
        link.addEventListener("click", (event) => {
            event.preventDefault();
            let message = link.getAttribute("message");
            if (message == null) {
                message = "This can not be undone. Please confirm your decision.";
            }
            if (confirm(message)) {
                window.location.href = link.href;
            }
        });
    });
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
});