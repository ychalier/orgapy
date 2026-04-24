var markdownConverter = new showdown.Converter({
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

const PROJECT_SAVE_TIMEOUT = 1000;

var projects = {};

/** Projects ******************************************************************/

function clearContextMenus() {
    let context_menus = document.querySelectorAll(".contextmenu");
    for (let i = 0; i < context_menus.length; i++) {
        document.body.removeChild(context_menus[i]);
    }
}

function addContextMenuOption(menu, iconClass, label, callback) {
    let option = menu.appendChild(document.createElement("li"));
    option.classList.add("menu-item");
    create(option, "button").innerHTML = `<i class="${iconClass}"></i> ${label}`;
    option.addEventListener("click", callback);
    return option;
}

class Project {

    constructor(parentContainer, data, etag, projectUrl, suggestionsUrl, forceExpand=false) {
        this.parentContainer = parentContainer;
        this.id = data.id;
        this.title = data.title == null ? null : (data.title == "" ? null : data.title);
        this.checklist = data.checklist;
        this.document = data.document;
        this.status = data.status;
        this.etag = etag;
        this.projectUrl = projectUrl;
        this.suggestionsUrl = suggestionsUrl;
        this.checklistItems = null;
        this.splitChecklist();
        this.expanded = false;
        this.container = null;
        this.previousProjectData = this.toJsonString();
        this.forceExpand = forceExpand;
        if (this.forceExpand) this.expanded = true;
        this.saveTimeout = null;
    }

    splitChecklist() {
        this.checklistItems = [];
        if (this.checklist == null) return;
        this.checklist.trim().split("\n").forEach(line => {
            this.checklistItems.push({
                state: line.trim().charAt("1") == "x",
                text: line.trim().slice(3).trim(),
            })
        });
    }

    concatChecklist() {
        let lines = [];
        this.checklistItems.forEach(item => {
            lines.push(`[${item.state ? "x" : " "}] ${item.text}`);
        });
        this.checklist = lines.join("\n");
    }

    setChecklistItemState(i, state) {
        this.checklistItems[i].state = state;
        this.concatChecklist();
    }

    setChecklistItemText(i, text) {
        this.checklistItems[i].text = text;
        this.concatChecklist();
    }

    onTitleInputChange(input) {
        this.container.classList.remove("editing");
        let titleString = input.value.trim();
        if (titleString == "") {
            this.title = null;
        } else {
            this.title = titleString.trim();
        }
        this.update("title");
    }

    inflateTitleInput(title) {
        this.container.classList.add("editing");
        let input = create(null, "input", "project-title-input");
        input.value = this.title == null ? "" : this.title;
        input.placeholder = "Project's title";
        input.addEventListener("click", (e) => {e.stopPropagation(); return false;});
        var self = this;
        const callback = () => {self.onTitleInputChange(input);};
        input.addEventListener("focusout", () => {setTimeout(callback, 100);});
        input.addEventListener("keydown", (e) => { if (e.key == "Enter") { callback(); } });
        title.replaceWith(input);
        input.focus();
    }

    openDocumentDialog() {
        var self = this;
        const dialog = create(this.container, "dialog");
        dialog.setAttribute("closedby", "any");
        const card = create(dialog, "div", "card");
        const documentIframe = create(card, "iframe", "plain");
        if (this.document != null) documentIframe.src = this.document.url + "?embed=1";
        documentIframe.width = 400;
        documentIframe.height = 400;
        const actionButtons = create(card, "div", "card-actions");
        const documentLink = create(actionButtons, "a", "button");
        documentLink.innerHTML = `<i class="ri-arrow-right-circle-line"></i><span>Go to document</span>`;
        if (this.document != null) documentLink.href = this.document.url;
        const documentEditLink = create(actionButtons, "a", "button");
        documentEditLink.innerHTML = `<i class="ri-pencil-fill"></i><span>Edit document</span>`;
        if (this.document != null) documentEditLink.href = this.document.url + "/edit";
        const documentClear = create(actionButtons, "span", "button button-danger");
        documentClear.innerHTML = `<i class="ri-close-line"></i><span>Unbind from project</span>`;

        function clearDocument() {
            if (confirm(`Unbind '${self.document.title}' from this project?`)) {
                dialog.close();
                self.unbindDocument();
            }
        }

        if (this.document == null) openDocumentInput();

        documentClear.addEventListener("click", clearDocument);
        dialog.showModal();
    }

    openDocumentInputDialog() {
        var self = this;
        const dialog = create(this.container, "dialog");
        dialog.setAttribute("closedby", "any");
        const card = create(dialog, "div", "card");
        create(card, "h2", "card-header").textContent = "Bind document";
        const cardBody = create(card, "div", "card-body");
        const container = create(cardBody, "div", "search");
        const input = create(create(container, "div", "search-bar"), "input", "search-input");
        create(container, "ul", "search-suggestions menu");

        let currentNonce = null;
        let currentTitle = null;
        let currentUrl = null;
        if (this.document != null) {
            input.value = this.document.title;
            currentNonce = this.document.nonce;
            currentTitle = this.document.title;
            currentUrl = this.document.url;
        }

        bindSearch(container, this.suggestionsUrl, {t: "note"},
            (entry) => {
                if (entry != null) {
                    currentNonce = entry.ref;
                    currentTitle = entry.label;
                    currentUrl = entry.url;
                }
                if (currentNonce != null && currentTitle != null && currentUrl != null) {
                    self.document = {
                        nonce: currentNonce,
                        title: currentTitle,
                        url: currentUrl
                    }
                }
                self.inflateHeader();
                self.save("document");
                dialog.close();
            });

        dialog.showModal();
        input.focus();
    }

    openStatusDialog() {
        var self = this;
        openProjectStatusDialog(newStatus => {
            this.status = newStatus;
            this.update("status");
        });
    }

    inflateHeader() {
        var self = this;
        let header = this.container.querySelector(".project-header");
        if (header == null) {
            header = create(this.container, "div");
            header.addEventListener("contextmenu", (event) => {
                event.preventDefault();
                self.inflateContextMenu(event); // cursor position required to position the menu
            });
        } else {
            header.innerHTML = "";
        }
        header.className = "project-header";

        const status = create(header, "span", "project-status label");
        status.setAttribute("status", this.status);
        if (this.status == "AC") {
            status.textContent = "ACTIVE";
        } else if (this.status == "IN") {
            status.textContent = "INACTIVE";
            status.classList.add("label-grey");
        } else if (this.status == "AR") {
            status.textContent = "ARCHIVED";
            status.classList.add("label-purple");
        } else if (this.status == "FU") {
            status.textContent = "FUTURE";
            status.classList.add("label-pink");
        }
        status.addEventListener("click", (e) => {
            e.stopPropagation();
            self.openStatusDialog();
        });

        const badge = create(header, "span", "project-badge");
        let total = 0;
        let completed = 0;
        this.checklistItems.forEach(item => {
            total++;
            if (item.state) completed++;
        });
        if (total == 0) {
            badge.classList.add("empty");
        } else if (completed == total) {
            badge.classList.add("done");
        } else {
            const progress = Math.floor(100 * completed / total);
            badge.style.background = `linear-gradient(90deg,rgba(37, 135, 50, 1)${progress}%,rgb(48, 48, 48) ${progress + 1}%)`
        }
        badge.innerHTML = `<i class="ri-checkbox-circle-line"></i> ${completed}/${total}`;

        if (this.document != null) {
            const documentSpan = create(header, "span", "project-document");
            documentSpan.textContent = this.document.title;
            documentSpan.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                self.openDocumentDialog();});
        }

        const title = create(header, "span", "project-title");
        title.textContent = this.title == null ? (this.document == null ? "Untitled" : "") : this.title;
        title.addEventListener("click", (event) => {
            event.stopPropagation();
            self.inflateTitleInput(title);
            return false;
        });

        header.tabIndex = 0;
        header.addEventListener("click", (event) => { if (!self.forceExpand) self.toggleExpanded(); });
        header.addEventListener("keydown", (event) => { if (!self.forceExpand && event.key == "Enter") self.toggleExpanded(); });
        header.addEventListener("dblclick", (event) => { self.inflateTitleInput(title); });
        header.addEventListener("mouseenter", (event) => {
            self.container.querySelector(".project-body").classList.add("glimpse");
        });
        header.addEventListener("mouseleave", (event) => {
            self.container.querySelector(".project-body").classList.remove("glimpse");
        });
    }

    inflateChecklistItemLabelInput(element, initialValue, entryIndex) {
        var self = this;
        let input = create(null, "input", "project-checklist-item-input");
        input.value = initialValue;
        input.placeholder = "Checklist item";
        function callback() {
            input.parentElement.classList.remove("editing");
            self.container.classList.remove("editing");
            let value = input.value.trim();
            if (value == "") {
                self.checklistItems.splice(entryIndex, 1);
                self.concatChecklist();
            } else {
                self.setChecklistItemText(entryIndex, value);
            }
            self.update("checklist");
        }
        input.addEventListener("focusout", callback);
        input.addEventListener("keydown", (e) => { if (e.key == "Enter") {
            callback();
            if (e.ctrlKey || e.altKey || e.shiftKey) {
                let checklist = self.container.querySelector(".project-checklist");
                self.addNewChecklistItem(checklist);
            }
        } });
        input.addEventListener("paste", (e) => {
            const text = e.clipboardData.getData("text/plain").trim();
            if (text.includes("\n")) {
                e.preventDefault();
                const lines = text.split("\n");
                input.parentElement.classList.remove("editing");
                self.container.classList.remove("editing");
                self.checklistItems[entryIndex].text = lines[0].trim();
                for (const line of lines.slice(1)) {
                    if (line.trim() == "") continue;
                    entryIndex++;
                    self.checklistItems.splice(entryIndex, 0, {state: false, text: line.trim()});
                }
                self.concatChecklist();
                self.update("checklist");
            }
        });
        element.replaceWith(input);
        input.focus();
        this.updateExpansion();
    }

    inflateChecklistItems(checklist) {
        var self = this;
        checklist.innerHTML = "";
        this.checklistItems.forEach((item, i) => {
            let checklistItem = create(checklist, "div", "project-checklist-item");
            let checkbox = create(checklistItem, "input");
            checkbox.type = "checkbox";
            checkbox.tabIndex = -1;
            let label = create(checklistItem, "label");
            label.innerHTML = markdownConverter.makeHtml(item.text).slice(3, -4); // slice to remove <p> tag
            if (item.state) {
                checkbox.checked = true;
                checklistItem.classList.add("project-checklist-item-checked");
            }
            checkbox.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                self.setChecklistItemState(i, !item.state);
                self.update("checklist");
                return false;
            });
            label.addEventListener("click", (event) => {
                event.stopPropagation();
                self.container.classList.add("editing");
                checklistItem.classList.add("editing");
                self.inflateChecklistItemLabelInput(label, item.text, i);
                return false;
            });
        });
        dragRank(checklist, ".project-checklist-item", (ordering, permutation) => {
            dragRankReorder(self.checklistItems, permutation);
            self.concatChecklist();
            self.update("checklist");
        }, {
            dragAllowed: (element) => { return !element.classList.contains("editing"); }
        });
    }

    addNewChecklistItem(checklist) {
        this.checklistItems.push({state: false, text: ""});
        this.concatChecklist();
        this.inflateChecklistItems(checklist);
        let element = checklist.querySelector(".project-checklist-item:last-child label");
        this.inflateChecklistItemLabelInput(element, "", this.checklistItems.length - 1);
    }

    inflateChecklist(body) {
        var self = this;
        let checklist = create(body, "div", "project-checklist");
        this.inflateChecklistItems(checklist);
        const buttons = create(checklist, "div", "project-buttons");

        function addButton(label, iconClass, title, onClick) {
            const buttonAddItem = create(buttons, "button", "project-button");
            buttonAddItem.title = title;
            buttonAddItem.innerHTML = `<i class="${iconClass}"></i> ${label}`;
            buttonAddItem.tabIndex = -1;
            buttonAddItem.addEventListener("click", (event) => {
                event.stopPropagation();
                onClick();
                return false;
            });
        }

        addButton("Add", "ri-add-line", "Add checklist item", () => { self.addNewChecklistItem(checklist) });
        addButton("Clear", "ri-close-line", "Clear completed items", () => { self.clearChecklist() });
        addButton("Copy", "ri-file-copy-2-line", "Copy as Markdown", () => {
            navigator.clipboard.writeText(self.toMarkdown());
            toast("Copied to clipboard!", 600);
        });

        return checklist;
    }

    expand() {
        let body = this.container.querySelector(".project-body");
        body.classList.remove("glimpse");
        let height = 0;
        this.container.querySelectorAll(".project-body > *").forEach(child => {
            let bounds = child.getBoundingClientRect();
            height += bounds.height;
            let style = child.currentStyle || window.getComputedStyle(child);
            height += parseFloat(style.marginTop.replace("px", "")) + parseFloat(style.marginBottom.replace("px", ""));
        });
        body.style.height = height + "px";
    }

    contract() {
        let body = this.container.querySelector(".project-body");
        body.classList.remove("glimpse");
        body.style.height = 0;
    }

    updateExpansion() {
        if (this.expanded) {
            this.expand();
        } else {
            this.contract();
        }
    }

    toggleExpanded() {
        this.expanded = !this.expanded;
        this.updateExpansion();
    }

    inflateBody() {
        let body = this.container.querySelector(".project-body");
        if (body == null) {
            body = create(this.container, "div");
        } else {
            body.innerHTML = "";
        }
        body.tabIndex = -1;
        body.className = "project-body";
        this.inflateChecklist(body);
        this.updateExpansion();
        return body;
    }

    inflate() {
        this.container.innerHTML = "";
        this.container.className = `project`;
        if (this.status == "AR") {
            this.container.classList.add("archived");
        } else if (this.status == "IN") {
            this.container.classList.add("inactive");
        } else if (this.status == "FU") {
            this.container.classList.add("future");
        }
        this.inflateHeader();
        this.inflateBody();
    }

    inflateContextMenuItems(menu) {
        var self = this;
        if (this.title == null && this.document != null) {
            addContextMenuOption(menu, "ri-input-field", "Set title", () => {self.inflateTitleInput(self.container.querySelector(".project-header .project-title"))});
        }
        if (this.document == null) {
            addContextMenuOption(menu, "ri-sticky-note-line", "Bind document", () => {self.openDocumentInputDialog()});
        } else {
            addContextMenuOption(menu, "ri-sticky-note-line", "Unbind document", () => {self.unbindDocument()});
        }
        addContextMenuOption(menu, "ri-checkbox-circle-line", "Change status", () => {self.openStatusDialog()});
        const option = addContextMenuOption(menu, "ri-delete-bin-line", "Delete", () => {self.delete()});
        option.querySelector("button").classList.add("button-danger");
    }

    inflateContextMenu(event) {
        clearContextMenus();
        let menu = create(document.body, "ul", "contextmenu menu");
        this.inflateContextMenuItems(menu);
        let bounds = menu.getBoundingClientRect();
        menu.style.left = Math.min(event.clientX, window.innerWidth - (bounds.width + 8)) + "px";
        menu.style.top = Math.min(event.clientY, window.innerHeight - (bounds.height + 8)) + "px";
    }

    create() {
        this.container = document.createElement("div");
        this.inflate();
        return this.container;
    }

    delete() {
        var self = this;
        if (confirm(`Do you want to delete '${this.reference()}'?`) == true) {
            const formData = new FormData();
            formData.append("csrfmiddlewaretoken", CSRF_TOKEN);
            formData.append("etag", this.etag);
            formData.append("delete", "on");
            fetch(this.projectUrl, {
                method: "POST",
                body: formData,
                headers: {
                    "If-Match": this.etag,
                    "X-Requested-With": "XMLHttpRequest"
                }})
            .then(res => {
                if (res.status == 204) {
                    toast("Deleted!", 600);
                } else if (res.status == 412) {
                    toast("Conflict detected", 600);
                } else {
                    toast(`An error occurred: ${res.status}`, 600);
                }
            });
            remove(this.parentContainer);
        }
    }

    setStatus(newStatus) {
        this.status = newStatus;
        this.save("status");
    }

    toMarkdown() {
        let rows = [];
        rows.push(`# ${this.reference()}\n`);
        if (this.checklist != null) {
            this.checklistItems.forEach(item => {
                rows.push("- [" + (item.state ? "x" : " ") + "] " + item.text);
            });
        }
        return rows.join("\n");
    }

    toDict() {
        return {
            title: this.title == null ? "" : this.title,
            checklist: this.checklist,
            document: this.document == null ? "" : this.document.nonce,
            status: this.status,
        }
    }

    toJsonString() {
        return JSON.stringify(this.toDict());
    }

    save(...keys) {
        var self = this;
        function actuallySave() {
            const projectData = self.toDict();
            const projectString = JSON.stringify(projectData);
            if (projectString == self.previousProjectData) {
                console.log("No change detected, skipping save");
                return;
            }
            self.previousProjectData = projectString;
            const formData = new FormData();
            formData.append("csrfmiddlewaretoken", CSRF_TOKEN);
            formData.append("etag", self.etag);
            for (const key of keys) {
                formData.append(key, projectData[key]);
            }
            fetch(self.projectUrl, {
                method: "POST",
                body: formData,
                headers: {
                    "If-Match": self.etag,
                    "X-Requested-With": "XMLHttpRequest"
                }})
            .then(res => {
                if (res.status == 204) {
                    const newEtag = res.headers.get("ETag");
                    if (newEtag) self.etag = newEtag;
                    toast("Saved!", 600);
                } else if (res.status == 412) {
                    toast("Conflict detected", 600);
                } else {
                    toast(`An error occurred: ${res.status}`, 600);
                }
            });
        }
        if (this.saveTimeout != null) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(actuallySave, PROJECT_SAVE_TIMEOUT);
    }

    update(...keys) {
        this.save(...keys);
        this.inflate();
    }

    reference() {
        if (this.document != null && this.title != null) {
            return `${this.document.title} - ${this.title}`;
        } else if (this.document != null) {
            return this.document.title;
        } else if (this.title != null) {
            return this.title;
        } else {
            return "Untitled";
        }
    }

    clearChecklist() {
        let toClear = 0;
        for (let i = this.checklistItems.length - 1; i >= 0; i--) {
            if (this.checklistItems[i].state) toClear++;
        }
        if (toClear == 0) return;
        if (!confirm(`Do you want to clear ${toClear} item${toClear > 1 ? "s" : ""} from '${this.reference()}'?`)) return;
        for (let i = this.checklistItems.length - 1; i >= 0; i--) {
            if (this.checklistItems[i].state) {
                this.checklistItems.splice(i, 1);
            }
        }
        if (this.checklistItems.length != 0) {
            this.concatChecklist();
        }
        this.update("checklist");
    }

    unbindDocument() {
        this.document = null;
        this.update("document");
    }

}

