function capitalize(string) {
    if (string.length == 0) return string;
    return string.charAt(0).toUpperCase() + string.substring(1);
}

function inflateMoodLogForm(form) {

    const trackerContainer = form.querySelector(".mood-log-form-trackers")
    for (const name of ["mood", "energy", "health", "stress"]) {
        const input = form.querySelector(`input[name=${name}]`);
        const span = create(trackerContainer, "span");
        span.title = capitalize(name);
        function updateValue(delta) {
            const currentValue = parseInt(input.value);
            const nextValue = (currentValue - 1 + 3 + delta) % 3 + 1;
            if (nextValue == 1) {
                span.textContent = "🟥";
            } else if (nextValue == 2) {
                span.textContent = "🟦";
            } else if (nextValue == 3) {
                span.textContent = "🟩";
            } else {
                throw new Error(`Invalid value ${nextValue}`);
            }
            input.value = nextValue;
        }
        updateValue(0);
        span.addEventListener("contextmenu", (e) => {e.preventDefault();});
        span.addEventListener("mouseup", (e) => {if (e.button == 0) {updateValue(1);} else if (e.button == 2) {updateValue(-1);}});
        span.addEventListener("touchend", (e) => {updateValue(1);});
    }

    const activityContainer = form.querySelector(".mood-log-form-activities")
    const activityStatuses = [];

    const activitiesInput = form.querySelector("input[name=activities]");
    function updateActivitiesInput() {
        let value = "";
        for (const [i, activity] of MOOD_ACTIVITIES.entries()) {
            if (activityStatuses[i]) value += activity.emoji + ",";
        }
        activitiesInput.value = value.substring(0, value.length - 1);
    }

    for (const [i, activity] of MOOD_ACTIVITIES.entries()) {
        const span = create(activityContainer, "span", "mood-activity");
        span.textContent = activity.emoji;
        span.title = activity.label;
        activityStatuses.push(false);
        span.addEventListener("click", (e) => {
            activityStatuses[i] = !activityStatuses[i];
            if (activityStatuses[i]) {
                span.classList.add("active");
            } else {
                span.classList.remove("active");
            }
            updateActivitiesInput();
        });
    }

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        fetchApi(URL_API + "?action=create-mood-log", "POST", formData=new FormData(form), onSuccess=() => {
            const parent = form.parentElement;
            remove(form);
            if (document.querySelectorAll("form.mood-log-form").length == 0) {
                remove(parent);
            }
            toast("Saved!", 600);
        });
    });

}

function inflateMoodLogForms() {
    document.querySelectorAll("form.mood-log-form").forEach(inflateMoodLogForm);
}