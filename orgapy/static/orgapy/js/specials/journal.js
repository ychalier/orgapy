const months = ["jan.", "feb.", "mar.", "apr.", "may", "june", "july", "aug.", "sep.", "oct.", "nov.", "dec."];
const container = document.getElementById("journal");
let data;
let minYear, maxYear;

function inflateYear(year) {
    const yearData = year in data ? data[year] : [];
    container.innerHTML = "";
    const journalHeader = create(container, "div", "journal-header");
    const prevButton = create(journalHeader, "button", "journal-button");
    prevButton.textContent = "‹";
    prevButton.title = year - 1;
    if (year == minYear) {
        prevButton.setAttribute("disabled", "1");
    } else {
        prevButton.addEventListener("click", () => {inflateYear(year - 1);});
    }
    create(journalHeader, "span").textContent = year;
    const nextButton = create(journalHeader, "button", "journal-button");
    nextButton.textContent = "›";
    nextButton.title = year + 1;
    if (year == maxYear) {
        nextButton.setAttribute("disabled", "1");
    } else {
        nextButton.addEventListener("click", () => {inflateYear(year + 1);});
    }
    const journalBody = create(container, "div", "journal-body");
    const firstRow = create(journalBody, "div", "journal-month");
    for (let i = 0; i <= 31; i++) {
        const cell = create(firstRow, "div", "journal-day-number");
        if (i > 0) {
            cell.textContent = i;
        }
    }
    let dt = new Date(year, 0, 1);
    let monthRow = null;
    while (dt.getFullYear() == year) {
        if (dt.getDate() == 1) {
            monthRow = create(journalBody, "div", "journal-month");
            create(monthRow, "div", "journal-month-name").textContent = months[dt.getMonth()];
        }
        const dayCell = create(monthRow, "div", "journal-day");
        const key = dtf(dt, "YYYY-mm-dd");
        if (key in yearData) {
            dayCell.classList.add("filled");
            if (yearData[key].length > 0) {
                dayCell.addEventListener("click", () => {
                    window.location.href = yearData[key][0].href;
                });
            }
            let popover;
            let shouldClose = false;
            function showPopover() {
                document.querySelectorAll(".journal-popover").forEach(remove);
                popover = create(document.body, "div", "journal-popover");
                popover.addEventListener("mouseenter", () => {
                    shouldClose = false;
                });
                popover.addEventListener("mouseleave", () => {
                    shouldClose = true;
                    setTimeout(closePopover, 100);
                });
                const cellBounds = dayCell.getBoundingClientRect();
                popover.style.left = (cellBounds.left + 8) + "px";
                popover.style.top = (cellBounds.top + 16) + "px";
                create(popover, "span", "hint").textContent = key;
                for (const obj of yearData[key]) {
                    const objEl = create(popover, "a", "journal-object link-hidden");
                    objEl.textContent = obj.title;
                    objEl.href = obj.href;
                }
            }
            function closePopover() {
                if (popover == null) return;
                if (!shouldClose) return;
                try {
                    document.body.removeChild(popover);
                } catch { // popover could have already been deleted by showPopover
                    //pass
                }
                popover = null;
            }
            dayCell.addEventListener("mouseenter", () => {
                shouldClose = false;
                showPopover();
            });
            dayCell.addEventListener("mouseleave", () => {
                shouldClose = true;
                setTimeout(closePopover, 100);
            });
        }
        dt.setDate(dt.getDate() + 1);
    }
}

function fetchJournalData(category) {
    fetchApi(URL_API + `?action=search&category=${category}`, "get", null, searchResults => {
        data = {};
        for (const obj of searchResults.objects) {
            const dt = new Date(obj.dateCreation);
            const year = dt.getFullYear();
            if (minYear == undefined || year < minYear) minYear = year;
            if (maxYear == undefined || year > maxYear) maxYear = year;
            if (!(year in data)) {
                data[year] = {};
            }
            const key = dtf(dt, "YYYY-mm-dd");
            if (!(key in data[year])) {
                data[year][key] = [];
            }
            data[year][key].push(obj);
        }
        inflateYear((new Date()).getFullYear());
    });
}