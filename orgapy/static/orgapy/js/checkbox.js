var checkboxForm = document.querySelector("#checkbox_form");
var checkboxIdInput = document.querySelector("#checkbox_form input[name=\"checkbox_id\"]");
var checkboxStateInput = document.querySelector("#checkbox_form input[name=\"checkbox_state\"]");
let checkboxes = document.querySelectorAll(".note_content .task-list-item-checkbox");
for (let i = 0; i < checkboxes.length; i++) {
    checkboxes[i].onchange = (event) => {
        checkboxIdInput.value = checkboxes[i].getAttribute("id").substr(2);
        checkboxStateInput.value = checkboxes[i].checked;
        checkboxForm.submit();
    }
}
