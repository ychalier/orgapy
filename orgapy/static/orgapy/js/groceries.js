function bindGroceries(groceriesContainer, saveButton, createListButton) {

    function readGroceriesData() {
        const groceriesData = {sections: []};
        for (const section of groceriesContainer.querySelectorAll(".groceries-section")) {
            const sectionData = {
                items: [],
                label: section.querySelector(".groceries-section-label").value.trim()
            }
            if (sectionData.label.length == 0) continue;
            for (const item of section.querySelectorAll(".groceries-item")) {
                const itemData = {
                    checked: item.querySelector("input[name='checked']").checked,
                    label: item.querySelector("input[name='label']").value.trim()
                }
                if (itemData.label.length > 0) {
                    sectionData.items.push(itemData);
                }
            }
            groceriesData.sections.push(sectionData);
        }
        return groceriesData;
    }

    function onInput() {
        saveButton.removeAttribute("disabled");
    }

    function resetDragRank() {
        dragRankClear();
        dragRank(groceriesContainer, ".groceries-section", onInput, {domReorder: true});
        for (const section of groceriesContainer.querySelectorAll(".groceries-section")) {
            dragRank(section.querySelector(".groceries-items"), ".groceries-item", onInput, {domReorder: true});
        }
    }

    function createItemElement(itemData, container) {
        const item = create(container, "li", "groceries-item");
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
        const section = create(container, "div", "groceries-section");
        const sectionLabel = create(section, "input", "groceries-section-label");
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
        const itemList = create(section, "ul", "groceries-items");
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

    function inflateGroceries(groceriesData) {
        groceriesContainer.innerHTML = "";
        for (const sectionData of groceriesData.sections) {
            createSectionElement(sectionData, groceriesContainer);
        }
        const buttonAddSection = create(groceriesContainer, "button", "button-add-section");
        buttonAddSection.textContent = "Add section";
        buttonAddSection.onclick = () => {
            groceriesContainer.insertBefore(createSectionElement({label: "", items: []}, null), buttonAddSection);
            resetDragRank();
            onInput();
        };
        resetDragRank();
    }

    function fetchGroceriesData() {
        fetch("?format=json").then(res => res.json()).then(groceriesData => {
            inflateGroceries(groceriesData);
        });
    }

    function saveGroceriesData() {
        saveButton.setAttribute("disabled", "");
        const data = readGroceriesData();
        post("", {groceries: JSON.stringify(data)})
            .then(res => {showToast("Saved groceries")})
            .catch(msg => {showToast(msg, true)});
    }

    function createList() {
        const data = readGroceriesData();
        const form = create(document.body, "form");
        form.method = "POST";
        form.action = "";
        const inputCsrf = create(form, "input");
        inputCsrf.name = "csrfmiddlewaretoken";
        inputCsrf.value = CSRF_TOKEN;
        const inputGroceries = create(form, "input");
        inputGroceries.name = "groceries";
        inputGroceries.value = JSON.stringify(data);
        const inputAction = create(form, "input");
        inputAction.name = "action";
        inputAction.value = "create";
        form.submit();
    }

    createListButton.onclick = createList;
    saveButton.onclick = saveGroceriesData;
    saveButton.setAttribute("disabled", "");
    fetchGroceriesData();

}