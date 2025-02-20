function inflateProgressChart(chart, year, counter) {
    chart.innerHTML = "";
    const dateStart = new Date();
    dateStart.setFullYear(year, 0, 1);
    const offset = (dateStart.getDay() + 6) % 7;
    const length = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0 ? 366 : 365;
    let column;
    let maxValue = Math.max(...Object.values(counter));
    if (maxValue == 0) maxValue = 1;
    for (let i = 0; i < length + offset; i++) {
        if (i % 7 == 0) {
            column = create(chart, "div", "progress-week");
        }
        const dt = new Date(dateStart);
        dt.setDate(dt.getDate() + i);
        const key = dtf(dt, "YYYY-mm-dd");
        const value = parseInt(key in counter ? counter[key] : "0");
        let shade;
        if (value == 0) {
            shade = 0;
        } else {
            shade = Math.ceil(4 * value / maxValue);
        }
        const day = create(column, "div", `progress-day progress-day-${shade}`);
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