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

var noteTitles = {};
var projects = {};
var todaysPlan = null;

var calendars = {};
var events = [];
var tasks = [];
var syncDate = null;

var objectives = null;
var isInitialScroll = true;
const DAYW = 32; // Day width in pixels

function getYearStart() {
    let yearStart = new Date();
    yearStart.setTime(0);
    yearStart.setFullYear((new Date()).getFullYear());
    return yearStart;
}

const YEAR_START = getYearStart();
const YEAR_END = new Date(YEAR_START.getTime());
YEAR_END.setFullYear(YEAR_START.getFullYear() + 1);
const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);
const NOW = new Date();
const DAYMS = 24 * 3600 * 1000;
const SLOT_STATE_COMPLETE = 0;
const SLOT_STATE_MISSED = 1;
const SLOT_STATE_BUTTON = 2;
const SLOT_STATE_COOLDOWN = 3;
const SLOT_STATE_FUTURE = 4;
const SLOT_STATE_FUTURE_COMPLETE = 5;

/** Projects ******************************************************************/

function clearContextMenus() {
    let context_menus = document.querySelectorAll(".contextmenu");
    for (let i = 0; i < context_menus.length; i++) {
        document.body.removeChild(context_menus[i]);
    }
}

function addContextMenuOption(menu, label, callback) {
    let option = menu.appendChild(document.createElement("span"));
    option.classList.add("contextmenu-entry");
    option.textContent = label;
    option.addEventListener("click", callback);
}

function setNoteTitle(noteSpan, noteId) {
    if (noteId in noteTitles) {
        noteSpan.textContent = noteTitles[noteId];
        noteSpan.title = noteTitles[noteId];
    } else {
        fetch(URL_API + `?action=note-title&nid=${noteId}`).then(res => res.text()).then(title => {
            noteTitles[noteId] = title;
            noteSpan.textContent = title;
            noteSpan.title = title;
        }).catch(err => {
            noteSpan.textContent = "Error";
        });
    }
}

class Project {

