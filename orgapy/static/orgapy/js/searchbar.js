window.addEventListener("load", () => {
    document.querySelectorAll(".searchbar-with-clear-button").forEach(container => {
        const bar = container.querySelector("input");
        const icon = container.querySelector("i");
        function checkIfSearchbarIsEmpty() {
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
        bar.addEventListener("input", checkIfSearchbarIsEmpty);
        checkIfSearchbarIsEmpty();
    });
});