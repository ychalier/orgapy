function create_toc(content_container, toc_container) {
    let bounds = content_container.getBoundingClientRect();
    if (bounds.height <= 0.8 * window.innerHeight) return;
    let titles = content_container.querySelectorAll("h2");
    if (titles.length < 2) return;
    toc_container.innerHTML = "<b>Contents</b>";
    titles.forEach(title => {
        let anchor = toc_container.appendChild(document.createElement("a"));
        anchor.classList.add("link-hidden");
        anchor.textContent = title.textContent;
        anchor.href = `#${title.id}`;
    });
}

