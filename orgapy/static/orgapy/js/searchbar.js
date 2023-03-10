window.addEventListener("load", () => {

    function findLongestMatch(left, right) {
        left = left.toLowerCase();
        right = right.toLowerCase();
        let i = 0;
        while (left[i] == right[i]) {
            i++;
        }
        return i;
    }

    document.querySelectorAll(".searchbar-with-clear-button").forEach(container => {
        const bar = container.querySelector("input");
        const icon = container.querySelector("i");
        function check_if_searchbar_is_empty() {
            if (bar.value != "") {
                icon.classList.remove("hidden");
            } else {
                icon.classList.add("hidden");
            }
        }
        icon.addEventListener("click", () => {
            bar.value = "";
            icon.classList.add("hidden");
            bar.focus();
        });
        bar.addEventListener("input", () => {
            check_if_searchbar_is_empty();
            close_all_lists()
            const query = bar.value;
            if (query.length < 2) return;
            fetch(URL_API_SUGGESTIONS + `?q=${ query }`).then(res => res.json()).then(data => {
                if (data.results.length > 0) {
                    const autocomplete_items = document.createElement("div");
                    autocomplete_items.classList.add("autocomplete-items");
                    data.results.forEach(entry => {
                        const entry_element_link = document.createElement("a");
                        entry_element_link.href = entry.url;
                        const entry_element = document.createElement("div");
                        entry_element.classList.add("autocomplete-item");
                        entry_element_link.appendChild(entry_element);
                        entry_element.innerHTML = `<b>${ entry.title.slice(0, query.length) }</b>${ entry.title.slice(query.length) }`;
                        autocomplete_items.appendChild(entry_element_link);
                    });
                    container.appendChild(autocomplete_items);
                }
            });
        });

        function close_all_lists() {
            container.querySelectorAll(".autocomplete-items").forEach(el => {
                el.parentNode.removeChild(el);
            });
        }
    
        document.addEventListener("click", function (e) {
            close_all_lists(e.target);
        });

        check_if_searchbar_is_empty();
    });

    

});