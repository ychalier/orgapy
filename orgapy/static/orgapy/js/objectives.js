//var objectives = null;
var isInitialScroll = true;
const DAYW = 32; // Day width in pixels

function getYearStart() {
    let yearStart = new Date();
    yearStart.setTime(0);
    yearStart.setFullYear((new Date()).getFullYear());
    return yearStart;
}

const DAYMS = 24 * 3600 * 1000;
const YEAR_START = getYearStart();
const YEAR_END = new Date(YEAR_START.getTime());
YEAR_END.setFullYear(YEAR_START.getFullYear() + 1);
const TODAY = new Date();
if (TODAY.getHours() < OBJECTIVE_START_HOURS) {
    TODAY.setTime(TODAY.getTime() - DAYMS);
}
TODAY.setHours(OBJECTIVE_START_HOURS, 0, 0, 0);
const NOW = new Date();

const SLOT_STATE_COMPLETE = 0;
const SLOT_STATE_MISSED = 1;
const SLOT_STATE_BUTTON = 2;
const SLOT_STATE_COOLDOWN = 3;
const SLOT_STATE_FUTURE = 4;
const SLOT_STATE_FUTURE_COMPLETE = 5;


function dayOffset(d) {
    return Math.round((d - getYearStart()) / 1000 / 3600 / 24) * DAYW;
}

function addDays(baseDate, daysToAdd) {
    const newDate = new Date(baseDate);
    newDate.setDate(newDate.getDate() + daysToAdd);
    return newDate;
}

function daysDiff(a, b) {
    const utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((utc2 - utc1) / 1000 / 3600 / 24);
}

class Slot {

    constructor(start, length, state, early=false, late=false) {
        this.start = new Date(start);
        this.length = length;
        this.state = state;
        this.early = early;
        this.late = late;
    }

    end() {
        return addDays(this.start, this.length);
    }

}

class Objective {

    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.history = data.history;
        if (this.history == null) {
            this.history = [];
        }
        this.period = data.period;
        this.flexible = data.flexible;
        this.archived = data.archived;
        this.history.sort();
    }

    getSlots() {
        if (this.history == null || this.history.length == 0) {
            return [new Slot(TODAY, 1, SLOT_STATE_BUTTON)];
        }
        const completions = [];
        for (const ts of this.history) {
            let date = new Date(ts * 1000);
            if (date.getHours() < OBJECTIVE_START_HOURS) {
                date = addDays(date, -1);
            }
            date.setHours(OBJECTIVE_START_HOURS, 0, 0, 0);
            completions.push(date);
        }
        let n = this.history.length, i = 0, early = false, late = false, preset = false;
        let slots = [];
        let dateStart = completions[0];
        while (dateStart < YEAR_END - DAYMS) {
            let presetUsed = false;
            while (i < n && completions[i] < dateStart) {
                i++;
            }
            let dateEnd = addDays(dateStart, this.period);
            let cut = false;
            if (this.flexible) {
                if (early) {
                    dateEnd = addDays(dateStart, 1);
                    preset = true;
                } else if (late) {
                    dateEnd = addDays(dateStart, 1);
                } else if (preset) {
                    let length = this.period - slots[slots.length - 2].length - 1;
                    if (length > 0) {
                        presetUsed = true;
                        dateEnd = addDays(dateStart, length);
                    }
                } else {
                    for (let j = i; j < n; j++) {
                        if (completions[j] > dateStart && completions[j] < dateEnd) {
                            dateEnd = completions[j];
                            break;
                        }
                        if (completions[j] >= dateEnd) break;
                    }
                    if (TODAY > dateStart && TODAY < dateEnd) {
                        cut = true;
                        dateEnd = TODAY;
                    }
                }
            }
            let completed = i < n && completions[i] < dateEnd;
            let state = SLOT_STATE_MISSED;
            if (presetUsed) {
                state = SLOT_STATE_FUTURE_COMPLETE;
            } else if (completed) {
                state = SLOT_STATE_COMPLETE;
            } else if (TODAY >= dateStart && TODAY < dateEnd) {
                state = SLOT_STATE_BUTTON;
            } else if (TODAY < dateStart) {
                state = SLOT_STATE_FUTURE;
            }
            if (this.flexible && state == SLOT_STATE_BUTTON) {
                dateEnd = addDays(dateStart, 1);
            }
            let slot = new Slot(dateStart, daysDiff(dateStart, dateEnd), state, early, late);
            slots.push(slot);
            dateStart = dateEnd;
            if (!early) {
                preset = false;
            }
            if (cut) {
                if (completed) {
                    early = true;
                } else {
                    late = true;
                }
            } else {
                early = false;
                late = false;
            }
        }

        return slots;
    }

}

