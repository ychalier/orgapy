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
document.querySelectorAll(".markdown").forEach(container => {
    container.innerHTML = converter.makeHtml(container.innerHTML);
});
if (document.querySelectorAll(".sheet-seed").length > 0) {
    initialize_sheets(true, true);
} else {
    //pass
}

window.addEventListener("load", () => {
    hljs.highlightAll();
});