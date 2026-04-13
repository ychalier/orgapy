const TASK_TODAY = 0;
const TASK_TOMORROW = 1;
const TASK_THIS_WEEK = 2;
const TASK_NEXT_WEEK = 3;
const TASK_THIS_MONTH = 4;
const TASK_NEXT_MONTH = 5;
const TASK_LATER = 6;
const TASK_NO_DATE = 7;

const TASK_CATEGORY_LABELS = [
    "Today",
    "Tomorrow",
    "This Week",
    "Next Week",
    "This Month",
    "Next Month",
    "Later",
    "No Date",
];

class Task {

    constructor(data) {
        this.id = data.id;
        this.title = data.title;
        this.startDate = new Date(data.start_date);
        this.dueDate = data.due_date ? new Date(data.due_date) : null;
        this.recurringMode = data.recurring_mode;
        this.recurringPeriod = data.recurring_period;
        this.category = this.getCategory();
    }

    getCategory() {
        if (this.dueDate == null) return TASK_NO_DATE;
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const limitToday = new Date(now.getTime());
        limitToday.setTime(limitToday.getTime() + 24 * 3600 * 1000);
        if (this.dueDate < limitToday) {
            return TASK_TODAY;
        }
        const limitTomorrow = new Date(limitToday.getTime());
        limitTomorrow.setTime(limitTomorrow.getTime() + 24 * 3600 * 1000);
        if (this.dueDate < limitTomorrow) {
            return TASK_TOMORROW;
        }
        const limitThisWeek = new Date(limitToday.getTime());
        const daysTillEndOfWeek = 6 - (now.getDay() + 6) % 7;
        limitThisWeek.setTime(limitThisWeek.getTime() + daysTillEndOfWeek * 24 * 3600 * 1000);
        if (this.dueDate < limitThisWeek) {
            return TASK_THIS_WEEK;
        }
        const limitNextWeek = new Date(limitThisWeek.getTime() + 7 * 24 * 3600 * 1000);
        if (this.dueDate < limitNextWeek) {
            return TASK_NEXT_WEEK;
        }
        const limitThisMonth = new Date(now.getTime());
        limitThisMonth.setDate(1);
        if (now.getMonth() == 11) {
            limitThisMonth.setFullYear(now.getFullYear() + 1);
            limitThisMonth.setMonth(0);
        } else {
            limitThisMonth.setMonth(now.getMonth() + 1);
        }
        if (this.dueDate < limitThisMonth) {
            return TASK_THIS_MONTH;
        }
        const limitNextMonth = new Date(limitThisMonth.getTime());
        if (limitThisMonth.getMonth() == 11) {
            limitNextMonth.setFullYear(limitThisMonth.getFullYear() + 1);
            limitNextMonth.setMonth(0);
        } else {
            limitNextMonth.setMonth(limitThisMonth.getMonth() + 1);
        }
        if (this.dueDate < limitNextMonth) {
            return TASK_NEXT_MONTH;
        }
        return TASK_LATER;
    }

    inflate(container, onClick, onSave) {

        var self = this;
        this.element = create(container, "div", "task");
        let thisMorning = new Date();
        thisMorning.setHours(0, 0, 0, 0);
        if (this.dueDate != null && this.dueDate < thisMorning) {
            this.element.classList.add("task-overdue");
        }
        let button = create(this.element, "button", "task-button-complete");
        button.title = "Complete";
        button.addEventListener("click", () => {
            if (confirm(`Are you sure you want to complete the task '${this.title}'?`) == true) {
                self.complete(onSave);
            }
        });
        button.innerHTML = `<i class="ri-check-line"></i>`;
        let title = create(this.element, "span");
        title.textContent = this.title;
        title.title = `Start: ${dtf(this.startDate, "dd/mm/YYYY")}`;
        if (this.dueDate != null) {
            title.title += `\nDue: ${dtf(this.dueDate, "dd/mm/YYYY")}`;
        }
        title.onclick = () => {onClick(self)};
    }