function saveObjectiveHistory(objectiveId, objectiveHistory, onSubmit) {
    apiPost("edit-objective-history",
        {
            objective_id: objectiveId,
            objective_history: JSON.stringify(objectiveHistory)
        },
        () => {
            toast("Saved objective history", 600);
            onSubmit();
        }
    );
}

function onObjectiveCheck(objective, onSubmit) {
    const ts = Math.floor((new Date()).getTime() / 1000);
    objective.history.push(ts);
    saveObjectiveHistory(objective.id, objective.history, onSubmit);
}

function resetObjectivesScroll(container) {
    const target = dayOffset(new Date()) - 0.5 * container.getBoundingClientRect().width;
    if (isInitialScroll) {
        container.scrollLeft = target;
        isInitialScroll = false;
    } else {
        container.scrollTo({top: 0, left: target, behavior: "smooth"});
    }
}

function inflateObjective(container, objective, rowIndex, objectiveDialog, completionDialog) {

    function inflateObjectiveElement(element) {

        element.innerHTML = "";
        
        const slots = objective.getSlots();
        slots.forEach(slot => {
            if (dayOffset(slot.start) + DAYW * slot.length < 0) return;
            const slotEl = create(element, "div", "objective-slot");
            slotEl.style.width = `${DAYW * slot.length}px`;
            slotEl.style.left = `${dayOffset(slot.start)}px`;
            const slotBgEl = create(slotEl, "div", "objective-slot-bg");
            if (slot.state == SLOT_STATE_COMPLETE) {
                slotBgEl.classList.add("bg-success");
            } else if (slot.state == SLOT_STATE_MISSED) {
                slotBgEl.classList.add("bg-error");
            } else if (slot.state == SLOT_STATE_COOLDOWN) {
                if (slot.early) {
                    slotBgEl.classList.add("bg-future-complete");
                } else {
                    slotBgEl.classList.add("bg-cooldown");
                }
            } else if (slot.state == SLOT_STATE_FUTURE) {
                slotBgEl.classList.add("bg-future");
            } else if (slot.state == SLOT_STATE_FUTURE_COMPLETE) {
                slotBgEl.classList.add("bg-future-complete");
            } else if (slot.state == SLOT_STATE_BUTTON) {
                const buttonCheck = create(slotBgEl, "button");
                if (slot.early) {
                    buttonCheck.classList.add("early");
                } else if (slot.late) {
                    buttonCheck.classList.add("late");
                }
                buttonCheck.innerHTML = `<i class="ri-check-line"></i>`;
                buttonCheck.addEventListener("click", () => {
                    onObjectiveCheck(objective, () => {
                        inflateObjectiveElement(element);
                    });
                });
            }
        });

        objective.history.forEach(ts => {
            const offsetInDays = (ts * 1000 - getYearStart()) / DAYMS;
            if (offsetInDays < 0) return;
            const completionEl = create(element, "div", "objective-completion");
            completionEl.title = (new Date(ts * 1000)).toLocaleString();
            const OBJECTIVE_COMPLETION_WIDTH = 4;
            const OBJECTIVE_COMPLETION_OFFSET = 4;
            const completionOffset = Math.floor(offsetInDays) * DAYW
                + (DAYW - 2 * OBJECTIVE_COMPLETION_OFFSET - OBJECTIVE_COMPLETION_WIDTH) * (offsetInDays - Math.floor(offsetInDays))
                + OBJECTIVE_COMPLETION_OFFSET;
            completionEl.style.left = completionOffset + "px";
            completionEl.tabIndex = -1;
            completionEl.addEventListener("click", (event) => {
                openCompletionDialog(completionDialog, objective.id, objective.name, objective.history, ts);
            });
        });
    }

    const element = create(container, "div", "objective");
    inflateObjectiveElement(element);

    const nameEl = create(container, "button", "objective-name");
    if (objective.archived) {
        nameEl.classList.add("archived");
    }
    nameEl.textContent = objective.name;
    nameEl.style.top = ((rowIndex + 1) * 32) + "px";
    nameEl.addEventListener("click", (event) => {
        openObjectiveDialog(objectiveDialog, objective);
    });

}

