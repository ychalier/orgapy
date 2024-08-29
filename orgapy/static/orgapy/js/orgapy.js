function bindSearchbarSuggestions(searchbar, apiAction) {
    window.addEventListener("load", () => {
        const input = searchbar.querySelector(".searchbar-input");
        const icon = searchbar.querySelector(".searchbar-icon");
        const container = searchbar.querySelector(".searchbar-suggestions");
        icon.addEventListener("click", () => {
            input.value = "";
            input.focus();
        });
        input.addEventListener("input", () => {
            container.innerHTML = "";
            const query = input.value.trim();
            fetch(URL_API + `?action=${apiAction}&q=${query}`).then(res => res.json()).then(data => {
                for (const entry of data.results) {
                    const element = document.createElement("a");
                    element.className = "searchbar-suggestion";
                    container.appendChild(element);
                    element.href = entry.url;               
                    element.innerHTML = `<mark>${ entry.title.slice(0, query.length) }</mark>${ entry.title.slice(query.length) }`;
                }
            });
        });
    });
}

/*******************************************************************************
 * OLD STUF
 *******************************************************************************
 */

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