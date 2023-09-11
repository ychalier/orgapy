window.addEventListener("load", () => {

    var events = [];
    var sync_date = null;
    
    class CalendarEvent {
        constructor(data) {
            this.url = data.url;
            this.title = data.title;
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
                self.delete();
            });
        }

        delete() {
            let form_data = new FormData();
            form_data.set("csrfmiddlewaretoken", CSRF_TOKEN);
            form_data.set("href", this.url);
            fetch(URL_API_CALENDAR_DELETE, {
                method: "post",
                body: form_data
                })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        toast("Event deleted", 600);
                        fetch_events(false);
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

    function fetch_events(force=false) {
        let url = URL_API_CALENDAR_LIST;
        if (force) {
            url = `${url}?force=1`;
        }
        fetch(url).then(res => res.json()).then(data => {
            events = [];
            sync_date = data.last_sync;
            data.events.forEach(event => {
                events.push(new CalendarEvent(event));
            });
            inflate_events();
        });
    }
    
    fetch_events(false);

    function inflate_events() {
        let container = document.getElementById("events");
        container.innerHTML = "";
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
        let sync_date_el = container.appendChild(document.createElement("div"));
        sync_date_el.classList.add("event-sync");
        sync_date_el.textContent = new Date(sync_date).toLocaleString();
    }

});