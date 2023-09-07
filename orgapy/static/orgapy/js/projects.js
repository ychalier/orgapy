window.addEventListener("load", () => {

    function clear_context_menus() {
        let context_menus = document.querySelectorAll(".contextmenu");
        for (let i = 0; i < context_menus.length; i++) {
            document.body.removeChild(context_menus[i]);
        }
    }

    const STATUS_CHOICES = [
        "Idea",
        "Ongoing",
        "Paused",
        "Finished",
    ];

    const STATUS_ORDERING = {
        "Ongoing": 0,
        "Paused": 1,
        "Idea": 1,
        "Finished": 2,
    }

    var projects = {};

    class Project {

        constructor(data) {
            this.id = data.id;
            this.creation = data.creation;
            this.modification = data.modification;
            this.title = data.title;
            this.category = data.category;
            this.status = data.status;
            this.limit_date = data.limit_date;
            this.progress = data.progress;
            this.description = data.description;
            this.checklist = data.checklist;
            this.checklist_items = null;
            this.split_checklist();
            this.expanded = false;
            this.container = null;
            this.previous_project_data = this.to_json_string();
        }

        get_limit_date_display() {
            if (this.limit_date == null) return null;
            let d1 = new Date();
            let d2 = new Date(this.limit_date);
            if (d1.getFullYear() == d2.getFullYear()) {
                return d2.toLocaleString(d2.locales, {day: "numeric", month: "short"});
            } else {
                return d2.toLocaleString(d2.locales, {day: "numeric", month: "short", year: "numeric"});
            }
        }

        is_limit_date_soon() {
            let d1 = new Date();
            let d2 = new Date(this.limit_date);
            return d1.getFullYear() == d2.getFullYear() && d1.getMonth() == d2.getMonth() && d1.getDate() == d2.getDate();
        }

        is_limit_date_overdue() {
            let d1 = new Date();
            let d2 = new Date(this.limit_date);
            d1.setHours(d2.getHours(), d2.getMinutes(), d2.getSeconds(), d2.getMilliseconds());
            return d1 > d2;
        }

        split_checklist() {
            this.checklist_items = [];
            if (this.checklist == null) return;
            this.checklist.trim().split("\n").forEach(line => {
                this.checklist_items.push({
                    state: line.trim().charAt("1") == "x",
                    text: line.trim().slice(3).trim(),
                })
            });
        }

        concat_checklist() {
            let lines = [];
            this.checklist_items.forEach(item => {
                lines.push(`[${item.state ? "x" : " "}] ${item.text}`);
            });
            this.checklist = lines.join("\n");
        }

        set_checklist_item_state(i, state) {
            this.checklist_items[i].state = state;
            this.concat_checklist();
        }

        set_checklist_item_text(i, text) {
            this.checklist_items[i].text = text;
            this.concat_checklist();
        }

        inflate_title(header) {
            var self = this;
            let title = header.appendChild(document.createElement("div"));
            title.classList.add("project-title");
            title.innerHTML = converter.makeHtml(this.title).slice(3, -4);
            title.addEventListener("click", (event) => {
                event.stopPropagation();
                let input = document.createElement("input");
                input.classList.add("project-title-input");
                input.value = self.title;
                input.placeholder = "Title";
                input.addEventListener("click", (e) => {e.stopPropagation(); return false;});
                function callback() {
                    self.title = input.value.trim();
                    self.update();
                }
                input.addEventListener("focusout", callback);
                input.addEventListener("keydown", (e) => { if (e.key == "Enter") { callback(); } });
                title.replaceWith(input);
                input.focus();
                return false;
            });
        }

        inflate_category(corner) {
            var self = this;
            let category = corner.appendChild(document.createElement("div"));
            category.classList.add("project-category");
            category.textContent = this.category;
            category.addEventListener("click", (event) => {
                event.stopPropagation();
                let input = document.createElement("input");
                input.classList.add("project-category-input");
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

        inflate_status(corner) {
            var self = this;
            let status = corner.appendChild(document.createElement("div"));
            status.classList.add("project-status");
            status.textContent = this.status;
            status.addEventListener("click", (event) => {
                event.stopPropagation();
                let select = document.createElement("select");
                select.classList.add("project-status-select");
                select.addEventListener("click", (e) => {
                    e.stopPropagation();
                    return false;
                });
                STATUS_CHOICES.forEach(option_value => {
                    let option = document.createElement("option");
                    option.classList.add("project-status-option");
                    option.value = option_value;
                    option.textContent = option_value;
                    if (option_value == self.status) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });
                function callback() {
                    select.querySelectorAll("option").forEach(option => {
                        if (option.selected) {
                            self.status = option.value;
                        }
                    });
                    self.update();
                }
                select.addEventListener("focusout", callback);
                select.addEventListener("change", callback);
                status.replaceWith(select);
                select.focus();
                return false;
            });
        }

        inflate_limit_date(summary) {
            var self = this;
            let limit_date = summary.appendChild(document.createElement("div"));
            limit_date.classList.add("project-limitdate");
            if (this.is_limit_date_soon()) {
                limit_date.classList.add("project-limitdate-soon");
            } else if (this.is_limit_date_overdue()) {
                limit_date.classList.add("project-limitdate-overdue");
            }
            let limit_date_icon = document.createElement("i");
            limit_date_icon.classList.add("icon");
            limit_date_icon.classList.add("icon-clock");
            limit_date.appendChild(limit_date_icon);
            let limit_date_text = document.createElement("span");
            limit_date_text.textContent = this.get_limit_date_display();
            limit_date.appendChild(limit_date_text);
            limit_date.addEventListener("click", (event) => {
                event.stopPropagation();
                let input = document.createElement("input");
                input.classList.add("project-limitdate-input");
                input.type = "date";
                input.value = self.limit_date;
                function callback() {
                    self.limit_date = input.value;
                    self.update();
                }
                input.addEventListener("focusout", callback);
                input.addEventListener("keydown", (e) => { if (e.key == "Enter") { callback(); } });
                limit_date.replaceWith(input);
                input.focus();
                input.showPicker();
                return false;
            });
        }

        inflate_checklist_summary(summary) {
            let total = 0;
            let completed = 0;
            this.checklist_items.forEach(item => {
                total++;
                if (item.state) completed++;
            });
            let checklist_summary = summary.appendChild(document.createElement("div"));
            checklist_summary.classList.add("project-checklist-summary");
            if (completed == total) {
                checklist_summary.classList.add("project-checklist-summary-done");
            }
            let checklist_summary_icon = document.createElement("i");
            checklist_summary_icon.classList.add("icon");
            checklist_summary_icon.classList.add("icon-task");
            checklist_summary.appendChild(checklist_summary_icon);
            let checklist_text = document.createElement("span");
            checklist_text.textContent = `${completed}/${total}`;
            checklist_summary.appendChild(checklist_text);
        }

        inflate_description_summary(summary) {
            let icon = summary.appendChild(document.createElement("i"));
            icon.classList.add("icon");
            icon.classList.add("icon-note");
        }

        inflate_header() {
            var self = this;
            let header = this.container.appendChild(document.createElement("div"));
            header.classList.add("project-header");
            header.addEventListener("contextmenu", (event) => {
                event.preventDefault();
                self.inflate_contextmenu(event); // cursor position required to position the menu
            });
            this.inflate_title(header);
            let corner = header.appendChild(document.createElement("div"));
            corner.classList.add("project-corner");
            this.inflate_category(corner);
            this.inflate_status(corner);
            if (this.limit_date == null && this.description == null && this.checklist == null) return;
            let summary = header.appendChild(document.createElement("div"));
            summary.classList.add("project-summary");
            if (this.description != null || this.checklist != null) {
                summary.classList.add("c-hand");
            }
            if (this.limit_date != null) this.inflate_limit_date(summary);
            if (this.checklist != null) this.inflate_checklist_summary(summary);
            if (this.description != null) this.inflate_description_summary(summary);
            summary.addEventListener("click", (event) => {
                self.toggle_expanded();
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

        inflate_description_textarea(element) {
            var self = this;
            let textarea = document.createElement("textarea");
            textarea.classList.add("project-description-textarea");
            textarea.value = "";
            if (this.description != null) {
                textarea.value = this.description;
            }
            textarea.placeholder = "Description (Markdown)";
            function callback() {
                self.description = textarea.value.trim();
                if (self.description == "") {
                    self.description = null;
                }
                self.update();
            }
            textarea.addEventListener("focusout", callback);
            element.replaceWith(textarea);
            textarea.focus();
            this.update_expansion();
        }

        inflate_description(body) {
            var self = this;
            let description = body.appendChild(document.createElement("div"));
            description.classList.add("project-description");
            description.innerHTML = converter.makeHtml(this.description);
            description.addEventListener("click", (event) => {
                event.stopPropagation();
                self.inflate_description_textarea(description);
                return false;
            });
        }

        inflate_checklist_item_label_input(element, initial_value, entry_index) {
            var self = this;
            let input = document.createElement("input");
            input.classList.add("project-checklist-item-input");
            input.value = initial_value;
            input.placeholder = "Checklist item";
            function callback() {
                let value = input.value.trim();
                if (value == "") {
                    self.checklist_items.splice(entry_index, 1);
                    if (self.checklist_items.length == 0) {
                        self.checklist = null;
                        self.checklist_items = [];
                    } else {
                        self.concat_checklist();
                    }
                } else {
                    self.set_checklist_item_text(entry_index, value);
                }
                self.update();
            }
            input.addEventListener("focusout", callback);
            input.addEventListener("keydown", (e) => { if (e.key == "Enter") { callback(); } });
            element.replaceWith(input);
            input.focus();
            this.update_expansion();
        }

        inflate_checklist_items(checklist) {
            var self = this;
            checklist.innerHTML = "";
            this.checklist_items.forEach((item, i) => {
                let checklist_item = checklist.appendChild(document.createElement("div"));
                checklist_item.classList.add("project-checklist-item");
                let checkbox = checklist_item.appendChild(document.createElement("input"));
                checkbox.type = "checkbox";
                let label = checklist_item.appendChild(document.createElement("label"));
                label.textContent = converter.makeHtml(item.text).slice(3, -4); // slice to remove <p> tag
                if (item.state) {
                    checkbox.checked = true;
                    checklist_item.classList.add("project-checklist-item-checked");
                }
                checkbox.addEventListener("click", (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    self.set_checklist_item_state(i, !item.state);
                    self.update();
                    return false;
                });
                label.addEventListener("click", (event) => {
                    event.stopPropagation();
                    self.inflate_checklist_item_label_input(label, item.text, i);
                    return false;
                });
            });
        }

        inflate_checklist(body) {
            var self = this;
            let checklist = body.appendChild(document.createElement("div"));
            checklist.classList.add("project-checklist");
            this.inflate_checklist_items(checklist);
            let button_add_item = checklist.appendChild(document.createElement("button"));
            button_add_item.classList.add("project-button");
            button_add_item.innerHTML = `<i class="icon icon-plus"></i> Add`;
            button_add_item.addEventListener("click", (event) => {
                event.stopPropagation();
                self.checklist_items.push({state: false, text: ""});
                self.concat_checklist();
                self.inflate_checklist_items(checklist);
                let element = checklist.querySelector(".project-checklist-item:last-child label");
                self.inflate_checklist_item_label_input(element, "", self.checklist_items.length - 1);
                return false;
            });
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

        update_expansion() {
            if (this.expanded) {
                this.expand();
            } else {
                this.contract();
            }
        }

        toggle_expanded() {
            this.expanded = !this.expanded;
            this.update_expansion();
        }

        inflate_body() {
            let body = this.container.querySelector(".project-body");
            if (body == null) {
                body = this.container.appendChild(document.createElement("div"));
            } else {
                body.innerHTML = "";
            }
            body.className = "project-body";
            if (this.description != null) this.inflate_description(body);
            if (this.checklist != null) this.inflate_checklist(body);
            this.update_expansion();
        }

        inflate_progress() {
            var self = this;
            this.container.classList.add("has_progress");
            let wrapper = this.container.appendChild(document.createElement("div"));
            wrapper.classList.add("project-progress-wrapper");
            let progress = wrapper.appendChild(document.createElement("progress"));
            progress.classList.add("project-progress");
            progress.min = this.progress.min;
            progress.max = this.progress.max;
            progress.value = this.progress.current;
            wrapper.title = `${progress.value}/${progress.max}`;
            let button_sub = wrapper.appendChild(document.createElement("div"));
            button_sub.classList.add("project-progress-sub");
            button_sub.textContent = "−";
            button_sub.addEventListener("click", (event) => {
                event.stopPropagation();
                self.progress.current = Math.max(self.progress.min, self.progress.current - 1);
                self.update();
                return false;
            });
            let button_add = wrapper.appendChild(document.createElement("div"));
            button_add.classList.add("project-progress-add");
            button_add.textContent = "+";
            button_add.addEventListener("click", (event) => {
                event.stopPropagation();
                self.progress.current = Math.min(self.progress.max, self.progress.current + 1);
                self.update();
                return false;
            });
        }

        inflate() {
            this.container.innerHTML = "";
            this.container.className = `project project-${this.status.toLowerCase()}`;
            this.inflate_header();
            if (this.description != null || this.checklist != null) {
                this.inflate_body();
            } else {
                this.expanded = false;
            }
            if (this.progress != null) this.inflate_progress();
        }

        inflate_contextmenu(event) {
            var self = this;
            clear_context_menus();
            let menu = document.createElement("div");
            menu.classList.add("contextmenu");

            function add_contextmenu_option(label, callback) {
                let option = menu.appendChild(document.createElement("span"));
                option.classList.add("contextmenu-entry");
                option.textContent = label;
                option.addEventListener("click", callback);
            }

            if (this.limit_date == null) {
                add_contextmenu_option("Add limit date", () => {
                    let now = new Date();
                    self.limit_date = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;
                    self.update();
                });
            } else {
                add_contextmenu_option("Remove limit date", () => {
                    self.limit_date = null;
                    self.update();
                })
            }

            if (this.description == null) {
                add_contextmenu_option("Add description", () => {
                    self.expanded = true;
                    self.description = "";
                    self.inflate_body();
                    let description_element = self.container.querySelector(".project-description");
                    self.inflate_description_textarea(description_element);
                });
            } else {
                add_contextmenu_option("Remove description", () => {
                    self.description = null;
                    self.update();
                })
            }

            if (this.checklist == null) {
                add_contextmenu_option("Add checklist", () => {
                    self.expanded = true;
                    self.checklist = "[ ] ";
                    self.split_checklist();
                    self.inflate_body();
                    let checklist_item_element = self.container.querySelector(".project-checklist-item label");
                    self.inflate_checklist_item_label_input(checklist_item_element, "", 0);
                });
            } else {
                add_contextmenu_option("Remove checklist", () => {
                    self.checklist = null;
                    self.update();
                })
            }

            if (this.progress == null) {
                add_contextmenu_option("Add progress", () => {
                    self.progress = {min: 0, max: parseInt(prompt("Number of steps", 10)), current: 0};
                    self.update();
                });
            } else {
                add_contextmenu_option("Remove progress", () => {
                    self.progress = null;
                    self.update();
                });
            }

            add_contextmenu_option("Delete project", () => {
                self.delete();
            });

            document.body.appendChild(menu);
            let bounds = menu.getBoundingClientRect();
            menu.style.left = event.clientX + "px";
            menu.style.top = Math.min(event.clientY, window.innerHeight - bounds.height) + "px";
        }

        create() {
            this.container = document.createElement("div");
            this.container.setAttribute("project_id", this.id);
            this.inflate();
            return this.container;
        }

        delete() {
            var self = this;
            if (confirm("Are you sure?") == true) {
                let form_data = new FormData();
                form_data.set("csrfmiddlewaretoken", CSRF_TOKEN);
                form_data.set("project_id", this.id);
                fetch(URL_API_PROJECT_DELETE, {
                    method: "post",
                    body: form_data
                })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            toast("Deleted!", 600);
                            delete projects[self.id];
                            self.container.parentElement.removeChild(self.container);
                            inflate_filters();
                        } else {
                            toast("An error occured", 600);
                        }
                    })
                    .catch(err => {
                        console.error(err);
                        toast("An error occured", 600);
                    });
            }
        }

        to_dict() {
            return {
                title: this.title,
                category: this.category,
                status: this.status,
                limit_date: this.limit_date,
                progress: this.progress,
                description: this.description,
                checklist: this.checklist,
            }
        }

        to_json_string() {
            return JSON.stringify(this.to_dict());
        }

        save() {
            let project_data = this.to_json_string();
            if (project_data == this.previous_project_data) {
                console.log("No change detected, skipping save");
                return;
            }
            this.previous_project_data = project_data;
            let form_data = new FormData();
            form_data.set("csrfmiddlewaretoken", CSRF_TOKEN);
            form_data.set("project_id", this.id);
            form_data.set("project_data", project_data);
            fetch(URL_API_PROJECT_EDIT, {
                method: "post",
                body: form_data
            })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        toast("Saved!", 600);
                    } else {
                        toast("An error occured", 600);
                    }
                })
                .catch(err => {
                    console.error(err);
                    toast("An error occured", 600);
                });
        }

        update() {
            this.save();
            this.inflate();
            inflate_filters();
        }

    }

    function inflate_projects() {
        let container = document.getElementById("projects");
        container.innerHTML = "";
        let project_indices = [...Object.keys(projects)];
        project_indices.sort((a, b) => {
            let status_ordering = STATUS_ORDERING[projects[a].status] - STATUS_ORDERING[projects[b].status];
            if (status_ordering == 0) {
                return projects[b].modification - projects[a].modification;
            }
            return status_ordering;
        });
        project_indices.forEach(project_id => {
            container.appendChild(projects[project_id].create());
        });
    }

    function create_filter(container, attr, value) {
        let wrapper = container.appendChild(document.createElement("div"));
        let input = wrapper.appendChild(document.createElement("input"));
        input.classList.add("mr-1");
        input.type = "checkbox";
        input.checked = true;
        input.id = `filter-${attr}-${value}`;
        input.classList.add("c-hand");
        let label = wrapper.appendChild(document.createElement("label"));
        label.setAttribute("for", `filter-${attr}-${value}`);
        label.classList.add("c-hand");
        let concerned = 0;
        for (let project_id in projects) {
            if (projects[project_id][attr] == value) {
                concerned++;
            }
        }
        label.textContent = `${value.toLowerCase()} (${concerned})`;
        input.addEventListener("input", () => {
            document.querySelectorAll(".project").forEach(project => {
                if (projects[project.getAttribute("project_id")][attr] == value) {
                    if (input.checked) {
                        project.style.display = "unset";
                    } else {
                        project.style.display = "none";
                    }
                }
            });
        });
        document.getElementById("project-count").textContent = [...Object.keys(projects)].length;
    }

    function inflate_filters() {
        let filter_status_container = document.getElementById("filter-status");
        filter_status_container.innerHTML = "";
        STATUS_CHOICES.forEach(status => {
            create_filter(filter_status_container, "status", status);
        });

        let category_set = new Set();
        for (let project_id in projects) {
            category_set.add(projects[project_id].category);
        }
        let categories = Array.from(category_set).toSorted();
        let category_status_container = document.getElementById("filter-category");
        category_status_container.innerHTML = "";
        categories.forEach(category => {
            create_filter(category_status_container, "category", category);
        })
    }

    fetch(URL_API_PROJECT_LIST).then(res => res.json()).then(data => {
        projects = {};
        data.projects.forEach(project_data => {
            projects[project_data.id] = new Project(project_data);;
        });
        inflate_projects();
        inflate_filters();
    });

    window.addEventListener("click", clear_context_menus);

    document.getElementById("btn-project-create").addEventListener("click", () => {
        let form_data = new FormData();
        form_data.set("csrfmiddlewaretoken", CSRF_TOKEN);
        fetch(URL_API_PROJECT_CREATE, {method: "post", body: form_data})
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    projects[data.project.id] = new Project(data.project);
                    let container = document.getElementById("projects");
                    let project_container = projects[data.project.id].create();
                    container.appendChild(project_container);
                    inflate_filters();
                } else {
                    toast("An error occured", 600);
                }
            })
            .catch(err => {
                console.error(err);
                toast("An error occured", 600);
            });
    });

});