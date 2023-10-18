window.addEventListener("load", () => {

    var calendars = {};
    var events = [];
    var tasks = [];
    var sync_date = null;
    
    class CalendarEvent {
        constructor(data) {
            this.url = data.url;
            this.title = data.title;
            this.calendar_id = data.calendar_id;
            this.dtstart = new Date(data.dtstart);
            this.dtend = new Date(data.dtend);
            this.day = `${this.dtstart.getFullYear()}-${(this.dtstart.getMonth()+1).toString().padStart(2, "0")}-${this.dtstart.getDate().toString().padStart(2, "0")}`;
            this.location = data.location;
            this.has_time = data.dtstart.length > 10;
            this.over = new Date() >= this.dtend;
        }

        inflate(container) {
            let element = container.appendChild(document.createElement("div"));
            element.classList.add("event");
            let dot_wrapper = element.appendChild(document.createElement("div"));
            dot_wrapper.classList.add("event-dot-wrapper");
            let dot = dot_wrapper.appendChild(document.createElement("div"));
            dot.classList.add("event-dot");
            if (this.over) {
                element.classList.add("event-over");
            }
            if (this.has_time) {
                let time = element.appendChild(document.createElement("div"));
                time.classList.add("event-time");
                time.textContent = this.dtstart.getHours().toString().padStart(2, "0") + ":" + this.dtstart.getMinutes().toString().padStart(2, "0");
            }
            let title = element.appendChild(document.createElement("div"));
            title.classList.add("event-title");
            title.textContent = this.title;
            if (this.location != null) {
                element.title = this.location;
            }
            let delete_button = element.appendChild(document.createElement("div"));
            delete_button.classList.add("event-delete");
            delete_button.innerHTML = `<i class="icon icon-delete"></i>`;
            delete_button.title = "Delete";
            var self = this;
            delete_button.addEventListener("click", () => {
                if (confirm("Are you sure you want to delete this event?") == true) {
                    self.delete();
                }
            });
        }

        delete() {
            let form_data = new FormData();
            form_data.set("csrfmiddlewaretoken", CSRF_TOKEN);
            form_data.set("href", this.url);
            form_data.set("calendarid", this.calendar_id);
            fetch(URL_API_CALENDAR_DELETE, {
                method: "post",
                body: form_data
                })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        toast("Event deleted", 600);
                        fetch_calendar(false);
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

    class CalendarTask {

        constructor(data) {
            this.uid = data.uid;
            this.title = data.title;
            this.calendar_id = data.calendar_id;
            this.dtstart = new Date(data.dtstart);
            this.due = null;
            if (data.due != null) {
                this.due = new Date(data.due);
            }
        }

        inflate(container) {
            var self = this;
            let element = container.appendChild(document.createElement("div"));
            element.classList.add("task");
            if (this.due != null && this.due < new Date()) {
                element.classList.add("task-overdue");
            }
            let button = element.appendChild(document.createElement("button"));
            button.classList.add("task-button-complete");
            button.title = "Complete";
            button.addEventListener("click", () => {
                if (confirm("Are you sure you want to complete this task?") == true) {
                    self.complete();
                }
            });
            button.innerHTML = `<i class="icon icon-check"></i>`;
            let title = element.appendChild(document.createElement("span"));
            title.textContent = this.title;
            title.title = `Start: ${this.dtstart.toLocaleString()}`;
            if (this.due) {
                title.title += `\nDue: ${this.due.toLocaleString()}`;
            }
        }

        complete() {
            let form_data = new FormData();
            form_data.set("csrfmiddlewaretoken", CSRF_TOKEN);
            form_data.set("uid", this.uid);
            form_data.set("calendarid", this.calendar_id);
            fetch(URL_API_CALENDAR_COMPLETE, {
                method: "post",
                body: form_data
                })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        toast("Task completed!", 600);
                        fetch_calendar(false);
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

    function fetch_calendar(force=false) {
        let url = URL_API_CALENDAR_LIST;
        if (force) {
            url = `${url}?force=1`;
        }
        fetch(url).then(res => res.json()).then(data => {
            let calendar_input_events = document.querySelector("#modal-add-event select[name='calendarid']");
            let calendar_input_tasks = document.querySelector("#modal-add-task select[name='calendarid']");
            calendar_input_events.innerHTML = "";
            calendar_input_tasks.innerHTML = "";
            calendars = {};
            data.calendars.forEach(calendar => {
                calendars[calendar.id] = calendar;
                let option = calendar_input_events.appendChild(document.createElement("option"));
                option.value = calendar.id;
                option.textContent = calendar.name;
                let option2 = calendar_input_tasks.appendChild(document.createElement("option"));
                option2.value = calendar.id;
                option2.textContent = calendar.name;
            });
            events = [];
            tasks = [];
            sync_date = data.last_sync;
            data.events.forEach(event => {
                events.push(new CalendarEvent(event));
            });
            data.tasks.forEach(task => {
                tasks.push(new CalendarTask(task));
            })
            inflate_calendar();
        }).catch(err => {
            events = [];
            sync_date = null;
            inflate_calendar();
        });
    }
    
    fetch_calendar(false);

    function inflate_events() {
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
            let date_element = container.appendChild(document.createElement("div"));
            date_element.classList.add("event-date");
            let dt = new Date(date);
            date_element.textContent = dt.toLocaleDateString(dt.locales, {weekday: "long", day: "numeric", month: "short"});
            days[date].sort((a, b) => a.dtstart - b.dtstart);
            days[date].forEach((event) => {
                event.inflate(container);
            });
        });
        
        let event_modal_btn = container.appendChild(document.createElement("button"));
        event_modal_btn.innerHTML = `<i class="icon icon-plus"></i> Add`;
        event_modal_btn.title = "Add Event";
        event_modal_btn.classList.add("event-modal-btn");
        event_modal_btn.addEventListener("click", () => {
            showModal("modal-add-event");
        });

    }

    function inflate_tasks() {
        let container = document.getElementById("tasks");
        container.innerHTML = "";

        if (tasks.length == 0) {
            container.innerHTML = "No task";
            return;
        }

        tasks.sort((a, b) => a.dtstart - b.dtstart);

        let seen = new Set();
        let current_tasks = [];
        let future_tasks = [];
        const now = new Date();

        tasks.forEach(task => {
            if (task.dtstart <= now) {
                seen.add(task.uid);
                current_tasks.push(task);
            } else if (!seen.has(task.uid)) {
                seen.add(task.uid);
                future_tasks.push(task);
            }
        });

        let task_title = container.appendChild(document.createElement("div"));
        task_title.classList.add("event-date");
        if (current_tasks.length > 0) {
            task_title.textContent = `Current tasks (${current_tasks.length})`;
            current_tasks.forEach(task => {
                task.inflate(container);
            });
        } else {
            task_title.textContent = `No current task`;
        }

        if (future_tasks.length > 0) {
            let details = container.appendChild(document.createElement("details"));
            let summary = details.appendChild(document.createElement("summary"));
            summary.textContent = `Future tasks (${future_tasks.length})`;
            summary.classList.add("event-date");
            summary.classList.add("mt-2");
            future_tasks.forEach(task => {
                task.inflate(details);
            });
        }

        let event_modal_btn = container.appendChild(document.createElement("button"));
        event_modal_btn.innerHTML = `<i class="icon icon-plus"></i> Add`;
        event_modal_btn.title = "Add Task";
        event_modal_btn.classList.add("event-modal-btn");
        event_modal_btn.addEventListener("click", () => {
            showModal("modal-add-task");
        });
        
    }

    function inflate_sync() {
        let container = document.getElementById("calendar-sync");
        container.innerHTML = "";
        let event_sync = container.appendChild(document.createElement("div"));
        event_sync.classList.add("event-sync");
        let event_sync_date = event_sync.appendChild(document.createElement("div"));
        event_sync_date.classList.add("event-sync-date");
        event_sync_date.textContent = new Date(sync_date).toLocaleString();
        event_sync_date.title = "Last synchronization";
        let event_sync_btn = event_sync.appendChild(document.createElement("div"));
        event_sync_btn.title = "Refresh";
        event_sync_btn.classList.add("event-sync-btn");
        event_sync_btn.innerHTML = `<i class="icon icon-refresh"></i>`;
        event_sync_btn.addEventListener("click", () => {
            fetch_calendar(true);
        });
    }

    function inflate_calendar() {
        inflate_events();
        inflate_tasks();
        inflate_sync();
    }

    let allday_input = document.querySelector("#modal-add-event input[name='allday']");
    function on_allday_input_change() {
        if (allday_input.checked) {
            document.querySelector("#modal-add-event input[name='dtstart-time']").disabled = true;
            document.querySelector("#modal-add-event input[name='dtend-time']").disabled = true;
        } else {
            document.querySelector("#modal-add-event input[name='dtstart-time']").removeAttribute("disabled");
            document.querySelector("#modal-add-event input[name='dtend-time']").removeAttribute("disabled");
        }
    }
    on_allday_input_change();
    allday_input.addEventListener("change", on_allday_input_change);

    document.getElementById("btn-add-event").addEventListener("click", () => {
        let form = document.getElementById("form-add-event");
        let form_data = new FormData(form);
        closeModal('modal-add-event');
        fetch(form.action, {method: form.method, body: form_data}).then(res => res.json())
            .then(data => {
                if (data.success) {
                    toast("Event added", 600);
                    fetch_calendar(false);
                } else {
                    toast("An error occured", 600);
                }
            })
            .catch(err => {
                console.error(err);
                toast("An error occured", 600);
            });
    });

    document.getElementById("btn-add-task").addEventListener("click", () => {
        let form = document.getElementById("form-add-task");
        let form_data = new FormData(form);
        closeModal('modal-add-task');
        fetch(form.action, {method: form.method, body: form_data}).then(res => res.json())
            .then(data => {
                if (data.success) {
                    toast("Task added", 600);
                    fetch_calendar(false);
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