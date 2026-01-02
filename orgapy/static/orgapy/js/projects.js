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
    create(option, "span").innerHTML = `<i class="${iconClass}"></i> ${label}`;
    option.addEventListener("click", callback);
}

class Project {

    constructor(parentContainer, data, forceExpand=false) {
        this.parentContainer = parentContainer;
        this.id = data.id;
        this.creation = data.creation;
        this.modification = data.modification;
        this.title = data.title == null ? null : (data.title == "" ? null : data.title);
        this.checklist = data.checklist;
        this.rank = data.rank;
        this.note = data.note;
        this.status = data.status;
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
        this.update();
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

    openNoteDialog() {
        var self = this;
        const dialog = create(this.container, "dialog");
        dialog.setAttribute("closedby", "any");
        const dialogHeader = create(dialog, "div", "dialog-header");
        const noteTitle = create(dialogHeader, "b");
        if (this.note != null) noteTitle.textContent = this.note.title;
        const noteLink = create(dialogHeader, "a", "action-button");
        noteLink.innerHTML = `<i class="ri-arrow-right-circle-line"></i>`;
        if (this.note != null) noteLink.href = this.note.url;
        const noteClear = create(dialogHeader, "span", "action-button");
        noteClear.innerHTML = `<i class="ri-close-line"></i>`;
        const noteIframe = create(dialog, "iframe", "dialog-body");
        if (this.note != null) noteIframe.src = this.note.url + "/standalone";
        noteIframe.width = 400;
        noteIframe.height = 400;

        function openNoteInput() {
            const noteTitleInputContainer = create(null, "div", "project-note-input");
            const noteTitleInput = create(noteTitleInputContainer, "input");
            noteTitleInput.type = "search";
            let currentId = null;
            let currentTitle = null;
            let currentUrl = null;
            if (self.note != null) {
                noteTitleInput.value = self.note.title;
                currentId = self.note.id;
                currentTitle = self.note.title;
                currentUrl = self.note.url;
            }
            const results = create(noteTitleInputContainer, "div", "project-note-results");
            bindDocumentInput(noteTitleInput, "note", results, (entry) => {
                if (entry != null) {
                    currentId = entry.id;
                    currentTitle = entry.title;
                    currentUrl = entry.url;
                }
                noteTitleInputContainer.replaceWith(noteTitle);
                if (currentTitle != null) {
                    noteTitle.textContent = currentTitle;
                }
                if (currentUrl != null) {
                    noteLink.href = currentUrl;
                    noteIframe.src = currentUrl + "/standalone";
                }
                if (currentId != null && currentTitle != null && currentUrl != null) {
                    self.note = {
                        id: currentId,
                        title: currentTitle,
                        url: currentUrl
                    }
                }
                self.inflateHeader();
                self.save();
            });
            noteTitle.replaceWith(noteTitleInputContainer);
            noteTitleInput.focus();
        }

        function clearNote() {
            if (confirm(`Unbind '${self.note.title}' from this project?`)) {
                dialog.close();
                self.unbindNote();
            }
        }

        if (this.note == null) openNoteInput();

        noteClear.addEventListener("click", clearNote);
        noteTitle.addEventListener("click", openNoteInput);
        dialog.showModal();
    }

    openStatusDialog() {
        var self = this;
        const dialog = create(this.container, "dialog");
        dialog.setAttribute("closedby", "any");
        const dialogHeader = create(dialog, "div", "dialog-header");
        create(dialogHeader, "b").textContent = this.reference();
        const dialogBody = create(dialog, "div", "dialog-body");
        const select = create(create(dialogBody, "p"), "select");
        for (const [optionName, optionValue] of [["Active", "AC"], ["Inactive", "IN"], ["Archived", "AR"]]) {
            const option = create(select, "option");
            option.textContent = optionName;
            option.value = optionValue;
            if (self.status == optionValue) option.selected = true;
        }
        select.addEventListener("change", () => {
            self.setStatus(select.options[select.selectedIndex].value);
            dialog.close();
        });
        const closeButton = create(create(dialogBody, "div", "row"), "button");
        closeButton.textContent = "Close";
        closeButton.addEventListener("click", () => {dialog.close();});
        dialog.showModal();
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
        }
        badge.innerHTML = `<i class="ri-checkbox-circle-line"></i> ${completed}/${total}`;
        badge.addEventListener("dblclick", (e) => {
            e.stopPropagation();
            self.openStatusDialog();
            return false;
        })

        if (this.note != null) {
            const noteSpan = create(header, "span", "project-note");
            noteSpan.textContent = this.note.title;
            noteSpan.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                self.openNoteDialog();});
        }

        const title = create(header, "span", "project-title");
        title.textContent = this.title == null ? (this.note == null ? "Untitled" : "") : this.title;
        title.addEventListener("click", (event) => {
            event.stopPropagation();
            self.inflateTitleInput(title);
            return false;
        });

        header.addEventListener("click", (event) => { if (!self.forceExpand) self.toggleExpanded(); });
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
            self.update();
        }
        input.addEventListener("focusout", callback);
        input.addEventListener("keydown", (e) => { if (e.key == "Enter") {
            callback();
            if (e.ctrlKey || e.altKey || e.shiftKey) {
                let checklist = self.container.querySelector(".project-checklist");
                self.addNewChecklistItem(checklist);
            }
        } });
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
                self.update();
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
            self.update();
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
        }
        this.inflateHeader();
        this.inflateBody();
        this.setStatusClass();
    }

    inflateContextMenuItems(menu) {
        var self = this;
        if (this.title == null && this.note != null) {
            addContextMenuOption(menu, "ri-input-field", "Set title", () => {self.inflateTitleInput(self.container.querySelector(".project-header .project-title"))});
        }
        if (this.note == null) {
            addContextMenuOption(menu, "ri-sticky-note-line", "Bind note", () => {self.openNoteDialog()});
        } else {
            addContextMenuOption(menu, "ri-sticky-note-line", "Unbind note", () => {self.unbindNote()});
        }
        addContextMenuOption(menu, "ri-pencil-fill", "Edit in admin", () => {
            window.location.href = URL_ADMIN_PROJECT_CHANGE + this.id;
        });
        addContextMenuOption(menu, "ri-checkbox-circle-line", "Status", () => {self.openStatusDialog()});
        addContextMenuOption(menu, "ri-delete-bin-line", "Delete", () => {self.delete()});
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
        this.container.setAttribute("project_id", this.id);
        this.container.setAttribute("id", `project-${this.id}`);
        this.inflate();
        return this.container;
    }

    delete() {
        var self = this;
        if (confirm(`Are you sure to delete '${this.title}'?`) == true) {
            apiPost("delete-project", {project_id: this.id}, () => {
                toast("Deleted!", 600);
                delete projects[self.id];
                inflateProjects(self.parentContainer);
            });
        }
    }

    setStatusClass() {
        if (this.status == "AC") {
            this.container.classList.remove("inactive");
            this.container.classList.remove("archived");
        } else if (this.status == "IN") {
            this.container.classList.add("inactive");
            this.container.classList.remove("archived");
        } else if (this.status == "AR") {
            this.container.classList.remove("inactive");
            this.container.classList.add("archived");
        } else {
            console.warn("Invalid status", this.status);
        }
    }

    setStatus(newStatus) {
        this.status = newStatus;
        this.setStatusClass();
        this.save();
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
            title: this.title,
            modification: this.modification,
            checklist: this.checklist,
            note: this.note,
            status: this.status,
        }
    }

    toJsonString() {
        return JSON.stringify(this.toDict());
    }

    save() {
        var self = this;
        function actuallySave() {
            let projectData = self.toJsonString();
            if (projectData == self.previousProjectData) {
                console.log("No change detected, skipping save");
                return;
            }
            self.previousProjectData = projectData;
            apiPost("edit-project",
                {
                    project_id: self.id,
                    project_data: projectData
                }, (data) => {
                    self.modification = data.modification;
                    toast("Saved!", 600);
                });
        }
        if (this.saveTimeout != null) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(actuallySave, PROJECT_SAVE_TIMEOUT);        
    }

    update() {
        this.save();
        this.inflate();
    }

    reference() {
        if (this.note != null && this.title != null) {
            return `${this.note.title} - ${this.title}`;
        } else if (this.note != null) {
            return this.note.title;
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
        if (!confirm(`Please confirm clearing ${toClear} item${toClear > 1 ? "s" : ""} from '${this.reference()}'`)) return;
        for (let i = this.checklistItems.length - 1; i >= 0; i--) {
            if (this.checklistItems[i].state) {
                this.checklistItems.splice(i, 1);
            }
        }
        if (this.checklistItems.length != 0) {
            this.concatChecklist();
        }
        this.update();
    }

    unbindNote() {
        this.note = null;
        this.update();
    }

}

