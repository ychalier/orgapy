var objectives = null;
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

function inflateObjgraphHead(objgraph) {
    let objgraphHead = create(objgraph, "div", "objgraph-head");
    objgraphHead.addEventListener("dblclick", () => {
        resetObjgraphScroll();
    });
    let yearStart = getYearStart();
    let today = new Date();
    const year = TODAY.getFullYear();
    const daysInYear = ((year % 4 === 0 && year % 100 > 0) || year % 400 == 0) ? 366 : 365;
    for (let i = 0; i < daysInYear; i++) {
        let day = (new Date(yearStart));
        day.setDate(yearStart.getDate() + i);
        let objgraphDay = create(objgraphHead, "div", "objgraph-head-day");
        objgraphDay.style.left = (i * DAYW) + "px";
        objgraphDay.title = day.toLocaleDateString(day.locales, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        });
        if (day.getDate() == 1) {
            objgraphDay.textContent = day.toLocaleDateString(day.locales, {month: "short"});
        }
        if (day.getDay() == 1) {
            objgraphDay.classList.add("objgraph-head-week");
        }
        if (day.getDate() == today.getDate() && day.getMonth() == today.getMonth()) {
            objgraphDay.classList.add("objgraph-head-today");
        }
    }
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

function saveObjectiveHistory(objectiveId) {
    apiPost("edit-objective-history",
        {
            objective_id: objectiveId,
            objective_history: JSON.stringify(objectives[objectiveId].history)
        },
        () => {
            toast("Saved objective histoyr!", 600);
        }
    );
}

function onObjectiveCheck(objectiveId) {
    let obj = objectives[objectiveId];
    let ts = Math.floor((new Date()).getTime() / 1000);
    obj.history.push(ts);
    saveObjectiveHistory(objectiveId);
    createObjgraph();
}

function inflateObjgraphObjective(objgraphBody, objectiveId, index) {
    let domObj = create(objgraphBody, "div", "objgraph-objective");
    let obj = objectives[objectiveId];
    let slots = obj.getSlots();
    slots.forEach(slot => {
        if (dayOffset(slot.start) + DAYW * slot.length < 0) return;
        let domSlot = create(domObj, "div", "objgraph-slot");
        domSlot.style.width = `${DAYW * slot.length}px`;
        domSlot.style.left = `${dayOffset(slot.start)}px`;
        let domSlotBackground = create(domSlot, "div", "objgraph-slot-background");
        if (slot.state == SLOT_STATE_COMPLETE) {
            domSlotBackground.classList.add("bg-success");
        } else if (slot.state == SLOT_STATE_MISSED) {
            domSlotBackground.classList.add("bg-error");
        } else if (slot.state == SLOT_STATE_COOLDOWN) {
            if (slot.early) {
                domSlotBackground.classList.add("bg-future-complete");
            } else {
                domSlotBackground.classList.add("bg-cooldown");
            }
        } else if (slot.state == SLOT_STATE_FUTURE) {
            domSlotBackground.classList.add("bg-future");
        } else if (slot.state == SLOT_STATE_FUTURE_COMPLETE) {
            domSlotBackground.classList.add("bg-future-complete");
        } else if (slot.state == SLOT_STATE_BUTTON) {
            let domButtonCheck = create(domSlotBackground, "button");
            if (slot.early) {
                domButtonCheck.classList.add("early");
            } else if (slot.late) {
                domButtonCheck.classList.add("late");
            }
            domButtonCheck.innerHTML = `<i class="ri-check-line"></i>`;
            domButtonCheck.addEventListener("click", () => {
                onObjectiveCheck(objectiveId);
            });
        }
    });
    obj.history.forEach(ts => {
        const offsetInDays = (ts * 1000 - getYearStart()) / DAYMS;
        if (offsetInDays < 0) return;
        let domCompletion = create(domObj, "div", "objgraph-completion");
        domCompletion.title = (new Date(ts * 1000)).toLocaleString();
        const OBJECTIVE_COMPLETION_WIDTH = 4;
        const OBJECTIVE_COMPLETION_OFFSET = 4;
        const completionOffset = Math.floor(offsetInDays) * DAYW
            + (DAYW - 2 * OBJECTIVE_COMPLETION_OFFSET - OBJECTIVE_COMPLETION_WIDTH) * (offsetInDays - Math.floor(offsetInDays))
            + OBJECTIVE_COMPLETION_OFFSET;
        domCompletion.style.left = completionOffset + "px";
        domCompletion.addEventListener("click", (event) => {
            openModalCompletionForm(obj, ts);
        });
    });
    let domName = create(objgraphBody, "div", "objgraph-name popover popover-bottom");
    if (obj.archived) {
        domName.classList.add("archived");
    }
    domName.textContent = obj.name;
    domName.style.top = ((index + 1) * 32 + 1) + "px";
    domName.addEventListener("click", (event) => {
        openModalObjectiveForm(obj);
    });

}

function inflateObjgraphBody(objgraph) {
    let objgraphBody = create(objgraph, "div", "objgraph-body");
    let i = 0;
    for (let objectiveId in objectives) {
        inflateObjgraphObjective(objgraphBody, objectiveId, i);
        i++;
    }
    if ([...Object.keys(objectives)].length == 0) {
        objgraphBody.textContent = "No objective";
        objgraphBody.style.position = "absolute";
        objgraphBody.style.left = "50%";
        objgraphBody.style.transform = "translateX(-50%)";
        objgraph.style.paddingBottom = "24px";
    }
}

