const container = document.getElementById("quotes");
let data;

fetchApi(URL_API + "?action=search&category=quote", "get", null, searchResults => {
    const authors = {};
    for (const obj of searchResults.objects) {
        const author = obj.title.match(/^(.*?) \- /)[1];
        if (!(author in authors)) {
            authors[author] = [];
        }
        authors[author].push(obj);
    }
    container.innerHTML = "";
    const authorsList = [...Object.keys(authors)];
    authorsList.sort();
    for (const author of authorsList) {
        create(container, "b").textContent = author;
        const ul = create(container, "ul");
        ul.style.marginTop = ".2rem";
        authors[author].sort((a, b) => a.title < b.title ? -1 : 1);
        for (const obj of authors[author]) {
            const a = create(create(ul, "li"), "a", "link-hidden");
            a.href = obj.href;
            a.textContent = obj.title.replace(author + " - ", "");
        }
    }
});