function bindProject(container, suggestionsUrl, forceExpand=false) {
    const projectUrl = container.getAttribute("href");
    fetch(projectUrl + "?format=json", {cache: "no-cache"})
        .then(res => {
            const etag = res.headers.get("ETag").replaceAll("\"", "");
            return res.json().then(projectData => ({etag, projectData}));
        })
        .then(({etag, projectData}) => {
            const project = new Project(container, projectData, etag, projectUrl, suggestionsUrl, forceExpand);
            const element = project.create()
            container.appendChild(element);
        });
}

function bindCreateProjectButton(createButton, projectsContainer, projectsUrl, suggestionsUrl, documentNonce=null) {
    createButton.addEventListener("click", () => {
        const title = prompt("Enter project title", "Untitled");
        if (title) {
            const formData = new FormData();
            formData.append("csrfmiddlewaretoken", CSRF_TOKEN);
            formData.append("title", title);
            if (documentNonce != null) formData.append("document", documentNonce);
            fetch(projectsUrl, {method: "POST", body: formData})
                .then(res => {
                    const etag = res.headers.get("ETag").replaceAll("\"", "");
                    return res.json().then(projectData => ({etag, projectData}));
                })
                .then(({etag, projectData}) => {
                    if (projectsContainer == null) {
                        window.location.reload();
                    } else {
                        const container = create(projectsContainer, "div");
                        const project = new Project(container, projectData, etag, projectData.url, suggestionsUrl);
                        const element = project.create()
                        container.appendChild(element);
                    }
                });
        }
    });
}

function openProjectStatusDialog(onNewStatus) {
    const dialog = create(document.body, "dialog");
    dialog.setAttribute("closedby", "any");
    const card = create(dialog, "div", "card");
    create(card, "b", "card-header").textContent = "Set project status";
    const cardBody = create(card, "div", "card-body");
    const row = create(cardBody, "div", "row");
    for (const [value, name, labelClass] of [["AC", "ACTIVE", ""], ["IN", "INACTIVE", "label-grey"], ["AR", "ARCHIVED", "label-purple"], ["FU", "FUTURE", "label-pink"]]) {
        const option = create(row, "button", "label " + labelClass);
        option.textContent = name;
        option.addEventListener("click", () => {
            dialog.close();
            onNewStatus(value);
        });
    }
    dialog.addEventListener("close", () => {
        document.body.removeChild(dialog);
    });
    dialog.showModal();
}

window.addEventListener("click", clearContextMenus);