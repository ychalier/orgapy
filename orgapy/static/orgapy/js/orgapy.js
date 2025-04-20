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
        input.addEventListener("input", () => {
            const query = input.value.trim();
            fetch(URL_API + `?action=${apiAction}&q=${query}`).then(res => res.json()).then(data => {
                container.innerHTML = "";
                for (const entry of data.results) {
                    const element = document.createElement("a");
                    element.className = "searchbar-suggestion";
                    container.appendChild(element);
                    element.href = entry.url;               
                    element.innerHTML = `<mark>${ entry.title.slice(0, query.length) }</mark>${ entry.title.slice(query.length) }`;
                }
            });
        });
    });
}

function markdownToHtmlFancy(element) {
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
            {
                type: "output",
                regex: /<table>/g,
                replace: `<div class="table-wrapper"><table class="table">`,
            },
            {
                type: "output",
                regex: /<input type="checkbox" disabled +style="([a-z: 0-9\-\.;]+)"( *checked)?> *(.*?) *\n/g,
                replace: `<input type="checkbox" style="$1"$2><span>$3</span>\n`
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
                regex: /style="margin: 0px 0\.35em 0\.25em \-1\.6em;/g,
                replace: `style="margin: 0px 0.35em 0.25em -1em;`
            },
            {
                type: "output",
                regex: /input type="checkbox" disabled/g,
                replace: `input type="checkbox" `
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
                regex: /input type="checkbox"/g,
                replace: `input type="checkbox" class="widget widget-checkbox"`
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

function markdownToHtml(selector, fancy=false) {
    document.querySelectorAll(selector).forEach(element => {
        if (fancy) {
            markdownToHtmlFancy(element);
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
    var hideTimeout = null;

    const toggle = dropdown.querySelector(".dropdown-toggle");
    const menu = dropdown.querySelector(".menu");

    function hideDropdown() {
        console.log("Hiding dropdown");
        hideTimeout = setTimeout(() => {
            dropdown.appendChild(menu);
        }, 300);
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
            if (!isToggleFocused) {
                hideDropdown();
            }
        }
        element.addEventListener("mousedown", onActiveIn);
        element.addEventListener("mouseup", onActiveOut);
        element.addEventListener("touchstart", onActiveIn);
        element.addEventListener("touchend", onActiveOut);
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
        if (!isElementFocused) {
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