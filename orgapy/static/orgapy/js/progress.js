function initializeProgressChart(chart) {
    const year = parseInt(chart.getAttribute("year"));
    fetch(URL_API + `?action=progress&year=${year}`).then(res => res.json()).then(data => {
        inflateCalendar(chart, data, {showHeader: true, weekly: true, relative: true});
    });
}