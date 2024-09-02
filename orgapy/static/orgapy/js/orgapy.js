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
                toast("An error occured", 600);
            }
        })
        .catch(err => {
            console.error(err);
            toast("An error occured", 600);
        });
}

function fetchApiPost(action, body, onSuccess=null) {
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

function bindSearchbarSuggestions(searchbar, apiAction) {
    window.addEventListener("load", () => {
        const input = searchbar.querySelector(".searchbar-input");
        const icon = searchbar.querySelector(".searchbar-icon");
        const container = searchbar.querySelector(".searchbar-suggestions");
        icon.addEventListener("click", () => {
            input.value = "";
            container.innerHTML = "";
            input.focus();
        });
        input.addEventListener("input", () => {
            container.innerHTML = "";
            const query = input.value.trim();
            fetch(URL_API + `?action=${apiAction}&q=${query}`).then(res => res.json()).then(data => {
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
                replace: `<div class="sheet-seed" sheet-id="$1"></div>`
            }
        ]
    });
    element.innerHTML = converter.makeHtml(element.innerHTML);
    element.querySelectorAll("p").forEach(paragraph => {
        paragraph.innerHTML = paragraph.innerHTML.replace(/(\w) ([:\?!;»€°])/g, "$1 $2").replace(/([«°]) (\w)/g, "$1 $2");;
    });
    window.addEventListener("load", () => {
        hljs.highlightAll();
    });
    if (element.querySelectorAll(".sheet-seed").length > 0) {
        initialize_sheets(true, true); // TODO: rename this function
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
        }, 500);
    }, duration);
}

/*******************************************************************************
 * OLD STUF
 *******************************************************************************
 */

 window.addEventListener("load", () => {
    document.querySelectorAll(".link-confirm").forEach(link => {
        link.addEventListener("click", (event) => {
            event.preventDefault();
            if (confirm("This can not be undone. Please confirm your decision.")) {
                window.location.href = link.href;
            }
        });
    });

    function row_is_lower(x, y) {
        const float_x = parseFloat(x.textContent);
        const float_y = parseFloat(y.textContent);
        if (!isNaN(float_x) && !isNaN(float_y)) {
            return float_x < float_y;
        } else {
            return x.textContent.toLowerCase() > y.textContent.toLowerCase();
        }
    }

    document.querySelectorAll("table.sortable").forEach(table => {
        table.querySelectorAll("thead th").forEach((th, thi) => {
            th.addEventListener("click", () => {
                let switching = true;
                while (switching) {
                    switching = false;
                    rows = table.rows;
                    for (i = 1; i < (rows.length - 1); i++) {
                        shouldSwitch = false;
                        x = rows[i].getElementsByTagName("TD")[thi];
                        y = rows[i + 1].getElementsByTagName("TD")[thi];
                        if (row_is_lower(x, y)) {
                            shouldSwitch = true;
                            break;
                        }
                    }
                    if (shouldSwitch) {
                        rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
                        switching = true;
                    }
                }
            });
        });
    });
});