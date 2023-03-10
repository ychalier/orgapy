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
});