    complete(onSave) {
        apiPost("complete-task", {id: this.id}, () => {
            toast("Task completed!", 600);
            onSave(self);
        });
    }

}

function fetchAndInflateTasks(container, taskDialog) {

    var tasks = [];

    function inflateTasks() {
        container.innerHTML = "";

        tasks.sort((a, b) => {
            if (a.dueDate == null && b.dueDate != null) {
                return -1;
            } else if (a.dueDate != null && b.dueDate == null) {
                return 1;
            } else if (a.dueDate == null && b.dueDate == null) {
                return a.start_date - b.start_date;
            } else {
                return a.due_date - b.due_date;
            }
        });
        
        for (let category = 0; category <= 7; category++) {
            const tasksInCategory = tasks.filter(task => task.category == category);
            if (tasksInCategory.length == 0) continue;
            const details = create(container, "details");
            details.open = category == TASK_TODAY || category == TASK_TOMORROW || category == TASK_THIS_WEEK;
            create(details, "summary", "minititle").textContent = `${TASK_CATEGORY_LABELS[category]} (${tasksInCategory.length})`;
            for (const task of tasksInCategory) {
                task.inflate(
                    details,
                    (t) => {openTaskDialog(taskDialog, t)},
                    (t) => {fetchAndInflateTasks(container, taskDialog)}
                );
            }
        }
    }

    let url = URL_API + "?action=list-tasks&limit=0";
    fetch(url).then(res => res.json()).then(data => {
        tasks = [];
        const now = new Date();
        data.tasks.forEach(taskData => {
            const task = new Task(taskData);
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

function updateRecurringPeriodState(dialog) {
    const form = dialog.querySelector("form");
    const selectMode = form.querySelector("select[name='recurring_mode']");
    const inputPeriod = form.querySelector("input[name='recurring_period']");
    if (selectMode.value == "ON") {
        inputPeriod.setAttribute("disabled", "");
    } else {
        inputPeriod.removeAttribute("disabled");
    }
}

function bindTaskDialog(dialog, onSave) {
    const form = dialog.querySelector("form");
    form.querySelector("select[name='recurring_mode']").addEventListener("input", () => {updateRecurringPeriodState(dialog)});
    updateRecurringPeriodState(dialog);
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        dialog.close();
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
            onSave();
        });
    });
}

function openTaskDialog(dialog, initialTask) {
    dialog.querySelector("form").reset();
    if (initialTask != null) {
        console.log(initialTask);
        dialog.querySelector("h2").textContent = "Edit task";
        dialog.querySelector("input[name='id']").value = initialTask.id;
        dialog.querySelector("input[name='title']").value = initialTask.title;
        dialog.querySelector("input[name='start_date']").value = initialTask.startDate.toISOString().substring(0, 10);
        if (initialTask.dueDate != null) {
            dialog.querySelector("input[name='due_date']").value = initialTask.dueDate.toISOString().substring(0, 10);
        }
        dialog.querySelectorAll("select[name='recurring_mode'] option").forEach(option => {
            if (option.value == initialTask.recurringMode) {
                option.selected = true;
            } else {
                option.removeAttribute("selected");
            }
        });
        dialog.querySelector("input[name='recurring_period']").value = initialTask.recurringPeriod;
        dialog.querySelector("input[name='add']").style.display = "none";
        dialog.querySelector("input[name='save']").style.display = "unset";
        dialog.querySelector("input[name='delete']").style.display = "unset";
    } else {
        dialog.querySelector("h2").textContent = "Create task";
        dialog.querySelector("input[name='start_date']").value = (new Date()).toISOString().substring(0, 10);
        dialog.querySelector("input[name='add']").style.display = "unset";
        dialog.querySelector("input[name='save']").style.display = "none";
        dialog.querySelector("input[name='delete']").style.display = "none";
    }
    updateRecurringPeriodState(dialog);
    dialog.showModal();
}