function inflateObjectives(container, objectives, objectiveDialog, completionDialog) {
    container.innerHTML = "";

    container = create(container, "div", "objectives-container");

    const header = create(container, "div", "objectives-header");
    header.ondblclick = () => {resetObjectivesScroll(container)};
    const yearStart = getYearStart();
    const year = TODAY.getFullYear();
    const daysInYear = ((year % 4 === 0 && year % 100 > 0) || year % 400 == 0) ? 366 : 365;
    for (let i = 0; i < daysInYear; i++) {
        const day = (new Date(yearStart));
        day.setDate(yearStart.getDate() + i);
        const dayEl = create(header, "div", "objectives-header-day");
        dayEl.style.left = (i * DAYW) + "px";
        dayEl.title = day.toLocaleDateString(day.locales, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        });
        if (day.getDate() == 1) {
            dayEl.textContent = day.toLocaleDateString(day.locales, {month: "short"});
        }
        if (day.getDay() == 1) {
            dayEl.classList.add("objectives-header-week");
        }
        if (day.getDate() == TODAY.getDate() && day.getMonth() == TODAY.getMonth()) {
            dayEl.classList.add("objectives-header-today");
        }
    }

    const body = create(container, "div", "objectives-body");
    let i = 0;
    for (const objectiveId in objectives) {
        inflateObjective(body, objectives[objectiveId], i, objectiveDialog, completionDialog);
        i++;
    }

    if ([...Object.keys(objectives)].length == 0) {}

    resetObjectivesScroll(container);
}

function fetchAndInflateObjectives(container, showArchived, objectiveDialog, completionDialog) {
    isInitialScroll = true;
    fetch(URL_API + `?action=list-objectives${showArchived ? "&archived=1" : ""}`).then(res => res.json()).then(data => {
        const objectives = {};
        data.objectives.forEach(data => {
            objectives[data.id] = new Objective(data);
        });
        inflateObjectives(container, objectives, objectiveDialog, completionDialog);
    });
}

function bindObjectiveDialog(dialog, completionDialog, onSubmit) {
    bindCompletionDialog(completionDialog, onSubmit);
    const form = dialog.querySelector("form");
    form.onsubmit = (event) => {
        event.preventDefault();
        dialog.close();
        if (event.submitter.name == "completion") {
            const objectiveId = parseInt(event.target.querySelector("input[name='id']").value);
            const objectiveName = event.target.querySelector("input[name='name']").value;
            const objectiveHistory = JSON.parse(event.target.querySelector("input[name='history']").value);
            openCompletionDialog(completionDialog, objectiveId, objectiveName, objectiveHistory);
            return;
        }
        if (event.submitter.name == "archive") {
            const objectiveId = parseInt(event.target.querySelector("input[name='id']").value);
            const archived = event.target.querySelector("input[name='archived']").value == "on";
            const prefix = archived ? "un" : "";
            const url = `${URL_API}?action=${prefix}archive-objective`;
            const formData = new FormData(event.target, event.submitter);
            formData.append("objective_id", objectiveId);
            fetchApi(url, "post", formData, () => {
                if (archived) {
                    toast("Unarchived!", 600);
                } else {
                    toast("Archived!", 600);
                }
                onSubmit();
            });
            return;
        }
        if (event.submitter.name == "delete" && !confirm(`Are you sure you want to delete this objective?`)) return;
        let url = URL_API + "?action=";
        switch (event.submitter.name) {
            case "add":
                url += "add-objective";
                break;
            case "save":
                url += "edit-objective";
                break;
            case "delete":
                url += "delete-objective";
                break;
        }
        const formData = new FormData(event.target, event.submitter);
        fetchApi(url, "post", formData, () => {
            toast("Saved!", 600);
            onSubmit();
        });
    };
}

