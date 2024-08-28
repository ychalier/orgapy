function markdown_to_html_fancy(element) {
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
        initialize_sheets(true, true);
    }
}


function markdown_to_html_basic(element) {
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


function markdown_to_html(selector, fancy=false) {
    document.querySelectorAll(selector).forEach(element => {
        if (fancy) {
            markdown_to_html_fancy(element);
        } else {
            markdown_to_html_basic(element);
        }
    });
}