class TemporaryProject extends Project {

    constructor(parentContainer, note, forceExpand=false) {
        super(
            parentContainer,
            {
                id: null,
                creation: new Date(),
                modification: new Date(),
                title: null,
                checklist: null,
                note: note == undefined ? null : note,
                status: "AC",
            },
            forceExpand);
        this.isTemporary = true;
    }

    onTitleInputChange(input) {
        this.container.classList.remove("editing");
        let titleString = input.value.trim();
        let title = titleString.trim();
        if (title == "") title = null;
        if (title == null) {
            if (!(confirm("Create project with no title?"))) {
                inflateProjects(this.parentContainer);
                return;
            }
        }
        var self = this;
        apiPost("create-project", {}, (data) => {
            projects[data.project.id] = new Project(self.parentContainer, data.project, self.forceExpand);
            projects[data.project.id].title = title;
            projects[data.project.id].note = self.note;
            inflateProjects(self.parentContainer);
            projects[data.project.id].save();
        });
    }

    create() {
        super.create();
        let title = this.container.querySelector(".project-title");
        this.inflateTitleInput(title);
        this.container.querySelector("input").focus();
        return this.container;
    }

}

const STORAGE_KEY_RANK = "orgapy.projects.ranks";

function saveProjectRanks(container, ordering) {
    let ranks = {};
    container.querySelectorAll(".project").forEach((project, i) => {
        let projectId = project.getAttribute("project_id");
        ranks[projectId] = ordering[i];
        projects[projectId].rank = ordering[i];
    });
    inflateProjects(container);
    let rankStorage = localStorage.getItem(STORAGE_KEY_RANK);
    if (rankStorage == null) {
        rankStorage = {};
    } else {
        rankStorage = JSON.parse(rankStorage);
    }
    rankStorage[window.location.pathname] = ranks;
    localStorage.setItem(STORAGE_KEY_RANK, JSON.stringify(rankStorage));
}

