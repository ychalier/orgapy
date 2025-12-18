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

    inflate(container) {
        let element = create(container, "div", "event")
        let dotWrapper = create(element, "div", "event-dot-wrapper dropdown");
        create(dotWrapper, "a", "event-dot dropdown-toggle").tabIndex = 0;
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
        let eventActionsList = create(dotWrapper, "ul", "menu");
        let eventDeleteListItem = create(eventActionsList, "li", "menu-item");
        let eventDeleteButton = create(eventDeleteListItem, "a");
        eventDeleteButton.innerHTML = `<i class="ri-delete-bin-line"></i> Delete`;
        eventDeleteButton.title = "Delete";
        var self = this;
        eventDeleteButton.addEventListener("click", () => {
            if (confirm(`Are you sure you want to delete the event '${this.title}'?`) == true) {
                self.delete();
            }
        });
    }

    delete() {
        apiPost("delete-calendar", {href: this.url, calendarid: this.calendarId}, () => {
            toast("Event deleted", 600);
            fetchEvents(false);
        });
    }
}

function fetchEvents(force=false) {
    let url = URL_API + "?action=list-calendars";
    if (force) {
        url = `${url}&force=1`;
    }
    fetch(url).then(res => res.json()).then(data => {
        let calendarInputEvents = dialogAddEvent.querySelector("select[name='calendarid']");
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

function inflateEvents() {
    let container = document.getElementById("events");
    container.innerHTML = "";
    
    if (events.length == 0) {
        remove(container.parentElement);
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

}

function inflateSync() {
    if (syncDate == null) return;
    document.getElementById("events-refresh").title = "Last synchronization: " + new Date(syncDate).toLocaleString();
}

function inflateCalendar() {
    inflateEvents();
    inflateSync();
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

window.addEventListener("load", () => {
    document.getElementById("btn-add-event").addEventListener("click", () => {
        let form = document.getElementById("form-add-event");
        let formData = new FormData(form);
        dialogAddEvent.close()
        fetchApi(form.action, form.method, formData, () => {
            toast("Event added", 600);
            if (document.getElementById("events") == null) {
                window.location.reload();
            } else {
                fetchEvents(false);
            }
        });
    });

    document.getElementById("events-refresh").addEventListener("click", () => {
        if (document.getElementById("events") == null) {
            window.location.reload();
        } else {
            fetchEvents(true);
        }
    });

    document.getElementById("events-add").addEventListener("click", () => {
        dialogAddEvent.showModal();
    });

    dialogAddEvent.querySelector("input[name='allday']").addEventListener("change", onAllDayInputChange);

    onAllDayInputChange();
    fetchEvents(false);
})