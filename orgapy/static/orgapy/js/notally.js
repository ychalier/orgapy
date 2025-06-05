function setupNotallyImportProcess() {
    const inputDb = document.getElementById("input-db");
    inputDb.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (!file) return;
        openNotallyArchive(file);
    });
    const importButton = document.getElementById("button-import");
    importButton.addEventListener("click", importNotes);
}

async function openNotallyArchive(archiveFile) {
    const blobReader = new zip.BlobReader(archiveFile);
    const zipReader = new zip.ZipReader(blobReader);
    const entries = await zipReader.getEntries();
    if (entries.length === 0) {
        console.error("No files found in ZIP archive");
        return;
    }
    const firstEntry = entries[0];
    const blob = await firstEntry.getData?.(new zip.BlobWriter());
    readNotallyDatabase(blob);
    await zipReader.close();
}

function readNotallyDatabase(dbFile) {
    config = {
      locateFile: filename => `${STATIC_DEPENDENCIES_URL}${filename}`
    }
    initSqlJs(config).then(sql => {
        const fileReader = new FileReader();
        fileReader.onload = () => {
            const dbArray = new Uint8Array(fileReader.result);
            db = new sql.Database(dbArray);
            const query = db.prepare("SELECT * FROM BaseNote");
            const notes = [];
            while(query.step()) {
                const row = query.getAsObject();
                if (row.folder != "NOTES") continue;
                let body = row.body;
                if (row.type == "LIST") {
                    for (const item of JSON.parse(row.items)) {
                        body += `- [${item.checked || true ? "x" : " "}] ${item.body}\n`;
                    }
                }
                const note = {
                    title: row.title,
                    dateCreation: row.timestamp,
                    content: body
                };
                notes.push(note);
            }
            inflateNoteSelection(notes);
        }
        fileReader.readAsArrayBuffer(dbFile);
    });
}

function inflateNoteSelection(rawNotes) {
    const container = document.getElementById("selection");
    container.innerHTML = "";
    for (let i = 0; i < rawNotes.length; i++) {
        const note = rawNotes[i];
        const noteContainer = create(container, "div", "card-block raw-note");
        noteContainer.setAttribute("title", note.title);
        noteContainer.setAttribute("dateCreation", note.dateCreation);
        noteContainer.setAttribute("content", note.content);
        const noteHeader = create(noteContainer, "div", "oneline");
        const checkbox = create(noteHeader, "input");
        checkbox.type = "checkbox";
        checkbox.checked = true;
        create(noteHeader, "span", "note-date").textContent = (new Date(note.dateCreation)).toLocaleString();
        create(noteHeader, "span", "note-title oneline-truncate").textContent = note.title;
        create(noteContainer, "div", "note-content").innerHTML = note.content.replaceAll("\n", "<br>");
    }
    document.getElementById("button-import").removeAttribute("disabled");
}


function importNotes() {
    const data = [];
    for (const element of document.querySelectorAll("#selection .raw-note:has(input[type=checkbox]:checked)")) {
        data.push({
            title: element.getAttribute("title"),
            dateCreation: parseInt(element.getAttribute("dateCreation")) / 1000,
            content: element.getAttribute("content"),
        })
    }
    document.getElementById("input-data").value = JSON.stringify(data);
    document.getElementById("form-import").submit();
}