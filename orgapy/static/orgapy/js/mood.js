function inflateMoodLogForm(form) {

    for (const name of ["mood", "energy", "health", "stress"]) {
        const input = form.querySelector(`input[name=${name}]`);
        const button = form.querySelector(`button[name=${name}]`);
        function updateValue(delta) {
            const currentValue = parseInt(input.value);
            const nextValue = (currentValue - 1 + 3 + delta) % 3 + 1;
            if (nextValue == 1) {
                button.className = "moodlog-tracker mood-bad";
            } else if (nextValue == 2) {
                button.className = "moodlog-tracker mood-neutral";
            } else if (nextValue == 3) {
                button.className = "moodlog-tracker mood-good";
            } else {
                throw new Error(`Invalid value ${nextValue}`);
            }
            input.value = nextValue;
        }
        updateValue(0);
        button.oncontextmenu = (e) => {e.preventDefault()};
        button.onclick = (e) => {e.preventDefault()};
        button.addEventListener("mouseup", (e) => {e.preventDefault(); if (e.button == 0) {updateValue(1);} else if (e.button == 2) {updateValue(-1);}});
        button.addEventListener("touchend", (e) => {e.preventDefault(); updateValue(1);});
    }

    const activitiesInput = form.querySelector("input[name=activities]");
    for (const button of form.querySelectorAll(".moodlog-activities-suggestions button")) {
        button.onclick = (e) => {
            e.preventDefault();
            const emoji = button.textContent;
            const currentValue = activitiesInput.value;
            if (!currentValue.includes(emoji)) {
                if (currentValue == "" || currentValue.endsWith(",")) {
                    activitiesInput.value = currentValue + emoji;
                } else {
                    activitiesInput.value = currentValue + "," + emoji;
                }
            }
            activitiesInput.focus();
        }
    }

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        post(form.getAttribute("action"), new FormData(form))
            .then((res) => {
                const parent = form.parentElement;
                remove(form);
                if (document.querySelectorAll("form.moodlog-form").length == 0) {
                    remove(parent.parentElement.parentElement);
                }
                showToast("Saved mood log");
            })
            .catch(msg => {showToast(msg, true)});
    });

}

function inflateMoodLogForms() {
    document.querySelectorAll("form.moodlog-form").forEach(inflateMoodLogForm);
}
