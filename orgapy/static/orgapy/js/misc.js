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

    function row_is_lower(x, y) {
        const float_x = parseFloat(x.textContent);
        const float_y = parseFloat(y.textContent);
        if (!isNaN(float_x) && !isNaN(float_y)) {
            return float_x < float_y;
        } else {
            return x.textContent.toLowerCase() > y.textContent.toLowerCase();
        }
    }

    document.querySelectorAll("table.sortable").forEach(table => {
        table.querySelectorAll("thead th").forEach((th, thi) => {
            th.addEventListener("click", () => {
                let switching = true;
                while (switching) {
                    switching = false;
                    rows = table.rows;
                    for (i = 1; i < (rows.length - 1); i++) {
                        shouldSwitch = false;
                        x = rows[i].getElementsByTagName("TD")[thi];
                        y = rows[i + 1].getElementsByTagName("TD")[thi];
                        if (row_is_lower(x, y)) {
                            shouldSwitch = true;
                            break;
                        }
                    }
                    if (shouldSwitch) {
                        rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
                        switching = true;
                    }
                }
            });
        });
    });
});