function create_toc(content_container, toc_container) {    
    function removeToc() {
        toc_container.previousElementSibling.style.flexDirection = "column";
        toc_container.parentElement.removeChild(toc_container);
    }
    let bounds = content_container.getBoundingClientRect();
    if (bounds.height <= 0.8 * window.innerHeight) {
        removeToc();
        return;
    };
    let titles = content_container.querySelectorAll("h2");
    if (titles.length < 2) {
        removeToc();
        return;
    }
    toc_container.innerHTML = "<b>Contents</b>";
    titles.forEach(title => {
        let anchor = toc_container.appendChild(document.createElement("a"));
        anchor.classList.add("link-hidden");
        anchor.textContent = title.textContent;
        anchor.href = `#${title.id}`;
    });
}

