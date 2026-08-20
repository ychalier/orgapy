function bindChecklist(checklistContainer, saveButton, createListButton, clearButton, titleInput) {

    function readChecklistData() {
        const checklistData = {sections: []};
        for (const section of checklistContainer.querySelectorAll(".checklist-section")) {
            const sectionData = {
                items: [],
                label: section.querySelector(".checklist-section-label").value.trim()
            }
            if (sectionData.label.length == 0) continue;
            for (const item of section.querySelectorAll(".checklist-item")) {
                const itemData = {
                    checked: item.querySelector("input[name='checked']").checked,
                    label: item.querySelector("input[name='label']").value.trim()
                }
                if (itemData.label.length > 0) {
                    sectionData.items.push(itemData);
                }
            }
            checklistData.sections.push(sectionData);
        }
        return checklistData;
    }

    function onInput() {
        saveButton.removeAttribute("disabled");
    }

    function resetDragRank() {
        dragRankClear();
        dragRank(checklistContainer, ".checklist-section", onInput, {domReorder: true});
        for (const section of checklistContainer.querySelectorAll(".checklist-section")) {
            dragRank(section.querySelector(".checklist-items"), ".checklist-item", onInput, {domReorder: true});
        }
    }

    function createItemElement(itemData, container) {
        const item = create(container, "li", "checklist-item");
        const itemCheckbox = create(item, "input");
        itemCheckbox.type = "checkbox";
        itemCheckbox.name = "checked";
        itemCheckbox.oninput = onInput;
        if (itemData.checked) {
            itemCheckbox.setAttribute("checked", "");
        }
        const itemLabel = create(item, "input");
        itemLabel.value = itemData.label;
        itemLabel.name = "label";
        itemLabel.addEventListener("change", () => {
            if (itemLabel.value.trim() == "") {
                remove(item);
                resetDragRank();
            }
            onInput();
        });
        itemLabel.type = "text";
        itemLabel.placeholder = "Item";
        return item;
    }

    function createSectionElement(sectionData, container) {
        const section = create(container, "div", "checklist-section");
        const sectionLabel = create(section, "input", "checklist-section-label");
        sectionLabel.value = sectionData.label;
        sectionLabel.addEventListener("change", () => {
            if (sectionLabel.value.trim() == "") {
                remove(section);
                resetDragRank();
            }
            onInput();
        });
        sectionLabel.type = "text";
        sectionLabel.placeholder = "Section";
        const itemList = create(section, "ul", "checklist-items");
        for (const itemData of sectionData.items) {
            createItemElement(itemData, itemList);
        }
        const buttonAddItemWrapper = create(itemList, "li");
        const buttonAddItem = create(buttonAddItemWrapper, "button", "button-slim small");
        buttonAddItem.textContent = "Add item";
        buttonAddItem.onclick = () => {
            itemList.insertBefore(createItemElement({label: "", checked: false}, null), buttonAddItemWrapper);
            resetDragRank();
            onInput();
        }
        return section;
    }

    function inflateChecklist(checklistData) {
        checklistContainer.innerHTML = "";
        for (const sectionData of checklistData.sections) {
            createSectionElement(sectionData, checklistContainer);
        }
        const buttonAddSection = create(checklistContainer, "button", "button-add-section");
        buttonAddSection.textContent = "Add section";
        buttonAddSection.onclick = () => {
            checklistContainer.insertBefore(createSectionElement({label: "", items: []}, null), buttonAddSection);
            resetDragRank();
            onInput();
        };
        resetDragRank();
    }

    function fetchChecklistData() {
        fetch("?format=json").then(res => res.json()).then(checklistData => {
            inflateChecklist(checklistData);
        });
    }

    function saveChecklistData() {
        saveButton.setAttribute("disabled", "");
        const data = readChecklistData();
        post("", {title: titleInput.value, checklist: JSON.stringify(data)})
            .then(res => {showToast("Saved checklist")})
            .catch(msg => {showToast(msg, true)});
    }

    function createList() {
        const data = readChecklistData();
        const form = create(document.body, "form");
        form.method = "POST";
        form.action = "";
        const inputCsrf = create(form, "input");
        inputCsrf.name = "csrfmiddlewaretoken";
        inputCsrf.value = CSRF_TOKEN;
        const inputChecklist = create(form, "input");
        inputChecklist.name = "checklist";
        inputChecklist.value = JSON.stringify(data);
        const inputAction = create(form, "input");
        inputAction.name = "action";
        inputAction.value = "create";
        form.submit();
    }

    createListButton.onclick = createList;
    saveButton.onclick = saveChecklistData;
    saveButton.setAttribute("disabled", "");
    titleInput.oninput = onInput;
    fetchChecklistData();

    clearButton.onclick = () => {
        const data = readChecklistData();
        const form = create(document.body, "form");
        form.method = "POST";
        form.action = "";
        const inputCsrf = create(form, "input");
        inputCsrf.name = "csrfmiddlewaretoken";
        inputCsrf.value = CSRF_TOKEN;
        const inputAction = create(form, "input");
        inputAction.name = "action";
        inputAction.value = "clear";
        form.submit();
    }

}