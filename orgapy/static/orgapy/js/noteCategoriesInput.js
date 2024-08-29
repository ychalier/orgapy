window.addEventListener("load", () => {
    
    const categoryIndex = {};
    const categoryReverseIndex = {};
    for (const category of CATEGORIES) {
        categoryIndex[category.id] = category.name;
        categoryReverseIndex[category.name] = category.id;
    }

    const inputHidden = document.getElementById("categories-input-hidden");
    const inputNew = document.getElementById("categories-input-new");
    const inputEndChars = " ,;";

    function readInputHiddenValues() {
        const baseValues = inputHidden.value.trim().split(";");
        const newValues = [];
        for (const v of baseValues) {
            if (v.trim() != "" && !newValues.includes(v.trim())) {
                newValues.push(v.trim());
            }
        }
        return newValues;
    }

    function cleanInputHiddenValue() {
        inputHidden.value = readInputHiddenValues().join(";");
    }

    function updateCategories() {
        const container = document.getElementById("categories-input-current");
        container.innerHTML = "";
        for (const categoryIdOrName of readInputHiddenValues()) {
            const element = document.createElement("span");
            element.classList.add("category")
            container.appendChild(element);
            if (categoryIdOrName in categoryIndex) {
                element.textContent = categoryIndex[categoryIdOrName];
            } else {
                element.textContent = categoryIdOrName;
            }
            const icon = document.createElement("i");
            icon.classList.add("ri-close-line");
            element.appendChild(icon);
            icon.addEventListener("click", () => {
                inputHidden.value = inputHidden.value.replace(categoryIdOrName, "");
                cleanInputHiddenValue();
                updateCategories();
            });
        }
    }

    function getSuggestions(prefix) {
        if (prefix == "") return [];
        const currentCategoryNames = [];
        for (const categoryIdOrName of readInputHiddenValues()) {
            if (categoryIdOrName in categoryIndex) {
                currentCategoryNames.push(categoryIndex[categoryIdOrName]);
            } else {
                currentCategoryNames.push(categoryIdOrName);
            }
        }
        const candidates = [];
        for (const categoryName in categoryReverseIndex) {
            if (categoryName.startsWith(prefix) && !currentCategoryNames.includes(categoryName)) {
                candidates.push(categoryName);
            }
        }
        return candidates;
    }

    function updateSuggestions(prefix) {
        const candidates = getSuggestions(prefix);
        const container = document.getElementById("categories-suggestions-items");
        container.innerHTML = "";
        if (candidates.length > 0) {
            for (const categoryName of candidates) {
                const element = document.createElement("div");
                element.textContent = categoryName;
                element.addEventListener("click", () => {
                    submitCategoryName(categoryName);
                });
                container.appendChild(element);
            }
        }
    }

    function submitCategoryName(categoryName) {
        let valueToAppend;
        if (categoryName in categoryReverseIndex) {
            valueToAppend = categoryReverseIndex[categoryName];
        } else {
            valueToAppend = categoryName;
        }
        inputHidden.value = [...readInputHiddenValues(), valueToAppend].join(";");
        cleanInputHiddenValue();
        inputNew.value = "";
        updateCategories();
        updateSuggestions();
        inputNew.focus();
    }
    
    inputNew.addEventListener("input", () => {
        const value = inputNew.value.toLowerCase().trimStart();
        if (inputEndChars.includes(value.charAt(value.length - 1))) {
            const categoryName = value.substring(0, value.length - 1);
            submitCategoryName(categoryName);
        } else {
            updateSuggestions(value.trim());
        }
    });

    inputNew.addEventListener("keydown", (event) => {
        if (event.key == "Tab") {
            event.preventDefault();
            const candidates = getSuggestions(inputNew.value.toLowerCase().trim());
            if (candidates.length == 1) {
                submitCategoryName(candidates[0]);
            }
            return false;
        } else if (event.key == "Enter") {
            const value = inputNew.value.toLowerCase().trim();
            event.preventDefault();
            if (value != "") {
                submitCategoryName(value);
            }
            return false;
        }
    });

    updateCategories();

});