function inflateProjects(container) {
    dragRankClear();
    if (container == null) {
        console.log("Could not find projects container");
        return;
    }
    container.innerHTML = "";
    let projectIndices = [...Object.keys(projects)];
    projectIndices.sort((a, b) => projects[a].rank - projects[b].rank);
    projectIndices.forEach(projectId => {
        container.appendChild(projects[projectId].create());
    });
    dragRank(container, ".project", (ordering, permutation) => {
        setTimeout(() => {saveProjectRanks(container, ordering)}, 300);
    }, {
        dragAllowed: (element) => { return !element.classList.contains("editing"); }
    });
}

function fetchProjects(container, noteId=null, forceExpand=false, statusFilter=null, projectId=null) {
    let ranks = {};
    const rankStorage = localStorage.getItem(STORAGE_KEY_RANK);
    if (rankStorage != null) {
        const parsedRankStorage = JSON.parse(rankStorage);
        if (window.location.pathname in parsedRankStorage) {
            ranks = parsedRankStorage[window.location.pathname];
        }
    }
    const params = {action: "list-projects"};
    if (noteId != null) params["note"] = noteId;
    if (statusFilter != null) params["status"] = statusFilter;
    if (projectId != null) params["project"] = projectId;
    fetch(URL_API + "?" + (new URLSearchParams(params)).toString())
        .then(res => res.json())
        .then(data => {
            projects = {};
            data.projects.forEach(projectData => {
                if (projectData.id in ranks) {
                    projectData.rank = ranks[projectData.id];
                }
                projects[projectData.id] = new Project(container, projectData, forceExpand);
            });
            inflateProjects(container);
        });
}

function onButtonProjectCreate(container, note, forceExpand) {
    let tempProject = new TemporaryProject(container, note, forceExpand);
    let tempProjectElement = tempProject.create();
    container.appendChild(tempProjectElement);
    setTimeout(() => {
        tempProjectElement.querySelector("input").focus();
    }, 1);
}

window.addEventListener("click", clearContextMenus);