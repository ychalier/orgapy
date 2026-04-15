var calendars = {};
var events = [];
var syncDate = null;

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

    inflate(container, deleteCallback) {
        const element = create(container, "div", "row")
        const dropdown = create(element, "div", "dropdown");
        create(dropdown, "a", "event-dot dropdown-toggle").tabIndex = 0;
        if (this.over) {
            element.classList.add("muted");
        }
        if (this.hasTime) {
            create(element, "div").textContent = dtf(this.dtstart, "HH:MM");
        }
        create(element, "div", "ellipsis").textContent = this.title;
        if (this.location != null && this.location.length > 0) {
            element.title = this.location;
        }
        const menu = create(dropdown, "ul", "menu");
        const deleteButton = create(create(menu, "li", "menu-item"), "a", "button-danger");
        deleteButton.innerHTML = `<i class="ri-delete-bin-line"></i> Delete`;
        var self = this;
        deleteButton.onclick = (e) => {
            if (confirm(`Are you sure you want to delete the event '${this.title}'?`) == true) {
                self.delete(deleteCallback);
            }
        }
        bindDropdown(dropdown, 100);
    }

    delete(callback) {
        apiPost("delete-calendar", {href: this.url, calendarid: this.calendarId}, () => {
            toast("Event deleted", 600);
            callback();
        });
    }
}

function fetchEvents(eventsContainer, refreshButton, force=false) {
    let url = URL_API + "?action=list-calendars";
    if (force) {
        url = `${url}&force=1`;
    }
    fetch(url).then(res => res.json()).then(data => {
        const calendarInputEvents = dialogAddEvent.querySelector("select[name='calendarid']"); //WARN: dialogAddEvent may not exist
        calendarInputEvents.innerHTML = "";
        calendars = {};
        data.calendars.forEach(calendar => {
            calendars[calendar.id] = calendar;
            const option = create(calendarInputEvents, "option");
            option.value = calendar.id;
            option.textContent = calendar.name;
        });
        events = [];
        syncDate = data.last_sync;
        data.events.forEach(event => {
            events.push(new CalendarEvent(event));
        });
        inflateCalendar(eventsContainer, refreshButton);
    }).catch(err => {
        events = [];
        syncDate = null;
        inflateCalendar(eventsContainer, refreshButton);
    });
}

function inflateEvents(eventsContainer, refreshButton) {
    
    eventsContainer.innerHTML = "";

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
        const details = create(eventsContainer, "details");
        details.setAttribute("open", "");
        const summary = create(details, "summary", "minititle");
        const dt = new Date(date);
        summary.textContent = dt.toLocaleDateString(dt.locales, {weekday: "long", day: "numeric", month: "short"});
        days[date].sort((a, b) => a.dtstart - b.dtstart);
        days[date].forEach((event) => {
            event.inflate(details, () => {
                fetchEvents(eventsContainer, refreshButton, false);
            });
        });
    });

}

function inflateSync(refreshButton) {
    if (syncDate == null) return;
    refreshButton.title = "Last synchronization: " + new Date(syncDate).toLocaleString();
}

function inflateCalendar(eventsContainer, refreshButton) {
    inflateEvents(eventsContainer, refreshButton);
    inflateSync(refreshButton);
}

function onAllDayInputChange() {
    const allDayInput = dialogAddEvent.querySelector("input[name='allday']");
    if (allDayInput.checked) {
        dialogAddEvent.querySelector("input[name='dtstart-time']").disabled = true;
        dialogAddEvent.querySelector("input[name='dtend-time']").disabled = true;
    } else {
        dialogAddEvent.querySelector("input[name='dtstart-time']").removeAttribute("disabled");
        dialogAddEvent.querySelector("input[name='dtend-time']").removeAttribute("disabled");
    }
}

function onEventSubmit(eventsContainer, eventForm, refreshButton) {
    let formData = new FormData(eventForm);
    dialogAddEvent.close()
    fetchApi(eventForm.action, eventForm.method, formData, () => {
        toast("Event added", 600);
        if (eventsContainer == null) {
            window.location.reload();
        } else {
            fetchEvents(eventsContainer, refreshButton, false);
        }
    });
}

function onEventRefresh(eventsContainer, refreshButton) {
    if (eventsContainer == null) {
        window.location.reload();
    } else {
        fetchEvents(eventsContainer, refreshButton, true);
    }
}

window.addEventListener("load", () => {
    dialogAddEvent.querySelector("input[name='allday']").addEventListener("change", onAllDayInputChange);
    onAllDayInputChange();
})