function inflateProgressChart(chart, year, counter) {
    chart.innerHTML = "";
    const dateStart = new Date();
    dateStart.setFullYear(year, 0, 1);
    const offset = (dateStart.getDay() + 6) % 7;
    const length = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0 ? 366 : 365;
    let maxValue = Math.max(...Object.values(counter));
    if (maxValue == 0) maxValue = 1;
    const table = create(create(chart, "table", "progress-table"), "tbody");
    const rows = [];
    const weekCount = Math.ceil((length + offset) / 7);
    const cells = [];
    for (let i = 0; i < 7; i++) {
        rows.push(create(table, "tr"));
    }
    for (let j = 0; j < weekCount; j++) {
        for (let i = 0; i < 7; i++) {
            cells.push(create(rows[i], "td"));
        }
    }
    for (let i = offset; i < length + offset; i++) {
        const dt = new Date(dateStart);
        dt.setDate(dt.getDate() + i - offset);
        const key = dtf(dt, "YYYY-mm-dd");
        const value = parseInt(key in counter ? counter[key] : "0");
        let shade;
        if (value == 0) {
            shade = 0;
        } else {
            shade = Math.ceil(4 * value / maxValue);
        }
        const day = create(cells[i], "div", `progress-day progress-day-${shade}`);
        day.title = `${key}: ${value}`;
        if (i < offset) {
            day.classList.add("progress-day-hidden");
        }
        day.addEventListener("click", (event) => {
            window.location.href = chart.getAttribute("url") + `?date=${key}`;
        });
    }
}

function initializeProgressChart(chart) {
    const year = parseInt(chart.getAttribute("year"));
    fetch(URL_API + `?action=progress&year=${year}`).then(res => res.json()).then(data => {
        inflateProgressChart(chart, year, data);
    });
}