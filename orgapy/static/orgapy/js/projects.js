window.addEventListener("load", () => {

    const STATUS_OPTIONS = [
        "Idea",
        "Ongoing",
        "Paused",
        "Finished",
    ];

    function clear_context_menus() {
        let context_menus = document.querySelectorAll(".contextmenu");
        for (let i = 0; i < context_menus.length; i++) {
            document.body.removeChild(context_menus[i]);
        }
    }

    var checkbox_id = 0;
    var projects = {};

    function bind_input(container, element, project_id, create_input, set_value, save_onkeydown, resize_details) {
        element.addEventListener("click", (event) => {
            event.stopPropagation();
            let input = create_input();
            element.replaceWith(input);
            if (resize_details) {
                set_details_height(container);
            }
            input.focus();
            function save() {
                set_value(input);
                let was_opened = container.classList.contains("open");
                inflate_project(container, project_id, was_opened);
            }
            input.addEventListener("focusout", () => {save();});
            if (save_onkeydown) {
                input.addEventListener("keydown", (e) => {if (e.key == "Enter") {save();}});
            }
            return false;
        });
    }

    function inflate_project(container, project_id, force_open) {

        if (!(project_id in projects)) return;
        let project = projects[project_id];

        container.innerHTML = "";

        let title = document.createElement("div");
        title.classList.add("project-title");
        title.textContent = project.title;
        container.appendChild(title);
        bind_input(container, title, project_id, () => {
            let input = document.createElement("input");
            input.classList.add("project-title");
            input.classList.add("input-seamless");
            input.type = "text";
            input.value = project.title;
            input.placeholder = "Title";
            return input;
        }, (input) => {
            projects[project_id].title = input.value;
        }, true, false);

        let corner_wrapper = document.createElement("div");
        corner_wrapper.classList.add("project-corner");
        container.appendChild(corner_wrapper);

        let category = document.createElement("div");
        category.classList.add("project-category");
        category.textContent = project.category;
        corner_wrapper.appendChild(category);
        bind_input(container, category, project_id, () => {
            let input = document.createElement("input");
            input.classList.add("project-category");
            input.classList.add("input-seamless");
            input.type = "text";
            input.value = project.category;
            input.placeholder = "Category";
            return input;
        }, (input) => {
            projects[project_id].category = input.value;
        }, true, false);

        let status = document.createElement("div");
        status.classList.add("project-status");
        status.textContent = project.status;
        corner_wrapper.appendChild(status);
        bind_input(container, status, project_id, () => {
            let select = document.createElement("select");
            select.classList.add("project-status");
            select.classList.add("input-seamless");
            STATUS_OPTIONS.forEach(option_value => {
                let option = document.createElement("option");
                option.value = option_value;
                option.textContent = option_value;
                if (option_value == projects[project_id].status) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
            return select;
        }, (select) => {
            select.querySelectorAll("option").forEach(option => {
                if (option.selected) {
                    projects[project_id].status = option.value;
                }
            });
        }, false, false);

        let summary = document.createElement("div");
        summary.classList.add("project-summary");
        if (project.limit_date || project.description || project.checklist) {
            container.appendChild(summary);
        }

        if (project.limit_date) {
            let now = new Date();
            let date = new Date(project.limit_date);
            now.setHours(date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());

            let is_soon = now >= date && now <= date;
            let is_overdue = now > date;

            let date_display = null;
            if (now.getFullYear() == date.getFullYear()) {
                date_display = date.toLocaleString(date.locales, {day: "numeric", month: "short"})
            } else {
                date_display = date.toLocaleString(date.locales, {day: "numeric", month: "short", year: "numeric"})
            }

            let limit_date = document.createElement("div");
            limit_date.classList.add("project-limitdate");
            if (is_soon) {
                limit_date.classList.add("project-limitdate-soon");
            } else if (is_overdue) {
                limit_date.classList.add("project-limitdate-overdue");
            }
            summary.appendChild(limit_date);
            let limit_date_icon = document.createElement("i");
            limit_date_icon.classList.add("icon");
            limit_date_icon.classList.add("icon-clock");
            limit_date.appendChild(limit_date_icon);
            let limit_date_text = document.createElement("span");
            limit_date_text.textContent = date_display;
            limit_date.appendChild(limit_date_text);

            bind_input(container, limit_date, project_id, () => {
                let input = document.createElement("input");
                input.classList.add("project-limitdate");
                input.classList.add("input-seamless");
                input.type = "date";
                input.value = project.limit_date;
                return input;
            }, (input) => {
                projects[project_id].limit_date = input.value;
            }, false, false);

        }

        if (project.checklist) {
            let total = 0;
            let completed = 0;
            project.checklist.split("\n").forEach(line => {
                if (line.trim() != "") {
                    if (line.startsWith("[x]")) {
                        completed++;
                    }
                    total++;
                }
            });
            if (total > 0)
            {
                let checklist_summary = document.createElement("div");
                checklist_summary.classList.add("project-checklist-summary");
                if (completed == total) {
                    checklist_summary.classList.add("project-checklist-summary-done");
                }
                summary.appendChild(checklist_summary);
                let checklist_summary_icon = document.createElement("i");
                checklist_summary_icon.classList.add("icon");
                checklist_summary_icon.classList.add("icon-task");
                checklist_summary.appendChild(checklist_summary_icon);
                let checklist_text = document.createElement("span");
                checklist_text.textContent = `${completed}/${total}`;
                checklist_summary.appendChild(checklist_text);
            }
        }

        if (project.description) {
            let description_icon = document.createElement("i");
            description_icon.classList.add("icon");
            description_icon.classList.add("icon-note");
            summary.appendChild(description_icon);
        }

        if (project.progress) {
            container.classList.add("has_progress");
            let progress = document.createElement("progress");
            progress.classList.add("project-progress");
            progress.min = project.progress.min;
            progress.max = project.progress.max;
            progress.value = project.progress.current;
            progress.title = `${progress.value}/${progress.max}`
            container.appendChild(progress);
        }

        let details = document.createElement("div");
        details.classList.add("project-details");
        details.addEventListener("click", (e) => {
            e.stopPropagation();
            return false;
        });
        if (project.description || project.checklist) {
            container.appendChild(details);
            container.classList.add("openable");
        }

        if (project.description) {
            let description = document.createElement("div");
            description.classList.add("project-description");
            description.innerHTML = converter.makeHtml(project.description);
            details.appendChild(description);
            bind_input(container, description, project_id, () => {
                let textarea = document.createElement("textarea");
                textarea.value = projects[project_id].description;
                textarea.addEventListener("click", (e) => {
                    e.stopPropagation();
                    return false;
                });
                return textarea;
            }, (textarea) => {
                projects[project_id].description = textarea.value.trim();
            }, false, true);
        }

        if (project.checklist) {
            let checklist = document.createElement("div");
            checklist.classList.add("project-checklist");
            project.checklist.split("\n").forEach((line, line_index) => {
                if (line.trim() != "") {
                    let checklist_item = document.createElement("div");
                    checklist_item.classList.add("project-checklist-item");
                    let checkbox = document.createElement("input");
                    checkbox.id = `checkbox-${checkbox_id}`;
                    checkbox.type = "checkbox";
                    checklist_item.appendChild(checkbox);
                    let label = document.createElement("label");
                    let line_html = converter.makeHtml(line.trim().slice(3).trim());
                    label.textContent = line_html.slice(3, line_html.length - 4);
                    if (line.trim().charAt(1) == "x") {
                        checkbox.checked = true;
                        checklist_item.classList.add("checked");
                    }
                    checklist_item.appendChild(label);
                    checklist.appendChild(checklist_item);
                    checkbox_id++;

                    checkbox.addEventListener("click", (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        let split = projects[project_id].checklist.split("\n");
                        if (line.trim().charAt(1) == "x") {
                            split[line_index] = "[ ] " + line.trim().slice(3).trim();
                        } else {
                            split[line_index] = "[x] " + line.trim().slice(3).trim();
                        }
                        projects[project_id].checklist = split.join("\n");
                        inflate_project(container, project_id, container.classList.contains("open"));
                        return false;
                    });

                    bind_input(container, label, project_id, () => {
                        let input = document.createElement("input");
                        input.type = "text";
                        input.value = line.trim().slice(3).trim();
                        input.classList.add("input-seamless");
                        input.addEventListener("click", (e) => {
                            e.stopPropagation();
                            return false;
                        });
                        return input;
                    }, (input) => {
                        let new_value = input.value.trim();
                        let split = projects[project_id].checklist.split("\n");
                        if (new_value == "") {
                            split.splice(line_index, 1);
                        } else {
                            if (line.trim().charAt(1) == "x") {
                                split[line_index] = "[x] " + new_value;
                            } else {
                                split[line_index] = "[ ] " + new_value;
                            }
                        }
                        projects[project_id].checklist = split.join("\n");
                        if (projects[project_id].checklist.trim() == "") {
                            projects[project_id].checklist = null;
                        }
                    }, true, true);
                }
            });
            let add_checklist_item_button = document.createElement("button");
            add_checklist_item_button.classList.add("btn");
            add_checklist_item_button.classList.add("s-rounded");
            add_checklist_item_button.classList.add("btn-sm");
            add_checklist_item_button.innerHTML = `<i class="icon icon-plus"></i> Add`;
            add_checklist_item_button.addEventListener("click", () => {
                projects[project_id].checklist += "\n[ ] Checklist item";
                inflate_project(container, project_id, true);
            });
            checklist.appendChild(add_checklist_item_button);
            details.appendChild(checklist);
        }

        if (force_open) {
            container.classList.add("open");
            set_details_height(container);
        } else {
            container.classList.remove("open");
            set_details_height(container, 0);
        }

    }

    function set_details_height(container, exact_value) {
        let details = container.querySelector(".project-details");
        if (!details) return;
        if (exact_value != undefined) {
            details.style.height = exact_value + "px";
            return;
        }
        let total_height = 0;
        container.querySelectorAll(".project-details > *").forEach(child => {
            let bounds = child.getBoundingClientRect();
            total_height += bounds.height;
            let style = child.currentStyle || window.getComputedStyle(child);
            total_height += parseFloat(style.marginTop.replace("px", "")) + parseFloat(style.marginBottom.replace("px", ""));
        });
        details.style.height = total_height + "px";
    }

    function inflate_projects() {
        let container = document.getElementById("projects");
        container.innerHTML = "";
        for (let project_id in projects) {
            let project_container = document.createElement("div");
            project_container.classList.add("project");
            project_container.setAttribute("project_id", project_id);
            inflate_project(project_container, project_id);

            project_container.addEventListener("click", () => {
                if (project_container.classList.contains("open")) {
                    project_container.classList.remove("open");
                    set_details_height(project_container, 0);
                } else {
                    project_container.classList.add("open");
                    set_details_height(project_container);
                }
            });

            project_container.addEventListener("contextmenu", (event) => {
                event.preventDefault();
                clear_context_menus();
                let menu = document.createElement("div");
                menu.classList.add("contextmenu");
                let options = [];
                function create_contextmenu_option(label, callback) {
                    let option = document.createElement("span");
                    option.classList.add("contextmenu-entry");
                    option.textContent = label;
                    option.addEventListener("click", callback);
                    return option;
                }

                if (projects[project_id].limit_date == null) {
                    options.push(create_contextmenu_option("Add limit date", (e) => {
                        let now = new Date();
                        projects[project_id].limit_date = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;
                        inflate_project(project_container, project_id, project_container.classList.contains("open"));
                    }));
                } else {
                    options.push(create_contextmenu_option("Remove limit date", (e) => {
                        projects[project_id].limit_date = null;
                        inflate_project(project_container, project_id, project_container.classList.contains("open"));
                    }));
                }

                if (projects[project_id].description == null) {
                    options.push(create_contextmenu_option("Add description", (e) => {
                        projects[project_id].description = "Description";
                        inflate_project(project_container, project_id, true);
                    }));
                } else {
                    options.push(create_contextmenu_option("Remove description", (e) => {
                        projects[project_id].description = null;
                        inflate_project(project_container, project_id, project_container.classList.contains("open"));
                    }));
                }

                if (projects[project_id].checklist == null) {
                    options.push(create_contextmenu_option("Add checklist", (e) => {
                        projects[project_id].checklist = "[ ] Step 1";
                        inflate_project(project_container, project_id, true);
                    }));
                } else {
                    options.push(create_contextmenu_option("Remove checklist", (e) => {
                        projects[project_id].checklist = null;
                        inflate_project(project_container, project_id, project_container.classList.contains("open"));
                    }));
                }

                if (projects[project_id].progress == null) {
                    options.push(create_contextmenu_option("Add progress", (e) => {
                        projects[project_id].progress = {
                            min: 0,
                            max: 10,
                            current: 0
                        }
                        inflate_project(project_container, project_id, project_container.classList.contains("open"));
                        project_container.classList.add("has_progress");
                    }));
                } else {
                    options.push(create_contextmenu_option("Remove progress", (e) => {
                        projects[project_id].progress = null;
                        inflate_project(project_container, project_id, project_container.classList.contains("open"));
                        project_container.classList.remove("has_progress");
                    }));
                    options.push(create_contextmenu_option("Edit progress", (e) => {
                        let modal = document.createElement("div");
                        modal.classList.add("modal");
                        modal.classList.add("active");
                        let modal_container = document.createElement("div");
                        modal_container.classList.add("modal-container");
                        modal.appendChild(modal_container);
                        let modal_header = document.createElement("div");
                        modal_header.classList.add("modal-header");
                        modal_header.classList.add("h5");
                        modal_header.innerHTML = `<div class="modal-title">Edit progress</div>`;
                        modal_container.appendChild(modal_header);
                        let modal_body = document.createElement("div");
                        modal_body.classList.add("modal-body");
                        modal_container.appendChild(modal_body);
                        
                        let form_group_current = document.createElement("div");
                        form_group_current.classList.add("form-group");

                        let label_current = document.createElement("label");
                        label_current.textContent = "Current";
                        label_current.classList.add("form-label");
                        form_group_current.appendChild(label_current);
                        
                        let input_current = document.createElement("input");
                        input_current.classList.add("form-input");
                        input_current.type = "number";
                        input_current.min = projects[project_id].progress.min;
                        input_current.value = projects[project_id].progress.current;
                        form_group_current.appendChild(input_current);

                        modal_body.appendChild(form_group_current);

                        let form_group_max = document.createElement("div");
                        form_group_max.classList.add("form-group");

                        let label_max = document.createElement("label");
                        label_max.textContent = "Max";
                        label_max.classList.add("form-label");
                        form_group_max.appendChild(label_max);
                        
                        let input_max = document.createElement("input");
                        input_max.classList.add("form-input");
                        input_max.type = "number";
                        input_max.min = projects[project_id].progress.min+1;
                        input_max.value = projects[project_id].progress.max;
                        form_group_max.appendChild(input_max);

                        modal_body.appendChild(form_group_max);

                        let modal_footer = document.createElement("div");
                        modal_footer.classList.add("modal-footer");
                        modal_container.appendChild(modal_footer);

                        let modal_button_save = document.createElement("button");
                        modal_button_save.classList.add("btn");
                        modal_button_save.classList.add("btn-primary");
                        modal_button_save.classList.add("mr-2");
                        modal_button_save.textContent = "Save";
                        modal_footer.appendChild(modal_button_save);

                        modal_button_save.addEventListener("click", () => {
                            projects[project_id].progress.current = parseInt(input_current.value);
                            projects[project_id].progress.max = parseInt(input_max.value);
                            inflate_project(project_container, project_id, project_container.classList.contains("open"));
                            document.body.removeChild(modal);
                        });

                        let modal_button_cancel = document.createElement("button");
                        modal_button_cancel.classList.add("btn");
                        modal_button_cancel.textContent = "Cancel";
                        modal_footer.appendChild(modal_button_cancel);

                        modal_button_cancel.addEventListener("click", () => {
                            document.body.removeChild(modal);
                        });

                        document.body.appendChild(modal);
                        inflate_project(project_container, project_id, project_container.classList.contains("open"));
                    }));
                }

                options.push(create_contextmenu_option("Delete project", (e) => {
                    //TODO: ask for confirmation
                    container.removeChild(project_container);
                    delete projects[project_id];
                }));

                options.forEach(option => {
                    menu.appendChild(option);
                });
                document.body.appendChild(menu);
                let bounds = menu.getBoundingClientRect();
                menu.style.left = event.clientX + "px";
                menu.style.top = Math.min(event.clientY, window.innerHeight - bounds.height) + "px";
            });

            container.appendChild(project_container);
        }
    }
    
    fetch(URL_API_PROJECTS_LIST).then(res => res.json()).then(data => {
        projects = {};
        data.projects.forEach(project => {
            projects[project.id] = project;
        });
        inflate_projects();
    });

    window.addEventListener("click", clear_context_menus);

});