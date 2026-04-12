function fetchJournalData(category) {
    const url = category == null ? URL_API + `?action=search` : URL_API + `?action=search&category=${category}`;
    fetchApi(url, "get", null, searchResults => {
        data = {};
        for (const obj of searchResults.objects) {
            const dt = new Date(obj.dateCreation);
            const year = dt.getFullYear();
            if (!(year in data)) {
                data[year] = {};
            }
            const key = dtf(dt, "YYYY-mm-dd");
            if (!(key in data[year])) {
                data[year][key] = [];
            }
            data[year][key].push(obj);
        }
        inflateCalendar(journal, data, {});
    });
}