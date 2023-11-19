window.addEventListener("load", () => {

    var objectives = null;
    const DAYW = 32; // Day width in pixels

    function get_year_start() {
        let year_start = new Date();
        year_start.setTime(0);
        year_start.setFullYear((new Date()).getFullYear());
        return year_start;
    }

    const YEAR_START = get_year_start();
    const YEAR_END = new Date(YEAR_START.getTime());
    YEAR_END.setFullYear(YEAR_START.getFullYear() + 1);
    const TODAY = new Date();
    TODAY.setHours(0, 0, 0, 0);
    const NOW = new Date();
    const DAYMS = 24 * 3600 * 1000;

    function day_offset(d) {
        return Math.floor((d - get_year_start()) / 3600 / 24 / 1000) * DAYW;
    }

    function add_days(base_date, days_to_add) {
        let result = new Date(base_date.getTime());
        result.setDate(result.getDate() + Math.floor(days_to_add));
        let remainder = days_to_add - Math.floor(days_to_add);        
        if (remainder > 0) {
            result.setTime(result.getTime() + remainder * DAYMS);
        }
        return result;
    }

    function inflate_objgraph_head(objgraph) {
        let objgraph_head = objgraph.appendChild(document.createElement("div"));
        objgraph_head.classList.add("objgraph-head");
        objgraph_head.addEventListener("dblclick", () => {
            reset_objgraph_scroll();
        });
        let year_start = get_year_start();
        let today = new Date();
        for (let i = 0; i < 365; i++) { //TODO: leap year check
            let day = (new Date(year_start));
            day.setDate(year_start.getDate() + i);
            let objgraph_day = objgraph_head.appendChild(document.createElement("div"));
            objgraph_day.classList.add("objgraph-head-day");
            if (day.getDate() == 1) {
                objgraph_day.textContent = day.toLocaleDateString(day.locales, {month: "short"});
            }
            if (day.getDay() == 1) {
                objgraph_day.classList.add("objgraph-head-week");
            }
            if (day.getDate() == today.getDate() && day.getMonth() == today.getMonth()) {
                objgraph_day.classList.add("objgraph-head-today");
            }
        }
    }

    const SLOT_STATE_COMPLETE = 0;
    const SLOT_STATE_MISSED = 1;
    const SLOT_STATE_BUTTON = 2;
    const SLOT_STATE_COOLDOWN = 3;
    const SLOT_STATE_FUTURE = 4;
    const SLOT_STATE_FUTURE_COMPLETE = 5;

    class Slot {

        constructor(start, length, state, early=false, late=false) {
            this.start = new Date(start);
            this.length = length;
            this.state = state;
            this.early = early;
            this.late = late;
        }

        end() {
            return add_days(this.start, this.length);
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
            this.history.sort();
        }

        get_slots_strict() {
            let date_start = new Date(this.history[0] * 1000);
            date_start.setHours(0, 0, 0, 0);
            let slots = [];
            let history_index = 0;
            let is_under_cooldown = (NOW - new Date(this.history[this.history.length - 1] * 1000)) / DAYMS < this.rules.cooldown;
            while (true) {
                let date_end = add_days(date_start, this.rules.period);
                let state = null;
                let date_start_ts = Math.floor(date_start / 1000);
                let date_end_ts = Math.floor(date_end / 1000);
                let last_completion = null;
                while (history_index < this.history.length && this.history[history_index] < date_end_ts) {
                    if (this.history[history_index] >= date_start_ts) {
                        last_completion = new Date(this.history[history_index] * 1000);
                    }
                    history_index++;
                }
                let complete = last_completion != null;
                let current = NOW >= date_start && NOW < date_end;
                if (complete) {
                    state = SLOT_STATE_COMPLETE;
                } else if (current) {
                    state = is_under_cooldown ? SLOT_STATE_COOLDOWN : SLOT_STATE_BUTTON;
                } else {
                    state = SLOT_STATE_MISSED;
                }
                slots.push(new Slot(date_start, (date_end - date_start) / DAYMS, state));
                if (current) break;
                date_start = new Date(date_end.getTime());
                if (NOW < date_start) break;
            }
            return slots;
        }

        get_slots_flexible() {
            let date_start = new Date(this.history[0] * 1000);
            date_start.setHours(0, 0, 0, 0);
            let slots = [];
            let next_history_index = 1;
            let next_slot_state = SLOT_STATE_COMPLETE;
            let is_under_cooldown = (NOW - new Date(this.history[this.history.length - 1] * 1000)) / DAYMS < this.rules.cooldown;
            while (date_start <= TODAY) {
                let date_end_history = null;
                if (next_history_index < this.history.length) {
                    date_end_history = new Date(this.history[next_history_index] * 1000);
                    date_end_history.setHours(0, 0, 0, 0);
                }
                let date_end_today = new Date(TODAY.getTime());
                let date_end_period = add_days(date_start, this.rules.period);
                let date_ends = [date_end_history, date_end_today, date_end_period];
                if (next_slot_state == SLOT_STATE_MISSED) {
                    date_ends.pop();
                }
                let i = argmin(date_ends);
                let date_end = date_ends[i];
                let minimum_size = 1;
                if ((date_end - date_start) / DAYMS < minimum_size) {
                    date_end = new Date(date_end.getTime() + (minimum_size - (date_end - date_start) / DAYMS) * DAYMS);
                }
                let length = (date_end - date_start) / DAYMS;
                let early = (next_slot_state == SLOT_STATE_BUTTON || next_slot_state == SLOT_STATE_COOLDOWN) && slots[slots.length - 1].length < this.rules.period;
                let late = (next_slot_state == SLOT_STATE_BUTTON || next_slot_state == SLOT_STATE_COOLDOWN) && slots[slots.length - 1].length > this.rules.period + .9;
                slots.push(new Slot(date_start, length, next_slot_state, early, late));
                if (i == 0) {
                    next_history_index++;
                    next_slot_state = SLOT_STATE_COMPLETE;
                } else if (i == 1) {
                    next_slot_state = is_under_cooldown ? SLOT_STATE_COOLDOWN : SLOT_STATE_BUTTON;
                } else {
                    next_slot_state = SLOT_STATE_MISSED;
                }
                date_start = new Date(date_end.getTime());
            }
            let future_date_end = add_days(new Date(this.history[this.history.length - 1] * 1000), this.rules.period);
            let future_length = Math.floor((future_date_end - date_start) / DAYMS);
            if (future_length > 0) {
                slots.push(new Slot(date_start, future_length, SLOT_STATE_FUTURE_COMPLETE, false, false));
            }
            return slots;
        }

        get_slots() {
            if (this.history == null || this.history.length == 0) {
                return [new Slot(TODAY, 1, SLOT_STATE_BUTTON)];
            }
            let slots;
            switch (this.rules.type) {
                case "strict":
                    slots = this.get_slots_strict();
                    break;
                case "flexible":
                    slots = this.get_slots_flexible();
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

    function save_objective_history(objective_id) {
        let form_data = new FormData();
        form_data.set("csrfmiddlewaretoken", CSRF_TOKEN);
        form_data.set("objective_id", objective_id);
        form_data.set("objective_history", JSON.stringify(objectives[objective_id].history));
        fetch(URL_API + "?action=edit-objective-history", {
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

    function on_objective_check(objective_id) {
        let obj = objectives[objective_id];
        let ts = Math.floor((new Date()).getTime() / 1000);
        obj.history.push(ts);
        save_objective_history(objective_id);
        create_objgraph();
    }

    function inflate_objgraph_objective(objgraph_body, objective_id, index) {
        let dom_obj = objgraph_body.appendChild(document.createElement("div"));
        dom_obj.classList.add("objgraph-objective");
        let obj = objectives[objective_id];
        let slots = obj.get_slots();
        let date_start = new Date(slots[0].start.getTime() + DAYMS);
        dom_obj.style.marginLeft = day_offset(date_start) + "px";
        obj.history.forEach(ts => {
            dom_completion = dom_obj.appendChild(document.createElement("div"));
            dom_completion.classList.add("objgraph-completion");
            dom_completion.title = (new Date(ts * 1000)).toLocaleString();
            dom_completion.style.left = (((ts * 1000 + DAYMS - date_start.getTime()) / DAYMS) * DAYW) + "px";
            dom_completion.addEventListener("dblclick", (event) => {
                let node = document.importNode(document.getElementById("template-modal-history-checkmark").content, true);
                let modal_overlay = node.querySelector(".modal-overlay");
                function close_this_modal() {
                    document.body.removeChild(modal_overlay.parentNode);
                }
                modal_overlay.addEventListener("click", close_this_modal);
                node.querySelector("input[name='timestamp']").value = ts;
                let ts_date = new Date(ts * 1000);
                node.querySelector("input[name='date']").value = `${ts_date.getFullYear()}-${(ts_date.getMonth() + 1).toString().padStart(2, "0")}-${ts_date.getDate().toString().padStart(2, "0")}`;
                node.querySelector("input[name='time']").value = `${ts_date.getHours().toString().padStart(2, "0")}:${ts_date.getMinutes().toString().padStart(2, "0")}:${Math.floor(ts_date.getSeconds()).toString().padStart(2, "0")}`;
                let form = node.querySelector("form");
                form.addEventListener("submit", (e) => {
                    e.preventDefault();
                    let original_ts = parseInt(form.querySelector("input[name='timestamp']").value);
                    if (e.submitter.name == "save") {
                        let new_date = form.querySelector("input[name='date']").value;
                        let new_time = form.querySelector("input[name='time']").value;
                        let new_ts = Math.floor((new Date(new_date + "T" + new_time).getTime()) / 1000);
                        obj.history[obj.history.indexOf(original_ts)] = new_ts;
                        obj.history.sort();
                    } else if (e.submitter.name == "delete") {
                        obj.history.splice(obj.history.indexOf(original_ts), 1);
                    }
                    close_this_modal();
                    save_objective_history(objective_id);
                    create_objgraph();
                });
                document.body.appendChild(node);
            });
        });
        slots.forEach(slot => {
            let dom_slot = dom_obj.appendChild(document.createElement("div"));
            dom_slot.classList.add("objgraph-slot");
            dom_slot.style.width = `${DAYW * slot.length}px`;
            let dom_slot_background = dom_slot.appendChild(document.createElement("div"));
            dom_slot_background.classList.add("objgraph-slot-background");
            if (slot.state == SLOT_STATE_COMPLETE) {
                dom_slot_background.classList.add("bg-success");
            } else if (slot.state == SLOT_STATE_MISSED) {
                dom_slot_background.classList.add("bg-error");
            } else if (slot.state == SLOT_STATE_COOLDOWN) {
                if (slot.early) {
                    dom_slot_background.classList.add("bg-future-complete");
                } else {
                    dom_slot_background.classList.add("bg-cooldown");
                }
            } else if (slot.state == SLOT_STATE_FUTURE) {
                dom_slot_background.classList.add("bg-future");
            } else if (slot.state == SLOT_STATE_FUTURE_COMPLETE) {
                dom_slot_background.classList.add("bg-future-complete");
            } else if (slot.state == SLOT_STATE_BUTTON) {
                let dom_btncheck = dom_slot_background.appendChild(document.createElement("button"));
                if (slot.early) {
                    dom_btncheck.classList.add("early");
                } else if (slot.late) {
                    dom_btncheck.classList.add("late");
                }
                dom_btncheck.innerHTML = `<i class="icon icon-check"></i>`;
                dom_btncheck.addEventListener("click", () => {
                    on_objective_check(objective_id);
                });
            }
        });
        let dom_name = objgraph_body.appendChild(document.createElement("div"));
        dom_name.classList.add("objgraph-name");
        dom_name.classList.add("popover");
        dom_name.classList.add("popover-bottom");
        dom_name.textContent = obj.name;
        dom_name.style.top = ((index + 1) * 32 + 1) + "px";
        let node = document.importNode(document.getElementById("template-objective-popover").content, true);
        node.querySelector("#input-objective-id").value = obj.id;
        node.querySelector("#input-objective-name").value = obj.name;
        node.querySelectorAll("#input-objective-type option").forEach(option => {
            if (option.value == obj.rules.type) option.selected = true;
        });
        node.querySelector("#input-objective-period").value = obj.rules.period;
        node.querySelector("#input-objective-cooldown").value = obj.rules.cooldown;
        node.querySelector("form").addEventListener("submit", (event) => {
            event.preventDefault();
            if (event.submitter.name == "save" || (event.submitter.name == "delete" && confirm(`Are you sure you want to delete objective ${obj.name}?`))) {
                let formdata = new FormData(event.target, event.submitter);
                fetch(event.target.action + "?action=edit-objective", {method: "post", body: formdata}).then(res => res.json()).then(data => {
                    if (data.success) {
                        fetch_objectives();
                        toast("Saved!", 600);
                    }
                });
            }
        });
        dom_name.appendChild(node);
    }

    function inflate_objgraph_body(objgraph) {
        let objgraph_body = objgraph.appendChild(document.createElement("div"));
        objgraph_body.classList.add("objgraph-body");
        let i = 0;
        for (let objective_id in objectives) {
            inflate_objgraph_objective(objgraph_body, objective_id, i);
            i++;
        }
        if ([...Object.keys(objectives)].length == 0) {
            objgraph_body.textContent = "No objective";
            objgraph_body.style.position = "absolute";
            objgraph_body.style.left = "50%";
            objgraph_body.style.transform = "translateX(-50%)";
            objgraph.style.paddingBottom = "24px";
        }
    }

    var is_initial_scroll = true;
    function reset_objgraph_scroll() {
        let container = document.getElementById("objgraph-wrapper");
        let target = day_offset(new Date()) - 0.5 * container.getBoundingClientRect().width;
        if (is_initial_scroll) {
            container.scrollLeft = target;
            is_initial_scroll = false;
        } else {
            container.scrollTo({top: 0, left: target, behavior: "smooth"});
        }
    }

    function create_objgraph() {
        let container = document.getElementById("objgraph-wrapper");
        container.innerHTML = "";
        let objgraph = container.appendChild(document.createElement("div"));
        objgraph.classList.add("objgraph");
        inflate_objgraph_head(objgraph);
        inflate_objgraph_body(objgraph);
        reset_objgraph_scroll();
    }

    function fetch_objectives() {
        fetch(URL_API + "?action=list-objectives").then(res => res.json()).then(data => {
            objectives = {};
            data.objectives.forEach(data => {
                objectives[data.id] = new Objective(data);
            });
            create_objgraph();
        });
    }

    let modal_objective = document.getElementById("modal-add-objective");
    let node = document.importNode(document.getElementById("template-objective-popover").content, true);
    node.querySelector("#input-objective-period").value = 1;
    node.querySelector("#input-objective-cooldown").value = 0;
    let node_delete_button = node.querySelector("input[name='delete']");
    node_delete_button.parentNode.removeChild(node_delete_button);
    node.querySelector("form").addEventListener("submit", (event) => {
        event.preventDefault();
        let form = event.target;
        closeModal("modal-add-objective");
        let formdata = new FormData(form);
        fetch(form.action + "?action=add-objective", {method: "post", body: formdata}).then(res => res.json()).then(data => {
            if (data.success) {
                form.reset();
                fetch_objectives();
                toast("Added!", 600);
            }
        });
    });
    node.querySelector(".popover-container").className = "";
    modal_objective.appendChild(node);

    fetch_objectives();

});