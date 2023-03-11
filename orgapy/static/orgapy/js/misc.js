window.addEventListener("load", () => {
    document.querySelectorAll(".link-confirm").forEach(link => {
        link.addEventListener("click", (event) => {
            event.preventDefault();
            if (confirm("This can not be undone. Please confirm your decision.")) {
                window.location.href = link.href;
            }
        });
    });
    document.querySelectorAll(".show-on-switch-container").forEach(container => {
        const input = container.querySelector(".show-on-switch-input");
        const target = container.querySelector(".show-on-switch-target");

        function update_target_visibility() {
            if (input.checked) {
                target.classList.remove("hidden");
            } else {
                target.classList.add("hidden");
            }
        }
        update_target_visibility();
        input.addEventListener("input", update_target_visibility);
    });
    const input_categories = document.getElementById("input-categories");
    const input_categories_array = [];
    if (input_categories != null) {
        document.querySelectorAll(".category-chip").forEach(chip => {
            if (chip.classList.contains("active")) {
                input_categories_array.push(chip.textContent);
            }
            chip.addEventListener("click", () => {
                if (chip.classList.contains("active")) {
                    chip.classList.remove("active");
                    input_categories_array.splice(input_categories_array.indexOf(chip.textContent), 1);
                } else {
                    chip.classList.add("active");
                    input_categories_array.push(chip.textContent);
                }
                input_categories.value = input_categories_array.join(";");
            });
        });
        input_categories.value = input_categories_array.join(";");
    }
});