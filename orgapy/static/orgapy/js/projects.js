window.addEventListener("load", () => {

    var checkbox_id = 0;

    function inflate_project(container, project) {

        container.innerHTML = "";
        container.setAttribute("project_id", project.id);

        let title = document.createElement("div");
        title.classList.add("project-title");
        title.textContent = project.title;
        container.appendChild(title);

        let corner_wrapper = document.createElement("div");
        corner_wrapper.classList.add("project-corner");
        container.appendChild(corner_wrapper);

        let category = document.createElement("div");
        category.classList.add("project-category");
        category.textContent = project.category;
        corner_wrapper.appendChild(category);

        let status = document.createElement("div");
        status.classList.add("project-status");
        status.textContent = project.status;
        corner_wrapper.appendChild(status);

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
            container.appendChild(progress);
        }

        let details = document.createElement("div");
        details.classList.add("project-details");
        if (project.description || project.checklist) {
            container.appendChild(details);
            container.classList.add("openable");
        }

        if (project.description) {
            let description = document.createElement("div");
            description.classList.add("project-description");
            description.innerHTML = converter.makeHtml(project.description);
            details.appendChild(description);
        }

        if (project.checklist) {
            let checklist = document.createElement("div");
            checklist.classList.add("project-checklist");
            project.checklist.split("\n").forEach(line => {
                if (line.trim() != "") {
                    let checklist_item = document.createElement("div");
                    checklist_item.classList.add("project-checklist-item");
                    let checkbox = document.createElement("input");
                    checkbox.id = `checkbox-${checkbox_id}`;
                    checkbox.type = "checkbox";
                    checklist_item.appendChild(checkbox);
                    let label = document.createElement("label");
                    label.setAttribute("for", `checkbox-${checkbox_id}`);
                    let line_html = converter.makeHtml(line.trim().slice(3).trim());
                    label.textContent = line_html.slice(3, line_html.length - 4);
                    if (line.trim().charAt(1) == "x") {
                        checkbox.checked = true;
                        checklist_item.classList.add("checked");
                    }
                    checklist_item.appendChild(label);
                    checklist.appendChild(checklist_item);
                    checkbox_id++;
                }
            });
            details.appendChild(checklist);
        }

        container.addEventListener("click", () => {
            let cdetails = container.querySelector(".project-details");
            if (container.classList.contains("open")) {
                container.classList.remove("open");
                if (cdetails) {
                    cdetails.style.height = 0;
                }
            } else {
                container.classList.add("open");
                if (cdetails) {
                    let total_height = 0;
                    container.querySelectorAll(".project-details > *").forEach(child => {
                        let bounds = child.getBoundingClientRect();
                        total_height += bounds.height;
                        let style = child.currentStyle || window.getComputedStyle(child);
                        total_height += parseFloat(style.marginTop.replace("px", "")) + parseFloat(style.marginBottom.replace("px", ""));
                    });
                    cdetails.style.height = total_height + "px";
                }
            }
        });

    }

    function inflate_projects(projects) {
        let container = document.getElementById("projects");
        container.innerHTML = "";
        projects.forEach(project => {
            let project_container = document.createElement("div");
            project_container.classList.add("project");
            inflate_project(project_container, project);
            container.appendChild(project_container);
        });
    }
    
    fetch(URL_API_PROJECTS_LIST).then(res => res.json()).then(data => {
        inflate_projects(data.projects);
    });

});