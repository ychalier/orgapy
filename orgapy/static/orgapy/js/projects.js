var converter = new showdown.Converter({
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

var projects = {};

/** Projects ******************************************************************/

function clearContextMenus() {
    let context_menus = document.querySelectorAll(".contextmenu");
    for (let i = 0; i < context_menus.length; i++) {
        document.body.removeChild(context_menus[i]);
    }
}

function addContextMenuOption(menu, label, callback) {
    let option = menu.appendChild(document.createElement("li"));
    option.classList.add("menu-item");
    create(option, "span").innerHTML = label;
    option.addEventListener("click", callback);
}

class Project {

    constructor(data) {
        this.id = data.id;
        this.creation = data.creation;
        this.modification = data.modification;
        this.title = data.title;
        this.checklist = data.checklist;
        this.rank = data.rank;
        this.note = data.note;
        this.archived = data.archived;
        this.checklistItems = null;
        this.splitChecklist();
        this.expanded = false;
        this.container = null;
        this.previousProjectData = this.toJsonString();
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
        this.title = titleString.trim();
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
        
        if (this.note != null) {
            const noteSpan = create(header, "span", "project-note");
            noteSpan.textContent = this.note.title;
            //TODO:
            //onhover: show embedded view, in iframe, with the note content
            //onclick: change note
        }
        const title = create(header, "span", "project-title");
        title.textContent = this.title == null ? "Untitled" : this.title;
        title.addEventListener("click", (event) => {
            event.stopPropagation();
            self.inflateTitleInput(title);
            return false;
        });
        
        header.addEventListener("click", (event) => { self.toggleExpanded(); });
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
                if (self.checklistItems.length != 0) {
                    self.concatChecklist();
                }
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
            label.innerHTML = converter.makeHtml(item.text).slice(3, -4); // slice to remove <p> tag
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
        let buttons = create(checklist, "div", "project-buttons");
        let buttonAddItem = create(buttons, "button", "project-button");
        buttonAddItem.title = "Add checklist item";
        buttonAddItem.innerHTML = `<i class="ri-add-line"></i> Add`;
        buttonAddItem.addEventListener("click", (event) => {
            event.stopPropagation();
            self.addNewChecklistItem(checklist);
            return false;
        });
        let buttonClear = create(buttons, "button", "project-button");
        buttonClear.title = "Clear completed items";
        buttonClear.innerHTML = `<i class="ri-close-line"></i> Clear`;
        buttonClear.addEventListener("click", (event) => {
            event.stopPropagation();
            self.clearChecklist();
            return false;
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
        if (this.archived) {
            this.container.classList.add("archived");
        }
        this.inflateHeader();
        this.inflateBody();
    }

    inflateContextMenuItems(menu) {
        var self = this;

        if (this.checklist == null) {
            addContextMenuOption(menu, `<i class="ri-checkbox-circle-line"></i> Add checklist`, () => {
                self.expanded = true;
                self.checklist = "[ ] ";
                self.splitChecklist();
                self.inflateBody();
                let checklistItemElement = self.container.querySelector(".project-checklist-item label");
                self.inflateChecklistItemLabelInput(checklistItemElement, "", 0);
            });
        } else {
            addContextMenuOption(menu, `<i class="ri-close-line"></i> Clear checklist`, () => {
                self.clearChecklist();
            });
            addContextMenuOption(menu, `<i class="ri-checkbox-circle-line"></i> Remove checklist`, () => {
                self.checklist = null;
                self.update();
            });
        }

        addContextMenuOption(menu, `<i class="ri-file-copy-2-line"></i> Copy as Markdown`, () => {
            navigator.clipboard.writeText(this.toMarkdown());
            toast("Copied to clipboard!", 600);
        });

        addContextMenuOption(menu, `<i class="ri-pencil-fill"></i> Edit in admin`, () => {
            window.location.href = URL_ADMIN_PROJECT_CHANGE + this.id;
        });

        if (this.archived) {
            addContextMenuOption(menu, `<i class="ri-archive-line"></i> Unarchive project`, () => {
                self.unarchive();
            });
        } else {
            addContextMenuOption(menu, `<i class="ri-archive-line"></i> Archive project`, () => {
                self.archive();
            });
        }

        addContextMenuOption(menu, `<i class="ri-delete-bin-line"></i> Delete project`, () => {
            self.delete();
        });
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
                inflateProjects();
            });
        }
    }

    archive() {
        var self = this;
        if (confirm(`Are you sure to archive '${this.title}'?`) == true) {
            apiPost("archive-project", {project_id: this.id}, (data) => {
                self.modification = data.modification;
                self.archived = true;
                toast("Archived!", 600);
                const showArchived = (new URLSearchParams(window.location.search)).get("archivedProjects") == "1";
                if (!showArchived) {
                    delete projects[self.id];
                }
                inflateProjects();
            });
        }
    }

    unarchive() {
        var self = this;
        if (confirm(`Are you sure to unarchive '${this.title}'?`) == true) {
            apiPost("unarchive-project", {project_id: this.id}, (data) => {
                self.modification = data.modification;
                self.archived = false;
                toast("Unarchived!", 600);
                inflateProjects();
            });
        }
    }

    toMarkdown() {
        let rows = [];
        rows.push(`# ${this.title}\n`); // TODO: add note title
        rows.push("");
        if (this.checklist != null) {
            rows.push("## Checklist" + "\n");
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
            rank: this.rank,
            note: this.note,
        }
    }

    toJsonString() {
        return JSON.stringify(this.toDict());
    }

    save(refreshList=false) {
        let projectData = this.toJsonString();
        if (projectData == this.previousProjectData) {
            console.log("No change detected, skipping save");
            return;
        }
        this.previousProjectData = projectData;
        var self = this;
        apiPost("edit-project",
            {
                project_id: this.id,
                project_data: projectData
            }, (data) => {
                self.modification = data.modification;
                toast("Saved!", 600);
                if (refreshList) {
                    fetchProjects();
                }
            });
    }

    update() {
        this.save();
        this.inflate();
    }

    clearChecklist() {
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

}

class TemporaryProject extends Project {

    constructor() {
        super({
            id: null,
            creation: new Date(),
            modification: new Date(),
            title: "",
            checklist: null,
            rank: null,
            note: null,
        });
        this.isTemporary = true;
    }

    onTitleInputChange(input) {
        this.container.classList.remove("editing");
        let titleString = input.value.trim();
        if (titleString.trim() == "") {
            remove(this.container);
            return;
        }
        let match = titleString.match(/^(.+?)(?:@(\d+))? *$/);
        let title = match[1].trim();
        let note = null;
        if (match[2] != undefined) {
            note = parseInt(match[2]);
        }
        apiPost("create-project", {}, (data) => {
            projects[data.project.id] = new Project(data.project);
            projects[data.project.id].title = title;
            projects[data.project.id].note = note;
            inflateProjects();
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

function saveProjectRanks(ordering) {
    let ranks = {};
    document.querySelectorAll("#projects .project").forEach((project, i) => {
        let projectId = project.getAttribute("project_id");
        ranks[projectId] = ordering[i];
        projects[projectId].rank = ordering[i];
    }); 
    inflateProjects();
    apiPost("edit-project-ranks", {ranks: JSON.stringify(ranks)}, () => {
        toast("Ranks saved!", 600);
    });
}

function inflateProjects() {
    dragRankClear();
    let container = document.getElementById("projects");
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
        setTimeout(() => {saveProjectRanks(ordering)}, 300);
    }, {
        dragAllowed: (element) => { return !element.classList.contains("editing"); }
    });
}

function fetchProjects() {
    const showArchived = (new URLSearchParams(window.location.search)).get("archivedProjects") == "1";
    fetch(URL_API + `?action=list-projects${showArchived ? "&archived=1" : ""}`).then(res => res.json()).then(data => {
        projects = {};
        data.projects.forEach(projectData => {
            projects[projectData.id] = new Project(projectData);
        });
        inflateProjects();
    });
}

function onButtonProjectCreate() {
    let container = document.getElementById("projects");
    let tempProject = new TemporaryProject();
    let tempProjectElement = tempProject.create();
    container.appendChild(tempProjectElement);
    setTimeout(() => {
        tempProjectElement.querySelector("input").focus();
    }, 1);
}

window.addEventListener("load", () => {
    window.addEventListener("click", clearContextMenus);
    document.getElementById("btn-project-create").addEventListener("click", onButtonProjectCreate);
    fetchProjects();
});