function bindCompletionDialog(dialog, onSubmit) {
    const form = dialog.querySelector("form");
    form.onsubmit = (event) => {
        event.preventDefault();
        dialog.close();
        if (event.submitter.name == "delete" && !confirm(`Are you sure you want to delete this completion?`)) return;
        const objectiveId = parseInt(event.target.querySelector("input[name='id']").value);
        const originalTs = parseInt(event.target.querySelector("input[name='timestamp']").value);
        const history = JSON.parse(event.target.querySelector("input[name='history']").value);
        if (event.submitter.name == "delete") {
            history.splice(history.indexOf(originalTs), 1);
        } else {
            const newDate = event.target.querySelector("input[name='date']").value;
            const newTime = event.target.querySelector("input[name='time']").value;
            const newTs = Math.floor((new Date(newDate + "T" + newTime).getTime()) / 1000);
            if (event.submitter.name == "add") {
                history.push(newTs);
            } else if (event.submitter.name == "save") {
                history[history.indexOf(originalTs)] = newTs;
            }
            history.sort();
        }
        saveObjectiveHistory(objectiveId, history, onSubmit);
    };
}

function openObjectiveDialog(dialog, objective=null) {
    dialog.querySelector("form").reset();
    if (objective != null) {
        dialog.querySelector("h2").textContent = "Edit objective";
        dialog.querySelector("input[name='id']").value = objective.id;
        dialog.querySelector("input[name='history']").value = JSON.stringify(objective.history);
        dialog.querySelector("input[name='archived']").value = objective.archived ? "on" : "off";
        dialog.querySelector("input[name='name']").value = objective.name;
        dialog.querySelector("input[name='flexible']").checked = objective.flexible;
        dialog.querySelector("input[name='period']").value = objective.period;
        dialog.querySelector("input[name='add']").style.display = "none";
        if (objective.archived) {
            dialog.querySelector("input[name='archive']").value = "Unarchive";
        } else {
            dialog.querySelector("input[name='archive']").value = "Archive";
        }
        dialog.querySelector("input[name='save']").style.display = "unset";
        dialog.querySelector("input[name='archive']").style.display = "unset";
        dialog.querySelector("input[name='delete']").style.display = "unset";
        dialog.querySelector("input[name='completion']").style.display = "unset";
    } else {
        dialog.querySelector("h2").textContent = "Create objective";
        dialog.querySelector("input[name='id']").value = "";
        dialog.querySelector("input[name='history']").value = "[]";
        dialog.querySelector("input[name='archived']").value = "off";
        dialog.querySelector("input[name='flexible']").removeAttribute("checked");
        dialog.querySelector("input[name='period']").value = 1;
        dialog.querySelector("input[name='add']").style.display = "unset";
        dialog.querySelector("input[name='archive']").style.display = "none";
        dialog.querySelector("input[name='save']").style.display = "none";
        dialog.querySelector("input[name='delete']").style.display = "none";
        dialog.querySelector("input[name='completion']").style.display = "none";
    }
    dialog.showModal();
}

function openCompletionDialog(dialog, objectiveId, objectiveName, objectiveHistory, timestamp=null) {
    dialog.querySelector("form").reset();
    dialog.querySelector("input[name='id']").value = objectiveId;
    dialog.querySelector("input[name='history'").value = JSON.stringify(objectiveHistory);
    if (timestamp != null) {
        dialog.querySelector("h2").innerHTML = `Edit completion of <em>${objectiveName}</em>`;
        dialog.querySelector("input[name='timestamp']").value = timestamp;
        const tsDate = new Date(timestamp * 1000);
        dialog.querySelector("input[name='date']").value = dtf(tsDate, "YYYY-mm-dd");
        dialog.querySelector("input[name='time']").value = dtf(tsDate, "HH:MM:SS");
        dialog.querySelector("input[name='add']").style.display = "none";
        dialog.querySelector("input[name='save']").style.display = "unset";
        dialog.querySelector("input[name='delete']").style.display = "unset";
    } else {
        dialog.querySelector("h2").innerHTML = `Add completion to <em>${objectiveName}</em>`;
        dialog.querySelector("input[name='add']").style.display = "unset";
        dialog.querySelector("input[name='save']").style.display = "none";
        dialog.querySelector("input[name='delete']").style.display = "none";
    }
    dialog.showModal();
}