function resetObjgraphScroll() {
    let container = document.getElementById("objgraph-wrapper");
    let target = dayOffset(new Date()) - 0.5 * container.getBoundingClientRect().width;
    if (isInitialScroll) {
        container.scrollLeft = target;
        isInitialScroll = false;
    } else {
        container.scrollTo({top: 0, left: target, behavior: "smooth"});
    }
}

function createObjgraph() {
    let container = document.getElementById("objgraph-wrapper");
    if (container == null) {
        console.log("Could not find objgraph container");
        return;
    }
    if (Object.keys(objectives).length == 0) {
        container.parentElement.classList.add("hidden");
    } else {
        container.parentElement.classList.remove("hidden");
    }
    container.innerHTML = "";
    let objgraph = create(container, "div", "objgraph");
    inflateObjgraphHead(objgraph);
    inflateObjgraphBody(objgraph);
    resetObjgraphScroll();
}

function fetchObjectives() {
    const showArchived = (new URLSearchParams(window.location.search)).get("archivedObjectives") == "1";
    fetch(URL_API + `?action=list-objectives${showArchived ? "&archived=1" : ""}`).then(res => res.json()).then(data => {
        objectives = {};
        data.objectives.forEach(data => {
            objectives[data.id] = new Objective(data);
        });
        createObjgraph();
    });
}

function openModalObjectiveForm(objective=null) {
    let modal = document.getElementById("modal-objective-form");
    modal.querySelector("form").reset();
    if (objective != null) {
        modal.querySelector("input[name='id']").value = objective.id;
        modal.querySelector("input[name='name']").value = objective.name;
        modal.querySelector("input[name='flexible']").checked = objective.flexible;
        modal.querySelector("input[name='period']").value = objective.period;
        modal.querySelector("input[name='add']").style.display = "none";
        if (objective.archived) {
            modal.querySelector("input[name='archive']").value = "Unarchive";
        } else {
            modal.querySelector("input[name='archive']").value = "Archive";
        }
        modal.querySelector("input[name='save']").style.display = "unset";
        modal.querySelector("input[name='delete']").style.display = "unset";
        modal.querySelector("input[name='completion']").style.display = "unset";
    } else {
        modal.querySelector("input[name='flexible']").removeAttribute("checked");
        modal.querySelector("input[name='period']").value = 1;
        modal.querySelector("input[name='add']").style.display = "unset";
        modal.querySelector("input[name='archive']").style.display = "none";
        modal.querySelector("input[name='save']").style.display = "none";
        modal.querySelector("input[name='delete']").style.display = "none";
        modal.querySelector("input[name='completion']").style.display = "none";
    }
    modal.classList.add("active");
}

function openModalCompletionForm(objective, timestamp=null) {
    let modal = document.getElementById("modal-completion-form");
    modal.querySelector("form").reset();
    modal.querySelector("input[name='id']").value = objective.id;
    if (timestamp != null) {
        modal.querySelector("input[name='timestamp']").value = timestamp;
        let tsDate = new Date(timestamp * 1000);
        modal.querySelector("input[name='date']").value = dtf(tsDate, "YYYY-mm-dd");
        modal.querySelector("input[name='time']").value = dtf(tsDate, "HH:MM:SS");
        modal.querySelector("input[name='add']").style.display = "none";
        modal.querySelector("input[name='save']").style.display = "unset";
        modal.querySelector("input[name='delete']").style.display = "unset";
    } else {
        modal.querySelector("input[name='add']").style.display = "unset";
        modal.querySelector("input[name='save']").style.display = "none";
        modal.querySelector("input[name='delete']").style.display = "none";
    }
    modal.classList.add("active");
}

window.addEventListener("load", () => {
    document.querySelector("#modal-objective-form form").addEventListener("submit", (event) => {
        event.preventDefault();
        closeModal("modal-objective-form");
        if (event.submitter.name == "completion") {
            let objective_id = parseInt(event.target.querySelector("input[name='id']").value);
            openModalCompletionForm(objectives[objective_id]);
            return;
        }
        if (event.submitter.name == "archive") {
            const objectiveId = parseInt(event.target.querySelector("input[name='id']").value);
            const archived = objectives[objectiveId].archived;
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
                fetchObjectives();
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
        let formData = new FormData(event.target, event.submitter);
        fetchApi(url, "post", formData, () => {
            toast("Saved!", 600);
            fetchObjectives();
        });
    });
    
    document.getElementById("btn-objective-create").addEventListener("click", (event) => {
        openModalObjectiveForm();
    });

    document.querySelector("#modal-completion-form form").addEventListener("submit", (event) => {
        event.preventDefault();
        closeModal("modal-completion-form");
        if (event.submitter.name == "delete" && !confirm(`Are you sure you want to delete this completion?`)) return;        
        let objectiveId = parseInt(event.target.querySelector("input[name='id']").value);
        let originalTs = parseInt(event.target.querySelector("input[name='timestamp']").value);
        let obj = objectives[objectiveId];
        if (event.submitter.name == "delete") {
            obj.history.splice(obj.history.indexOf(originalTs), 1);
        } else {
            let newDate = event.target.querySelector("input[name='date']").value;
            let newTime = event.target.querySelector("input[name='time']").value;
            let newTs = Math.floor((new Date(newDate + "T" + newTime).getTime()) / 1000);
            if (event.submitter.name == "add") {
                obj.history.push(newTs);
            } else if (event.submitter.name == "save") {
                obj.history[obj.history.indexOf(originalTs)] = newTs;
            }
            obj.history.sort();
        }
        saveObjectiveHistory(objectiveId);
        createObjgraph();
    });

    fetchObjectives();
})