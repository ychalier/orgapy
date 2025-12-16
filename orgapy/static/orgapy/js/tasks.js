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

var tasks = [];

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
        apiPost("complete-task", {id: this.id}, () => {
            toast("Task completed!", 600);
            fetchTasks();
        });
    }

}

function fetchTasks() {
    let url = URL_API + "?action=list-tasks&limit=0";
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
        modal.querySelector("input[name='start_date']").value = (new Date()).toISOString().substring(0, 10);
        modal.querySelector("input[name='add']").style.display = "unset";
        modal.querySelector("input[name='save']").style.display = "none";
        modal.querySelector("input[name='delete']").style.display = "none";
    }
    modal.classList.add("active");
}

function inflateTasks() {
    let container = document.getElementById("tasks");
    if (container == null) {
        console.log("Could not find tasks container");
        return;
    }
    container.innerHTML = "";

    if (tasks.length == 0) {
        remove(container.parentElement);
    }

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
        details.open = true;
        create(details, "summary", "card-subtitle").textContent = `${TASK_CATEGORY_LABELS[category]} (${tasksInCategory.length})`;
        for (const task of tasksInCategory) {
            task.inflate(details);
        }
    }
    
}

function openModalTasks() {
    let modal = document.getElementById("modal-tasks");
    let tasksContainer = modal.querySelector(".tasks");
    tasksContainer.innerHTML = "";
    fetch(URL_API + "?action=list-tasks&limit=365").then(res => res.json()).then(data => {
        data.tasks.forEach(task => {
            const taskElement = create(tasksContainer, "li");
            taskElement.textContent = `${task.title} (${new Date(task.due_date).toLocaleDateString("fr-FR", {weekday: "long", day: "numeric", month: "short"})})`;
            taskElement.addEventListener("click", () => {
                modal.classList.remove("active");
                openModalTaskForm(new Task(task));
            });
        });
    });
    modal.classList.add("active");
}

window.addEventListener("load", () => {

    document.getElementById("tasks-add").addEventListener("click", () => {
        openModalTaskForm();
    })
    
    document.getElementById("tasks-explore").addEventListener("click", openModalTasks);

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
            if (document.getElementById("tasks") == null) {
                window.location.reload();
            } else {
                fetchTasks();
            }
        });
    });

    fetchTasks();
    
});