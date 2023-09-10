window.addEventListener("load", () => {

    var objectives = null;
    const DAYW = 32; // Day widht in pixels

    function get_year_start() {
        let year_start = new Date();
        year_start.setTime(0);
        year_start.setFullYear((new Date()).getFullYear());
        return year_start;
    }

    function get_year_end() {
        let year_end = new Date();
        year_end.setTime(0);
        year_end.setFullYear((new Date()).getFullYear() + 1);
        return year_end;
    }

    function day_offset(d) {
        return Math.floor((d - get_year_start()) / 3600 / 24 / 1000) * DAYW;
    }

    function inflate_objgraph_head(objgraph) {
        let objgraph_head = objgraph.appendChild(document.createElement("div"));
        objgraph_head.classList.add("objgraph-head");
        objgraph_head.addEventListener("dblclick", () => {
            reset_objgraph_scroll();
        });
        let year_start = get_year_start();
        let today = new Date();
        for (let i = 0; i < 365; i++) { //TODO: leap year check
            let day = (new Date(year_start));
            day.setDate(year_start.getDate() + i);
            let objgraph_day = objgraph_head.appendChild(document.createElement("div"));
            objgraph_day.classList.add("objgraph-head-day");
            if (day.getDate() == 1) {
                objgraph_day.textContent = day.toLocaleDateString(day.locales, {month: "short"});
            }
            if (day.getDay() == 1) {
                objgraph_day.classList.add("objgraph-head-week");
            }
            if (day.getDate() == today.getDate() && day.getMonth() == today.getMonth()) {
                objgraph_day.classList.add("objgraph-head-today");
            }
        }
    }

    function save_objective_history(objective_id, objective_history) {
        let form_data = new FormData();
        form_data.set("csrfmiddlewaretoken", CSRF_TOKEN);
        form_data.set("objective_id", objective_id);
        form_data.set("objective_history", objective_history);
        fetch(URL_API_OBJECTIVE_HISTORY, {
            method: "post",
            body: form_data
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    toast("Saved!", 600);
                } else {
                    toast("An error occured", 600);
                }
            })
            .catch(err => {
                console.error(err);
                toast("An error occured", 600);
            });
    }

    function on_objective_check(objective_id) {
        let obj = objectives[objective_id];
        let history = [];
        for (let i = 0; i < obj.history.length; i++) {
            history.push(obj.history.charCodeAt(i) - 32);
        }
        let today = new Date();
        let date_start = new Date(obj.date_start);
        let i = 0;
        let objective_history_codes = [];
        while (true) {
            let date_end = new Date(date_start);
            date_end.setDate(date_end.getDate() + obj.period);
            let current = today >= date_start && today < date_end;
            let accomplished = 0;
            if (i < history.length) {
                accomplished = history[i];
            }
            if (current) {
                accomplished++;
            }
            objective_history_codes.push(32 + accomplished);
            if (current) {
                break;
            }
            i++;
            date_start.setDate(date_start.getDate() + obj.period);
        }
        let objective_history = String.fromCharCode(...objective_history_codes);
        objectives[objective_id].history = objective_history;
        save_objective_history(objective_id, objective_history);
        create_objgraph();
    }

    function inflate_objgraph_objective(objgraph_body, objective_id) {
        let objgraph_objective = objgraph_body.appendChild(document.createElement("div"));
        objgraph_objective.classList.add("objgraph-objective");
        let obj = objectives[objective_id];
        let history = [];
        for (let i = 0; i < obj.history.length; i++) {
            history.push(obj.history.charCodeAt(i) - 32);
        }
        let today = new Date();
        let date_start = new Date(obj.date_start);
        let year_start = get_year_start();
        let year_end = get_year_end();
        objgraph_objective.style.marginLeft = day_offset(date_start) + "px";
        let i = 0;
        while (date_start < year_end) {
            let date_end = new Date(date_start);
            date_end.setDate(date_end.getDate() + obj.period);
            if (date_end >= year_start) {
                let past =  date_end <= today;
                let current = today >= date_start && today < date_end;
                let future = date_start > today;
                let accomplished = 0;
                if (i < history.length) {
                    accomplished = history[i];
                }
                let dom_period = objgraph_objective.appendChild(document.createElement("div"));
                dom_period.classList.add("objgraph-period");
                dom_period.style.width = `${32 * obj.period}px`;
                for (let i = 0; i < obj.goal; i++) {
                    let dom_goal = dom_period.appendChild(document.createElement("div"));
                    dom_goal.classList.add("objgraph-goal");
                    if (i < accomplished && !future) {
                        dom_goal.classList.add("bg-success");
                    } else if (past) {
                        dom_goal.classList.add("bg-error");
                    } else if (current && i == accomplished) {
                        let dom_btncheck = dom_goal.appendChild(document.createElement("button"));
                        dom_btncheck.innerHTML = `<i class="icon icon-check"></i>`;
                        dom_btncheck.addEventListener("click", () => {
                            on_objective_check(objective_id);
                        });
                    } else if (future || ((current && i > accomplished))) {
                        dom_goal.classList.add("bg-dark");
                    }
                }
            }
            i++;
            date_start.setDate(date_start.getDate() + obj.period);
        }
        let dom_name = objgraph_objective.appendChild(document.createElement("div"));
        dom_name.classList.add("objgraph-name");
        dom_name.textContent = obj.name;
    }

    function inflate_objgraph_body(objgraph) {
        let objgraph_body = objgraph.appendChild(document.createElement("div"));
        objgraph_body.classList.add("objgraph-body");
        for (let objective_id in objectives) {
            inflate_objgraph_objective(objgraph_body, objective_id);
        }
    }

    var is_initial_scroll = true;
    function reset_objgraph_scroll() {
        let container = document.getElementById("objgraph-wrapper");
        let target = day_offset(new Date()) - container.getBoundingClientRect().width / 2 + DAYW;
        if (is_initial_scroll) {
            container.scrollLeft = target;
            is_initial_scroll = false;
        } else {
            container.scrollTo({top: 0, left: target, behavior: "smooth"});
        }
    }

    function create_objgraph() {
        let container = document.getElementById("objgraph-wrapper");
        container.innerHTML = "";
        let objgraph = container.appendChild(document.createElement("div"));
        objgraph.classList.add("objgraph");
        inflate_objgraph_head(objgraph);
        inflate_objgraph_body(objgraph);
        reset_objgraph_scroll();
    }

    fetch(URL_API_OBJECTIVE_LIST).then(res => res.json()).then(data => {
        objectives = {};
        data.objectives.forEach(objective => {
            objectives[objective.id] = objective;
        });
        create_objgraph();
    });

});