    constructor(data) {
        this.id = data.id;
        this.creation = data.creation;
        this.modification = data.modification;
        this.title = data.title;
        this.category = data.category;
        this.limitDate = data.limitDate;
        this.progress = data.progress;
        this.description = data.description;
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

    getLimitDateDisplay() {
        if (this.limitDate == null) return null;
        let d1 = new Date();
        let d2 = new Date(this.limitDate);
        if (d1.getFullYear() == d2.getFullYear()) {
            return d2.toLocaleString(d2.locales, {day: "numeric", month: "short"});
        } else {
            return d2.toLocaleString(d2.locales, {day: "numeric", month: "short", year: "numeric"});
        }
    }

    isLimitDateSoon() {
        let d1 = new Date();
        let d2 = new Date(this.limitDate);
        return d1.getFullYear() == d2.getFullYear() && d1.getMonth() == d2.getMonth() && d1.getDate() == d2.getDate();
    }

    isLimitDateOverdue() {
        let d1 = new Date();
        let d2 = new Date(this.limitDate);
        d1.setHours(d2.getHours(), d2.getMinutes(), d2.getSeconds(), d2.getMilliseconds());
        return d1 > d2;
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
        let shouldInflateProjects = titleString == "Today's Plan" && this.title != titleString;
        let match = titleString.match(/^(.+?)(?:@(\d+))? *$/);
        this.title = match[1].trim();
        if (match[2] == undefined) {
            this.note = null;
        } else {
            this.note = parseInt(match[2]);
        }
        if (shouldInflateProjects) {
            this.save(true);
        } else {
            this.update();
        }
    }

    inflateTitleInput(title) {
        var self = this;
        this.container.classList.add("editing");
        let input = create(null, "input", "project-title-input");
        input.value = self.title + (self.note == null ? "" : ` @${self.note}`);
        input.placeholder = "Title";
        input.addEventListener("click", (e) => {e.stopPropagation(); return false;});
        function callback() {
            self.onTitleInputChange(input);
        }
        input.addEventListener("focusout", callback);
        input.addEventListener("keydown", (e) => { if (e.key == "Enter") { callback(); } });
        title.replaceWith(input);
        input.focus();
    }

    inflateTitle(header) {
        var self = this;
        let title = create(header, "div", "project-title");
        let titleSpan = create(title, "span");
        titleSpan.innerHTML = converter.makeHtml(this.title).slice(3, -4);
        if (this.note != null) {
            let noteSpan = create(title, "a", "note-link");
            noteSpan.textContent = `@${this.note}`;
            setNoteTitle(noteSpan, this.note);
            noteSpan.href = URL_ORGAPY_NOTE.replace("NID", this.note);
        }
        title.addEventListener("click", (event) => {
            event.stopPropagation();
            self.inflateTitleInput(title);
            return false;
        });
    }

    inflateCategory(corner) {
        var self = this;
        let category = create(corner, "div", "project-category");
        category.textContent = this.category;
        category.addEventListener("click", (event) => {
            event.stopPropagation();
            let input = create(null, "input", "project-category-input");
            input.value = self.category;
            input.placeholder = "Category";
            input.addEventListener("click", (e) => {e.stopPropagation(); return false;});
            function callback() {
                self.category = input.value.trim();
                self.update();
            }
            input.addEventListener("focusout", callback);
            input.addEventListener("keydown", (e) => { if (e.key == "Enter") { callback(); } });
            category.replaceWith(input);
            input.focus();
            return false;
        });
    }

    inflateLimitDateInput(element) {
        var self = this;
        let input = create(null, "input", "project-limitdate-input");
        input.type = "date";
        input.value = this.limitDate;
        function callback() {
            self.limitDate = input.value == "" ? null : input.value;
            self.update();
        }
        input.addEventListener("focusout", callback);
        input.addEventListener("keydown", (e) => { if (e.key == "Enter") { callback(); } });
        element.replaceWith(input);
        input.focus();
        input.showPicker();
    }

    inflateLimitDate(summary) {
        var self = this;
        let limitDate = create(summary, "div", "project-limitdate");
        if (this.isLimitDateSoon()) {
            limitDate.classList.add("project-limitdate-soon");
        } else if (this.isLimitDateOverdue()) {
            limitDate.classList.add("project-limitdate-overdue");
        }
        create(limitDate, "i", "ri-time-line");
        let limitDateText = create(limitDate, "span");
        limitDateText.textContent = this.getLimitDateDisplay();
        limitDate.addEventListener("click", (event) => {
            event.stopPropagation();
            self.inflateLimitDateInput(limitDate);
            return false;
        });
    }

    inflateChecklistSummary(summary) {
        var self = this;
        let total = 0;
        let completed = 0;
        this.checklistItems.forEach(item => {
            total++;
            if (item.state) completed++;
        });
        let checklistSummary = create(summary, "div", "project-checklist-summary");
        if (completed == total) {
            checklistSummary.classList.add("project-checklist-summary-done");
        }
        create(checklistSummary, "i", "ri-checkbox-circle-line");
        create(checklistSummary, "span").textContent = `${completed}/${total}`;
        if (completed > 0) {
            let checklistClear = create(checklistSummary, "i", "ri-close-line show-on-parent-hover");
            checklistClear.title = "Clear completed items";
            checklistClear.addEventListener("click", (event) => {
                event.stopPropagation();
                self.clearChecklist();
            });
        }
    }

    inflateDescriptionSummary(summary) {
        create(summary, "i", "ri-sticky-note-line");
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
        this.inflateTitle(header);
        let corner = create(header, "div", "project-corner");
        this.inflateCategory(corner);
        if (this.limitDate == null && this.description == null && this.checklist == null) return;
        let summary = create(header, "div", "project-summary");
        if (this.description != null || this.checklist != null) {
            summary.classList.add("c-hand"); //TODO
        }
        if (this.limitDate != null) this.inflateLimitDate(summary);
        if (this.checklist != null) this.inflateChecklistSummary(summary);
        if (this.description != null) this.inflateDescriptionSummary(summary);
        summary.addEventListener("click", (event) => {
            self.toggleExpanded();
        });
        summary.addEventListener("mouseenter", (event) => {
            let body = self.container.querySelector(".project-body");
            if (body && !self.expanded) {
                body.classList.add("glimpse");
            }
        });
        summary.addEventListener("mouseleave", (event) => {
            let body = self.container.querySelector(".project-body");
            if (body) {
                body.classList.remove("glimpse");
            }
        });
    }

    inflateDescriptionTextarea(element) {
        var self = this;
        let textarea = create(null, "textarea", "project-description-textarea");
        textarea.value = "";
        if (this.description != null) {
            textarea.value = this.description;
        }
        textarea.placeholder = "Description (Markdown)";
        function callback() {
            self.container.classList.remove("editing");
            self.description = textarea.value.trim();
            if (self.description == "") {
                self.description = null;
            }
            self.update();
        }
        textarea.addEventListener("keydown", (event) => {
            if (event.ctrlKey && event.key == "Enter") {
                callback();
            }
        });
        textarea.addEventListener("focusout", callback);
        element.replaceWith(textarea);
        textarea.focus();
        this.updateExpansion();
    }

    inflateDescription(body) {
        var self = this;
        let description = create(body, "div", "project-description");
        description.innerHTML = converter.makeHtml(this.description);
        description.addEventListener("click", (event) => {
            event.stopPropagation();
            self.container.classList.add("editing");
            self.inflateDescriptionTextarea(description);
            return false;
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
                if (self.checklistItems.length == 0) {
                    self.onEmptyChecklist();
                } else {
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
            if (e.ctrlKey) {
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
        dragrank(checklist, ".project-checklist-item", (ordering, permutation) => {
            reorder(self.checklistItems, permutation);
            self.concatChecklist();
            self.update();
        }, {
            drag_allowed: (element) => { return !element.classList.contains("editing"); } // TODO: rename to dragAllowed
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
        let buttons = create(checklist, "div", "d-flex"); // TODO: wrong class
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
        if (!body) return;
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
        if (!body) return;
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
        if (this.description != null) this.inflateDescription(body);
        if (this.checklist != null) this.inflateChecklist(body);
        this.updateExpansion();
        return body;
    }

    inflateProgress() {
        var self = this;
        this.container.classList.add("has_progress");
        let wrapper = create(this.container, "div", "project-progress-wrapper");
        let progress = create(wrapper, "progress", "project-progress");
        progress.min = this.progress.min;
        progress.max = this.progress.max;
        progress.value = this.progress.current;
        wrapper.title = `${progress.value}/${progress.max}`;
        let buttonSub = create(wrapper, "div", "project-progress-sub");
        buttonSub.textContent = "−";
        buttonSub.addEventListener("click", (event) => {
            event.stopPropagation();
            self.progress.current = Math.max(self.progress.min, self.progress.current - 1);
            self.update();
            return false;
        });
        let buttonAdd = create(wrapper, "div", "project-progress-add");
        buttonAdd.textContent = "+";
        buttonAdd.addEventListener("click", (event) => {
            event.stopPropagation();
            self.progress.current = Math.min(self.progress.max, self.progress.current + 1);
            self.update();
            return false;
        });
        progress.addEventListener("dblclick", (event) => {
            let userValue = prompt("Current value:", self.progress.current);
            if (userValue != null && userValue != "") {
                try {
                    self.progress.current = parseFloat(userValue);
                    self.update();
                } catch {

                }
            }
        });
    }

    inflate() {
        this.container.innerHTML = "";
        this.container.className = `project`;
        if (this.archived) {
            this.container.classList.add("archived");
        }
        this.inflateHeader();
        if (this.description != null || this.checklist != null) {
            this.inflateBody();
        } else {
            this.expanded = false;
        }
        if (this.progress != null) this.inflateProgress();
    }

    inflateContextMenuItems(menu) {
        var self = this;
        if (this.limitDate == null) {
            addContextMenuOption(menu, "Add limit date", () => {
                let now = new Date();
                self.limitDate = dtf(now, "YYYY-mm-dd");
                self.inflateHeader();
                let limitDateElement = self.container.querySelector(".project-limitdate");
                self.inflateLimitDateInput(limitDateElement);
            });
        } else {
            addContextMenuOption(menu, "Remove limit date", () => {
                self.limitDate = null;
                self.update();
            })
        }

        if (this.description == null) {
            addContextMenuOption(menu, "Add description", () => {
                self.expanded = true;
                self.description = "";
                self.inflateBody();
                let descriptionElement = self.container.querySelector(".project-description");
                self.inflateDescriptionTextarea(descriptionElement);
            });
        } else {
            addContextMenuOption(menu, "Remove description", () => {
                self.description = null;
                self.update();
            })
        }

        if (this.checklist == null) {
            addContextMenuOption(menu, "Add checklist", () => {
                self.expanded = true;
                self.checklist = "[ ] ";
                self.splitChecklist();
                self.inflateBody();
                let checklistItemElement = self.container.querySelector(".project-checklist-item label");
                self.inflateChecklistItemLabelInput(checklistItemElement, "", 0);
            });
        } else {
            addContextMenuOption(menu, "Clear checklist", () => {
                self.clearChecklist();
            });
            addContextMenuOption(menu, "Remove checklist", () => {
                self.checklist = null;
                self.update();
            });
        }

        if (this.progress == null) {
            addContextMenuOption(menu, "Add progress", () => {
                self.progress = {min: 0, max: parseInt(prompt("Number of steps", 10)), current: 0};
                self.update();
            });
        } else {
            addContextMenuOption(menu, "Remove progress", () => {
                self.progress = null;
                self.update();
            });
        }

        addContextMenuOption(menu, "Copy as Markdown", () => {
            navigator.clipboard.writeText(this.toMarkdown());
            toast("Copied to clipboard!", 600);
        });

        addContextMenuOption(menu, "Edit in admin", () => {
            window.location.href = URL_ADMIN_PROJECT_CHANGE + this.id;
        });

        if (this.archived) {
            addContextMenuOption(menu, "Unarchive project", () => {
                self.unarchive();
            });
        } else {
            addContextMenuOption(menu, "Archive project", () => {
                self.archive();
            });
        }

        addContextMenuOption(menu, "Delete project", () => {
            self.delete();
        });
    }

    inflateContextMenu(event) {
        clearContextMenus();
        let menu = document.createElement("div");
        menu.classList.add("contextmenu");
        this.inflateContextMenuItems(menu);
        document.body.appendChild(menu);
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
            fetchApiPost("delete-project", {project_id: this.id}, () => {
                toast("Deleted!", 600);
                if (self.title == "Today's Plan") {
                    todaysPlan = null;
                }
                delete projects[self.id];
                inflateProjects();
                updateProjectCount();
            });
        }
    }

    archive() {
        var self = this;
        if (confirm(`Are you sure to archive '${this.title}'?`) == true) {
            fetchApiPost("archive-project", {project_id: this.id}, () => {
                self.archived = true;
                toast("Archived!", 600);
                if (self.title == "Today's Plan") {
                    todaysPlan = null;
                }
                const showArchived = (new URLSearchParams(window.location.search)).get("archivedProjects") == "1";
                if (!showArchived) {
                    delete projects[self.id];
                }
                inflateProjects();
                updateProjectCount();
            });
        }
    }

    unarchive() {
        var self = this;
        if (confirm(`Are you sure to unarchive '${this.title}'?`) == true) {
            fetchApiPost("unarchive-project", {project_id: this.id}, () => {
                self.archived = false;
                toast("Unarchived!", 600);
                inflateProjects();
                updateProjectCount();
            });
        }
    }

    toMarkdown() {
        let rows = [];
        rows.push(`# ${this.title}\n`);
        rows.push(`Category: ${this.category}`);
        if (this.limitDate != null) {
            rows.push(`Limit date: ${new Date(this.limitDate).toLocaleDateString()}`);
        }
        if (this.progress != null) {
            rows.push(`Progress: ${this.progress.current}/${this.progress.max}`);
        }
        rows.push("");
        if (this.description != null) {
            rows.push("## Description" + "\n");
            rows.push(this.description + "\n");
        }
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
            category: this.category,
            limitDate: this.limitDate,
            progress: this.progress,
            description: this.description,
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
        fetchApiPost("edit-project",
            {
                project_id: this.id,
                project_data: projectData
            }, () => {
                toast("Saved!", 600);
                if (refreshList) {
                    fetchProjectsAndInflate();
                }
            });
    }

    update() {
        this.save();
        this.inflate();
    }

    onEmptyChecklist() {
        this.checklist = null;
        this.checklistItems = []; 
    }

    clearChecklist() {
        for (let i = this.checklistItems.length - 1; i >= 0; i--) {
            if (this.checklistItems[i].state) {
                this.checklistItems.splice(i, 1);
            }
        }
        this.concatChecklist();
        this.update();
    }

}

class TodaysPlanProject extends Project {

    constructor(data) {
        super(data);
        this.title = "Today's Plan";
        this.category = "general";
        this.limitDate = null;
        this.progress = null;
        this.description = null;
        this.note = null;
        if (this.checklist == null) {
            this.onEmptyChecklist();
        }
        this.rank = -1;
    }

    inflateTitle(header) {
        create(header, "div", "project-title").textContent = this.title;
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
        this.inflateTitle(header);
    }

    onEmptyChecklist() {
        this.checklist = "[ ] Item";
        this.splitChecklist();
    }

    updateExpansion() {
        this.expand();
    }

    inflateContextMenuItems(menu) {
        var self = this;
        addContextMenuOption(menu, "Delete project", () => {
            self.delete();
        });
    }

}

class TemporaryProject extends Project {

    constructor() {
        super({
            id: null,
            creation: new Date(),
            modification: new Date(),
            title: "",
            category: "general",
            limitDate: null,
            progress: null,
            description: null,
            checklist: null,
            rank: null,
            note: null,
        });
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
        fetchApiPost("create-project", {}, (data) => {
            projects[data.project.id] = new Project(data.project);
            projects[data.project.id].title = title;
            projects[data.project.id].note = note;
            inflateProjects();
            updateProjectCount();
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

function updateProjectCount() {
    let count = [...Object.keys(projects)].length;
    if (count == 0) {
        document.getElementById("project-count").textContent = "No project";
    } else if (count == 1) {
        document.getElementById("project-count").textContent = "1 project";
    } else {
        document.getElementById("project-count").textContent = count + " projects";
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
    fetchApiPost("edit-project-ranks", {ranks: JSON.stringify(ranks)}, () => {
        toast("Ranks saved!", 600);
    });
}

function inflateProjects() {
    dragrank_clear();
    let todaysPlanContainer = document.getElementById("todays-plan");
    todaysPlanContainer.innerHTML = "";
    if (todaysPlan != null) {
        todaysPlanContainer.appendChild(todaysPlan.create());
    }
    let container = document.getElementById("projects");
    container.innerHTML = "";
    let projectIndices = [...Object.keys(projects)];
    projectIndices.sort((a, b) => projects[a].rank - projects[b].rank);
    projectIndices.forEach(projectId => {
        container.appendChild(projects[projectId].create());
    });
    dragrank(container, ".project", (ordering, permutation) => {
        setTimeout(() => {saveProjectRanks(ordering)}, 300);
    }, {
        drag_allowed: (element) => { return !element.classList.contains("editing"); } // Rename drag_allowed
    });
    updateProjectCount();
}

function fetchProjectsAndInflate() {
    const showArchived = (new URLSearchParams(window.location.search)).get("archivedProjects") == "1";
    fetch(URL_API + `?action=list-projects${showArchived ? "&archived=1" : ""}`).then(res => res.json()).then(data => {
        projects = {};
        todaysPlan = null;
        data.projects.forEach(projectData => {
            if (projectData["title"] == "Today's Plan") {
                todaysPlan = new TodaysPlanProject(projectData);
            } else {
                projects[projectData.id] = new Project(projectData);
            }
        });
        inflateProjects();
    });
}

/** Events and tasks **********************************************************/

class CalendarEvent {

    constructor(data) {
        this.url = data.url;
        this.title = data.title;
        this.calendarId = data.calendar_id;
        this.dtstart = new Date(data.dtstart);
        this.dtend = new Date(data.dtend);
        this.day = dtf(this.dtstart, "YYYY-mm-dd");
        this.location = data.location;
        this.hasTime = data.dtstart.length > 10;
        this.over = new Date() >= this.dtend;
    }

    inflate(container) {
        let element = create(container, "div", "event")
        let dotWrapper = create(element, "div", "event-dot-wrapper");
        let dot = create(dotWrapper, "div", "event-dot");
        dot.classList.add("event-dot");
        if (this.over) {
            element.classList.add("event-over");
        }
        if (this.hasTime) {
            create(element, "div", "event-time").textContent = dtf(this.dtstart, "HH:MM");
        }
        create(element, "div", "event-title").textContent = this.title;
        if (this.location != null) {
            element.title = this.location;
        }
        let deleteButton = create(element, "div", "event-delete");
        deleteButton.innerHTML = `<i class="ri-delete-bin-line"></i>`;
        deleteButton.title = "Delete";
        var self = this;
        deleteButton.addEventListener("click", () => {
            if (confirm(`Are you sure you want to delete the event '${this.title}'?`) == true) {
                self.delete();
            }
        });
    }

    delete() {
        fetchApiPost("delete-calendar", {href: this.url, calendarid: this.calendarId}, () => {
            toast("Event deleted", 600);
            fetchEvents(false);
        });
    }
}

class Task {

    constructor(data) {
        this.id = data.id;
        this.title = data.title;
        this.startDate = new Date(data.start_date);
        this.dueDate = data.due_date ? new Date(data.due_date) : null;
        this.recurringMode = data.recurring_mode;
        this.recurringPeriod = data.recurring_period;
    }

    inflate(container) {
        var self = this;
        let element = create(container, "div", "task");
        let thisMorning = new Date();
        thisMorning.setHours(0, 0, 0, 0);
        if (this.dueDate != null && this.dueDate < thisMorning) {
            element.classList.add("task-overdue");
        }
        let button = create(element, "button", "task-button-complete");
        button.title = "Complete";
        button.addEventListener("click", () => {
            if (confirm(`Are you sure you want to complete the task '${this.title}'?`) == true) {
                self.complete();
            }
        });
        button.innerHTML = `<i class="ri-check-line"></i>`;
        let title = create(element, "span");
        title.textContent = this.title;
        title.title = `Start: ${dtf(this.startDate, "dd/mm/YYYY")}`;
        if (this.dueDate != null) {
            title.title += `\nDue: ${dtf(this.dueDate, "dd/mm/YYYY")}`;
        }
        title.addEventListener("click", (event) => {
            openModalTaskForm(self);
        });
    }

    complete() {
        fetchApiPost("complete-task", {id: this.id}, () => {
            toast("Task completed!", 600);
            fetchTasks();
        });
    }

}

function fetchEvents(force=false) {
    let url = URL_API + "?action=list-calendars";
    if (force) {
        url = `${url}&force=1`;
    }
    fetch(url).then(res => res.json()).then(data => {
        let calendarInputEvents = document.querySelector("#modal-add-event select[name='calendarid']");
        calendarInputEvents.innerHTML = "";
        calendars = {};
        data.calendars.forEach(calendar => {
            calendars[calendar.id] = calendar;
            let option = create(calendarInputEvents, "option");
            option.value = calendar.id;
            option.textContent = calendar.name;
        });
        events = [];
        syncDate = data.last_sync;
        data.events.forEach(event => {
            events.push(new CalendarEvent(event));
        });
        inflateCalendar();
    }).catch(err => {
        events = [];
        syncDate = null;
        inflateCalendar();
    });
}

function fetchTasks() {
    let url = URL_API + "?action=list-tasks&limit=5";
    fetch(url).then(res => res.json()).then(data => {
        tasks = [];
        const now = new Date();
        data.tasks.forEach(task_data => {
            const task = new Task(task_data);
            if (task.recurringMode != "ON" && task.startDate > now) {
                return;
            }
            tasks.push(task);
        });
        inflateTasks();
    }).catch(err => {
        console.error(err);
        inflateTasks();
    });
}

function inflateEvents() {
    let container = document.getElementById("events");
    container.innerHTML = "";
    
    if (events.length == 0) {
        container.innerHTML = "No event";
        return;
    }
    
    let days = {};
    events.forEach(event => {
        if (!(event.day in days)) {
            days[event.day] = [];
        }
        days[event.day].push(event);
    });
    let dates = [...Object.keys(days)];
    dates.sort();
    dates.forEach(date => {
        let dateElement = create(container, "div", "card-subtitle");
        let dt = new Date(date);
        dateElement.textContent = dt.toLocaleDateString(dt.locales, {weekday: "long", day: "numeric", month: "short"});
        days[date].sort((a, b) => a.dtstart - b.dtstart);
        days[date].forEach((event) => {
            event.inflate(container);
        });
    });
    
    let eventModalButton = create(container, "button", "event-modal-btn");
    eventModalButton.innerHTML = `<i class="ri-add-line"></i> Add`;
    eventModalButton.title = "Add Event";
    eventModalButton.addEventListener("click", () => {
        showModal("modal-add-event");
    });

}

function openModalTaskForm(task=null) {
    let modal = document.getElementById("modal-task-form");
    modal.querySelector("form").reset();
    if (task != null) {
        modal.querySelector("input[name='id']").value = task.id;
        modal.querySelector("input[name='title']").value = task.title;
        modal.querySelector("input[name='start_date']").value = task.startDate.toISOString().substring(0, 10);
        if (task.dueDate != null) {
            modal.querySelector("input[name='due_date']").value = task.dueDate.toISOString().substring(0, 10);
        }
        modal.querySelectorAll("select[name='recurring_mode'] option").forEach(option => {
            if (option.value == task.recurringMode) {
                option.selected = true;
            } else {
                option.removeAttribute("selected");
            }
        });
        modal.querySelector("input[name='recurring_period']").value = task.recurringPeriod;
        modal.querySelector("input[name='add']").style.display = "none";
        modal.querySelector("input[name='save']").style.display = "unset";
        modal.querySelector("input[name='delete']").style.display = "unset";
    } else {
        modal.querySelector("input[name='add']").style.display = "unset";
        modal.querySelector("input[name='save']").style.display = "none";
        modal.querySelector("input[name='delete']").style.display = "none";
    }
    modal.classList.add("active");
}

function inflateTasks() {
    let container = document.getElementById("tasks");
    container.innerHTML = "";

    if (tasks.length == 0) {
        create(container, "div", "event-date").innerHTML = `No task`;
    } else {
        tasks.sort((a, b) => a.start_date - b.start_date);

        let seen = new Set();
        let currentTasks = [];
        let futureTasks = [];
        const now = new Date();

        tasks.forEach(task => {
            if (task.startDate <= now) {
                seen.add(task.id);
                currentTasks.push(task);
            } else if (!seen.has(task.id)) {
                seen.add(task.id);
                futureTasks.push(task);
            }
        });

        let taskTitle = create(container, "div", "event-date");
        if (currentTasks.length > 0) {
            taskTitle.textContent = `Current tasks (${currentTasks.length})`;
            currentTasks.forEach(task => {
                task.inflate(container);
            });
        } else {
            taskTitle.textContent = `No current task`;
        }

        if (futureTasks.length > 0) {
            let details = create(container, "details");
            create(details, "summary", "event-date").textContent = `Incoming tasks (${futureTasks.length})`;
            futureTasks.forEach(task => {
                task.inflate(details);
            });
        }
    }

    let eventModalButton = create(container, "button", "event-modal-btn");
    eventModalButton.innerHTML = `<i class="ri-add-line"></i> Add`;
    eventModalButton.title = "Add Task";
    eventModalButton.addEventListener("click", () => {
        openModalTaskForm();
    });
    
}

function inflateSync() {
    if (syncDate == null) return;
    let container = document.getElementById("calendar-sync");
    container.innerHTML = "";
    let eventSync = create(container, "div", "event-sync");
    let eventSyncDate = create(eventSync, "div", "event-sync-date");
    eventSyncDate.textContent = new Date(syncDate).toLocaleString();
    eventSyncDate.title = "Last synchronization";
    let eventSyncButton = create(eventSync, "div", "event-sync-btn");
    eventSyncButton.title = "Refresh";
    eventSyncButton.innerHTML = `<i class="ri-reset-left-line"></i>`;
    eventSyncButton.addEventListener("click", () => {
        fetchEvents(true);
    });
}

function inflateCalendar() {
    inflateEvents();
    inflateSync();
}

function openModalTasks() {
    let modal = document.getElementById("modal-tasks");
    let tasksContainer = modal.querySelector(".tasks");
    tasksContainer.innerHTML = "";
    fetch(URL_API + "?action=list-tasks&limit=365").then(res => res.json()).then(data => {
        data.tasks.forEach(task => {
            let taskElement = create(tasksContainer, "div");
            let taskTitle = create(taskElement.appendChild, "span", "label");
            taskTitle.textContent = task.title;
            taskTitle.addEventListener("click", () => {
                modal.classList.remove("active");
                openModalTaskForm(new Task(task));
            });
            create(taskElement, "span").textContent = `${new Date(task.due_date).toLocaleDateString("fr-FR", {weekday: "long", day: "numeric", month: "short"})}`;
        });
    });
    modal.classList.add("active");
}

function onAllDayInputChange() {
    const allDayInput = document.querySelector("#modal-add-event input[name='allday']");
    if (allDayInput.checked) {
        document.querySelector("#modal-add-event input[name='dtstart-time']").disabled = true;
        document.querySelector("#modal-add-event input[name='dtend-time']").disabled = true;
    } else {
        document.querySelector("#modal-add-event input[name='dtstart-time']").removeAttribute("disabled");
        document.querySelector("#modal-add-event input[name='dtend-time']").removeAttribute("disabled");
    }
}

/** Objectives ****************************************************************/

function dayOffset(d) {
    return (d - getYearStart()) / 3600 / 24 / 1000 * DAYW;
}

function addDays(baseDate, daysToAdd) {
    let result = new Date(baseDate.getTime());
    result.setDate(result.getDate() + Math.floor(daysToAdd));
    let remainder = daysToAdd - Math.floor(daysToAdd);        
    if (remainder > 0) {
        result.setTime(result.getTime() + remainder * DAYMS);
    }
    return result;
}

function inflateObjgraphHead(objgraph) {
    let objgraphHead = create(objgraph, "div", "objgraph-head");
    objgraphHead.addEventListener("dblclick", () => {
        resetObjgraphScroll();
    });
    let yearStart = getYearStart();
    let today = new Date();
    for (let i = 0; i < 365; i++) { //TODO: leap year check
        let day = (new Date(yearStart));
        day.setDate(yearStart.getDate() + i);
        let objgraphDay = create(objgraphHead, "div", "objgraph-head-day");
        if (day.getDate() == 1) {
            objgraphDay.textContent = day.toLocaleDateString(day.locales, {month: "short"});
        }
        if (day.getDay() == 1) {
            objgraphDay.classList.add("objgraph-head-week");
        }
        if (day.getDate() == today.getDate() && day.getMonth() == today.getMonth()) {
            objgraphDay.classList.add("objgraph-head-today");
        }
    }
}

class Slot {

    constructor(start, length, state, early=false, late=false) {
        this.start = new Date(start);
        this.length = length;
        this.state = state;
        this.early = early;
        this.late = late;
    }

    end() {
        return addDays(this.start, this.length);
    }

}

function argmin(arr) {
    if (arr.length == 0) return null;
    let i = null;
    for (let j = 0; j < arr.length; j++) {
        if (arr[j] != null && (i == null || arr[j] < arr[i])) i = j;
    }
    return i;
}

class Objective {
    
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.history = data.history;
        if (this.history == null) {
            this.history = [];
        }
        this.rules = data.rules;
        this.archived = data.archived;
        this.history.sort();
    }

    getSlotsStrict() {
        let dateStart = new Date(this.history[0] * 1000);
        dateStart.setHours(0, 0, 0, 0);
        let slots = [];
        let historyIndex = 0;
        let isUnderCooldown = (NOW - new Date(this.history[this.history.length - 1] * 1000)) / DAYMS < this.rules.cooldown;
        while (true) {
            let dateEnd = addDays(dateStart, this.rules.period);
            let state = null;
            let dateStartTs = Math.floor(dateStart / 1000);
            let dateEndTs = Math.floor(dateEnd / 1000);
            let lastCompletion = null;
            while (historyIndex < this.history.length && this.history[historyIndex] < dateEndTs) {
                if (this.history[historyIndex] >= dateStartTs) {
                    lastCompletion = new Date(this.history[historyIndex] * 1000);
                }
                historyIndex++;
            }
            let complete = lastCompletion != null;
            let current = NOW >= dateStart && NOW < dateEnd;
            if (complete) {
                state = SLOT_STATE_COMPLETE;
            } else if (current) {
                state = isUnderCooldown ? SLOT_STATE_COOLDOWN : SLOT_STATE_BUTTON;
            } else {
                state = SLOT_STATE_MISSED;
            }
            slots.push(new Slot(dateStart, (dateEnd - dateStart) / DAYMS, state));
            if (current) break;
            dateStart = new Date(dateEnd.getTime());
            if (NOW < dateStart) break;
        }
        return slots;
    }

    getSlotsFlexible() {
        let dateStart = new Date(this.history[0] * 1000);
        dateStart.setHours(0, 0, 0, 0);
        let slots = [];
        let nextHistoryIndex = 1;
        let nextSlotState = SLOT_STATE_COMPLETE;
        let isUnderCooldown = (NOW - new Date(this.history[this.history.length - 1] * 1000)) / DAYMS < this.rules.cooldown;
        while (dateStart <= TODAY) {
            let dateEndHistory = null;
            if (nextHistoryIndex < this.history.length) {
                dateEndHistory = new Date(this.history[nextHistoryIndex] * 1000);
                dateEndHistory.setHours(0, 0, 0, 0);
            }
            let dateEndToday = new Date(TODAY.getTime());
            let dateEndPeriod = addDays(dateStart, this.rules.period);
            let dateEnds = [dateEndHistory, dateEndToday, dateEndPeriod];
            if (nextSlotState == SLOT_STATE_MISSED) {
                dateEnds.pop();
            }
            let i = argmin(dateEnds);
            let dateEnd = dateEnds[i];
            let minimumSize = 1;
            if ((dateEnd - dateStart) / DAYMS < minimumSize) {
                dateEnd = new Date(dateEnd.getTime() + (minimumSize - (dateEnd - dateStart) / DAYMS) * DAYMS);
            }
            let length = (dateEnd - dateStart) / DAYMS;
            let early = (nextSlotState == SLOT_STATE_BUTTON || nextSlotState == SLOT_STATE_COOLDOWN) && slots[slots.length - 1].length < this.rules.period;
            let late = (nextSlotState == SLOT_STATE_BUTTON || nextSlotState == SLOT_STATE_COOLDOWN) && slots[slots.length - 1].length > this.rules.period + .9;
            slots.push(new Slot(dateStart, length, nextSlotState, early, late));
            if (i == 0) {
                nextHistoryIndex++;
                nextSlotState = SLOT_STATE_COMPLETE;
            } else if (i == 1) {
                nextSlotState = isUnderCooldown ? SLOT_STATE_COOLDOWN : SLOT_STATE_BUTTON;
            } else {
                nextSlotState = SLOT_STATE_MISSED;
            }
            dateStart = new Date(dateEnd.getTime());
        }
        let futureDateEnd = addDays(new Date(this.history[this.history.length - 1] * 1000), this.rules.period);
        let futureLength = Math.floor((futureDateEnd - dateStart) / DAYMS);
        if (futureLength > 0) {
            slots.push(new Slot(dateStart, futureLength, SLOT_STATE_FUTURE_COMPLETE, false, false));
        }
        return slots;
    }

    getSlots() {
        if (this.history == null || this.history.length == 0) {
            return [new Slot(TODAY, 1, SLOT_STATE_BUTTON)];
        }
        let slots;
        switch (this.rules.type) {
            case "strict":
                slots = this.getSlotsStrict();
                break;
            case "flexible":
                slots = this.getSlotsFlexible();
                break;
        }
        while (true) {
            let slot = new Slot(slots[slots.length - 1].end(), this.rules.period, SLOT_STATE_FUTURE);
            if (slot.start >= YEAR_END) break;
            slots.push(slot);
        }
        return slots;
    }

}

function saveObjectiveHistory(objectiveId) {
    fetchApiPost("edit-objective-history",
        {
            objective_id: objectiveId,
            objective_history: JSON.stringify(objectives[objectiveId].history)
        },
        () => {
            toast("Saved objective histoyr!", 600);
        }
    );
}

function onObjectiveCheck(objectiveId) {
    let obj = objectives[objectiveId];
    let ts = Math.floor((new Date()).getTime() / 1000);
    obj.history.push(ts);
    saveObjectiveHistory(objectiveId);
    createObjgraph();
}

function inflateObjgraphObjective(objgraphBody, objectiveId, index) {
    let domObj = create(objgraphBody, "div", "objgraph-objective");
    let obj = objectives[objectiveId];
    let slots = obj.getSlots();
    let dateStart = new Date(slots[0].start.getTime());
    let objectiveOffset = dayOffset(dateStart);
    domObj.style.marginLeft = objectiveOffset + "px";
    obj.history.forEach(ts => {
        let domCompletion = create(domObj, "div", "objgraph-completion");
        domCompletion.title = (new Date(ts * 1000)).toLocaleString();
        // This trick avoids having completion marks between two days.
        // TODO: ideally, what should be avoided would be to be between two
        // slots, eg. with a 3.5 days period.
        let completionDate = new Date(ts * 1000);
        let completionDayDate = new Date(ts * 1000);
        completionDayDate.setHours(0, 0, 0, 0);
        let completionOffset = dayOffset(completionDate);
        let completionDayOffset = dayOffset(completionDayDate);
        domCompletion.style.left = (completionOffset - objectiveOffset - 0.2 * (completionOffset - completionDayOffset)) + "px";
        domCompletion.addEventListener("click", (event) => {
            openModalCompletionForm(obj, ts);
        });
    });
    slots.forEach(slot => {
        let domSlot = create(domObj, "div", "objgraph-slot");
        domSlot.style.width = `${DAYW * slot.length}px`;
        let domSlotBackground = create(domSlot, "div", "objgraph-slot-background");
        if (slot.state == SLOT_STATE_COMPLETE) {
            domSlotBackground.classList.add("bg-success");
        } else if (slot.state == SLOT_STATE_MISSED) {
            domSlotBackground.classList.add("bg-error");
        } else if (slot.state == SLOT_STATE_COOLDOWN) {
            if (slot.early) {
                domSlotBackground.classList.add("bg-future-complete");
            } else {
                domSlotBackground.classList.add("bg-cooldown");
            }
        } else if (slot.state == SLOT_STATE_FUTURE) {
            domSlotBackground.classList.add("bg-future");
        } else if (slot.state == SLOT_STATE_FUTURE_COMPLETE) {
            domSlotBackground.classList.add("bg-future-complete");
        } else if (slot.state == SLOT_STATE_BUTTON) {
            let domButtonCheck = create(domSlotBackground, "button");
            if (slot.early) {
                domButtonCheck.classList.add("early");
            } else if (slot.late) {
                domButtonCheck.classList.add("late");
            }
            domButtonCheck.innerHTML = `<i class="ri-check-line"></i>`;
            domButtonCheck.addEventListener("click", () => {
                onObjectiveCheck(objectiveId);
            });
        }
    });
    let domName = create(objgraphBody, "div", "objgraph-name popover popover-bottom");
    if (obj.archived) {
        domName.classList.add("archived");
    }
    domName.textContent = obj.name;
    domName.style.top = ((index + 1) * 32 + 1) + "px";
    domName.addEventListener("click", (event) => {
        openModalObjectiveForm(obj);
    });

}

function inflateObjgraphBody(objgraph) {
    let objgraphBody = create(objgraph, "div", "objgraph-body");
    let i = 0;
    for (let objectiveId in objectives) {
        inflateObjgraphObjective(objgraphBody, objectiveId, i);
        i++;
    }
    if ([...Object.keys(objectives)].length == 0) {
        objgraphBody.textContent = "No objective";
        objgraphBody.style.position = "absolute";
        objgraphBody.style.left = "50%";
        objgraphBody.style.transform = "translateX(-50%)";
        objgraph.style.paddingBottom = "24px";
    }
}

function resetObjgraphScroll() {
    let container = document.getElementById("objgraph-wrapper");
    let target = dayOffset(new Date()) - 0.5 * container.getBoundingClientRect().width;
    if (isInitialScroll) {
        container.scrollLeft = target;
        isInitialScroll = false;
    } else {
        container.scrollTo({top: 0, left: target, behavior: "smooth"});
    }
}

function createObjgraph() {
    let container = document.getElementById("objgraph-wrapper");
    if (Object.keys(objectives).length == 0) {
        container.parentElement.classList.add("hidden");
    } else {
        container.parentElement.classList.remove("hidden");
    }
    container.innerHTML = "";
    let objgraph = create(container, "div", "objgraph");
    inflateObjgraphHead(objgraph);
    inflateObjgraphBody(objgraph);
    resetObjgraphScroll();
}

function fetchObjectives() {
    const showArchived = (new URLSearchParams(window.location.search)).get("archivedObjectives") == "1";
    fetch(URL_API + `?action=list-objectives${showArchived ? "&archived=1" : ""}`).then(res => res.json()).then(data => {
        objectives = {};
        data.objectives.forEach(data => {
            objectives[data.id] = new Objective(data);
        });
        createObjgraph();
    });
}

function openModalObjectiveForm(objective=null) {
    let modal = document.getElementById("modal-objective-form");
    modal.querySelector("form").reset();
    if (objective != null) {
        modal.querySelector("input[name='id']").value = objective.id;
        modal.querySelector("input[name='name']").value = objective.name;
        modal.querySelectorAll("select[name='type'] option").forEach(option => {
            if (option.value == objective.rules.type) {
                option.selected = true;
            } else {
                option.removeAttribute("selected");
            }
        });
        modal.querySelector("input[name='period']").value = objective.rules.period;
        modal.querySelector("input[name='cooldown']").value = objective.rules.cooldown;
        modal.querySelector("input[name='add']").style.display = "none";
        if (objective.archived) {
            modal.querySelector("input[name='archive']").value = "Unarchive";
        } else {
            modal.querySelector("input[name='archive']").value = "Archive";
        }
        modal.querySelector("input[name='save']").style.display = "unset";
        modal.querySelector("input[name='delete']").style.display = "unset";
        modal.querySelector("input[name='completion']").style.display = "unset";
    } else {
        modal.querySelectorAll("select[name='type'] option").forEach(option => {
            if (option.value == "ON") {
                option.selected = true;
            } else {
                option.removeAttribute("selected");
            }
        });
        modal.querySelector("input[name='period']").value = 1;
        modal.querySelector("input[name='cooldown']").value = 0;
        modal.querySelector("input[name='add']").style.display = "unset";
        modal.querySelector("input[name='archive']").style.display = "none";
        modal.querySelector("input[name='save']").style.display = "none";
        modal.querySelector("input[name='delete']").style.display = "none";
        modal.querySelector("input[name='completion']").style.display = "none";
    }
    modal.classList.add("active");
}

function openModalCompletionForm(objective, timestamp=null) {
    let modal = document.getElementById("modal-completion-form");
    modal.querySelector("form").reset();
    modal.querySelector("input[name='id']").value = objective.id;
    if (timestamp != null) {
        modal.querySelector("input[name='timestamp']").value = timestamp;
        let tsDate = new Date(timestamp * 1000);
        modal.querySelector("input[name='date']").value = dtf(tsDate, "YYYY-mm-dd");
        modal.querySelector("input[name='time']").value = dtf(tsDate, "HH:MM:SS");
        modal.querySelector("input[name='add']").style.display = "none";
        modal.querySelector("input[name='save']").style.display = "unset";
        modal.querySelector("input[name='delete']").style.display = "unset";
    } else {
        modal.querySelector("input[name='add']").style.display = "unset";
        modal.querySelector("input[name='save']").style.display = "none";
        modal.querySelector("input[name='delete']").style.display = "none";
    }
    modal.classList.add("active");
}

window.addEventListener("load", () => {

    window.addEventListener("click", clearContextMenus);

    document.getElementById("btn-project-create").addEventListener("click", () => {
        let container = document.getElementById("projects");
        let tempProject = new TemporaryProject();
        let tempProjectElement = tempProject.create();
        container.appendChild(tempProjectElement);
        setTimeout(() => {
            tempProjectElement.querySelector("input").focus();
        }, 1);
    });

    document.getElementById("btn-todaysplan-create").addEventListener("click", () => {
        if (todaysPlan != null) {
            alert("Today's plan already exists");
            return;
        }
        fetchApiPost("create-project", {}, (data) => {
            todaysPlan = new TodaysPlanProject({
                id: data.project.id,
                modification: data.project.modification,
                title: "Today's Plan"
            });
            inflateProjects();
            todaysPlan.save();
            setTimeout(() => {
                let label = todaysPlan.container.querySelector("label");
                todaysPlan.inflateChecklistItemLabelInput(label, "", 0);
            }, 1);
        });
        inflateProjects();
    });

    document.getElementById("tasks-title").addEventListener("click", openModalTasks);

    document.getElementById("btn-add-event").addEventListener("click", () => {
        let form = document.getElementById("form-add-event");
        let formData = new FormData(form);
        closeModal("modal-add-event");
        fetchApi(form.action, form.method, formData, () => {
            toast("Event added", 600);
            fetchEvents(false);
        });
    });
    
    document.querySelector("#modal-task-form form").addEventListener("submit", (event) => {
        event.preventDefault();
        closeModal("modal-task-form");
        if (event.submitter.name == "delete" && !confirm(`Are you sure you want to delete this task?`)) return;
        let url = URL_API + "?action=";
        switch (event.submitter.name) {
            case "add":
                url += "add-task";
                break;
            case "save":
                url += "edit-task";
                break;
            case "delete":
                url += "delete-task";
                break;
        }
        let formData = new FormData(event.target, event.submitter);
        fetchApi(url, "post", formData, () => {
            toast("Saved!", 600);
            fetchTasks();
        });
    });

    document.querySelector("#modal-add-event input[name='allday']").addEventListener("change", onAllDayInputChange);

    document.querySelector("#modal-objective-form form").addEventListener("submit", (event) => {
        event.preventDefault();
        closeModal("modal-objective-form");
        if (event.submitter.name == "completion") {
            let objective_id = parseInt(event.target.querySelector("input[name='id']").value);
            openModalCompletionForm(objectives[objective_id]);
            return;
        }
        if (event.submitter.name == "archive") {
            const objectiveId = parseInt(event.target.querySelector("input[name='id']").value);
            const archived = objectives[objectiveId].archived;
            const prefix = archived ? "un" : ""; 
            const url = `${URL_API}?action=${prefix}archive-objective`;
            const formData = new FormData(event.target, event.submitter);
            formData.append("objective_id", objectiveId);
            fetchApiPost(url, "post", formData, () => {
                if (archived) {
                    toast("Unarchived!", 600);
                } else {
                    toast("Archived!", 600);
                }
                fetchObjectives();
            });
            return;
        }
        if (event.submitter.name == "delete" && !confirm(`Are you sure you want to delete this objective?`)) return;
        let url = URL_API + "?action=";
        switch (event.submitter.name) {
            case "add":
                url += "add-objective";
                break;
            case "save":
                url += "edit-objective";
                break;
            case "delete":
                url += "delete-objective";
                break;
        }
        let formData = new FormData(event.target, event.submitter);
        fetchApi(url, "post", formData, () => {
            toast("Saved!", 600);
            fetchObjectives();
        });
    });
    
    document.getElementById("btn-objective-create").addEventListener("click", (event) => {
        openModalObjectiveForm();
    });

    document.querySelector("#modal-completion-form form").addEventListener("submit", (event) => {
        event.preventDefault();
        closeModal("modal-completion-form");
        if (event.submitter.name == "delete" && !confirm(`Are you sure you want to delete this completion?`)) return;        
        let objectiveId = parseInt(event.target.querySelector("input[name='id']").value);
        let originalTs = parseInt(event.target.querySelector("input[name='timestamp']").value);
        let obj = objectives[objectiveId];
        if (event.submitter.name == "delete") {
            obj.history.splice(obj.history.indexOf(originalTs), 1);
        } else {
            let newDate = event.target.querySelector("input[name='date']").value;
            let newTime = event.target.querySelector("input[name='time']").value;
            let newTs = Math.floor((new Date(newDate + "T" + newTime).getTime()) / 1000);
            if (event.submitter.name == "add") {
                obj.history.push(newTs);
            } else if (event.submitter.name == "save") {
                obj.history[obj.history.indexOf(originalTs)] = newTs;
            }
            obj.history.sort();
        }
        saveObjectiveHistory(objectiveId);
        createObjgraph();
    });
    
    onAllDayInputChange();
    fetchProjectsAndInflate();
    fetchEvents(false);
    fetchTasks();
    fetchObjectives();

});
